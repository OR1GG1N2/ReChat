package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"syscall"
	"time"
	"unsafe"

	"rechat/internal/config"
	"rechat/internal/eventbus"
	"rechat/internal/tts"
	"rechat/internal/twitch"
)

var (
	user32                  = syscall.NewLazyDLL("user32.dll")
	procFindWindowW         = user32.NewProc("FindWindowW")
	procSetForegroundWindow = user32.NewProc("SetForegroundWindow")
	procShowWindow          = user32.NewProc("ShowWindow")
)

func focusExistingWindow(title string) bool {
	if runtime.GOOS != "windows" {
		return false
	}
	titlePtr, err := syscall.UTF16PtrFromString(title)
	if err != nil {
		return false
	}
	hwnd, _, _ := procFindWindowW.Call(0, uintptr(unsafe.Pointer(titlePtr)))
	if hwnd != 0 {
		const SW_RESTORE = 9
		procShowWindow.Call(hwnd, SW_RESTORE)
		procSetForegroundWindow.Call(hwnd)
		return true
	}
	return false
}

type App struct {
	ctx       context.Context
	bus       *eventbus.EventBus
	cfg       *config.ConfigManager
	ttsSvc    *tts.TTSService
	twitchSvc *twitch.TwitchService
	mode      string
}

func NewApp(mode string) *App {
	cfg := config.NewConfigManager()
	bus := eventbus.NewEventBus()
	ttsSvc := tts.NewTTSService(cfg)
	twitchSvc := twitch.NewTwitchService(bus)

	app := &App{
		bus:       bus,
		cfg:       cfg,
		ttsSvc:    ttsSvc,
		twitchSvc: twitchSvc,
		mode:      mode,
	}

	app.seedInitialEvents()

	return app
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.bus.SetContext(ctx)
	a.ttsSvc.Start(ctx)

	if a.mode == "chat" {
		go a.simulateLiveEvents(ctx)
	}
}

func (a *App) shutdown(ctx context.Context) {
	a.ttsSvc.Stop()
}

func (a *App) GetMode() string {
	return a.mode
}

func (a *App) OpenChatWindow() {
	title := "ReChat - Only Chat"
	if focusExistingWindow(title) {
		return
	}
	exePath, err := os.Executable()
	if err != nil {
		exePath = os.Args[0]
	}
	cmd := exec.Command(exePath, "-mode", "chat")
	if err := cmd.Start(); err != nil {
		fmt.Printf("Error starting chat window: %v\n", err)
	}
}

func (a *App) OpenSettingsWindow() {
	title := "StreamVoice - Панель стримера"
	if focusExistingWindow(title) {
		return
	}
	exePath, err := os.Executable()
	if err != nil {
		exePath = os.Args[0]
	}
	cmd := exec.Command(exePath, "-mode", "settings")
	if err := cmd.Start(); err != nil {
		fmt.Printf("Error starting settings window: %v\n", err)
	}
}

func (a *App) GetInitialEvents() []eventbus.StreamEvent {
	return a.bus.GetEvents()
}

func (a *App) SendChatMessage(msg string) eventbus.StreamEvent {
	if msg == "" {
		return eventbus.StreamEvent{}
	}

	event := eventbus.StreamEvent{
		ID:       fmt.Sprintf("msg_%d", time.Now().UnixNano()),
		Type:     eventbus.EventChatMessage,
		Platform: "twitch",
		User: eventbus.User{
			ID:           "u_kristi",
			Username:     "kristi_plays",
			Color:        "#A855F7",
			Badges:       []string{"crown"},
			IsSubscriber: true,
		},
		Message:   msg,
		Timestamp: time.Now(),
	}

	a.bus.Publish(event)
	a.ttsSvc.Enqueue(event)
	return event
}

func (a *App) SendSimulatedDonate(username string, amount string, amountVal float64, msg string) {
	event := eventbus.StreamEvent{
		ID:       fmt.Sprintf("don_%d", time.Now().UnixNano()),
		Type:     eventbus.EventDonate,
		Platform: "donationalerts",
		User: eventbus.User{
			ID:       "u_donor",
			Username: username,
			Color:    "#FACC15",
		},
		Message: msg,
		Extra: map[string]interface{}{
			"amount":     amount,
			"amount_val": amountVal,
		},
		Timestamp: time.Now(),
	}

	a.bus.Publish(event)
	a.ttsSvc.Enqueue(event)
}

func (a *App) GetSettings() config.AppConfig {
	return a.cfg.Get()
}

func (a *App) SaveSettings(newCfg config.AppConfig) bool {
	err := a.cfg.Update(newCfg)
	return err == nil
}

func (a *App) TestTTS(voice string, text string) {
	a.ttsSvc.Test(voice, text)
}

func (a *App) GetTTSStatus() (string, int64) {
	return a.ttsSvc.GetStatus()
}

