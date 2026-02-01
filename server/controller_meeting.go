package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/mattermost/mattermost-plugin-starter-template/server/dto"
	"github.com/mattermost/mattermost/server/public/model"
)

// PersonalMeetingRoom represents a personal meeting room from Daakia API.
type PersonalMeetingRoom struct {
	ID                int    `json:"id"`
	RoomUID           string `json:"room_uid"`
	EventName         string `json:"event_name"`
	EventMode         string `json:"event_mode"`
	UserID            int    `json:"user_id,omitempty"`
	BusinessAccountID *int   `json:"business_account_id,omitempty"`
	IsCorporateAC     any    `json:"is_corporate_ac,omitempty"`
}

// PersonalMeetingRoomResponse represents the response from Daakia API.
type PersonalMeetingRoomResponse struct {
	Success int                 `json:"success"`
	Message string              `json:"message,omitempty"`
	Data    PersonalMeetingRoom `json:"data"`
}

// PersonalRoomURLResponse represents the response with room_uid and frontend URL.
type PersonalRoomURLResponse struct {
	Success int    `json:"success"`
	Message string `json:"message,omitempty"`
	Data    struct {
		RoomUID     string `json:"room_uid"`
		FrontendURL string `json:"frontend_url"`
		Token       string `json:"token"`
	} `json:"data"`
}

// DaakiaTokenResponse is the response for GET /api/v1/meeting/daakia-token.
type DaakiaTokenResponse struct {
	Success int    `json:"success"`
	Token   string `json:"token"`
	Message string `json:"message,omitempty"`
}

