package tts

import (
	"bufio"
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"ReChat/proxy"
)

//go:embed runner.py
var embeddedRunner []byte

// SupertonicModelFile represents an individual model asset to download from Hugging Face
type SupertonicModelFile struct {
	RelativePath string
	DownloadURL  string
	ApproxSize   int64
}

// SupertonicStatus represents the current state of the local model
type SupertonicStatus struct {
	Installed       bool    `json:"installed"`
	Downloading     bool    `json:"downloading"`
	Progress        float64 `json:"progress"`        // 0.0 to 100.0
	CurrentFile     string  `json:"currentFile"`     // name of file currently downloading
	DownloadedBytes int64   `json:"downloadedBytes"` // total bytes downloaded so far
	TotalBytes      int64   `json:"totalBytes"`      // total expected bytes
	Speed           string  `json:"speed"`           // e.g. "4.8 MB/s"
	ModelDir        string  `json:"modelDir"`
	Error           string  `json:"error,omitempty"`
}

// SupertonicManager manages local Supertonic model assets and inference
type SupertonicManager struct {
	modelDir       string
	mu             sync.RWMutex
	status         SupertonicStatus
	cancelDownload context.CancelFunc
	onProgress     func(status SupertonicStatus)

	runnerMu      sync.Mutex
	runnerCmd     *exec.Cmd
	runnerStdin   io.WriteCloser
	runnerScanner *bufio.Scanner
}

const (
	huggingFaceBase = "https://huggingface.co/Supertone/supertonic-3/resolve/main"
)

var defaultModelFiles = []SupertonicModelFile{
	{
		RelativePath: "onnx/tts.json",
		DownloadURL:  huggingFaceBase + "/onnx/tts.json",
		ApproxSize:   8 * 1024,
	},
	{
		RelativePath: "onnx/unicode_indexer.json",
		DownloadURL:  huggingFaceBase + "/onnx/unicode_indexer.json",
		ApproxSize:   278 * 1024,
	},
	{
		RelativePath: "voice_styles/M1.json",
		DownloadURL:  huggingFaceBase + "/voice_styles/M1.json",
		ApproxSize:   16 * 1024,
	},
	{
		RelativePath: "voice_styles/M2.json",
		DownloadURL:  huggingFaceBase + "/voice_styles/M2.json",
		ApproxSize:   16 * 1024,
	},
	{
		RelativePath: "voice_styles/M3.json",
		DownloadURL:  huggingFaceBase + "/voice_styles/M3.json",
		ApproxSize:   16 * 1024,
	},
	{
		RelativePath: "voice_styles/M4.json",
		DownloadURL:  huggingFaceBase + "/voice_styles/M4.json",
		ApproxSize:   16 * 1024,
	},
	{
		RelativePath: "voice_styles/M5.json",
		DownloadURL:  huggingFaceBase + "/voice_styles/M5.json",
		ApproxSize:   16 * 1024,
	},
	{
		RelativePath: "voice_styles/F1.json",
		DownloadURL:  huggingFaceBase + "/voice_styles/F1.json",
		ApproxSize:   16 * 1024,
	},
	{
		RelativePath: "voice_styles/F2.json",
		DownloadURL:  huggingFaceBase + "/voice_styles/F2.json",
		ApproxSize:   16 * 1024,
	},
	{
		RelativePath: "voice_styles/F3.json",
		DownloadURL:  huggingFaceBase + "/voice_styles/F3.json",
		ApproxSize:   16 * 1024,
	},
	{
		RelativePath: "voice_styles/F4.json",
		DownloadURL:  huggingFaceBase + "/voice_styles/F4.json",
		ApproxSize:   16 * 1024,
	},
	{
		RelativePath: "voice_styles/F5.json",
		DownloadURL:  huggingFaceBase + "/voice_styles/F5.json",
		ApproxSize:   16 * 1024,
	},
	{
		RelativePath: "onnx/duration_predictor.onnx",
		DownloadURL:  huggingFaceBase + "/onnx/duration_predictor.onnx",
		ApproxSize:   3700 * 1024,
	},
	{
		RelativePath: "onnx/text_encoder.onnx",
		DownloadURL:  huggingFaceBase + "/onnx/text_encoder.onnx",
		ApproxSize:   36400 * 1024,
	},
	{
		RelativePath: "onnx/vocoder.onnx",
		DownloadURL:  huggingFaceBase + "/onnx/vocoder.onnx",
		ApproxSize:   101000 * 1024,
	},
	{
		RelativePath: "onnx/vector_estimator.onnx",
		DownloadURL:  huggingFaceBase + "/onnx/vector_estimator.onnx",
		ApproxSize:   257000 * 1024,
	},
}

