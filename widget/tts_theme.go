package widget

import (
	"os"
	"path/filepath"
)

// EnsureDefaultTTSTheme creates the default TTS status widget theme directory.
func EnsureDefaultTTSTheme(themesDir string) error {
	defaultDir := filepath.Join(themesDir, "tts", "default")
	if err := os.MkdirAll(defaultDir, 0755); err != nil {
		return err
	}

	htmlPath := filepath.Join(defaultDir, "index.html")
	if _, err := os.Stat(htmlPath); os.IsNotExist(err) {
		if err := os.WriteFile(htmlPath, []byte(defaultTTSHTML), 0644); err != nil {
			return err
		}
	}

	cssPath := filepath.Join(defaultDir, "style.css")
	if _, err := os.Stat(cssPath); os.IsNotExist(err) {
		if err := os.WriteFile(cssPath, []byte(defaultTTSCSS), 0644); err != nil {
			return err
		}
	}

	return nil
}

const defaultTTSHTML = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TTS Status Widget</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/widget/tts/assets/default/style.css">
</head>
<body>
  <div id="tts-container" class="tts-root style-glass pos-bottom-right hidden">
    <div class="tts-card" id="card">
      <!-- Glow ambient background -->
      <div class="ambient-glow" id="ambient-glow"></div>

      <!-- Header row: engine badge + equalizer or pulse spinner -->
      <div class="tts-header">
        <div class="engine-badge" id="engine-badge">
          <span class="engine-icon" id="engine-icon">⚡</span>
          <span class="engine-name" id="engine-name">Supertonic</span>
        </div>

        <!-- Animated visualizer when playing / spinner when generating -->
        <div class="visualizer" id="visualizer">
          <div class="eq-bar"></div>
          <div class="eq-bar"></div>
          <div class="eq-bar"></div>
          <div class="eq-bar"></div>
          <div class="eq-bar"></div>
        </div>

        <div class="spinner-box" id="spinner-box">
          <div class="neural-spinner"></div>
        </div>
      </div>

      <!-- Main body: user and status/text -->
      <div class="tts-body">
        <div class="author-row">
          <span class="user-pill" id="user-pill">@Зритель</span>
          <span class="voice-tag" id="voice-tag">M1</span>
        </div>
        <div class="message-text" id="message-text">Генерация озвучки...</div>
      </div>
    </div>
  </div>

  <script>
    const params = new URLSearchParams(window.location.search);
    const style = (params.get('style') || 'glass').toLowerCase(); // 'glass', 'neon', 'compact'
    const pos = (params.get('position') || 'bottom-right').toLowerCase();
    const accent = params.get('accent') || '#3B82F6';

    const container = document.getElementById('tts-container');
    const card = document.getElementById('card');
    const engineBadge = document.getElementById('engine-badge');
    const engineIcon = document.getElementById('engine-icon');
    const engineName = document.getElementById('engine-name');
    const visualizer = document.getElementById('visualizer');
    const spinnerBox = document.getElementById('spinner-box');
    const userPill = document.getElementById('user-pill');
    const voiceTag = document.getElementById('voice-tag');
    const messageText = document.getElementById('message-text');
    const ambientGlow = document.getElementById('ambient-glow');

    // Apply configuration
    container.className = 'tts-root style-' + style + ' pos-' + pos + ' hidden';
    if (accent) {
      document.documentElement.style.setProperty('--accent', accent);
    }

    let hideTimer = null;

    function setStatus(data) {
      if (!data) return;
      const state = (data.state || data.type || 'idle').toLowerCase();

      if (state === 'idle') {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
          container.classList.add('hidden');
          container.classList.remove('state-generating', 'state-playing');
        }, 1200);
        return;
      }

      clearTimeout(hideTimer);
      container.classList.remove('hidden');

      // Update text details
      const author = data.author ? ('@' + data.author.replace(/^@/, '')) : '@Зритель';
      userPill.textContent = author;
      messageText.textContent = data.text || 'Воспроизведение речи...';

      // Engine badge
      const engine = (data.engine || 'supertonic').toLowerCase();
      if (engine === 'supertonic') {
        engineIcon.textContent = '⚡';
        engineName.textContent = 'Supertonic AI';
        engineBadge.style.borderColor = 'rgba(59, 130, 246, 0.4)';
      } else if (engine === 'yandex') {
        engineIcon.textContent = '🟣';
        engineName.textContent = 'Алиса TTS';
        engineBadge.style.borderColor = 'rgba(168, 85, 247, 0.4)';
      } else {
        engineIcon.textContent = '🎙';
        engineName.textContent = 'Системный TTS';
        engineBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
      }

      // Voice
      voiceTag.textContent = data.voice ? String(data.voice).split('.').pop() : 'Default';

      if (state === 'generating') {
        container.classList.remove('state-playing');
        container.classList.add('state-generating');
        spinnerBox.style.display = 'flex';
        visualizer.style.display = 'none';
        messageText.textContent = data.text ? ('«' + data.text + '»') : 'Синтез аудиопотока...';
      } else if (state === 'playing') {
        container.classList.remove('state-generating');
        container.classList.add('state-playing');
        spinnerBox.style.display = 'none';
        visualizer.style.display = 'flex';
        messageText.textContent = data.text ? ('«' + data.text + '»') : 'Воспроизведение...';
      }
    }

    // Connect to SSE stream
    function connectSSE() {
      const es = new EventSource('/widget/events');

      es.addEventListener('tts_status', (e) => {
        try {
          const data = JSON.parse(e.data);
          setStatus(data);
        } catch (err) {
          console.error('[TTS Widget] JSON error:', err);
        }
      });

      // Also listen on default message event
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'tts_status') {
            setStatus(data);
          }
        } catch (_) {}
      };

      es.onerror = () => {
        es.close();
        setTimeout(connectSSE, 3000);
      };
    }

    connectSSE();
  </script>
