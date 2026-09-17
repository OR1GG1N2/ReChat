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
	UserID              string            `json:"userId"`              // authenticated user twitch id
	ClientID            string            `json:"clientId"`            // twitch client id
	JoinedChannels      []string          `json:"joinedChannels"`      // list of joined channels
	ChannelColors       map[string]string `json:"channelColors"`       // channel -> custom hex/hsl background color
	TTSEnabled          bool              `json:"ttsEnabled"`          // enable/disable TTS
	TTSVolume           float64           `json:"ttsVolume"`           // 0.0 to 1.0
	TTSEngine           string            `json:"ttsEngine"`           // "yandex" or "local"
	TTSVoice            string            `json:"ttsVoice"`            // selected Yandex TTS voice
	TTSVoiceLocal       string            `json:"ttsVoiceLocal"`       // selected Local OS voice name
	TTSSpeed            float64           `json:"ttsSpeed"`            // 0.5 to 2.0 (default 1.0)
	TTSAudioDevice      string            `json:"ttsAudioDevice"`      // output audio device ID
	TTSSkipHotkey       string            `json:"ttsSkipHotkey"`       // hotkey to skip current TTS (e.g. "Escape")
	TTSAllMessages      bool              `json:"ttsAllMessages"`      // speak all chat messages
	TTSRepliesOnly      bool              `json:"ttsRepliesOnly"`      // speak messages with replies
	TTSHighlightedOnly  bool              `json:"ttsHighlightedOnly"`  // speak highlighted messages
	TTSSubscribersOnly  bool              `json:"ttsSubscribersOnly"`  // speak subscriber messages
	TTSVipOnly          bool              `json:"ttsVipOnly"`          // speak VIP messages
	TTSModOnly          bool              `json:"ttsModOnly"`          // speak moderator messages
	TTSIncludeUsername  bool              `json:"ttsIncludeUsername"`  // speak author name
	TTSIncludeLinks     bool              `json:"ttsIncludeLinks"`     // speak URLs
	TTSIncludeEmotes    bool              `json:"ttsIncludeEmotes"`    // speak emotes
	TTSIncludeEmoji     bool              `json:"ttsIncludeEmoji"`     // speak unicode emoji
	TTSIncludeMentions  bool              `json:"ttsIncludeMentions"`  // speak @mentions
	TTSRemoveWords      string            `json:"ttsRemoveWords"`      // words/symbols to remove from speech
	IgnoreCommands      bool              `json:"ignoreCommands"`      // ignore messages starting with command symbols
	CommandPrefixes     string            `json:"commandPrefixes"`     // comma separated command symbols, e.g. "!,/,.,$,?"
	IgnoreEmotesOnly    bool              `json:"ignoreEmotesOnly"`    // ignore messages containing only emotes
	TTSFilterEmotes     bool              `json:"ttsFilterEmotes"`     // strip emotes from TTS speech
	IgnoredUsers        []string          `json:"ignoredUsers"`        // list of ignored usernames (bots, users)
	HideIgnoredFromChat bool              `json:"hideIgnoredFromChat"` // hide ignored messages from chat UI as well as TTS
	AlwaysOnTop         bool              `json:"alwaysOnTop"`         // show chat on top of all windows
	FontFamily          string            `json:"fontFamily"`          // "Lato", "Inter", "Geist", "Roboto", "JetBrains Mono"
	MessageSpacing      string            `json:"messageSpacing"`      // "compact", "default", "relaxed"
	TextAlign           string            `json:"textAlign"`           // "left", "center", "right"
	ProxyEnabled        bool              `json:"proxyEnabled"`        // use proxy for network requests
	ProxyType           string            `json:"proxyType"`           // "http", "socks5", "warp"
	ProxyAddress        string            `json:"proxyAddress"`        // host:port e.g. "127.0.0.1:7890" or "127.0.0.1:40000"
	ProxyAuth           bool              `json:"proxyAuth"`           // require authentication
	ProxyUser           string            `json:"proxyUser"`           // proxy username
	ProxyPassword       string            `json:"proxyPassword"`       // proxy password
	// WireGuard embedded tunnel config (populated on .conf import)
	WireGuardPrivateKey string            `json:"wireGuardPrivateKey"` // WireGuard private key (base64)
	WireGuardPublicKey  string            `json:"wireGuardPublicKey"`  // WireGuard peer public key (base64)
	WireGuardAddress    string            `json:"wireGuardAddress"`    // tunnel local address e.g. "10.x.x.x/32"
	WireGuardDNS        string            `json:"wireGuardDNS"`        // DNS server(s) inside tunnel
	WireGuardEndpoint   string            `json:"wireGuardEndpoint"`   // peer endpoint "host:port"
	WireGuardAllowedIPs string            `json:"wireGuardAllowedIPs"` // allowed IPs e.g. "0.0.0.0/0"
	// Music widget configuration
	MusicStyle          string            `json:"musicStyle"`          // "glass", "compact", "vinyl", "neon", "minimal"
	MusicAccentColor    string            `json:"musicAccentColor"`    // "emerald", "blue", "purple", "pink", "amber", "white"
	MusicShowCover      bool              `json:"musicShowCover"`      // show album art cover
	MusicShowVisualizer bool              `json:"musicShowVisualizer"` // show audio visualizer bars
	MusicShowArtist     bool              `json:"musicShowArtist"`     // show artist / album
	MusicHideOnPause    bool              `json:"musicHideOnPause"`    // hide widget when paused
	MusicPauseDelay     int               `json:"musicPauseDelay"`     // seconds before fading out on pause
	MusicScale          int               `json:"musicScale"`          // scale percent (e.g. 100)
	MusicBgOpacity      int               `json:"musicBgOpacity"`      // background opacity 0-100 (default 85)
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
		TTSSpeed:            1.0,
		TTSAudioDevice:      "",
		TTSSkipHotkey:       "Escape",
		TTSAllMessages:      true,
		TTSRepliesOnly:      false,
		TTSHighlightedOnly:  false,
		TTSSubscribersOnly:  false,
		TTSVipOnly:          false,
		TTSModOnly:          false,
		TTSIncludeUsername:  false,
		TTSIncludeLinks:     false,
		TTSIncludeEmotes:    false,
		TTSIncludeEmoji:     false,
		TTSIncludeMentions:  true,
		TTSRemoveWords:      "",
		IgnoreCommands:      true,
		CommandPrefixes:     "!, /, ., $, ?",
		IgnoreEmotesOnly:    false,
		TTSFilterEmotes:     true,
		IgnoredUsers:        []string{"Nightbot", "StreamElements", "Moobot", "Fossabot"},
		HideIgnoredFromChat: false,
		AlwaysOnTop:         false,
		FontFamily:          "Lato",
		MessageSpacing:      "default",
		TextAlign:           "left",
		ProxyEnabled:        false,
		ProxyType:           "http",
		ProxyAddress:        "127.0.0.1:7890",
		ProxyAuth:           false,
		ProxyUser:           "",
		ProxyPassword:       "",
		MusicStyle:          "glass",
		MusicAccentColor:    "emerald",
		MusicShowCover:      true,
		MusicShowVisualizer: true,
		MusicShowArtist:     true,
		MusicHideOnPause:    true,
		MusicPauseDelay:     3,
		MusicScale:          100,
		MusicBgOpacity:      85,
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
			case "userId":
				s.UserID = val
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
			case "ttsSpeed":
				if v, err := strconv.ParseFloat(val, 64); err == nil && v > 0 {
					s.TTSSpeed = v
				}
			case "ttsAudioDevice":
				s.TTSAudioDevice = val
			case "ttsSkipHotkey":
				if val != "" {
					s.TTSSkipHotkey = val
				}
			case "ttsAllMessages":
				s.TTSAllMessages = (val == "true")
			case "ttsRepliesOnly":
				s.TTSRepliesOnly = (val == "true")
			case "ttsHighlightedOnly":
				s.TTSHighlightedOnly = (val == "true")
			case "ttsSubscribersOnly":
				s.TTSSubscribersOnly = (val == "true")
			case "ttsVipOnly":
				s.TTSVipOnly = (val == "true")
			case "ttsModOnly":
				s.TTSModOnly = (val == "true")
			case "ttsIncludeUsername":
				s.TTSIncludeUsername = (val == "true")
			case "ttsIncludeLinks":
				s.TTSIncludeLinks = (val == "true")
			case "ttsIncludeEmotes":
				s.TTSIncludeEmotes = (val == "true")
			case "ttsIncludeEmoji":
				s.TTSIncludeEmoji = (val == "true")
			case "ttsIncludeMentions":
				s.TTSIncludeMentions = (val == "true")
			case "ttsRemoveWords":
				s.TTSRemoveWords = val
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
			case "alwaysOnTop":
				s.AlwaysOnTop = (val == "true")
			case "fontFamily":
				if val != "" {
					s.FontFamily = val
				}
			case "messageSpacing":
				if val != "" {
					s.MessageSpacing = val
				}
			case "textAlign":
				if val != "" {
					s.TextAlign = val
				}
			case "proxyEnabled":
				s.ProxyEnabled = (val == "true")
			case "proxyType":
				if val != "" {
					s.ProxyType = val
				}
			case "proxyAddress":
				if val != "" {
					s.ProxyAddress = val
				}
			case "proxyAuth":
				s.ProxyAuth = (val == "true")
			case "proxyUser":
				s.ProxyUser = val
			case "proxyPassword":
				s.ProxyPassword = val
			case "wireGuardPrivateKey":
				s.WireGuardPrivateKey = val
			case "wireGuardPublicKey":
				s.WireGuardPublicKey = val
			case "wireGuardAddress":
				s.WireGuardAddress = val
			case "wireGuardDNS":
				s.WireGuardDNS = val
			case "wireGuardEndpoint":
				s.WireGuardEndpoint = val
			case "wireGuardAllowedIPs":
				s.WireGuardAllowedIPs = val
			case "musicStyle":
				if val != "" {
					s.MusicStyle = val
				}
			case "musicAccentColor":
				if val != "" {
					s.MusicAccentColor = val
				}
			case "musicShowCover":
				s.MusicShowCover = (val == "true")
			case "musicShowVisualizer":
				s.MusicShowVisualizer = (val == "true")
			case "musicShowArtist":
				s.MusicShowArtist = (val == "true")
			case "musicHideOnPause":
				s.MusicHideOnPause = (val == "true")
			case "musicPauseDelay":
				if v, err := strconv.Atoi(val); err == nil && v >= 0 {
					s.MusicPauseDelay = v
				}
			case "musicScale":
				if v, err := strconv.Atoi(val); err == nil && v >= 50 {
					s.MusicScale = v
				}
			case "musicBgOpacity":
				if v, err := strconv.Atoi(val); err == nil && v >= 0 && v <= 100 {
					s.MusicBgOpacity = v
				}
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
		"userId":              s.UserID,
		"clientId":            s.ClientID,
		"joinedChannels":      string(chansJSON),
		"channelColors":       string(colorsJSON),
		"ttsEnabled":          strconv.FormatBool(s.TTSEnabled),
		"ttsVolume":           strconv.FormatFloat(s.TTSVolume, 'f', 2, 64),
		"ttsEngine":           s.TTSEngine,
		"ttsVoice":            s.TTSVoice,
		"ttsVoiceLocal":       s.TTSVoiceLocal,
		"ttsSpeed":            strconv.FormatFloat(s.TTSSpeed, 'f', 2, 64),
		"ttsAudioDevice":      s.TTSAudioDevice,
		"ttsSkipHotkey":       s.TTSSkipHotkey,
		"ttsAllMessages":      strconv.FormatBool(s.TTSAllMessages),
		"ttsRepliesOnly":      strconv.FormatBool(s.TTSRepliesOnly),
		"ttsHighlightedOnly":  strconv.FormatBool(s.TTSHighlightedOnly),
		"ttsSubscribersOnly":  strconv.FormatBool(s.TTSSubscribersOnly),
		"ttsVipOnly":          strconv.FormatBool(s.TTSVipOnly),
		"ttsModOnly":          strconv.FormatBool(s.TTSModOnly),
		"ttsIncludeUsername":  strconv.FormatBool(s.TTSIncludeUsername),
		"ttsIncludeLinks":     strconv.FormatBool(s.TTSIncludeLinks),
		"ttsIncludeEmotes":    strconv.FormatBool(s.TTSIncludeEmotes),
		"ttsIncludeEmoji":     strconv.FormatBool(s.TTSIncludeEmoji),
		"ttsIncludeMentions":  strconv.FormatBool(s.TTSIncludeMentions),
		"ttsRemoveWords":      s.TTSRemoveWords,
		"ignoreCommands":      strconv.FormatBool(s.IgnoreCommands),
		"commandPrefixes":     s.CommandPrefixes,
		"ignoreEmotesOnly":    strconv.FormatBool(s.IgnoreEmotesOnly),
		"ttsFilterEmotes":     strconv.FormatBool(s.TTSFilterEmotes),
		"ignoredUsers":        string(ignoredUsersJSON),
		"hideIgnoredFromChat": strconv.FormatBool(s.HideIgnoredFromChat),
		"alwaysOnTop":         strconv.FormatBool(s.AlwaysOnTop),
		"fontFamily":          s.FontFamily,
		"messageSpacing":      s.MessageSpacing,
		"textAlign":           s.TextAlign,
		"proxyEnabled":        strconv.FormatBool(s.ProxyEnabled),
		"proxyType":           s.ProxyType,
		"proxyAddress":        s.ProxyAddress,
		"proxyAuth":           strconv.FormatBool(s.ProxyAuth),
		"proxyUser":           s.ProxyUser,
		"proxyPassword":       s.ProxyPassword,
		"wireGuardPrivateKey": s.WireGuardPrivateKey,
		"wireGuardPublicKey":  s.WireGuardPublicKey,
		"wireGuardAddress":    s.WireGuardAddress,
		"wireGuardDNS":        s.WireGuardDNS,
		"wireGuardEndpoint":   s.WireGuardEndpoint,
		"wireGuardAllowedIPs": s.WireGuardAllowedIPs,
		"musicStyle":          s.MusicStyle,
		"musicAccentColor":    s.MusicAccentColor,
		"musicShowCover":      strconv.FormatBool(s.MusicShowCover),
		"musicShowVisualizer": strconv.FormatBool(s.MusicShowVisualizer),
		"musicShowArtist":     strconv.FormatBool(s.MusicShowArtist),
		"musicHideOnPause":    strconv.FormatBool(s.MusicHideOnPause),
		"musicPauseDelay":     strconv.Itoa(s.MusicPauseDelay),
		"musicScale":          strconv.Itoa(s.MusicScale),
		"musicBgOpacity":      strconv.Itoa(s.MusicBgOpacity),
	}

	for k, v := range pairs {
		if _, err := stmt.Exec(k, v); err != nil {
			return err
		}
	}

	return tx.Commit()
}
