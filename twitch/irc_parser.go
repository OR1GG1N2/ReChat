package twitch

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

// IRCParser parses raw IRC protocol lines received from Twitch IRC servers into structured ChatMessage objects.
type IRCParser struct{}

// NewIRCParser creates a new IRCParser instance.
func NewIRCParser() *IRCParser {
	return &IRCParser{}
}

// RawIRCMessage represents a tokenized IRC message.
type RawIRCMessage struct {
	Tags    map[string]string
	Prefix  string
	Command string
	Params  []string
	Message string
}

// Parse parses a raw IRC line into a ChatMessage. Returns nil if the line is not a supported chat or event message.
func (p *IRCParser) Parse(raw string) *ChatMessage {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}

	parsed := p.tokenize(raw)
	if parsed == nil {
		return nil
	}

	switch parsed.Command {
	case "PRIVMSG":
		return p.parsePrivMsg(parsed)
	case "USERNOTICE":
		return p.parseUserNotice(parsed)
	case "CLEARCHAT":
		return p.parseClearChat(parsed)
	case "CLEARMSG":
		return p.parseClearMsg(parsed)
	case "NOTICE":
		return p.parseNotice(parsed)
	default:
		return nil
	}
}

// tokenize breaks a raw IRC line into tags, prefix, command, params, and trailing message.
func (p *IRCParser) tokenize(raw string) *RawIRCMessage {
	msg := &RawIRCMessage{
		Tags: make(map[string]string),
	}

	rest := raw

	// Parse tags if present
	if strings.HasPrefix(rest, "@") {
		parts := strings.SplitN(rest[1:], " ", 2)
		if len(parts) == 2 {
			msg.Tags = p.parseTags(parts[0])
			rest = parts[1]
		}
	}

	// Parse prefix if present (:nick!user@host or :tmi.twitch.tv)
	if strings.HasPrefix(rest, ":") {
		parts := strings.SplitN(rest[1:], " ", 2)
		if len(parts) == 2 {
			msg.Prefix = parts[0]
			rest = parts[1]
		}
	}

	// Separate trailing message (:message) if present
	trailingIdx := strings.Index(rest, " :")
	if trailingIdx != -1 {
		msg.Message = rest[trailingIdx+2:]
		rest = rest[:trailingIdx]
	}

	// Remainder contains Command and parameters
	parts := strings.Fields(rest)
	if len(parts) == 0 {
		return nil
	}

	msg.Command = strings.ToUpper(parts[0])
	if len(parts) > 1 {
		msg.Params = parts[1:]
	}

	return msg
}

