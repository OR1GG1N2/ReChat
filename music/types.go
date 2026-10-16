package music

import (
	"time"
)

// Track status constants
const (
	StatusPending  = "pending"  // waiting for manual moderator approval
	StatusApproved = "approved" // in active queue, ready to play
	StatusPlaying  = "playing"  // currently playing in player
	StatusDone     = "done"     // played, moved to history
	StatusRejected = "rejected" // rejected by moderation or rule
)

// Track represents a single ordered song/video
type Track struct {
	ID           string    `json:"id"`
	VideoID      string    `json:"videoId"`
	Title        string    `json:"title"`
	Author       string    `json:"author"`
	Duration     int       `json:"duration"`     // in seconds
	DurationStr  string    `json:"durationStr"`  // e.g. "03:54"
	Thumbnail    string    `json:"thumbnail"`    // thumbnail image URL
	RequestedBy  string    `json:"requestedBy"`  // username who ordered
	Platform     string    `json:"platform"`     // "twitch", "kick", "donationalerts", "manual"
	Cost         string    `json:"cost"`         // e.g. "300 баллов", "100 ₽", "Kick", "Вручную"
	Status       string    `json:"status"`       // pending, approved, playing, done, rejected
	RejectReason string    `json:"rejectReason"` // e.g. "8:24, выше лимита", "плейлисты запрещены"
	Position     int       `json:"position"`     // position in queue
	CreatedAt    time.Time `json:"createdAt"`
}

// MusicRules holds configurable ordering and validation rules
type MusicRules struct {
	OrdersEnabled         bool     `json:"ordersEnabled"`         // master toggle for accepting orders
	ChatCommandEnabled    bool     `json:"chatCommandEnabled"`    // enable !заказ command
	TwitchRewardEnabled   bool     `json:"twitchRewardEnabled"`   // enable Twitch channel points reward
	DonationOrdersEnabled bool     `json:"donationOrdersEnabled"` // enable DonationAlerts orders
	WebOrdersEnabled      bool     `json:"webOrdersEnabled"`      // enable web widget orders
	Source                string   `json:"source"`                // "youtube"
	TwitchPoints          int      `json:"twitchPoints"`          // twitch channel points cost (e.g. 50)
	RewardTitle           string   `json:"rewardTitle"`           // Twitch reward title to listen for
	MinDonation           float64  `json:"minDonation"`           // minimum DA donation amount (e.g. 100)
	MaxTracksPerUser      int      `json:"maxTracksPerUser"`      // limit of tracks per viewer in active queue
	BlockPlaylists        bool     `json:"blockPlaylists"`        // reject playlists and live streams
	MaxDurationSec        int      `json:"maxDurationSec"`        // max track duration in seconds (e.g. 501 = 8:21)
	ManualApproval        bool     `json:"manualApproval"`        // if true, all or questionable orders go to moderation
	InterruptOnRequest    bool     `json:"interruptOnRequest"`    // play request immediately, interrupting/pausing current track
	PauseSystemMedia      bool     `json:"pauseSystemMedia"`      // pause external media players (Spotify/Yandex) on request
	BlacklistChannels     []string `json:"blacklistChannels"`     // blacklisted YouTube channel names / IDs
	BlacklistTracks       []string `json:"blacklistTracks"`       // blacklisted YouTube video IDs
	YouTubeAPIKey         string   `json:"youtubeApiKey"`         // optional YouTube Data API v3 key
	FallbackQuery         string   `json:"fallbackQuery"`         // background playback query/playlist
}

// DefaultMusicRules returns standard music rules matching the UI
func DefaultMusicRules() MusicRules {
	return MusicRules{
		OrdersEnabled:         true,
		ChatCommandEnabled:    true,
		TwitchRewardEnabled:   true,
		DonationOrdersEnabled: true,
		WebOrdersEnabled:      false,
		Source:                "youtube",
		TwitchPoints:          50,
		RewardTitle:           "Заказать трек",
		MinDonation:           100,
		MaxTracksPerUser:      2,
		BlockPlaylists:        true,
		MaxDurationSec:        501, // 8:21
		ManualApproval:        false,
		InterruptOnRequest:    true,
		PauseSystemMedia:      true,
		BlacklistChannels:     []string{},
		BlacklistTracks:       []string{},
		YouTubeAPIKey:         "",
		FallbackQuery:         "Lofi hip hop stream safe beats",
	}
}

// MusicState is the complete music queue state broadcasted to frontend
type MusicState struct {
	CurrentTrack          *Track   `json:"currentTrack"`
	Queue                 []*Track `json:"queue"`
	Moderation            []*Track `json:"moderation"`
	History               []*Track `json:"history"`
	TotalQueueCount       int      `json:"totalQueueCount"`
	TotalQueueDuration    int      `json:"totalQueueDuration"`
	TotalQueueDurationStr string   `json:"totalQueueDurationStr"`
	IsPlaying             bool     `json:"isPlaying"`
	CurrentTime           float64  `json:"currentTime"`
	Volume                int      `json:"volume"`
	Rules                 MusicRules `json:"rules"`
}

// VideoInfo holds metadata fetched from YouTube
type VideoInfo struct {
	VideoID       string
	Title         string
	Author        string
	Duration      int // seconds
	Thumbnail     string
	IsEmbeddable  bool
	IsLiveStream  bool
	IsRegionBlock bool
}
