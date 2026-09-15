package tts

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// ──────────────────────────────────────────────
// JSON protocol structures for Yandex Alice TTS
// ──────────────────────────────────────────────

type eventHeader struct {
	MessageID string `json:"messageId"`
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
}

type eventWrapper[T any] struct {
	Event struct {
		Header  eventHeader `json:"header"`
		Payload T           `json:"payload"`
	} `json:"event"`
}

// SynchronizeState payload
type syncStatePayload struct {
	AcceptInvalidAuth  bool              `json:"accept_invalid_auth"`
	AuthToken          string            `json:"auth_token"`
	Device             string            `json:"device"`
	DeviceManufacturer string            `json:"device_manufacturer"`
	DeviceModel        string            `json:"device_model"`
	DeviceRevision     string            `json:"device_revision"`
	Emotion            string            `json:"emotion"`
	NetworkType        string            `json:"network_type"`
	OAuthToken         string            `json:"oauth_token"`
	PlatformInfo       string            `json:"platform_info"`
	SpeechkitVersion   string            `json:"speechkit_version"`
	Speed              string            `json:"speed"`
	Uuid               string            `json:"uuid"`
	Voice              string            `json:"voice"`
	Yandexuid          string            `json:"yandexuid"`
	Vins               syncStateVins     `json:"vins"`
}

type syncStateVins struct {
	Application syncStateApp `json:"application"`
}

type syncStateApp struct {
	AppId              string `json:"app_id"`
	AppVersion         string `json:"app_version"`
	DeviceManufacturer string `json:"device_manufacturer"`
	DeviceModel        string `json:"device_model"`
	DeviceRevision     string `json:"device_revision"`
	OsVersion          string `json:"os_version"`
	Platform           string `json:"platform"`
	Uuid               string `json:"uuid"`
}

// TTS Generate payload
type ttsGeneratePayload struct {
	Emotion    string `json:"emotion"`
	Format     string `json:"format"`
	Lang       string `json:"lang"`
	OAuthToken string `json:"oauth_token"`
	Quality    string `json:"quality"`
	Text       string `json:"text"`
	Voice      string `json:"voice"`
}

// TTS SpeechFinished payload (empty)
type ttsSpeechFinished struct{}

// ──────────────────────────────────────────
// Available voices
// ──────────────────────────────────────────

// Voices is the primary set of supported voices
var Voices = []string{"shitova.us", "ermil", "zahar", "jane", "alyss", "omazh", "oksana"}

// VoiceLabels maps voice ID to a human-friendly label
var VoiceLabels = map[string]string{
	"shitova.us": "Алиса (женский)",
	"ermil":      "Ермил (мужской)",
	"zahar":      "Захар (мужской)",
	"jane":       "Джейн (женский)",
	"alyss":      "Алисса (женский)",
	"omazh":      "Омаж (женский)",
	"oksana":     "Оксана (женский)",
}

// ──────────────────────────────────────────
// YandexTTS client
// ──────────────────────────────────────────

const (
	defaultAuthToken    = "14e2f152-e03a-439d-9abe-f470c27db24e"
	speechkitVersion    = "4.15.0"
	wsEndpoint          = "wss://uniproxy.alice.yandex.net/uni.ws"
	osVersion           = "10.0.22631"
)

type YandexTTS struct {
	mu        sync.Mutex
	authToken string
	uuid      string // persistent device UUID
	ssid      string // session id per connection
}

// NewYandexTTS creates a new TTS client instance.
// Each call to Speak() opens a fresh WebSocket, performs the TTS, and closes it.
func NewYandexTTS() *YandexTTS {
	return &YandexTTS{
		authToken: defaultAuthToken,
		uuid:      generateUUID(),
	}
}

// Speak synthesizes speech from text using the given voice.
// Returns a data URI string: "data:audio/ogg;base64,..."
func (y *YandexTTS) Speak(text, voice string) (string, error) {
	y.mu.Lock()
	defer y.mu.Unlock()

	if text == "" {
		return "", fmt.Errorf("text is empty")
	}
	if voice == "" {
		voice = Voices[0]
	}

	// Validate voice
	validVoice := false
	for _, v := range Voices {
		if v == voice {
			validVoice = true
			break
		}
	}
	if !validVoice {
		voice = Voices[0]
	}

	y.ssid = generateUUID()

	// Connect WebSocket with custom headers
	dialer := websocket.Dialer{
		HandshakeTimeout: 15 * time.Second,
	}

	header := http.Header{}
	header.Set("User-Agent", "WebSocket++/0.8.2")
	header.Set("X-UPRX-APP-ID", "YaBro")
	header.Set("X-UPRX-APP-VERSION", "Windows")
	header.Set("X-UPRX-AUTH-TOKEN", y.authToken)
	header.Set("X-UPRX-OS-VERSION", osVersion)
	header.Set("X-UPRX-PLATFORM", "Windows")
	header.Set("X-UPRX-SPEECHKIT-VERSION", speechkitVersion)
	header.Set("X-UPRX-SSID", y.ssid)
	header.Set("X-UPRX-UUID", y.uuid)

	conn, _, err := dialer.Dial(wsEndpoint, header)
	if err != nil {
		return "", fmt.Errorf("websocket connect failed: %w", err)
	}
	defer conn.Close()

	// 1. Send SynchronizeState
	syncMsg := y.buildSyncState(voice)
	if err := conn.WriteMessage(websocket.TextMessage, []byte(syncMsg)); err != nil {
		return "", fmt.Errorf("failed to send SynchronizeState: %w", err)
	}

	// 2. Wait for SynchronizeStateResponse
	if err := y.waitForSyncResponse(conn); err != nil {
		return "", fmt.Errorf("sync state failed: %w", err)
	}

	// 3. Send TTS.Generate
	genMsg := y.buildTTSGenerate(text, voice)
	if err := conn.WriteMessage(websocket.TextMessage, []byte(genMsg)); err != nil {
		return "", fmt.Errorf("failed to send TTS.Generate: %w", err)
	}

	// 4. Collect audio chunks until streamcontrol
	audioChunks := make([]byte, 0, 64*1024)
	for {
		msgType, data, err := conn.ReadMessage()
		if err != nil {
			if len(audioChunks) > 0 {
				break // Got some data, connection closed - return what we have
			}
			return "", fmt.Errorf("read error: %w", err)
		}

		if msgType == websocket.BinaryMessage {
			// Skip first 4 bytes (header) from each binary chunk
			if len(data) > 4 {
				audioChunks = append(audioChunks, data[4:]...)
			}
		} else if msgType == websocket.TextMessage {
			// Check for streamcontrol (end of audio)
			textStr := string(data)
			if strings.Contains(textStr, "streamcontrol") {
				// Send SpeechFinished acknowledgment
				finMsg := y.buildSpeechFinished()
				_ = conn.WriteMessage(websocket.TextMessage, []byte(finMsg))
				break
			}
			// "directive" messages (like Speak) are informational, continue
		}
	}

	if len(audioChunks) == 0 {
		return "", fmt.Errorf("no audio data received")
	}

	// Encode to base64 data URI
	b64 := base64.StdEncoding.EncodeToString(audioChunks)
	dataURI := "data:audio/ogg;base64," + b64

	log.Printf("[TTS] Generated %d bytes of audio for voice=%s", len(audioChunks), voice)
	return dataURI, nil
}

