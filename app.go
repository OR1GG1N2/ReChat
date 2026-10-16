package main

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	runtime_os "runtime"
	"strings"
	"sync"
	"time"

	"ReChat/auth"
	"ReChat/config"
	"ReChat/proxy"
	"ReChat/overlay"
	"ReChat/tts"
	"ReChat/twitch"
	"ReChat/media"
	"ReChat/widget"
	"ReChat/donationalerts"
	"ReChat/pipeline"
	"ReChat/kick"
	"ReChat/music"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx            context.Context
	twitchClient   *twitch.Client
	kickClient     *kick.Client
	badgeFetcher   *twitch.BadgeFetcher
	emoteFetcher   *twitch.EmoteFetcher
	oauthServer    *auth.OAuthServer
	ttsClient      *tts.YandexTTS
	eventsubClient *twitch.EventSubClient
	widgetServer   *widget.WidgetServer
	mediaManager   *media.Manager
	daClient       *donationalerts.Client
	pipeline       *pipeline.Pipeline
	supertonicMgr  *tts.SupertonicManager
	musicService   *music.Service
	isGameMode     bool
	lastToggleTime time.Time
	gameModeMu     sync.Mutex
}

// NewApp creates a new App application struct
func NewApp() *App {
	app := &App{
		twitchClient:  twitch.NewClient(),
		badgeFetcher:  twitch.NewBadgeFetcher(),
		emoteFetcher:  twitch.NewEmoteFetcher(),
		ttsClient:     tts.NewYandexTTS(),
		supertonicMgr: tts.NewSupertonicManager(),
		widgetServer:  widget.NewWidgetServer(3500),
		mediaManager:  media.NewManager(),
		daClient:      donationalerts.NewClient(""),
		pipeline:      pipeline.New(),
		kickClient:    kick.NewClient(),
		musicService:  music.NewService(proxy.GetHTTPClient),
	}

	app.widgetServer.SetBadgeFetcher(app.badgeFetcher.GetBadgeMap)
	app.widgetServer.SetEmoteFetcher(app.emoteFetcher.GetEmoteMap)
	app.widgetServer.SetMusicService(app.musicService)

	// Wire pipeline sinks
	app.pipeline.OnChatMessage(func(msg *twitch.ChatMessage) {
		if app.ctx != nil {
			runtime.EventsEmit(app.ctx, "chat:message", msg)
		}
	})
	app.pipeline.OnWidgetMessage(func(wm widget.WidgetMessage) {
		app.widgetServer.Broadcast(wm)
	})
	app.pipeline.OnDonation(func(author string, amount float64, currency, message string) {
		if app.widgetServer != nil {
			app.widgetServer.BroadcastDonation(author, amount, currency, message)
		}
	})
	app.pipeline.OnGoal(func(ev donationalerts.GoalEvent) {
		if app.widgetServer != nil {
			app.widgetServer.BroadcastGoal(ev.Title, ev.CurrentAmount, ev.TargetAmount, ev.Currency)
		}
		if app.ctx != nil {
			runtime.EventsEmit(app.ctx, "goal:update", map[string]interface{}{
				"title":         ev.Title,
				"currentAmount": ev.CurrentAmount,
				"targetAmount":  ev.TargetAmount,
				"currency":      ev.Currency,
				"percent":       ev.Percent,
			})
		}
	})

	// Wire IRC client → pipeline widget sink and music order handler
	app.twitchClient.SetMessageHandler(func(msg *twitch.ChatMessage) {
		isEventSub := app.eventsubClient != nil && app.eventsubClient.IsRunning()
		app.pipeline.ConsumeIRCMessage(msg, isEventSub)
		app.handleMusicOrder(msg)
	})

	// Wire Kick client → pipeline sink and music order handler
	app.kickClient.SetMessageHandler(func(msg *twitch.ChatMessage) {
		app.pipeline.ConsumeIRCMessage(msg, false)
		app.handleMusicOrder(msg)
	})

	// Suppress IRC custom-reward-id duplicates when EventSub is running
	app.twitchClient.SetRewardFilter(func(msg *twitch.ChatMessage) bool {
		return app.eventsubClient != nil && app.eventsubClient.IsRunning()
	})

	// Broadcast background avatar updates immediately to OBS widget
	widget.SetOnAvatarUpdated(func(login, avatarURL string) {
		app.widgetServer.BroadcastAvatarUpdate(login, avatarURL)
	})

	// Wire EventSub client → pipeline (emits to both Wails frontend & OBS widget) and music order handler
	app.eventsubClient = twitch.NewEventSubClient(func(msg *twitch.ChatMessage) {
		app.pipeline.ConsumeEventSubMessage(msg)
		app.handleMusicOrder(msg)
	})
	return app
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Configure network proxy from saved settings
	settings := config.LoadSettings()
	proxy.Configure(settings)
	a.twitchClient.SetContext(ctx)
	if a.musicService != nil {
		a.musicService.SetContext(ctx)
		a.musicService.SetOnTrackStart(func(track *music.Track) {
			rules := a.musicService.GetRules()
			if rules.PauseSystemMedia && a.mediaManager != nil {
				a.mediaManager.PauseSystemMedia(false)
			}
			if a.widgetServer != nil && track != nil {
				a.widgetServer.BroadcastMusicTrack(media.TrackInfo{
					Status:    "playing",
					Title:     track.Title,
					Artist:    track.Author,
					Thumbnail: track.Thumbnail,
					Source:    "YouTube",
					Timestamp: time.Now().UnixMilli(),
				})
			}
		})
	}

	// Emit Supertonic model download progress to frontend
	if a.supertonicMgr != nil {
		a.supertonicMgr.SetOnProgress(func(status tts.SupertonicStatus) {
			if a.ctx != nil {
				runtime.EventsEmit(a.ctx, "supertonic:progress", status)
			}
		})
	}

	// Fetch Twitch global badges in background
	go func() {
		badges, err := a.badgeFetcher.FetchGlobalBadges()
		if err == nil && a.ctx != nil {
			runtime.EventsEmit(a.ctx, "badges:loaded", badges)
		}
	}()

	// Auto-connect channels immediately on application launch!
	settings = config.LoadSettings()
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

	// Auto-connect Kick channels if enabled
	a.kickClient.SetContext(ctx)
	if settings.KickEnabled {
		for _, kch := range settings.KickChannels {
			cleanSlug := strings.TrimSpace(kch)
			if cleanSlug != "" {
				go func(slug string) {
					_ = a.kickClient.JoinChannel(slug)
				}(cleanSlug)
			}
		}
	}

	// Connect media manager to widget server and start watcher
	a.widgetServer.SetMediaManager(a.mediaManager)
	a.mediaManager.Start()
	a.widgetServer.BroadcastMusicConfig(map[string]interface{}{
		"style":          settings.MusicStyle,
		"accentColor":    settings.MusicAccentColor,
		"showCover":      settings.MusicShowCover,
		"showVisualizer": settings.MusicShowVisualizer,
		"showArtist":     settings.MusicShowArtist,
		"hideOnPause":    settings.MusicHideOnPause,
		"pauseDelay":     settings.MusicPauseDelay,
		"scale":          settings.MusicScale,
		"bgOpacity":      settings.MusicBgOpacity,
	})

	// Start OBS widget HTTP server
	a.widgetServer.Start()

	// Start global hotkey listener for Game Mode (Ctrl+Shift+G / Ctrl+Shift+O) and TTS Skip (Esc / F8 / Ctrl+Shift+S)
	overlay.StartGlobalHotkey(
		func() {
			a.ToggleGameMode()
		},
		func() {
			if a.ctx != nil {
				runtime.EventsEmit(a.ctx, "tts:skip")
			}
		},
	)

	// Fetch 7TV, BTTV, and FFZ emotes for joined channels
	go func() {
		emotes, err := a.emoteFetcher.FetchAllEmotes(chSlice)
		if err == nil && a.ctx != nil {
			runtime.EventsEmit(a.ctx, "emotes:loaded", emotes)
		}
	}()

	// Wire DonationAlerts client -> Wails frontend + widget server
	a.daClient.SetCallbacks(
		func(ev donationalerts.DonationEvent) {
			s := config.LoadSettings()
			a.pipeline.ConsumeDonation(ev, &s)
			if a.musicService != nil {
				rules := a.musicService.GetRules()
				if rules.OrdersEnabled && rules.DonationOrdersEnabled && ev.Amount >= rules.MinDonation && strings.TrimSpace(ev.Message) != "" {
					costStr := fmt.Sprintf("%.0f ₽", ev.Amount)
					go func() {
						if rules.PauseSystemMedia && a.mediaManager != nil {
							a.mediaManager.PauseSystemMedia(false)
						}
						_, _ = a.musicService.AddTrack(ev.Message, ev.Name, "donationalerts", costStr)
					}()
				}
			}
		},
		func(ev donationalerts.GoalEvent) {
			a.pipeline.ConsumeGoal(ev)
		},
		func(connected bool, status string) {
			if a.ctx != nil {
				runtime.EventsEmit(a.ctx, "da:status", map[string]interface{}{
					"connected": connected,
					"status":    status,
				})
			}
		},
	)

	if settings.DAEnabled && strings.TrimSpace(settings.DAToken) != "" {
		a.daClient.SetToken(settings.DAToken)
		a.daClient.Start()
	}
}

