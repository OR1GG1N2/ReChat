package music

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"ReChat/config"

	"github.com/google/uuid"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	_ "modernc.org/sqlite"
)

// Service manages the music queue, rules, and playback state
type Service struct {
	mu           sync.RWMutex
	ctx          context.Context
	db           *sql.DB
	httpClientFn func() *http.Client

	rules        MusicRules
	currentTrack *Track
	queue        []*Track // status == approved
	moderation   []*Track // status == pending
	history      []*Track // status == done
	isPlaying    bool
	currentTime  float64
	volume       int
	onTrackStart func(track *Track)
	onStateChange func(state MusicState)
}

// NewService creates and initializes the Music Service
func NewService(httpClientFn func() *http.Client) *Service {
	s := &Service{
		rules:        DefaultMusicRules(),
		queue:        make([]*Track, 0),
		moderation:   make([]*Track, 0),
		history:      make([]*Track, 0),
		volume:       60,
		httpClientFn: httpClientFn,
	}

	s.initDB()
	s.loadRules()
	s.loadTracks()
	return s
}

// SetContext sets the Wails context for runtime.EventsEmit
func (s *Service) SetContext(ctx context.Context) {
	s.mu.Lock()
	s.ctx = ctx
	s.mu.Unlock()
}

// SetOnTrackStart registers a callback when a track begins playing
func (s *Service) SetOnTrackStart(fn func(track *Track)) {
	s.mu.Lock()
	s.onTrackStart = fn
	s.mu.Unlock()
}

// SetOnStateChange registers a callback when music queue or playback state updates
func (s *Service) SetOnStateChange(fn func(state MusicState)) {
	s.mu.Lock()
	s.onStateChange = fn
	s.mu.Unlock()
}

func (s *Service) getHTTPClient() *http.Client {
	if s.httpClientFn != nil {
		return s.httpClientFn()
	}
	return http.DefaultClient
}

func (s *Service) initDB() {
	dbPath := config.GetDBPath()
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		log.Printf("[Music] Error opening SQLite DB: %v", err)
		return
	}
	s.db = db

	createTableQuery := `
	CREATE TABLE IF NOT EXISTS settings (
		key TEXT PRIMARY KEY,
		value TEXT
	);
	CREATE TABLE IF NOT EXISTS music_tracks (
		id TEXT PRIMARY KEY,
		video_id TEXT,
		title TEXT,
		author TEXT,
		duration INTEGER,
		duration_str TEXT,
		thumbnail TEXT,
		requested_by TEXT,
		platform TEXT,
		cost TEXT,
		status TEXT,
		reject_reason TEXT,
		position INTEGER,
		created_at TEXT
	);
	CREATE INDEX IF NOT EXISTS idx_music_status ON music_tracks(status);
	`
	if _, err := db.Exec(createTableQuery); err != nil {
		log.Printf("[Music] Error creating tables: %v", err)
	}
}

func (s *Service) loadRules() {
	if s.db == nil {
		return
	}
	var val string
	err := s.db.QueryRow("SELECT value FROM settings WHERE key = 'music_rules'").Scan(&val)
	if err == nil && val != "" {
		var r MusicRules
		if json.Unmarshal([]byte(val), &r) == nil {
			s.rules = r
			return
		}
	}
	// Fallback to default rules and persist
	s.rules = DefaultMusicRules()
	s.saveRulesLocked()
}

func (s *Service) saveRulesLocked() {
	if s.db == nil {
		return
	}
	data, err := json.Marshal(s.rules)
	if err != nil {
		log.Printf("[Music] Error marshaling rules: %v", err)
		return
	}
	_, err = s.db.Exec("INSERT OR REPLACE INTO settings (key, value) VALUES ('music_rules', ?)", string(data))
	if err != nil {
		log.Printf("[Music] Error persisting music_rules: %v", err)
	}
}

