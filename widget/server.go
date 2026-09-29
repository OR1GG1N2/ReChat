package widget

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"ReChat/media"
)

// WidgetMessage is the payload sent over SSE to the OBS browser source.
type WidgetMessage struct {
	Type        string            `json:"type"` // "message" | "reward" | "clear"
	Platform    string            `json:"platform,omitempty"` // "twitch" | "kick"
	Author      string            `json:"author,omitempty"`
	AvatarURL   string            `json:"avatarUrl,omitempty"`
	Color       string            `json:"color,omitempty"`
	Badges      []string          `json:"badges,omitempty"`
	BadgeURLs   []string          `json:"badgeUrls,omitempty"`
	Text        string            `json:"text,omitempty"`
	Emotes      []string          `json:"emotes,omitempty"`
	EmoteMap    map[string]string `json:"emoteMap,omitempty"`
	RewardTitle string            `json:"rewardTitle,omitempty"`
	Cost        int               `json:"cost,omitempty"`
	UserInput   string            `json:"userInput,omitempty"`
	Channel     string            `json:"channel,omitempty"`
	Timestamp   string            `json:"timestamp"`
	IsFirstMsg  bool              `json:"isFirstMsg,omitempty"`
	Amount      float64           `json:"amount,omitempty"`
	Currency    string            `json:"currency,omitempty"`
	IsEvent     bool              `json:"isEvent,omitempty"`
	EventType   string            `json:"eventType,omitempty"`
	Goal        interface{}       `json:"goal,omitempty"`
}

// sseClient represents a connected OBS browser.
type sseClient struct {
	send  chan []byte
	theme string
}

// WidgetServer serves the OBS chat & music widgets via HTTP.
type WidgetServer struct {
	port      int
	themesDir string
	server    *http.Server

	clientsMu sync.RWMutex
	clients   map[*sseClient]struct{}

	musicClientsMu sync.RWMutex
	musicClients   map[*sseClient]struct{}

	mediaManager       *media.Manager
	currentMusicConfig map[string]interface{}

	badgeFetcher func() map[string]string
	emoteFetcher func() map[string]string

	recentMessagesMu sync.RWMutex
	recentMessages   []WidgetMessage

	currentGoalMu sync.RWMutex
	currentGoal   map[string]interface{}

	stopChan chan struct{}
}

// NewWidgetServer creates a widget server. Port defaults to 3500.
func NewWidgetServer(port int) *WidgetServer {
	if port == 0 {
		port = 3500
	}
	return &WidgetServer{
		port:           port,
		themesDir:      ThemesDir(),
		clients:        make(map[*sseClient]struct{}),
		musicClients:   make(map[*sseClient]struct{}),
		recentMessages: make([]WidgetMessage, 0, 20),
		stopChan:       make(chan struct{}),
	}
}

// SetMediaManager sets the media manager reference for now playing updates.
func (ws *WidgetServer) SetMediaManager(m *media.Manager) {
	ws.mediaManager = m
	if m != nil {
		m.OnTrackChange(func(track media.TrackInfo) {
			ws.BroadcastMusicTrack(track)
		})
	}
}

// SetBadgeFetcher sets the callback to get current badges map
func (ws *WidgetServer) SetBadgeFetcher(fn func() map[string]string) {
	ws.badgeFetcher = fn
}

// SetEmoteFetcher sets the callback to get current emotes map
func (ws *WidgetServer) SetEmoteFetcher(fn func() map[string]string) {
	ws.emoteFetcher = fn
}

