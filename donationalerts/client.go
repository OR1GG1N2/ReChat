package donationalerts

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
)

// DonationEvent represents an incoming donation from DonationAlerts.
type DonationEvent struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	Amount    float64   `json:"amount"`
	Currency  string    `json:"currency"`
	Message   string    `json:"message"`
	CreatedAt time.Time `json:"createdAt"`
}

// GoalEvent represents a donation goal (сбор средств).
type GoalEvent struct {
	ID            int64   `json:"id"`
	Title         string  `json:"title"`
	CurrentAmount float64 `json:"currentAmount"`
	TargetAmount  float64 `json:"targetAmount"`
	Currency      string  `json:"currency"`
	Percent       float64 `json:"percent"`
	IsActive      bool    `json:"isActive"`
}

type UserInfo struct {
	ID                    int64  `json:"id"`
	Code                  string `json:"code"`
	Name                  string `json:"name"`
	Avatar                string `json:"avatar"`
	SocketConnectionToken string `json:"socket_connection_token"`
}

// Client manages connection to DonationAlerts REST API and Centrifugo WebSocket.
type Client struct {
	mu           sync.RWMutex
	token        string
	userID       int64
	userName     string
	conn         *websocket.Conn
	stopChan     chan struct{}
	running      bool
	connected    bool
	currentGoal  *GoalEvent
	onDonation   func(DonationEvent)
	onGoalUpdate func(GoalEvent)
	onStatus     func(bool, string)
	httpClient   *http.Client
	nextReqID    int64
}

// NewClient creates a new DonationAlerts client.
func NewClient(token string) *Client {
	return &Client{
		token: strings.TrimSpace(token),
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

// SetCallbacks registers event handlers.
func (c *Client) SetCallbacks(
	onDonation func(DonationEvent),
	onGoalUpdate func(GoalEvent),
	onStatus func(bool, string),
) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.onDonation = onDonation
	c.onGoalUpdate = onGoalUpdate
	c.onStatus = onStatus
}

// SetToken updates the client token and restarts connection if active.
func (c *Client) SetToken(token string) {
	c.mu.Lock()
	c.token = strings.TrimSpace(token)
	wasRunning := c.running
	c.mu.Unlock()

	if wasRunning {
		c.Stop()
		if c.token != "" {
			c.Start()
		}
	}
}

// CurrentGoal returns the latest known goal state.
func (c *Client) CurrentGoal() *GoalEvent {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.currentGoal
}

// IsConnected returns whether the websocket is currently connected.
func (c *Client) IsConnected() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.connected
}

// TestConnection checks if a given token is valid by fetching user profile.
func (c *Client) TestConnection(token string) (bool, string, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return false, "", errors.New("токен не указан")
	}

	user, err := c.fetchUserInfo(token)
	if err != nil {
		return false, "", err
	}

	displayName := user.Name
	if displayName == "" {
		displayName = user.Code
	}
	return true, displayName, nil
}

// Start begins the background websocket connection loop.
func (c *Client) Start() {
	c.mu.Lock()
	if c.running {
		c.mu.Unlock()
		return
	}
	if c.token == "" {
		c.mu.Unlock()
		return
	}
	c.running = true
	c.stopChan = make(chan struct{})
	c.mu.Unlock()

	go c.runLoop()
	go c.goalPollingLoop()
}

// Stop terminates the connection.
func (c *Client) Stop() {
	c.mu.Lock()
	if !c.running {
		c.mu.Unlock()
		return
	}
	c.running = false
	c.connected = false
	if c.stopChan != nil {
		close(c.stopChan)
	}
	if c.conn != nil {
		_ = c.conn.Close()
	}
	statusCb := c.onStatus
	c.mu.Unlock()

	if statusCb != nil {
		statusCb(false, "Отключено")
	}
}

func (c *Client) runLoop() {
	backoff := 3 * time.Second

	for {
		c.mu.RLock()
		running := c.running
		token := c.token
		c.mu.RUnlock()

		if !running || token == "" {
			return
		}

		err := c.connectAndServe(token)
		if err != nil {
			log.Printf("[DonationAlerts] Connection error: %v", err)
			c.setConnected(false, fmt.Sprintf("Ошибка: %v", err))
		}

		select {
		case <-c.stopChan:
			return
		case <-time.After(backoff):
			// retry
		}
	}
}

