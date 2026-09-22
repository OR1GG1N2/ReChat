package widget

import (
	"os"
	"path/filepath"
)

// EnsureDefaultDonationTheme creates the default donation alert theme directory.
func EnsureDefaultDonationTheme(themesDir string) error {
	defaultDir := filepath.Join(themesDir, "donation", "default")
	if err := os.MkdirAll(defaultDir, 0755); err != nil {
		return err
	}

	htmlPath := filepath.Join(defaultDir, "index.html")
	if _, err := os.Stat(htmlPath); os.IsNotExist(err) {
		if err := os.WriteFile(htmlPath, []byte(defaultDonationHTML), 0644); err != nil {
			return err
		}
	}

	cssPath := filepath.Join(defaultDir, "style.css")
	if _, err := os.Stat(cssPath); os.IsNotExist(err) {
		if err := os.WriteFile(cssPath, []byte(defaultDonationCSS), 0644); err != nil {
			return err
		}
	}

	return nil
}

const defaultDonationHTML = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Donation Alert Widget</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/widget/donation/assets/default/style.css">
</head>
<body>
  <div id="notification-root" class="notification-root"></div>

  <script>
    const params = new URLSearchParams(window.location.search);
    const configuredStyle = (params.get('style') || 'ios').toLowerCase(); // 'ios', 'android', 'island'
    const displayDuration = Math.max(2, parseInt(params.get('duration') || '7', 10)) * 1000;
    const soundEnabled = params.get('sound') !== '0' && params.get('sound') !== 'false';
    const position = (params.get('position') || 'top').toLowerCase();

    const rootEl = document.getElementById('notification-root');
    if (position === 'bottom') {
      rootEl.classList.add('pos-bottom');
    }

    const queue = [];
    let isShowing = false;
    let audioCtx = null;

    function playCoinChime() {
      if (!soundEnabled) return;
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!audioCtx) audioCtx = new AudioContext();
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const now = audioCtx.currentTime;
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc1.type = 'sine';
        osc2.type = 'triangle';

        osc1.frequency.setValueAtTime(987.77, now); // B5
        osc1.frequency.exponentialRampToValueAtTime(1318.51, now + 0.08); // E6

        osc2.frequency.setValueAtTime(1975.53, now); // B6
        osc2.frequency.exponentialRampToValueAtTime(2637.02, now + 0.1); // E7

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.28, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(audioCtx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.45);
        osc2.stop(now + 0.45);
      } catch (e) {
        console.warn('Coin chime error:', e);
      }
    }

    function connectSSE() {
      const es = new EventSource('/widget/events?replay=false');

      es.addEventListener('reload', () => location.reload());

      es.addEventListener('message', (e) => {
        try {
          const data = JSON.parse(e.data);
          const isDonation = data.type === 'donation' || 
                             (data.isEvent && (data.eventType === 'donation' || data.eventType === 'donationalerts'));
          if (isDonation) {
            queue.push({
              author: data.author || data.displayName || data.user || 'Аноним',
              amount: data.amount || 0,
              currency: data.currency || 'RUB',
              message: data.text || data.message || '',
              formattedAmount: formatMoney(data.amount, data.currency),
              timeText: 'сейчас'
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

      playCoinChime();

      if (activeStyle === 'island') {
        notifEl.innerHTML =
          '<div class="island-pill island-donation">' +
            '<div class="island-left">' +
              '<div class="island-coin-icon">' +
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="#F59E0B">' +
                  '<circle cx="12" cy="12" r="10" stroke="#F59E0B" stroke-width="1.5" fill="#F59E0B" fill-opacity="0.2"/>' +
                  '<text x="12" y="16" font-size="12" font-weight="bold" fill="#F59E0B" text-anchor="middle">₽</text>' +
                '</svg>' +
              '</div>' +
            '</div>' +
            '<div class="island-center">' +
              '<div class="island-name">' + escHtml(item.author) + ' <span class="island-amount">' + escHtml(item.formattedAmount) + '</span></div>' +
              (item.message ? '<div class="island-msg">' + escHtml(item.message) + '</div>' : '') +
            '</div>' +
          '</div>';
      } else if (activeStyle === 'android') {
        notifEl.innerHTML =
          '<div class="android-box android-donation">' +
            '<div class="android-header">' +
              '<div class="app-icon-wrap android-coin-badge">' +
                '<svg width="13" height="13" viewBox="0 0 24 24" fill="#F59E0B">' +
                  '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z"/>' +
                '</svg>' +
              '</div>' +
              '<span class="android-app-title">DonationAlerts</span>' +
              '<span class="android-dot">•</span>' +
              '<span class="android-time">' + escHtml(item.timeText) + '</span>' +
            '</div>' +
            '<div class="android-body">' +
              '<div class="android-avatar-container">' +
                '<div class="android-donation-avatar">' + escHtml(item.author.charAt(0).toUpperCase()) + '</div>' +
              '</div>' +
              '<div class="android-text-wrap">' +
                '<div class="android-title-row">' +
                  '<span class="android-author">' + escHtml(item.author) + '</span>' +
                  '<span class="android-chip-amount">' + escHtml(item.formattedAmount) + '</span>' +
                '</div>' +
                (item.message ? '<div class="android-msg">' + escHtml(item.message) + '</div>' : '') +
              '</div>' +
            '</div>' +
          '</div>';
      } else {
        // iOS 17+ Banner
        notifEl.innerHTML =
          '<div class="ios-glass-card ios-donation-card">' +
            '<div class="ios-header">' +
              '<div class="ios-app-brand">' +
                '<div class="ios-coin-icon">' +
                  '<svg width="14" height="14" viewBox="0 0 24 24" fill="#F59E0B">' +
                    '<circle cx="12" cy="12" r="10" stroke="#F59E0B" stroke-width="2" fill="none"/>' +
                    '<text x="12" y="16.5" font-size="13" font-weight="900" fill="#F59E0B" text-anchor="middle">★</text>' +
                  '</svg>' +
                '</div>' +
                '<span class="ios-app-name">ДОНАТ</span>' +
              '</div>' +
              '<div class="ios-amount-pill">' + escHtml(item.formattedAmount) + '</div>' +
            '</div>' +
            '<div class="ios-body">' +
              '<div class="ios-author-wrap">' +
                '<div class="ios-card-title">' + escHtml(item.author) + '</div>' +
                (item.message ? '<div class="ios-card-msg">' + escHtml(item.message) + '</div>' : '') +
              '</div>' +
            '</div>' +
          '</div>';
      }

      rootEl.appendChild(notifEl);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          notifEl.classList.add('is-active');
        });
      });

      setTimeout(() => {
        notifEl.classList.remove('is-active');
        notifEl.classList.add('is-dismissing');
        setTimeout(() => {
          if (notifEl.parentNode) notifEl.remove();
          isShowing = false;
          setTimeout(processQueue, 250);
        }, 500);
      }, displayDuration);
    }

    function formatMoney(amount, currency) {
      const num = Number(amount) || 0;
      const cur = (currency || 'RUB').toUpperCase();
      let symbol = cur;
      if (cur === 'RUB') symbol = '₽';
      else if (cur === 'USD') symbol = '$';
      else if (cur === 'EUR') symbol = '€';

      return num.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' ' + symbol;
    }

    function escHtml(s) {
      return (s || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
  </script>
</body>
</html>
`

const defaultDonationCSS = `/* ==========================================================================
   ReChat Donation Alert Widget Styles
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

/* Base Card Transition */
.notif-card {
  opacity: 0;
  transform: translateY(-24px) scale(0.92);
  transition: all 0.45s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: auto;
  max-width: 440px;
  width: calc(100% - 32px);
  margin-bottom: 12px;
}

.pos-bottom .notif-card {
  transform: translateY(24px) scale(0.92);
}

.notif-card.is-active {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.notif-card.is-dismissing {
  opacity: 0;
  transform: translateY(-20px) scale(0.94);
  transition: all 0.35s ease-in;
}

.pos-bottom .notif-card.is-dismissing {
  transform: translateY(20px) scale(0.94);
}

/* ==========================================================================
   iOS 17+ Banner Style
   ========================================================================== */
.ios-glass-card {
  background: rgba(26, 22, 18, 0.88);
  backdrop-filter: blur(35px) saturate(180%);
  -webkit-backdrop-filter: blur(35px) saturate(180%);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 24px;
  padding: 14px 18px;
  box-shadow: 
    0 18px 40px -8px rgba(0, 0, 0, 0.65),
    0 0 24px rgba(245, 158, 11, 0.15),
    0 0 0 1px rgba(255, 255, 255, 0.08) inset;
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
  gap: 8px;
}

.ios-coin-icon {
  width: 22px;
  height: 22px;
  border-radius: 7px;
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid rgba(245, 158, 11, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}

.ios-app-name {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.8px;
  color: #FBBF24;
}

.ios-amount-pill {
  font-size: 13px;
  font-weight: 800;
  background: linear-gradient(135deg, #F59E0B, #D97706);
  color: #FFFFFF;
  padding: 3px 10px;
  border-radius: 999px;
  box-shadow: 0 2px 10px rgba(245, 158, 11, 0.3);
  font-family: inherit;
  letter-spacing: 0.2px;
}

.ios-body {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.ios-card-title {
  font-size: 15px;
  font-weight: 700;
  color: #FFFFFF;
  line-height: 1.25;
}

.ios-card-msg {
  font-size: 13.5px;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.35;
  margin-top: 4px;
  word-break: break-word;
}

/* ==========================================================================
   Android Material You Style
   ========================================================================== */
.android-box {
  background: #201b16;
  border: 1px solid rgba(245, 158, 11, 0.25);
  border-radius: 26px;
  padding: 14px 16px;
  box-shadow: 0 16px 36px -4px rgba(0, 0, 0, 0.7);
  color: #E6E1E5;
}

.android-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.android-coin-badge {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(245, 158, 11, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.android-app-title {
  font-size: 12px;
  font-weight: 600;
  color: #FBBF24;
}

.android-dot {
  color: #8E92A4;
  font-size: 10px;
}

.android-time {
  font-size: 11px;
  color: #8E92A4;
}

.android-body {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.android-donation-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: linear-gradient(135deg, #F59E0B, #B45309);
  color: #FFFFFF;
  font-weight: 700;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.35);
}

.android-text-wrap {
  flex: 1;
  min-width: 0;
}

.android-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.android-author {
  font-size: 14px;
  font-weight: 700;
  color: #FFFFFF;
}

.android-chip-amount {
  font-size: 11px;
  font-weight: 700;
  background: rgba(245, 158, 11, 0.15);
  color: #FBBF24;
  border: 1px solid rgba(245, 158, 11, 0.35);
  padding: 1px 8px;
  border-radius: 12px;
}

.android-msg {
  font-size: 12.5px;
  color: #D1D5DB;
  margin-top: 4px;
  line-height: 1.35;
  word-break: break-word;
}

/* ==========================================================================
   Dynamic Island Style
   ========================================================================== */
.island-pill.island-donation {
  background: #000000;
  border: 1px solid rgba(245, 158, 11, 0.4);
  border-radius: 9999px;
  padding: 8px 18px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.8), 0 0 20px rgba(245, 158, 11, 0.2);
  color: #FFFFFF;
}

.island-coin-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.island-name {
  font-size: 13.5px;
  font-weight: 700;
  color: #FFFFFF;
}

.island-amount {
  color: #FBBF24;
  margin-left: 4px;
  font-weight: 800;
}

.island-msg {
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 1px;
  max-width: 300px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
`
