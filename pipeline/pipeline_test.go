package pipeline

import (
	"sync/atomic"
	"testing"

	"ReChat/config"
	"ReChat/donationalerts"
	"ReChat/twitch"
	"ReChat/widget"
)

func TestPipeline_RewardDeduplication(t *testing.T) {
	p := New()

	var chatCount int32
	var widgetCount int32
	p.OnChatMessage(func(msg *twitch.ChatMessage) {
		atomic.AddInt32(&chatCount, 1)
	})
	p.OnWidgetMessage(func(msg widget.WidgetMessage) {
		atomic.AddInt32(&widgetCount, 1)
	})

	msg1 := &twitch.ChatMessage{
		User:        "testuser",
		DisplayName: "TestUser",
		Message:     "Play song A",
		IsEvent:     true,
		EventType:   "reward",
		EventData: map[string]string{
			"rewardId":   "song-reward",
			"rewardType": "irc",
		},
	}

	// First reward from IRC
	p.ConsumeChatMessage(msg1, false)
	if atomic.LoadInt32(&chatCount) != 1 || atomic.LoadInt32(&widgetCount) != 1 {
		t.Fatalf("expected 1 chat and 1 widget message, got %d, %d", chatCount, widgetCount)
	}

	// Duplicate reward from IRC with same text & rewardId within 30s
	p.ConsumeChatMessage(msg1, false)
	if atomic.LoadInt32(&chatCount) != 1 || atomic.LoadInt32(&widgetCount) != 1 {
		t.Fatalf("expected duplicate reward to be suppressed, got %d, %d", chatCount, widgetCount)
	}

	// Reward from IRC when EventSub is running should be suppressed
	msg2 := &twitch.ChatMessage{
		User:        "otheruser",
		DisplayName: "OtherUser",
		Message:     "Hello",
		IsEvent:     true,
		EventType:   "reward",
		EventData: map[string]string{
			"rewardId":   "hello-reward",
			"rewardType": "irc",
		},
	}
	p.ConsumeChatMessage(msg2, true) // isEventSubRunning = true
	if atomic.LoadInt32(&chatCount) != 1 {
		t.Fatalf("expected IRC reward to be suppressed when EventSub is running, got %d", chatCount)
	}
}

func TestPipeline_DonationFormatting(t *testing.T) {
	p := New()

	var receivedChat *twitch.ChatMessage
	p.OnChatMessage(func(msg *twitch.ChatMessage) {
		receivedChat = msg
	})

	var donAuthor string
	var donAmount float64
	p.OnDonation(func(author string, amount float64, currency, message string) {
		donAuthor = author
		donAmount = amount
	})

	ev := donationalerts.DonationEvent{
		ID:       12345,
		Name:     "Supporter",
		Amount:   500.0,
		Currency: "RUB",
		Message:  "Keep it up!",
	}

	cfg := &config.AppSettings{
		Username:        "streamer",
		DAShowInChat:    true,
		DAMinChatAmount: 100,
	}

	p.ConsumeDonation(ev, cfg)

	if donAuthor != "Supporter" || donAmount != 500.0 {
		t.Fatalf("expected donation sink called with Supporter 500, got %s %f", donAuthor, donAmount)
	}

	if receivedChat == nil {
		t.Fatalf("expected chat message to be formatted and dispatched")
	}
	if receivedChat.Color != "#EC4899" { // >= 500 gets pink
		t.Errorf("expected pink color #EC4899 for >= 500, got %s", receivedChat.Color)
	}
	if receivedChat.SystemMsg != "Supporter задонатил 500 RUB!" {
		t.Errorf("expected SystemMsg 'Supporter задонатил 500 RUB!', got %s", receivedChat.SystemMsg)
	}
}

func TestPipeline_ToWidgetMessage(t *testing.T) {
	p := New()

	msg := &twitch.ChatMessage{
		User:        "viewer",
		DisplayName: "Viewer",
		Message:     "Nice stream",
		Badges:      "subscriber/12, premium/1",
		Color:       "#FF0000",
		IsEvent:     true,
		EventType:   "follow",
		SystemMsg:   "Viewer followed the channel!",
	}

	wm := p.ToWidgetMessage(msg)
	if wm.Author != "Viewer" {
		t.Errorf("expected Author 'Viewer', got %s", wm.Author)
	}
	if len(wm.Badges) != 2 || wm.Badges[0] != "subscriber/12" || wm.Badges[1] != "premium/1" {
		t.Errorf("expected split badges [subscriber/12 premium/1], got %v", wm.Badges)
	}
	if wm.Type != "follow" || wm.Text != "Viewer followed the channel!" {
		t.Errorf("expected follow event widget message, got type=%s text=%s", wm.Type, wm.Text)
	}
}
