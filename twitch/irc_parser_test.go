package twitch

import (
	"testing"
)

func TestIRCParser_PrivMsg(t *testing.T) {
	parser := NewIRCParser()

	raw := `@badge-info=;badges=broadcaster/1;color=#00FF7F;display-name=TestStreamer;emotes=25:0-4;first-msg=1;id=123-abc;mod=0;room-id=111;subscriber=0;tmi-sent-ts=1500000000;turbo=0;user-id=222;user-type= :teststreamer!teststreamer@teststreamer.tmi.twitch.tv PRIVMSG #testchannel :Kappa hello world`
	msg := parser.Parse(raw)

	if msg == nil {
		t.Fatalf("expected non-nil ChatMessage")
	}
	if msg.DisplayName != "TestStreamer" {
		t.Errorf("expected DisplayName 'TestStreamer', got %q", msg.DisplayName)
	}
	if msg.Channel != "testchannel" {
		t.Errorf("expected Channel 'testchannel', got %q", msg.Channel)
	}
	if msg.Message != "Kappa hello world" {
		t.Errorf("expected Message 'Kappa hello world', got %q", msg.Message)
	}
	if !msg.IsFirstMsg {
		t.Errorf("expected IsFirstMsg true")
	}
	if msg.Color != "#00FF7F" {
		t.Errorf("expected Color '#00FF7F', got %q", msg.Color)
	}
	if msg.EmoteMap == nil || msg.EmoteMap["Kappa"] == "" {
		t.Errorf("expected emote Kappa in EmoteMap, got %v", msg.EmoteMap)
	}
}

func TestIRCParser_UserNotice_Sub(t *testing.T) {
	parser := NewIRCParser()

	raw := `@badge-info=;badges=subscriber/0;color=#FF4500;display-name=SubGuy;emotes=;flags=;id=sub-1;login=subguy;mod=0;msg-id=sub;msg-param-cumulative-months=1;msg-param-months=0;msg-param-multimonth-duration=0;msg-param-multimonth-tenure=0;msg-param-should-share-streak=0;msg-param-sub-plan=1000;msg-param-sub-plan-name=Channel\sSubscription;msg-param-was-gifted=false;room-id=111;subscriber=1;system-msg=SubGuy\ssubscribed\sat\sTier\s1!;tmi-sent-ts=1500000000;user-id=333;user-type= :tmi.twitch.tv USERNOTICE #testchannel`
	msg := parser.Parse(raw)

	if msg == nil {
		t.Fatalf("expected non-nil ChatMessage")
	}
	if !msg.IsEvent {
		t.Errorf("expected IsEvent to be true")
	}
	if msg.EventType != "sub" {
		t.Errorf("expected EventType 'sub', got %q", msg.EventType)
	}
	if msg.SystemMsg != "SubGuy subscribed at Tier 1!" {
		t.Errorf("expected unescaped SystemMsg 'SubGuy subscribed at Tier 1!', got %q", msg.SystemMsg)
	}
}

func TestIRCParser_ClearChat_Timeout(t *testing.T) {
	parser := NewIRCParser()

	raw := `@ban-duration=600;room-id=111;target-user-id=999;tmi-sent-ts=1500000000 :tmi.twitch.tv CLEARCHAT #testchannel :spammer`
	msg := parser.Parse(raw)

	if msg == nil {
		t.Fatalf("expected non-nil ChatMessage")
	}
	if msg.EventType != "timeout" {
		t.Errorf("expected EventType 'timeout', got %q", msg.EventType)
	}
	if msg.User != "spammer" {
		t.Errorf("expected User 'spammer', got %q", msg.User)
	}
	if msg.EventData["duration"] != "600" {
		t.Errorf("expected duration '600', got %q", msg.EventData["duration"])
	}
}

func TestIRCParser_ClearMsg(t *testing.T) {
	parser := NewIRCParser()

	raw := `@login=baduser;room-id=;target-msg-id=msg-999;tmi-sent-ts=1500000000 :tmi.twitch.tv CLEARMSG #testchannel :bad text`
	msg := parser.Parse(raw)

	if msg == nil {
		t.Fatalf("expected non-nil ChatMessage")
	}
	if msg.EventType != "deletemsg" {
		t.Errorf("expected EventType 'deletemsg', got %q", msg.EventType)
	}
	if msg.EventData["targetId"] != "msg-999" {
		t.Errorf("expected targetId 'msg-999', got %q", msg.EventData["targetId"])
	}
}

func TestIRCParser_Reward(t *testing.T) {
	parser := NewIRCParser()

	raw := `@badges=;color=#1E90FF;custom-reward-id=rew-42;display-name=RewardUser;id=msg-rew;user-id=555 :rewarduser!rewarduser@tmi.twitch.tv PRIVMSG #testchannel :Drink water!`
	msg := parser.Parse(raw)

	if msg == nil {
		t.Fatalf("expected non-nil ChatMessage")
	}
	if !msg.IsEvent || msg.EventType != "reward" {
		t.Errorf("expected EventType 'reward', got %q", msg.EventType)
	}
	if msg.EventData["rewardId"] != "rew-42" {
		t.Errorf("expected rewardId 'rew-42', got %q", msg.EventData["rewardId"])
	}
}