// GetVoices returns the list of available voice IDs
func GetVoices() []string {
	return Voices
}

// GetVoiceMap returns voice IDs mapped to human labels
func GetVoiceMap() map[string]string {
	return VoiceLabels
}

// Close is a no-op since we use per-request connections
func (y *YandexTTS) Close() {
	// Nothing to close — connections are per-request
}

// ──────────────────────────────────────────
// Internal message builders
// ──────────────────────────────────────────

func (y *YandexTTS) buildSyncState(voice string) string {
	evt := eventWrapper[syncStatePayload]{
		Event: struct {
			Header  eventHeader      `json:"header"`
			Payload syncStatePayload `json:"payload"`
		}{
			Header: eventHeader{
				MessageID: generateUUID(),
				Name:      "SynchronizeState",
				Namespace: "System",
			},
			Payload: syncStatePayload{
				AcceptInvalidAuth:  true,
				AuthToken:          y.authToken,
				Device:             " ",
				DeviceManufacturer: "",
				DeviceModel:        "",
				DeviceRevision:     "",
				Emotion:            "neutral",
				NetworkType:        "",
				OAuthToken:         "",
				PlatformInfo:       "Windows",
				SpeechkitVersion:   speechkitVersion,
				Speed:              "1",
				Uuid:               y.uuid,
				Voice:              voice,
				Yandexuid:          "",
				Vins: syncStateVins{
					Application: syncStateApp{
						AppId:              "YaBro",
						AppVersion:         "Windows",
						DeviceManufacturer: "",
						DeviceModel:        "",
						DeviceRevision:     "",
						OsVersion:          osVersion,
						Platform:           "Windows",
						Uuid:               y.uuid,
					},
				},
			},
		},
	}
	b, _ := json.Marshal(evt)
	return string(b)
}

func (y *YandexTTS) buildTTSGenerate(text, voice string) string {
	evt := eventWrapper[ttsGeneratePayload]{
		Event: struct {
			Header  eventHeader        `json:"header"`
			Payload ttsGeneratePayload `json:"payload"`
		}{
			Header: eventHeader{
				MessageID: generateUUID(),
				Name:      "Generate",
				Namespace: "TTS",
			},
			Payload: ttsGeneratePayload{
				Emotion:    "neutral",
				Format:     "audio/opus",
				Lang:       "ru-RU",
				OAuthToken: "",
				Quality:    "UltraHigh",
				Text:       text,
				Voice:      voice,
			},
		},
	}
	b, _ := json.Marshal(evt)
	return string(b)
}

func (y *YandexTTS) buildSpeechFinished() string {
	evt := eventWrapper[ttsSpeechFinished]{
		Event: struct {
			Header  eventHeader        `json:"header"`
			Payload ttsSpeechFinished  `json:"payload"`
		}{
			Header: eventHeader{
				MessageID: generateUUID(),
				Name:      "SpeechFinished",
				Namespace: "TTS",
			},
			Payload: ttsSpeechFinished{},
		},
	}
	b, _ := json.Marshal(evt)
	return string(b)
}

func (y *YandexTTS) waitForSyncResponse(conn *websocket.Conn) error {
	// Set a deadline for the sync response
	conn.SetReadDeadline(time.Now().Add(10 * time.Second))
	defer conn.SetReadDeadline(time.Time{}) // reset

	for {
		msgType, data, err := conn.ReadMessage()
		if err != nil {
			return fmt.Errorf("waiting for sync response: %w", err)
		}
		if msgType == websocket.TextMessage {
			textStr := string(data)
			if strings.Contains(textStr, "SynchronizeStateResponse") {
				return nil
			}
		}
	}
}

// generateUUID produces a v4 UUID string.
func generateUUID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	// Set version 4 bits
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
