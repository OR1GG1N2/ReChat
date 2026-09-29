package widget

import (
	"os"
	"path/filepath"
)

// MusicThemesDir returns the music themes directory inside themes.
func MusicThemesDir(rootThemesDir string) string {
	return filepath.Join(rootThemesDir, "music")
}

// EnsureDefaultMusicTheme ensures the default music theme files exist.
func EnsureDefaultMusicTheme(themesDir string) error {
	defaultDir := filepath.Join(themesDir, "music", "default")
	if err := os.MkdirAll(defaultDir, 0755); err != nil {
		return err
	}

	htmlPath := filepath.Join(defaultDir, "index.html")
	if _, err := os.Stat(htmlPath); os.IsNotExist(err) {
		if err := os.WriteFile(htmlPath, []byte(defaultMusicHTML), 0644); err != nil {
			return err
		}
	}

	cssPath := filepath.Join(defaultDir, "style.css")
	if _, err := os.Stat(cssPath); os.IsNotExist(err) {
		if err := os.WriteFile(cssPath, []byte(defaultMusicCSS), 0644); err != nil {
			return err
		}
	}

	return nil
}

const defaultMusicHTML = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Now Playing Widget</title>
  <link rel="stylesheet" href="/widget/music/assets/style.css">
</head>
<body>
  <div id="widget-container" class="hidden style-glass accent-emerald">
    <!-- Aurora background blur glow -->
    <div class="aurora-glow-layer" id="aurora-layer"></div>

    <div class="music-card" id="card">
      <!-- Windows 98 Titlebar (retro98 style) -->
      <div class="win98-titlebar" id="win98-bar">
        <div class="win98-title-text">
          <span class="win98-icon">🎵</span>
          <span>Now Playing</span>
        </div>
        <div class="win98-buttons">
          <span class="win98-btn">_</span>
          <span class="win98-btn">□</span>
          <span class="win98-btn win98-close">✕</span>
        </div>
      </div>

      <div class="card-inner-body">
        <!-- Vinyl Disc (vinyl style) -->
        <div class="vinyl-disc" id="vinyl">
          <div class="vinyl-groove"></div>
          <div class="vinyl-center"></div>
        </div>

        <!-- CD Jewel Disc (cd style) -->
        <div class="cd-disc" id="cd">
          <div class="cd-surface"></div>
          <div class="cd-center"></div>
        </div>

        <!-- Album Cover -->
        <div class="cover-wrapper" id="cover-box">
          <img id="cover" src="" alt="Cover" class="cover-img" />
          <div id="cover-fallback" class="cover-fallback">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18V5l12-2v13"></path>
              <circle cx="6" cy="18" r="3"></circle>
              <circle cx="18" cy="16" r="3"></circle>
            </svg>
          </div>
        </div>

        <!-- Cassette Spools (cassette style) -->
        <div class="cassette-center" id="cassette-spools">
          <div class="spool spool-left"></div>
          <div class="cassette-window"></div>
          <div class="spool spool-right"></div>
        </div>

        <!-- Track Info -->
        <div class="track-info">
          <div class="track-title-wrapper" id="title-wrapper">
            <div id="title" class="track-title">Ожидание трека...</div>
          </div>
          <div id="artist" class="track-artist">Неизвестный исполнитель</div>

          <!-- Progress bar for Spotify & Retro98 styles -->
          <div class="track-progress-row" id="progress-bar-row">
            <span class="prog-time" id="prog-cur">1:24</span>
            <div class="prog-track">
              <div class="prog-fill" id="prog-fill"></div>
            </div>
            <span class="prog-time" id="prog-total">3:42</span>
          </div>
        </div>

        <!-- Audio Visualizer Bars -->
        <div class="visualizer" id="vis">
          <span class="bar bar-1"></span>
          <span class="bar bar-2"></span>
          <span class="bar bar-3"></span>
          <span class="bar bar-4"></span>
        </div>
      </div>
    </div>
  </div>

  <script>
    const container = document.getElementById('widget-container');
    const card = document.getElementById('card');
    const titleEl = document.getElementById('title');
    const artistEl = document.getElementById('artist');
    const coverEl = document.getElementById('cover');
    const fallbackEl = document.getElementById('cover-fallback');
    const coverBox = document.getElementById('cover-box');
    const visEl = document.getElementById('vis');

    let currentTrackKey = '';
    let hideTimeout = null;
    let lastTrackData = null;

    // Config defaults
    let config = {
      style: 'glass',
      accentColor: 'emerald',
      showCover: true,
      showVisualizer: true,
      showArtist: true,
      hideOnPause: true,
      pauseDelay: 3,
      scale: 100,
      bgOpacity: 85
    };

    // Override from URL params if specified (for scene presets)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('style')) config.style = urlParams.get('style');
    if (urlParams.has('accent')) config.accentColor = urlParams.get('accent');
    if (urlParams.has('scale')) config.scale = Number(urlParams.get('scale'));
    if (urlParams.has('opacity')) config.bgOpacity = Number(urlParams.get('opacity'));

    const ACCENT_COLORS = {
      emerald: { hex: '#10B981', glow: 'rgba(16, 185, 129, 0.45)' },
      blue:    { hex: '#3B82F6', glow: 'rgba(59, 130, 246, 0.45)' },
      purple:  { hex: '#9146FF', glow: 'rgba(145, 70, 255, 0.45)' },
      pink:    { hex: '#EC4899', glow: 'rgba(236, 72, 153, 0.45)' },
      amber:   { hex: '#F59E0B', glow: 'rgba(245, 158, 11, 0.45)' },
      white:   { hex: '#F3F4F6', glow: 'rgba(243, 244, 246, 0.45)' }
    };

    function applyConfig(newCfg) {
      if (!newCfg) return;
      config = { ...config, ...newCfg };

      // Keep URL overrides if requested
      if (urlParams.has('style')) config.style = urlParams.get('style');
      if (urlParams.has('accent')) config.accentColor = urlParams.get('accent');

      // Apply style class
      container.className = container.className
        .replace(/style-\w+/g, '')
        .replace(/accent-\w+/g, '')
        .trim();
      
      container.classList.add('style-' + (config.style || 'glass'));
      container.classList.add('accent-' + (config.accentColor || 'emerald'));

      // Apply CSS variables
      const col = ACCENT_COLORS[config.accentColor] || ACCENT_COLORS.emerald;
      document.documentElement.style.setProperty('--accent-color', col.hex);
      document.documentElement.style.setProperty('--accent-glow', col.glow);
      document.documentElement.style.setProperty('--card-scale', (config.scale || 100) / 100);
      document.documentElement.style.setProperty('--bg-opacity', (config.bgOpacity !== undefined ? config.bgOpacity : 85) / 100);

      // Elements visibility
      coverBox.style.display = config.showCover ? 'block' : 'none';
      visEl.style.display = config.showVisualizer ? 'flex' : 'none';
      artistEl.style.display = config.showArtist ? 'block' : 'none';

      // Re-evaluate current track state
      if (lastTrackData) {
        updateTrack(lastTrackData);
      }
    }

    function updateTrack(data) {
      if (!data) return;
      lastTrackData = data;

      const isPlaying = data.status === 'playing';
      const hasTitle = data.title && data.title.trim().length > 0;

      if (!hasTitle || (!isPlaying && data.status !== 'paused')) {
        hideWidget();
        return;
      }

      const trackKey = (data.title || '') + '|' + (data.artist || '');
      const isNewTrack = trackKey !== currentTrackKey;
      currentTrackKey = trackKey;

      titleEl.textContent = data.title || 'Без названия';
      artistEl.textContent = data.artist || (data.album || 'Неизвестный исполнитель');

      adjustMarquee();

      if (data.thumbnail && data.thumbnail.length > 50) {
        coverEl.src = data.thumbnail;
        coverEl.style.display = 'block';
        fallbackEl.style.display = 'none';
      } else {
        coverEl.style.display = 'none';
        fallbackEl.style.display = 'flex';
      }

      if (isPlaying) {
        if (hideTimeout) {
          clearTimeout(hideTimeout);
          hideTimeout = null;
        }
        showWidget(isNewTrack);
        container.classList.remove('paused');
      } else {
        // Paused state
        container.classList.add('paused');
        if (config.hideOnPause) {
          if (!hideTimeout) {
            const delayMs = Math.max(config.pauseDelay || 3, 0) * 1000;
            hideTimeout = setTimeout(() => {
              hideWidget();
            }, delayMs);
          }
        }
      }
    }

    function showWidget(animate) {
      container.classList.remove('hidden');
      if (animate) {
        container.classList.remove('animate-in');
        void container.offsetWidth;
        container.classList.add('animate-in');
      }
    }

    function hideWidget() {
      container.classList.add('hidden');
    }

    function adjustMarquee() {
      titleEl.classList.remove('marquee');
      const wrapper = titleEl.parentElement;
      if (titleEl.scrollWidth > wrapper.clientWidth + 6) {
        titleEl.classList.add('marquee');
      }
    }

    // Connect SSE
    function connectSSE() {
      const evtSource = new EventSource('/widget/music/events');

      evtSource.addEventListener('track', (e) => {
        try {
          const data = JSON.parse(e.data);
          updateTrack(data);
        } catch (err) {
          console.error('Failed to parse track SSE:', err);
        }
      });

      evtSource.addEventListener('config', (e) => {
        try {
          const cfg = JSON.parse(e.data);
          applyConfig(cfg);
        } catch (err) {
          console.error('Failed to parse config SSE:', err);
        }
      });

      evtSource.addEventListener('reload', () => {
        window.location.reload();
      });

      evtSource.onerror = () => {
        setTimeout(connectSSE, 3000);
        evtSource.close();
      };
    }

    connectSSE();
  </script>