func (s *Service) loadTracks() {
	if s.db == nil {
		return
	}

	rows, err := s.db.Query(`
		SELECT id, video_id, title, author, duration, duration_str, thumbnail, requested_by, platform, cost, status, reject_reason, position, created_at
		FROM music_tracks
		ORDER BY position ASC, created_at ASC
	`)
	if err != nil {
		log.Printf("[Music] Error loading tracks: %v", err)
		return
	}
	defer rows.Close()

	s.queue = make([]*Track, 0)
	s.moderation = make([]*Track, 0)
	s.history = make([]*Track, 0)
	s.currentTrack = nil

	for rows.Next() {
		var t Track
		var createdAtStr string
		err := rows.Scan(
			&t.ID, &t.VideoID, &t.Title, &t.Author, &t.Duration, &t.DurationStr,
			&t.Thumbnail, &t.RequestedBy, &t.Platform, &t.Cost, &t.Status,
			&t.RejectReason, &t.Position, &createdAtStr,
		)
		if err != nil {
			continue
		}
		t.CreatedAt, _ = time.Parse(time.RFC3339, createdAtStr)

		switch t.Status {
		case StatusPlaying:
			s.currentTrack = &t
			s.isPlaying = true
		case StatusApproved:
			s.queue = append(s.queue, &t)
		case StatusPending:
			s.moderation = append(s.moderation, &t)
		case StatusDone:
			s.history = append(s.history, &t)
		}
	}

	// Reverse history so newest played are at the top
	for i, j := 0, len(s.history)-1; i < j; i, j = i+1, j-1 {
		s.history[i], s.history[j] = s.history[j], s.history[i]
	}

	// If no track is playing but queue has items, set first as current
	if s.currentTrack == nil && len(s.queue) > 0 {
		s.currentTrack = s.queue[0]
		s.currentTrack.Status = StatusPlaying
		s.queue = s.queue[1:]
		s.isPlaying = true
		s.saveTrackToDB(s.currentTrack)
	}
}

func (s *Service) saveTrackToDB(t *Track) {
	if s.db == nil || t == nil {
		return
	}
	query := `
	INSERT INTO music_tracks (id, video_id, title, author, duration, duration_str, thumbnail, requested_by, platform, cost, status, reject_reason, position, created_at)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT(id) DO UPDATE SET
		video_id = excluded.video_id,
		title = excluded.title,
		author = excluded.author,
		duration = excluded.duration,
		duration_str = excluded.duration_str,
		thumbnail = excluded.thumbnail,
		requested_by = excluded.requested_by,
		platform = excluded.platform,
		cost = excluded.cost,
		status = excluded.status,
		reject_reason = excluded.reject_reason,
		position = excluded.position,
		created_at = excluded.created_at
	`
	_, err := s.db.Exec(query,
		t.ID, t.VideoID, t.Title, t.Author, t.Duration, t.DurationStr,
		t.Thumbnail, t.RequestedBy, t.Platform, t.Cost, t.Status,
		t.RejectReason, t.Position, t.CreatedAt.Format(time.RFC3339),
	)
	if err != nil {
		log.Printf("[Music] Error saving track to DB: %v", err)
	}
}

func (s *Service) emitState() {
	state := s.getStateLocked()
	if s.ctx != nil {
		go runtime.EventsEmit(s.ctx, "music:state", state)
	}
	if s.onStateChange != nil {
		go s.onStateChange(state)
	}
}


