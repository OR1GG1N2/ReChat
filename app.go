package main

import (
	"context"
	"fmt"

	"ReChat/config"
	"ReChat/twitch"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx          context.Context
	twitchClient *twitch.Client
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

	// Auto connect to default channel if set
	settings := config.LoadSettings()
	if settings.DefaultChannel != "" {
		_ = a.twitchClient.Connect(settings.DefaultChannel)
	}
}

// shutdown is called when the app closes
func (a *App) shutdown(ctx context.Context) {
	a.twitchClient.Disconnect()
}

// ConnectChannel connects to a Twitch channel chat
func (a *App) ConnectChannel(channelName string) error {
	if channelName == "" {
		return fmt.Errorf("channel name cannot be empty")
	}
	return a.twitchClient.Connect(channelName)
}

// DisconnectChannel disconnects from the current channel
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

// SetWindowSize changes Wails application window dimensions
func (a *App) SetWindowSize(width int, height int) {
	if a.ctx != nil {
		runtime.WindowSetSize(a.ctx, width, height)
	}
}
