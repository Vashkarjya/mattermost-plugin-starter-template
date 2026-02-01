package dto

// CreateCallPostRequest is the request body for POST /api/v1/meeting/create-post.
type CreateCallPostRequest struct {
	ChannelID  string `json:"channel_id"`
	MeetingURL string `json:"meeting_url"`
	RoomUID    string `json:"room_uid,omitempty"`
}