</body>
</html>
`

const defaultMusicCSS = `/* ============================================
   ReChat Music Widget Styles (Inspired by 6K Labs Amuse)
   ============================================ */

:root {
  --accent-color: #10B981;
  --accent-glow: rgba(16, 185, 129, 0.45);
  --card-scale: 1;
  --bg-opacity: 0.85;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background: transparent !important;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  min-height: 100vh;
  padding: 16px;
}

#widget-container {
  position: relative;
  transform: scale(var(--card-scale));
  transform-origin: top left;
  transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  opacity: 1;
}

#widget-container.hidden {
  opacity: 0;
  pointer-events: none;
  transform: scale(var(--card-scale)) translateY(12px);
}

#widget-container.animate-in {
  animation: slidePop 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes slidePop {
  0% {
    opacity: 0;
    transform: scale(var(--card-scale)) translateY(20px);
  }
  100% {
    opacity: 1;
    transform: scale(var(--card-scale)) translateY(0);
  }
}

/* Base Card */
.music-card {
  position: relative;
  border-radius: 20px;
  max-width: 440px;
  min-width: 280px;
  transition: all 0.3s ease;
  z-index: 2;
}

.card-inner-body {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
}

/* ================= 10 PRESET STYLES ================= */

/* 1. Glassmorphism */
.style-glass .music-card {
  background: rgba(18, 20, 29, var(--bg-opacity));
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 16px 36px -6px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
  padding: 10px 18px 10px 12px;
}

