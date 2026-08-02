package eventbus

import "time"

type EventType string

const (
	EventChatMessage EventType = "CHAT_MESSAGE"
	EventDonate      EventType = "DONATE"
	EventSubscribe   EventType = "SUBSCRIBE"
	EventFollow      EventType = "FOLLOW"
	EventRaid        EventType = "RAID"
)

type User struct {
	ID           string   `json:"id"`
	Username     string   `json:"username"`
	Color        string   `json:"color"`
	Badges       []string `json:"badges"` // "shield", "crown", "heart", "bot"
	IsSubscriber bool     `json:"is_subscriber"`
}

type StreamEvent struct {
	ID        string                 `json:"id"`
	Type      EventType              `json:"type"`
	Platform  string                 `json:"platform"` // "twitch", "youtube", "vkplay", "trovo"
	User      User                   `json:"user"`
	Message   string                 `json:"message,omitempty"`
	Extra     map[string]interface{} `json:"extra,omitempty"` // "amount": "500 ₽", "count": 1, "tier": "Tier 1"
	Timestamp time.Time              `json:"timestamp"`
}
