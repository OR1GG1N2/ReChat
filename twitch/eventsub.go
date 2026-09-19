package twitch

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"ReChat/config"
	"ReChat/proxy"

	"github.com/gorilla/websocket"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// EventSub message structures according to Twitch documentation
type eventSubMetadata struct {
	MessageID        string `json:"message_id"`
	MessageType      string `json:"message_type"`
	MessageTimestamp string `json:"message_timestamp"`
	SubscriptionType string `json:"subscription_type,omitempty"`
}

// eventSubSessionPayload wraps payload.session from session_welcome messages
type eventSubSessionPayload struct {
	Payload struct {
		Session struct {
			ID                      string  `json:"id"`
			Status                  string  `json:"status"`
			ConnectedAt             string  `json:"connected_at"`
			KeepaliveTimeoutSeconds int     `json:"keepalive_timeout_seconds"`
			ReconnectURL            *string `json:"reconnect_url"`
		} `json:"session"`
	} `json:"payload"`
}

type eventSubRewardEvent struct {
	ID                   string `json:"id"`
	BroadcasterUserID    string `json:"broadcaster_user_id"`
	BroadcasterUserLogin string `json:"broadcaster_user_login"`
	BroadcasterUserName  string `json:"broadcaster_user_name"`
	UserID               string `json:"user_id"`
	UserLogin            string `json:"user_login"`
	UserName             string `json:"user_name"`
	UserInput            string `json:"user_input"`
	Status               string `json:"status"`
	Reward               struct {
		ID     string `json:"id"`
		Title  string `json:"title"`
		Cost   int    `json:"cost"`
		Prompt string `json:"prompt"`
	} `json:"reward"`
	RedeemedAt string `json:"redeemed_at"`
}

// eventSubNotificationPayload wraps payload.subscription and payload.event from notification messages
type eventSubNotificationPayload struct {
	Payload struct {
		Subscription struct {
			ID   string `json:"id"`
			Type string `json:"type"`
		} `json:"subscription"`
		Event eventSubRewardEvent `json:"event"`
	} `json:"payload"`
}

type eventSubFollowEvent struct {
	UserID               string `json:"user_id"`
	UserLogin            string `json:"user_login"`
	UserName             string `json:"user_name"`
	BroadcasterUserID    string `json:"broadcaster_user_id"`
	BroadcasterUserLogin string `json:"broadcaster_user_login"`
	BroadcasterUserName  string `json:"broadcaster_user_name"`
	FollowedAt           string `json:"followed_at"`
}

type eventSubFollowNotificationPayload struct {
	Payload struct {
		Subscription struct {
			ID   string `json:"id"`
			Type string `json:"type"`
		} `json:"subscription"`
		Event eventSubFollowEvent `json:"event"`
	} `json:"payload"`
}

type EventSubClient struct {
	ctx        context.Context
	conn       *websocket.Conn
	connMu     sync.Mutex
	sessionID  string
	clientID   string
	oauthToken string
	userID     string
	stopChan   chan struct{}
	isRunning  bool

	// Cache of resolved user logins to user IDs
	userCache   map[string]string
	userCacheMu sync.RWMutex

	// List of channels to track
	channels   map[string]bool
	channelsMu sync.RWMutex

	// Deduplication cache: redemption ID -> timestamp
	dedupCache   map[string]time.Time
	dedupCacheMu sync.Mutex

	onMessage func(msg *ChatMessage)
}

func NewEventSubClient(onMessage func(msg *ChatMessage)) *EventSubClient {
	return &EventSubClient{
		clientID:   config.TwitchClientID,
		userCache:  make(map[string]string),
		channels:   make(map[string]bool),
		dedupCache: make(map[string]time.Time),
		onMessage:  onMessage,
	}
}

func (e *EventSubClient) SetContext(ctx context.Context) {
	e.ctx = ctx
}

func (e *EventSubClient) Start(oauthToken, userID string) {
	e.connMu.Lock()
	if e.isRunning {
		e.connMu.Unlock()
		return
	}
	e.oauthToken = strings.TrimPrefix(oauthToken, "oauth:")
	e.userID = userID
	e.isRunning = true
	e.stopChan = make(chan struct{})
	e.connMu.Unlock()

	go e.runLoop()
}