// QuitApp cleanly terminates all background processes and exits the application
func (a *App) QuitApp() {
	go func() {
		time.Sleep(500 * time.Millisecond)
		os.Exit(0)
	}()
	a.shutdown(context.Background())
	os.Exit(0)
}

// shutdown is called when the app closes
func (a *App) shutdown(ctx context.Context) {
	overlay.StopGlobalHotkey()
	if a.oauthServer != nil {
		a.oauthServer.Stop()
	}
	a.twitchClient.Disconnect()
	if a.eventsubClient != nil {
		a.eventsubClient.Stop()
	}
	if a.kickClient != nil {
		a.kickClient.Disconnect()
	}
	if a.ttsClient != nil {
		a.ttsClient.Close()
	}
	if a.mediaManager != nil {
		a.mediaManager.Stop()
	}
	if a.daClient != nil {
		a.daClient.Stop()
	}
	if a.widgetServer != nil {
		a.widgetServer.Stop()
	}
	if a.supertonicMgr != nil {
		a.supertonicMgr.Close()
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
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "channels:updated", joined)
	}
}

// GetJoinedChannels returns list of active joined channels
func (a *App) GetJoinedChannels() []string {
	return a.twitchClient.GetJoinedChannels()
}

// JoinKickChannel joins a Kick channel chat and saves to settings
func (a *App) JoinKickChannel(channelName string) error {
	if a.kickClient == nil {
		return fmt.Errorf("kick client not initialized")
	}
	clean := strings.ToLower(strings.TrimSpace(channelName))
	clean = strings.TrimPrefix(clean, "#")
	if clean == "" {
		return fmt.Errorf("channel name cannot be empty")
	}
	err := a.kickClient.JoinChannel(clean)
	if err == nil {
		a.syncKickChannelsToDB()
	}
	return err
}