// NewSupertonicManager creates a new Supertonic manager
func NewSupertonicManager() *SupertonicManager {
	dir := DefaultModelDir()
	mgr := &SupertonicManager{
		modelDir: dir,
	}
	mgr.refreshStatus()

	// Pre-warm the background ONNX runner if models are installed
	if mgr.status.Installed {
		go func() {
			mgr.runnerMu.Lock()
			_ = mgr.ensureRunnerLocked()
			mgr.runnerMu.Unlock()
		}()
	}

	return mgr
}

// DefaultModelDir returns the directory where Supertonic-3 model weights are stored.
// This path is passed to SUPERTONIC_CACHE_DIR env var so the library uses it.
func DefaultModelDir() string {
	appData := os.Getenv("APPDATA")
	if appData != "" {
		return filepath.Join(appData, "ReChat", "models", "supertonic3")
	}
	home, _ := os.UserHomeDir()
	if home != "" {
		return filepath.Join(home, ".rechat", "models", "supertonic3")
	}
	return filepath.Join("data", "models", "supertonic3")
}

// SetOnProgress sets callback for download progress updates
func (m *SupertonicManager) SetOnProgress(fn func(status SupertonicStatus)) {
	m.mu.Lock()
	m.onProgress = fn
	m.mu.Unlock()
}

func (m *SupertonicManager) refreshStatus() {
	installed := m.isInstalledLocked()
	m.status.Installed = installed
	m.status.ModelDir = m.modelDir
}

// isInstalledLocked checks if all required model files are present on disk
func (m *SupertonicManager) isInstalledLocked() bool {
	essential := []string{
		filepath.Join(m.modelDir, "onnx", "tts.json"),
		filepath.Join(m.modelDir, "onnx", "unicode_indexer.json"),
		filepath.Join(m.modelDir, "onnx", "duration_predictor.onnx"),
		filepath.Join(m.modelDir, "onnx", "text_encoder.onnx"),
		filepath.Join(m.modelDir, "onnx", "vocoder.onnx"),
		filepath.Join(m.modelDir, "onnx", "vector_estimator.onnx"),
	}
	for _, f := range essential {
		info, err := os.Stat(f)
		if err != nil || info.Size() < 1000 {
			return false
		}
	}
	return true
}

// GetStatus returns the current installation / download status
func (m *SupertonicManager) GetStatus() SupertonicStatus {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.refreshStatus()
	return m.status
}

// GetVoices returns available Supertonic voice styles
func (m *SupertonicManager) GetVoices() map[string]string {
	return map[string]string{
		"M1": "Supertonic — Мужской (M1 Глубокий)",
		"M2": "Supertonic — Мужской (M2 Энергичный)",
		"M3": "Supertonic — Мужской (M3 Спокойный)",
		"M4": "Supertonic — Мужской (M4 Дружелюбный)",
		"M5": "Supertonic — Мужской (M5 Уверенный)",
		"F1": "Supertonic — Женский (F1 Мягкий)",
		"F2": "Supertonic — Женский (F2 Выразительный)",
		"F3": "Supertonic — Женский (F3 Нежный)",
		"F4": "Supertonic — Женский (F4 Яркий)",
		"F5": "Supertonic — Женский (F5 Тёплый)",
	}
}

// StartDownload starts downloading model files in a background goroutine
func (m *SupertonicManager) StartDownload() error {
	m.mu.Lock()
	if m.status.Downloading {
		m.mu.Unlock()
		return fmt.Errorf("скачивание уже выполняется")
	}

	ctx, cancel := context.WithCancel(context.Background())
	m.cancelDownload = cancel
	m.status.Downloading = true
	m.status.Progress = 0
	m.status.DownloadedBytes = 0
	m.status.TotalBytes = 0
	m.status.Error = ""
	for _, f := range defaultModelFiles {
		m.status.TotalBytes += f.ApproxSize
	}
	onProg := m.onProgress
	m.mu.Unlock()

	if onProg != nil {
		onProg(m.GetStatus())
	}

	go m.downloadLoop(ctx)
	return nil
}

