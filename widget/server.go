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
)

// WidgetMessage is the payload sent over SSE to the OBS browser source.
type WidgetMessage struct {
	Type         string   `json:"type"` // "message" | "reward" | "clear"
	Author       string   `json:"author,omitempty"`
	AvatarURL    string   `json:"avatarUrl,omitempty"`
	Color        string   `json:"color,omitempty"`
	Badges       []string `json:"badges,omitempty"`
	Text         string   `json:"text,omitempty"`
	Emotes       []string `json:"emotes,omitempty"`
	RewardTitle  string   `json:"rewardTitle,omitempty"`
	Cost         int      `json:"cost,omitempty"`
	UserInput    string   `json:"userInput,omitempty"`
	Channel      string   `json:"channel,omitempty"`
	Timestamp    string   `json:"timestamp"`
}

// sseClient represents a connected OBS browser.
type sseClient struct {
	send   chan []byte
	theme  string
}

// WidgetServer serves the OBS chat widget via HTTP.
type WidgetServer struct {
	port       int
	themesDir  string
	server     *http.Server

	clientsMu sync.RWMutex
	clients   map[*sseClient]struct{}

	stopChan chan struct{}
}

// NewWidgetServer creates a widget server. Port defaults to 3500.
func NewWidgetServer(port int) *WidgetServer {
	if port == 0 {
		port = 3500
	}
	return &WidgetServer{
		port:      port,
		themesDir: ThemesDir(),
		clients:   make(map[*sseClient]struct{}),
		stopChan:  make(chan struct{}),
	}
}

// Start starts the HTTP server and the themes watcher in the background.
func (ws *WidgetServer) Start() {
	if err := EnsureDefaultTheme(ws.themesDir); err != nil {
		log.Printf("[Widget] Failed to create default theme: %v", err)
	}

	mux := http.NewServeMux()

	// SSE stream — OBS browser subscribes here
	mux.HandleFunc("/widget/events", ws.handleSSE)

	// Serve the widget HTML for a given theme
	mux.HandleFunc("/widget/chat", ws.handleChat)

	// Serve theme static assets (CSS, images, etc.)
	mux.HandleFunc("/widget/assets/", ws.handleAssets)

	// List available themes
	mux.HandleFunc("/widget/themes", ws.handleThemesList)

	ws.server = &http.Server{
		Addr:    fmt.Sprintf(":%d", ws.port),
		Handler: addCORSHeaders(mux),
	}

	go func() {
		log.Printf("[Widget] Server listening on http://localhost:%d/widget/chat", ws.port)
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
		msg.Timestamp = time.Now().Format(time.RFC3339)
	}

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
			// client is too slow — skip
		}
	}
}

// broadcastReload tells all connected clients to reload the page (theme file changed).
func (ws *WidgetServer) broadcastReload() {
	payload := []byte("event: reload\ndata: {}\n\n")
	ws.clientsMu.RLock()
	defer ws.clientsMu.RUnlock()
	for c := range ws.clients {
		select {
		case c.send <- payload:
		default:
		}
	}
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
	w.Header().Set("X-Accel-Buffering", "no")

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

	// Send a heartbeat comment every 25s to keep the connection alive
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
	// Sanitize — no path traversal
	theme = filepath.Base(theme)

	indexPath := filepath.Join(ws.themesDir, theme, "index.html")
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

	filePath := filepath.Join(ws.themesDir, theme, file)
	http.ServeFile(w, r, filePath)
}

func (ws *WidgetServer) handleThemesList(w http.ResponseWriter, r *http.Request) {
	entries, err := os.ReadDir(ws.themesDir)
	if err != nil {
		http.Error(w, "cannot read themes dir", http.StatusInternalServerError)
		return
	}

	themes := []string{}
	for _, e := range entries {
		if e.IsDir() {
			themes = append(themes, e.Name())
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(themes)
}

// addCORSHeaders wraps a handler to allow any origin (OBS uses file:// or null origin).
func addCORSHeaders(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		h.ServeHTTP(w, r)
	})
}
