package twitch

import (
	"context"
	"fmt"
	"math/rand"
	"strconv"
	"strings"
	"sync"
	"time"

	"ReChat/config"

	"github.com/gorilla/websocket"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type ChatMessage struct {
	ID          string            `json:"id"`
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

func (c *Client) ReconnectWithAuth() error {
	c.connMu.Lock()
	defer c.connMu.Unlock()

	if c.conn != nil {
		_ = c.conn.Close()
		c.conn = nil
		c.isConnected = false
	}

	if err := c.ensureConnectedUnlocked(); err != nil {
		return err
	}

	for ch := range c.joinedChans {
		_ = c.conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("JOIN #%s", ch)))
	}

	return nil
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

func (c *Client) readLoop() {
	for {
		c.connMu.Lock()
		conn := c.conn
		c.connMu.Unlock()

		if conn == nil {
			return
		}

		_, messageBytes, err := conn.ReadMessage()
		if err != nil {
			c.connMu.Lock()
			if c.isConnected {
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
				if c.conn != nil {
					_ = c.conn.WriteMessage(websocket.TextMessage, []byte("PONG :tmi.twitch.tv"))
				}
				c.connMu.Unlock()
				continue
			}

			if strings.Contains(line, "USERNOTICE") {
				msg := c.parseUserNotice(line)
				if msg != nil && c.ctx != nil {
					runtime.EventsEmit(c.ctx, "chat:message", msg)
				}
			} else if strings.Contains(line, "CLEARCHAT") {
				msg := c.parseClearChat(line)
				if msg != nil && c.ctx != nil {
					runtime.EventsEmit(c.ctx, "chat:message", msg)
				}
			} else if strings.Contains(line, "CLEARMSG") {
				msg := c.parseClearMsg(line)
				if msg != nil && c.ctx != nil {
					runtime.EventsEmit(c.ctx, "chat:message", msg)
				}
			} else if strings.Contains(line, "NOTICE") && !strings.Contains(line, "USERNOTICE") {
				msg := c.parseNotice(line)
				if msg != nil && c.ctx != nil {
					runtime.EventsEmit(c.ctx, "chat:message", msg)
				}
			} else if strings.Contains(line, "PRIVMSG") {
				msg := c.parsePrivMsg(line)
				if msg != nil && c.ctx != nil {
					runtime.EventsEmit(c.ctx, "chat:message", msg)
				}
			}
		}
	}
}

func (c *Client) parseUserNotice(raw string) *ChatMessage {
	msg := &ChatMessage{
		Timestamp: time.Now().Format("15:04:05"),
		IsEvent:   true,
		EventData: make(map[string]string),
	}

	tags := ""
	rest := raw
	msgEmotesTag := ""

	if strings.HasPrefix(raw, "@") {
		parts := strings.SplitN(raw[1:], " ", 2)
		if len(parts) == 2 {
			tags = parts[0]
			rest = parts[1]
		}
	}

	if tags != "" {
		tagPairs := strings.Split(tags, ";")
		for _, pair := range tagPairs {
			kv := strings.SplitN(pair, "=", 2)
			if len(kv) == 2 {
				key, val := kv[0], kv[1]
				switch key {
				case "msg-id":
					msg.EventType = val
				case "display-name":
					msg.DisplayName = val
				case "login":
					msg.User = val
				case "color":
					msg.Color = val
				case "id":
					msg.ID = val
				case "badges":
					msg.Badges = val
				case "emotes":
					msgEmotesTag = val
				case "system-msg":
					unescaped := strings.ReplaceAll(val, `\s`, " ")
					unescaped = strings.ReplaceAll(unescaped, `\r`, "\r")
					unescaped = strings.ReplaceAll(unescaped, `\n`, "\n")
					unescaped = strings.ReplaceAll(unescaped, `\:`, ":")
					msg.SystemMsg = unescaped
				default:
					if strings.HasPrefix(key, "msg-param-") {
						paramKey := strings.TrimPrefix(key, "msg-param-")
						msg.EventData[paramKey] = val
					}
				}
			}
		}
	}

	// Extract Channel and user message text if present
	if idx := strings.Index(rest, " USERNOTICE "); idx != -1 {
		afterNotice := rest[idx+12:]
		msgStart := strings.Index(afterNotice, " :")
		if msgStart != -1 {
			msg.Channel = strings.TrimPrefix(afterNotice[:msgStart], "#")
			msg.Message = afterNotice[msgStart+2:]
		} else {
			msg.Channel = strings.TrimPrefix(strings.TrimSpace(afterNotice), "#")
		}
	}

	if msg.EventType == "" {
		msg.EventType = "notice"
	}
	if msg.DisplayName == "" {
		msg.DisplayName = msg.User
	}

	// Format Fallback System Messages
	if msg.SystemMsg == "" {
		switch msg.EventType {
		case "sub":
			tier := msg.EventData["sub-plan"]
			if tier == "Prime" {
				msg.SystemMsg = fmt.Sprintf("%s subscribed with Prime!", msg.DisplayName)
			} else {
				msg.SystemMsg = fmt.Sprintf("%s subscribed at Tier %s!", msg.DisplayName, tierToName(tier))
			}
		case "resub":
			months := msg.EventData["cumulative-months"]
			streak := msg.EventData["streak-months"]
			if streak != "" && streak != "0" {
				msg.SystemMsg = fmt.Sprintf("%s resubscribed for %s months (%s month streak)!", msg.DisplayName, months, streak)
			} else if months != "" {
				msg.SystemMsg = fmt.Sprintf("%s resubscribed for %s months!", msg.DisplayName, months)
			} else {
				msg.SystemMsg = fmt.Sprintf("%s resubscribed!", msg.DisplayName)
			}
		case "subgift", "anonsubgift":
			recipient := msg.EventData["recipient-display-name"]
			if recipient == "" {
				recipient = msg.EventData["recipient-user-name"]
			}
			gifter := msg.DisplayName
			if msg.EventType == "anonsubgift" || gifter == "" {
				gifter = "An anonymous gifter"
			}
			msg.SystemMsg = fmt.Sprintf("%s gifted a sub to %s!", gifter, recipient)
		case "submysterygift":
			massCount := msg.EventData["mass-gift-count"]
			msg.SystemMsg = fmt.Sprintf("%s is gifting %s random subscriptions in the channel!", msg.DisplayName, massCount)
		case "raid":
			viewers := msg.EventData["viewerCount"]
			if viewers != "" {
				msg.SystemMsg = fmt.Sprintf("%s is raiding with a party of %s viewers!", msg.DisplayName, viewers)
			} else {
				msg.SystemMsg = fmt.Sprintf("%s is raiding the channel!", msg.DisplayName)
			}
		case "announcement":
			msg.SystemMsg = fmt.Sprintf("Announcement from %s", msg.DisplayName)
		case "bitsbadgetier":
			threshold := msg.EventData["threshold"]
			msg.SystemMsg = fmt.Sprintf("%s unlocked the %s Bits badge!", msg.DisplayName, threshold)
		case "viewermilestone":
			msg.SystemMsg = fmt.Sprintf("%s reached a watch streak milestone!", msg.DisplayName)
		case "charitydonation":
			amount := msg.EventData["donation-amount"]
			currency := msg.EventData["donation-currency"]
			msg.SystemMsg = fmt.Sprintf("%s donated %s %s to the charity campaign!", msg.DisplayName, amount, currency)
		default:
			msg.SystemMsg = fmt.Sprintf("%s: %s event", msg.DisplayName, msg.EventType)
		}
	}

	// Parse emotes in user message if attached
	if msgEmotesTag != "" && msg.Message != "" {
		parseEmoteTag(msg, msgEmotesTag)
	}

	return msg
}

func (c *Client) parseClearChat(raw string) *ChatMessage {
	msg := &ChatMessage{
		Timestamp: time.Now().Format("15:04:05"),
		IsEvent:   true,
		EventType: "ban",
		EventData: make(map[string]string),
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

	if tags != "" {
		tagPairs := strings.Split(tags, ";")
		for _, pair := range tagPairs {
			kv := strings.SplitN(pair, "=", 2)
			if len(kv) == 2 {
				key, val := kv[0], kv[1]
				if key == "ban-duration" {
					msg.EventData["duration"] = val
					msg.EventType = "timeout"
				}
			}
		}
	}

	if idx := strings.Index(rest, " CLEARCHAT "); idx != -1 {
		afterClear := rest[idx+11:]
		msgStart := strings.Index(afterClear, " :")
		if msgStart != -1 {
			msg.Channel = strings.TrimPrefix(afterClear[:msgStart], "#")
			targetUser := afterClear[msgStart+2:]
			msg.User = targetUser
			msg.DisplayName = targetUser
			if msg.EventType == "timeout" {
				dur := msg.EventData["duration"]
				msg.SystemMsg = fmt.Sprintf("🛡️ @%s was timed out for %ss", targetUser, dur)
			} else {
				msg.SystemMsg = fmt.Sprintf("⛔ @%s was permanently banned", targetUser)
			}
		} else {
			msg.Channel = strings.TrimPrefix(strings.TrimSpace(afterClear), "#")
			msg.EventType = "clearchat"
			msg.SystemMsg = "🧹 Chat was cleared by a moderator"
		}
	}

	return msg
}

func (c *Client) parseClearMsg(raw string) *ChatMessage {
	msg := &ChatMessage{
		Timestamp: time.Now().Format("15:04:05"),
		IsEvent:   true,
		EventType: "deletemsg",
		EventData: make(map[string]string),
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

	if tags != "" {
		tagPairs := strings.Split(tags, ";")
		for _, pair := range tagPairs {
			kv := strings.SplitN(pair, "=", 2)
			if len(kv) == 2 {
				key, val := kv[0], kv[1]
				switch key {
				case "login":
					msg.User = val
					msg.DisplayName = val
				case "target-msg-id":
					msg.EventData["targetId"] = val
				}
			}
		}
	}

	if idx := strings.Index(rest, " CLEARMSG "); idx != -1 {
		afterClear := rest[idx+10:]
		msgStart := strings.Index(afterClear, " :")
		if msgStart != -1 {
			msg.Channel = strings.TrimPrefix(afterClear[:msgStart], "#")
			msg.Message = afterClear[msgStart+2:]
		}
	}

	msg.SystemMsg = fmt.Sprintf("🗑️ Message deleted from @%s", msg.DisplayName)
	return msg
}

func (c *Client) parseNotice(raw string) *ChatMessage {
	msg := &ChatMessage{
		Timestamp: time.Now().Format("15:04:05"),
		IsEvent:   true,
		EventType: "notice",
		EventData: make(map[string]string),
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

	if tags != "" {
		tagPairs := strings.Split(tags, ";")
		for _, pair := range tagPairs {
			kv := strings.SplitN(pair, "=", 2)
			if len(kv) == 2 {
				if kv[0] == "msg-id" {
					msg.EventData["msgId"] = kv[1]
				}
			}
		}
	}

	if idx := strings.Index(rest, " NOTICE "); idx != -1 {
		afterNotice := rest[idx+8:]
		msgStart := strings.Index(afterNotice, " :")
		if msgStart != -1 {
			msg.Channel = strings.TrimPrefix(afterNotice[:msgStart], "#")
			msg.SystemMsg = afterNotice[msgStart+2:]
		}
	}

	if msg.SystemMsg == "" {
		return nil
	}

	return msg
}

func (c *Client) parsePrivMsg(raw string) *ChatMessage {
	msg := &ChatMessage{
		Timestamp: time.Now().Format("15:04:05"),
		EventData: make(map[string]string),
	}

	tags := ""
	rest := raw
	msgEmotesTag := ""
	bitsVal := ""
	customRewardID := ""
	msgIDTag := ""

	if strings.HasPrefix(raw, "@") {
		parts := strings.SplitN(raw[1:], " ", 2)
		if len(parts) == 2 {
			tags = parts[0]
			rest = parts[1]
		}
	}

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
				case "emotes":
					msgEmotesTag = val
				case "bits":
					bitsVal = val
				case "custom-reward-id":
					customRewardID = val
				case "msg-id":
					msgIDTag = val
				}
			}
		}
	}

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

		afterPrivmsg := rest[idx+9:]
		msgStart := strings.Index(afterPrivmsg, " :")
		if msgStart != -1 {
			msg.Channel = strings.TrimPrefix(afterPrivmsg[:msgStart], "#")
			msg.Message = afterPrivmsg[msgStart+2:]
		}
	}

	if msg.Message == "" {
		return nil
	}

	// Check if this PRIVMSG is an Event:
	if bitsVal != "" {
		msg.IsEvent = true
		msg.EventType = "cheer"
		msg.EventData["bits"] = bitsVal
		msg.SystemMsg = fmt.Sprintf("%s cheered %s bits!", msg.DisplayName, bitsVal)
	} else if customRewardID != "" {
		msg.IsEvent = true
		msg.EventType = "reward"
		msg.EventData["rewardId"] = customRewardID
		msg.SystemMsg = fmt.Sprintf("%s redeemed Channel Points reward", msg.DisplayName)
	} else if msgIDTag == "user-intro" {
		msg.IsEvent = true
		msg.EventType = "intro"
		msg.SystemMsg = fmt.Sprintf("👋 Welcome %s to chat (First message)!", msg.DisplayName)
	} else if msgIDTag == "highlighted-message" {
		msg.IsEvent = true
		msg.EventType = "highlighted"
		msg.SystemMsg = fmt.Sprintf("✨ %s highlighted their message", msg.DisplayName)
	} else if msgIDTag == "gigantified-emote-message" {
		msg.IsEvent = true
		msg.EventType = "powerup"
		msg.SystemMsg = fmt.Sprintf("⚡ %s activated a Power-up!", msg.DisplayName)
	}

	// Parse emotes
	if msgEmotesTag != "" {
		parseEmoteTag(msg, msgEmotesTag)
	}

	return msg
}

