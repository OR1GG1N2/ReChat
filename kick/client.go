package kick

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"ReChat/proxy"
	"ReChat/twitch"

	"github.com/gorilla/websocket"
)

const (
	KickPusherURL = "wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0-rc2&flash=false"
	KickAPIBase   = "https://kick.com/api/v2"
	DefaultColor  = "#53FC18" // Kick signature neon green
)

// PusherEnvelope represents standard Pusher event frame
type PusherEnvelope struct {
	Event   string          `json:"event"`
	Channel string          `json:"channel,omitempty"`
	Data    json.RawMessage `json:"data"`
}

// KickChannelResponse models the JSON returned by /api/v2/channels/{slug}
type KickChannelResponse struct {
	ID       int    `json:"id"`
	Slug     string `json:"slug"`
	Chatroom struct {
		ID int `json:"id"`
	} `json:"chatroom"`
}

// KickChatMessagePayload models the payload inside App\Events\ChatMessageEvent
type KickChatMessagePayload struct {
	ID         string     `json:"id"`
	ChatroomID int        `json:"chatroom_id"`
	Content    string     `json:"content"`
	Type       string     `json:"type"`
	CreatedAt  string     `json:"created_at"`
	Sender     KickSender `json:"sender"`
}

type KickSender struct {
	ID       int          `json:"id"`
	Username string       `json:"username"`
	Slug     string       `json:"slug"`
	Identity KickIdentity `json:"identity"`
}

type KickIdentity struct {
	Color  string      `json:"color"`
	Badges []KickBadge `json:"badges"`
}

type KickBadge struct {
	Type  string `json:"type"`
	Text  string `json:"text"`
	Count int    `json:"count"`
}

// KickBanPayload models App\Events\UserBannedEvent
type KickBanPayload struct {
	ID        string `json:"id"`
	User      struct {
		ID       int    `json:"id"`
		Username string `json:"username"`
		Slug     string `json:"slug"`
	} `json:"user"`
	BannedBy struct {
		ID       int    `json:"id"`
		Username string `json:"username"`
	} `json:"banned_by"`
	ExpiresAt string `json:"expires_at,omitempty"`
}

// KickMessageDeletedPayload models App\Events\MessageDeletedEvent
type KickMessageDeletedPayload struct {
	Message struct {
		ID string `json:"id"`
	} `json:"message"`
}

// Client manages connection to Kick's Pusher WebSocket and channel routing
type Client struct {
	ctx        context.Context
	cancelFunc context.CancelFunc

	connMu      sync.Mutex
	conn        *websocket.Conn
	isConnected bool

	channelsMu       sync.RWMutex
	slugToChatroomID map[string]int
	chatroomIDToSlug map[int]string
	joinedChannels   map[string]bool

	onMessage    func(*twitch.ChatMessage)
	rewardFilter func(*twitch.ChatMessage) bool
	httpClient   *http.Client
	stopChan     chan struct{}
}

func NewClient() *Client {
	return &Client{
		slugToChatroomID: make(map[string]int),
		chatroomIDToSlug: make(map[int]string),
		joinedChannels:   make(map[string]bool),
	}
}

func (c *Client) SetContext(ctx context.Context) {
	c.ctx = ctx
}

func (c *Client) SetMessageHandler(fn func(*twitch.ChatMessage)) {
	c.onMessage = fn
}

func (c *Client) SetRewardFilter(fn func(*twitch.ChatMessage) bool) {
	c.rewardFilter = fn
}

func (c *Client) SetHTTPClient(client *http.Client) {
	c.httpClient = client
}

func (c *Client) getHTTPClient() *http.Client {
	if c.httpClient != nil {
		return c.httpClient
	}
	return proxy.GetHTTPClient()
}

// FormatKickBadges transforms Kick badge objects into standard badge string e.g. "broadcaster/1,moderator/1,subscriber/6"
func FormatKickBadges(badges []KickBadge) string {
	if len(badges) == 0 {
		return ""
	}
	parts := make([]string, 0, len(badges))
	for _, b := range badges {
		ver := 1
		if b.Count > 0 {
			ver = b.Count
		}
		cleanType := strings.ToLower(strings.TrimSpace(b.Type))
		if cleanType != "" {
			parts = append(parts, fmt.Sprintf("%s/%d", cleanType, ver))
		}
	}
	return strings.Join(parts, ",")
}

