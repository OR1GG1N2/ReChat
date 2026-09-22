package twitch

import (
	"context"
	"fmt"
	"math/rand"
	"strings"
	"sync"
	"time"

	"ReChat/config"
	"ReChat/proxy"

	"github.com/gorilla/websocket"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type ChatMessage struct {
	ID          string            `json:"id"`
	Platform    string            `json:"platform,omitempty"` // "twitch" or "kick"
	Channel     string            `json:"channel"`
	User        string            `json:"user"`
	DisplayName string            `json:"displayName"`
	Color       string            `json:"color"`
	Message     string            `json:"message"`
	Timestamp   string            `json:"timestamp"`
	Badges      string            `json:"badges"`
	EmoteMap    map[string]string `json:"emoteMap,omitempty"`
	IsEvent     bool              `json:"isEvent,omitempty"`
	EventType   string            `json:"eventType,omitempty"`   // "sub", "resub", "subgift", "raid", "cheer", "announcement", "timeout", "ban", "clearchat", "reward", "hypetrain", "shoutout", "notice", "intro"
	SystemMsg   string            `json:"systemMsg,omitempty"`
	EventData   map[string]string `json:"eventData,omitempty"`
	IsFirstMsg  bool              `json:"isFirstMsg,omitempty"`
}

type Client struct {
	ctx          context.Context
	conn         *websocket.Conn
	connMu       sync.Mutex
	joinedChans  map[string]bool
	isConnected  bool
	stopChan     chan struct{}
	onMessage    func(*ChatMessage)
	rewardFilter func(*ChatMessage) bool
	parser       *IRCParser
}

func NewClient() *Client {
	return &Client{
		joinedChans: make(map[string]bool),
		parser:      NewIRCParser(),
	}
}

// SetMessageHandler sets a callback called for every chat message (including IRC and system events).
func (c *Client) SetMessageHandler(fn func(*ChatMessage)) {
	c.onMessage = fn
}

func (c *Client) SetRewardFilter(fn func(*ChatMessage) bool) {
	c.connMu.Lock()
	defer c.connMu.Unlock()
	c.rewardFilter = fn
}

func (c *Client) SetContext(ctx context.Context) {
	c.ctx = ctx
}

func (c *Client) ensureConnectedUnlocked() error {
	if c.isConnected && c.conn != nil {
		return nil
	}

	dialer := proxy.GetWebSocketDialer()
	conn, _, err := dialer.Dial(config.TwitchIRCWebSocketURL, nil)
	if err != nil {
		c.emitStatus("error", "", fmt.Sprintf("Connection failed: %v", err))
		return err
	}

	c.conn = conn
	c.isConnected = true
	if c.stopChan != nil {
		close(c.stopChan)
	}
	c.stopChan = make(chan struct{})

	// Request capabilities (tags, commands, membership)
	_ = conn.WriteMessage(websocket.TextMessage, []byte("CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership"))

	// Authentication: Authenticated user vs Anonymous user
	settings := config.LoadSettings()
	if settings.OAuthToken != "" && settings.Username != "" {
		token := strings.TrimPrefix(settings.OAuthToken, "oauth:")
		_ = conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("PASS oauth:%s", token)))
		_ = conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("NICK %s", strings.ToLower(settings.Username))))
	} else {
		randNum := rand.Intn(89999) + 10000
		anonUser := fmt.Sprintf("justinfan%d", randNum)
		_ = conn.WriteMessage(websocket.TextMessage, []byte("PASS SCHMETTERLING"))
		_ = conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("NICK %s", anonUser)))
	}

	c.emitStatus("connected", "", "Connected to Twitch IRC server")

	go c.readLoop(conn)

	return nil
}

func (c *Client) JoinChannel(channelName string) error {
	c.connMu.Lock()
	defer c.connMu.Unlock()

	channel := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(channelName), "#"))
	if channel == "" {
		return fmt.Errorf("channel name cannot be empty")
	}

	if err := c.ensureConnectedUnlocked(); err != nil {
		return err
	}

	if c.joinedChans[channel] {
		return nil
	}

	if c.conn != nil {
		err := c.conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("JOIN #%s", channel)))
		if err != nil {
			return err
		}
	}

	c.joinedChans[channel] = true
	c.emitChannelsUpdated()
	c.emitStatus("joined", channel, fmt.Sprintf("Joined channel #%s", channel))

	// Save to persistent settings
	settings := config.LoadSettings()
	exists := false
	for _, ch := range settings.JoinedChannels {
		if strings.ToLower(ch) == channel {
			exists = true
			break
		}
	}
	if !exists {
		settings.JoinedChannels = append(settings.JoinedChannels, channel)
		_ = config.SaveSettings(settings)
	}

	return nil
}

func (c *Client) LeaveChannel(channelName string) error {
	c.connMu.Lock()
	defer c.connMu.Unlock()

	channel := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(channelName), "#"))
	if channel == "" {
		return fmt.Errorf("channel name cannot be empty")
	}

	if c.conn != nil && c.joinedChans[channel] {
		_ = c.conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("PART #%s", channel)))
	}

	delete(c.joinedChans, channel)
	c.emitChannelsUpdated()
	c.emitStatus("parted", channel, fmt.Sprintf("Left channel #%s", channel))

	// Update persistent settings
	settings := config.LoadSettings()
	newChans := make([]string, 0, len(settings.JoinedChannels))
	for _, ch := range settings.JoinedChannels {
		if strings.ToLower(ch) != channel {
			newChans = append(newChans, ch)
		}
	}
	settings.JoinedChannels = newChans
	_ = config.SaveSettings(settings)

	return nil
}