func parseEmoteTag(msg *ChatMessage, msgEmotesTag string) {
	entries := strings.Split(msgEmotesTag, "/")
	runeMsg := []rune(msg.Message)
	for _, entry := range entries {
		parts := strings.SplitN(entry, ":", 2)
		if len(parts) == 2 {
			emoteID := parts[0]
			positions := strings.Split(parts[1], ",")
			if len(positions) > 0 {
				posRange := strings.SplitN(positions[0], "-", 2)
				if len(posRange) == 2 {
					start, err1 := strconv.Atoi(posRange[0])
					end, err2 := strconv.Atoi(posRange[1])
					if err1 == nil && err2 == nil && start >= 0 && end < len(runeMsg) && start <= end {
						word := string(runeMsg[start : end+1])
						if msg.EmoteMap == nil {
							msg.EmoteMap = make(map[string]string)
						}
						msg.EmoteMap[word] = fmt.Sprintf("https://static-cdn.jtvnw.net/emoticons/v2/%s/default/dark/1.0", emoteID)
					}
				}
			}
		}
	}
}

func tierToName(tier string) string {
	switch tier {
	case "1000", "1":
		return "1"
	case "2000", "2":
		return "2"
	case "3000", "3":
		return "3"
	case "Prime":
		return "Prime"
	default:
		return tier
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

	if c.conn != nil {
		_ = c.conn.Close()
		c.conn = nil
	}
	c.isConnected = false
	c.joinedChans = make(map[string]bool)
	c.emitChannelsUpdated()
	c.emitStatus("disconnected", "", "Disconnected from Twitch")
}