// AddTrack processes an order from chat, reward, or manual input.
// HTTP calls to YouTube are performed outside the mutex to prevent blocking
// the entire music service during slow network requests.
func (s *Service) AddTrack(rawInput, requestedBy, platform, cost string) (*Track, error) {
	rawInput = strings.TrimSpace(rawInput)
	if rawInput == "" {
		return nil, fmt.Errorf("укажите ссылку на YouTube или название трека")
	}

	// --- Phase 1: Read-lock to validate rules and grab config ---
	s.mu.RLock()
	ordersEnabled := s.rules.OrdersEnabled
	blockPlaylists := s.rules.BlockPlaylists
	apiKey := s.rules.YouTubeAPIKey
	blacklistTracks := append([]string{}, s.rules.BlacklistTracks...)
	blacklistChannels := append([]string{}, s.rules.BlacklistChannels...)
	maxTracksPerUser := s.rules.MaxTracksPerUser
	maxDurationSec := s.rules.MaxDurationSec
	manualApproval := s.rules.ManualApproval
	s.mu.RUnlock()

	if !ordersEnabled && platform != "manual" {
		return nil, fmt.Errorf("приём заказов в данный момент выключен")
	}

	// 2. Parse input: check if URL or query
	videoID, isPlaylist, isURL := ExtractYouTubeID(rawInput)

	if isPlaylist && videoID == "" && blockPlaylists {
		return nil, fmt.Errorf("плейлисты запрещены")
	}
	if isURL && videoID == "" {
		return nil, fmt.Errorf("не удалось извлечь видео из ссылки")
	}

	// --- Phase 2: HTTP calls to YouTube WITHOUT holding the mutex ---
	client := s.getHTTPClient()

	var info *VideoInfo
	var err error

	if videoID != "" {
		info, err = CheckVideo(videoID, apiKey, client)
		if err != nil {
			return nil, err
		}
	} else {
		info, err = SearchYouTube(rawInput, client)
		if err != nil {
			return nil, err
		}
	}

	// 3. Blacklist check (no lock needed, using snapshot)
	for _, blTrack := range blacklistTracks {
		if strings.EqualFold(strings.TrimSpace(blTrack), info.VideoID) {
			return nil, fmt.Errorf("трек находится в чёрном списке")
		}
	}
	for _, blChan := range blacklistChannels {
		if strings.EqualFold(strings.TrimSpace(blChan), strings.TrimSpace(info.Author)) {
			return nil, fmt.Errorf("канал «%s» находится в чёрном списке", info.Author)
		}
	}

	// --- Phase 3: Write-lock to mutate state ---
	s.mu.Lock()
	defer s.mu.Unlock()

	// 4. Duplicate check in active queue or current track (re-check under write lock)
	if s.currentTrack != nil && s.currentTrack.VideoID == info.VideoID {
		return nil, fmt.Errorf("этот трек уже играет прямо сейчас")
	}
	for _, t := range s.queue {
		if t.VideoID == info.VideoID {
			return nil, fmt.Errorf("этот трек уже есть в очереди")
		}
	}

	// 5. Per-user track limit in queue
	if maxTracksPerUser > 0 && platform != "manual" {
		userTrackCount := 0
		reqLower := strings.ToLower(requestedBy)
		if s.currentTrack != nil && strings.ToLower(s.currentTrack.RequestedBy) == reqLower {
			userTrackCount++
		}
		for _, t := range s.queue {
			if strings.ToLower(t.RequestedBy) == reqLower {
				userTrackCount++
			}
		}
		if userTrackCount >= maxTracksPerUser {
			return nil, fmt.Errorf("превышен лимит треков на зрителя (макс. %d)", maxTracksPerUser)
		}
	}

	// 6. Duration check
	isOverDuration := maxDurationSec > 0 && info.Duration > maxDurationSec
	needsModeration := manualApproval

	if isOverDuration {
		if manualApproval {
			needsModeration = true
		} else {
			return nil, fmt.Errorf("длительность %s превышает максимум %s", FormatDuration(info.Duration), FormatDuration(maxDurationSec))
		}
	}

	track := &Track{
		ID:          uuid.New().String(),
		VideoID:     info.VideoID,
		Title:       info.Title,
		Author:      info.Author,
		Duration:    info.Duration,
		DurationStr: FormatDuration(info.Duration),
		Thumbnail:   info.Thumbnail,
		RequestedBy: requestedBy,
		Platform:    platform,
		Cost:        cost,
		CreatedAt:   time.Now(),
	}

	if isOverDuration {
		track.RejectReason = fmt.Sprintf("%s, выше лимита", FormatDuration(info.Duration))
		track.Status = StatusPending
		s.moderation = append(s.moderation, track)
	} else if needsModeration {
		track.Status = StatusPending
		s.moderation = append(s.moderation, track)
	} else {
		track.Status = StatusApproved

		// Check if request should interrupt currently playing music immediately
		shouldPlayImmediately := (s.currentTrack == nil) || (s.rules.InterruptOnRequest && platform != "manual")

		if shouldPlayImmediately {
			// If a track was already playing, preserve it at position 1 in queue
			if s.currentTrack != nil {
				s.currentTrack.Status = StatusApproved
				s.saveTrackToDB(s.currentTrack)
				s.queue = append([]*Track{s.currentTrack}, s.queue...)
			}
			track.Status = StatusPlaying
			track.Position = 0
			s.currentTrack = track
			s.isPlaying = true
			s.currentTime = 0
			s.reindexQueueLocked()

			if s.onTrackStart != nil {
				go s.onTrackStart(track)
			}
		} else {
			track.Position = len(s.queue) + 1
			s.queue = append(s.queue, track)
		}
	}

	s.saveTrackToDB(track)
	defer s.emitState()

	return track, nil
}

// Next finishes the current track, adds it to history, and plays the next in queue
func (s *Service) Next() (*Track, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.currentTrack != nil {
		s.currentTrack.Status = StatusDone
		s.saveTrackToDB(s.currentTrack)
		s.history = append([]*Track{s.currentTrack}, s.history...)
		if len(s.history) > 50 {
			s.history = s.history[:50]
		}
		s.currentTrack = nil
	}

	if len(s.queue) > 0 {
		s.currentTrack = s.queue[0]
		s.currentTrack.Status = StatusPlaying
		s.queue = s.queue[1:]
		s.isPlaying = true
		s.currentTime = 0
		s.saveTrackToDB(s.currentTrack)
		s.reindexQueueLocked()

		if s.onTrackStart != nil {
			go s.onTrackStart(s.currentTrack)
		}
	} else {
		s.isPlaying = false
		s.currentTime = 0
	}

	defer s.emitState()
	return s.currentTrack, nil
}