func (e *EventSubClient) Stop() {
	e.connMu.Lock()
	defer e.connMu.Unlock()

	if !e.isRunning {
		return
	}
	e.isRunning = false
	if e.stopChan != nil {
		close(e.stopChan)
	}
	if e.conn != nil {
		_ = e.conn.Close()
		e.conn = nil
	}
}

func (e *EventSubClient) IsRunning() bool {
	e.connMu.Lock()
	defer e.connMu.Unlock()
	return e.isRunning
}

func (e *EventSubClient) AddChannel(channel string) {
	ch := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(channel), "#"))
	if ch == "" {
		return
	}

	e.channelsMu.Lock()
	e.channels[ch] = true
	e.channelsMu.Unlock()

	e.connMu.Lock()
	sessionID := e.sessionID
	e.connMu.Unlock()

	if sessionID != "" {
		go e.subscribeForChannel(ch, sessionID)
	}
}

func (e *EventSubClient) RemoveChannel(channel string) {
	ch := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(channel), "#"))
	e.channelsMu.Lock()
	delete(e.channels, ch)
	e.channelsMu.Unlock()
}

func (e *EventSubClient) runLoop() {
	backoff := 1 * time.Second

	for {
		select {
		case <-e.stopChan:
			return
		default:
		}

		err := e.connectAndListen()
		if err != nil {
			log.Printf("[EventSub] Disconnected/Error: %v", err)
		}

		select {
		case <-e.stopChan:
			return
		case <-time.After(backoff):
			if backoff < 30*time.Second {
				backoff *= 2
			}
		}
	}
}

func (e *EventSubClient) connectAndListen() error {
	dialer := proxy.GetWebSocketDialer()
	conn, _, err := dialer.Dial(config.TwitchEventSubWebSocketURL, nil)
	if err != nil {
		return fmt.Errorf("eventsub dial failed: %w", err)
	}

	e.connMu.Lock()
	e.conn = conn
	e.sessionID = ""
	e.connMu.Unlock()

	defer func() {
		e.connMu.Lock()
		if e.conn == conn {
			e.conn = nil
			e.sessionID = ""
		}
		e.connMu.Unlock()
		_ = conn.Close()
	}()

	for {
		select {
		case <-e.stopChan:
			return nil
		default:
		}

		_, message, err := conn.ReadMessage()
		if err != nil {
			return err
		}

		e.handleRawMessage(message)
	}
}

func (e *EventSubClient) handleRawMessage(data []byte) {
	var meta struct {
		Metadata eventSubMetadata `json:"metadata"`
	}
	if err := json.Unmarshal(data, &meta); err != nil {
		return
	}

	switch meta.Metadata.MessageType {
	case "session_welcome":
		var welcome eventSubSessionPayload
		if err := json.Unmarshal(data, &welcome); err == nil {
			sessionID := welcome.Payload.Session.ID
			e.connMu.Lock()
			e.sessionID = sessionID
			e.connMu.Unlock()

			log.Printf("[EventSub] Session welcomed, ID: %s", sessionID)
			e.subscribeAllActiveChannels(sessionID)
		}

	case "session_reconnect":
		log.Printf("[EventSub] Reconnect requested by Twitch")
		e.connMu.Lock()
		if e.conn != nil {
			_ = e.conn.Close()
		}
		e.connMu.Unlock()

	case "session_keepalive":
		// Heartbeat received, connection is healthy

	case "notification":
		switch meta.Metadata.SubscriptionType {
		case "channel.channel_points_custom_reward_redemption.add":
			var notif eventSubNotificationPayload
			if err := json.Unmarshal(data, &notif); err == nil {
				e.handleRedemptionEvent(notif.Payload.Event)
			}
		case "channel.follow":
			var notif eventSubFollowNotificationPayload
			if err := json.Unmarshal(data, &notif); err == nil {
				e.handleFollowEvent(notif.Payload.Event)
			}
		}

	case "revocation":
		log.Printf("[EventSub] Subscription revoked: %s", string(data))
	}
}

