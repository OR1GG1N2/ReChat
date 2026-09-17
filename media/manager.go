package media

import (
	"bufio"
	"context"
	_ "embed"
	"encoding/json"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"syscall"
	"time"
)

//go:embed mediawatcher.exe
var embeddedWatcher []byte

// TrackInfo represents current playback metadata.
type TrackInfo struct {
	Status    string `json:"status"`    // "playing", "paused", "stopped"
	Title     string `json:"title"`
	Artist    string `json:"artist"`
	Album     string `json:"album"`
	Thumbnail string `json:"thumbnail"` // data URI (data:image/jpeg;base64,...)
	Source    string `json:"source"`
	Timestamp int64  `json:"timestamp"`
}

// Manager supervises the background mediawatcher process and emits track updates.
type Manager struct {
	mu        sync.RWMutex
	current   TrackInfo
	listeners []func(TrackInfo)

	cmd    *exec.Cmd
	cancel context.CancelFunc
	done   chan struct{}
}

// NewManager creates a new media manager instance.
func NewManager() *Manager {
	return &Manager{
		done: make(chan struct{}),
		current: TrackInfo{
			Status: "stopped",
		},
	}
}

// OnTrackChange registers a listener for track updates.
func (m *Manager) OnTrackChange(cb func(TrackInfo)) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.listeners = append(m.listeners, cb)
}

// CurrentTrack returns the currently cached track info.
func (m *Manager) CurrentTrack() TrackInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.current
}

// SetTrack manually sets and broadcasts track info (e.g. for testing).
func (m *Manager) SetTrack(info TrackInfo) {
	if info.Timestamp == 0 {
		info.Timestamp = time.Now().UnixMilli()
	}
	m.mu.Lock()
	m.current = info
	listeners := append([]func(TrackInfo){}, m.listeners...)
	m.mu.Unlock()

	for _, cb := range listeners {
		cb(info)
	}
}

// Start extracts mediawatcher.exe if needed and runs it in the background.
func (m *Manager) Start() {
	exePath := m.ensureWatcherBinary()
	if exePath == "" {
		log.Printf("[MediaManager] Could not locate or extract mediawatcher.exe")
		return
	}

	ctx, cancel := context.WithCancel(context.Background())
	m.cancel = cancel

	go m.runLoop(ctx, exePath)
}

func (m *Manager) runLoop(ctx context.Context, exePath string) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		cmd := exec.CommandContext(ctx, exePath)
		// Hide window on Windows
		cmd.SysProcAttr = &syscall.SysProcAttr{
			HideWindow:    true,
			CreationFlags: 0x08000000, // CREATE_NO_WINDOW
		}

		stdout, err := cmd.StdoutPipe()
		if err != nil {
			log.Printf("[MediaManager] StdoutPipe error: %v", err)
			time.Sleep(3 * time.Second)
			continue
		}

		if err := cmd.Start(); err != nil {
			log.Printf("[MediaManager] Start error: %v", err)
			time.Sleep(3 * time.Second)
			continue
		}

		m.mu.Lock()
		m.cmd = cmd
		m.mu.Unlock()

		scanner := bufio.NewScanner(stdout)
		// Set buffer limit to 4MB to safely handle large embedded album art base64
		buf := make([]byte, 64*1024)
		scanner.Buffer(buf, 4*1024*1024)

		for scanner.Scan() {
			line := scanner.Text()
			if len(line) == 0 {
				continue
			}

			var track TrackInfo
			if err := json.Unmarshal([]byte(line), &track); err != nil {
				continue
			}

			track.Timestamp = time.Now().UnixMilli()
			m.mu.Lock()
			m.current = track
			listeners := append([]func(TrackInfo){}, m.listeners...)
			m.mu.Unlock()

			for _, cb := range listeners {
				cb(track)
			}
		}

		_ = cmd.Wait()

		select {
		case <-ctx.Done():
			return
		default:
			time.Sleep(2 * time.Second)
		}
	}
}

// Stop cleanly terminates the mediawatcher child process.
func (m *Manager) Stop() {
	if m.cancel != nil {
		m.cancel()
	}
	m.mu.Lock()
	if m.cmd != nil && m.cmd.Process != nil {
		_ = m.cmd.Process.Kill()
	}
	m.mu.Unlock()
}

func (m *Manager) ensureWatcherBinary() string {
	// 1. Check next to executable or working dir
	localPath := filepath.Join("media", "mediawatcher.exe")
	if info, err := os.Stat(localPath); err == nil && info.Size() > 1000 {
		return localPath
	}

	// 2. Fallback to %APPDATA%/ReChat/mediawatcher.exe
	configDir, err := os.UserConfigDir()
	if err != nil {
		configDir = os.TempDir()
	}
	destDir := filepath.Join(configDir, "ReChat")
	_ = os.MkdirAll(destDir, 0755)
	destPath := filepath.Join(destDir, "mediawatcher.exe")

	// If already extracted and matches size, use it
	if len(embeddedWatcher) > 0 {
		if fi, err := os.Stat(destPath); err == nil && fi.Size() == int64(len(embeddedWatcher)) {
			return destPath
		}
		// Write/overwrite
		if err := os.WriteFile(destPath, embeddedWatcher, 0755); err == nil {
			return destPath
		}
	}

	if _, err := os.Stat(destPath); err == nil {
		return destPath
	}

	return localPath
}