/* 2. Compact Pill */
.style-compact .music-card {
  background: rgba(14, 15, 22, var(--bg-opacity));
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  padding: 6px 16px 6px 8px;
  border-radius: 9999px;
}
.style-compact .card-inner-body {
  gap: 10px;
}
.style-compact .cover-wrapper {
  width: 38px;
  height: 38px;
  border-radius: 9999px;
}
.style-compact .track-title { font-size: 13px; }
.style-compact .track-artist { font-size: 11px; }

/* 3. Vinyl Record */
.style-vinyl .music-card {
  background: rgba(18, 20, 29, var(--bg-opacity));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.5);
  padding: 10px 20px 10px 12px;
  border-radius: 18px;
  overflow: visible;
}
.style-vinyl .vinyl-disc {
  display: block;
  position: absolute;
  left: 28px;
  top: 50%;
  transform: translateY(-50%);
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: repeating-radial-gradient(#111, #111 2px, #222 3px, #111 4px);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.6);
  z-index: 1;
  animation: spinVinyl 5s linear infinite;
  transition: transform 0.4s ease;
}
.style-vinyl.paused .vinyl-disc { animation-play-state: paused; }
.style-vinyl .vinyl-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent-color);
  box-shadow: 0 0 6px rgba(0,0,0,0.5);
}
.style-vinyl .cover-wrapper { z-index: 2; }

