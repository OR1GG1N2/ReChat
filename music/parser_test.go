package music

import (
	"testing"
)

func TestExtractYouTubeID(t *testing.T) {
	tests := []struct {
		input      string
		expectedID string
		isPlaylist bool
		isURL      bool
	}{
		{"https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ", false, true},
		{"youtu.be/dQw4w9WgXcQ?t=10", "dQw4w9WgXcQ", false, true},
		{"https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ", false, true},
		{"https://music.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ", false, true},
		{"https://youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ", false, true},
		{"https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ", false, true},
		{"https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123456", "dQw4w9WgXcQ", true, true},
		{"https://www.youtube.com/playlist?list=PL123456", "", true, true},
		{"dQw4w9WgXcQ", "dQw4w9WgXcQ", false, false},
		{"Rammstein - Du Hast", "", false, false},
	}

	for _, tc := range tests {
		id, isPl, isU := ExtractYouTubeID(tc.input)
		if id != tc.expectedID || isPl != tc.isPlaylist || isU != tc.isURL {
			t.Errorf("ExtractYouTubeID(%q) = (%q, %v, %v), want (%q, %v, %v)",
				tc.input, id, isPl, isU, tc.expectedID, tc.isPlaylist, tc.isURL)
		}
	}
}

func TestParseISO8601Duration(t *testing.T) {
	tests := []struct {
		input    string
		expected int
	}{
		{"PT3M54S", 234},
		{"PT1H2M3S", 3723},
		{"PT45S", 45},
		{"PT10M", 600},
		{"PT1H", 3600},
	}

	for _, tc := range tests {
		actual := ParseISO8601Duration(tc.input)
		if actual != tc.expected {
			t.Errorf("ParseISO8601Duration(%q) = %d, want %d", tc.input, actual, tc.expected)
		}
	}
}

func TestParseCommand(t *testing.T) {
	tests := []struct {
		input     string
		wantQuery string
		wantCmd   bool
	}{
		{"!заказ Rammstein", "Rammstein", true},
		{"!sr https://youtu.be/dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ", true},
		{"!songrequest Believer", "Believer", true},
		{"Привет всем", "", false},
	}

	for _, tc := range tests {
		q, cmd := ParseCommand(tc.input)
		if q != tc.wantQuery || cmd != tc.wantCmd {
			t.Errorf("ParseCommand(%q) = (%q, %v), want (%q, %v)", tc.input, q, cmd, tc.wantQuery, tc.wantCmd)
		}
	}
}
