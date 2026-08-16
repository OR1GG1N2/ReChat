package main

import (
	"context"
	"fmt"

	"ReChat/auth"
	"ReChat/config"
	"ReChat/twitch"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx          context.Context
	twitchClient *twitch.Client
	oauthServer  *auth.OAuthServer
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{
		twitchClient: twitch.NewClient(),
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.twitchClient.SetContext(ctx)
}

// shutdown is called when the app closes
func (a *App) shutdown(ctx context.Context) {
	if a.oauthServer != nil {
		a.oauthServer.Stop()
	}
	a.twitchClient.Disconnect()
}

// JoinChannel joins a Twitch channel chat
func (a *App) JoinChannel(channelName string) error {
	if channelName == "" {
		return fmt.Errorf("channel name cannot be empty")
	}
	return a.twitchClient.JoinChannel(channelName)
}

// LeaveChannel leaves a Twitch channel chat
func (a *App) LeaveChannel(channelName string) error {
	return a.twitchClient.LeaveChannel(channelName)
}

// GetJoinedChannels returns list of active joined channels
func (a *App) GetJoinedChannels() []string {
	return a.twitchClient.GetJoinedChannels()
}

// ConnectChannel alias for backwards compatibility
func (a *App) ConnectChannel(channelName string) error {
	return a.JoinChannel(channelName)
}

// DisconnectChannel disconnects all channels
func (a *App) DisconnectChannel() {
	a.twitchClient.Disconnect()
}

// GetSettings loads and returns current app settings
func (a *App) GetSettings() config.AppSettings {
	return config.LoadSettings()
}

// SaveSettings saves app settings to disk and emits update event
func (a *App) SaveSettings(s config.AppSettings) error {
	err := config.SaveSettings(s)
	if err == nil && a.ctx != nil {
		runtime.EventsEmit(a.ctx, "settings:updated", s)
	}
	return err
}

// StartTwitchAuth launches local HTTP server and opens browser for Twitch OAuth
func (a *App) StartTwitchAuth() error {
	clientID := config.TwitchClientID

	if a.oauthServer != nil {
		a.oauthServer.Stop()
	}

	a.oauthServer = auth.NewOAuthServer(a.ctx, clientID, func(username string) {
		// Auto-join user's own channel right after OAuth browser login!
		if username != "" {
			_ = a.twitchClient.JoinChannel(username)
		}
	})

	if err := a.oauthServer.Start(); err != nil {
		return fmt.Errorf("failed to start local auth listener: %v", err)
	}

	authURL := fmt.Sprintf(
		"%s?client_id=%s&redirect_uri=%s&response_type=token&scope=%s",
		config.TwitchOAuthAuthURL,
		clientID,
		config.OAuthCallbackURI,
		"chat:read chat:edit user:read:email",
	)

	runtime.BrowserOpenURL(a.ctx, authURL)
	return nil
}

// LogoutTwitch clears authentication credentials
func (a *App) LogoutTwitch() error {
	settings := config.LoadSettings()
	settings.OAuthToken = ""
	settings.Username = ""
	err := config.SaveSettings(settings)
	if err == nil && a.ctx != nil {
		runtime.EventsEmit(a.ctx, "auth:updated", settings)
		runtime.EventsEmit(a.ctx, "settings:updated", settings)
	}
	return err
}
