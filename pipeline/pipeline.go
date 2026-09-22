package pipeline

import (
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"ReChat/config"
	"ReChat/donationalerts"
	"ReChat/twitch"
	"ReChat/widget"
)

// Pipeline coordinates message ingestion, deduplication, enrichment, and fan-out to sinks.
type Pipeline struct {
	mu          sync.Mutex
	rewardDedup map[string]time.Time

	chatSinks     []func(*twitch.ChatMessage)
	widgetSinks   []func(widget.WidgetMessage)
	donationSinks []func(author string, amount float64, currency, message string)
	goalSinks     []func(donationalerts.GoalEvent)
}

// New creates and initializes a new MessagePipeline.
func New() *Pipeline {
	return &Pipeline{
		rewardDedup: make(map[string]time.Time),
	}
}

// OnChatMessage registers a listener for chat messages.
func (p *Pipeline) OnChatMessage(fn func(*twitch.ChatMessage)) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.chatSinks = append(p.chatSinks, fn)
}

// OnWidgetMessage registers a listener for widget formatted messages.
func (p *Pipeline) OnWidgetMessage(fn func(widget.WidgetMessage)) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.widgetSinks = append(p.widgetSinks, fn)
}

// OnDonation registers a listener for donation alert events.
func (p *Pipeline) OnDonation(fn func(author string, amount float64, currency, message string)) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.donationSinks = append(p.donationSinks, fn)
}

// OnGoal registers a listener for goal progress updates.
func (p *Pipeline) OnGoal(fn func(donationalerts.GoalEvent)) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.goalSinks = append(p.goalSinks, fn)
}

func (p *Pipeline) dispatchChat(msg *twitch.ChatMessage) {
	p.mu.Lock()
	sinks := make([]func(*twitch.ChatMessage), len(p.chatSinks))
	copy(sinks, p.chatSinks)
	p.mu.Unlock()

	for _, sink := range sinks {
		sink(msg)
	}
}

func (p *Pipeline) dispatchWidget(wm widget.WidgetMessage) {
	p.mu.Lock()
	sinks := make([]func(widget.WidgetMessage), len(p.widgetSinks))
	copy(sinks, p.widgetSinks)
	p.mu.Unlock()

	for _, sink := range sinks {
		sink(wm)
	}
}

// ConsumeIRCMessage handles rewards dedup and forwards to widget sinks.
func (p *Pipeline) ConsumeIRCMessage(msg *twitch.ChatMessage, isEventSubRunning bool) {
	if msg == nil || p.isDuplicateReward(msg, isEventSubRunning) {
		return
	}
	wm := p.ToWidgetMessage(msg)
	p.dispatchWidget(wm)
}

// ConsumeEventSubMessage handles rewards dedup and forwards to both chat UI and widget sinks.
func (p *Pipeline) ConsumeEventSubMessage(msg *twitch.ChatMessage) {
	if msg == nil || p.isDuplicateReward(msg, false) {
		return
	}
	p.dispatchChat(msg)
	wm := p.ToWidgetMessage(msg)
	p.dispatchWidget(wm)
}

// ConsumeChatMessage handles deduplication, converts to WidgetMessage, and dispatches to sinks.
func (p *Pipeline) ConsumeChatMessage(msg *twitch.ChatMessage, isEventSubRunning bool) {
	if msg == nil || p.isDuplicateReward(msg, isEventSubRunning) {
		return
	}

	p.dispatchChat(msg)
	wm := p.ToWidgetMessage(msg)
	p.dispatchWidget(wm)
}

// ConsumeDonation handles formatting donation amounts, creating a ChatMessage if enabled, and broadcasting.
func (p *Pipeline) ConsumeDonation(ev donationalerts.DonationEvent, settings *config.AppSettings) {
	p.mu.Lock()
	donationSinks := make([]func(author string, amount float64, currency, message string), len(p.donationSinks))
	copy(donationSinks, p.donationSinks)
	chatSinks := make([]func(*twitch.ChatMessage), len(p.chatSinks))
	copy(chatSinks, p.chatSinks)
	p.mu.Unlock()

	for _, sink := range donationSinks {
		sink(ev.Name, ev.Amount, ev.Currency, ev.Message)
	}

	if settings != nil && settings.DAShowInChat && ev.Amount >= settings.DAMinChatAmount {
		chatMsg := p.FormatDonationMessage(ev, settings.Username)
		for _, sink := range chatSinks {
			sink(chatMsg)
		}
	}
}

// ConsumeGoal dispatches goal events to registered goal sinks.
func (p *Pipeline) ConsumeGoal(ev donationalerts.GoalEvent) {
	p.mu.Lock()
	goalSinks := make([]func(donationalerts.GoalEvent), len(p.goalSinks))
	copy(goalSinks, p.goalSinks)
	p.mu.Unlock()

	for _, sink := range goalSinks {
		sink(ev)
	}
}