// LeaveKickChannel leaves a Kick channel chat and updates settings
func (a *App) LeaveKickChannel(channelName string) error {
	if a.kickClient == nil {
		return fmt.Errorf("kick client not initialized")
	}
	clean := strings.ToLower(strings.TrimSpace(channelName))
	clean = strings.TrimPrefix(clean, "#")
	err := a.kickClient.LeaveChannel(clean)
	if err == nil {
		a.syncKickChannelsToDB()
	}
	return err
}

// GetJoinedKickChannels returns list of active Kick channels
func (a *App) GetJoinedKickChannels() []string {
	if a.kickClient == nil {
		return []string{}
	}
	return a.kickClient.GetJoinedChannels()
}

func (a *App) syncKickChannelsToDB() {
	if a.kickClient == nil {
		return
	}
	joined := a.kickClient.GetJoinedChannels()
	settings := config.LoadSettings()
	settings.KickChannels = joined
	_ = config.SaveSettings(settings)
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "kick:channels:updated", joined)
	}
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
	oldSettings := config.LoadSettings()
	proxyChanged := (oldSettings.ProxyEnabled != s.ProxyEnabled ||
		oldSettings.ProxyType != s.ProxyType ||
		oldSettings.ProxyAddress != s.ProxyAddress ||
		oldSettings.ProxyAuth != s.ProxyAuth ||
		oldSettings.ProxyUser != s.ProxyUser ||
		oldSettings.ProxyPassword != s.ProxyPassword)

	daChanged := (oldSettings.DAEnabled != s.DAEnabled || oldSettings.DAToken != s.DAToken)

	err := config.SaveSettings(s)
	if err == nil {
		if a.widgetServer != nil {
			a.widgetServer.BroadcastMusicConfig(map[string]interface{}{
				"style":          s.MusicStyle,
				"accentColor":    s.MusicAccentColor,
				"showCover":      s.MusicShowCover,
				"showVisualizer": s.MusicShowVisualizer,
				"showArtist":     s.MusicShowArtist,
				"hideOnPause":    s.MusicHideOnPause,
				"pauseDelay":     s.MusicPauseDelay,
				"scale":          s.MusicScale,
				"bgOpacity":      s.MusicBgOpacity,
			})
		}
		if a.ctx != nil {
			runtime.WindowSetAlwaysOnTop(a.ctx, s.AlwaysOnTop)
			runtime.EventsEmit(a.ctx, "settings:updated", s)
		}

		if proxyChanged {
			proxy.Configure(s)
			go func() {
				_ = a.twitchClient.ReconnectWithAuth()
				a.eventsubClient.Reconnect()
			}()
		}

		if daChanged && a.daClient != nil {
			a.daClient.Stop()
			if s.DAEnabled && strings.TrimSpace(s.DAToken) != "" {
				a.daClient.SetToken(s.DAToken)
				a.daClient.Start()
			}
		}
	}
	return err
}

// TestProxyConnection tests reaching Twitch API via specified proxy settings
func (a *App) TestProxyConnection(proxyType, address string, auth bool, user, pass string) map[string]interface{} {
	success, latency, msg := proxy.TestConnection(proxyType, address, auth, user, pass)
	return map[string]interface{}{
		"success": success,
		"latency": latency,
		"message": msg,
	}
}

// OpenAndImportWireGuardConf opens a file dialog, parses the selected .conf file,
// saves the WireGuard config to settings, and immediately starts the embedded tunnel.
func (a *App) OpenAndImportWireGuardConf() map[string]interface{} {
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Выберите файл WireGuard (.conf)",
		Filters: []runtime.FileFilter{
			{DisplayName: "WireGuard Config (*.conf)", Pattern: "*.conf"},
			{DisplayName: "All Files (*.*)", Pattern: "*.*"},
		},
	})
	if err != nil || path == "" {
		return map[string]interface{}{"success": false, "error": "файл не выбран"}
	}

	info, err := proxy.ParseWireGuardConf(path)
	if err != nil {
		return map[string]interface{}{"success": false, "error": err.Error()}
	}

	// Persist WireGuard fields in settings so tunnel can be restored after restart
	s := config.LoadSettings()
	s.WireGuardPrivateKey = info.PrivateKey
	s.WireGuardPublicKey = info.PublicKey
	s.WireGuardAddress = info.Address
	s.WireGuardDNS = info.DNS
	s.WireGuardEndpoint = info.Endpoint
	s.WireGuardAllowedIPs = info.AllowedIPs
	s.ProxyType = "wireguard"
	s.ProxyEnabled = true
	_ = config.SaveSettings(s)

	// Start the embedded tunnel immediately
	proxy.ConfigureWithWireGuard(s, info)

	return map[string]interface{}{
		"success":    true,
		"address":    info.Address,
		"dns":        info.DNS,
		"endpoint":   info.Endpoint,
		"allowedIPs": info.AllowedIPs,
		"tunnelActive": true,
	}
}

// WireGuardTunnelStatus returns whether the embedded WireGuard tunnel is currently active.
func (a *App) WireGuardTunnelStatus() map[string]interface{} {
	s := config.LoadSettings()
	return map[string]interface{}{
		"active":   proxy.WireGuardTunnelActive(),
		"endpoint": s.WireGuardEndpoint,
		"address":  s.WireGuardAddress,
	}
}