// Start starts the HTTP server and the themes watcher in the background.
func (ws *WidgetServer) Start() {
	if err := EnsureDefaultTheme(ws.themesDir); err != nil {
		log.Printf("[Widget] Failed to create default chat theme: %v", err)
	}

	if err := EnsureDefaultMusicTheme(ws.themesDir); err != nil {
		log.Printf("[Widget] Failed to create default music theme: %v", err)
	}

	if err := EnsureDefaultFollowerTheme(ws.themesDir); err != nil {
		log.Printf("[Widget] Failed to create default follower theme: %v", err)
	}

	if err := EnsureDefaultDonationTheme(ws.themesDir); err != nil {
		log.Printf("[Widget] Failed to create default donation theme: %v", err)
	}

	if err := EnsureDefaultGoalTheme(ws.themesDir); err != nil {
		log.Printf("[Widget] Failed to create default goal theme: %v", err)
	}

	mux := http.NewServeMux()

	// Chat widget endpoints (support both /widget/chat and /widget)
	mux.HandleFunc("/widget/events", ws.handleSSE)
	mux.HandleFunc("/widget/chat", ws.handleChat)
	mux.HandleFunc("/widget", ws.handleChat)
	mux.HandleFunc("/widget/test", ws.handleChatTest)
	mux.HandleFunc("/widget/chat/test", ws.handleChatTest)
	mux.HandleFunc("/widget/assets/", ws.handleAssets)
	mux.HandleFunc("/widget/themes", ws.handleThemesList)
	mux.HandleFunc("/widget/badges", ws.handleBadges)
	mux.HandleFunc("/widget/emotes", ws.handleEmotes)

	// Music widget endpoints
	mux.HandleFunc("/widget/music", ws.handleMusic)
	mux.HandleFunc("/widget/music/events", ws.handleMusicSSE)
	mux.HandleFunc("/widget/music/assets/", ws.handleMusicAssets)
	mux.HandleFunc("/widget/music/themes", ws.handleMusicThemesList)
	mux.HandleFunc("/widget/music/test", ws.handleMusicTest)

	// Follower alert widget endpoints (with aliases for both singular and plural)
	mux.HandleFunc("/widget/follower", ws.handleFollower)
	mux.HandleFunc("/widget/follower/", ws.handleFollower)
	mux.HandleFunc("/widget/followers", ws.handleFollower)
	mux.HandleFunc("/widget/followers/", ws.handleFollower)
	mux.HandleFunc("/widget/follower/assets/", ws.handleFollowerAssets)
	mux.HandleFunc("/widget/followers/assets/", ws.handleFollowerAssets)
	mux.HandleFunc("/widget/follower/themes", ws.handleFollowerThemesList)
	mux.HandleFunc("/widget/followers/themes", ws.handleFollowerThemesList)
	mux.HandleFunc("/widget/follower/test", ws.handleFollowerTest)
	mux.HandleFunc("/widget/followers/test", ws.handleFollowerTest)

	// Donation alert widget endpoints
	mux.HandleFunc("/widget/donation", ws.handleDonation)
	mux.HandleFunc("/widget/donation/", ws.handleDonation)
	mux.HandleFunc("/widget/donations", ws.handleDonation)
	mux.HandleFunc("/widget/donations/", ws.handleDonation)
	mux.HandleFunc("/widget/donation/assets/", ws.handleDonationAssets)
	mux.HandleFunc("/widget/donations/assets/", ws.handleDonationAssets)
	mux.HandleFunc("/widget/donation/test", ws.handleDonationTest)
	mux.HandleFunc("/widget/donations/test", ws.handleDonationTest)

	// Goal widget endpoints
	mux.HandleFunc("/widget/goal", ws.handleGoal)
	mux.HandleFunc("/widget/goal/", ws.handleGoal)
	mux.HandleFunc("/widget/goals", ws.handleGoal)
	mux.HandleFunc("/widget/goals/", ws.handleGoal)
	mux.HandleFunc("/widget/goal/assets/", ws.handleGoalAssets)
	mux.HandleFunc("/widget/goals/assets/", ws.handleGoalAssets)
	mux.HandleFunc("/widget/goal/data", ws.handleGoalData)
	mux.HandleFunc("/widget/goal/test", ws.handleGoalTest)

	ws.server = &http.Server{
		Addr:    fmt.Sprintf(":%d", ws.port),
		Handler: addCORSHeaders(mux),
	}

	go func() {
		log.Printf("[Widget] Server listening on http://localhost:%d", ws.port)
		if err := ws.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("[Widget] Server error: %v", err)
		}
	}()

	// Start file watcher for hot-reload
	go watchThemes(ws.themesDir, ws.broadcastReload)
}

// Stop shuts down the HTTP server.
func (ws *WidgetServer) Stop() {
	close(ws.stopChan)
	if ws.server != nil {
		_ = ws.server.Close()
	}
}

// Target defines the client group to broadcast an SSE event to.
type Target string

const (
	TargetChat  Target = "chat"
	TargetMusic Target = "music"
	TargetAll   Target = "all"
)

