package tts

import (
	"context"
	"fmt"
	"sync"
	"time"

	"rechat/internal/config"
	"rechat/internal/eventbus"
)

type TTSQueueItem struct {
	ID        string
	Text      string
	Voice     string
	Speed     float64
	Pitch     float64
	Timestamp time.Time
}

type TTSService struct {
	mu      sync.Mutex
	cfg     *config.ConfigManager
	queue   chan TTSQueueItem
	cancel  context.CancelFunc
	status  string
	latency time.Duration
}

func NewTTSService(cfg *config.ConfigManager) *TTSService {
	svc := &TTSService{
		cfg:     cfg,
		queue:   make(chan TTSQueueItem, 100),
		status:  "Готов к озвучке",
		latency: 12 * time.Millisecond,
	}
	return svc
}

func (s *TTSService) Start(ctx context.Context) {
	ctx, cancel := context.WithCancel(ctx)
	s.cancel = cancel

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case item := <-s.queue:
				s.processItem(item)
			}
		}
	}()
}

func (s *TTSService) Stop() {
	if s.cancel != nil {
		s.cancel()
	}
}

func (s *TTSService) Enqueue(event eventbus.StreamEvent) {
	c := s.cfg.Get()
	if !c.TTSEnabled {
		return
	}

	// Filter rules
	if event.Type == eventbus.EventDonate && !c.TTSForDonates {
		return
	}
	if event.Type == eventbus.EventSubscribe && !c.TTSForSubs {
		return
	}

	if event.Type == eventbus.EventDonate {
		if amt, ok := event.Extra["amount_val"].(float64); ok && amt < c.MinDonateAmount {
			return
		}
	}

	textToSpeak := event.Message
	if textToSpeak == "" {
		return
	}

	item := TTSQueueItem{
		ID:        event.ID,
		Text:      textToSpeak,
		Voice:     c.TTSVoice,
		Speed:     c.TTSSpeed,
		Pitch:     c.TTSPitch,
		Timestamp: time.Now(),
	}

	select {
	case s.queue <- item:
	default:
		// Queue full, drop item
	}
}

func (s *TTSService) Test(voice string, text string) {
	c := s.cfg.Get()
	if text == "" {
		text = "Тестовая озвучка сообщения ReChat! Голос настроен отлично."
	}
	v := voice
	if v == "" {
		v = c.TTSVoice
	}

	select {
	case s.queue <- TTSQueueItem{
		ID:        "test",
		Text:      text,
		Voice:     v,
		Speed:     c.TTSSpeed,
		Pitch:     c.TTSPitch,
		Timestamp: time.Now(),
	}:
	default:
	}
}

func (s *TTSService) processItem(item TTSQueueItem) {
	s.mu.Lock()
	s.status = fmt.Sprintf("Озвучка: %s...", item.Text)
	s.mu.Unlock()

	// Simulated speech processing duration
	time.Sleep(1500 * time.Millisecond)

	s.mu.Lock()
	s.status = "Готов к озвучке"
	s.mu.Unlock()
}

func (s *TTSService) GetStatus() (string, int64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.status, s.latency.Milliseconds()
}