// ImportWireGuardConf parses a WireGuard .conf file and returns its fields
// plus a suggested SOCKS5 address and a ready wireproxy config.
func (a *App) ImportWireGuardConf(path string) map[string]interface{} {
	info, err := proxy.ParseWireGuardConf(path)
	if err != nil {
		return map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		}
	}
	return map[string]interface{}{
		"success":         true,
		"privateKey":      info.PrivateKey,
		"address":         info.Address,
		"dns":             info.DNS,
		"publicKey":       info.PublicKey,
		"endpoint":        info.Endpoint,
		"allowedIPs":      info.AllowedIPs,
		"suggestedSocks5": info.SuggestedSOCKS5,
		"wireproxyConf":   proxy.GenerateWireproxyConf(info, ""),
	}
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
	vals.Set("scope", "chat:read chat:edit user:read:email channel:read:redemptions moderator:read:followers")

	authURL := fmt.Sprintf("%s?%s", config.TwitchOAuthAuthURL, vals.Encode())

	if a.ctx != nil {
		runtime.BrowserOpenURL(a.ctx, authURL)
	} else if runtime_os.GOOS == "windows" {
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

// GetTwitchAuthStatus validates the current OAuth token and returns scope and follower status
func (a *App) GetTwitchAuthStatus() map[string]interface{} {
	settings := config.LoadSettings()
	if settings.OAuthToken == "" {
		return map[string]interface{}{
			"authenticated":    false,
			"hasFollowerScope": false,
		}
	}

	val, err := twitch.ValidateTwitchToken(settings.OAuthToken)
	if err != nil {
		return map[string]interface{}{
			"authenticated":    true,
			"username":         settings.Username,
			"userId":           settings.UserID,
			"hasFollowerScope": false,
			"error":            err.Error(),
		}
	}

	hasFollowerScope := val.HasScope("moderator:read:followers")

	// Persist auto-resolved UserID if it was missing in SQLite
	if settings.UserID == "" && val.UserID != "" {
		settings.UserID = val.UserID
		_ = config.SaveSettings(settings)
		if a.eventsubClient != nil {
			a.eventsubClient.SetUserID(val.UserID)
		}
	}

	return map[string]interface{}{
		"authenticated":    true,
		"username":         val.Login,
		"userId":           val.UserID,
		"hasFollowerScope": hasFollowerScope,
		"scopes":           val.Scopes,
	}
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

// GetSupertonicStatus returns local Supertonic model installation & download status
func (a *App) GetSupertonicStatus() tts.SupertonicStatus {
	if a.supertonicMgr == nil {
		return tts.SupertonicStatus{}
	}
	return a.supertonicMgr.GetStatus()
}

// DownloadSupertonicModel initiates downloading the Supertonic model from Hugging Face
func (a *App) DownloadSupertonicModel() error {
	if a.supertonicMgr == nil {
		return fmt.Errorf("Supertonic manager not initialized")
	}
	return a.supertonicMgr.StartDownload()
}

// CancelSupertonicDownload cancels an in-progress model download
func (a *App) CancelSupertonicDownload() {
	if a.supertonicMgr != nil {
		a.supertonicMgr.CancelDownload()
	}
}

// DeleteSupertonicModel deletes local model assets from disk
func (a *App) DeleteSupertonicModel() error {
	if a.supertonicMgr == nil {
		return fmt.Errorf("Supertonic manager not initialized")
	}
	return a.supertonicMgr.DeleteModel()
}

// GetSupertonicVoices returns available Supertonic voice styles
func (a *App) GetSupertonicVoices() map[string]string {
	if a.supertonicMgr == nil {
		return map[string]string{}
	}
	return a.supertonicMgr.GetVoices()
}

// SpeakSupertonic synthesizes speech using local Supertonic TTS
func (a *App) SpeakSupertonic(text string, voice string) (string, error) {
	if a.supertonicMgr == nil {
		return "", fmt.Errorf("Supertonic manager not initialized")
	}
	return a.supertonicMgr.GenerateSpeech(text, voice)
}

// UpdateTTSStatus updates speech generation / playback status and broadcasts to OBS and UI
func (a *App) UpdateTTSStatus(state, author, text, voice, engine string, duration float64) {
	st := widget.TTSStatusMessage{
		State:     state,
		Author:    author,
		Text:      text,
		Voice:     voice,
		Engine:    engine,
		Duration:  duration,
		Timestamp: time.Now().Format("15:04"),
	}
	if a.widgetServer != nil {
		a.widgetServer.BroadcastTTSStatus(st)
	}
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "tts:status", st)
	}
}

// GetTTSStatus returns current speech generation / playback status
func (a *App) GetTTSStatus() widget.TTSStatusMessage {
	if a.widgetServer == nil {
		return widget.TTSStatusMessage{State: "idle"}
	}
	return a.widgetServer.GetTTSStatus()
}

// GetTTSWidgetURL returns URL for OBS TTS Status browser source
func (a *App) GetTTSWidgetURL() string {
	return fmt.Sprintf("http://localhost:%d/widget/tts", a.widgetServer.Port())
}

// GetTTSWidgetThemes returns themes for the TTS Status widget
func (a *App) GetTTSWidgetThemes() []string {
	if a.widgetServer == nil {
		return []string{"default"}
	}
	return a.widgetServer.GetTTSThemes()
}

// OpenTTSThemesDir opens TTS widget themes directory in file explorer
func (a *App) OpenTTSThemesDir() {
	dir := filepath.Join(a.widgetServer.ThemesDirectory(), "tts")
	_ = os.MkdirAll(dir, 0755)
	switch runtime_os.GOOS {
	case "windows":
		_ = exec.Command("explorer", dir).Start()
	case "darwin":
		_ = exec.Command("open", dir).Start()
	default:
		_ = exec.Command("xdg-open", dir).Start()
	}
}

