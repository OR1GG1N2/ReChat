package music

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

var (
	// Video ID regex (11 characters: [a-zA-Z0-9_-])
	ytVideoIDRegex = regexp.MustCompile(`^[a-zA-Z0-9_-]{11}$`)

	// ISO 8601 duration regex (e.g. PT1H2M3S, PT3M45S, PT30S)
	isoDurationRegex = regexp.MustCompile(`^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$`)
)

// ParseCommand checks if text is a song order command like !заказ, !sr, !songrequest
func ParseCommand(text string) (query string, isCommand bool) {
	trimmed := strings.TrimSpace(text)
	lower := strings.ToLower(trimmed)

	prefixes := []string{"!заказ", "!songrequest", "!sr"}
	for _, p := range prefixes {
		if strings.HasPrefix(lower, p) {
			rest := strings.TrimSpace(trimmed[len(p):])
			return rest, true
		}
	}
	return "", false
}

var ytUniversalRegex = regexp.MustCompile(`(?i)(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|watch\?(?:[^&]*&)*v=|shorts\/|live\/))([a-zA-Z0-9_-]{11})`)

// ExtractYouTubeID parses an input string. If it's a YouTube link, extracts the 11-char Video ID.
// Also flags if it's a pure playlist link (playlists must be rejected).
func ExtractYouTubeID(input string) (videoID string, isPlaylist bool, isURL bool) {
	input = strings.TrimSpace(input)
	if input == "" {
		return "", false, false
	}

	// 1. Strip common chat command prefixes if passed
	if cmd, isCmd := ParseCommand(input); isCmd {
		input = strings.TrimSpace(cmd)
	}

	// 2. Strip brackets, quotes, or markdown
	input = strings.Trim(input, "<>\"'`()[]")

	// 3. Direct 11-char video ID (e.g. "dQw4w9WgXcQ")
	if ytVideoIDRegex.MatchString(input) && !strings.Contains(input, ".") && !strings.Contains(input, "/") {
		return input, false, false
	}

	lower := strings.ToLower(input)
	isPlaylist = strings.Contains(lower, "list=") || strings.Contains(lower, "/playlist")

	// 4. Universal YouTube URL regex matching
	if match := ytUniversalRegex.FindStringSubmatch(input); len(match) > 1 {
		return match[1], isPlaylist, true
	}

	// 5. Check if it's a pure playlist link without a specific video
	if strings.Contains(lower, "playlist?list=") || strings.Contains(lower, "/playlist") || (strings.Contains(lower, "youtube.com") && strings.Contains(lower, "list=")) {
		return "", true, true
	}

	// 6. Check if generic URL
	if strings.HasPrefix(lower, "http://") || strings.HasPrefix(lower, "https://") || strings.Contains(lower, "youtube.com") || strings.Contains(lower, "youtu.be") {
		return "", false, true
	}

	return "", false, false
}

// FormatDuration converts seconds to MM:SS or HH:MM:SS
func FormatDuration(totalSec int) string {
	if totalSec < 0 {
		totalSec = 0
	}
	h := totalSec / 3600
	m := (totalSec % 3600) / 60
	s := totalSec % 60

	if h > 0 {
		return fmt.Sprintf("%d:%02d:%02d", h, m, s)
	}
	return fmt.Sprintf("%02d:%02d", m, s)
}

// ParseISO8601Duration converts an ISO 8601 duration string (PT1H2M3S) into seconds
func ParseISO8601Duration(isoStr string) int {
	matches := isoDurationRegex.FindStringSubmatch(isoStr)
	if len(matches) == 0 {
		return 0
	}

	var hours, minutes, seconds int
	if matches[1] != "" {
		hours, _ = strconv.Atoi(matches[1])
	}
	if matches[2] != "" {
		minutes, _ = strconv.Atoi(matches[2])
	}
	if matches[3] != "" {
		seconds, _ = strconv.Atoi(matches[3])
	}

	return hours*3600 + minutes*60 + seconds
}

// ParseTimeString parses duration strings like "3:45" or "1:02:15" into seconds
func ParseTimeString(timeStr string) int {
	parts := strings.Split(strings.TrimSpace(timeStr), ":")
	if len(parts) == 2 {
		m, _ := strconv.Atoi(parts[0])
		s, _ := strconv.Atoi(parts[1])
		return m*60 + s
	} else if len(parts) == 3 {
		h, _ := strconv.Atoi(parts[0])
		m, _ := strconv.Atoi(parts[1])
		s, _ := strconv.Atoi(parts[2])
		return h*3600 + m*60 + s
	}
	return 0
}