// CancelDownload cancels an active download
func (m *SupertonicManager) CancelDownload() {
	m.mu.Lock()
	if m.cancelDownload != nil {
		m.cancelDownload()
		m.cancelDownload = nil
	}
	m.status.Downloading = false
	m.status.Speed = ""
	m.status.CurrentFile = ""
	onProg := m.onProgress
	m.mu.Unlock()

	if onProg != nil {
		onProg(m.GetStatus())
	}
}

// DeleteModel removes downloaded model files from disk
func (m *SupertonicManager) DeleteModel() error {
	m.CancelDownload()
	m.Close()
	m.mu.Lock()
	defer m.mu.Unlock()
	err := os.RemoveAll(m.modelDir)
	m.refreshStatus()
	if m.onProgress != nil {
		m.onProgress(m.status)
	}
	return err
}

func (m *SupertonicManager) downloadLoop(ctx context.Context) {
	baseClient := proxy.GetHTTPClient()
	client := &http.Client{
		Transport: baseClient.Transport,
		Timeout:   0, // Unlimited duration for large files, governed by context
	}
	_ = os.MkdirAll(m.modelDir, 0755)

	var totalDownloaded int64
	startTime := time.Now()

	for _, fileInfo := range defaultModelFiles {
		select {
		case <-ctx.Done():
			log.Printf("[Supertonic] Download cancelled")
			return
		default:
		}

		destPath := filepath.Join(m.modelDir, filepath.FromSlash(fileInfo.RelativePath))
		_ = os.MkdirAll(filepath.Dir(destPath), 0755)

		// Check if file already exists with matching size
		if stat, err := os.Stat(destPath); err == nil && stat.Size() > 0 {
			totalDownloaded += stat.Size()
			m.updateProgress(fileInfo.RelativePath, totalDownloaded, startTime)
			continue
		}

		m.updateProgress(fileInfo.RelativePath, totalDownloaded, startTime)

		err := m.downloadSingleFile(ctx, client, fileInfo.DownloadURL, destPath, func(chunk int64) {
			totalDownloaded += chunk
			m.updateProgress(fileInfo.RelativePath, totalDownloaded, startTime)
		})

		if err != nil {
			if ctx.Err() != nil {
				return // cancelled
			}
			log.Printf("[Supertonic] Failed to download %s: %v", fileInfo.RelativePath, err)
			m.mu.Lock()
			m.status.Downloading = false
			m.status.Error = fmt.Sprintf("Ошибка загрузки %s: %v", fileInfo.RelativePath, err)
			onProg := m.onProgress
			m.mu.Unlock()
			if onProg != nil {
				onProg(m.GetStatus())
			}
			return
		}
	}

	m.mu.Lock()
	m.status.Downloading = false
	m.status.Progress = 100
	m.status.Installed = true
	m.status.Speed = ""
	m.status.CurrentFile = ""
	m.status.Error = ""
	onProg := m.onProgress
	m.mu.Unlock()

	log.Printf("[Supertonic] All model files successfully downloaded to %s", m.modelDir)
	if onProg != nil {
		onProg(m.GetStatus())
	}
}

func (m *SupertonicManager) updateProgress(currentFile string, downloaded int64, startTime time.Time) {
	m.mu.Lock()
	m.status.CurrentFile = filepath.Base(currentFile)
	m.status.DownloadedBytes = downloaded
	if m.status.TotalBytes > 0 {
		m.status.Progress = math.Min(100.0, float64(downloaded)/float64(m.status.TotalBytes)*100.0)
	}

	elapsed := time.Since(startTime).Seconds()
	if elapsed > 0.5 {
		bytesPerSec := float64(downloaded) / elapsed
		if bytesPerSec >= 1024*1024 {
			m.status.Speed = fmt.Sprintf("%.1f MB/s", bytesPerSec/(1024*1024))
		} else {
			m.status.Speed = fmt.Sprintf("%.0f KB/s", bytesPerSec/1024)
		}
	}
	statusCopy := m.status
	onProg := m.onProgress
	m.mu.Unlock()

	if onProg != nil {
		onProg(statusCopy)
	}
}

