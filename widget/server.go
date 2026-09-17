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

	data, err := json.Marshal(msg)
	if err != nil {
		return
	}

	payload := []byte("event: message\ndata: " + string(data) + "\n\n")

	ws.clientsMu.RLock()
	defer ws.clientsMu.RUnlock()
	for c := range ws.clients {
		select {
		case c.send <- payload:
		default:
		}
	}
}

// BroadcastMusicConfig sends updated music widget config to all connected music SSE clients.
func (ws *WidgetServer) BroadcastMusicConfig(cfg map[string]interface{}) {
	ws.musicClientsMu.Lock()
	ws.currentMusicConfig = cfg
	ws.musicClientsMu.Unlock()

	data, err := json.Marshal(cfg)
	if err != nil {
		return
	}

	payload := []byte("event: config\ndata: " + string(data) + "\n\n")

	ws.musicClientsMu.RLock()
	defer ws.musicClientsMu.RUnlock()
	for c := range ws.musicClients {
		select {
		case c.send <- payload:
		default:
		}
	}
}

// BroadcastMusicTrack sends a track update to all connected music SSE clients.
func (ws *WidgetServer) BroadcastMusicTrack(track media.TrackInfo) {
	data, err := json.Marshal(track)
	if err != nil {
		return
	}

	payload := []byte("event: track\ndata: " + string(data) + "\n\n")

	ws.musicClientsMu.RLock()
	defer ws.musicClientsMu.RUnlock()
	for c := range ws.musicClients {
		select {
		case c.send <- payload:
		default:
		}
	}
}

// BroadcastAvatarUpdate sends an avatar update event to all connected SSE clients.
func (ws *WidgetServer) BroadcastAvatarUpdate(user, avatarURL string) {
	if user == "" || avatarURL == "" {
		return
	}
	data, err := json.Marshal(map[string]string{
		"user":      user,
		"avatarUrl": avatarURL,
	})
	if err != nil {
		return
	}

	payload := []byte("event: avatar_update\ndata: " + string(data) + "\n\n")

	ws.clientsMu.RLock()
	defer ws.clientsMu.RUnlock()
	for c := range ws.clients {
		select {
		case c.send <- payload:
		default:
		}
	}
}

// broadcastReload tells all connected clients to reload the page (theme file changed).
func (ws *WidgetServer) broadcastReload() {
	payload := []byte("event: reload\ndata: {}\n\n")

	ws.clientsMu.RLock()
	for c := range ws.clients {
		select {
		case c.send <- payload:
		default:
		}
	}
	ws.clientsMu.RUnlock()

	ws.musicClientsMu.RLock()
	for c := range ws.musicClients {
		select {
		case c.send <- payload:
		default:
		}
	}
	ws.musicClientsMu.RUnlock()
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

	// Replay recent chat messages immediately on connection so OBS doesn't start with a blank screen
	ws.recentMessagesMu.RLock()
	for _, recent := range ws.recentMessages {
		if d, err := json.Marshal(recent); err == nil {
			_, _ = fmt.Fprintf(w, "event: message\ndata: %s\n\n", string(d))
		}
	}
	ws.recentMessagesMu.RUnlock()
	flusher.Flush()

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
