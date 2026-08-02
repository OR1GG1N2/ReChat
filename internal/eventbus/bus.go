package eventbus

import (
	"context"
	"encoding/json"
	"net"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const UDPPort = ":18923"

type EventBus struct {
	mu        sync.Mutex
	ctx       context.Context
	events    []StreamEvent
	udpConn   *net.UDPConn
}

func NewEventBus() *EventBus {
	b := &EventBus{
		events: make([]StreamEvent, 0, 100),
	}
	b.startUDPListener()
	return b
}

func (b *EventBus) SetContext(ctx context.Context) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.ctx = ctx
}

func (b *EventBus) startUDPListener() {
	addr, err := net.ResolveUDPAddr("udp", "127.0.0.1"+UDPPort)
	if err != nil {
		return
	}
	conn, err := net.ListenUDP("udp", addr)
	if err != nil {
		// Port busy, another instance is listening
		return
	}
	b.udpConn = conn

	go func() {
		buf := make([]byte, 65535)
		for {
			n, _, err := conn.ReadFrom(buf)
			if err != nil {
				return
			}
			var ev StreamEvent
			if err := json.Unmarshal(buf[:n], &ev); err == nil {
				b.mu.Lock()
				b.events = append(b.events, ev)
				ctx := b.ctx
				b.mu.Unlock()

				if ctx != nil {
					runtime.EventsEmit(ctx, "stream:event", ev)
				}
			}
		}
	}()
}

func (b *EventBus) Publish(event StreamEvent) {
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now()
	}

	b.mu.Lock()
	b.events = append(b.events, event)
	if len(b.events) > 500 {
		b.events = b.events[len(b.events)-500:]
	}
	ctx := b.ctx
	b.mu.Unlock()

	// Emit locally
	if ctx != nil {
		runtime.EventsEmit(ctx, "stream:event", event)
	}

	// Broadcast via UDP to sibling window process
	data, err := json.Marshal(event)
	if err == nil {
		rAddr, err := net.ResolveUDPAddr("udp", "127.0.0.1"+UDPPort)
		if err == nil {
			conn, err := net.DialUDP("udp", nil, rAddr)
			if err == nil {
				_, _ = conn.Write(data)
				_ = conn.Close()
			}
		}
	}
}

func (b *EventBus) GetEvents() []StreamEvent {
	b.mu.Lock()
	defer b.mu.Unlock()
	result := make([]StreamEvent, len(b.events))
	copy(result, b.events)
	return result
}