// ResolveChatroomID resolves a channel slug to chatroom ID using Kick API
func (c *Client) ResolveChatroomID(channelSlug string) (int, error) {
	cleanSlug := strings.ToLower(strings.TrimSpace(channelSlug))
	cleanSlug = strings.TrimPrefix(cleanSlug, "#")
	if cleanSlug == "" {
		return 0, fmt.Errorf("channel slug cannot be empty")
	}

	c.channelsMu.RLock()
	if id, ok := c.slugToChatroomID[cleanSlug]; ok && id > 0 {
		c.channelsMu.RUnlock()
		return id, nil
	}
	c.channelsMu.RUnlock()

	url := fmt.Sprintf("%s/channels/%s", KickAPIBase, cleanSlug)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return 0, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "application/json")

	client := c.getHTTPClient()
	resp, err := client.Do(req)
	if err != nil {
		return 0, fmt.Errorf("failed to fetch kick channel: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return 0, fmt.Errorf("kick api error (status %d): %s", resp.StatusCode, string(body))
	}

	var chResp KickChannelResponse
	if err := json.NewDecoder(resp.Body).Decode(&chResp); err != nil {
		return 0, fmt.Errorf("failed to decode kick channel response: %w", err)
	}

	if chResp.Chatroom.ID == 0 {
		return 0, fmt.Errorf("no chatroom found for kick channel %s", cleanSlug)
	}

	c.channelsMu.Lock()
	c.slugToChatroomID[cleanSlug] = chResp.Chatroom.ID
	c.chatroomIDToSlug[chResp.Chatroom.ID] = cleanSlug
	c.channelsMu.Unlock()

	return chResp.Chatroom.ID, nil
}

// JoinChannel adds a Kick channel to listen to and subscribes to its Pusher chatroom
func (c *Client) JoinChannel(channelSlug string) error {
	cleanSlug := strings.ToLower(strings.TrimSpace(channelSlug))
	cleanSlug = strings.TrimPrefix(cleanSlug, "#")
	if cleanSlug == "" {
		return fmt.Errorf("channel slug cannot be empty")
	}

	chatroomID, err := c.ResolveChatroomID(cleanSlug)
	if err != nil {
		return err
	}

	c.channelsMu.Lock()
	c.joinedChannels[cleanSlug] = true
	c.channelsMu.Unlock()

	c.connMu.Lock()
	defer c.connMu.Unlock()

	if !c.isConnected || c.conn == nil {
		go c.Start()
		return nil
	}

	return c.sendSubscription(chatroomID)
}

// LeaveChannel stops listening to a Kick channel
func (c *Client) LeaveChannel(channelSlug string) error {
	cleanSlug := strings.ToLower(strings.TrimSpace(channelSlug))
	cleanSlug = strings.TrimPrefix(cleanSlug, "#")

	c.channelsMu.Lock()
	delete(c.joinedChannels, cleanSlug)
	chatroomID := c.slugToChatroomID[cleanSlug]
	c.channelsMu.Unlock()

	if chatroomID > 0 {
		c.connMu.Lock()
		defer c.connMu.Unlock()
		if c.isConnected && c.conn != nil {
			unsub := map[string]any{
				"event": "pusher:unsubscribe",
				"data": map[string]string{
					"channel": fmt.Sprintf("chatrooms.%d.v2", chatroomID),
				},
			}
			bytes, _ := json.Marshal(unsub)
			_ = c.conn.WriteMessage(websocket.TextMessage, bytes)
		}
	}

	return nil
}

// GetJoinedChannels returns list of currently joined Kick channel slugs
func (c *Client) GetJoinedChannels() []string {
	c.channelsMu.RLock()
	defer c.channelsMu.RUnlock()

	channels := make([]string, 0, len(c.joinedChannels))
	for ch := range c.joinedChannels {
		channels = append(channels, ch)
	}
	return channels
}

func (c *Client) sendSubscription(chatroomID int) error {
	if c.conn == nil {
		return fmt.Errorf("not connected")
	}
	sub := map[string]any{
		"event": "pusher:subscribe",
		"data": map[string]string{
			"auth":    "",
			"channel": fmt.Sprintf("chatrooms.%d.v2", chatroomID),
		},
	}
	bytes, err := json.Marshal(sub)
	if err != nil {
		return err
	}
	return c.conn.WriteMessage(websocket.TextMessage, bytes)
}

// Start establishes connection to Kick's Pusher WebSocket with automatic reconnection
func (c *Client) Start() {
	c.connMu.Lock()
	if c.isConnected {
		c.connMu.Unlock()
		return
	}
	c.connMu.Unlock()

	backoff := 1 * time.Second
	for {
		err := c.connect()
		if err != nil {
			log.Printf("[Kick] Connection error: %v (retrying in %v)", err, backoff)
			time.Sleep(backoff)
			if backoff < 30*time.Second {
				backoff *= 2
			}
			continue
		}

		// Connected successfully, reset backoff
		backoff = 1 * time.Second
		c.readLoop()

		c.connMu.Lock()
		c.isConnected = false
		if c.conn != nil {
			c.conn.Close()
			c.conn = nil
		}
		c.connMu.Unlock()

		log.Printf("[Kick] Disconnected from Pusher, reconnecting...")
		time.Sleep(1 * time.Second)
	}
}

func (c *Client) connect() error {
	c.connMu.Lock()
	defer c.connMu.Unlock()

	dialer := proxy.GetWebSocketDialer()
	headers := http.Header{}
	headers.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36")
	headers.Set("Origin", "https://kick.com")

	conn, _, err := dialer.Dial(KickPusherURL, headers)
	if err != nil {
		return err
	}

	c.conn = conn
	c.isConnected = true
	log.Printf("[Kick] WebSocket connected to Pusher")
	return nil
}

