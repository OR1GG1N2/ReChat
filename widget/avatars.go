package widget

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"ReChat/config"
)

// AvatarCache fetches and caches Twitch profile picture URLs by login name.
type AvatarCache struct {
	mu    sync.RWMutex
	cache map[string]avatarEntry
}

type avatarEntry struct {
	url       string
	fetchedAt time.Time
}

const avatarTTL = 30 * time.Minute

var globalAvatarCache = &AvatarCache{
	cache: make(map[string]avatarEntry),
}

// GetAvatarURL returns the Twitch profile picture URL for a login, cached for 30 min.
// Returns empty string on error (caller should fall back to initials).
func GetAvatarURL(login string) string {
	if login == "" {
		return ""
	}
	login = strings.ToLower(login)
	return globalAvatarCache.get(login)
}

func (ac *AvatarCache) get(login string) string {
	ac.mu.RLock()
	entry, ok := ac.cache[login]
	ac.mu.RUnlock()

	if ok && time.Since(entry.fetchedAt) < avatarTTL {
		return entry.url
	}

	// Fetch in background; return empty now so the caller doesn't block
	go ac.fetch(login)
	return ""
}

func (ac *AvatarCache) fetch(login string) {
	settings := config.LoadSettings()
	if settings.OAuthToken == "" {
		return
	}

	url := fmt.Sprintf("https://api.twitch.tv/helix/users?login=%s", login)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return
	}
	req.Header.Set("Client-Id", config.TwitchClientID)
	req.Header.Set("Authorization", "Bearer "+settings.OAuthToken)

	resp, err := (&http.Client{Timeout: 8 * time.Second}).Do(req)
	if err != nil || resp.StatusCode != 200 {
		return
	}
	defer resp.Body.Close()

	var result struct {
		Data []struct {
			ProfileImageURL string `json:"profile_image_url"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil || len(result.Data) == 0 {
		return
	}

	avatarURL := result.Data[0].ProfileImageURL
	ac.mu.Lock()
	ac.cache[login] = avatarEntry{url: avatarURL, fetchedAt: time.Now()}
	ac.mu.Unlock()

	// Note: avatar URL is available next time the user sends a message
}

// WarmAvatar pre-fetches an avatar immediately (call when user joins channel etc.)
func WarmAvatar(login string) {
	if login == "" {
		return
	}
	go globalAvatarCache.fetch(strings.ToLower(login))
}
