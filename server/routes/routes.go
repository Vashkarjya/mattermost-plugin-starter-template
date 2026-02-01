package routes

import (
	"net/http"

	"github.com/gorilla/mux"
)

// Handlers holds all HTTP handlers for the API. The plugin wires these in api.go.
type Handlers struct {
	HelloWorld                http.HandlerFunc
	HandleStartCall           http.HandlerFunc
	HandleEndCall             http.HandlerFunc
	HandleGetPersonalRoomURL  http.HandlerFunc
	HandleGetDaakiaToken      http.HandlerFunc
	HandleCreateCallPost      http.HandlerFunc
}

// Register binds all API routes to the given router using the provided handlers.
func Register(apiRouter *mux.Router, h *Handlers) {
	apiRouter.HandleFunc("/hello", h.HelloWorld).Methods(http.MethodGet)

	// Calls
	apiRouter.HandleFunc("/calls/start", h.HandleStartCall).Methods(http.MethodPost)
	apiRouter.HandleFunc("/calls/end", h.HandleEndCall).Methods(http.MethodPost)

	// Meeting room
	apiRouter.HandleFunc("/meeting/personal-room-url", h.HandleGetPersonalRoomURL).Methods(http.MethodGet)
	apiRouter.HandleFunc("/meeting/daakia-token", h.HandleGetDaakiaToken).Methods(http.MethodGet)
	apiRouter.HandleFunc("/meeting/create-post", h.HandleCreateCallPost).Methods(http.MethodPost)
}