func (m *SupertonicManager) downloadSingleFile(
	ctx context.Context,
	client *http.Client,
	url, destPath string,
	onChunk func(n int64),
) error {
	tmpPath := destPath + ".tmp"
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "ReChat-Supertonic-Installer/1.0")

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP status %d", resp.StatusCode)
	}

	out, err := os.Create(tmpPath)
	if err != nil {
		return err
	}
	defer func() {
		_ = out.Close()
		_ = os.Remove(tmpPath)
	}()

	buf := make([]byte, 64*1024)
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		n, readErr := resp.Body.Read(buf)
		if n > 0 {
			if _, writeErr := out.Write(buf[:n]); writeErr != nil {
				return writeErr
			}
			onChunk(int64(n))
		}
		if readErr != nil {
			if readErr == io.EOF {
				break
			}
			return readErr
		}
	}

	_ = out.Close()
	return os.Rename(tmpPath, destPath)
}

type runnerRequest struct {
	Text  string  `json:"text"`
	Voice string  `json:"voice"`
	Lang  string  `json:"lang"`
	Speed float64 `json:"speed"`
	Steps int     `json:"steps"`
}

type runnerResponse struct {
	Status   string  `json:"status"`
	DataURI  string  `json:"dataUri"`
	Duration float64 `json:"duration"`
	Error    string  `json:"error"`
}

func findPythonExe() string {
	localAppData := os.Getenv("LOCALAPPDATA")
	// 1. Check modern Python core install (e.g. %LOCALAPPDATA%\Python\pythoncore-*\python.exe)
	if localAppData != "" {
		matchesCore, _ := filepath.Glob(filepath.Join(localAppData, "Python", "pythoncore-*", "python.exe"))
		if len(matchesCore) > 0 {
			return matchesCore[len(matchesCore)-1]
		}
		matchesProg, _ := filepath.Glob(filepath.Join(localAppData, "Programs", "Python", "Python*", "python.exe"))
		if len(matchesProg) > 0 {
			return matchesProg[len(matchesProg)-1]
		}
	}

	// 2. Query Windows py launcher target silently
	pyCmd := exec.Command("py", "-c", "import sys; print(sys.executable)")
	pyCmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x08000000, // CREATE_NO_WINDOW
	}
	if out, err := pyCmd.Output(); err == nil {
		path := strings.TrimSpace(string(out))
		if path != "" {
			if _, err := os.Stat(path); err == nil {
				return path
			}
		}
	}

	// 3. Fallback candidates in PATH
	candidates := []string{"python", "python3", "py"}
	for _, name := range candidates {
		if p, err := exec.LookPath(name); err == nil {
			return p
		}
	}
	return "python"
}

func (m *SupertonicManager) ensureRunnerLocked() error {
	if m.runnerCmd != nil && m.runnerStdin != nil && m.runnerScanner != nil {
		return nil
	}

	m.mu.RLock()
	installed := m.isInstalledLocked()
	m.mu.RUnlock()
	if !installed {
		return fmt.Errorf("модель Supertonic не установлена")
	}

	_ = os.MkdirAll(m.modelDir, 0755)
	runnerPath := filepath.Join(m.modelDir, "runner.py")
	if len(embeddedRunner) > 0 {
		_ = os.WriteFile(runnerPath, embeddedRunner, 0644)
	}

	pyExe := findPythonExe()
	cmd := exec.Command(pyExe, runnerPath, m.modelDir)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x08000000, // CREATE_NO_WINDOW
	}

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return fmt.Errorf("stdin pipe error: %w", err)
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		_ = stdin.Close()
		return fmt.Errorf("stdout pipe error: %w", err)
	}

	// Drain stderr in background to prevent Windows pipe buffer deadlocks
	stderr, err := cmd.StderrPipe()
	if err == nil {
		go func() {
			sc := bufio.NewScanner(stderr)
			for sc.Scan() {
				log.Printf("[Supertonic PY] %s", sc.Text())
			}
		}()
	}

	if err := cmd.Start(); err != nil {
		_ = stdin.Close()
		return fmt.Errorf("не удалось запустить runner: %w", err)
	}

	scanner := bufio.NewScanner(stdout)
	buf := make([]byte, 64*1024)
	scanner.Buffer(buf, 16*1024*1024)

	// Read initial ready message with timeout to prevent blocking UI
	type initResult struct {
		line string
		err  error
	}
	initCh := make(chan initResult, 1)
	go func() {
		if scanner.Scan() {
			initCh <- initResult{line: scanner.Text()}
		} else {
			initCh <- initResult{err: scanner.Err()}
		}
	}()

	var initLine string
	select {
	case res := <-initCh:
		if res.err != nil {
			_ = stdin.Close()
			if cmd.Process != nil {
				_ = cmd.Process.Kill()
			}
			return fmt.Errorf("runner завершился до инициализации: %v", res.err)
		}
		initLine = res.line
	case <-time.After(15 * time.Second):
		_ = stdin.Close()
		if cmd.Process != nil {
			_ = cmd.Process.Kill()
		}
		return fmt.Errorf("таймаут инициализации модели Supertonic (15 сек)")
	}

	var initResp struct {
		Status string `json:"status"`
		Error  string `json:"error"`
	}
	if err := json.Unmarshal([]byte(initLine), &initResp); err != nil || initResp.Status != "ready" {
		_ = stdin.Close()
		if cmd.Process != nil {
			_ = cmd.Process.Kill()
		}
		return fmt.Errorf("ошибка инициализации runner: %s (raw: %s)", initResp.Error, initLine)
	}

	m.runnerCmd = cmd
	m.runnerStdin = stdin
	m.runnerScanner = scanner
	log.Printf("[Supertonic] ONNX runner process started (PID: %d)", cmd.Process.Pid)
	return nil
}

