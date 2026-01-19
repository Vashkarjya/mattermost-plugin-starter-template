package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
)

// StartCallRequest represents the request to start a call
type StartCallRequest struct {
	ChannelID        string `json:"channel_id"`
	IsCorporateAC    string `json:"is_corporate_ac,omitempty"`
	BusinessAccountID string `json:"business_account_id,omitempty"`
}

// StartCallResponse represents the response when starting a call
type StartCallResponse struct {
	CallID     string `json:"call_id"`
	ChannelID  string `json:"channel_id"`
	MeetingURL string `json:"meeting_url"`
}

// EndCallRequest represents the request to end a call
type EndCallRequest struct {
	CallID    string `json:"call_id"`
	ChannelID string `json:"channel_id"`
}

// handleStartCall handles the POST /api/v1/calls/start endpoint
func (p *Plugin) handleStartCall(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID := r.Header.Get("Mattermost-User-ID")
	if userID == "" {
		http.Error(w, "Not authorized", http.StatusUnauthorized)
		return
	}

	var req StartCallRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.ChannelID == "" {
		http.Error(w, "channel_id is required", http.StatusBadRequest)
		return
	}

	// Get user info
	user, appErr := p.API.GetUser(userID)
	if appErr != nil {
		http.Error(w, "Failed to get user", http.StatusInternalServerError)
		return
	}

	// Check if user has permission to post in channel
	if !p.API.HasPermissionToChannel(userID, req.ChannelID, model.PermissionCreatePost) {
		http.Error(w, "No permission to post in channel", http.StatusForbidden)
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

	// Determine is_corporate_ac if not provided (default to "0" for personal account)
	isCorporate := req.IsCorporateAC
	if isCorporate == "" {
		isCorporate = "0" // Default to personal account
	}

	// Get personal meeting room from Daakia backend
	meetingRoom, err := p.getPersonalMeetingRoomFromDaakia(
		daakiaBackendURL,
		daakiaToken,
		isCorporate,
		req.BusinessAccountID,
	)
	if err != nil {
		p.API.LogError("Failed to get personal meeting room", "error", err.Error())
		http.Error(w, "Failed to get personal meeting room: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Validate that room_uid is not empty
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

	// Build meeting URL using Daakia frontend URL as base
	meetingURL := fmt.Sprintf("%s/v1/meeting/%s", daakiaFrontendURL, encodedRoomUID)

	// Create a call post with real meeting URL
	post := &model.Post{
		UserId:    userID,
		ChannelId: req.ChannelID,
		Message:   fmt.Sprintf("@%s started a call", user.Username),
		Type:      "custom_daakia_call",
	}

	// Add properties that match what the core CallPost component expects
	post.AddProp("meeting_url", meetingURL)
	post.AddProp("room_uid", encodedRoomUID)
	post.AddProp("call_started_at", time.Now().Unix())
	post.AddProp("caller_id", userID)
	post.AddProp("caller_name", user.GetDisplayName(model.ShowUsername))
	// Add a property to track if call is active (not ended)
	post.AddProp("call_active", true)

	createdPost, appErr := p.API.CreatePost(post)
	if appErr != nil {
		p.API.LogError("Failed to create call post", "error", appErr.Error())
		http.Error(w, "Failed to create call post", http.StatusInternalServerError)
		return
	}

	// Get caller avatar URL
	mattermostConfig := p.API.GetConfig()
	var callerAvatarURL string
	if mattermostConfig != nil && mattermostConfig.ServiceSettings.SiteURL != nil && *mattermostConfig.ServiceSettings.SiteURL != "" {
		callerAvatarURL = fmt.Sprintf("%s/api/v4/users/%s/image", *mattermostConfig.ServiceSettings.SiteURL, userID)
	} else {
		// Fallback to relative URL if SiteURL is not configured
		callerAvatarURL = fmt.Sprintf("/api/v4/users/%s/image", userID)
	}

	// Broadcast call_started event via WebSocket with real meeting URL
	p.API.PublishWebSocketEvent("call_started", map[string]any{
		"call_id":           createdPost.Id,
		"channel_id":        req.ChannelID,
		"caller_id":         userID,
		"caller_name":       user.GetDisplayName(model.ShowUsername),
		"caller_avatar_url": callerAvatarURL,
		"meeting_url":       meetingURL,
		"timestamp":         time.Now().Unix(),
	}, &model.WebsocketBroadcast{
		ChannelId: req.ChannelID,
	})

	// Return response with meeting URL so caller can join
	response := StartCallResponse{
		CallID:     createdPost.Id,
		ChannelID:  req.ChannelID,
		MeetingURL: meetingURL,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(response); err != nil {
		p.API.LogError("Failed to encode response", "error", err)
	}
}

// handleEndCall handles the POST /api/v1/calls/end endpoint
func (p *Plugin) handleEndCall(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID := r.Header.Get("Mattermost-User-ID")
	if userID == "" {
		http.Error(w, "Not authorized", http.StatusUnauthorized)
		return
	}

	var req EndCallRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.CallID == "" || req.ChannelID == "" {
		http.Error(w, "call_id and channel_id are required", http.StatusBadRequest)
		return
	}

	// Broadcast call_ended event via WebSocket
	p.API.PublishWebSocketEvent("call_ended", map[string]any{
		"call_id":    req.CallID,
		"channel_id": req.ChannelID,
		"ended_by":   userID,
		"timestamp":  time.Now().Unix(),
	}, &model.WebsocketBroadcast{
		ChannelId: req.ChannelID,
	})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(map[string]any{
		"status":  "ok",
		"call_id": req.CallID,
	}); err != nil {
		p.API.LogError("Failed to encode response", "error", err)
	}
}

// CreateCallPostRequest represents the request to create a call post
type CreateCallPostRequest struct {
	ChannelID  string `json:"channel_id"`
	MeetingURL string `json:"meeting_url"`
	RoomUID    string `json:"room_uid,omitempty"`
}

// handleCreateCallPost handles the POST /api/v1/meeting/create-post endpoint
func (p *Plugin) handleCreateCallPost(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")
	if userID == "" {
		http.Error(w, "Not authorized", http.StatusUnauthorized)
		return
	}

	var req CreateCallPostRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.ChannelID == "" || req.MeetingURL == "" {
		http.Error(w, "channel_id and meeting_url are required", http.StatusBadRequest)
		return
	}

	// Check permission
	if !p.API.HasPermissionToChannel(userID, req.ChannelID, model.PermissionCreatePost) {
		http.Error(w, "No permission to post in channel", http.StatusForbidden)
		return
	}

	// Get user info
	user, err := p.API.GetUser(userID)
	if err != nil {
		p.API.LogError("Failed to get user", "error", err.Error())
		http.Error(w, "Failed to get user", http.StatusInternalServerError)
		return
	}

	// Create call post
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

	// Get avatar URL
	config := p.API.GetConfig()
	var avatarURL string
	if config != nil && config.ServiceSettings.SiteURL != nil && *config.ServiceSettings.SiteURL != "" {
		avatarURL = fmt.Sprintf("%s/api/v4/users/%s/image", *config.ServiceSettings.SiteURL, userID)
	} else {
		avatarURL = fmt.Sprintf("/api/v4/users/%s/image", userID)
	}

	// Broadcast call_started event
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
	json.NewEncoder(w).Encode(createdPost)
}
