package config

import (
	"database/sql"
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"strconv"

	_ "modernc.org/sqlite"
)

type AppSettings struct {
	DefaultChannel      string            `json:"defaultChannel"`
	FontSize            int               `json:"fontSize"`            // 12, 14, 16, 18
	ShowTimestamps      bool              `json:"showTimestamps"`      // true / false
	TimestampFormat     string            `json:"timestampFormat"`     // "HH:MM:SS" or "HH:MM"
	ShowBadges          bool              `json:"showBadges"`          // true / false
	ChannelBadgeMode    string            `json:"channelBadgeMode"`    // "name", "icon_only", "icon_bg", "accent_line"
	IconColor           string            `json:"iconColor"`           // "purple", "white", "emerald", "amber", "cyan", "rose", "channel"
	MaxMessages         int               `json:"maxMessages"`         // 100 - 1000
	OAuthToken          string            `json:"oauthToken"`          // oauth token
	Username            string            `json:"username"`            // authenticated user
	ClientID            string            `json:"clientId"`            // twitch client id
	JoinedChannels      []string          `json:"joinedChannels"`      // list of joined channels
	ChannelColors       map[string]string `json:"channelColors"`       // channel -> custom hex/hsl background color
	TTSEnabled          bool              `json:"ttsEnabled"`          // enable/disable TTS
	TTSVolume           float64           `json:"ttsVolume"`           // 0.0 to 1.0
	TTSEngine           string            `json:"ttsEngine"`           // "yandex" or "local"
	TTSVoice            string            `json:"ttsVoice"`            // selected Yandex TTS voice
	TTSVoiceLocal       string            `json:"ttsVoiceLocal"`       // selected Local OS voice name
	IgnoreCommands      bool              `json:"ignoreCommands"`      // ignore messages starting with command symbols
	CommandPrefixes     string            `json:"commandPrefixes"`     // comma separated command symbols, e.g. "!,/,.,$,?"
	IgnoreEmotesOnly    bool              `json:"ignoreEmotesOnly"`    // ignore messages containing only emotes
	TTSFilterEmotes     bool              `json:"ttsFilterEmotes"`     // strip emotes from TTS speech
	IgnoredUsers        []string          `json:"ignoredUsers"`        // list of ignored usernames (bots, users)
	HideIgnoredFromChat bool              `json:"hideIgnoredFromChat"` // hide ignored messages from chat UI as well as TTS
}

func DefaultSettings() AppSettings {
	return AppSettings{
		DefaultChannel:      "",
		FontSize:            14,
		ShowTimestamps:      true,
		TimestampFormat:     "HH:MM:SS",
		ShowBadges:          true,
		ChannelBadgeMode:    "name",
		IconColor:           "purple",
		MaxMessages:         300,
		OAuthToken:          "",
		Username:            "",
		ClientID:            TwitchClientID,
		JoinedChannels:      []string{},
		ChannelColors:       make(map[string]string),
		TTSEnabled:          false,
		TTSVolume:           1.0,
		TTSEngine:           "yandex",
		TTSVoice:            "shitova.us",
		TTSVoiceLocal:       "",
		IgnoreCommands:      true,
		CommandPrefixes:     "!, /, ., $, ?",
		IgnoreEmotesOnly:    false,
		TTSFilterEmotes:     true,
		IgnoredUsers:        []string{"Nightbot", "StreamElements", "Moobot", "Fossabot"},
		HideIgnoredFromChat: false,
	}
}

func GetDBPath() string {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return DBFileName
	}
	appDir := filepath.Join(configDir, "ReChat")
	_ = os.MkdirAll(appDir, 0755)
	return filepath.Join(appDir, DBFileName)
}

func getDB() (*sql.DB, error) {
	dbPath := GetDBPath()
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, err
	}

	createTable := `
	CREATE TABLE IF NOT EXISTS settings (
		key TEXT PRIMARY KEY,
		value TEXT
	);`
	_, err = db.Exec(createTable)
	if err != nil {
		_ = db.Close()
		return nil, err
	}
	return db, nil
}