func (c *Client) readLoop() {
	for {
		_, rawMsg, err := c.conn.ReadMessage()
		if err != nil {
			return
		}

		var envelope PusherEnvelope
		if err := json.Unmarshal(rawMsg, &envelope); err != nil {
			continue
		}

		switch envelope.Event {
		case "pusher:connection_established":
			// Resubscribe to all active channels
			c.channelsMu.RLock()
			for slug := range c.joinedChannels {
				if chatroomID, ok := c.slugToChatroomID[slug]; ok && chatroomID > 0 {
					_ = c.sendSubscription(chatroomID)
				}
			}
			c.channelsMu.RUnlock()

		case "pusher:ping":
			// Send heartbeat pong
			c.connMu.Lock()
			if c.conn != nil {
				_ = c.conn.WriteMessage(websocket.TextMessage, []byte(`{"event":"pusher:pong","data":{}}`))
			}
			c.connMu.Unlock()

		case "App\\Events\\ChatMessageEvent":
			c.handleChatMessage(envelope.Data)

		case "App\\Events\\UserBannedEvent":
			c.handleUserBanned(envelope.Data)

		case "App\\Events\\MessageDeletedEvent":
			c.handleMessageDeleted(envelope.Data)
		}
	}
}

func (c *Client) handleChatMessage(data json.RawMessage) {
	// Data in Pusher events is often JSON encoded as string or object
	var payload KickChatMessagePayload
	rawStr := string(data)
	if strings.HasPrefix(rawStr, `"`) {
		var unescaped string
		if err := json.Unmarshal(data, &unescaped); err == nil {
			_ = json.Unmarshal([]byte(unescaped), &payload)
		}
	} else {
		_ = json.Unmarshal(data, &payload)
	}

	if payload.Content == "" && payload.ID == "" {
		return
	}

	c.channelsMu.RLock()
	channelSlug := c.chatroomIDToSlug[payload.ChatroomID]
	c.channelsMu.RUnlock()

	color := payload.Sender.Identity.Color
	if color == "" {
		color = DefaultColor
	}

	ts := payload.CreatedAt
	if t, err := time.Parse(time.RFC3339, payload.CreatedAt); err == nil {
		ts = t.Format("15:04:05")
	} else if len(ts) >= 19 {
		ts = ts[11:19]
	}

	chatMsg := &twitch.ChatMessage{
		ID:          payload.ID,
		Platform:    "kick",
		Channel:     channelSlug,
		User:        strings.ToLower(payload.Sender.Username),
		DisplayName: payload.Sender.Username,
		Color:       color,
		Message:     payload.Content,
		Timestamp:   ts,
		Badges:      FormatKickBadges(payload.Sender.Identity.Badges),
		IsEvent:     false,
	}

	if c.rewardFilter != nil && c.rewardFilter(chatMsg) {
		return
	}

	if c.onMessage != nil {
		c.onMessage(chatMsg)
	}
}

func (c *Client) handleUserBanned(data json.RawMessage) {
	var payload KickBanPayload
	rawStr := string(data)
	if strings.HasPrefix(rawStr, `"`) {
		var unescaped string
		if err := json.Unmarshal(data, &unescaped); err == nil {
			_ = json.Unmarshal([]byte(unescaped), &payload)
		}
	} else {
		_ = json.Unmarshal(data, &payload)
	}

	if payload.User.Username == "" {
		return
	}

	eventType := "ban"
	systemMsg := fmt.Sprintf("%s был забанен на Kick", payload.User.Username)
	if payload.ExpiresAt != "" {
		eventType = "timeout"
		systemMsg = fmt.Sprintf("%s временно заблокирован на Kick", payload.User.Username)
	}

	chatMsg := &twitch.ChatMessage{
		ID:          fmt.Sprintf("kick-ban-%s-%d", payload.User.Username, time.Now().UnixNano()),
		Platform:    "kick",
		User:        strings.ToLower(payload.User.Username),
		DisplayName: payload.User.Username,
		IsEvent:     true,
		EventType:   eventType,
		SystemMsg:   systemMsg,
		Timestamp:   time.Now().Format("15:04:05"),
	}

	if c.onMessage != nil {
		c.onMessage(chatMsg)
	}
}

func (c *Client) handleMessageDeleted(data json.RawMessage) {
	var payload KickMessageDeletedPayload
	rawStr := string(data)
	if strings.HasPrefix(rawStr, `"`) {
		var unescaped string
		if err := json.Unmarshal(data, &unescaped); err == nil {
			_ = json.Unmarshal([]byte(unescaped), &payload)
		}
	} else {
		_ = json.Unmarshal(data, &payload)
	}

	if payload.Message.ID == "" {
		return
	}

	chatMsg := &twitch.ChatMessage{
		ID:        payload.Message.ID,
		Platform:  "kick",
		IsEvent:   true,
		EventType: "clearmsg",
		Timestamp: time.Now().Format("15:04:05"),
	}

	if c.onMessage != nil {
		c.onMessage(chatMsg)
	}
}

// Disconnect shuts down the client connection
func (c *Client) Disconnect() {
	c.connMu.Lock()
	defer c.connMu.Unlock()

	c.isConnected = false
	if c.conn != nil {
		c.conn.Close()
		c.conn = nil
	}
}
