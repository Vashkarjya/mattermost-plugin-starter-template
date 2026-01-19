package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// PersonalMeetingRoom represents a personal meeting room from Daakia API
type PersonalMeetingRoom struct {
	ID                int         `json:"id"`
	RoomUID           string      `json:"room_uid"`
	EventName         string      `json:"event_name"`
	EventMode         string      `json:"event_mode"`
	UserID            int         `json:"user_id,omitempty"`
	BusinessAccountID *int        `json:"business_account_id,omitempty"`
	IsCorporateAC     interface{} `json:"is_corporate_ac,omitempty"`
}

// PersonalMeetingRoomResponse represents the response from Daakia API
type PersonalMeetingRoomResponse struct {
	Success int                 `json:"success"`
	Message string              `json:"message,omitempty"`
	Data    PersonalMeetingRoom `json:"data"`
}

// PersonalRoomURLResponse represents the response with room_uid and frontend URL
type PersonalRoomURLResponse struct {
	Success int    `json:"success"`
	Message string `json:"message,omitempty"`
	Data    struct {
		RoomUID     string `json:"room_uid"`
		FrontendURL string `json:"frontend_url"`
	} `json:"data"`
}

// handleGetPersonalRoomURL gets personal meeting room URL from Daakia backend
// Frontend sends: is_corporate_ac and business_account_id in query params
func (p *Plugin) handleGetPersonalRoomURL(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID := r.Header.Get("Mattermost-User-ID")
	if userID == "" {
		http.Error(w, "Not authorized", http.StatusUnauthorized)
		return
	}

	// Get user to access properties (for Daakia JWT token)
	user, appErr := p.API.GetUser(userID)
	if appErr != nil {
		http.Error(w, "Failed to get user", http.StatusInternalServerError)
		return
	}

	// Get Daakia token from user props
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

	// Get Daakia backend URL from configuration
	config := p.getConfiguration()
	daakiaBackendURL := config.DaakiaBackendURL
	if daakiaBackendURL == "" {
		p.API.LogError("DaakiaBackendURL not configured")
		http.Error(w, "DaakiaBackendURL not configured", http.StatusInternalServerError)
		return
	}

	// Get query parameters from frontend (is_corporate_ac and business_account_id)
	queryParams := r.URL.Query()
	isCorporate := queryParams.Get("is_corporate_ac")
	businessAccountID := queryParams.Get("business_account_id")

	p.API.LogInfo("Getting personal room URL",
		"user_id", userID,
		"is_corporate_ac", isCorporate,
		"business_account_id", businessAccountID)

	// Get personal meeting room from Daakia backend
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

	// Validate that room_uid is not empty - return error if missing (no hardcoded fallback)
	if meetingRoom.RoomUID == "" {
		p.API.LogError("Daakia API returned empty room_uid")
		http.Error(w, "Daakia API returned empty room_uid", http.StatusInternalServerError)
		return
	}

	// Encode room_uid to base64 (as per reference implementation)
	encodedRoomUID := base64.StdEncoding.EncodeToString([]byte(meetingRoom.RoomUID))

	// Get Daakia frontend URL from configuration
	daakiaFrontendURL := config.DaakiaFrontendURL
	if daakiaFrontendURL == "" {
		p.API.LogError("DaakiaFrontendURL not configured")
		http.Error(w, "DaakiaFrontendURL not configured", http.StatusInternalServerError)
		return
	}

	// Return response with base64 encoded room_uid and frontend URL
	response := PersonalRoomURLResponse{
		Success: 1,
		Message: "success",
	}
	response.Data.RoomUID = encodedRoomUID
	response.Data.FrontendURL = daakiaFrontendURL

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		p.API.LogError("Failed to encode response", "error", err.Error())
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
}

// getPersonalMeetingRoomFromDaakia gets personal meeting room from Daakia API
func (p *Plugin) getPersonalMeetingRoomFromDaakia(
	daakiaAPIURL, daakiaToken string,
	isCorporate, businessAccountID string,
) (*PersonalMeetingRoom, error) {
	// Build Daakia API URL - endpoint is /v2.0/meeting/personal/meetingRoom
	daakiaURL := daakiaAPIURL + "/v2.0/meeting/personal/meetingRoom"
	u, err := url.Parse(daakiaURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse URL: %w", err)
	}

	// Build query parameters
	q := u.Query()
	// Validate is_corporate_ac is provided
	if isCorporate == "" {
		return nil, fmt.Errorf("is_corporate_ac parameter is required")
	}
	q.Set("is_corporate_ac", isCorporate)
	// Send business_account_id if provided (required when is_corporate_ac === "1")
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
	req.Header.Set("platform", "web") // Required by Daakia backend

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to call Daakia API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		bodyStr := string(bodyBytes)

		p.API.LogError("Daakia API returned error",
			"status", resp.StatusCode,
			"url", u.String(),
			"response_body", bodyStr)

		return nil, fmt.Errorf("Daakia API returned non-200 status %d: %s", resp.StatusCode, bodyStr)
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
		return nil, fmt.Errorf("Daakia API returned success=0: %s", personalRoomResponse.Message)
	}

	return &personalRoomResponse.Data, nil
}
