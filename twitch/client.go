package twitch

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"strings"
	"sync"
	"time"

	"ReChat/config"

	"github.com/gorilla/websocket"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type ChatMessage struct {
	ID          string `json:"id"`
	Channel     string `json:"channel"`
	User        string `json:"user"`
	DisplayName string `json:"displayName"`
	Color       string `json:"color"`
	Message     string `json:"message"`
	Timestamp   string `json:"timestamp"`
	Badges      string `json:"badges"`
}

type Client struct {
	ctx         context.Context
	conn        *websocket.Conn
	connMu      sync.Mutex
	joinedChans map[string]bool
	isConnected bool
	stopChan    chan struct{}
}

func NewClient() *Client {
	return &Client{
		joinedChans: make(map[string]bool),
	}
}

func (c *Client) SetContext(ctx context.Context) {
	c.ctx = ctx
}

func (c *Client) ensureConnectedUnlocked() error {
	if c.isConnected && c.conn != nil {
		return nil
	}

	dialer := websocket.DefaultDialer
	conn, _, err := dialer.Dial(config.TwitchIRCWebSocketURL, nil)
	if err != nil {
		c.emitStatus("error", "", fmt.Sprintf("Connection failed: %v", err))
		return err
	}

	c.conn = conn
	c.isConnected = true
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

	go c.readLoop()

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
		return nil // Already joined
	}

	_ = c.conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("JOIN #%s", channel)))
	c.joinedChans[channel] = true

	c.emitStatus("joined", channel, fmt.Sprintf("Joined #%s", channel))
	c.emitChannelsUpdated()

	return nil
}

func (c *Client) LeaveChannel(channelName string) error {
	c.connMu.Lock()
	defer c.connMu.Unlock()

	channel := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(channelName), "#"))
	if channel == "" || !c.joinedChans[channel] {
		return nil
	}

	if c.conn != nil {
		_ = c.conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("PART #%s", channel)))
	}
	delete(c.joinedChans, channel)

	c.emitStatus("left", channel, fmt.Sprintf("Left #%s", channel))
	c.emitChannelsUpdated()

	return nil
}

func (c *Client) GetJoinedChannels() []string {
	c.connMu.Lock()
	defer c.connMu.Unlock()

	list := make([]string, 0, len(c.joinedChans))
	for ch := range c.joinedChans {
		list = append(list, ch)
	}
	return list
}

func (c *Client) Disconnect() {
	c.connMu.Lock()
	defer c.connMu.Unlock()
	c.disconnectUnlocked()
}

func (c *Client) disconnectUnlocked() {
	if !c.isConnected {
		return
	}
	c.isConnected = false
	if c.stopChan != nil {
		close(c.stopChan)
	}
	if c.conn != nil {
		for ch := range c.joinedChans {
			_ = c.conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("PART #%s", ch)))
		}
		_ = c.conn.Close()
		c.conn = nil
	}
	c.joinedChans = make(map[string]bool)
	c.emitStatus("disconnected", "", "Disconnected")
	c.emitChannelsUpdated()
}

func (c *Client) readLoop() {
	defer func() {
		c.connMu.Lock()
		if c.isConnected {
			c.disconnectUnlocked()
		} else {
			c.connMu.Unlock()
		}
	}()

	for {
		select {
		case <-c.stopChan:
			return
		default:
			_, msgBytes, err := c.conn.ReadMessage()
			if err != nil {
				log.Printf("Read error: %v", err)
				return
			}

			lines := strings.Split(string(msgBytes), "\r\n")
			for _, line := range lines {
				line = strings.TrimSpace(line)
				if line == "" {
					continue
				}

				if strings.HasPrefix(line, "PING") {
					c.connMu.Lock()
					if c.conn != nil {
						_ = c.conn.WriteMessage(websocket.TextMessage, []byte("PONG :tmi.twitch.tv"))
					}
					c.connMu.Unlock()
					continue
				}

				if strings.Contains(line, "PRIVMSG") {
					msg := c.parsePrivMsg(line)
					if msg != nil && c.ctx != nil {
						runtime.EventsEmit(c.ctx, "chat:message", msg)
					}
				}
			}
		}
	}
}

func (c *Client) parsePrivMsg(raw string) *ChatMessage {
	msg := &ChatMessage{
		Timestamp: time.Now().Format("15:04:05"),
	}

	tags := ""
	rest := raw

	if strings.HasPrefix(raw, "@") {
		parts := strings.SplitN(raw[1:], " ", 2)
		if len(parts) == 2 {
			tags = parts[0]
			rest = parts[1]
		}
	}

	// Parse tags
	if tags != "" {
		tagPairs := strings.Split(tags, ";")
		for _, pair := range tagPairs {
			kv := strings.SplitN(pair, "=", 2)
			if len(kv) == 2 {
				key, val := kv[0], kv[1]
				switch key {
				case "display-name":
					msg.DisplayName = val
				case "color":
					msg.Color = val
				case "id":
					msg.ID = val
				case "badges":
					msg.Badges = val
				}
			}
		}
	}

	// Extract Username, Channel, and Message text
	// rest format: :user!user@user.tmi.twitch.tv PRIVMSG #channel :Message content
	if idx := strings.Index(rest, " PRIVMSG "); idx != -1 {
		prefix := rest[:idx]
		if strings.HasPrefix(prefix, ":") {
			userEnd := strings.Index(prefix, "!")
			if userEnd != -1 {
				msg.User = prefix[1:userEnd]
			}
		}
		if msg.DisplayName == "" {
			msg.DisplayName = msg.User
		}

		afterPrivmsg := rest[idx+9:] // after " PRIVMSG "
		msgStart := strings.Index(afterPrivmsg, " :")
		if msgStart != -1 {
			msg.Channel = strings.TrimPrefix(afterPrivmsg[:msgStart], "#")
			msg.Message = afterPrivmsg[msgStart+2:]
		}
	}

	if msg.Message == "" {
		return nil
	}

	return msg
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
