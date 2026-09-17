package widget

import (
	"log"
	"os"
	"path/filepath"

	"github.com/fsnotify/fsnotify"
)

// ThemesDir returns the themes directory located next to the running executable.
func ThemesDir() string {
	exe, err := os.Executable()
	if err != nil {
		// Fallback to current working directory
		return "themes"
	}
	return filepath.Join(filepath.Dir(exe), "themes")
}

// EnsureDefaultTheme creates the default chat theme directory in themes/chat/default.
func EnsureDefaultTheme(themesDir string) error {
	chatDefaultDir := filepath.Join(themesDir, "chat", "default")
	if err := os.MkdirAll(chatDefaultDir, 0755); err != nil {
		return err
	}

	// Write index.html in themes/chat/default
	htmlPath := filepath.Join(chatDefaultDir, "index.html")
	if _, err := os.Stat(htmlPath); os.IsNotExist(err) {
		if err := os.WriteFile(htmlPath, []byte(defaultHTML), 0644); err != nil {
			return err
		}
	}

	// Write style.css in themes/chat/default
	cssPath := filepath.Join(chatDefaultDir, "style.css")
	if _, err := os.Stat(cssPath); os.IsNotExist(err) {
		if err := os.WriteFile(cssPath, []byte(defaultCSS), 0644); err != nil {
			return err
		}
	}

	// Also maintain root default for backward compatibility if needed
	rootDefaultDir := filepath.Join(themesDir, "default")
	_ = os.MkdirAll(rootDefaultDir, 0755)
	if _, err := os.Stat(filepath.Join(rootDefaultDir, "index.html")); os.IsNotExist(err) {
		_ = os.WriteFile(filepath.Join(rootDefaultDir, "index.html"), []byte(defaultHTML), 0644)
	}
	if _, err := os.Stat(filepath.Join(rootDefaultDir, "style.css")); os.IsNotExist(err) {
		_ = os.WriteFile(filepath.Join(rootDefaultDir, "style.css"), []byte(defaultCSS), 0644)
	}

	return nil
}

// watchThemes watches the themes directory for file changes and calls onReload.
func watchThemes(themesDir string, onReload func()) {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		log.Printf("[Widget] Watcher error: %v", err)
		return
	}
	defer watcher.Close()

	// Watch the root themes dir
	_ = watcher.Add(themesDir)

	// Also watch all existing theme subdirectories
	entries, _ := os.ReadDir(themesDir)
	for _, e := range entries {
		if e.IsDir() {
			_ = watcher.Add(filepath.Join(themesDir, e.Name()))
		}
	}

	for {
		select {
		case event, ok := <-watcher.Events:
			if !ok {
				return
			}
			if event.Has(fsnotify.Write) || event.Has(fsnotify.Create) || event.Has(fsnotify.Remove) {
				log.Printf("[Widget] Theme file changed: %s — sending reload", event.Name)
				onReload()

				// If a new directory was created, watch it too
				if event.Has(fsnotify.Create) {
					info, err := os.Stat(event.Name)
					if err == nil && info.IsDir() {
						_ = watcher.Add(event.Name)
					}
				}
			}
		case err, ok := <-watcher.Errors:
			if !ok {
				return
			}
			log.Printf("[Widget] Watcher error: %v", err)
		}
	}
}

// ---- Default theme templates ----