// Skip skips the current track and starts the next
func (s *Service) Skip() error {
	_, err := s.Next()
	return err
}

// Prev plays the previous track from history
func (s *Service) Prev() (*Track, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if len(s.history) == 0 {
		return nil, fmt.Errorf("история треков пуста")
	}

	prevTrack := s.history[0]
	s.history = s.history[1:]

	// Preserve currently playing track by returning it to front of queue
	if s.currentTrack != nil {
		s.currentTrack.Status = StatusApproved
		s.saveTrackToDB(s.currentTrack)
		s.queue = append([]*Track{s.currentTrack}, s.queue...)
		s.reindexQueueLocked()
	}

	prevTrack.Status = StatusPlaying
	prevTrack.Position = 0
	s.currentTrack = prevTrack
	s.isPlaying = true
	s.currentTime = 0
	s.saveTrackToDB(prevTrack)

	defer s.emitState()
	if s.onTrackStart != nil {
		go s.onTrackStart(prevTrack)
	}
	return prevTrack, nil
}

// PlayFromHistory starts playback of a track selected from history immediately
func (s *Service) PlayFromHistory(trackID string) (*Track, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var found *Track
	var foundIdx = -1
	for i, t := range s.history {
		if t.ID == trackID {
			found = t
			foundIdx = i
			break
		}
	}
	if found == nil {
		return nil, fmt.Errorf("трек не найден в истории")
	}

	s.history = append(s.history[:foundIdx], s.history[foundIdx+1:]...)

	if s.currentTrack != nil {
		s.currentTrack.Status = StatusApproved
		s.saveTrackToDB(s.currentTrack)
		s.queue = append([]*Track{s.currentTrack}, s.queue...)
		s.reindexQueueLocked()
	}

	found.Status = StatusPlaying
	found.Position = 0
	s.currentTrack = found
	s.isPlaying = true
	s.currentTime = 0
	s.saveTrackToDB(found)

	defer s.emitState()
	if s.onTrackStart != nil {
		go s.onTrackStart(found)
	}
	return found, nil
}

// RequeueFromHistory creates a new copy of a history track and appends it to queue
func (s *Service) RequeueFromHistory(trackID string) (*Track, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var found *Track
	for _, t := range s.history {
		if t.ID == trackID {
			found = t
			break
		}
	}
	if found == nil {
		return nil, fmt.Errorf("трек не найден в истории")
	}

	newTrack := &Track{
		ID:          uuid.New().String(),
		VideoID:     found.VideoID,
		Title:       found.Title,
		Author:      found.Author,
		Duration:    found.Duration,
		DurationStr: found.DurationStr,
		Thumbnail:   found.Thumbnail,
		RequestedBy: found.RequestedBy,
		Platform:    found.Platform,
		Cost:        "Повтор",
		Status:      StatusApproved,
		Position:    len(s.queue) + 1,
		CreatedAt:   time.Now(),
	}

	if s.currentTrack == nil {
		newTrack.Status = StatusPlaying
		s.currentTrack = newTrack
		s.isPlaying = true
		s.currentTime = 0
		if s.onTrackStart != nil {
			go s.onTrackStart(newTrack)
		}
	} else {
		s.queue = append(s.queue, newTrack)
	}

	s.saveTrackToDB(newTrack)
	defer s.emitState()
	return newTrack, nil
}

// Remove removes a track from the queue or moderation
func (s *Service) Remove(trackID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Check in queue
	for i, t := range s.queue {
		if t.ID == trackID {
			s.queue = append(s.queue[:i], s.queue[i+1:]...)
			s.reindexQueueLocked()
			s.deleteTrackFromDB(trackID)
			defer s.emitState()
			return nil
		}
	}

	// Check in moderation
	for i, t := range s.moderation {
		if t.ID == trackID {
			s.moderation = append(s.moderation[:i], s.moderation[i+1:]...)
			s.deleteTrackFromDB(trackID)
			defer s.emitState()
			return nil
		}
	}

	return fmt.Errorf("трек не найден")
}

// MoveUp moves a track one position up in the active queue
func (s *Service) MoveUp(trackID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i, t := range s.queue {
		if t.ID == trackID {
			if i == 0 {
				return nil // already at top
			}
			s.queue[i], s.queue[i-1] = s.queue[i-1], s.queue[i]
			s.reindexQueueLocked()
			defer s.emitState()
			return nil
		}
	}
	return fmt.Errorf("трек не найден в очереди")
}