func (c *Client) goalPollingLoop() {
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	// Initial fetch
	c.fetchAndEmitGoals()

	for {
		select {
		case <-c.stopChan:
			return
		case <-ticker.C:
			c.fetchAndEmitGoals()
		}
	}
}

func (c *Client) setConnected(connected bool, msg string) {
	c.mu.Lock()
	c.connected = connected
	cb := c.onStatus
	c.mu.Unlock()

	if cb != nil {
		cb(connected, msg)
	}
}

func (c *Client) fetchUserInfo(token string) (*UserInfo, error) {
	req, err := http.NewRequestWithContext(context.Background(), "GET", "https://www.donationalerts.com/api/v1/user/oauth", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("сетевая ошибка: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == 401 || resp.StatusCode == 403 {
		return nil, errors.New("неверный или истёкший токен DonationAlerts")
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ошибка сервера DonationAlerts (%d)", resp.StatusCode)
	}

	var parsed struct {
		Data struct {
			ID                    int64  `json:"id"`
			Code                  string `json:"code"`
			Name                  string `json:"name"`
			Avatar                string `json:"avatar"`
			SocketConnectionToken string `json:"socket_connection_token"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, fmt.Errorf("ошибка парсинга ответа: %w", err)
	}

	return &UserInfo{
		ID:                    parsed.Data.ID,
		Code:                  parsed.Data.Code,
		Name:                  parsed.Data.Name,
		Avatar:                parsed.Data.Avatar,
		SocketConnectionToken: parsed.Data.SocketConnectionToken,
	}, nil
}

func (c *Client) fetchAndEmitGoals() {
	c.mu.RLock()
	token := c.token
	running := c.running
	goalCb := c.onGoalUpdate
	c.mu.RUnlock()

	if !running || token == "" {
		return
	}

	req, err := http.NewRequestWithContext(context.Background(), "GET", "https://www.donationalerts.com/api/v1/donation_goals", nil)
	if err != nil {
		return
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return
	}

	var parsed struct {
		Data []struct {
			ID           int64   `json:"id"`
			Title        string  `json:"title"`
			RaisedAmount float64 `json:"raised_amount"`
			TargetAmount float64 `json:"target_amount"`
			Currency     string  `json:"currency"`
			IsActive     int     `json:"is_active"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return
	}

	for _, g := range parsed.Data {
		if g.IsActive != 0 || len(parsed.Data) == 1 {
			var pct float64
			if g.TargetAmount > 0 {
				pct = (g.RaisedAmount / g.TargetAmount) * 100.0
				if pct > 100.0 {
					pct = 100.0
				}
			}
			event := GoalEvent{
				ID:            g.ID,
				Title:         g.Title,
				CurrentAmount: g.RaisedAmount,
				TargetAmount:  g.TargetAmount,
				Currency:      g.Currency,
				Percent:       pct,
				IsActive:      true,
			}

			c.mu.Lock()
			c.currentGoal = &event
			c.mu.Unlock()

			if goalCb != nil {
				goalCb(event)
			}
			break
		}
	}
}

func (c *Client) connectAndServe(token string) error {
	c.setConnected(false, "Получение профиля...")

	user, err := c.fetchUserInfo(token)
	if err != nil {
		return err
	}

	c.mu.Lock()
	c.userID = user.ID
	c.userName = user.Name
	c.mu.Unlock()

	c.setConnected(false, "Подключение к Centrifugo...")

	dialer := websocket.Dialer{
		HandshakeTimeout: 10 * time.Second,
	}

	wsURL := "wss://centrifugo.donationalerts.com/connection/websocket"
	conn, _, err := dialer.Dial(wsURL, nil)
	if err != nil {
		return fmt.Errorf("websocket dial error: %w", err)
	}
	defer conn.Close()

	c.mu.Lock()
	c.conn = conn
	c.mu.Unlock()

	// Step 1: Send Connect frame with socket_connection_token
	reqID := atomic.AddInt64(&c.nextReqID, 1)
	connectFrame := map[string]interface{}{
		"params": map[string]interface{}{
			"token": user.SocketConnectionToken,
		},
		"id": reqID,
	}
	if err := conn.WriteJSON(connectFrame); err != nil {
		return fmt.Errorf("write connect frame: %w", err)
	}

	// Step 2: Read connect response to get client_id
	var connectResp struct {
		ID     int64 `json:"id"`
		Result struct {
			Client  string `json:"client"`
			Version string `json:"version"`
		} `json:"result"`
	}

	_, message, err := conn.ReadMessage()
	if err != nil {
		return fmt.Errorf("read connect response: %w", err)
	}

	if err := json.Unmarshal(message, &connectResp); err != nil {
		return fmt.Errorf("parse connect response: %w", err)
	}

	clientID := connectResp.Result.Client
	if clientID == "" {
		return errors.New("empty client ID from Centrifugo")
	}

	// Step 3: Request subscription token from DonationAlerts API
	channelName := fmt.Sprintf("$alerts:donation_%d", user.ID)
	subToken, err := c.requestSubToken(token, clientID, channelName)
	if err != nil {
		return fmt.Errorf("subscribe token error: %w", err)
	}

	// Step 4: Send Subscribe frame to Centrifugo
	subReqID := atomic.AddInt64(&c.nextReqID, 1)
	subFrame := map[string]interface{}{
		"params": map[string]interface{}{
			"channel": channelName,
			"token":   subToken,
		},
		"method": 1,
		"id":     subReqID,
	}
	if err := conn.WriteJSON(subFrame); err != nil {
		return fmt.Errorf("write subscribe frame: %w", err)
	}

	c.setConnected(true, fmt.Sprintf("Подключено (@%s)", user.Name))

	// Fetch current goals
	go c.fetchAndEmitGoals()

	// Step 5: Read loop
	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			return err
		}

		trimmed := bytes.TrimSpace(msg)
		if len(trimmed) == 0 || bytes.Equal(trimmed, []byte("{}")) {
			// Ping-pong: Centrifugo heartbeat
			_ = conn.WriteMessage(websocket.TextMessage, []byte("{}"))
			continue
		}

		c.handleCentrifugoMessage(trimmed)
	}
}