// HandleGetDaakiaToken handles GET /api/v1/meeting/daakia-token.
// Returns the current user's Daakia JWT from user properties (same token used for personal-room-url).
// Used when starting a call, joining from a post, or picking up a call so the widget can pass it to the iframe.
func (p *Plugin) HandleGetDaakiaToken(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID := r.Header.Get("Mattermost-User-ID")
	if userID == "" {
		http.Error(w, "Not authorized", http.StatusUnauthorized)
		return
	}

	user, appErr := p.API.GetUser(userID)
	if appErr != nil {
		http.Error(w, "Failed to get user", http.StatusInternalServerError)
		return
	}

	daakiaToken := ""
	if user.Props != nil {
		if token, ok := user.Props["daakia_jwt_token"]; ok {
			daakiaToken = token
		}
	}

	if daakiaToken == "" {
		http.Error(w, "Daakia token not found in user properties", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(DaakiaTokenResponse{
		Success: 1,
		Token:   daakiaToken,
		Message: "success",
	}); err != nil {
		p.API.LogError("Failed to encode response", "error", err.Error())
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
}

// HandleGetPersonalRoomURL handles GET /api/v1/meeting/personal-room-url.
func (p *Plugin) HandleGetPersonalRoomURL(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID := r.Header.Get("Mattermost-User-ID")
	if userID == "" {
		http.Error(w, "Not authorized", http.StatusUnauthorized)
		return
	}

	user, appErr := p.API.GetUser(userID)
	if appErr != nil {
		http.Error(w, "Failed to get user", http.StatusInternalServerError)
		return
	}

	daakiaToken := ""
	if user.Props != nil {
		if token, ok := user.Props["daakia_jwt_token"]; ok {
			daakiaToken = token
		}
	}

	if daakiaToken == "" {
		http.Error(w, "Daakia token not found in user properties", http.StatusBadRequest)
		return
	}

	config := p.getConfiguration()
	daakiaBackendURL := config.DaakiaBackendURL
	if daakiaBackendURL == "" {
		p.API.LogError("DaakiaBackendURL not configured")
		http.Error(w, "DaakiaBackendURL not configured", http.StatusInternalServerError)
		return
	}

	queryParams := r.URL.Query()
	isCorporate := queryParams.Get("is_corporate_ac")
	businessAccountID := queryParams.Get("business_account_id")

	p.API.LogInfo("Getting personal room URL",
		"user_id", userID,
		"is_corporate_ac", isCorporate,
		"business_account_id", businessAccountID)

	meetingRoom, err := p.getPersonalMeetingRoomFromDaakia(
		daakiaBackendURL,
		daakiaToken,
		isCorporate,
		businessAccountID,
	)
	if err != nil {
		p.API.LogError("Failed to get personal meeting room", "error", err.Error())
		http.Error(w, "Failed to get personal meeting room: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if meetingRoom.RoomUID == "" {
		p.API.LogError("Daakia API returned empty room_uid")
		http.Error(w, "Daakia API returned empty room_uid", http.StatusInternalServerError)
		return
	}

	encodedRoomUID := base64.StdEncoding.EncodeToString([]byte(meetingRoom.RoomUID))

	daakiaFrontendURL := config.DaakiaFrontendURL
	if daakiaFrontendURL == "" {
		p.API.LogError("DaakiaFrontendURL not configured")
		http.Error(w, "DaakiaFrontendURL not configured", http.StatusInternalServerError)
		return
	}

	response := PersonalRoomURLResponse{
		Success: 1,
		Message: "success",
	}
	response.Data.RoomUID = encodedRoomUID
	response.Data.FrontendURL = daakiaFrontendURL
	response.Data.Token = daakiaToken

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		p.API.LogError("Failed to encode response", "error", err.Error())
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
}

// HandleCreateCallPost handles POST /api/v1/meeting/create-post.
func (p *Plugin) HandleCreateCallPost(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")
	if userID == "" {
		http.Error(w, "Not authorized", http.StatusUnauthorized)
		return
	}

	var req dto.CreateCallPostRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.ChannelID == "" || req.MeetingURL == "" {
		http.Error(w, "channel_id and meeting_url are required", http.StatusBadRequest)
		return
	}

	if !p.API.HasPermissionToChannel(userID, req.ChannelID, model.PermissionCreatePost) {
		http.Error(w, "No permission to post in channel", http.StatusForbidden)
		return
	}

	user, err := p.API.GetUser(userID)
	if err != nil {
		p.API.LogError("Failed to get user", "error", err.Error())
		http.Error(w, "Failed to get user", http.StatusInternalServerError)
		return
	}

	post := &model.Post{
		UserId:    userID,
		ChannelId: req.ChannelID,
		Message:   fmt.Sprintf("@%s started a call", user.Username),
		Type:      "custom_daakia_call",
	}
	post.AddProp("meeting_url", req.MeetingURL)
	if req.RoomUID != "" {
		post.AddProp("room_uid", req.RoomUID)
	}
	post.AddProp("call_started_at", time.Now().Unix())
	post.AddProp("caller_id", userID)
	post.AddProp("caller_name", user.GetDisplayName(model.ShowUsername))
	post.AddProp("call_active", true)

	createdPost, err := p.API.CreatePost(post)
	if err != nil {
		p.API.LogError("Failed to create call post", "error", err.Error())
		http.Error(w, "Failed to create call post", http.StatusInternalServerError)
		return
	}

	config := p.API.GetConfig()
	var avatarURL string
	if config != nil && config.ServiceSettings.SiteURL != nil && *config.ServiceSettings.SiteURL != "" {
		avatarURL = fmt.Sprintf("%s/api/v4/users/%s/image", *config.ServiceSettings.SiteURL, userID)
	} else {
		avatarURL = fmt.Sprintf("/api/v4/users/%s/image", userID)
	}

	p.API.PublishWebSocketEvent("call_started", map[string]any{
		"call_id":           createdPost.Id,
		"channel_id":        req.ChannelID,
		"caller_id":         userID,
		"caller_name":       user.GetDisplayName(model.ShowUsername),
		"caller_avatar_url": avatarURL,
		"meeting_url":       req.MeetingURL,
		"timestamp":         time.Now().Unix(),
	}, &model.WebsocketBroadcast{
		ChannelId: req.ChannelID,
	})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(createdPost); err != nil {
		p.API.LogError("Failed to encode response", "error", err)
	}
}

// getPersonalMeetingRoomFromDaakia fetches personal meeting room from Daakia API.
func (p *Plugin) getPersonalMeetingRoomFromDaakia(
	daakiaAPIURL, daakiaToken string,
	isCorporate, businessAccountID string,
) (*PersonalMeetingRoom, error) {
	daakiaURL := daakiaAPIURL + "/v2.0/meeting/personal/meetingRoom"
	u, err := url.Parse(daakiaURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse URL: %w", err)
	}

	q := u.Query()
	if isCorporate == "" {
		return nil, fmt.Errorf("is_corporate_ac parameter is required")
	}
	q.Set("is_corporate_ac", isCorporate)
	if businessAccountID != "" {
		q.Set("business_account_id", businessAccountID)
	}
	u.RawQuery = q.Encode()

	p.API.LogInfo("Calling Daakia personal meeting room API",
		"url", u.String(),
		"is_corporate_ac", q.Get("is_corporate_ac"),
		"business_account_id", q.Get("business_account_id"))

	req, err := http.NewRequest("GET", u.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+daakiaToken)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("platform", "web")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to call Daakia API: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		bodyStr := string(bodyBytes)
		p.API.LogError("Daakia API returned error",
			"status", resp.StatusCode,
			"url", u.String(),
			"response_body", bodyStr)
		return nil, fmt.Errorf("daakia API returned non-200 status %d: %s", resp.StatusCode, bodyStr)
	}

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	var personalRoomResponse PersonalMeetingRoomResponse
	if err := json.Unmarshal(responseBody, &personalRoomResponse); err != nil {
		p.API.LogError("Failed to decode response", "error", err.Error(), "response_body", string(responseBody))
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if personalRoomResponse.Success != 1 {
		p.API.LogError("Daakia API returned error in response",
			"message", personalRoomResponse.Message,
			"response_body", string(responseBody))
		return nil, fmt.Errorf("daakia API returned success=0: %s", personalRoomResponse.Message)
	}

	return &personalRoomResponse.Data, nil
}