// Reorder moves a track from one index to another in the queue
func (s *Service) Reorder(fromIndex, toIndex int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	n := len(s.queue)
	if fromIndex < 0 || fromIndex >= n || toIndex < 0 || toIndex >= n {
		return fmt.Errorf("неверные индексы перестановки")
	}
	if fromIndex == toIndex {
		return nil
	}

	track := s.queue[fromIndex]
	s.queue = append(s.queue[:fromIndex], s.queue[fromIndex+1:]...)
	newQueue := make([]*Track, 0, n)
	newQueue = append(newQueue, s.queue[:toIndex]...)
	newQueue = append(newQueue, track)
	newQueue = append(newQueue, s.queue[toIndex:]...)
	s.queue = newQueue

	s.reindexQueueLocked()
	defer s.emitState()
	return nil
}

// Approve approves a pending track from moderation and adds to queue
func (s *Service) Approve(trackID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var found *Track
	for i, t := range s.moderation {
		if t.ID == trackID {
			found = t
			s.moderation = append(s.moderation[:i], s.moderation[i+1:]...)
			break
		}
	}

	if found == nil {
		return fmt.Errorf("трек не найден в списке модерации")
	}

	found.Status = StatusApproved
	found.RejectReason = ""
	found.Position = len(s.queue) + 1

	if s.currentTrack == nil {
		found.Status = StatusPlaying
		s.currentTrack = found
		s.isPlaying = true
		s.currentTime = 0
	} else {
		s.queue = append(s.queue, found)
	}

	s.saveTrackToDB(found)
	defer s.emitState()
	return nil
}

// Reject rejects a pending track
func (s *Service) Reject(trackID string, reason string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i, t := range s.moderation {
		if t.ID == trackID {
			t.Status = StatusRejected
			t.RejectReason = reason
			s.moderation = append(s.moderation[:i], s.moderation[i+1:]...)
			s.deleteTrackFromDB(trackID)
			defer s.emitState()
			return nil
		}
	}
	return fmt.Errorf("трек не найден в списке модерации")
}

// UpdatePlayback updates current player time, pause status, and volume
func (s *Service) UpdatePlayback(currentTime float64, isPlaying bool, volume int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.currentTime = currentTime
	s.isPlaying = isPlaying
	if volume >= 0 && volume <= 100 {
		s.volume = volume
	}
	defer s.emitState()
	return nil
}

// UpdateRules updates ordering rules
func (s *Service) UpdateRules(rules MusicRules) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.rules = rules
	s.saveRulesLocked()
	defer s.emitState()
	return nil
}

// GetRules returns current rules
func (s *Service) GetRules() MusicRules {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.rules
}

// ClearQueue clears all tracks in the active queue
func (s *Service) ClearQueue() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, t := range s.queue {
		s.deleteTrackFromDB(t.ID)
	}
	s.queue = make([]*Track, 0)
	defer s.emitState()
	return nil
}

// ClearHistory clears track history
func (s *Service) ClearHistory() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, t := range s.history {
		s.deleteTrackFromDB(t.ID)
	}
	s.history = make([]*Track, 0)
	defer s.emitState()
	return nil
}

// GetState returns the current snapshot of music state
func (s *Service) GetState() MusicState {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.getStateLocked()
}

// getStateLocked returns the current state snapshot without acquiring locks.
// Caller MUST hold s.mu (either read or write lock).
func (s *Service) getStateLocked() MusicState {
	totalDur := 0
	for _, t := range s.queue {
		totalDur += t.Duration
	}

	queueCopy := make([]*Track, len(s.queue))
	copy(queueCopy, s.queue)

	modCopy := make([]*Track, len(s.moderation))
	copy(modCopy, s.moderation)

	histCopy := make([]*Track, len(s.history))
	copy(histCopy, s.history)

	return MusicState{
		CurrentTrack:          s.currentTrack,
		Queue:                 queueCopy,
		Moderation:            modCopy,
		History:               histCopy,
		TotalQueueCount:       len(s.queue),
		TotalQueueDuration:    totalDur,
		TotalQueueDurationStr: FormatDuration(totalDur),
		IsPlaying:             s.isPlaying,
		CurrentTime:           s.currentTime,
		Volume:                s.volume,
		Rules:                 s.rules,
	}
}

func (s *Service) reindexQueueLocked() {
	for i, t := range s.queue {
		t.Position = i + 1
		s.saveTrackToDB(t)
	}
}

func (s *Service) deleteTrackFromDB(trackID string) {
	if s.db == nil {
		return
	}
	_, _ = s.db.Exec("DELETE FROM music_tracks WHERE id = ?", trackID)
}
