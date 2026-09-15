package twitch

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"ReChat/config"
)

type EmoteFetcher struct {
	mu          sync.RWMutex
	emoteMap    map[string]string // emoteCode -> imageUrl
	userIDCache sync.Map          // username -> twitchUserID (concurrent-safe, no mutex needed)
	lastFetched time.Time
	httpClient  *http.Client
}

func NewEmoteFetcher() *EmoteFetcher {
	return &EmoteFetcher{
		emoteMap:   make(map[string]string),
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// Native Twitch Emotes Fallback Table
var TwitchNativeEmotes = map[string]string{
	"Kappa":           "https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/1.0",
	"LUL":             "https://static-cdn.jtvnw.net/emoticons/v2/425618/default/dark/1.0",
	"PogChamp":        "https://static-cdn.jtvnw.net/emoticons/v2/305954156/default/dark/1.0",
	"BibleThump":      "https://static-cdn.jtvnw.net/emoticons/v2/86/default/dark/1.0",
	"Kreygasm":        "https://static-cdn.jtvnw.net/emoticons/v2/41/default/dark/1.0",
	"ResidentSleeper": "https://static-cdn.jtvnw.net/emoticons/v2/245/default/dark/1.0",
	"WutFace":         "https://static-cdn.jtvnw.net/emoticons/v2/28087/default/dark/1.0",
	"HeyGuys":         "https://static-cdn.jtvnw.net/emoticons/v2/30259/default/dark/1.0",
	"VoHiYo":          "https://static-cdn.jtvnw.net/emoticons/v2/81274/default/dark/1.0",
	"TriHard":         "https://static-cdn.jtvnw.net/emoticons/v2/120232/default/dark/1.0",
	"CoolCat":         "https://static-cdn.jtvnw.net/emoticons/v2/58127/default/dark/1.0",
	"BleedPurple":     "https://static-cdn.jtvnw.net/emoticons/v2/62835/default/dark/1.0",
	"FrankerZ":        "https://static-cdn.jtvnw.net/emoticons/v2/50/default/dark/1.0",
	"NotLikeThis":     "https://static-cdn.jtvnw.net/emoticons/v2/58765/default/dark/1.0",
	"FailFish":        "https://static-cdn.jtvnw.net/emoticons/v2/360/default/dark/1.0",
}

// resolveTwitchUserID resolves Twitch username -> numerical User ID.
// Uses sync.Map internally, NO mutex dependency — safe to call from anywhere.
func (ef *EmoteFetcher) resolveTwitchUserID(username string) string {
	username = strings.ToLower(strings.TrimPrefix(strings.TrimSpace(username), "#"))
	if username == "" {
		return ""
	}

	// Check cache first (lock-free)
	if cached, ok := ef.userIDCache.Load(username); ok {
		if id, ok := cached.(string); ok && id != "" {
			return id
		}
	}

	// 1. Twitch Helix API
	reqURL := fmt.Sprintf("https://api.twitch.tv/helix/users?login=%s", username)
	req, err := http.NewRequest("GET", reqURL, nil)
	if err == nil {
		req.Header.Set("Client-Id", config.TwitchClientID)
		settings := config.LoadSettings()
		if settings.OAuthToken != "" {
			token := strings.TrimPrefix(settings.OAuthToken, "oauth:")
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		}

		resp, err := ef.httpClient.Do(req)
		if err == nil {
			defer resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				var helixResp struct {
					Data []struct {
						ID string `json:"id"`
					} `json:"data"`
				}
				if err := json.NewDecoder(resp.Body).Decode(&helixResp); err == nil && len(helixResp.Data) > 0 {
					id := helixResp.Data[0].ID
					if id != "" {
						ef.userIDCache.Store(username, id)
						log.Printf("[UserID] Resolved %s -> %s via Twitch Helix", username, id)
						return id
					}
				}
			}
		}
	}

	// 2. IVR Public API Fallback (used by Chatterino)
	ivrURL := fmt.Sprintf("https://api.ivr.fi/v2/twitch/user?login=%s", username)
	resp, err := ef.httpClient.Get(ivrURL)
	if err == nil {
		defer resp.Body.Close()
		if resp.StatusCode == http.StatusOK {
			var ivrResp []struct {
				ID string `json:"id"`
			}
			if err := json.NewDecoder(resp.Body).Decode(&ivrResp); err == nil && len(ivrResp) > 0 {
				id := ivrResp[0].ID
				if id != "" {
					ef.userIDCache.Store(username, id)
					log.Printf("[UserID] Resolved %s -> %s via IVR API", username, id)
					return id
				}
			}
		}
	}

	log.Printf("[UserID] FAILED to resolve user ID for: %s", username)
	return ""
}

// sanitizeURL ensures all emote URLs use explicit https:// protocol (critical for Wails WebView2)
func sanitizeURL(url string) string {
	url = strings.TrimSpace(url)
	if strings.HasPrefix(url, "//") {
		return "https:" + url
	}
	if !strings.HasPrefix(url, "http://") && !strings.HasPrefix(url, "https://") {
		return "https://" + url
	}
	return url
}

func (ef *EmoteFetcher) FetchAllEmotes(channels []string) (map[string]string, error) {
	newMap := make(map[string]string)

	// Load built-in Twitch native emotes
	for code, url := range TwitchNativeEmotes {
		newMap[code] = url
	}

	var wg sync.WaitGroup
	var mapMu sync.Mutex

	addEmote := func(code, url string) {
		code = strings.TrimSpace(code)
		if code == "" || url == "" {
			return
		}
		url = sanitizeURL(url)
		mapMu.Lock()
		newMap[code] = url
		mapMu.Unlock()
	}

	// --- PHASE 1: Resolve all Twitch User IDs in parallel FIRST ---
	userIDs := make(map[string]string) // username -> twitchUserID
	var idMu sync.Mutex
	for _, ch := range channels {
		chName := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(ch), "#"))
		if chName == "" {
			continue
		}
		wg.Add(1)
		go func(c string) {
			defer wg.Done()
			id := ef.resolveTwitchUserID(c)
			idMu.Lock()
			userIDs[c] = id
			idMu.Unlock()
		}(chName)
	}
	wg.Wait()
	log.Printf("[Emotes] Resolved user IDs: %v", userIDs)

	// --- PHASE 2: Fetch all global emotes in parallel ---

	// 7TV Global Emotes
	wg.Add(1)
	go func() {
		defer wg.Done()
		resp, err := ef.httpClient.Get("https://7tv.io/v3/emote-sets/global")
		if err != nil {
			log.Printf("[7TV Global] Error: %v", err)
			return
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			log.Printf("[7TV Global] HTTP %d", resp.StatusCode)
			return
		}
		var result struct {
			Emotes []struct {
				ID   string `json:"id"`
				Name string `json:"name"`
			} `json:"emotes"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&result); err == nil {
			count := 0
			for _, e := range result.Emotes {
				if e.ID != "" && e.Name != "" {
					addEmote(e.Name, fmt.Sprintf("https://cdn.7tv.app/emote/%s/1x.webp", e.ID))
					count++
				}
			}
			log.Printf("[7TV Global] Loaded %d emotes", count)
		}
	}()

	// BTTV Global Emotes
	wg.Add(1)
	go func() {
		defer wg.Done()
		resp, err := ef.httpClient.Get("https://api.betterttv.net/3/cached/emotes/global")
		if err != nil {
			return
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			return
		}
		var emotes []struct {
			ID   string `json:"id"`
			Code string `json:"code"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&emotes); err == nil {
			count := 0
			for _, e := range emotes {
				if e.ID != "" && e.Code != "" {
					addEmote(e.Code, fmt.Sprintf("https://cdn.betterttv.net/emote/%s/1x.webp", e.ID))
					count++
				}
			}
			log.Printf("[BTTV Global] Loaded %d emotes", count)
		}
	}()

	// FFZ Global Emotes
	wg.Add(1)
	go func() {
		defer wg.Done()
		resp, err := ef.httpClient.Get("https://api.frankerfacez.com/v1/set/global")
		if err != nil {
			return
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			return
		}
		var result struct {
			Sets map[string]struct {
				Emotes []struct {
					Name string            `json:"name"`
					Urls map[string]string `json:"urls"`
				} `json:"emotes"`
			} `json:"sets"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&result); err == nil {
			count := 0
			for _, set := range result.Sets {
				for _, e := range set.Emotes {
					img := e.Urls["1"]
					if img != "" {
						addEmote(e.Name, img)
						count++
					}
				}
			}
			log.Printf("[FFZ Global] Loaded %d emotes", count)
		}
	}()

	// --- PHASE 3: Fetch channel-specific emotes in parallel using resolved User IDs ---
	for chName, twitchID := range userIDs {
		c := chName
		id := twitchID

		// 7TV Channel Emotes (requires numerical Twitch User ID)
		wg.Add(1)
		go func(ch, uid string) {
			defer wg.Done()
			count := 0

			if uid != "" {
				v3URL := fmt.Sprintf("https://7tv.io/v3/users/twitch/%s", uid)
				resp, err := ef.httpClient.Get(v3URL)
				if err == nil {
					defer resp.Body.Close()
					if resp.StatusCode == http.StatusOK {
						var v3Resp struct {
							EmoteSet struct {
								Emotes []struct {
									ID   string `json:"id"`
									Name string `json:"name"`
								} `json:"emotes"`
							} `json:"emote_set"`
						}
						if err := json.NewDecoder(resp.Body).Decode(&v3Resp); err == nil {
							for _, e := range v3Resp.EmoteSet.Emotes {
								if e.ID != "" && e.Name != "" {
									addEmote(e.Name, fmt.Sprintf("https://cdn.7tv.app/emote/%s/1x.webp", e.ID))
									count++
								}
							}
						}
					} else {
						log.Printf("[7TV Channel] HTTP %d for #%s (ID: %s)", resp.StatusCode, ch, uid)
					}
				}
			}

			log.Printf("[7TV Channel] Loaded %d emotes for #%s (ID: %s)", count, ch, uid)
		}(c, id)

		// BTTV Channel Emotes (requires numerical Twitch User ID)
		if id != "" {
			wg.Add(1)
			go func(ch, uid string) {
				defer wg.Done()
				bttvURL := fmt.Sprintf("https://api.betterttv.net/3/cached/users/twitch/%s", uid)
				resp, err := ef.httpClient.Get(bttvURL)
				if err != nil {
					return
				}
				defer resp.Body.Close()
				if resp.StatusCode != http.StatusOK {
					return
				}
				var bttvResp struct {
					ChannelEmotes []struct {
						ID   string `json:"id"`
						Code string `json:"code"`
					} `json:"channelEmotes"`
					SharedEmotes []struct {
						ID   string `json:"id"`
						Code string `json:"code"`
					} `json:"sharedEmotes"`
				}
				if err := json.NewDecoder(resp.Body).Decode(&bttvResp); err == nil {
					count := 0
					for _, e := range bttvResp.ChannelEmotes {
						if e.ID != "" && e.Code != "" {
							addEmote(e.Code, fmt.Sprintf("https://cdn.betterttv.net/emote/%s/1x.webp", e.ID))
							count++
						}
					}
					for _, e := range bttvResp.SharedEmotes {
						if e.ID != "" && e.Code != "" {
							addEmote(e.Code, fmt.Sprintf("https://cdn.betterttv.net/emote/%s/1x.webp", e.ID))
							count++
						}
					}
					log.Printf("[BTTV Channel] Loaded %d emotes for #%s", count, ch)
				}
			}(c, id)
		}

		// FFZ Channel Emotes (uses username, not user ID)
		wg.Add(1)
		go func(ch string) {
			defer wg.Done()
			ffzURL := fmt.Sprintf("https://api.frankerfacez.com/v1/room/%s", ch)
			resp, err := ef.httpClient.Get(ffzURL)
			if err != nil {
				return
			}
			defer resp.Body.Close()
			if resp.StatusCode != http.StatusOK {
				return
			}
			var result struct {
				Sets map[string]struct {
					Emotes []struct {
						Name string            `json:"name"`
						Urls map[string]string `json:"urls"`
					} `json:"emotes"`
				} `json:"sets"`
			}
			if err := json.NewDecoder(resp.Body).Decode(&result); err == nil {
				count := 0
				for _, set := range result.Sets {
					for _, e := range set.Emotes {
						img := e.Urls["1"]
						if img != "" {
							addEmote(e.Name, img)
							count++
						}
					}
				}
				log.Printf("[FFZ Channel] Loaded %d emotes for #%s", count, ch)
			}
		}(c)
	}

	wg.Wait()

	// Store result
	ef.mu.Lock()
	ef.emoteMap = newMap
	ef.lastFetched = time.Now()
	ef.mu.Unlock()

	log.Printf("[Emotes] ✅ Total loaded: %d emotes for channels %v", len(newMap), channels)
	return newMap, nil
}