// SendTestTTSStatus triggers a sample test cycle for the TTS Status widget
func (a *App) SendTestTTSStatus() {
	go func() {
		a.UpdateTTSStatus("generating", "Alex_Streamer", "Привет! Это проверка работы локальной нейросети Supertonic AI.", "M1", "supertonic", 0)
		time.Sleep(1500 * time.Millisecond)
		a.UpdateTTSStatus("playing", "Alex_Streamer", "Привет! Это проверка работы локальной нейросети Supertonic AI.", "M1", "supertonic", 3.5)
		time.Sleep(3500 * time.Millisecond)
		a.UpdateTTSStatus("idle", "", "", "", "", 0)
	}()
}

// GetWidgetURL returns the URL of the OBS chat widget (for copy-pasting into Browser Source)
func (a *App) GetWidgetURL() string {
	return fmt.Sprintf("http://localhost:%d/widget/chat", a.widgetServer.Port())
}

// GetFollowerWidgetURL returns the URL of the OBS Follower Notification widget
func (a *App) GetFollowerWidgetURL() string {
	return fmt.Sprintf("http://localhost:%d/widget/follower", a.widgetServer.Port())
}

// GetFollowerWidgetThemes returns list of available follower themes
func (a *App) GetFollowerWidgetThemes() []string {
	return a.widgetServer.GetFollowerThemes()
}

// OpenFollowerThemesDir opens the follower themes directory in Explorer
func (a *App) OpenFollowerThemesDir() {
	dir := filepath.Join(a.widgetServer.ThemesDirectory(), "follower")
	_ = os.MkdirAll(dir, 0755)
	switch runtime_os.GOOS {
	case "windows":
		_ = exec.Command("explorer", dir).Start()
	case "darwin":
		_ = exec.Command("open", dir).Start()
	default:
		_ = exec.Command("xdg-open", dir).Start()
	}
}

// GetMusicWidgetURL returns the URL of the OBS Now Playing widget
func (a *App) GetMusicWidgetURL() string {
	return fmt.Sprintf("http://localhost:%d/widget/music", a.widgetServer.Port())
}

// GetCurrentTrack returns currently playing track info from Windows SMTC
func (a *App) GetCurrentTrack() map[string]interface{} {
	if a.mediaManager == nil {
		return map[string]interface{}{"status": "stopped"}
	}
	t := a.mediaManager.CurrentTrack()
	return map[string]interface{}{
		"status":    t.Status,
		"title":     t.Title,
		"artist":    t.Artist,
		"album":     t.Album,
		"thumbnail": t.Thumbnail,
		"source":    t.Source,
	}
}

// SendTestMusicTrack triggers a test track on the music widget for OBS setup
func (a *App) SendTestMusicTrack() map[string]interface{} {
	testTrack := media.TrackInfo{
		Status:    "playing",
		Title:     "Never Gonna Give You Up",
		Artist:    "Rick Astley",
		Album:     "Whenever You Need Somebody",
		Thumbnail: "",
		Source:    "Spotify.exe",
		Timestamp: time.Now().UnixMilli(),
	}
	if a.mediaManager != nil {
		a.mediaManager.SetTrack(testTrack)
	}
	return map[string]interface{}{"success": true, "track": testTrack}
}

// SendTestChatMessage sends a simulated Twitch chat message to the OBS chat widget
func (a *App) SendTestChatMessage() map[string]interface{} {
	if a.widgetServer != nil {
		a.widgetServer.Broadcast(widget.WidgetMessage{
			Type:      "message",
			Author:    "StreamHero",
			AvatarURL: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
			Text:      "Тестовое сообщение для проверки оверлея чата в OBS Studio! ✨",
			Color:     "#9146FF",
			Badges:    []string{"broadcaster/1", "subscriber/12"},
			Timestamp: time.Now().Format("15:04"),
		})
	}
	return map[string]interface{}{"success": true}
}

// SendTestFollowMessage sends a simulated Twitch new follower event to the chat and OBS widget
func (a *App) SendTestFollowMessage() map[string]interface{} {
	settings := config.LoadSettings()
	targetChannel := settings.Username
	if targetChannel == "" && len(settings.JoinedChannels) > 0 {
		targetChannel = settings.JoinedChannels[0]
	}
	if targetChannel == "" {
		targetChannel = "streamer"
	}

	testMsg := &twitch.ChatMessage{
		ID:          fmt.Sprintf("test-follow-%d", time.Now().UnixNano()),
		Channel:     targetChannel,
		User:        "cool_viewer",
		DisplayName: "Cool_Viewer",
		Color:       "#10B981",
		Timestamp:   time.Now().Format("15:04:05"),
		IsEvent:     true,
		EventType:   "follow",
		SystemMsg:   "Cool_Viewer отслеживает канал!",
		EventData: map[string]string{
			"userId":    "999999",
			"userLogin": "cool_viewer",
			"userName":  "Cool_Viewer",
		},
	}

	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "chat:message", testMsg)
	}
	if a.widgetServer != nil {
		a.widgetServer.Broadcast(widget.WidgetMessage{
			Type:      "follow",
			Author:    testMsg.DisplayName,
			AvatarURL: widget.GetAvatarURL(testMsg.User),
			Text:      testMsg.SystemMsg,
			Color:     "#10B981",
			Channel:   targetChannel,
			Timestamp: time.Now().Format("15:04"),
		})
	}
	return map[string]interface{}{"success": true}
}

// SetDAToken updates the personal DonationAlerts token and starts/stops connection
func (a *App) SetDAToken(token string) error {
	s := config.LoadSettings()
	s.DAToken = strings.TrimSpace(token)
	s.DAEnabled = s.DAToken != ""
	return a.SaveSettings(s)
}

// TestDAConnection validates a DonationAlerts Bearer token with their API
func (a *App) TestDAConnection(token string) map[string]interface{} {
	ok, userName, err := a.daClient.TestConnection(token)
	if err != nil {
		return map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		}
	}
	return map[string]interface{}{
		"success":  ok,
		"username": userName,
	}
}