/* 4. Neon Cyberpunk */
.style-neon .music-card {
  background: rgba(10, 11, 16, var(--bg-opacity));
  border: 1.5px solid var(--accent-color);
  box-shadow: 0 0 20px var(--accent-glow), inset 0 0 12px var(--accent-glow);
  padding: 10px 18px 10px 12px;
  border-radius: 16px;
}
.style-neon .track-title { text-shadow: 0 0 10px var(--accent-glow); }

/* 5. Minimal */
.style-minimal .music-card {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 4px 8px;
  backdrop-filter: none;
}
.style-minimal .track-title { text-shadow: 0 2px 8px rgba(0,0,0,0.9); }
.style-minimal .track-artist { text-shadow: 0 2px 6px rgba(0,0,0,0.9); }

/* 6. Retro Windows 98 (Inspired by 6K Labs Amuse Windows 98) */
.style-retro98 .music-card {
  background: #c0c0c0;
  border-top: 2px solid #ffffff;
  border-left: 2px solid #ffffff;
  border-right: 2px solid #000000;
  border-bottom: 2px solid #000000;
  box-shadow: 3px 3px 0px rgba(0,0,0,0.4);
  border-radius: 0;
  padding: 3px;
  font-family: 'Segoe UI', Tahoma, sans-serif;
  min-width: 320px;
}
.style-retro98 .win98-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(90deg, #000080, #1084d0);
  color: #ffffff;
  padding: 2px 6px;
  font-size: 11px;
  font-weight: bold;
  margin-bottom: 5px;
}
.style-retro98 .win98-buttons {
  display: flex;
  gap: 2px;
}
.style-retro98 .win98-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #c0c0c0;
  border-top: 1px solid #ffffff;
  border-left: 1px solid #ffffff;
  border-right: 1px solid #000000;
  border-bottom: 1px solid #000000;
  width: 14px;
  height: 14px;
  font-size: 9px;
  color: #000000;
  cursor: default;
  font-weight: bold;
}
.style-retro98 .card-inner-body {
  padding: 4px;
  background: #d4d0c8;
  border-top: 1px solid #808080;
  border-left: 1px solid #808080;
  border-right: 1px solid #ffffff;
  border-bottom: 1px solid #ffffff;
}
.style-retro98 .cover-wrapper {
  border-radius: 0;
  border-top: 1px solid #808080;
  border-left: 1px solid #808080;
  border-right: 1px solid #ffffff;
  border-bottom: 1px solid #ffffff;
  width: 44px;
  height: 44px;
}
.style-retro98 .track-title { color: #000000; font-size: 12.5px; font-weight: bold; }
.style-retro98 .track-artist { color: #444444; font-size: 11px; }
.style-retro98 .track-progress-row { display: flex; }

/* 7. Aurora Glow (Inspired by Amuse liquid aura) */
.style-aurora .music-card {
  background: rgba(14, 16, 26, var(--bg-opacity));
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 22px;
  padding: 12px 20px 12px 14px;
  position: relative;
  box-shadow: 0 16px 36px rgba(0,0,0,0.6);
}
.style-aurora .aurora-glow-layer {
  display: block;
  position: absolute;
  inset: -15px;
  background: radial-gradient(circle at 20% 50%, var(--accent-glow) 0%, transparent 60%),
              radial-gradient(circle at 80% 50%, rgba(145, 70, 255, 0.4) 0%, transparent 65%),
              radial-gradient(circle at 50% 80%, rgba(236, 72, 153, 0.3) 0%, transparent 60%);
  border-radius: 36px;
  filter: blur(20px);
  z-index: 1;
  opacity: 0.9;
  animation: auroraFlow 6s ease-in-out infinite alternate;
}
@keyframes auroraFlow {
  0% { transform: scale(0.96) rotate(-2deg); opacity: 0.75; }
  100% { transform: scale(1.05) rotate(2deg); opacity: 1; }
}

/* 8. Retro Cassette Tape */
.style-cassette .music-card {
  background: #181920;
  border: 2px solid #333644;
  border-radius: 14px;
  padding: 10px 16px;
  box-shadow: inset 0 2px 6px rgba(255,255,255,0.08), 0 12px 28px rgba(0,0,0,0.6);
}
.style-cassette .cassette-center {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #0f1014;
  padding: 4px 8px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.06);
}
.style-cassette .spool {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px dashed var(--accent-color);
  animation: spinVinyl 3s linear infinite;
}
.style-cassette .cassette-window {
  width: 24px;
  height: 12px;
  background: #252836;
  border-radius: 2px;
}

/* 9. CD Jewel Case */
.style-cd .music-card {
  background: rgba(20, 22, 32, var(--bg-opacity));
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  padding: 10px 18px 10px 12px;
  box-shadow: 0 14px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.25);
  overflow: visible;
}
.style-cd .cover-wrapper {
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.6);
  border: 1px solid rgba(255,255,255,0.2);
  z-index: 2;
}
.style-cd .cd-disc {
  display: block;
  position: absolute;
  left: 28px;
  top: 50%;
  transform: translateY(-50%);
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: radial-gradient(circle, #222 18%, #bbb 20%, #ddd 35%, #999 50%, #eee 65%, #222 80%);
  box-shadow: 0 4px 14px rgba(0,0,0,0.6);
  z-index: 1;
  animation: spinVinyl 4s linear infinite;
}
.style-cd .cd-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #000;
  border: 1px solid #fff;
}

