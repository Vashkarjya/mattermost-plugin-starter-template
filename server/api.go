package main

import (
	"net/http"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-plugin-starter-template/server/routes"
	"github.com/mattermost/mattermost/server/public/plugin"
)

// ServeHTTP handles HTTP requests for the plugin. All API routes are registered
// in server/routes and handlers live in controller_*.go files.
func (p *Plugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
	router := mux.NewRouter()
	router.Use(p.MattermostAuthorizationRequired)

	apiRouter := router.PathPrefix("/api/v1").Subrouter()
	routes.Register(apiRouter, &routes.Handlers{
		HelloWorld:                p.HelloWorld,
		HandleStartCall:           p.HandleStartCall,
		HandleEndCall:             p.HandleEndCall,
		HandleGetPersonalRoomURL:  p.HandleGetPersonalRoomURL,
		HandleGetDaakiaToken:      p.HandleGetDaakiaToken,
		HandleCreateCallPost:      p.HandleCreateCallPost,
	})

	router.ServeHTTP(w, r)
}

// MattermostAuthorizationRequired ensures the request has a logged-in Mattermost user.
func (p *Plugin) MattermostAuthorizationRequired(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID := r.Header.Get("Mattermost-User-ID")
		if userID == "" {
			http.Error(w, "Not authorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}
