package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

type AppConfig struct {
	TTSEnabled       bool    `json:"tts_enabled"`
	TTSVoice         string  `json:"tts_voice"`
	TTSSpeed         float64 `json:"tts_speed"`
	TTSPitch         float64 `json:"tts_pitch"`
	TTSForDonates    bool    `json:"tts_for_donates"`
	TTSForSubs       bool    `json:"tts_for_subs"`
	MinDonateAmount  float64 `json:"min_donate_amount"`
	SkipLinksAndEmoji bool   `json:"skip_links_and_emoji"`
	ChannelName      string  `json:"channel_name"`
	StreamPlatform   string  `json:"stream_platform"`
	ViewerCount      int     `json:"viewer_count"`
}

func DefaultConfig() AppConfig {
	return AppConfig{
		TTSEnabled:       true,
		TTSVoice:         "Алёна (Yandex Premium / Neural)",
		TTSSpeed:         1.0,
		TTSPitch:         1.0,
		TTSForDonates:    true,
		TTSForSubs:       true,
		MinDonateAmount:  50.0,
		SkipLinksAndEmoji: true,
		ChannelName:      "kristi_plays",
		StreamPlatform:   "twitch",
		ViewerCount:      1284,
	}
}

type ConfigManager struct {
	mu       sync.Mutex
	path     string
	current  AppConfig
}

func NewConfigManager() *ConfigManager {
	home, _ := os.UserHomeDir()
	configDir := filepath.Join(home, ".rechat")
	_ = os.MkdirAll(configDir, 0755)
	filePath := filepath.Join(configDir, "config.json")

	cm := &ConfigManager{
		path:    filePath,
		current: DefaultConfig(),
	}
	_ = cm.Load()
	return cm
}

func (cm *ConfigManager) Get() AppConfig {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	return cm.current
}

func (cm *ConfigManager) Update(cfg AppConfig) error {
	cm.mu.Lock()
	cm.current = cfg
	cm.mu.Unlock()
	return cm.Save()
}

func (cm *ConfigManager) Load() error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	data, err := os.ReadFile(cm.path)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, &cm.current)
}

func (cm *ConfigManager) Save() error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	data, err := json.MarshalIndent(cm.current, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(cm.path, data, 0644)
}