func (a *App) ConnectTwitch(channel string, oauth string) map[string]interface{} {
	ok, msg := a.twitchSvc.Connect(channel, oauth)
	if ok {
		c := a.cfg.Get()
		c.ChannelName = channel
		_ = a.cfg.Update(c)
	}
	return map[string]interface{}{
		"success": ok,
		"message": msg,
	}
}

func (a *App) DisconnectTwitch() map[string]interface{} {
	a.twitchSvc.Disconnect()
	return map[string]interface{}{
		"success": true,
		"message": "Отключено от Twitch",
	}
}

func (a *App) GetTwitchStatus() map[string]interface{} {
	connected, channel, lastErr := a.twitchSvc.GetStatus()
	return map[string]interface{}{
		"connected": connected,
		"channel":   channel,
		"error":     lastErr,
	}
}

func (a *App) seedInitialEvents() {
	events := []eventbus.StreamEvent{
		{
			ID:       "msg_1",
			Type:     eventbus.EventChatMessage,
			Platform: "twitch",
			User: eventbus.User{
				ID:       "u_alex",
				Username: "alex_gamer",
				Color:    "#06B6D4",
				Badges:   []string{"shield"},
			},
			Message:   "вечер добрый! кого сегодня качаем, Кристи?",
			Timestamp: time.Now().Add(-5 * time.Minute),
		},
		{
			ID:       "don_1",
			Type:     eventbus.EventDonate,
			Platform: "donationalerts",
			User: eventbus.User{
				ID:       "u_boris",
				Username: "boris_2000",
				Color:    "#FACC15",
			},
			Message: "«за обзор этой игры — ты лучший!»",
			Extra: map[string]interface{}{
				"amount":     "500 ₽",
				"amount_val": 500.0,
			},
			Timestamp: time.Now().Add(-4 * time.Minute),
		},
		{
			ID:       "msg_2",
			Type:     eventbus.EventChatMessage,
			Platform: "twitch",
			User: eventbus.User{
				ID:           "u_kate",
				Username:     "lucky_kate",
				Color:        "#EC4899",
				Badges:       []string{"heart"},
				IsSubscriber: true,
			},
			Message:   "ура, наконец-то стрим 🥳",
			Timestamp: time.Now().Add(-3 * time.Minute),
		},
		{
			ID:       "fol_1",
			Type:     eventbus.EventFollow,
			Platform: "twitch",
			User: eventbus.User{
				ID:       "u_masha",
				Username: "masha_k",
				Color:    "#22C55E",
			},
			Message: "спасибо, что залетел на огонёк!",
			Extra: map[string]interface{}{
				"count": 1,
			},
			Timestamp: time.Now().Add(-2 * time.Minute),
		},
		{
			ID:       "msg_3",
			Type:     eventbus.EventChatMessage,
			Platform: "twitch",
			User: eventbus.User{
				ID:       "u_steel",
				Username: "steel_wolf",
				Color:    "#FACC15",
				Badges:   []string{"crown"},
			},
			Message:   "топовый контент как всегда 🔥",
			Timestamp: time.Now().Add(-1 * time.Minute),
		},
		{
			ID:       "sub_1",
			Type:     eventbus.EventSubscribe,
			Platform: "twitch",
			User: eventbus.User{
				ID:       "u_mike",
				Username: "mike_odessa",
				Color:    "#A855F7",
				Badges:   []string{"sparkles"},
			},
			Message: "оформил подписку на канал!",
			Extra: map[string]interface{}{
				"tier": "Tier 1",
			},
			Timestamp: time.Now(),
		},
	}

	for _, ev := range events {
		a.bus.Publish(ev)
	}
}

func (a *App) simulateLiveEvents(ctx context.Context) {
	ticker := time.NewTicker(20 * time.Second)
	defer ticker.Stop()

	sampleUsers := []eventbus.User{
		{ID: "u_dima", Username: "dima_pro", Color: "#3B82F6", Badges: []string{}},
		{ID: "u_anna", Username: "anna_stream", Color: "#F43F5E", Badges: []string{"heart"}},
		{ID: "u_serg", Username: "sergey_vl", Color: "#10B981", Badges: []string{"shield"}},
	}

	sampleMessages := []string{
		"Размеры окон точно зафиксированы!",
		"Кнопка настроек фокусирует уже открытое окно ⚙️",
		"Окна не дублируются в системе!",
		"Go + Wails работа с Win32 API отличная 🔥",
	}

	idx := 0
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			u := sampleUsers[idx%len(sampleUsers)]
			msg := sampleMessages[idx%len(sampleMessages)]
			idx++

			event := eventbus.StreamEvent{
				ID:        fmt.Sprintf("live_%d", time.Now().UnixNano()),
				Type:      eventbus.EventChatMessage,
				Platform:  "twitch",
				User:      u,
				Message:   msg,
				Timestamp: time.Now(),
			}
			a.bus.Publish(event)
		}
	}
}
