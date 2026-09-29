package widget

import (
	"os"
	"path/filepath"
)

// EnsureDefaultGoalTheme creates the default goal progress widget theme directory.
func EnsureDefaultGoalTheme(themesDir string) error {
	defaultDir := filepath.Join(themesDir, "goal", "default")
	if err := os.MkdirAll(defaultDir, 0755); err != nil {
		return err
	}

	htmlPath := filepath.Join(defaultDir, "index.html")
	if _, err := os.Stat(htmlPath); os.IsNotExist(err) {
		if err := os.WriteFile(htmlPath, []byte(defaultGoalHTML), 0644); err != nil {
			return err
		}
	}

	cssPath := filepath.Join(defaultDir, "style.css")
	if _, err := os.Stat(cssPath); os.IsNotExist(err) {
		if err := os.WriteFile(cssPath, []byte(defaultGoalCSS), 0644); err != nil {
			return err
		}
	}

	return nil
}

const defaultGoalHTML = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Donation Goal Widget</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/widget/goal/assets/default/style.css">
</head>
<body>
  <div id="goal-container" class="goal-root style-glass">
    <!-- Goal Content Card -->
    <div class="goal-card" id="card">
      <!-- Title and Percent Row -->
      <div class="goal-header">
        <div class="goal-title" id="goal-title">Сбор средств</div>
        <div class="goal-percent" id="goal-percent">0%</div>
      </div>

      <!-- Animated Progress Bar Track -->
      <div class="goal-track">
        <div class="goal-fill" id="goal-fill" style="width: 0%;">
          <div class="goal-glow"></div>
        </div>
      </div>

      <!-- Amount Row -->
      <div class="goal-footer">
        <div class="goal-current" id="goal-current">0 ₽</div>
        <div class="goal-target" id="goal-target">из 10 000 ₽</div>
      </div>
    </div>
  </div>

  <script>
    const params = new URLSearchParams(window.location.search);
    const configuredStyle = (params.get('style') || 'glass').toLowerCase(); // 'glass', 'minimal'
    const scale = Math.max(50, parseInt(params.get('scale') || '100', 10));

    const container = document.getElementById('goal-container');
    container.className = 'goal-root style-' + configuredStyle;
    container.style.transform = 'scale(' + (scale / 100) + ')';

    const titleEl = document.getElementById('goal-title');
    const percentEl = document.getElementById('goal-percent');
    const fillEl = document.getElementById('goal-fill');
    const currentEl = document.getElementById('goal-current');
    const targetEl = document.getElementById('goal-target');

    function updateGoal(data) {
      if (!data) return;
      const title = data.title || 'Сбор средств';
      const cur = Number(data.currentAmount || data.raisedAmount || 0);
      const target = Number(data.targetAmount || 0);
      const currency = data.currency || 'RUB';

      let pct = 0;
      if (target > 0) {
        pct = Math.min(100, Math.round((cur / target) * 100));
      }

      titleEl.textContent = title;
      percentEl.textContent = pct + '%';
      fillEl.style.width = pct + '%';
      fillEl.style.opacity = pct > 0 ? '1' : '0';
      currentEl.textContent = formatMoney(cur, currency);
      targetEl.textContent = target > 0 ? ('из ' + formatMoney(target, currency)) : '';
    }

    function formatMoney(amount, currency) {
      const num = Number(amount) || 0;
      const cur = (currency || 'RUB').toUpperCase();
      let symbol = cur;
      if (cur === 'RUB') symbol = '₽';
      else if (cur === 'USD') symbol = '$';
      else if (cur === 'EUR') symbol = '€';

      return num.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ' + symbol;
    }

    function connectSSE() {
      const es = new EventSource('/widget/events');

      es.addEventListener('reload', () => location.reload());

      es.addEventListener('message', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'goal' || data.type === 'goal_update' || data.eventType === 'goal_update') {
            updateGoal(data.goal || data);
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

    // Fetch initial goal via HTTP
    fetch('/widget/goal/data')
      .then(res => res.json())
      .then(data => {
        if (data && data.title) updateGoal(data);
      })
      .catch(() => {});
  </script>
</body>
</html>
`

const defaultGoalCSS = `/* ==========================================================================
   ReChat Donation Goal Widget Styles
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
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.goal-root {
  width: 100%;
  max-width: 480px;
  transform-origin: center center;
  transition: transform 0.3s ease;
}

/* ==========================================================================
   Glass Style
   ========================================================================== */
.style-glass .goal-card {
  background: rgba(22, 23, 30, 0.85);
  backdrop-filter: blur(30px) saturate(180%);
  -webkit-backdrop-filter: blur(30px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 22px;
  padding: 16px 20px;
  box-shadow: 
    0 16px 36px -6px rgba(0, 0, 0, 0.65),
    0 0 0 1px rgba(255, 255, 255, 0.04) inset;
  color: #FFFFFF;
}

.goal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.goal-title {
  font-size: 15px;
  font-weight: 700;
  color: #FFFFFF;
  letter-spacing: -0.2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.goal-percent {
  font-size: 13px;
  font-weight: 800;
  color: #34D399;
  background: rgba(16, 185, 129, 0.15);
  padding: 2px 8px;
  border-radius: 8px;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.goal-track {
  width: 100%;
  height: 14px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  overflow: hidden;
  position: relative;
  margin-bottom: 10px;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4);
}

.goal-fill {
  height: 100%;
  background: linear-gradient(90deg, #10B981 0%, #34D399 50%, #6EE7B7 100%);
  border-radius: 999px;
  transition: width 0.8s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
  position: relative;
}

.goal-glow {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 20px;
  background: rgba(255, 255, 255, 0.5);
  filter: blur(4px);
  border-radius: 999px;
}

.goal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}

.goal-current {
  font-weight: 800;
  color: #FFFFFF;
}

.goal-target {
  font-weight: 500;
  color: rgba(255, 255, 255, 0.55);
}

/* ==========================================================================
   Minimal Style (Webcam Overlay)
   ========================================================================== */
.style-minimal .goal-card {
  background: transparent;
  padding: 0;
  box-shadow: none;
  border: none;
}

.style-minimal .goal-header {
  margin-bottom: 6px;
}

.style-minimal .goal-title {
  font-size: 13px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
}

.style-minimal .goal-percent {
  font-size: 11px;
}

.style-minimal .goal-track {
  height: 8px;
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 6px;
}

.style-minimal .goal-footer {
  font-size: 11px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
}
`