// Emit serializes payload and broadcasts an SSE event frame to connected clients in target pool.
func (ws *WidgetServer) Emit(target Target, event string, payload any) error {
	var data []byte
	if b, ok := payload.([]byte); ok {
		data = b
	} else if s, ok := payload.(string); ok {
		data = []byte(s)
	} else {
		var err error
		data, err = json.Marshal(payload)
		if err != nil {
			return fmt.Errorf("failed to marshal SSE payload: %w", err)
		}
	}

	frame := []byte(fmt.Sprintf("event: %s\ndata: %s\n\n", event, string(data)))

	switch target {
	case TargetChat:
		ws.sendToPool(ws.clients, &ws.clientsMu, frame)
	case TargetMusic:
		ws.sendToPool(ws.musicClients, &ws.musicClientsMu, frame)
	case TargetAll:
		ws.sendToPool(ws.clients, &ws.clientsMu, frame)
		ws.sendToPool(ws.musicClients, &ws.musicClientsMu, frame)
	default:
		return fmt.Errorf("unknown broadcast target: %s", target)
	}
	return nil
}

func (ws *WidgetServer) sendToPool(clients map[*sseClient]struct{}, mu *sync.RWMutex, frame []byte) {
	mu.RLock()
	defer mu.RUnlock()
	for c := range clients {
		select {
		case c.send <- frame:
		default:
		}
	}
}

// Broadcast sends a chat message to all connected SSE clients.
func (ws *WidgetServer) Broadcast(msg WidgetMessage) {
	if msg.Timestamp == "" {
		msg.Timestamp = time.Now().Format("15:04")
	}

	if len(msg.BadgeURLs) == 0 && ws.badgeFetcher != nil && len(msg.Badges) > 0 {
		bMap := ws.badgeFetcher()
		for _, b := range msg.Badges {
			if u, ok := bMap[b]; ok && u != "" {
				msg.BadgeURLs = append(msg.BadgeURLs, u)
			}
		}
	}

	ws.recentMessagesMu.Lock()
	ws.recentMessages = append(ws.recentMessages, msg)
	if len(ws.recentMessages) > 20 {
		ws.recentMessages = ws.recentMessages[len(ws.recentMessages)-20:]
	}
	ws.recentMessagesMu.Unlock()

	_ = ws.Emit(TargetChat, "message", msg)
}

// BroadcastMusicConfig sends updated music widget config to all connected music SSE clients.
func (ws *WidgetServer) BroadcastMusicConfig(cfg map[string]interface{}) {
	ws.musicClientsMu.Lock()
	ws.currentMusicConfig = cfg
	ws.musicClientsMu.Unlock()

	_ = ws.Emit(TargetMusic, "config", cfg)
}

// BroadcastMusicTrack sends a track update to all connected music SSE clients.
func (ws *WidgetServer) BroadcastMusicTrack(track media.TrackInfo) {
	_ = ws.Emit(TargetMusic, "track", track)
}

// BroadcastAvatarUpdate sends an avatar update event to all connected SSE clients.
func (ws *WidgetServer) BroadcastAvatarUpdate(user, avatarURL string) {
	if user == "" || avatarURL == "" {
		return
	}
	_ = ws.Emit(TargetChat, "avatar_update", map[string]string{
		"user":      user,
		"avatarUrl": avatarURL,
	})
}

// broadcastReload tells all connected clients to reload the page (theme file changed).
func (ws *WidgetServer) broadcastReload() {
	_ = ws.Emit(TargetAll, "reload", map[string]struct{}{})
}

// Port returns the configured port.
func (ws *WidgetServer) Port() int {
	return ws.port
}

// ThemesDirectory returns the resolved themes directory path.
func (ws *WidgetServer) ThemesDirectory() string {
	return ws.themesDir
}

// ---- HTTP handlers ----

