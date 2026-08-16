package twitch

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"strings"
	"sync"
	"time"

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
	ctx        context.Context
	conn       *websocket.Conn
	connMu     sync.Mutex
	channel    string
	isConnected bool
	stopChan   chan struct{}
}

func NewClient() *Client {
	return &Client{}
}

func (c *Client) SetContext(ctx context.Context) {
	c.ctx = ctx
}

func (c *Client) Connect(channelName string) error {
	c.connMu.Lock()
	defer c.connMu.Unlock()

	if c.isConnected {
		c.disconnectUnlocked()
	}

	channel := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(channelName), "#"))
	if channel == "" {
		return fmt.Errorf("channel name cannot be empty")
	}

	c.emitStatus("connecting", channel, "Connecting to Twitch chat...")

	dialer := websocket.DefaultDialer
	conn, _, err := dialer.Dial("wss://irc-ws.chat.twitch.tv:443", nil)
	if err != nil {
		c.emitStatus("error", channel, fmt.Sprintf("Connection failed: %v", err))
		return err
	}

	c.conn = conn
	c.channel = channel
	c.isConnected = true
	c.stopChan = make(chan struct{})

	// Request capabilities (tags, commands, membership)
	_ = conn.WriteMessage(websocket.TextMessage, []byte("CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership"))
	
	// Anonymous authentication
	randNum := rand.Intn(89999) + 10000
	anonUser := fmt.Sprintf("justinfan%d", randNum)
	_ = conn.WriteMessage(websocket.TextMessage, []byte("PASS SCHMETTERLING"))
	_ = conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("NICK %s", anonUser)))
	_ = conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("JOIN #%s", channel)))

	c.emitStatus("connected", channel, fmt.Sprintf("Connected to #%s", channel))

	go c.readLoop()

	return nil
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
		_ = c.conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("PART #%s", c.channel)))
		_ = c.conn.Close()
		c.conn = nil
	}
	c.emitStatus("disconnected", c.channel, "Disconnected")
	c.channel = ""
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
		Channel:   c.channel,
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

	// Extract Username and Message text
	// rest example: :user!user@user.tmi.twitch.tv PRIVMSG #channel :Message content
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

		msgStart := strings.Index(rest[idx:], " :")
		if msgStart != -1 {
			msg.Message = rest[idx+msgStart+2:]
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