const defaultHTML = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ReChat Widget</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="http://localhost:3500/widget/assets/default/style.css">
</head>
<body>
  <div id="chat"></div>
  <script>
    const CHAT = document.getElementById('chat');
    const MAX_MESSAGES = 40;

    const es = new EventSource('http://localhost:3500/widget/events');
    const recentRewards = new Set();

    es.addEventListener('message', e => addMessage(JSON.parse(e.data)));
    es.addEventListener('reload', () => location.reload());
    es.addEventListener('avatar_update', e => {
      try {
        const data = JSON.parse(e.data);
        if (!data.user || !data.avatarUrl) return;
        const target = data.user.toLowerCase();
        document.querySelectorAll('[data-author="' + target + '"]').forEach(row => {
          const avatarContainer = row.querySelector('.msg-avatar, .reward-avatar');
          if (avatarContainer && !avatarContainer.querySelector('img')) {
            const img = document.createElement('img');
            img.src = data.avatarUrl;
            img.alt = '';
            img.loading = 'lazy';
            img.onerror = () => img.remove();
            avatarContainer.innerHTML = '';
            avatarContainer.appendChild(img);
          }
        });
      } catch (err) {}
    });

    function addMessage(msg) {
      if (msg.type === 'reward') {
        const dedupKey = (msg.author || '').toLowerCase() + ':' + (msg.userInput || '');
        if (recentRewards.has(dedupKey)) return;
        recentRewards.add(dedupKey);
        setTimeout(() => recentRewards.delete(dedupKey), 15000);
      }

      const el = document.createElement('div');
      el.setAttribute('data-author', (msg.author || '').toLowerCase());

      if (msg.type === 'reward') {
        el.className = 'row reward-row';
        const costHtml = msg.cost
          ? '<span class="reward-cost">' + formatNum(msg.cost) + '</span>'
          : '';
        const inputHtml = msg.userInput
          ? '<div class="reward-input">"' + escHtml(msg.userInput) + '"</div>'
          : '';
        el.innerHTML =
          '<div class="reward-card">' +
            '<div class="reward-header">' +
              '<div class="reward-crown">' +
                '<svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">' +
                  '<path d="M2 14l2-8 4 4 2-6 2 6 4-4 2 8H2z"/>' +
                '</svg>' +
              '</div>' +
              '<span class="reward-title">' + escHtml(msg.rewardTitle || 'Награда') + '</span>' +
              costHtml +
            '</div>' +
            '<div class="reward-meta">' +
              renderAvatar(msg.author, msg.avatarUrl, 'reward-avatar') +
              '<span class="reward-author">' + escHtml(msg.author) + '</span>' +
              '<span class="reward-verb">использовал награду</span>' +
            '</div>' +
            inputHtml +
          '</div>';
      } else {
        const color = msg.color || '#a9b7d1';
        el.className = 'row message-row';
        el.innerHTML =
          '<div class="msg-card">' +
            renderAvatar(msg.author, msg.avatarUrl, 'msg-avatar') +
            '<div class="msg-body">' +
              '<span class="msg-author" style="color:' + color + '">' + escHtml(msg.author) + '</span>' +
              '<span class="msg-text">' + escHtml(msg.text) + '</span>' +
            '</div>' +
          '</div>';
      }

      CHAT.appendChild(el);
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('visible')));

      while (CHAT.children.length > MAX_MESSAGES) {
        const old = CHAT.firstChild;
        old.classList.add('removing');
        setTimeout(() => { if (old.parentNode) old.remove(); }, 300);
        break;
      }
    }

    function renderAvatar(arg1, arg2, arg3) {
      let author = '';
      let avatarUrl = '';
      let className = 'msg-avatar';
      if (arg3 !== undefined) {
        author = arg1;
        avatarUrl = arg2;
        className = arg3;
      } else {
        avatarUrl = arg1;
        className = arg2 || 'msg-avatar';
      }
      const bg = avatarColor(author);
      if (avatarUrl) {
        return '<div class="' + className + '" style="background:' + bg + '">' +
          '<img src="' + escHtml(avatarUrl) + '" alt="" loading="lazy" onerror="this.remove()" />' +
        '</div>';
      }
      return '<div class="' + className + '" style="background:' + bg + '">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,0.65)"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>' +
      '</div>';
    }

    function escHtml(s) {
      return (s||'')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function initial(name) { return (name||'?').charAt(0).toUpperCase(); }
    function formatNum(n) {
      return n >= 1000 ? (n/1000).toFixed(n%1000===0?0:1)+'K' : String(n);
    }
    function avatarColor(name) {
      const p = ['#6366f1','#8b5cf6','#ec4899','#14b8a6','#f59e0b','#3b82f6','#10b981'];
      let h = 0;
      for (let i = 0; i < (name||'').length; i++) h = (h*31 + name.charCodeAt(i)) & 0xffffffff;
      return p[Math.abs(h) % p.length];
    }
  </script>
</body>
</html>
`

const defaultCSS = `/* ============================================
   ReChat Default Widget Theme  v2
   ============================================ */

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: transparent;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px;
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
}