func (c *Client) requestSubToken(token, clientID, channel string) (string, error) {
	bodyData := map[string]interface{}{
		"channels": []string{channel},
		"client":   clientID,
	}
	bodyBytes, _ := json.Marshal(bodyData)

	req, err := http.NewRequestWithContext(context.Background(), "POST", "https://www.donationalerts.com/api/v1/centrifuge/subscribe", bytes.NewReader(bodyBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("subscribe api returned %d: %s", resp.StatusCode, string(respBody))
	}

	var res struct {
		Channels []struct {
			Channel string `json:"channel"`
			Token   string `json:"token"`
		} `json:"channels"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return "", err
	}

	for _, ch := range res.Channels {
		if ch.Channel == channel {
			return ch.Token, nil
		}
	}

	return "", errors.New("channel token not found in response")
}

func (c *Client) handleCentrifugoMessage(data []byte) {
	// Root Centrifugo message structure
	var root struct {
		Result struct {
			Channel string          `json:"channel"`
			Data    json.RawMessage `json:"data"`
		} `json:"result"`
	}

	if err := json.Unmarshal(data, &root); err != nil {
		return
	}

	if len(root.Result.Data) == 0 {
		return
	}

	// Payload data inside Centrifugo publication:
	// DA sends `{"data": {...donation fields...}}`
	var payload struct {
		Data struct {
			ID              interface{} `json:"id"`
			Name            string      `json:"name"`
			Username        string      `json:"username"`
			Amount          interface{} `json:"amount"`
			AmountFormatted string      `json:"amount_formatted"`
			Currency        string      `json:"currency"`
			Message         string      `json:"message"`
			CreatedAt       string      `json:"created_at"`
		} `json:"data"`
	}

	if err := json.Unmarshal(root.Result.Data, &payload); err != nil {
		return
	}

	d := payload.Data
	donorName := d.Name
	if donorName == "" {
		donorName = d.Username
	}
	if donorName == "" {
		donorName = "Аноним"
	}

	var amount float64
	switch v := d.Amount.(type) {
	case float64:
		amount = v
	case string:
		amount, _ = strconv.ParseFloat(v, 64)
	}

	var id int64
	switch v := d.ID.(type) {
	case float64:
		id = int64(v)
	case string:
		id, _ = strconv.ParseInt(v, 10, 64)
	}

	currency := d.Currency
	if currency == "" {
		currency = "RUB"
	}

	event := DonationEvent{
		ID:        id,
		Name:      donorName,
		Amount:    amount,
		Currency:  currency,
		Message:   d.Message,
		CreatedAt: time.Now(),
	}

	c.mu.RLock()
	cb := c.onDonation
	c.mu.RUnlock()

	if cb != nil {
		cb(event)
	}

	// Refresh goals upon receiving a donation
	go c.fetchAndEmitGoals()
}
