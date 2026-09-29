package widget

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"ReChat/config"
	"ReChat/proxy"
)

// AvatarCache fetches and caches Twitch profile picture URLs by login name.
type AvatarCache struct {
	mu              sync.RWMutex
	cache           map[string]avatarEntry
	pendingMu       sync.Mutex
	pending         map[string][]chan string
	onAvatarUpdated func(login, avatarURL string)
}

type avatarEntry struct {
	url       string
	fetchedAt time.Time
}

const avatarTTL = 30 * time.Minute

var globalAvatarCache = &AvatarCache{
	cache:   make(map[string]avatarEntry),
	pending: make(map[string][]chan string),
}

// SetOnAvatarUpdated registers a callback triggered when an avatar URL is retrieved.
func SetOnAvatarUpdated(fn func(login, avatarURL string)) {
	globalAvatarCache.mu.Lock()
	globalAvatarCache.onAvatarUpdated = fn
	globalAvatarCache.mu.Unlock()
}

// GetAvatarURL returns the Twitch profile picture URL for a login.
// If not cached, it waits up to 800ms for a synchronous fetch so the first message
// from a user appears in the widget WITH their avatar immediately.
func GetAvatarURL(login string) string {
	if login == "" {
		return ""
	}
	login = strings.ToLower(strings.TrimSpace(login))
	return globalAvatarCache.getOrFetchAsync(login)
}

func (ac *AvatarCache) getOrFetchAsync(login string) string {
	ac.mu.RLock()
	entry, ok := ac.cache[login]
	ac.mu.RUnlock()

	if ok && time.Since(entry.fetchedAt) < avatarTTL {
		return entry.url
	}

	ac.pendingMu.Lock()
	if _, exists := ac.pending[login]; exists {
		ac.pendingMu.Unlock()
		return ""
	}
	ac.pending[login] = []chan string{}
	ac.pendingMu.Unlock()

	go ac.doFetch(login)
	return ""
}

func (ac *AvatarCache) getOrFetch(login string, timeout time.Duration) string {
	ac.mu.RLock()
	entry, ok := ac.cache[login]
	ac.mu.RUnlock()

	if ok && time.Since(entry.fetchedAt) < avatarTTL {
		return entry.url
	}

	// Check if already being fetched by another concurrent goroutine
	ac.pendingMu.Lock()
	if waiters, exists := ac.pending[login]; exists {
		ch := make(chan string, 1)
		ac.pending[login] = append(waiters, ch)
		ac.pendingMu.Unlock()

		select {
		case url := <-ch:
			return url
		case <-time.After(timeout):
			return ""
		}
	}

	// Register this login as currently fetching
	ch := make(chan string, 1)
	ac.pending[login] = []chan string{ch}
	ac.pendingMu.Unlock()

	// Execute fetch in background
	go ac.doFetch(login)

	select {
	case url := <-ch:
		return url
	case <-time.After(timeout):
		return ""
	}
}

func (ac *AvatarCache) doFetch(login string) {
	avatarURL := ac.fetchHelix(login)

	ac.mu.Lock()
	ac.cache[login] = avatarEntry{url: avatarURL, fetchedAt: time.Now()}
	onUpdated := ac.onAvatarUpdated
	ac.mu.Unlock()

	ac.pendingMu.Lock()
	waiters := ac.pending[login]
	delete(ac.pending, login)
	ac.pendingMu.Unlock()

	for _, w := range waiters {
		select {
		case w <- avatarURL:
		default:
		}
	}

	if avatarURL != "" && onUpdated != nil {
		onUpdated(login, avatarURL)
	}
}

func (ac *AvatarCache) fetchHelix(login string) string {
	settings := config.LoadSettings()
	token := strings.TrimPrefix(settings.OAuthToken, "oauth:")
	if token == "" {
		return ""
	}

	url := fmt.Sprintf("https://api.twitch.tv/helix/users?login=%s", login)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return ""
	}
	req.Header.Set("Client-Id", config.TwitchClientID)
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := proxy.GetHTTPClient().Do(req)
	if err != nil || resp.StatusCode != 200 {
		return ""
	}
	defer resp.Body.Close()

	var result struct {
		Data []struct {
			ProfileImageURL string `json:"profile_image_url"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil || len(result.Data) == 0 {
		return ""
	}

	return result.Data[0].ProfileImageURL
}

// WarmAvatar pre-fetches an avatar immediately.
func WarmAvatar(login string) {
	if login == "" {
		return
	}
	go globalAvatarCache.getOrFetch(strings.ToLower(strings.TrimSpace(login)), 5*time.Second)
}