#chat {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 5px;
  padding: 10px 12px;
  height: 100vh;
  overflow: hidden;
}

/* ---- Animations ---- */
.row {
  opacity: 0;
  transform: translateX(-10px) translateY(6px);
  transition:
    opacity 0.3s cubic-bezier(.16,1,.3,1),
    transform 0.3s cubic-bezier(.16,1,.3,1);
  will-change: opacity, transform;
}

.row.visible {
  opacity: 1;
  transform: translateX(0) translateY(0);
}

.row.removing {
  opacity: 0;
  transform: translateY(-4px);
  transition: opacity 0.25s ease, transform 0.25s ease;
}

/* ================================================
   CHAT MESSAGE
   ================================================ */
.msg-card {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: rgba(16, 17, 24, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.055);
  border-radius: 12px;
  padding: 7px 10px 7px 8px;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 2px 12px rgba(0,0,0,0.25);
  word-break: break-word;
}

.msg-avatar {
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11.5px;
  font-weight: 700;
  color: rgba(255,255,255,0.92);
  margin-top: 1px;
}

.msg-avatar img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
}

.msg-avatar span {
  position: relative;
  z-index: 0;
}

.msg-body {
  flex: 1;
  min-width: 0;
  line-height: 1.45;
}

.msg-author {
  font-weight: 700;
  font-size: 12.5px;
  margin-right: 5px;
  letter-spacing: 0.01em;
}

.msg-text {
  color: #d4d8f0;
  font-size: 13px;
}

/* ================================================
   CHANNEL POINTS REWARD
   ================================================ */
.reward-card {
  background: linear-gradient(135deg,
    rgba(120, 60, 255, 0.22) 0%,
    rgba(80, 30, 190, 0.14) 100%);
  border: 1px solid rgba(145, 80, 255, 0.38);
  border-radius: 14px;
  padding: 9px 12px;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow:
    0 0 0 1px rgba(145,80,255,0.06),
    0 4px 20px rgba(100, 40, 220, 0.18);
  word-break: break-word;
}

.reward-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.reward-crown {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: rgba(145, 80, 255, 0.3);
  color: #c4a8ff;
  flex-shrink: 0;
}

.reward-title {
  font-weight: 700;
  font-size: 13px;
  color: #ede9ff;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.reward-cost {
  flex-shrink: 0;
  background: rgba(145, 80, 255, 0.22);
  border: 1px solid rgba(145, 80, 255, 0.38);
  color: #c4a8ff;
  font-size: 10.5px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 20px;
  letter-spacing: 0.03em;
}

.reward-meta {
  display: flex;
  align-items: center;
  gap: 5px;
}

.reward-avatar {
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: 5px;
  background: rgba(145, 80, 255, 0.35);
  color: #e2d9ff;
  font-size: 9px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.reward-avatar img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
}

.reward-avatar span {
  position: relative;
  z-index: 0;
}

.reward-author {
  font-weight: 700;
  font-size: 12px;
  color: #c4a8ff;
}

.reward-verb {
  font-size: 11.5px;
  color: rgba(200, 190, 255, 0.42);
}

.reward-input {
  margin-top: 7px;
  padding: 5px 8px;
  background: rgba(0,0,0,0.18);
  border-left: 2px solid rgba(145,80,255,0.4);
  border-radius: 0 6px 6px 0;
  font-size: 12.5px;
  color: rgba(220, 215, 255, 0.65);
  font-style: italic;
  line-height: 1.4;
}
`