func (ws *WidgetServer) handleSSE(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "SSE not supported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	// Immediately flush SSE connection comment so browser/OBS readyState becomes OPEN instantly
	_, _ = fmt.Fprintf(w, ": connected\n\n")
	flusher.Flush()

	// Replay recent chat messages immediately on connection unless replay=false is requested
	if r.URL.Query().Get("replay") != "false" {
		ws.recentMessagesMu.RLock()
		for _, recent := range ws.recentMessages {
			if d, err := json.Marshal(recent); err == nil {
				_, _ = fmt.Fprintf(w, "event: message\ndata: %s\n\n", string(d))
			}
		}
		ws.recentMessagesMu.RUnlock()
		flusher.Flush()
	}

	client := &sseClient{
		send:  make(chan []byte, 32),
		theme: r.URL.Query().Get("theme"),
	}

	ws.clientsMu.Lock()
	ws.clients[client] = struct{}{}
	ws.clientsMu.Unlock()

	defer func() {
		ws.clientsMu.Lock()
		delete(ws.clients, client)
		ws.clientsMu.Unlock()
	}()

	heartbeat := time.NewTicker(25 * time.Second)
	defer heartbeat.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-ws.stopChan:
			return
		case msg := <-client.send:
			_, _ = w.Write(msg)
			flusher.Flush()
		case <-heartbeat.C:
			_, _ = fmt.Fprintf(w, ": heartbeat\n\n")
			flusher.Flush()
		}
	}
}

func (ws *WidgetServer) handleMusicSSE(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "SSE not supported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	// Immediately flush SSE connection comment so browser/OBS readyState becomes OPEN instantly
	_, _ = fmt.Fprintf(w, ": connected\n\n")
	flusher.Flush()

	client := &sseClient{
		send:  make(chan []byte, 32),
		theme: r.URL.Query().Get("theme"),
	}

	ws.musicClientsMu.Lock()
	ws.musicClients[client] = struct{}{}
	ws.musicClientsMu.Unlock()

	defer func() {
		ws.musicClientsMu.Lock()
		delete(ws.musicClients, client)
		ws.musicClientsMu.Unlock()
	}()

	// Send current track immediately on connection so widget is populated instantly
	if ws.mediaManager != nil {
		current := ws.mediaManager.CurrentTrack()
		if data, err := json.Marshal(current); err == nil {
			initPayload := []byte("event: track\ndata: " + string(data) + "\n\n")
			_, _ = w.Write(initPayload)
			flusher.Flush()
		}
	}

	heartbeat := time.NewTicker(25 * time.Second)
	defer heartbeat.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-ws.stopChan:
			return
		case msg := <-client.send:
			_, _ = w.Write(msg)
			flusher.Flush()
		case <-heartbeat.C:
			_, _ = fmt.Fprintf(w, ": heartbeat\n\n")
			flusher.Flush()
		}
	}
}

func (ws *WidgetServer) handleChat(w http.ResponseWriter, r *http.Request) {
	theme := r.URL.Query().Get("theme")
	if theme == "" {
		theme = "default"
	}
	theme = filepath.Base(theme)

	indexPath := filepath.Join(ws.themesDir, "chat", theme, "index.html")
	if _, err := os.Stat(indexPath); os.IsNotExist(err) {
		indexPath = filepath.Join(ws.themesDir, theme, "index.html")
	}
	http.ServeFile(w, r, indexPath)
}

func (ws *WidgetServer) handleMusic(w http.ResponseWriter, r *http.Request) {
	theme := r.URL.Query().Get("theme")
	if theme == "" {
		theme = "default"
	}
	theme = filepath.Base(theme)

	indexPath := filepath.Join(ws.themesDir, "music", theme, "index.html")
	if _, err := os.Stat(indexPath); os.IsNotExist(err) {
		indexPath = filepath.Join(ws.themesDir, "music", "default", "index.html")
	}
	http.ServeFile(w, r, indexPath)
}

func (ws *WidgetServer) handleAssets(w http.ResponseWriter, r *http.Request) {
	// /widget/assets/{theme}/{file}
	parts := strings.SplitN(strings.TrimPrefix(r.URL.Path, "/widget/assets/"), "/", 2)
	if len(parts) < 2 {
		http.NotFound(w, r)
		return
	}
	theme := filepath.Base(parts[0])
	file := filepath.Base(parts[1])

	filePath := filepath.Join(ws.themesDir, "chat", theme, file)
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		filePath = filepath.Join(ws.themesDir, theme, file)
	}
	http.ServeFile(w, r, filePath)
}

func (ws *WidgetServer) handleMusicAssets(w http.ResponseWriter, r *http.Request) {
	// /widget/music/assets/{theme}/{file} or /widget/music/assets/{file}
	rel := strings.TrimPrefix(r.URL.Path, "/widget/music/assets/")
	parts := strings.Split(rel, "/")
	var filePath string
	if len(parts) == 1 {
		filePath = filepath.Join(ws.themesDir, "music", "default", filepath.Base(parts[0]))
	} else {
		theme := filepath.Base(parts[0])
		file := filepath.Base(parts[1])
		filePath = filepath.Join(ws.themesDir, "music", theme, file)
	}
	http.ServeFile(w, r, filePath)
}

