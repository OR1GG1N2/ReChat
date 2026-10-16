package music

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
)

var (
	// Regex to extract ytInitialData from YouTube HTML page
	ytInitialDataRegex = regexp.MustCompile(`var\s+ytInitialData\s*=\s*({.+?});</script>`)
	// Fallback regex to directly find videoRenderer blocks
	videoRendererIDRegex = regexp.MustCompile(`"videoRenderer":\{"videoId":"([a-zA-Z0-9_-]{11})"`)
)

// YouTubeAPIResponse models YouTube Data API v3 videos.list response
type YouTubeAPIResponse struct {
	Items []struct {
		ID      string `json:"id"`
		Snippet struct {
			Title                string `json:"title"`
			ChannelTitle         string `json:"channelTitle"`
			LiveBroadcastContent string `json:"liveBroadcastContent"` // "live", "upcoming", "none"
			Thumbnails           struct {
				Default struct {
					URL string `json:"url"`
				} `json:"default"`
				Medium struct {
					URL string `json:"url"`
				} `json:"medium"`
				High struct {
					URL string `json:"url"`
				} `json:"high"`
			} `json:"thumbnails"`
		} `json:"snippet"`
		ContentDetails struct {
			Duration          string `json:"duration"` // ISO 8601 (PT3M45S)
			RegionRestriction *struct {
				Allowed []string `json:"allowed"`
				Blocked []string `json:"blocked"`
			} `json:"regionRestriction"`
		} `json:"contentDetails"`
		Status struct {
			UploadStatus  string `json:"uploadStatus"`
			PrivacyStatus string `json:"privacyStatus"`
			Embeddable    bool   `json:"embeddable"`
		} `json:"status"`
	} `json:"items"`
}

// CheckVideo checks video availability and metadata via YouTube Data API v3 (1 request per track)
// If apiKey is empty, it falls back to oEmbed + web metadata check.
func CheckVideo(videoID string, apiKey string, client *http.Client) (*VideoInfo, error) {
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}

	if apiKey != "" {
		return checkVideoWithAPI(videoID, apiKey, client)
	}
	return checkVideoFallback(videoID, client)
}

func checkVideoWithAPI(videoID, apiKey string, client *http.Client) (*VideoInfo, error) {
	apiURL := fmt.Sprintf(
		"https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status&id=%s&key=%s",
		url.QueryEscape(videoID),
		url.QueryEscape(apiKey),
	)

	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return nil, fmt.Errorf("ошибка создания запроса YouTube API: %w", err)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ошибка запроса к YouTube API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("YouTube API вернул статус %d: %s", resp.StatusCode, string(body))
	}

	var apiResp YouTubeAPIResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, fmt.Errorf("ошибка парсинга ответа YouTube API: %w", err)
	}

	if len(apiResp.Items) == 0 {
		return nil, fmt.Errorf("видео с ID %s не найдено или удалено", videoID)
	}

	item := apiResp.Items[0]

	// 1. Check Embeddable
	if !item.Status.Embeddable {
		return nil, fmt.Errorf("видео запрещено для встраивания автором (embeddable=false)")
	}

	// 2. Check Live Broadcast
	if item.Snippet.LiveBroadcastContent == "live" || item.Snippet.LiveBroadcastContent == "upcoming" {
		return nil, fmt.Errorf("прямые эфиры и запланированные трансляции запрещены")
	}

	// 3. Check Privacy Status
	if item.Status.PrivacyStatus == "private" {
		return nil, fmt.Errorf("видео является приватным")
	}

	// 4. Region restriction (RU/CIS or general blocks)
	if item.ContentDetails.RegionRestriction != nil {
		blocked := item.ContentDetails.RegionRestriction.Blocked
		for _, b := range blocked {
			if strings.EqualFold(b, "RU") {
				return nil, fmt.Errorf("видео заблокировано в регионе (ограничение по региону)")
			}
		}
	}

	// 5. Parse Duration
	durationSec := ParseISO8601Duration(item.ContentDetails.Duration)
	if durationSec == 0 && item.Snippet.LiveBroadcastContent != "none" {
		return nil, fmt.Errorf("прямой эфир без фиксированной длительности")
	}

	thumb := item.Snippet.Thumbnails.Medium.URL
	if thumb == "" {
		thumb = item.Snippet.Thumbnails.High.URL
	}
	if thumb == "" {
		thumb = fmt.Sprintf("https://i.ytimg.com/vi/%s/mqdefault.jpg", videoID)
	}

	return &VideoInfo{
		VideoID:      videoID,
		Title:        item.Snippet.Title,
		Author:       item.Snippet.ChannelTitle,
		Duration:     durationSec,
		Thumbnail:    thumb,
		IsEmbeddable: item.Status.Embeddable,
		IsLiveStream: item.Snippet.LiveBroadcastContent != "none",
	}, nil
}

