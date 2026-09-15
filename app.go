package main

import (
	"context"
	"fmt"

	"ReChat/auth"
	"ReChat/config"
	"ReChat/tts"
	"ReChat/twitch"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx          context.Context
	twitchClient *twitch.Client
	badgeFetcher *twitch.BadgeFetcher
	emoteFetcher *twitch.EmoteFetcher
	oauthServer  *auth.OAuthServer
	ttsClient    *tts.YandexTTS
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{
		twitchClient: twitch.NewClient(),
		badgeFetcher: twitch.NewBadgeFetcher(),
		emoteFetcher: twitch.NewEmoteFetcher(),
		ttsClient:    tts.NewYandexTTS(),
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.twitchClient.SetContext(ctx)

	// Fetch Twitch global badges in background
	go func() {
		badges, err := a.badgeFetcher.FetchGlobalBadges()
		if err == nil && a.ctx != nil {
			runtime.EventsEmit(a.ctx, "badges:loaded", badges)
		}
	}()

	// Auto-connect channels immediately on application launch!
	settings := config.LoadSettings()
	channelsToJoin := make(map[string]bool)

	if settings.Username != "" {
		channelsToJoin[settings.Username] = true
	}
	if settings.DefaultChannel != "" {
		channelsToJoin[settings.DefaultChannel] = true
	}
	for _, ch := range settings.JoinedChannels {
		if ch != "" {
			channelsToJoin[ch] = true
		}
	}

	chSlice := make([]string, 0, len(channelsToJoin))
	for ch := range channelsToJoin {
		chSlice = append(chSlice, ch)
		_ = a.twitchClient.JoinChannel(ch)
	}

	// Fetch 7TV, BTTV, and FFZ emotes for joined channels
	go func() {
		emotes, err := a.emoteFetcher.FetchAllEmotes(chSlice)
		if err == nil && a.ctx != nil {
			runtime.EventsEmit(a.ctx, "emotes:loaded", emotes)
		}
	}()
}

// shutdown is called when the app closes
func (a *App) shutdown(ctx context.Context) {
	if a.oauthServer != nil {
		a.oauthServer.Stop()
	}
	a.twitchClient.Disconnect()
	if a.ttsClient != nil {
		a.ttsClient.Close()
	}
}

// GetGlobalBadges fetches official Twitch global badges directly from Twitch API
func (a *App) GetGlobalBadges() (map[string]string, error) {
	return a.badgeFetcher.FetchGlobalBadges()
}

// GetEmotes fetches 7TV, BTTV, and FFZ emotes
func (a *App) GetEmotes() (map[string]string, error) {
	chans := a.twitchClient.GetJoinedChannels()
	return a.emoteFetcher.FetchAllEmotes(chans)
}

// JoinChannel joins a Twitch channel chat and saves to DB
func (a *App) JoinChannel(channelName string) error {
	if channelName == "" {
		return fmt.Errorf("channel name cannot be empty")
	}
	err := a.twitchClient.JoinChannel(channelName)
	if err == nil {
		a.syncJoinedChannelsToDB()
		// Refresh emotes for newly joined channel
		go func() {
			chans := a.twitchClient.GetJoinedChannels()
			emotes, err := a.emoteFetcher.FetchAllEmotes(chans)
			if err == nil && a.ctx != nil {
				runtime.EventsEmit(a.ctx, "emotes:loaded", emotes)
			}
		}()
	}
	return err
}

// LeaveChannel leaves a Twitch channel chat and updates DB
func (a *App) LeaveChannel(channelName string) error {
	err := a.twitchClient.LeaveChannel(channelName)
	if err == nil {
		a.syncJoinedChannelsToDB()
	}
	return err
}

func (a *App) syncJoinedChannelsToDB() {
	joined := a.twitchClient.GetJoinedChannels()
	settings := config.LoadSettings()
	settings.JoinedChannels = joined
	_ = config.SaveSettings(settings)
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
	a.syncJoinedChannelsToDB()
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

// ResizeWindowForSettings resizes the application window when opening/closing settings
func (a *App) ResizeWindowForSettings(openSettings bool) {
	if a.ctx == nil {
		return
	}
	if openSettings {
		// 760x570 = 4:3 aspect ratio Control Panel window
		runtime.WindowSetSize(a.ctx, 760, 570)
	} else {
		// 450x700 = Compact Chat window
		runtime.WindowSetSize(a.ctx, 450, 700)
	}
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
			_ = a.JoinChannel(username)
		}
		// Refresh badges with authenticated token
		go func() {
			badges, err := a.badgeFetcher.FetchGlobalBadges()
			if err == nil && a.ctx != nil {
				runtime.EventsEmit(a.ctx, "badges:loaded", badges)
			}
		}()
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

// SpeakText synthesizes speech from text using Yandex Alice TTS.
// Returns a base64 data URI string: "data:audio/ogg;base64,..."
func (a *App) SpeakText(text string, voice string) (string, error) {
	if a.ttsClient == nil {
		return "", fmt.Errorf("TTS client not initialized")
	}
	return a.ttsClient.Speak(text, voice)
}

// GetTTSVoices returns available TTS voice IDs and labels
func (a *App) GetTTSVoices() map[string]string {
	return tts.GetVoiceMap()
}