// SendMessage sends a message to the specified Twitch channel via IRC PRIVMSG
func (c *Client) SendMessage(channelName, message string) error {
	c.connMu.Lock()
	defer c.connMu.Unlock()

	channel := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(channelName), "#"))
	if channel == "" {
		return fmt.Errorf("channel name cannot be empty")
	}

	trimmedMsg := strings.TrimSpace(message)
	if trimmedMsg == "" {
		return fmt.Errorf("message cannot be empty")
	}

	settings := config.LoadSettings()
	if settings.OAuthToken == "" || settings.Username == "" {
		return fmt.Errorf("требуется авторизация через Twitch для отправки сообщений")
	}

	if err := c.ensureConnectedUnlocked(); err != nil {
		return err
	}

	if c.conn == nil {
		return fmt.Errorf("not connected to Twitch IRC")
	}

	ircCmd := fmt.Sprintf("PRIVMSG #%s :%s", channel, trimmedMsg)
	if err := c.conn.WriteMessage(websocket.TextMessage, []byte(ircCmd)); err != nil {
		return fmt.Errorf("failed to send message: %w", err)
	}

	// Optimistically emit the sent message to local chat UI
	now := time.Now().Format("15:04:05")
	localMsg := ChatMessage{
		ID:          fmt.Sprintf("local-%d", time.Now().UnixNano()),
		Channel:     channel,
		User:        settings.Username,
		DisplayName: settings.Username,
		Color:       "#3B82F6",
		Message:     trimmedMsg,
		Timestamp:   now,
	}
	if c.ctx != nil {
		runtime.EventsEmit(c.ctx, "chat:message", localMsg)
	}
	if c.onMessage != nil {
		c.onMessage(&localMsg)
	}

	return nil
}

func (c *Client) ReconnectWithAuth() error {
	c.connMu.Lock()
	defer c.connMu.Unlock()

	if c.conn != nil {
		_ = c.conn.Close()
		c.conn = nil
		c.isConnected = false
	}

	// ensureConnectedUnlocked starts a new readLoop goroutine which will
	// re-join all channels once IRC registration (001/376) is received.
	// Do NOT send JOIN here — they race against authentication and are dropped.
	return c.ensureConnectedUnlocked()
}

func (c *Client) GetJoinedChannels() []string {
	c.connMu.Lock()
	defer c.connMu.Unlock()

	channels := make([]string, 0, len(c.joinedChans))
	for ch := range c.joinedChans {
		channels = append(channels, ch)
	}
	return channels
}

func (c *Client) AutoJoinStoredChannels() {
	settings := config.LoadSettings()
	if len(settings.JoinedChannels) > 0 {
		for _, ch := range settings.JoinedChannels {
			_ = c.JoinChannel(ch)
		}
	} else if settings.DefaultChannel != "" {
		_ = c.JoinChannel(settings.DefaultChannel)
	}
}

func (c *Client) readLoop(conn *websocket.Conn) {
	for {
		_, messageBytes, err := conn.ReadMessage()
		if err != nil {
			c.connMu.Lock()
			if c.conn == conn {
				c.conn = nil
				c.isConnected = false
				c.emitStatus("disconnected", "", "Connection closed")
			}
			c.connMu.Unlock()
			return
		}

		rawLines := strings.Split(string(messageBytes), "\r\n")
		for _, line := range rawLines {
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}

			if strings.HasPrefix(line, "PING") {
				c.connMu.Lock()
				if c.conn == conn {
					_ = conn.WriteMessage(websocket.TextMessage, []byte("PONG :tmi.twitch.tv"))
				}
				c.connMu.Unlock()
				continue
			}

			// On successful IRC registration / welcome, join active channels
			if strings.Contains(line, " 001 ") || strings.Contains(line, " 376 ") || strings.Contains(line, "GLOBALUSERSTATE") {
				c.connMu.Lock()
				if c.conn == conn {
					for ch := range c.joinedChans {
						_ = conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("JOIN #%s", ch)))
					}
				}
				c.connMu.Unlock()
			}

			msg := c.parser.Parse(line)
			if msg != nil {
				if msg.EventType == "reward" {
					c.connMu.Lock()
					filter := c.rewardFilter
					c.connMu.Unlock()
					if filter != nil && filter(msg) {
						// Suppress duplicate reward from IRC because EventSub is active and handling it
						continue
					}
				}
				if c.ctx != nil {
					runtime.EventsEmit(c.ctx, "chat:message", msg)
				}
				if c.onMessage != nil {
					c.onMessage(msg)
				}
			}
		}
	}
}

func (c *Client) emitStatus(status, channel, message string) {
	if c.ctx != nil {
		runtime.EventsEmit(c.ctx, "chat:status", map[string]string{
			"status":  status,
			"channel": channel,
			"message": message,
		})
	}
}

func (c *Client) emitChannelsUpdated() {
	if c.ctx != nil {
		channels := make([]string, 0, len(c.joinedChans))
		for ch := range c.joinedChans {
			channels = append(channels, ch)
		}
		runtime.EventsEmit(c.ctx, "channels:updated", channels)
	}
}

func (c *Client) Disconnect() {
	c.connMu.Lock()
	defer c.connMu.Unlock()

	if c.stopChan != nil {
		close(c.stopChan)
		c.stopChan = nil
	}

	if c.conn != nil {
		_ = c.conn.Close()
		c.conn = nil
	}
	c.isConnected = false
	c.joinedChans = make(map[string]bool)
	c.emitChannelsUpdated()
	c.emitStatus("disconnected", "", "Disconnected from Twitch")
}


