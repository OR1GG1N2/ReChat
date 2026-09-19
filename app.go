package main

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	runtime_os "runtime"
	"strconv"
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
	mediaManager   *media.Manager
	isGameMode     bool
	lastToggleTime time.Time
	gameModeMu     sync.Mutex
}

// NewApp creates a new App application struct
func NewApp() *App {
	app := &App{
		twitchClient: twitch.NewClient(),
		badgeFetcher: twitch.NewBadgeFetcher(),
		emoteFetcher: twitch.NewEmoteFetcher(),
		ttsClient:    tts.NewYandexTTS(),
		widgetServer: widget.NewWidgetServer(3500),
		mediaManager: media.NewManager(),
	}

	app.widgetServer.SetBadgeFetcher(app.badgeFetcher.GetBadgeMap)
	app.widgetServer.SetEmoteFetcher(app.emoteFetcher.GetEmoteMap)

	var (
		rewardDedupMu sync.Mutex
		rewardDedup   = make(map[string]time.Time)
	)

	// Shared helper: convert any ChatMessage to a WidgetMessage and broadcast
	broadcastToWidget := func(msg *twitch.ChatMessage) {
		if msg == nil {
			return
		}

		if msg.IsEvent && msg.EventType == "reward" {
			// If EventSub is active and this reward came from IRC, suppress duplicate
			fromEventSub := msg.EventData["rewardType"] == "eventsub"
			if !fromEventSub && app.eventsubClient != nil && app.eventsubClient.IsRunning() {
				return
			}

			rewardDedupMu.Lock()
			now := time.Now()
			for k, t := range rewardDedup {
				if now.Sub(t) > 30*time.Second {
					delete(rewardDedup, k)
				}
			}

			u := strings.ToLower(strings.TrimSpace(msg.User))
			if u == "" {
				u = strings.ToLower(strings.TrimSpace(msg.DisplayName))
			}
			txt := strings.TrimSpace(msg.Message)
			rewardID := msg.EventData["rewardId"]

			keyUserText := fmt.Sprintf("%s|%s", u, txt)
			keyUserReward := fmt.Sprintf("%s|%s", u, rewardID)

			if txt != "" {
				if _, exists := rewardDedup[keyUserText]; exists {
					rewardDedupMu.Unlock()
					return
				}
				rewardDedup[keyUserText] = now
			}
			if rewardID != "" {
				if _, exists := rewardDedup[keyUserReward]; exists {
					rewardDedupMu.Unlock()
					return
				}
				rewardDedup[keyUserReward] = now
			}
			rewardDedupMu.Unlock()
		}

		var badgesList []string
		if msg.Badges != "" {
			for _, b := range strings.Split(msg.Badges, ",") {
				if tb := strings.TrimSpace(b); tb != "" {
					badgesList = append(badgesList, tb)
				}
			}
		}

		wm := widget.WidgetMessage{
			Type:       "message",
			Author:     msg.DisplayName,
			AvatarURL:  widget.GetAvatarURL(msg.User),
			Color:      msg.Color,
			Badges:     badgesList,
			Text:       msg.Message,
			EmoteMap:   msg.EmoteMap,
			Channel:    msg.Channel,
			Timestamp:  msg.Timestamp,
			IsFirstMsg: msg.IsFirstMsg || (msg.EventData != nil && msg.EventData["firstMsg"] == "1") || msg.EventType == "intro",
		}
		if msg.IsEvent && msg.EventType == "reward" {
			wm.Type = "reward"
			wm.RewardTitle = msg.EventData["rewardTitle"]
			wm.UserInput = msg.Message
			if cost, err := strconv.Atoi(msg.EventData["rewardCost"]); err == nil {
				wm.Cost = cost
			}
		} else if msg.IsEvent && (msg.EventType == "follow" || msg.EventType == "channel.follow") {
			wm.Type = "follow"
			wm.Text = msg.SystemMsg
		}
		app.widgetServer.Broadcast(wm)
	}

	// Wire IRC client → widget (all PRIVMSG, events, etc.)
	app.twitchClient.SetMessageHandler(broadcastToWidget)

	// Suppress IRC custom-reward-id duplicates when EventSub is running
	app.twitchClient.SetRewardFilter(func(msg *twitch.ChatMessage) bool {
		return app.eventsubClient != nil && app.eventsubClient.IsRunning()
	})

	// Broadcast background avatar updates immediately to OBS widget
	widget.SetOnAvatarUpdated(func(login, avatarURL string) {
		app.widgetServer.BroadcastAvatarUpdate(login, avatarURL)
	})

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

	// Configure network proxy from saved settings
	settings := config.LoadSettings()
	proxy.Configure(settings)
	a.twitchClient.SetContext(ctx)

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
	if a.ttsClient != nil {
		a.ttsClient.Close()
	}
	if a.mediaManager != nil {
		a.mediaManager.Stop()
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
	oldSettings := config.LoadSettings()
	proxyChanged := (oldSettings.ProxyEnabled != s.ProxyEnabled ||
		oldSettings.ProxyType != s.ProxyType ||
		oldSettings.ProxyAddress != s.ProxyAddress ||
		oldSettings.ProxyAuth != s.ProxyAuth ||
		oldSettings.ProxyUser != s.ProxyUser ||
		oldSettings.ProxyPassword != s.ProxyPassword)

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

