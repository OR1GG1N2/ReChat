package widget

import (
	"strings"
	"testing"
	"time"
)

func TestWidgetServer_Emit(t *testing.T) {
	ws := NewWidgetServer(0)

	chatClient := &sseClient{
		send:  make(chan []byte, 10),
		theme: "default",
	}
	musicClient := &sseClient{
		send:  make(chan []byte, 10),
		theme: "default",
	}

	ws.clientsMu.Lock()
	ws.clients[chatClient] = struct{}{}
	ws.clientsMu.Unlock()

	ws.musicClientsMu.Lock()
	ws.musicClients[musicClient] = struct{}{}
	ws.musicClientsMu.Unlock()

	// 1. Emit to chat target
	err := ws.Emit(TargetChat, "test_event", map[string]string{"foo": "bar"})
	if err != nil {
		t.Fatalf("Emit failed: %v", err)
	}

	select {
	case payload := <-chatClient.send:
		str := string(payload)
		if !strings.HasPrefix(str, "event: test_event\ndata: ") || !strings.HasSuffix(str, "\n\n") {
			t.Errorf("unexpected SSE envelope for chat client: %q", str)
		}
	case <-time.After(100 * time.Millisecond):
		t.Errorf("chat client timed out waiting for payload")
	}

	// Music client should not receive chat target
	select {
	case p := <-musicClient.send:
		t.Errorf("music client unexpectedly received payload: %s", string(p))
	default:
	}

	// 2. Emit to music target
	err = ws.Emit(TargetMusic, "music_update", map[string]string{"artist": "Twitch"})
	if err != nil {
		t.Fatalf("Emit to music failed: %v", err)
	}

	select {
	case payload := <-musicClient.send:
		str := string(payload)
		if !strings.Contains(str, "event: music_update") || !strings.Contains(str, "Twitch") {
			t.Errorf("unexpected SSE envelope for music client: %q", str)
		}
	case <-time.After(100 * time.Millisecond):
		t.Errorf("music client timed out waiting for payload")
	}

	// 3. Emit reload to all
	ws.broadcastReload()

	select {
	case p := <-chatClient.send:
		if !strings.Contains(string(p), "event: reload") {
			t.Errorf("chat client expected reload event, got: %s", string(p))
		}
	case <-time.After(100 * time.Millisecond):
		t.Errorf("chat client timed out waiting for reload")
	}

	select {
	case p := <-musicClient.send:
		if !strings.Contains(string(p), "event: reload") {
			t.Errorf("music client expected reload event, got: %s", string(p))
		}
	case <-time.After(100 * time.Millisecond):
		t.Errorf("music client timed out waiting for reload")
	}
}
