package main

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"os/exec"
	runtime_os "runtime"
	"strconv"

	"ReChat/auth"
	"ReChat/config"
	"ReChat/tts"
	"ReChat/twitch"
	"ReChat/widget"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx            context.Context
	twitchClient   *twitch.Client
	badgeFetcher   *twitch.BadgeFetcher
	emoteFetcher   *twitch.EmoteFetcher
	oauthServer    *auth.OAuthServer
	ttsClient      *tts.YandexTTS
	eventsubClient *twitch.EventSubClient
	widgetServer   *widget.WidgetServer
}

// NewApp creates a new App application struct
func NewApp() *App {
	app := &App{
		twitchClient: twitch.NewClient(),
		badgeFetcher: twitch.NewBadgeFetcher(),
		emoteFetcher: twitch.NewEmoteFetcher(),
		ttsClient:    tts.NewYandexTTS(),
		widgetServer: widget.NewWidgetServer(3500),
	}

	// Shared helper: convert any ChatMessage to a WidgetMessage and broadcast
	broadcastToWidget := func(msg *twitch.ChatMessage) {
		if msg == nil {
			return
		}
		wm := widget.WidgetMessage{
			Type:      "message",
			Author:    msg.DisplayName,
			AvatarURL: widget.GetAvatarURL(msg.User),
			Color:     msg.Color,
			Text:      msg.Message,
			Channel:   msg.Channel,
		}
		if msg.IsEvent && msg.EventType == "reward" {
			wm.Type = "reward"
			wm.RewardTitle = msg.EventData["rewardTitle"]
			wm.UserInput = msg.Message
			if cost, err := strconv.Atoi(msg.EventData["rewardCost"]); err == nil {
				wm.Cost = cost
			}
		}
		app.widgetServer.Broadcast(wm)
	}

	// Wire IRC client → widget (all PRIVMSG, events, etc.)
	app.twitchClient.SetMessageHandler(broadcastToWidget)

	// Wire EventSub client → Wails frontend + widget
	app.eventsubClient = twitch.NewEventSubClient(func(msg *twitch.ChatMessage) {
		if app.ctx != nil {
			runtime.EventsEmit(app.ctx, "chat:message", msg)
		}
		broadcastToWidget(msg)
	})
	return app
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
	if settings.AlwaysOnTop {
		runtime.WindowSetAlwaysOnTop(a.ctx, true)
	}
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

	a.eventsubClient.SetContext(ctx)
	if settings.OAuthToken != "" {
		a.eventsubClient.Start(settings.OAuthToken, settings.UserID)
	}

	chSlice := make([]string, 0, len(channelsToJoin))
	for ch := range channelsToJoin {
		chSlice = append(chSlice, ch)
		_ = a.twitchClient.JoinChannel(ch)
		a.eventsubClient.AddChannel(ch)
	}

	// Start OBS widget HTTP server
	a.widgetServer.Start()

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
	if a.eventsubClient != nil {
		a.eventsubClient.Stop()
	}
	if a.ttsClient != nil {
		a.ttsClient.Close()
	}
	if a.widgetServer != nil {
		a.widgetServer.Stop()
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
		a.eventsubClient.AddChannel(channelName)
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
		a.eventsubClient.RemoveChannel(channelName)
	}
	return err
}

// SendMessage sends a chat message to a Twitch channel via IRC
func (a *App) SendMessage(channelName, message string) error {
	return a.twitchClient.SendMessage(channelName, message)
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
		runtime.WindowSetAlwaysOnTop(a.ctx, s.AlwaysOnTop)
		runtime.EventsEmit(a.ctx, "settings:updated", s)
	}
	return err
}

// ResizeWindowForSettings handles window sizing when toggling settings
func (a *App) ResizeWindowForSettings(openSettings bool) {
	// Settings now perfectly fit the compact stream chat companion window
}

// StartTwitchAuth launches local HTTP server and opens browser for Twitch OAuth
func (a *App) StartTwitchAuth() error {
	clientID := config.TwitchClientID

	if a.oauthServer != nil {
		a.oauthServer.Stop()
	}

	a.oauthServer = auth.NewOAuthServer(a.ctx, clientID, func(username string) {
		settings := config.LoadSettings()
		a.eventsubClient.Start(settings.OAuthToken, settings.UserID)
		// Auto-join user's own channel right after OAuth browser login!
		if username != "" {
			_ = a.JoinChannel(username)
			a.eventsubClient.AddChannel(username)
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

	vals := url.Values{}
	vals.Set("client_id", clientID)
	vals.Set("redirect_uri", config.OAuthCallbackURI)
	vals.Set("response_type", "token")
	vals.Set("scope", "chat:read chat:edit user:read:email channel:read:redemptions")

	authURL := fmt.Sprintf("%s?%s", config.TwitchOAuthAuthURL, vals.Encode())

	if a.ctx != nil {
		runtime.BrowserOpenURL(a.ctx, authURL)
	}
	if runtime_os.GOOS == "windows" {
		_ = exec.Command("rundll32", "url.dll,FileProtocolHandler", authURL).Start()
	}
	return nil
}

// LogoutTwitch clears authentication credentials
func (a *App) LogoutTwitch() error {
	if a.eventsubClient != nil {
		a.eventsubClient.Stop()
	}
	settings := config.LoadSettings()
	settings.OAuthToken = ""
	settings.Username = ""
	settings.UserID = ""
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

// GetWidgetURL returns the URL of the OBS chat widget (for copy-pasting into Browser Source)
func (a *App) GetWidgetURL() string {
	return fmt.Sprintf("http://localhost:%d/widget/chat", a.widgetServer.Port())
}

// GetWidgetThemes returns list of available theme names
func (a *App) GetWidgetThemes() []string {
	entries, err := os.ReadDir(a.widgetServer.ThemesDirectory())
	if err != nil {
		return []string{}
	}
	themes := []string{}
	for _, e := range entries {
		if e.IsDir() {
			themes = append(themes, e.Name())
		}
	}
	return themes
}

// OpenThemesDir opens the themes folder in Explorer/Finder
func (a *App) OpenThemesDir() {
	dir := a.widgetServer.ThemesDirectory()
	switch runtime_os.GOOS {
	case "windows":
		_ = exec.Command("explorer", dir).Start()
	case "darwin":
		_ = exec.Command("open", dir).Start()
	default:
		_ = exec.Command("xdg-open", dir).Start()
	}
}
