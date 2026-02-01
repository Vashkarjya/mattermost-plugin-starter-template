package dto

// StartCallRequest is the request body for POST /api/v1/calls/start.
type StartCallRequest struct {
	ChannelID         string `json:"channel_id"`
	IsCorporateAC     string `json:"is_corporate_ac,omitempty"`
	BusinessAccountID string `json:"business_account_id,omitempty"`
}

// StartCallResponse is the response for POST /api/v1/calls/start.
type StartCallResponse struct {
	CallID     string `json:"call_id"`
	ChannelID  string `json:"channel_id"`
	MeetingURL string `json:"meeting_url"`
}

// EndCallRequest is the request body for POST /api/v1/calls/end.
type EndCallRequest struct {
	CallID    string `json:"call_id"`
	ChannelID string `json:"channel_id"`
}