</body>
</html>
`

const defaultTTSCSS = `:root {
  --accent: #3B82F6;
  --accent-glow: rgba(59, 130, 246, 0.35);
  --bg-card: rgba(18, 20, 29, 0.88);
  --border-card: rgba(255, 255, 255, 0.08);
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background: transparent;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  overflow: hidden;
  height: 100vh;
  width: 100vw;
}

.tts-root {
  position: absolute;
  padding: 16px;
  transition: opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1), transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  will-change: transform, opacity;
}

.pos-bottom-right { bottom: 0; right: 0; }
.pos-bottom-left  { bottom: 0; left: 0; }
.pos-top-right    { top: 0; right: 0; }
.pos-top-left     { top: 0; left: 0; }

.tts-root.hidden {
  opacity: 0;
  transform: translateY(16px) scale(0.96);
  pointer-events: none;
}

.tts-card {
  position: relative;
  background: var(--bg-card);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border-card);
  border-radius: 16px;
  padding: 12px 16px;
  width: 320px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

/* Ambient backlight */
.ambient-glow {
  position: absolute;
  top: -20px;
  right: -20px;
  width: 120px;
  height: 120px;
  background: radial-gradient(circle, var(--accent-glow) 0%, transparent 70%);
  opacity: 0.6;
  pointer-events: none;
  filter: blur(20px);
}

.tts-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.engine-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 600;
  color: #ECECF1;
  letter-spacing: 0.02em;
}

.engine-icon {
  font-size: 12px;
}

/* Equalizer Bars */
.visualizer {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 16px;
  padding-right: 4px;
}

.eq-bar {
  width: 3px;
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  animation: eqBounce 0.8s ease-in-out infinite alternate;
  box-shadow: 0 0 8px var(--accent-glow);
}

.eq-bar:nth-child(1) { height: 30%; animation-delay: 0.1s; }
.eq-bar:nth-child(2) { height: 80%; animation-delay: 0.35s; }
.eq-bar:nth-child(3) { height: 100%; animation-delay: 0.15s; }
.eq-bar:nth-child(4) { height: 50%; animation-delay: 0.45s; }
.eq-bar:nth-child(5) { height: 70%; animation-delay: 0.25s; }

@keyframes eqBounce {
  0% { transform: scaleY(0.2); }
  50% { transform: scaleY(1); }
  100% { transform: scaleY(0.4); }
}

/* Neural Spinner */
.spinner-box {
  display: flex;
  align-items: center;
  justify-content: center;
}

.neural-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.15);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Body */
.author-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.user-pill {
  font-size: 13px;
  font-weight: 700;
  color: #FFFFFF;
  text-shadow: 0 1px 2px rgba(0,0,0,0.4);
}

.voice-tag {
  font-size: 10px;
  font-family: 'JetBrains Mono', monospace;
  background: rgba(255, 255, 255, 0.08);
  color: #A0A5B5;
  padding: 1px 6px;
  border-radius: 4px;
}

.message-text {
  font-size: 12px;
  color: #C7CBD6;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-word;
}

/* State pulse animations */
.state-generating .ambient-glow {
  background: radial-gradient(circle, rgba(234, 179, 8, 0.45) 0%, transparent 70%);
  animation: pulseAmber 1.4s ease-in-out infinite alternate;
}

@keyframes pulseAmber {
  0% { transform: scale(0.9); opacity: 0.4; }
  100% { transform: scale(1.2); opacity: 0.8; }
}

.state-playing .ambient-glow {
  background: radial-gradient(circle, var(--accent-glow) 0%, transparent 70%);
}

/* Neon Style */
.style-neon .tts-card {
  background: #0B0E14;
  border: 1px solid var(--accent);
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.35), inset 0 0 10px rgba(59, 130, 246, 0.1);
}

/* Compact Style */
.style-compact .tts-card {
  width: 250px;
  padding: 8px 12px;
  border-radius: 28px;
}

.style-compact .message-text {
  -webkit-line-clamp: 1;
  font-size: 11px;
}
`
