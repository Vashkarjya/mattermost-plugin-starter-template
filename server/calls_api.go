package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
)

// StartCallRequest represents the request to start a call
type StartCallRequest struct {
	ChannelID string `json:"channel_id"`
}

// StartCallResponse represents the response when starting a call
type StartCallResponse struct {
	CallID    string `json:"call_id"`
	ChannelID string `json:"channel_id"`
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

	// Create a call post
	post := &model.Post{
		UserId:    userID,
		ChannelId: req.ChannelID,
		Message:   fmt.Sprintf("@%s started a call", user.Username),
		Type:      "custom_daakia_call",
	}

	// Add properties that match what the core CallPost component expects
	post.AddProp("meeting_url", fmt.Sprintf("daakia://call/%d", time.Now().Unix()))
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
	config := p.API.GetConfig()
	var callerAvatarURL string
	if config != nil && config.ServiceSettings.SiteURL != nil && *config.ServiceSettings.SiteURL != "" {
		callerAvatarURL = fmt.Sprintf("%s/api/v4/users/%s/image", *config.ServiceSettings.SiteURL, userID)
	} else {
		// Fallback to relative URL if SiteURL is not configured
		callerAvatarURL = fmt.Sprintf("/api/v4/users/%s/image", userID)
	}

	// Broadcast call_started event via WebSocket
	p.API.PublishWebSocketEvent("call_started", map[string]any{
		"call_id":           createdPost.Id,
		"channel_id":        req.ChannelID,
		"caller_id":         userID,
		"caller_name":       user.GetDisplayName(model.ShowUsername),
		"caller_avatar_url": callerAvatarURL,
		"timestamp":         time.Now().Unix(),
	}, &model.WebsocketBroadcast{
		ChannelId: req.ChannelID,
	})

	// Return response
	response := StartCallResponse{
		CallID:    createdPost.Id,
		ChannelID: req.ChannelID,
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