// isDuplicateReward checks if a channel points reward is already processed within the 30-sec TTL window.
func (p *Pipeline) isDuplicateReward(msg *twitch.ChatMessage, isEventSubRunning bool) bool {
	if !msg.IsEvent || msg.EventType != "reward" {
		return false
	}

	fromEventSub := msg.EventData != nil && msg.EventData["rewardType"] == "eventsub"
	if !fromEventSub && isEventSubRunning {
		return true
	}

	p.mu.Lock()
	defer p.mu.Unlock()

	now := time.Now()
	for k, t := range p.rewardDedup {
		if now.Sub(t) > 30*time.Second {
			delete(p.rewardDedup, k)
		}
	}

	u := strings.ToLower(strings.TrimSpace(msg.User))
	if u == "" {
		u = strings.ToLower(strings.TrimSpace(msg.DisplayName))
	}
	txt := strings.TrimSpace(msg.Message)
	rewardID := ""
	if msg.EventData != nil {
		rewardID = msg.EventData["rewardId"]
	}

	keyUserText := fmt.Sprintf("%s|%s", u, txt)
	keyUserReward := fmt.Sprintf("%s|%s", u, rewardID)

	if txt != "" {
		if _, exists := p.rewardDedup[keyUserText]; exists {
			return true
		}
		p.rewardDedup[keyUserText] = now
	}
	if rewardID != "" {
		if _, exists := p.rewardDedup[keyUserReward]; exists {
			return true
		}
		p.rewardDedup[keyUserReward] = now
	}

	return false
}

// ToWidgetMessage converts a ChatMessage into an OBS-ready WidgetMessage.
func (p *Pipeline) ToWidgetMessage(msg *twitch.ChatMessage) widget.WidgetMessage {
	var badgesList []string
	if msg.Badges != "" {
		for _, b := range strings.Split(msg.Badges, ",") {
			if tb := strings.TrimSpace(b); tb != "" {
				badgesList = append(badgesList, tb)
			}
		}
	}

	wm := widget.WidgetMessage{
		Type:       "message",
		Platform:   msg.Platform,
		Author:     msg.DisplayName,
		AvatarURL:  widget.GetAvatarURL(msg.User),
		Color:      msg.Color,
		Badges:     badgesList,
		Text:       msg.Message,
		EmoteMap:   msg.EmoteMap,
		Channel:    msg.Channel,
		Timestamp:  msg.Timestamp,
		IsFirstMsg: msg.IsFirstMsg || (msg.EventData != nil && msg.EventData["firstMsg"] == "1") || msg.EventType == "intro",
	}

	if msg.IsEvent && msg.EventType == "reward" {
		wm.Type = "reward"
		if msg.EventData != nil {
			wm.RewardTitle = msg.EventData["rewardTitle"]
			if cost, err := strconv.Atoi(msg.EventData["rewardCost"]); err == nil {
				wm.Cost = cost
			}
		}
		wm.UserInput = msg.Message
	} else if msg.IsEvent && (msg.EventType == "follow" || msg.EventType == "channel.follow") {
		wm.Type = "follow"
		wm.IsEvent = true
		wm.EventType = "follow"
		wm.Text = msg.SystemMsg
	}

	return wm
}

// FormatDonationMessage transforms a DonationAlerts event into a rich ChatMessage for the chat feed.
func (p *Pipeline) FormatDonationMessage(ev donationalerts.DonationEvent, channel string) *twitch.ChatMessage {
	formattedAmount := fmt.Sprintf("%.0f %s", ev.Amount, ev.Currency)
	if ev.Amount != float64(int64(ev.Amount)) {
		formattedAmount = fmt.Sprintf("%.2f %s", ev.Amount, ev.Currency)
	}

	userColor := "#F59E0B"
	if ev.Amount >= 500 {
		userColor = "#EC4899"
	}

	return &twitch.ChatMessage{
		ID:          fmt.Sprintf("da-%d", ev.ID),
		Channel:     channel,
		User:        strings.ToLower(ev.Name),
		DisplayName: ev.Name,
		Color:       userColor,
		Message:     ev.Message,
		Timestamp:   time.Now().Format("15:04:05"),
		IsEvent:     true,
		EventType:   "donation",
		SystemMsg:   fmt.Sprintf("%s задонатил %s!", ev.Name, formattedAmount),
		EventData: map[string]string{
			"amount":          fmt.Sprintf("%f", ev.Amount),
			"currency":        ev.Currency,
			"formattedAmount": formattedAmount,
			"userName":        ev.Name,
			"message":         ev.Message,
		},
	}
}