func (ws *WidgetServer) handleBadges(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if ws.badgeFetcher != nil {
		if data, err := json.Marshal(ws.badgeFetcher()); err == nil {
			_, _ = w.Write(data)
			return
		}
	}
	_, _ = w.Write([]byte("{}"))
}

func (ws *WidgetServer) handleEmotes(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if ws.emoteFetcher != nil {
		if data, err := json.Marshal(ws.emoteFetcher()); err == nil {
			_, _ = w.Write(data)
			return
		}
	}
	_, _ = w.Write([]byte("{}"))
}

func (ws *WidgetServer) handleChatTest(w http.ResponseWriter, r *http.Request) {
	testMsg := WidgetMessage{
		Type:      "message",
		Author:    "StreamHero",
		AvatarURL: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
		Text:      "Тестовое сообщение Kappa с эмоутами catJAM и баджами! ✨",
		Color:     "#9146FF",
		Badges:    []string{"broadcaster/1", "subscriber/12"},
		Timestamp: time.Now().Format("15:04"),
	}
	ws.Broadcast(testMsg)
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(`{"success":true,"message":"Test chat message sent"}`))
}

func (ws *WidgetServer) handleMusicTest(w http.ResponseWriter, r *http.Request) {
	testTrack := media.TrackInfo{
		Status:    "playing",
		Title:     "Never Gonna Give You Up",
		Artist:    "Rick Astley",
		Album:     "Whenever You Need Somebody",
		Source:    "Spotify.exe",
		Timestamp: time.Now().UnixMilli(),
	}
	if ws.mediaManager != nil {
		ws.mediaManager.SetTrack(testTrack)
	} else {
		ws.BroadcastMusicTrack(testTrack)
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "track": testTrack})
}

func (ws *WidgetServer) handleThemesList(w http.ResponseWriter, r *http.Request) {
	chatDir := filepath.Join(ws.themesDir, "chat")
	entries, err := os.ReadDir(chatDir)
	if err != nil || len(entries) == 0 {
		entries, err = os.ReadDir(ws.themesDir)
	}
	if err != nil {
		http.Error(w, "cannot read themes dir", http.StatusInternalServerError)
		return
	}

	themes := []string{}
	for _, e := range entries {
		if e.IsDir() && e.Name() != "music" && e.Name() != "chat" {
			themes = append(themes, e.Name())
		}
	}
	if len(themes) == 0 {
		themes = append(themes, "default")
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(themes)
}

func (ws *WidgetServer) handleMusicThemesList(w http.ResponseWriter, r *http.Request) {
	musicDir := filepath.Join(ws.themesDir, "music")
	entries, err := os.ReadDir(musicDir)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode([]string{"default"})
		return
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

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(themes)
}

func (ws *WidgetServer) handleFollower(w http.ResponseWriter, r *http.Request) {
	theme := r.URL.Query().Get("theme")
	if theme == "" {
		theme = "default"
	}
	theme = filepath.Base(theme)

	indexPath := filepath.Join(ws.themesDir, "follower", theme, "index.html")
	if _, err := os.Stat(indexPath); err == nil {
		http.ServeFile(w, r, indexPath)
		return
	}
	defaultPath := filepath.Join(ws.themesDir, "follower", "default", "index.html")
	if _, err := os.Stat(defaultPath); err == nil {
		http.ServeFile(w, r, defaultPath)
		return
	}

	// In-memory fallback if file does not exist on disk
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte(defaultFollowerHTML))
}

