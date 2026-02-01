package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/mattermost/mattermost-plugin-starter-template/server/dto"
	"github.com/mattermost/mattermost/server/public/model"
)

// HandleStartCall handles POST /api/v1/calls/start.
func (p *Plugin) HandleStartCall(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID := r.Header.Get("Mattermost-User-ID")
	if userID == "" {
		http.Error(w, "Not authorized", http.StatusUnauthorized)
		return
	}

	var req dto.StartCallRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.ChannelID == "" {
		http.Error(w, "channel_id is required", http.StatusBadRequest)
		return
	}

	user, appErr := p.API.GetUser(userID)
	if appErr != nil {
		http.Error(w, "Failed to get user", http.StatusInternalServerError)
		return
	}

	if !p.API.HasPermissionToChannel(userID, req.ChannelID, model.PermissionCreatePost) {
		http.Error(w, "No permission to post in channel", http.StatusForbidden)
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

	isCorporate := req.IsCorporateAC
	if isCorporate == "" {
		isCorporate = "0"
	}

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

	meetingURL := fmt.Sprintf("%s/v1/meeting/%s", daakiaFrontendURL, encodedRoomUID)

	post := &model.Post{
		UserId:    userID,
		ChannelId: req.ChannelID,
		Message:   fmt.Sprintf("@%s started a call", user.Username),
		Type:      "custom_daakia_call",
	}
	post.AddProp("meeting_url", meetingURL)
	post.AddProp("room_uid", encodedRoomUID)
	post.AddProp("call_started_at", time.Now().Unix())
	post.AddProp("caller_id", userID)
	post.AddProp("caller_name", user.GetDisplayName(model.ShowUsername))
	post.AddProp("call_active", true)

	createdPost, appErr := p.API.CreatePost(post)
	if appErr != nil {
		p.API.LogError("Failed to create call post", "error", appErr.Error())
		http.Error(w, "Failed to create call post", http.StatusInternalServerError)
		return
	}

	mattermostConfig := p.API.GetConfig()
	var callerAvatarURL string
	if mattermostConfig != nil && mattermostConfig.ServiceSettings.SiteURL != nil && *mattermostConfig.ServiceSettings.SiteURL != "" {
		callerAvatarURL = fmt.Sprintf("%s/api/v4/users/%s/image", *mattermostConfig.ServiceSettings.SiteURL, userID)
	} else {
		callerAvatarURL = fmt.Sprintf("/api/v4/users/%s/image", userID)
	}

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

	response := dto.StartCallResponse{
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

// HandleEndCall handles POST /api/v1/calls/end.
func (p *Plugin) HandleEndCall(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID := r.Header.Get("Mattermost-User-ID")
	if userID == "" {
		http.Error(w, "Not authorized", http.StatusUnauthorized)
		return
	}

	var req dto.EndCallRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.CallID == "" || req.ChannelID == "" {
		http.Error(w, "call_id and channel_id are required", http.StatusBadRequest)
		return
	}

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