/* 10. Spotify Card */
.style-spotify .music-card {
  background: #121212;
  border: 1px solid #282828;
  border-radius: 16px;
  padding: 12px 18px 12px 12px;
  box-shadow: 0 18px 40px rgba(0,0,0,0.7);
}
.style-spotify .cover-wrapper {
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.6);
}
.style-spotify .track-title { color: #ffffff; font-weight: 700; }
.style-spotify .track-artist { color: #b3b3b3; }
.style-spotify .track-progress-row { display: flex; }

/* Progress bar (spotify / retro98) */
.track-progress-row {
  display: none;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}
.prog-time {
  font-size: 9px;
  color: #888;
  font-family: monospace;
}
.prog-track {
  flex: 1;
  height: 3px;
  background: rgba(255,255,255,0.15);
  border-radius: 2px;
  overflow: hidden;
}
.prog-fill {
  width: 45%;
  height: 100%;
  background: var(--accent-color);
  border-radius: 2px;
  animation: progAnim 180s linear infinite;
}
@keyframes progAnim {
  from { width: 0%; }
  to { width: 100%; }
}

/* Hide conditional elements by default */
.win98-titlebar, .vinyl-disc, .cd-disc, .cassette-center, .aurora-glow-layer {
  display: none;
}

@keyframes spinVinyl {
  from { transform: translateY(-50%) rotate(0deg); }
  to { transform: translateY(-50%) rotate(360deg); }
}

/* ================= SHARED ELEMENTS ================= */

.cover-wrapper {
  position: relative;
  width: 52px;
  height: 52px;
  border-radius: 12px;
  overflow: hidden;
  background: #1a1d29;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
  flex-shrink: 0;
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-color);
  opacity: 0.7;
}

.track-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  flex: 1;
  z-index: 3;
}

.track-title-wrapper {
  overflow: hidden;
  white-space: nowrap;
  position: relative;
  width: 100%;
}

.track-title {
  font-size: 14px;
  font-weight: 700;
  color: #f1f3f9;
  letter-spacing: -0.01em;
  display: inline-block;
}

.track-title.marquee {
  animation: marquee 8s linear infinite alternate;
}

@keyframes marquee {
  0% { transform: translateX(0); }
  20% { transform: translateX(0); }
  80% { transform: translateX(calc(-100% + 220px)); }
  100% { transform: translateX(calc(-100% + 220px)); }
}

.track-artist {
  font-size: 12px;
  font-weight: 500;
  color: #8c93a8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

/* Visualizer Bars */
.visualizer {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 18px;
  padding-left: 4px;
  flex-shrink: 0;
  z-index: 3;
}

.bar {
  width: 3.5px;
  border-radius: 9999px;
  background-color: var(--accent-color);
  box-shadow: 0 0 6px var(--accent-glow);
  animation: bounce 1.2s ease-in-out infinite alternate;
}

.bar-1 { height: 60%; animation-delay: 0.1s; }
.bar-2 { height: 100%; animation-delay: 0.3s; }
.bar-3 { height: 40%; animation-delay: 0.2s; }
.bar-4 { height: 80%; animation-delay: 0.4s; }

#widget-container.paused .bar {
  animation-play-state: paused;
  height: 25% !important;
  opacity: 0.4;
}

@keyframes bounce {
  0% { height: 20%; }
  50% { height: 100%; }
  100% { height: 40%; }
}
`
