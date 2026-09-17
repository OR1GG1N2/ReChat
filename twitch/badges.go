package twitch

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"ReChat/config"
	"ReChat/proxy"
)

type BadgeVersion struct {
	ID         string `json:"id"`
	ImageURL1x string `json:"image_url_1x"`
	ImageURL2x string `json:"image_url_2x"`
	ImageURL4x string `json:"image_url_4x"`
}

type BadgeSet struct {
	SetID    string         `json:"set_id"`
	Versions []BadgeVersion `json:"versions"`
}

type BadgeResponse struct {
	Data []BadgeSet `json:"data"`
}

type BadgeFetcher struct {
	mu          sync.RWMutex
	badgeMap    map[string]string
	lastFetched time.Time
}

func NewBadgeFetcher() *BadgeFetcher {
	return &BadgeFetcher{
		badgeMap: make(map[string]string),
	}
}

func (bf *BadgeFetcher) FetchGlobalBadges() (map[string]string, error) {
	bf.mu.Lock()
	defer bf.mu.Unlock()

	// Return cached map if fetched recently (within 1 hour)
	if len(bf.badgeMap) > 0 && time.Since(bf.lastFetched) < time.Hour {
		return bf.badgeMap, nil
	}

	settings := config.LoadSettings()
	clientID := config.TwitchClientID

	req, err := http.NewRequest("GET", config.TwitchHelixBadgesGlobalURL, nil)
	if err != nil {
		return bf.badgeMap, err
	}

	req.Header.Set("Client-Id", clientID)
	if settings.OAuthToken != "" {
		req.Header.Set("Authorization", "Bearer "+settings.OAuthToken)
	}

	client := proxy.GetHTTPClient()
	resp, err := client.Do(req)
	if err != nil {
		return bf.badgeMap, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return bf.badgeMap, fmt.Errorf("Twitch Badges API returned status: %d", resp.StatusCode)
	}

	var badgeResp BadgeResponse
	if err := json.NewDecoder(resp.Body).Decode(&badgeResp); err != nil {
		return bf.badgeMap, err
	}

	newMap := make(map[string]string)
	for _, set := range badgeResp.Data {
		for _, ver := range set.Versions {
			key := fmt.Sprintf("%s/%s", set.SetID, ver.ID)
			img := ver.ImageURL1x
			if img == "" {
				img = ver.ImageURL2x
			}
			newMap[key] = img
		}
	}

	bf.badgeMap = newMap
	bf.lastFetched = time.Now()

	return bf.badgeMap, nil
}

// GetBadgeMap returns a thread-safe copy of the cached badge map.
func (bf *BadgeFetcher) GetBadgeMap() map[string]string {
	bf.mu.RLock()
	defer bf.mu.RUnlock()
	res := make(map[string]string, len(bf.badgeMap))
	for k, v := range bf.badgeMap {
		res[k] = v
	}
	return res
}