func (ws *WidgetServer) handleFollowerAssets(w http.ResponseWriter, r *http.Request) {
	// Support both /widget/follower/assets/... and /widget/followers/assets/...
	relPath := strings.TrimPrefix(r.URL.Path, "/widget/followers/assets/")
	relPath = strings.TrimPrefix(relPath, "/widget/follower/assets/")
	parts := strings.Split(relPath, "/")
	var filePath string
	if len(parts) == 1 {
		filePath = filepath.Join(ws.themesDir, "follower", "default", filepath.Base(parts[0]))
	} else {
		theme := filepath.Base(parts[0])
		file := filepath.Base(parts[1])
		filePath = filepath.Join(ws.themesDir, "follower", theme, file)
	}

	if _, err := os.Stat(filePath); err == nil {
		http.ServeFile(w, r, filePath)
		return
	}

	// Try default theme directory fallback
	defaultPath := filepath.Join(ws.themesDir, "follower", "default", filepath.Base(relPath))
	if _, err := os.Stat(defaultPath); err == nil {
		http.ServeFile(w, r, defaultPath)
		return
	}

	// In-memory fallback for style.css
	if strings.HasSuffix(relPath, "style.css") {
		w.Header().Set("Content-Type", "text/css; charset=utf-8")
		_, _ = w.Write([]byte(defaultFollowerCSS))
		return
	}

	http.NotFound(w, r)
}

func (ws *WidgetServer) handleFollowerThemesList(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	themes := ws.GetFollowerThemes()
	_ = json.NewEncoder(w).Encode(themes)
}

func (ws *WidgetServer) GetFollowerThemes() []string {
	themes := []string{}
	followerDir := filepath.Join(ws.themesDir, "follower")
	if entries, err := os.ReadDir(followerDir); err == nil {
		for _, e := range entries {
			if e.IsDir() {
				themes = append(themes, e.Name())
			}
		}
	}
	if len(themes) == 0 {
		themes = append(themes, "default")
	}
	return themes
}

