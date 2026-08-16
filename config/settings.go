package config

import (
	"database/sql"
	"log"
	"os"
	"path/filepath"
	"strconv"

	_ "modernc.org/sqlite"
)

type AppSettings struct {
	DefaultChannel string `json:"defaultChannel"`
	FontSize       int    `json:"fontSize"`       // 12, 14, 16, 18
	ShowTimestamps bool   `json:"showTimestamps"` // true / false
	ShowBadges     bool   `json:"showBadges"`     // true / false
	MaxMessages    int    `json:"maxMessages"`    // 100 - 1000
	OAuthToken     string `json:"oauthToken"`     // oauth token
	Username       string `json:"username"`       // authenticated user
	ClientID       string `json:"clientId"`       // twitch client id
}

func DefaultSettings() AppSettings {
	return AppSettings{
		DefaultChannel: "",
		FontSize:       14,
		ShowTimestamps: true,
		ShowBadges:     true,
		MaxMessages:    300,
		OAuthToken:     "",
		Username:       "",
		ClientID:       TwitchClientID,
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
			case "showBadges":
				s.ShowBadges = (val == "true")
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

	pairs := map[string]string{
		"defaultChannel": s.DefaultChannel,
		"fontSize":       strconv.Itoa(s.FontSize),
		"showTimestamps": strconv.FormatBool(s.ShowTimestamps),
		"showBadges":     strconv.FormatBool(s.ShowBadges),
		"maxMessages":    strconv.Itoa(s.MaxMessages),
		"oauthToken":     s.OAuthToken,
		"username":       s.Username,
		"clientId":       s.ClientID,
	}

	for k, v := range pairs {
		if _, err := stmt.Exec(k, v); err != nil {
			return err
		}
	}

	return tx.Commit()
}