// checkVideoFallback checks metadata via YouTube oEmbed when no API key is specified
func checkVideoFallback(videoID string, client *http.Client) (*VideoInfo, error) {
	oembedURL := fmt.Sprintf("https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=%s&format=json", videoID)

	req, err := http.NewRequest("GET", oembedURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ошибка проверки видео: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("видео с ID %s не найдено или удалено", videoID)
	}
	if resp.StatusCode != http.StatusOK {
		durationSec := fetchVideoDurationFallback(videoID, client)
		return &VideoInfo{
			VideoID:      videoID,
			Title:        "YouTube Video (" + videoID + ")",
			Author:       "YouTube",
			Duration:     durationSec,
			Thumbnail:    fmt.Sprintf("https://i.ytimg.com/vi/%s/mqdefault.jpg", videoID),
			IsEmbeddable: true,
			IsLiveStream: false,
		}, nil
	}

	var data struct {
		Title        string `json:"title"`
		AuthorName   string `json:"author_name"`
		ThumbnailURL string `json:"thumbnail_url"`
		Type         string `json:"type"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("ошибка парсинга oembed: %w", err)
	}

	// Fetch duration and embeddable status by inspecting watch page headers/meta
	durationSec := fetchVideoDurationFallback(videoID, client)

	thumb := data.ThumbnailURL
	if thumb == "" {
		thumb = fmt.Sprintf("https://i.ytimg.com/vi/%s/mqdefault.jpg", videoID)
	}

	return &VideoInfo{
		VideoID:      videoID,
		Title:        data.Title,
		Author:       data.AuthorName,
		Duration:     durationSec,
		Thumbnail:    thumb,
		IsEmbeddable: true,
		IsLiveStream: false,
	}, nil
}

// fetchVideoDurationFallback fetches duration from watch page if possible
func fetchVideoDurationFallback(videoID string, client *http.Client) int {
	pageURL := fmt.Sprintf("https://www.youtube.com/watch?v=%s", videoID)
	req, err := http.NewRequest("GET", pageURL, nil)
	if err != nil {
		return 0
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Accept-Language", "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.AddCookie(&http.Cookie{Name: "CONSENT", Value: "PENDING+999", Domain: ".youtube.com"})
	req.AddCookie(&http.Cookie{Name: "SOCS", Value: "CAISNQgDEitib3FfaWRlbnRpdHlmcm9udGVuZHVpc2VydmVyXzIwMjMxMTE0LjA3X3AxGgJlbiACGgYIgJnSmgY", Domain: ".youtube.com"})

	resp, err := client.Do(req)
	if err != nil {
		return 0
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, 512*1024)) // read first 512KB
	if err != nil {
		return 0
	}
	body := string(bodyBytes)

	// Check if live stream
	if strings.Contains(body, `"isLiveContent":true`) || strings.Contains(body, `"isLive":true`) {
		return 0
	}

	// Match approxDurationMs
	reDuration := regexp.MustCompile(`"approxDurationMs":"(\d+)"`)
	if match := reDuration.FindStringSubmatch(body); len(match) > 1 {
		if ms, err := strconv.Atoi(match[1]); err == nil {
			return ms / 1000
		}
	}

	// Match lengthSeconds
	reLength := regexp.MustCompile(`"lengthSeconds":"(\d+)"`)
	if match := reLength.FindStringSubmatch(body); len(match) > 1 {
		if s, err := strconv.Atoi(match[1]); err == nil {
			return s
		}
	}

	return 0
}

// SearchYouTube performs a search by song title / artist without YouTube Data API
func SearchYouTube(query string, client *http.Client) (*VideoInfo, error) {
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second}
	}

	searchURL := fmt.Sprintf("https://www.youtube.com/results?search_query=%s", url.QueryEscape(query))
	req, err := http.NewRequest("GET", searchURL, nil)
	if err != nil {
		return nil, fmt.Errorf("ошибка создания запроса поиска: %w", err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Accept-Language", "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	// Bypass YouTube consent page by setting the consent cookie
	req.AddCookie(&http.Cookie{Name: "CONSENT", Value: "PENDING+999", Domain: ".youtube.com"})
	req.AddCookie(&http.Cookie{Name: "SOCS", Value: "CAISNQgDEitib3FfaWRlbnRpdHlmcm9udGVuZHVpc2VydmVyXzIwMjMxMTE0LjA3X3AxGgJlbiACGgYIgJnSmgY", Domain: ".youtube.com"})

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ошибка запроса поиска YouTube: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("поиск YouTube вернул статус %d", resp.StatusCode)
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("ошибка чтения ответа поиска: %w", err)
	}
	body := string(bodyBytes)

	// Extract ytInitialData
	var videoID, title, author, durationStr string
	var durationSec int

	// First try to parse ytInitialData JSON
	if match := ytInitialDataRegex.FindStringSubmatch(body); len(match) > 1 {
		videoID, title, author, durationSec, durationStr = parseInitialDataForFirstVideo(match[1])
	}

	// Fallback regex matching if JSON parsing didn't find a video
	if videoID == "" {
		if match := videoRendererIDRegex.FindStringSubmatch(body); len(match) > 1 {
			videoID = match[1]
			// extract title
			reTitle := regexp.MustCompile(`"videoId":"` + regexp.QuoteMeta(videoID) + `".+?"title":\{"runs":\[\{"text":"(.*?)"\}`)
			if tMatch := reTitle.FindStringSubmatch(body); len(tMatch) > 1 {
				title = tMatch[1]
			}
			// extract lengthText
			reLen := regexp.MustCompile(`"videoId":"` + regexp.QuoteMeta(videoID) + `".+?"lengthText":\{"simpleText":"(.*?)"\}`)
			if lMatch := reLen.FindStringSubmatch(body); len(lMatch) > 1 {
				durationStr = lMatch[1]
				durationSec = ParseTimeString(durationStr)
			}
			// extract owner
			reOwner := regexp.MustCompile(`"videoId":"` + regexp.QuoteMeta(videoID) + `".+?"ownerText":\{"runs":\[\{"text":"(.*?)"\}`)
			if oMatch := reOwner.FindStringSubmatch(body); len(oMatch) > 1 {
				author = oMatch[1]
			}
		}
	}

	if videoID == "" {
		return nil, fmt.Errorf("по запросу «%s» ничего не найдено на YouTube", query)
	}

	if title == "" {
		title = query
	}

	return &VideoInfo{
		VideoID:      videoID,
		Title:        title,
		Author:       author,
		Duration:     durationSec,
		Thumbnail:    fmt.Sprintf("https://i.ytimg.com/vi/%s/mqdefault.jpg", videoID),
		IsEmbeddable: true,
		IsLiveStream: false,
	}, nil
}

// parseInitialDataForFirstVideo traverses ytInitialData structure for the first videoRenderer
func parseInitialDataForFirstVideo(jsonData string) (videoID, title, author string, durationSec int, durationStr string) {
	var root map[string]interface{}
	if err := json.Unmarshal([]byte(jsonData), &root); err != nil {
		return
	}

	// Recursively search for "videoRenderer"
	renderer := findVideoRenderer(root)
	if renderer == nil {
		return
	}

	if vid, ok := renderer["videoId"].(string); ok {
		videoID = vid
	}

	// Title
	if titleObj, ok := renderer["title"].(map[string]interface{}); ok {
		if runs, ok := titleObj["runs"].([]interface{}); ok && len(runs) > 0 {
			if firstRun, ok := runs[0].(map[string]interface{}); ok {
				if t, ok := firstRun["text"].(string); ok {
					title = t
				}
			}
		}
	}

	// Owner / Author
	if ownerObj, ok := renderer["ownerText"].(map[string]interface{}); ok {
		if runs, ok := ownerObj["runs"].([]interface{}); ok && len(runs) > 0 {
			if firstRun, ok := runs[0].(map[string]interface{}); ok {
				if a, ok := firstRun["text"].(string); ok {
					author = a
				}
			}
		}
	}

	// Duration
	if lenObj, ok := renderer["lengthText"].(map[string]interface{}); ok {
		if s, ok := lenObj["simpleText"].(string); ok {
			durationStr = s
			durationSec = ParseTimeString(s)
		}
	}

	return
}

func findVideoRenderer(obj interface{}) map[string]interface{} {
	switch v := obj.(type) {
	case map[string]interface{}:
		if vr, ok := v["videoRenderer"].(map[string]interface{}); ok {
			return vr
		}
		for _, child := range v {
			if found := findVideoRenderer(child); found != nil {
				return found
			}
		}
	case []interface{}:
		for _, item := range v {
			if found := findVideoRenderer(item); found != nil {
				return found
			}
		}
	}
	return nil
}