func (e *EventSubClient) handleFollowEvent(ev eventSubFollowEvent) {
	dedupKey := fmt.Sprintf("follow:%s:%s", ev.BroadcasterUserID, ev.UserID)

	e.dedupCacheMu.Lock()
	now := time.Now()
	// Cleanup entries older than 5 minutes
	for k, t := range e.dedupCache {
		if now.Sub(t) > 5*time.Minute {
			delete(e.dedupCache, k)
		}
	}
	if _, exists := e.dedupCache[dedupKey]; exists {
		e.dedupCacheMu.Unlock()
		return
	}
	e.dedupCache[dedupKey] = now
	e.dedupCacheMu.Unlock()

	systemMsg := fmt.Sprintf("%s отслеживает канал!", ev.UserName)

	chatMsg := &ChatMessage{
		ID:          fmt.Sprintf("follow-%s-%s-%d", ev.BroadcasterUserID, ev.UserID, time.Now().UnixNano()),
		Channel:     ev.BroadcasterUserLogin,
		User:        ev.UserLogin,
		DisplayName: ev.UserName,
		Timestamp:   time.Now().Format("15:04:05"),
		IsEvent:     true,
		EventType:   "follow",
		SystemMsg:   systemMsg,
		EventData: map[string]string{
			"userId":               ev.UserID,
			"userLogin":            ev.UserLogin,
			"userName":             ev.UserName,
			"broadcasterUserId":    ev.BroadcasterUserID,
			"broadcasterUserLogin": ev.BroadcasterUserLogin,
			"followedAt":           ev.FollowedAt,
		},
	}

	if e.onMessage != nil {
		e.onMessage(chatMsg)
	} else if e.ctx != nil {
		runtime.EventsEmit(e.ctx, "chat:message", chatMsg)
	}
}

func (e *EventSubClient) handleRedemptionEvent(ev eventSubRewardEvent) {
	// Deduplicate
	dedupKey := ev.ID
	if dedupKey == "" {
		dedupKey = fmt.Sprintf("%s:%s:%s:%s", ev.BroadcasterUserID, ev.UserID, ev.Reward.ID, ev.RedeemedAt)
	}

	e.dedupCacheMu.Lock()
	now := time.Now()
	// Cleanup entries older than 2 minutes
	for k, t := range e.dedupCache {
		if now.Sub(t) > 2*time.Minute {
			delete(e.dedupCache, k)
		}
	}
	if _, exists := e.dedupCache[dedupKey]; exists {
		e.dedupCacheMu.Unlock()
		return
	}
	e.dedupCache[dedupKey] = now
	e.dedupCacheMu.Unlock()

	costStr := ""
	if ev.Reward.Cost > 0 {
		costStr = fmt.Sprintf(" за %d баллов", ev.Reward.Cost)
	}

	rewardTitle := ev.Reward.Title
	if rewardTitle == "" {
		rewardTitle = "Награда за баллы"
	}

	systemMsg := fmt.Sprintf("Заказ «%s»%s от %s", rewardTitle, costStr, ev.UserName)

	chatMsg := &ChatMessage{
		ID:          ev.ID,
		Channel:     ev.BroadcasterUserLogin,
		User:        ev.UserLogin,
		DisplayName: ev.UserName,
		Message:     ev.UserInput,
		Timestamp:   time.Now().Format("15:04:05"),
		IsEvent:     true,
		EventType:   "reward",
		SystemMsg:   systemMsg,
		EventData: map[string]string{
			"rewardId":    ev.Reward.ID,
			"rewardTitle": ev.Reward.Title,
			"rewardCost":  strconv.Itoa(ev.Reward.Cost),
			"rewardType":  "eventsub",
		},
	}

	if e.onMessage != nil {
		e.onMessage(chatMsg)
	} else if e.ctx != nil {
		runtime.EventsEmit(e.ctx, "chat:message", chatMsg)
	}
}

// IsDuplicateRedemption checks if an IRC reward message was already emitted by EventSub
func (e *EventSubClient) IsDuplicateRedemption(rewardID, user, message string) bool {
	e.dedupCacheMu.Lock()
	defer e.dedupCacheMu.Unlock()

	now := time.Now()
	for k, t := range e.dedupCache {
		if now.Sub(t) > 2*time.Minute {
			delete(e.dedupCache, k)
		}
	}

	// Check matching keys
	if rewardID != "" {
		for k := range e.dedupCache {
			if strings.Contains(k, rewardID) {
				return true
			}
		}
	}

	return false
}

