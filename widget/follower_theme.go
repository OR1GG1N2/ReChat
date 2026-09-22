package widget

import (
	"os"
	"path/filepath"
)

// FollowerThemesDir returns the follower themes directory inside themes.
func FollowerThemesDir(rootThemesDir string) string {
	return filepath.Join(rootThemesDir, "follower")
}

// EnsureDefaultFollowerTheme ensures the default follower theme files exist in themes/follower/default.
func EnsureDefaultFollowerTheme(themesDir string) error {
	defaultDir := filepath.Join(themesDir, "follower", "default")
	if err := os.MkdirAll(defaultDir, 0755); err != nil {
		return err
	}

	htmlPath := filepath.Join(defaultDir, "index.html")
	if _, err := os.Stat(htmlPath); os.IsNotExist(err) {
		if err := os.WriteFile(htmlPath, []byte(defaultFollowerHTML), 0644); err != nil {
			return err
		}
	}

	cssPath := filepath.Join(defaultDir, "style.css")
	if _, err := os.Stat(cssPath); os.IsNotExist(err) {
		if err := os.WriteFile(cssPath, []byte(defaultFollowerCSS), 0644); err != nil {
			return err
		}
	}

	return nil
}

const defaultFollowerHTML = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Follower Notification Widget</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/widget/follower/assets/default/style.css">
</head>
<body>
  <!-- Container where notifications pop up -->
  <div id="notification-root" class="notification-root"></div>

  <script>
    const params = new URLSearchParams(window.location.search);
    const configuredStyle = (params.get('style') || 'ios').toLowerCase(); // 'ios', 'android', 'island'
    const displayDuration = Math.max(2, parseInt(params.get('duration') || '6', 10)) * 1000;
    const soundEnabled = params.get('sound') !== '0' && params.get('sound') !== 'false';
    const position = (params.get('position') || 'top').toLowerCase(); // 'top', 'bottom'

    const rootEl = document.getElementById('notification-root');
    if (position === 'bottom') {
      rootEl.classList.add('pos-bottom');
    }

    // Queue for sequential notification playback
    const queue = [];
    let isShowing = false;

    // Web Audio API Soft Chime Synthesis (zero external audio dependencies)
    let audioCtx = null;
    function playChime(style) {
      if (!soundEnabled) return;
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        if (!audioCtx) audioCtx = new AudioContext();
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const now = audioCtx.currentTime;

        if (style === 'android') {
          // Android soft Material Pop (Two-tone bubble)
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now);
          osc.stop(now + 0.3);
        } else {
          // iOS Tri-Tone style pleasant harmonic chime (C6 -> E6 harmonic)
          const playTone = (freq, start, duration, vol) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, start);
            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.linearRampToValueAtTime(vol, start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(start);
            osc.stop(start + duration);
          };
          playTone(659.25, now, 0.22, 0.25); // E5
          playTone(880.00, now + 0.09, 0.32, 0.28); // A5
          playTone(1046.50, now + 0.18, 0.45, 0.22); // C6
        }
      } catch (e) {
        console.warn('Audio chime playback error:', e);
      }
    }

    // Connect to ReChat Server-Sent Events stream without replaying chat backlog
    function connectSSE() {
      const es = new EventSource('/widget/events?replay=false');

      es.addEventListener('reload', () => location.reload());

      es.addEventListener('message', (e) => {
        try {
          const data = JSON.parse(e.data);
          // Check if message is a follower event
          const isFollow = data.type === 'follow' || 
                           (data.isEvent && (data.eventType === 'follow' || data.eventType === 'channel.follow'));
          if (isFollow) {
            queue.push({
              author: data.author || data.displayName || data.user || 'Зритель',
              avatarUrl: data.avatarUrl || '',
              channel: data.channel || '',
              timeText: 'сейчас',
            });
            processQueue();
          }
        } catch (err) {
          console.error('Failed to parse SSE payload:', err);
        }
      });

      es.onerror = () => {
        es.close();
        setTimeout(connectSSE, 3000);
      };
    }

    connectSSE();

    function processQueue() {
      if (isShowing || queue.length === 0) return;
      isShowing = true;
      const item = queue.shift();
      showNotification(item);
    }

    function showNotification(item) {
      const activeStyle = configuredStyle === 'android' ? 'android' : 
                          configuredStyle === 'island' ? 'island' : 'ios';

      const notifEl = document.createElement('div');
      notifEl.className = 'notif-card style-' + activeStyle;

      playChime(activeStyle);

      if (activeStyle === 'island') {
        // Dynamic Island markup
        notifEl.innerHTML = 
          '<div class="island-pill">' +
            '<div class="island-left">' +
              '<div class="avatar-box">' +
                renderAvatarHtml(item.author, item.avatarUrl, 'island-avatar') +
              '</div>' +
            '</div>' +
            '<div class="island-center">' +
              '<div class="island-title">Новый фолловер</div>' +
              '<div class="island-name">@' + escHtml(item.author) + '</div>' +
            '</div>' +
            '<div class="island-right">' +
              '<div class="island-heart">' +
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="#34D399">' +
                  '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>' +
                '</svg>' +
              '</div>' +
            '</div>' +
          '</div>';
      } else if (activeStyle === 'android') {
        // Android Material You / OneUI markup
        notifEl.innerHTML = 
          '<div class="android-box">' +
            '<div class="android-header">' +
              '<div class="app-icon-wrap android-app-badge">' +
                '<svg class="twitch-glyph" width="13" height="13" viewBox="0 0 24 24" fill="white">' +
                  '<path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>' +
                '</svg>' +
              '</div>' +
              '<span class="android-app-title">Twitch</span>' +
              '<span class="android-dot">•</span>' +
              '<span class="android-time">' + escHtml(item.timeText) + '</span>' +
            '</div>' +
            '<div class="android-body">' +
              '<div class="android-avatar-container">' +
                renderAvatarHtml(item.author, item.avatarUrl, 'android-avatar') +
                '<div class="android-heart-badge">' +
                  '<svg width="10" height="10" viewBox="0 0 24 24" fill="white">' +
                    '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>' +
                  '</svg>' +
                '</div>' +
              '</div>' +
              '<div class="android-text-wrap">' +
                '<div class="android-title">Новый фолловер</div>' +
                '<div class="android-msg"><span class="highlight">@' + escHtml(item.author) + '</span> подписался на канал</div>' +
              '</div>' +
            '</div>' +
            '<div class="android-actions">' +
              '<span class="android-chip">Приветствовать 👋</span>' +
            '</div>' +
          '</div>';
      } else {
        // iOS 17+ Banner Notification markup
        notifEl.innerHTML = 
          '<div class="ios-glass-card">' +
            '<div class="ios-header">' +
              '<div class="ios-app-brand">' +
                '<div class="ios-app-icon">' +
                  '<svg class="twitch-glyph" width="13" height="13" viewBox="0 0 24 24" fill="white">' +
                    '<path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>' +
                  '</svg>' +
                '</div>' +
                '<span class="ios-app-name">TWITCH</span>' +
              '</div>' +
              '<span class="ios-time">' + escHtml(item.timeText) + '</span>' +
            '</div>' +
            '<div class="ios-body">' +
              '<div class="ios-avatar-wrapper">' +
                renderAvatarHtml(item.author, item.avatarUrl, 'ios-avatar') +
              '</div>' +
              '<div class="ios-content-text">' +
                '<div class="ios-card-title">Новый фолловер</div>' +
                '<div class="ios-card-subtitle"><span class="ios-bold">@' + escHtml(item.author) + '</span> теперь отслеживает канал!</div>' +
              '</div>' +
            '</div>' +
          '</div>';
      }

      rootEl.appendChild(notifEl);

      // Trigger transition with requestAnimationFrame for smooth spring physics
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          notifEl.classList.add('is-active');
        });
      });

      // Auto dismiss after duration
      setTimeout(() => {
        notifEl.classList.remove('is-active');
        notifEl.classList.add('is-dismissing');

        setTimeout(() => {
          if (notifEl.parentNode) notifEl.remove();
          isShowing = false;
          // Process next notification in queue
          setTimeout(processQueue, 250);
        }, 500);
      }, displayDuration);
    }

    function renderAvatarHtml(author, avatarUrl, className) {
      const bg = avatarColor(author);
      const initialLetter = (author || '?').charAt(0).toUpperCase();
      if (avatarUrl) {
        return '<div class="' + className + '" style="background:' + bg + '">' +
          '<img src="' + escHtml(avatarUrl) + '" alt="" loading="lazy" onerror="this.remove()" />' +
          '<span>' + escHtml(initialLetter) + '</span>' +
        '</div>';
      }
      return '<div class="' + className + '" style="background:' + bg + '">' +
        '<span>' + escHtml(initialLetter) + '</span>' +
      '</div>';
    }

    function escHtml(s) {
      return (s || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function avatarColor(name) {
      const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#3b82f6', '#10b981'];
      let h = 0;
      for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
      return colors[Math.abs(h) % colors.length];
    }
  </script>
</body>
</html>
`

const defaultFollowerCSS = `/* ==========================================================================
   ReChat Follower Alert Widget — iOS / Android Native Styles
   ========================================================================== */

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background: transparent;
  overflow: hidden;
  width: 100vw;
  height: 100vh;
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Inter, sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* Container */
.notification-root {
  position: absolute;
  top: 24px;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
  z-index: 9999;
}

.notification-root.pos-bottom {
  top: auto;
  bottom: 24px;
}

/* Base Notification Card Wrapper */
.notif-card {
  width: 390px;
  max-width: 92vw;
  opacity: 0;
  transform: translateY(-50px) scale(0.92);
  transition: transform 0.5s cubic-bezier(0.19, 1, 0.22, 1), opacity 0.4s ease;
  pointer-events: auto;
  user-select: none;
}

.notif-card.is-active {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.notif-card.is-dismissing {
  opacity: 0;
  transform: translateY(-40px) scale(0.95);
  transition: transform 0.45s cubic-bezier(0.4, 0, 1, 1), opacity 0.35s ease;
}

.pos-bottom .notif-card {
  transform: translateY(50px) scale(0.92);
}
.pos-bottom .notif-card.is-active {
  transform: translateY(0) scale(1);
}
.pos-bottom .notif-card.is-dismissing {
  transform: translateY(40px) scale(0.95);
}

/* ==========================================================================
   1. iOS NOTIFICATION STYLE
   ========================================================================== */
.ios-glass-card {
  background: rgba(30, 30, 34, 0.82);
  backdrop-filter: blur(28px) saturate(190%);
  -webkit-backdrop-filter: blur(28px) saturate(190%);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 22px;
  padding: 13px 15px;
  box-shadow: 
    0 16px 40px rgba(0, 0, 0, 0.45),
    0 2px 10px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  color: #FFFFFF;
}

.ios-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.ios-app-brand {
  display: flex;
  align-items: center;
  gap: 7px;
}

.ios-app-icon {
  width: 20px;
  height: 20px;
  background: linear-gradient(135deg, #9146FF 0%, #772ce8 100%);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 5px rgba(145, 70, 255, 0.4);
}

.ios-app-name {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.65);
  text-transform: uppercase;
}

.ios-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
}

.ios-body {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ios-avatar-wrapper {
  flex-shrink: 0;
}

.ios-avatar {
  width: 44px;
  height: 44px;
  border-radius: 13px;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  font-weight: 700;
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.ios-avatar img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ios-content-text {
  flex: 1;
  min-width: 0;
}

.ios-card-title {
  font-size: 14.5px;
  font-weight: 700;
  color: #FFFFFF;
  margin-bottom: 2px;
  letter-spacing: -0.01em;
}

.ios-card-subtitle {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.35;
  word-break: break-word;
}

.ios-bold {
  font-weight: 600;
  color: #34D399;
}

/* ==========================================================================
   2. ANDROID MATERIAL YOU STYLE
   ========================================================================== */
.android-box {
  background: rgba(24, 26, 32, 0.94);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 26px;
  padding: 14px 16px;
  box-shadow: 
    0 12px 32px rgba(0, 0, 0, 0.5),
    0 2px 6px rgba(0, 0, 0, 0.35);
  font-family: "Roboto", "Google Sans", "Segoe UI", sans-serif;
  color: #E6E1E5;
}

.android-header {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 10px;
}

.android-app-badge {
  width: 18px;
  height: 18px;
  background: #9146FF;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.android-app-title {
  font-size: 12px;
  font-weight: 500;
  color: #CAC4D0;
}

.android-dot {
  font-size: 10px;
  color: #938F99;
}

.android-time {
  font-size: 11.5px;
  color: #938F99;
}

.android-body {
  display: flex;
  align-items: center;
  gap: 14px;
}

.android-avatar-container {
  position: relative;
  flex-shrink: 0;
}

.android-avatar {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  color: white;
  border: 1.5px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.android-avatar img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.android-heart-badge {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 18px;
  height: 18px;
  background: #10B981;
  border: 2px solid #181A20;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.android-text-wrap {
  flex: 1;
  min-width: 0;
}

.android-title {
  font-size: 15px;
  font-weight: 600;
  color: #E6E1E5;
  margin-bottom: 2px;
}

.android-msg {
  font-size: 13.5px;
  color: #CAC4D0;
  line-height: 1.35;
}

.android-msg .highlight {
  color: #A7F3D0;
  font-weight: 600;
}

.android-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  padding-left: 60px;
}

.android-chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 11px;
  color: #D0BCFF;
  font-weight: 500;
}

/* ==========================================================================
   3. DYNAMIC ISLAND STYLE
   ========================================================================== */
.style-island {
  width: auto;
  min-width: 320px;
  max-width: 480px;
}

.island-pill {
  background: #000000;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 40px;
  padding: 9px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  box-shadow: 
    0 16px 45px rgba(0, 0, 0, 0.75),
    0 0 0 1px rgba(0, 0, 0, 0.9);
  color: #FFFFFF;
}

.island-left {
  flex-shrink: 0;
}

.island-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  color: white;
  border: 1.5px solid #10B981;
}

.island-avatar img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.island-center {
  flex: 1;
  text-align: left;
}

.island-title {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.island-name {
  font-size: 14.5px;
  font-weight: 700;
  color: #34D399;
}

.island-right {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  animation: heartPulse 1.2s infinite ease-in-out;
}

@keyframes heartPulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}
`
