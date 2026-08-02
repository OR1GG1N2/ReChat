package twitch

import (
	"bufio"
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"strings"
	"sync"
	"time"

	"rechat/internal/eventbus"
)

type TwitchService struct {
	mu        sync.Mutex
	ctx       context.Context
	cancel    context.CancelFunc
	bus       *eventbus.EventBus
	connected bool
	channel   string
	oauth     string
	lastError string
	conn      net.Conn
	reconnect bool
}

func NewTwitchService(bus *eventbus.EventBus) *TwitchService {
	return &TwitchService{
		bus: bus,
	}
}

func (s *TwitchService) Connect(channel string, oauth string) (bool, string) {
	s.mu.Lock()
	if s.connected {
		s.mu.Unlock()
		s.Disconnect()
		s.mu.Lock()
	}

	channel = strings.TrimPrefix(strings.TrimSpace(strings.ToLower(channel)), "@")
	if channel == "" {
		s.mu.Unlock()
		return false, "Имя канала Twitch не может быть пустым"
	}

	s.channel = channel
	s.oauth = strings.TrimSpace(oauth)
	s.reconnect = true
	s.lastError = ""

	ctx, cancel := context.WithCancel(context.Background())
	s.ctx = ctx
	s.cancel = cancel

	s.mu.Unlock()

	go s.runConnectionLoop(ctx, channel, oauth)

	return true, fmt.Sprintf("Подключение к каналу #%s запущено", channel)
}

func (s *TwitchService) Disconnect() {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.reconnect = false
	s.connected = false
	if s.cancel != nil {
		s.cancel()
		s.cancel = nil
	}
	if s.conn != nil {
		s.conn.Close()
		s.conn = nil
	}
}

func (s *TwitchService) GetStatus() (bool, string, string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.connected, s.channel, s.lastError
}

func (s *TwitchService) runConnectionLoop(ctx context.Context, channel string, oauth string) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		err := s.connectAndRead(ctx, channel, oauth)
		if err != nil {
			s.mu.Lock()
			s.connected = false
			s.lastError = err.Error()
			reconn := s.reconnect
			s.mu.Unlock()

			if !reconn {
				return
			}
			// Retry after 5 seconds
			time.Sleep(5 * time.Second)
		}
	}
}

func (s *TwitchService) connectAndRead(ctx context.Context, channel string, oauth string) error {
	dialer := &net.Dialer{Timeout: 10 * time.Second}
	conn, err := tls.DialWithDialer(dialer, "tcp", "irc.chat.twitch.tv:6697", nil)
	if err != nil {
		return fmt.Errorf("ошибка подключения к IRC Twitch: %v", err)
	}
	defer conn.Close()

	s.mu.Lock()
	s.conn = conn
	s.mu.Unlock()

	pass := "SCHMOOPIIE"
	nick := fmt.Sprintf("justinfan%d", time.Now().Unix()%89999+10000)

	if oauth != "" {
		if !strings.HasPrefix(oauth, "oauth:") {
			pass = "oauth:" + oauth
		} else {
			pass = oauth
		}
		nick = channel
	}

	fmt.Fprintf(conn, "PASS %s\r\n", pass)
	fmt.Fprintf(conn, "NICK %s\r\n", nick)
	fmt.Fprintf(conn, "CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership\r\n")
	fmt.Fprintf(conn, "JOIN #%s\r\n", channel)

	reader := bufio.NewReader(conn)

	s.mu.Lock()
	s.connected = true
	s.lastError = ""
	s.mu.Unlock()

	// Notify status connected
	s.publishSystemStatus(fmt.Sprintf("Подключено к чату Twitch #%s", channel))

	for {
		select {
		case <-ctx.Done():
			return nil
		default:
		}

		_ = conn.SetReadDeadline(time.Now().Add(5 * time.Minute))
		line, err := reader.ReadString('\n')
		if err != nil {
			return fmt.Errorf("соединение разорвано: %v", err)
		}

		line = strings.TrimRight(line, "\r\n")
		if line == "" {
			continue
		}

		if strings.HasPrefix(line, "PING") {
			pongMsg := strings.Replace(line, "PING", "PONG", 1) + "\r\n"
			conn.Write([]byte(pongMsg))
			continue
		}

		s.parseIRCLine(line, channel)
	}
}

func (s *TwitchService) parseIRCLine(line string, channel string) {
	if !strings.Contains(line, "PRIVMSG") {
		return
	}

	tags := make(map[string]string)
	rawLine := line

	if strings.HasPrefix(line, "@") {
		parts := strings.SplitN(line, " ", 2)
		if len(parts) == 2 {
			tagStr := strings.TrimPrefix(parts[0], "@")
			for _, tag := range strings.Split(tagStr, ";") {
				kv := strings.SplitN(tag, "=", 2)
				if len(kv) == 2 {
					tags[kv[0]] = kv[1]
				}
			}
			rawLine = parts[1]
		}
	}

	// Parse PRIVMSG
	msgIdx := strings.Index(rawLine, fmt.Sprintf("PRIVMSG #%s :", channel))
	if msgIdx == -1 {
		// try lower case
		msgIdx = strings.Index(rawLine, "PRIVMSG #")
		if msgIdx != -1 {
			colonIdx := strings.Index(rawLine[msgIdx:], " :")
			if colonIdx != -1 {
				msgIdx = msgIdx + colonIdx + 2
			} else {
				return
			}
		} else {
			return
		}
	} else {
		msgIdx += len(fmt.Sprintf("PRIVMSG #%s :", channel))
	}

	msgText := rawLine[msgIdx:]

	username := tags["display-name"]
	if username == "" {
		// Extract nick from :nick!nick@...
		if strings.HasPrefix(rawLine, ":") {
			exclIdx := strings.Index(rawLine, "!")
			if exclIdx != -1 {
				username = rawLine[1:exclIdx]
			}
		}
	}
	if username == "" {
		username = "Twitch User"
	}

	userColor := tags["color"]
	if userColor == "" {
		userColor = "#A855F7"
	}

	isSub := tags["subscriber"] == "1" || strings.Contains(tags["badges"], "subscriber")
	isMod := tags["mod"] == "1" || strings.Contains(tags["badges"], "moderator")

	badges := []string{}
	if isMod {
		badges = append(badges, "shield")
	}
	if isSub {
		badges = append(badges, "sparkles")
	}
	if strings.Contains(tags["badges"], "broadcaster") {
		badges = append(badges, "crown")
	}

	event := eventbus.StreamEvent{
		ID:       fmt.Sprintf("tw_%d", time.Now().UnixNano()),
		Type:     eventbus.EventChatMessage,
		Platform: "twitch",
		User: eventbus.User{
			ID:           tags["user-id"],
			Username:     username,
			Color:        userColor,
			Badges:       badges,
			IsSubscriber: isSub,
		},
		Message:   msgText,
		Timestamp: time.Now(),
	}

	s.bus.Publish(event)
}

func (s *TwitchService) publishSystemStatus(msg string) {
	event := eventbus.StreamEvent{
		ID:       fmt.Sprintf("sys_%d", time.Now().UnixNano()),
		Type:     eventbus.EventChatMessage,
		Platform: "system",
		User: eventbus.User{
			ID:       "system",
			Username: "Система",
			Color:    "#22C55E",
			Badges:   []string{"shield"},
		},
		Message:   msg,
		Timestamp: time.Now(),
	}
	s.bus.Publish(event)
}