func (e *EventSubClient) subscribeAllActiveChannels(sessionID string) {
	e.channelsMu.RLock()
	chans := make([]string, 0, len(e.channels))
	for ch := range e.channels {
		chans = append(chans, ch)
	}
	e.channelsMu.RUnlock()

	for _, ch := range chans {
		go e.subscribeForChannel(ch, sessionID)
	}
}

func (e *EventSubClient) subscribeForChannel(channelName, sessionID string) {
	if e.oauthToken == "" {
		return
	}

	broadcasterID, err := e.resolveUserID(channelName)
	if err != nil {
		log.Printf("[EventSub] Failed to resolve user ID for #%s: %v", channelName, err)
		return
	}

	// 1. Subscribe to channel points custom rewards
	e.createSubscription(sessionID, "channel.channel_points_custom_reward_redemption.add", "1", map[string]string{
		"broadcaster_user_id": broadcasterID,
	}, channelName, "channel points")

	// 2. Subscribe to channel follow events (v2 requires broadcaster_user_id & moderator_user_id)
	moderatorID := e.userID
	if moderatorID == "" {
		moderatorID = broadcasterID
	}
	e.createSubscription(sessionID, "channel.follow", "2", map[string]string{
		"broadcaster_user_id": broadcasterID,
		"moderator_user_id":   moderatorID,
	}, channelName, "follows")
}

func (e *EventSubClient) createSubscription(sessionID, subType, version string, condition map[string]string, channelName, label string) {
	reqBody := map[string]interface{}{
		"type":      subType,
		"version":   version,
		"condition": condition,
		"transport": map[string]string{
			"method":     "websocket",
			"session_id": sessionID,
		},
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return
	}

	req, err := http.NewRequest("POST", config.TwitchHelixEventSubSubscriptionsURL, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return
	}
	req.Header.Set("Authorization", "Bearer "+e.oauthToken)
	req.Header.Set("Client-Id", e.clientID)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[EventSub] %s subscription request failed for #%s: %v", label, channelName, err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusAccepted || resp.StatusCode == http.StatusOK {
		log.Printf("[EventSub] Successfully subscribed to %s for #%s (ID: %s)", label, channelName, condition["broadcaster_user_id"])
	} else {
		log.Printf("[EventSub] Subscription error for %s on #%s (HTTP %d)", label, channelName, resp.StatusCode)
	}
}

func (e *EventSubClient) resolveUserID(channelName string) (string, error) {
	ch := strings.ToLower(channelName)

	e.userCacheMu.RLock()
	if id, ok := e.userCache[ch]; ok {
		e.userCacheMu.RUnlock()
		return id, nil
	}
	e.userCacheMu.RUnlock()

	// If channel is the authenticated user and UserID is known
	if e.userID != "" {
		settings := config.LoadSettings()
		if strings.EqualFold(settings.Username, ch) {
			e.userCacheMu.Lock()
			e.userCache[ch] = e.userID
			e.userCacheMu.Unlock()
			return e.userID, nil
		}
	}

	// Fetch from Helix Users API
	url := fmt.Sprintf("%s?login=%s", config.TwitchHelixUsersURL, ch)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+e.oauthToken)
	req.Header.Set("Client-Id", e.clientID)

	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var userResp struct {
		Data []struct {
			ID    string `json:"id"`
			Login string `json:"login"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&userResp); err != nil {
		return "", err
	}

	if len(userResp.Data) == 0 {
		return "", fmt.Errorf("no user found for login %s", ch)
	}

	id := userResp.Data[0].ID
	e.userCacheMu.Lock()
	e.userCache[ch] = id
	e.userCacheMu.Unlock()

	return id, nil
}

func (e *EventSubClient) Reconnect() {
	e.connMu.Lock()
	if e.conn != nil {
		_ = e.conn.Close()
	}
	e.connMu.Unlock()
}