// parseTags splits key-value tags and unescapes standard Twitch IRC tag values.
func (p *IRCParser) parseTags(tagStr string) map[string]string {
	tags := make(map[string]string)
	pairs := strings.Split(tagStr, ";")
	for _, pair := range pairs {
		kv := strings.SplitN(pair, "=", 2)
		if len(kv) == 2 {
			key, val := kv[0], kv[1]
			// Unescape standard IRC tag sequences
			val = strings.ReplaceAll(val, `\s`, " ")
			val = strings.ReplaceAll(val, `\r`, "\r")
			val = strings.ReplaceAll(val, `\n`, "\n")
			val = strings.ReplaceAll(val, `\:`, ":")
			val = strings.ReplaceAll(val, `\\`, `\`)
			tags[key] = val
		}
	}
	return tags
}

func (p *IRCParser) parsePrivMsg(m *RawIRCMessage) *ChatMessage {
	channel := ""
	if len(m.Params) > 0 {
		channel = strings.TrimPrefix(m.Params[0], "#")
	}

	user := ""
	if m.Prefix != "" {
		if ex := strings.Index(m.Prefix, "!"); ex != -1 {
			user = m.Prefix[:ex]
		} else {
			user = m.Prefix
		}
	}

	displayName := m.Tags["display-name"]
	if displayName == "" {
		displayName = user
	}

	msg := &ChatMessage{
		ID:          m.Tags["id"],
		Channel:     channel,
		User:        user,
		DisplayName: displayName,
		Color:       m.Tags["color"],
		Message:     m.Message,
		Timestamp:   time.Now().Format("15:04:05"),
		Badges:      m.Tags["badges"],
		EventData:   make(map[string]string),
		IsFirstMsg:  m.Tags["first-msg"] == "1",
	}

	if msg.Message == "" {
		return nil
	}

	// Check special event types encoded in PRIVMSG
	bitsVal := m.Tags["bits"]
	customRewardID := m.Tags["custom-reward-id"]
	msgIDTag := m.Tags["msg-id"]

	if bitsVal != "" {
		msg.IsEvent = true
		msg.EventType = "cheer"
		msg.EventData["bits"] = bitsVal
		msg.SystemMsg = fmt.Sprintf("%s cheered %s bits!", msg.DisplayName, bitsVal)
	} else if customRewardID != "" {
		msg.IsEvent = true
		msg.EventType = "reward"
		msg.EventData["rewardId"] = customRewardID
		msg.SystemMsg = fmt.Sprintf("Заказ за баллы канала от %s", msg.DisplayName)
	} else if msgIDTag == "user-intro" {
		msg.IsEvent = true
		msg.EventType = "intro"
		msg.SystemMsg = fmt.Sprintf("👋 Приветствуем %s в чате (Первое сообщение)!", msg.DisplayName)
	} else if msgIDTag == "highlighted-message" {
		msg.IsEvent = true
		msg.EventType = "highlighted"
		msg.SystemMsg = fmt.Sprintf("✨ Выделенное сообщение от %s", msg.DisplayName)
	} else if msgIDTag == "gigantified-emote-message" {
		msg.IsEvent = true
		msg.EventType = "powerup"
		msg.SystemMsg = fmt.Sprintf("⚡ %s activated a Power-up!", msg.DisplayName)
	}

	if emotesTag := m.Tags["emotes"]; emotesTag != "" {
		p.parseEmotes(msg, emotesTag)
	}

	return msg
}

func (p *IRCParser) parseUserNotice(m *RawIRCMessage) *ChatMessage {
	channel := ""
	if len(m.Params) > 0 {
		channel = strings.TrimPrefix(m.Params[0], "#")
	}

	msg := &ChatMessage{
		ID:          m.Tags["id"],
		Channel:     channel,
		User:        m.Tags["login"],
		DisplayName: m.Tags["display-name"],
		Color:       m.Tags["color"],
		Message:     m.Message,
		Timestamp:   time.Now().Format("15:04:05"),
		Badges:      m.Tags["badges"],
		IsEvent:     true,
		EventType:   m.Tags["msg-id"],
		SystemMsg:   m.Tags["system-msg"],
		EventData:   make(map[string]string),
	}

	if msg.DisplayName == "" {
		msg.DisplayName = msg.User
	}
	if msg.EventType == "" {
		msg.EventType = "notice"
	}

	// Collect any msg-param-* keys
	for k, v := range m.Tags {
		if strings.HasPrefix(k, "msg-param-") {
			msg.EventData[strings.TrimPrefix(k, "msg-param-")] = v
		}
	}

	// Fallback system message formatters if Twitch didn't supply system-msg
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

	if emotesTag := m.Tags["emotes"]; emotesTag != "" && msg.Message != "" {
		p.parseEmotes(msg, emotesTag)
	}

	return msg
}

func (p *IRCParser) parseClearChat(m *RawIRCMessage) *ChatMessage {
	channel := ""
	if len(m.Params) > 0 {
		channel = strings.TrimPrefix(m.Params[0], "#")
	}

	targetUser := m.Message
	msg := &ChatMessage{
		Channel:   channel,
		Timestamp: time.Now().Format("15:04:05"),
		IsEvent:   true,
		EventType: "ban",
		EventData: make(map[string]string),
	}

	if dur, ok := m.Tags["ban-duration"]; ok && dur != "" {
		msg.EventData["duration"] = dur
		msg.EventType = "timeout"
	}

	if targetUser != "" {
		msg.User = targetUser
		msg.DisplayName = targetUser
		if msg.EventType == "timeout" {
			dur := msg.EventData["duration"]
			msg.SystemMsg = fmt.Sprintf("🛡️ @%s was timed out for %ss", targetUser, dur)
		} else {
			msg.SystemMsg = fmt.Sprintf("⛔ @%s was permanently banned", targetUser)
		}
	} else {
		msg.EventType = "clearchat"
		msg.SystemMsg = "🧹 Chat was cleared by a moderator"
	}

	return msg
}

func (p *IRCParser) parseClearMsg(m *RawIRCMessage) *ChatMessage {
	channel := ""
	if len(m.Params) > 0 {
		channel = strings.TrimPrefix(m.Params[0], "#")
	}

	login := m.Tags["login"]
	targetMsgID := m.Tags["target-msg-id"]

	msg := &ChatMessage{
		Channel:     channel,
		User:        login,
		DisplayName: login,
		Message:     m.Message,
		Timestamp:   time.Now().Format("15:04:05"),
		IsEvent:     true,
		EventType:   "deletemsg",
		EventData:   map[string]string{"targetId": targetMsgID},
	}

	target := msg.DisplayName
	if target == "" {
		target = msg.User
	}
	if target != "" {
		msg.SystemMsg = fmt.Sprintf("🗑️ Message deleted from @%s", target)
	} else {
		msg.SystemMsg = "🗑️ Message deleted"
	}

	return msg
}

func (p *IRCParser) parseNotice(m *RawIRCMessage) *ChatMessage {
	channel := ""
	if len(m.Params) > 0 {
		channel = strings.TrimPrefix(m.Params[0], "#")
	}

	if m.Message == "" {
		return nil
	}

	msg := &ChatMessage{
		Channel:   channel,
		Timestamp: time.Now().Format("15:04:05"),
		IsEvent:   true,
		EventType: "notice",
		SystemMsg: m.Message,
		EventData: make(map[string]string),
	}

	if msgID := m.Tags["msg-id"]; msgID != "" {
		msg.EventData["msgId"] = msgID
	}

	return msg
}

func (p *IRCParser) parseEmotes(msg *ChatMessage, msgEmotesTag string) {
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