// SendTestDonation sends a simulated donation event to chat and OBS widget
func (a *App) SendTestDonation(amount float64, currency, user, message string) map[string]interface{} {
	if amount <= 0 {
		amount = 150
	}
	if currency == "" {
		currency = "RUB"
	}
	if user == "" {
		user = "Случайный Донатер"
	}
	if message == "" {
		message = "Спасибо за потрясающий стрим! Держи на кофе ☕"
	}

	formattedAmount := fmt.Sprintf("%.0f %s", amount, currency)
	if amount != float64(int64(amount)) {
		formattedAmount = fmt.Sprintf("%.2f %s", amount, currency)
	}

	userColor := "#F59E0B"
	if amount >= 500 {
		userColor = "#EC4899"
	}

	// 1. Broadcast to OBS widget
	if a.widgetServer != nil {
		a.widgetServer.BroadcastDonation(user, amount, currency, message)
	}

	// 2. Emit chat message to frontend
	testMsg := &twitch.ChatMessage{
		ID:          fmt.Sprintf("test-da-%d", time.Now().UnixNano()),
		Channel:     "donations",
		User:        strings.ToLower(user),
		DisplayName: user,
		Color:       userColor,
		Message:     message,
		Timestamp:   time.Now().Format("15:04:05"),
		IsEvent:     true,
		EventType:   "donation",
		SystemMsg:   fmt.Sprintf("%s задонатил %s!", user, formattedAmount),
		EventData: map[string]string{
			"amount":          fmt.Sprintf("%f", amount),
			"currency":        currency,
			"formattedAmount": formattedAmount,
			"userName":        user,
			"message":         message,
		},
	}

	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "chat:message", testMsg)
	}

	return map[string]interface{}{"success": true}
}

// SendTestGoal updates goal progress and broadcasts update
func (a *App) SendTestGoal(title string, current, target float64, currency string) map[string]interface{} {
	if title == "" {
		title = "Сбор на новый микрофон"
	}
	if target <= 0 {
		target = 10000
	}
	if current < 0 {
		current = 6500
	}
	if currency == "" {
		currency = "RUB"
	}

	if a.widgetServer != nil {
		a.widgetServer.BroadcastGoal(title, current, target, currency)
	}

	pct := 0.0
	if target > 0 {
		pct = (current / target) * 100
		if pct > 100 {
			pct = 100
		}
	}

	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "goal:update", map[string]interface{}{
			"title":         title,
			"currentAmount": current,
			"targetAmount":  target,
			"currency":      currency,
			"percent":       pct,
		})
	}

	return map[string]interface{}{"success": true}
}

// GetDonationWidgetURL returns the URL of the OBS Donation Alert widget
func (a *App) GetDonationWidgetURL() string {
	return fmt.Sprintf("http://localhost:%d/widget/donation", a.widgetServer.Port())
}

// GetGoalWidgetURL returns the URL of the OBS Goal Progress widget
func (a *App) GetGoalWidgetURL() string {
	return fmt.Sprintf("http://localhost:%d/widget/goal", a.widgetServer.Port())
}

// GetCurrentGoal returns the cached goal info for chat or widget
func (a *App) GetCurrentGoal() map[string]interface{} {
	if a.widgetServer != nil {
		return a.widgetServer.GetCurrentGoal()
	}
	return map[string]interface{}{}
}

// OpenDonationThemesDir opens the donation alert themes folder in Explorer
func (a *App) OpenDonationThemesDir() {
	dir := filepath.Join(a.widgetServer.ThemesDirectory(), "donations")
	_ = os.MkdirAll(dir, 0755)
	switch runtime_os.GOOS {
	case "windows":
		_ = exec.Command("explorer", dir).Start()
	case "darwin":
		_ = exec.Command("open", dir).Start()
	default:
		_ = exec.Command("xdg-open", dir).Start()
	}
}

// OpenGoalThemesDir opens the goal progress widget themes folder in Explorer
func (a *App) OpenGoalThemesDir() {
	dir := filepath.Join(a.widgetServer.ThemesDirectory(), "goals")
	_ = os.MkdirAll(dir, 0755)
	switch runtime_os.GOOS {
	case "windows":
		_ = exec.Command("explorer", dir).Start()
	case "darwin":
		_ = exec.Command("open", dir).Start()
	default:
		_ = exec.Command("xdg-open", dir).Start()
	}
}


// OpenMusicThemesDir opens the music themes directory in Explorer
func (a *App) OpenMusicThemesDir() {
	dir := filepath.Join(a.widgetServer.ThemesDirectory(), "music")
	_ = os.MkdirAll(dir, 0755)
	switch runtime_os.GOOS {
	case "windows":
		_ = exec.Command("explorer", dir).Start()
	case "darwin":
		_ = exec.Command("open", dir).Start()
	default:
		_ = exec.Command("xdg-open", dir).Start()
	}
}

// GetWidgetThemes returns list of available chat theme names (excluding music directory)
func (a *App) GetWidgetThemes() []string {
	themes := []string{}
	chatDir := filepath.Join(a.widgetServer.ThemesDirectory(), "chat")
	if entries, err := os.ReadDir(chatDir); err == nil {
		for _, e := range entries {
			if e.IsDir() {
				themes = append(themes, e.Name())
			}
		}
	}
	if len(themes) == 0 {
		if entries, err := os.ReadDir(a.widgetServer.ThemesDirectory()); err == nil {
			for _, e := range entries {
				if e.IsDir() && e.Name() != "music" && e.Name() != "chat" {
					themes = append(themes, e.Name())
				}
			}
		}
	}
	if len(themes) == 0 {
		themes = append(themes, "default")
	}
	return themes
}

