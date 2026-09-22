package kick

import (
	"encoding/json"
	"testing"

	"ReChat/twitch"
)

func TestFormatKickBadges(t *testing.T) {
	badges := []KickBadge{
		{Type: "Broadcaster", Count: 0},
		{Type: "Moderator", Count: 1},
		{Type: "Subscriber", Count: 12},
		{Type: "VIP", Count: 0},
	}

	res := FormatKickBadges(badges)
	expected := "broadcaster/1,moderator/1,subscriber/12,vip/1"
	if res != expected {
		t.Fatalf("expected badges '%s', got '%s'", expected, res)
	}

	if FormatKickBadges(nil) != "" {
		t.Fatalf("expected empty string for nil badges")
	}
}

func TestKickChatMessageParsing(t *testing.T) {
	client := NewClient()
	client.slugToChatroomID["xqc"] = 668
	client.chatroomIDToSlug[668] = "xqc"

	var received *twitch.ChatMessage
	client.SetMessageHandler(func(msg *twitch.ChatMessage) {
		received = msg
	})

	rawJSON := `{
		"id": "msg-12345",
		"chatroom_id": 668,
		"content": "PogChamp kick chat works!",
		"type": "message",
		"created_at": "2026-09-22T15:04:05.000000Z",
		"sender": {
			"id": 999,
			"username": "KickUser",
			"slug": "kickuser",
			"identity": {
				"color": "#FF5500",
				"badges": [
					{"type": "moderator", "text": "Moderator"},
					{"type": "subscriber", "text": "Subscriber", "count": 3}
				]
			}
		}
	}`

	client.handleChatMessage(json.RawMessage(rawJSON))

	if received == nil {
		t.Fatalf("expected message to be handled")
	}
	if received.Platform != "kick" {
		t.Errorf("expected platform 'kick', got '%s'", received.Platform)
	}
	if received.Channel != "xqc" {
		t.Errorf("expected channel 'xqc', got '%s'", received.Channel)
	}
	if received.User != "kickuser" {
		t.Errorf("expected user 'kickuser', got '%s'", received.User)
	}
	if received.DisplayName != "KickUser" {
		t.Errorf("expected displayName 'KickUser', got '%s'", received.DisplayName)
	}
	if received.Color != "#FF5500" {
		t.Errorf("expected color '#FF5500', got '%s'", received.Color)
	}
	if received.Message != "PogChamp kick chat works!" {
		t.Errorf("expected message content, got '%s'", received.Message)
	}
	if received.Badges != "moderator/1,subscriber/3" {
		t.Errorf("expected badges 'moderator/1,subscriber/3', got '%s'", received.Badges)
	}
	if received.IsEvent {
		t.Errorf("chat message should not be flagged as event")
	}
}

func TestKickBannedEventParsing(t *testing.T) {
	client := NewClient()

	var received *twitch.ChatMessage
	client.SetMessageHandler(func(msg *twitch.ChatMessage) {
		received = msg
	})

	rawJSON := `{
		"id": "ban-1",
		"user": {
			"id": 123,
			"username": "Spammer123",
			"slug": "spammer123"
		},
		"banned_by": {
			"id": 1,
			"username": "ModBoss"
		}
	}`

	client.handleUserBanned(json.RawMessage(rawJSON))

	if received == nil {
		t.Fatalf("expected ban event to be handled")
	}
	if received.Platform != "kick" {
		t.Errorf("expected platform 'kick', got '%s'", received.Platform)
	}
	if !received.IsEvent {
		t.Errorf("expected IsEvent true")
	}
	if received.EventType != "ban" {
		t.Errorf("expected eventType 'ban', got '%s'", received.EventType)
	}
}
func TestGetJoinedChannels(t *testing.T) {
	client := NewClient()
	chans := client.GetJoinedChannels()
	if len(chans) != 0 {
		t.Errorf("expected 0 channels initially, got %d", len(chans))
	}

	client.channelsMu.Lock()
	client.joinedChannels["trainwreckstv"] = true
	client.channelsMu.Unlock()

	chans = client.GetJoinedChannels()
	if len(chans) != 1 || chans[0] != "trainwreckstv" {
		t.Errorf("expected ['trainwreckstv'], got %v", chans)
	}
}