func LoadSettings() AppSettings {
	s := DefaultSettings()
	db, err := getDB()
	if err != nil {
		log.Printf("Error opening SQLite DB: %v", err)
		return s
	}
	defer db.Close()

	rows, err := db.Query("SELECT key, value FROM settings")
	if err != nil {
		return s
	}
	defer rows.Close()

	for rows.Next() {
		var key, val string
		if err := rows.Scan(&key, &val); err == nil {
			switch key {
			case "defaultChannel":
				s.DefaultChannel = val
			case "fontSize":
				if v, err := strconv.Atoi(val); err == nil && v > 0 {
					s.FontSize = v
				}
			case "showTimestamps":
				s.ShowTimestamps = (val == "true")
			case "timestampFormat":
				if val != "" {
					s.TimestampFormat = val
				}
			case "showBadges":
				s.ShowBadges = (val == "true")
			case "channelBadgeMode":
				if val != "" {
					s.ChannelBadgeMode = val
				}
			case "iconColor":
				if val != "" {
					s.IconColor = val
				}
			case "maxMessages":
				if v, err := strconv.Atoi(val); err == nil && v > 0 {
					s.MaxMessages = v
				}
			case "oauthToken":
				s.OAuthToken = val
			case "username":
				s.Username = val
			case "clientId":
				if val != "" {
					s.ClientID = val
				}
			case "joinedChannels":
				var chans []string
				if err := json.Unmarshal([]byte(val), &chans); err == nil {
					s.JoinedChannels = chans
				}
			case "channelColors":
				var colMap map[string]string
				if err := json.Unmarshal([]byte(val), &colMap); err == nil {
					s.ChannelColors = colMap
				}
			case "ttsEnabled":
				s.TTSEnabled = (val == "true")
			case "ttsVolume":
				if v, err := strconv.ParseFloat(val, 64); err == nil {
					s.TTSVolume = v
				}
			case "ttsEngine":
				if val != "" {
					s.TTSEngine = val
				}
			case "ttsVoice":
				if val != "" {
					s.TTSVoice = val
				}
			case "ttsVoiceLocal":
				if val != "" {
					s.TTSVoiceLocal = val
				}
			case "ignoreCommands":
				s.IgnoreCommands = (val == "true")
			case "commandPrefixes":
				if val != "" {
					s.CommandPrefixes = val
				}
			case "ignoreEmotesOnly":
				s.IgnoreEmotesOnly = (val == "true")
			case "ttsFilterEmotes":
				s.TTSFilterEmotes = (val == "true")
			case "ignoredUsers":
				var users []string
				if err := json.Unmarshal([]byte(val), &users); err == nil {
					s.IgnoredUsers = users
				}
			case "hideIgnoredFromChat":
				s.HideIgnoredFromChat = (val == "true")
			}
		}
	}

	return s
}

func SaveSettings(s AppSettings) error {
	db, err := getDB()
	if err != nil {
		return err
	}
	defer db.Close()

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
	if err != nil {
		return err
	}
	defer stmt.Close()

	chansJSON, _ := json.Marshal(s.JoinedChannels)
	colorsJSON, _ := json.Marshal(s.ChannelColors)
	ignoredUsersJSON, _ := json.Marshal(s.IgnoredUsers)

	pairs := map[string]string{
		"defaultChannel":      s.DefaultChannel,
		"fontSize":            strconv.Itoa(s.FontSize),
		"showTimestamps":      strconv.FormatBool(s.ShowTimestamps),
		"timestampFormat":     s.TimestampFormat,
		"showBadges":          strconv.FormatBool(s.ShowBadges),
		"channelBadgeMode":    s.ChannelBadgeMode,
		"iconColor":           s.IconColor,
		"maxMessages":         strconv.Itoa(s.MaxMessages),
		"oauthToken":          s.OAuthToken,
		"username":            s.Username,
		"clientId":            s.ClientID,
		"joinedChannels":      string(chansJSON),
		"channelColors":       string(colorsJSON),
		"ttsEnabled":          strconv.FormatBool(s.TTSEnabled),
		"ttsVolume":           strconv.FormatFloat(s.TTSVolume, 'f', 2, 64),
		"ttsEngine":           s.TTSEngine,
		"ttsVoice":            s.TTSVoice,
		"ttsVoiceLocal":       s.TTSVoiceLocal,
		"ignoreCommands":      strconv.FormatBool(s.IgnoreCommands),
		"commandPrefixes":     s.CommandPrefixes,
		"ignoreEmotesOnly":    strconv.FormatBool(s.IgnoreEmotesOnly),
		"ttsFilterEmotes":     strconv.FormatBool(s.TTSFilterEmotes),
		"ignoredUsers":        string(ignoredUsersJSON),
		"hideIgnoredFromChat": strconv.FormatBool(s.HideIgnoredFromChat),
	}

	for k, v := range pairs {
		if _, err := stmt.Exec(k, v); err != nil {
			return err
		}
	}

	return tx.Commit()
}