// GetMusicWidgetThemes returns list of available music theme names
func (a *App) GetMusicWidgetThemes() []string {
	musicDir := filepath.Join(a.widgetServer.ThemesDirectory(), "music")
	entries, err := os.ReadDir(musicDir)
	if err != nil {
		return []string{"default"}
	}
	themes := []string{}
	for _, e := range entries {
		if e.IsDir() {
			themes = append(themes, e.Name())
		}
	}
	if len(themes) == 0 {
		themes = append(themes, "default")
	}
	return themes
}

// OpenThemesDir opens the chat themes folder in Explorer/Finder
func (a *App) OpenThemesDir() {
	dir := filepath.Join(a.widgetServer.ThemesDirectory(), "chat")
	_ = os.MkdirAll(dir, 0755)
	switch runtime_os.GOOS {
	case "windows":
		_ = exec.Command("explorer", dir).Start()
	case "darwin":
		_ = exec.Command("open", dir).Start()
	default:
		_ = exec.Command("xdg-open", dir).Start()
	}
}

// ToggleGameMode toggles Game/Overlay mode (transparent window, click-through, always-on-top).
func (a *App) ToggleGameMode() bool {
	a.gameModeMu.Lock()
	if time.Since(a.lastToggleTime) < 400*time.Millisecond {
		cur := a.isGameMode
		a.gameModeMu.Unlock()
		return cur
	}
	a.lastToggleTime = time.Now()
	newVal := !a.isGameMode
	a.isGameMode = newVal
	a.gameModeMu.Unlock()

	a.applyGameMode(newVal)
	return newVal
}

// SetGameMode sets Game/Overlay mode explicitly.
func (a *App) SetGameMode(enable bool) bool {
	a.gameModeMu.Lock()
	a.lastToggleTime = time.Now()
	a.isGameMode = enable
	a.gameModeMu.Unlock()

	a.applyGameMode(enable)
	return enable
}

// IsGameMode returns true if Game/Overlay mode is active.
func (a *App) IsGameMode() bool {
	a.gameModeMu.Lock()
	defer a.gameModeMu.Unlock()
	return a.isGameMode
}

func (a *App) applyGameMode(enable bool) {
	if a.ctx != nil {
		if enable {
			runtime.WindowSetAlwaysOnTop(a.ctx, true)
		} else {
			settings := config.LoadSettings()
			runtime.WindowSetAlwaysOnTop(a.ctx, settings.AlwaysOnTop)
		}
		runtime.EventsEmit(a.ctx, "gamemode:changed", enable)
	}

	hwnd := overlay.FindMainWindow()
	overlay.SetClickThrough(hwnd, enable)
}

// handleMusicOrder parses and processes orders from Twitch chat, Kick, or Channel Points rewards
func (a *App) handleMusicOrder(msg *twitch.ChatMessage) {
	if msg == nil || a.musicService == nil {
		return
	}

	rules := a.musicService.GetRules()
	if !rules.OrdersEnabled {
		return
	}

	var query string
	var platform string = "twitch"
	var cost string = "Баллы"

	// 1. Check if command: !заказ <query>, !sr <query>, !songrequest <query>
	if q, isCmd := music.ParseCommand(msg.Message); isCmd {
		if !rules.ChatCommandEnabled {
			return
		}
		if strings.TrimSpace(q) == "" {
			return
		}
		query = q
		cost = "Чат"
		if strings.HasPrefix(strings.ToLower(msg.Channel), "kick:") || msg.Badges == "kick" {
			platform = "kick"
			cost = "Kick"
		}
	} else if msg.EventType == "reward" {
		if !rules.TwitchRewardEnabled {
			return
		}
		// 2. Check if Twitch reward redemption
		rewardTitle := strings.ToLower(msg.EventData["rewardTitle"])
		targetTitle := strings.ToLower(rules.RewardTitle)
		isMusicReward := (targetTitle != "" && strings.Contains(rewardTitle, targetTitle)) ||
			strings.Contains(rewardTitle, "музык") ||
			strings.Contains(rewardTitle, "песн") ||
			strings.Contains(rewardTitle, "трек") ||
			strings.Contains(rewardTitle, "song")

		if isMusicReward && strings.TrimSpace(msg.Message) != "" {
			query = strings.TrimSpace(msg.Message)
			costVal := msg.EventData["rewardCost"]
			if costVal == "" {
				costVal = fmt.Sprintf("%d", rules.TwitchPoints)
			}
			cost = fmt.Sprintf("%s баллов", costVal)
		}
	}

	if query == "" {
		return
	}

	go func() {
		track, err := a.musicService.AddTrack(query, msg.DisplayName, platform, cost)
		if err != nil {
			reply := fmt.Sprintf("@%s, заказ не принят: %s", msg.DisplayName, err.Error())
			_ = a.SendMessage(msg.Channel, reply)
			return
		}

		if track.Status == music.StatusPending {
			reason := track.RejectReason
			if reason == "" {
				reason = "требуется подтверждение модератора"
			}
			reply := fmt.Sprintf("@%s, трек «%s» отправлен на модерацию (%s)", msg.DisplayName, track.Title, reason)
			_ = a.SendMessage(msg.Channel, reply)
			return
		}

		if track.Status == music.StatusPlaying {
			reply := fmt.Sprintf("@%s, трек «%s» играет прямо сейчас!", msg.DisplayName, track.Title)
			_ = a.SendMessage(msg.Channel, reply)
			return
		}

		reply := fmt.Sprintf("@%s, трек «%s» добавлен в очередь! Позиция #%d", msg.DisplayName, track.Title, track.Position)
		_ = a.SendMessage(msg.Channel, reply)
	}()
}