// Close gracefully terminates the Python ONNX runner child process
func (m *SupertonicManager) Close() {
	m.runnerMu.Lock()
	defer m.runnerMu.Unlock()

	if m.runnerStdin != nil {
		_, _ = m.runnerStdin.Write([]byte("{\"action\":\"stop\"}\n"))
		_ = m.runnerStdin.Close()
		m.runnerStdin = nil
	}
	if m.runnerCmd != nil {
		if m.runnerCmd.Process != nil {
			_ = m.runnerCmd.Process.Kill()
		}
		m.runnerCmd = nil
	}
	m.runnerScanner = nil
}

// GenerateSpeech generates a synthesized speech data URI using Supertonic ONNX neural inference
func (m *SupertonicManager) GenerateSpeech(text, voice string) (string, error) {
	clean := strings.TrimSpace(text)
	if clean == "" {
		return "", fmt.Errorf("текст не может быть пустым")
	}

	m.runnerMu.Lock()
	defer m.runnerMu.Unlock()

	if err := m.ensureRunnerLocked(); err != nil {
		log.Printf("[Supertonic] Runner unavailable: %v", err)
		return "", fmt.Errorf("модель Supertonic не готова: %w", err)
	}

	if voice == "" {
		voice = "M1"
	}

	reqData, _ := json.Marshal(runnerRequest{
		Text:  clean,
		Voice: voice,
		Lang:  "ru",
		Speed: 1.0,
		Steps: 16,
	})

	if _, err := m.runnerStdin.Write(append(reqData, '\n')); err != nil {
		log.Printf("[Supertonic] Stdin write error, restarting runner: %v", err)
		m.runnerCmd = nil
		m.runnerStdin = nil
		m.runnerScanner = nil
		if err := m.ensureRunnerLocked(); err != nil {
			return "", fmt.Errorf("ошибка перезапуска runner: %w", err)
		}
		if _, err := m.runnerStdin.Write(append(reqData, '\n')); err != nil {
			return "", fmt.Errorf("ошибка передачи данных в runner: %w", err)
		}
	}

	type scanResult struct {
		data []byte
		err  error
	}
	scanCh := make(chan scanResult, 1)
	go func() {
		if m.runnerScanner.Scan() {
			scanCh <- scanResult{data: m.runnerScanner.Bytes()}
		} else {
			scanCh <- scanResult{err: m.runnerScanner.Err()}
		}
	}()

	var respBytes []byte
	select {
	case res := <-scanCh:
		if res.err != nil {
			m.runnerCmd = nil
			m.runnerStdin = nil
			m.runnerScanner = nil
			return "", fmt.Errorf("runner не вернул аудио: %v", res.err)
		}
		respBytes = res.data
	case <-time.After(20 * time.Second):
		m.runnerCmd = nil
		m.runnerStdin = nil
		m.runnerScanner = nil
		return "", fmt.Errorf("таймаут синтеза речи (20 сек)")
	}

	var resp runnerResponse
	if err := json.Unmarshal(respBytes, &resp); err != nil {
		return "", fmt.Errorf("некорректный JSON ответа runner: %w", err)
	}

	if resp.Status != "ok" {
		return "", fmt.Errorf("ошибка генерации речи: %s", resp.Error)
	}

	return resp.DataURI, nil
}