func (ws *WidgetServer) handleFollowerTest(w http.ResponseWriter, r *http.Request) {
	testFollow := WidgetMessage{
		Type:      "follow",
		Author:    "Alex_Streamer",
		AvatarURL: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
		Text:      "Alex_Streamer отслеживает канал!",
		Color:     "#10B981",
		Timestamp: time.Now().Format("15:04"),
	}
	ws.Broadcast(testFollow)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func (ws *WidgetServer) handleDonation(w http.ResponseWriter, r *http.Request) {
	theme := r.URL.Query().Get("theme")
	if theme == "" {
		theme = "default"
	}
	theme = filepath.Base(theme)

	indexPath := filepath.Join(ws.themesDir, "donation", theme, "index.html")
	if _, err := os.Stat(indexPath); err == nil {
		http.ServeFile(w, r, indexPath)
		return
	}
	defaultPath := filepath.Join(ws.themesDir, "donation", "default", "index.html")
	if _, err := os.Stat(defaultPath); err == nil {
		http.ServeFile(w, r, defaultPath)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte(defaultDonationHTML))
}

func (ws *WidgetServer) handleDonationAssets(w http.ResponseWriter, r *http.Request) {
	relPath := strings.TrimPrefix(r.URL.Path, "/widget/donations/assets/")
	relPath = strings.TrimPrefix(relPath, "/widget/donation/assets/")
	parts := strings.Split(relPath, "/")
	var filePath string
	if len(parts) == 1 {
		filePath = filepath.Join(ws.themesDir, "donation", "default", filepath.Base(parts[0]))
	} else {
		theme := filepath.Base(parts[0])
		file := filepath.Base(parts[1])
		filePath = filepath.Join(ws.themesDir, "donation", theme, file)
	}

	if _, err := os.Stat(filePath); err == nil {
		http.ServeFile(w, r, filePath)
		return
	}

	defaultPath := filepath.Join(ws.themesDir, "donation", "default", filepath.Base(relPath))
	if _, err := os.Stat(defaultPath); err == nil {
		http.ServeFile(w, r, defaultPath)
		return
	}

	if strings.HasSuffix(relPath, "style.css") {
		w.Header().Set("Content-Type", "text/css; charset=utf-8")
		_, _ = w.Write([]byte(defaultDonationCSS))
		return
	}

	http.NotFound(w, r)
}

func (ws *WidgetServer) handleGoal(w http.ResponseWriter, r *http.Request) {
	theme := r.URL.Query().Get("theme")
	if theme == "" {
		theme = "default"
	}
	theme = filepath.Base(theme)

	indexPath := filepath.Join(ws.themesDir, "goal", theme, "index.html")
	if _, err := os.Stat(indexPath); err == nil {
		http.ServeFile(w, r, indexPath)
		return
	}
	defaultPath := filepath.Join(ws.themesDir, "goal", "default", "index.html")
	if _, err := os.Stat(defaultPath); err == nil {
		http.ServeFile(w, r, defaultPath)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte(defaultGoalHTML))
}

func (ws *WidgetServer) handleGoalAssets(w http.ResponseWriter, r *http.Request) {
	relPath := strings.TrimPrefix(r.URL.Path, "/widget/goals/assets/")
	relPath = strings.TrimPrefix(relPath, "/widget/goal/assets/")
	parts := strings.Split(relPath, "/")
	var filePath string
	if len(parts) == 1 {
		filePath = filepath.Join(ws.themesDir, "goal", "default", filepath.Base(parts[0]))
	} else {
		theme := filepath.Base(parts[0])
		file := filepath.Base(parts[1])
		filePath = filepath.Join(ws.themesDir, "goal", theme, file)
	}

	if _, err := os.Stat(filePath); err == nil {
		http.ServeFile(w, r, filePath)
		return
	}

	defaultPath := filepath.Join(ws.themesDir, "goal", "default", filepath.Base(relPath))
	if _, err := os.Stat(defaultPath); err == nil {
		http.ServeFile(w, r, defaultPath)
		return
	}

	if strings.HasSuffix(relPath, "style.css") {
		w.Header().Set("Content-Type", "text/css; charset=utf-8")
		_, _ = w.Write([]byte(defaultGoalCSS))
		return
	}

	http.NotFound(w, r)
}

func (ws *WidgetServer) handleGoalData(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	ws.currentGoalMu.RLock()
	data := ws.currentGoal
	ws.currentGoalMu.RUnlock()

	if data == nil {
		data = map[string]interface{}{
			"title":         "Сбор средств",
			"currentAmount": 0.0,
			"targetAmount":  10000.0,
			"currency":      "RUB",
			"percent":       0.0,
		}
	}
	_ = json.NewEncoder(w).Encode(data)
}

func (ws *WidgetServer) handleDonationTest(w http.ResponseWriter, r *http.Request) {
	ws.BroadcastDonation("Доброжелатель", 500, "RUB", "Удачи на стриме! Отличный контент ✨")
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func (ws *WidgetServer) handleGoalTest(w http.ResponseWriter, r *http.Request) {
	ws.BroadcastGoal("На новый микрофон", 3500, 10000, "RUB")
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func (ws *WidgetServer) SetCurrentGoal(title string, current, target float64, currency string) {
	pct := 0.0
	if target > 0 {
		pct = (current / target) * 100.0
		if pct > 100.0 {
			pct = 100.0
		}
	}
	ws.currentGoalMu.Lock()
	ws.currentGoal = map[string]interface{}{
		"title":         title,
		"currentAmount": current,
		"targetAmount":  target,
		"currency":      currency,
		"percent":       pct,
	}
	ws.currentGoalMu.Unlock()
}

// GetCurrentGoal returns the cached goal information map
func (ws *WidgetServer) GetCurrentGoal() map[string]interface{} {
	ws.currentGoalMu.RLock()
	defer ws.currentGoalMu.RUnlock()
	if ws.currentGoal == nil {
		return map[string]interface{}{
			"title":         "",
			"currentAmount": 0.0,
			"targetAmount":  0.0,
			"currency":      "RUB",
			"percent":       0.0,
		}
	}
	return ws.currentGoal
}

func (ws *WidgetServer) BroadcastDonation(author string, amount float64, currency, message string) {
	cur := currency
	if cur == "" {
		cur = "RUB"
	}
	msg := WidgetMessage{
		Type:      "donation",
		IsEvent:   true,
		EventType: "donation",
		Author:    author,
		Amount:    amount,
		Currency:  cur,
		Text:      message,
		Timestamp: time.Now().Format("15:04"),
	}
	ws.Broadcast(msg)
}

func (ws *WidgetServer) BroadcastGoal(title string, current, target float64, currency string) {
	ws.SetCurrentGoal(title, current, target, currency)
	msg := WidgetMessage{
		Type:      "goal",
		IsEvent:   true,
		EventType: "goal_update",
		Goal: map[string]interface{}{
			"title":         title,
			"currentAmount": current,
			"targetAmount":  target,
			"currency":      currency,
		},
		Timestamp: time.Now().Format("15:04"),
	}
	ws.Broadcast(msg)
}

// addCORSHeaders wraps a handler to allow any origin (OBS uses file:// or null origin).
func addCORSHeaders(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "*")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		h.ServeHTTP(w, r)
	})
}