// MusicGetState returns current playback state, queue, moderation, and history
func (a *App) MusicGetState() music.MusicState {
	if a.musicService == nil {
		return music.MusicState{}
	}
	return a.musicService.GetState()
}

// MusicGetRules returns music order rules
func (a *App) MusicGetRules() music.MusicRules {
	if a.musicService == nil {
		return music.DefaultMusicRules()
	}
	return a.musicService.GetRules()
}

// MusicUpdateRules updates music order rules
func (a *App) MusicUpdateRules(rules music.MusicRules) error {
	if a.musicService == nil {
		return fmt.Errorf("музыкальный сервис не инициализирован")
	}
	return a.musicService.UpdateRules(rules)
}

// MusicAddTrack adds a track to queue manually
func (a *App) MusicAddTrack(rawInput, platform, cost string) (*music.Track, error) {
	if a.musicService == nil {
		return nil, fmt.Errorf("музыкальный сервис не инициализирован")
	}
	user := "Стример"
	settings := config.LoadSettings()
	if settings.Username != "" {
		user = settings.Username
	}
	if platform == "" {
		platform = "manual"
	}
	if cost == "" {
		cost = "Вручную"
	}
	return a.musicService.AddTrack(rawInput, user, platform, cost)
}

// MusicRemoveTrack removes a track by ID from queue or moderation
func (a *App) MusicRemoveTrack(trackID string) error {
	if a.musicService == nil {
		return fmt.Errorf("музыкальный сервис не инициализирован")
	}
	return a.musicService.Remove(trackID)
}

// MusicMoveUp moves a track one position up
func (a *App) MusicMoveUp(trackID string) error {
	if a.musicService == nil {
		return fmt.Errorf("музыкальный сервис не инициализирован")
	}
	return a.musicService.MoveUp(trackID)
}

// MusicReorder reorders a track in queue
func (a *App) MusicReorder(fromIndex, toIndex int) error {
	if a.musicService == nil {
		return fmt.Errorf("музыкальный сервис не инициализирован")
	}
	return a.musicService.Reorder(fromIndex, toIndex)
}

// MusicSkip skips the current playing track
func (a *App) MusicSkip() error {
	if a.musicService == nil {
		return fmt.Errorf("музыкальный сервис не инициализирован")
	}
	return a.musicService.Skip()
}

// MusicNext transitions to the next track in queue
func (a *App) MusicNext() (*music.Track, error) {
	if a.musicService == nil {
		return nil, fmt.Errorf("музыкальный сервис не инициализирован")
	}
	return a.musicService.Next()
}

// MusicApprove approves a track from moderation
func (a *App) MusicApprove(trackID string) error {
	if a.musicService == nil {
		return fmt.Errorf("музыкальный сервис не инициализирован")
	}
	return a.musicService.Approve(trackID)
}

// MusicReject rejects a track from moderation
func (a *App) MusicReject(trackID string, reason string) error {
	if a.musicService == nil {
		return fmt.Errorf("музыкальный сервис не инициализирован")
	}
	return a.musicService.Reject(trackID, reason)
}

// MusicUpdatePlayback synchronizes current playback time, pause state, and volume
func (a *App) MusicUpdatePlayback(currentTime float64, isPlaying bool, volume int) error {
	if a.musicService == nil {
		return fmt.Errorf("музыкальный сервис не инициализирован")
	}
	err := a.musicService.UpdatePlayback(currentTime, isPlaying, volume)
	if err == nil && a.widgetServer != nil {
		st := a.musicService.GetState()
		if st.CurrentTrack != nil {
			status := "paused"
			if isPlaying {
				status = "playing"
			}
			a.widgetServer.BroadcastMusicTrack(media.TrackInfo{
				Status:    status,
				Title:     st.CurrentTrack.Title,
				Artist:    st.CurrentTrack.Author,
				Thumbnail: st.CurrentTrack.Thumbnail,
				Source:    "YouTube",
				Timestamp: time.Now().UnixMilli(),
			})
		}
	}
	return err
}

// MusicClearQueue clears all tracks from active queue
func (a *App) MusicClearQueue() error {
	if a.musicService == nil {
		return fmt.Errorf("музыкальный сервис не инициализирован")
	}
	return a.musicService.ClearQueue()
}

// MusicClearHistory clears track history
func (a *App) MusicClearHistory() error {
	if a.musicService == nil {
		return fmt.Errorf("музыкальный сервис не инициализирован")
	}
	return a.musicService.ClearHistory()
}

// MusicPrev plays the previous track from history
func (a *App) MusicPrev() (*music.Track, error) {
	if a.musicService == nil {
		return nil, fmt.Errorf("музыкальный сервис не инициализирован")
	}
	return a.musicService.Prev()
}

// MusicPlayFromHistory plays a track from history immediately
func (a *App) MusicPlayFromHistory(trackID string) (*music.Track, error) {
	if a.musicService == nil {
		return nil, fmt.Errorf("музыкальный сервис не инициализирован")
	}
	return a.musicService.PlayFromHistory(trackID)
}

// MusicRequeueFromHistory adds a track from history back to the queue
func (a *App) MusicRequeueFromHistory(trackID string) (*music.Track, error) {
	if a.musicService == nil {
		return nil, fmt.Errorf("музыкальный сервис не инициализирован")
	}
	return a.musicService.RequeueFromHistory(trackID)
}

// MusicPauseSystemMedia pauses background system media players (Spotify/Yandex Music)
func (a *App) MusicPauseSystemMedia() error {
	if a.mediaManager != nil {
		a.mediaManager.PauseSystemMedia(true)
	}
	return nil
}


