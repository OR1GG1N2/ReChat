# ReChat Widget System — Инструкция для AI-агентов (Themes & Plugins)

> **Назначение этого файла**: Скопируйте и передайте этот документ любому AI-ассистенту (Claude, ChatGPT, Cursor, Copilot, v0), чтобы он создал или модифицировал тему/виджет для ReChat с поддержкой аватарок, анимаций, наград за баллы и кастомного стиля.

---

## 1. Архитектура ReChat Widget

ReChat — стримерское Twitch-приложение на **Go + Wails v2 + React**.  
Внутри приложения работает встроенный легковесный HTTP-сервер на порту **`3500`**.

### Ключевые адреса:
- **URL для OBS Browser Source**:  
  `http://localhost:3500/widget/chat` (тема по умолчанию `default`)  
  `http://localhost:3500/widget/chat?theme=<имя_темы>`
- **Статические ассеты темы**:  
  `http://localhost:3500/widget/assets/<имя_темы>/style.css`  
  `http://localhost:3500/widget/assets/<имя_темы>/<любой_файл>`
- **Server-Sent Events (SSE)**:  
  `http://localhost:3500/widget/events`  
  (или `http://localhost:3500/widget/events?theme=<имя_темы>`)
- **Список доступных тем (JSON)**:  
  `http://localhost:3500/widget/themes`

### Горячая перезагрузка (Hot Reload):
Сервер отслеживает изменения файлов в папке `themes/` с помощью `fsnotify`. При любом сохранении `.html`, `.css` или `.js` клиентам отправляется событие SSE `reload`, и виджет в OBS перезагружается автоматически без необходимости обновлять источник вручную!

---

## 2. Структура папок тем

Темы располагаются в папке `themes/` в корне проекта (или рядом с `.exe` файлом):

```
ReChat/
└── themes/
    ├── WIDGET_AGENT.md           <-- эта инструкция
    ├── default/
    │   ├── index.html            <-- HTML разметка и логика JS
    │   ├── style.css             <-- стили темы
    │   └── preview.png           <-- (опционально) превью темы
    └── my_custom_theme/
        ├── index.html
        ├── style.css
        ├── sound.mp3             <-- (опционально) звуки оповещений
        └── font.woff2            <-- (опционально) локальные шрифты
```

Каждая тема — это отдельная изолированная веб-страница (`index.html`), которая подключает свой `style.css` и слушает SSE-поток.

---

## 3. Спецификация данных (SSE JSON Schema)

Виджет подключается к `http://localhost:3500/widget/events` через `EventSource`.  
Слушаются два события:
1. `reload`: событие без данных, по которому вызывается `location.reload()`.
2. `message`: стандартное событие с JSON-объектом `WidgetMessage` в `e.data`.

### Модель `WidgetMessage`:
```json
{
  "type": "message",             // "message" | "reward" | "clear"
  "author": "StreamerName",      // Отображаемое имя пользователя (DisplayName)
  "avatarUrl": "https://static-cdn.jtvnw.net/jtv_user_pictures/....png", // Прямая ссылка на аватар Twitch (может быть пустой строкой)
  "color": "#9146FF",            // Цвет ника из настроек Twitch (Hex)
  "badges": [                    // Список URL или идентификаторов бейджей
    "https://badges.twitch.tv/..."
  ],
  "text": "Привет, стрим!",      // Текст сообщения чата
  "emotes": [],                  // Список URL смайликов
  "rewardTitle": "Заказ трека",  // Название награды за баллы (только для type: "reward")
  "cost": 500,                   // Стоимость в баллах (только для type: "reward")
  "userInput": "https://...",    // Текст ввода пользователя к награде (если награда с вводом)
  "channel": "streamer",         // Канал Twitch
  "timestamp": "2026-09-15T21:40:00Z" // Время отправки сообщения
}
```

### Типы сообщений:
- **`message`**: Обычное сообщение чата Twitch.
- **`reward`**: Активация награды за баллы канала (Channel Points Reward) — как с текстом сообщения, так и без текста!
- **`clear`**: Очистка чата модератором (удаляет сообщения).

---

## 4. Работа с аватарками (Avatar Guidelines)

1. **Доступность аватарок**: Поле `avatarUrl` содержит прямую ссылку на аватар пользователя с Twitch CDN (Helix API).
2. **Fallback (Отказоустойчивость)**:
   - Если аватарка еще не загрузилась в кэш или у пользователя нет фото, `avatarUrl` будет пустой строкой `""`.
   - Если изображение не загрузилось из-за сети, сработает `onerror="this.remove()"`.
3. **Стандарт отображения**:
   - Контейнер фиксированного размера (например, 28x28px или 32x32px) с `border-radius` (круглый или скругленный квадрат).
   - Фоновый цвет контейнера вычисляется хэш-функцией от ника пользователя (`avatarColor(author)`).
   - Внутри контейнера по центру отображается первая буква ника (`initial(author)`).
   - Поверх буквы с `position: absolute; top:0; left:0; width:100%; height:100%; object-fit: cover;` выводится тег `<img>`.
   - Если картинка есть и загрузилась — она перекрывает букву. Если нет или упала с ошибкой — видна буква на приятном цветном фоне!

---

## 5. Полный эталонный шаблон темы (Starter Template)

Создайте папку `themes/<имя_темы>/` и положите туда два файла:

### `index.html`:
```html
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ReChat Widget</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="chat"></div>

  <script>
    const CHAT = document.getElementById('chat');
    const MAX_MESSAGES = 40;

    // Подключение к SSE-серверу ReChat
    const es = new EventSource('http://localhost:3500/widget/events');

    // Автоматический hot-reload при редактировании файлов темы
    es.addEventListener('reload', () => location.reload());

    // Получение сообщений чата и наград
    es.addEventListener('message', (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'clear') {
          CHAT.innerHTML = '';
          return;
        }
        addMessage(msg);
      } catch (err) {
        console.error('Failed to parse widget message:', err);
      }
    });

    function addMessage(msg) {
      const el = document.createElement('div');

      if (msg.type === 'reward') {
        // Карточка использования награды за баллы
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
              '<span class="reward-verb">активировал награду</span>' +
            '</div>' +
            inputHtml +
          '</div>';
      } else {
        // Обычное сообщение чата
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

      // Двойной RAF для запуска CSS-анимации появления
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('visible')));

      // Ограничение максимального количества сообщений на экране
      while (CHAT.children.length > MAX_MESSAGES) {
        const old = CHAT.firstChild;
        old.classList.add('removing');
        setTimeout(() => { if (old.parentNode) old.remove(); }, 300);
        break;
      }
    }

    // Рендер аватарки (картинка или стильный силуэт без букв)
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
      return (s || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function initial(name) {
      return (name || '?').charAt(0).toUpperCase();
    }

    function formatNum(n) {
      return n >= 1000 ? (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'K' : String(n);
    }

    function avatarColor(name) {
      const palette = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#3b82f6', '#10b981'];
      let h = 0;
      for (let i = 0; i < (name || '').length; i++) {
        h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
      }
      return palette[Math.abs(h) % palette.length];
    }

    // Режим тестирования (нажмите клавишу "T" в браузере или добавьте ?test=1)
    if (new URLSearchParams(location.search).get('test') === '1') {
      setInterval(() => {
        const isReward = Math.random() < 0.2;
        addMessage({
          type: isReward ? 'reward' : 'message',
          author: ['StreamFan', 'GamerPro', 'CyberCat', 'Mod'][Math.floor(Math.random() * 4)],
          avatarUrl: Math.random() > 0.3 ? 'https://picsum.photos/64' : '',
          color: ['#ff4f4d', '#00ffc4', '#ffb703', '#9d4edd'][Math.floor(Math.random() * 4)],
          text: 'Тестовое сообщение чата с классным оформлением! #' + Math.floor(Math.random() * 100),
          rewardTitle: 'Выделить сообщение',
          cost: 250,
          userInput: 'Привет всем на стриме!'
        });
      }, 2500);
    }
  </script>
</body>
</html>
```

### `style.css`:
```css
/* ========================================================
   ReChat OBS Widget Theme
   ======================================================== */

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background: transparent;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
}

#chat {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 6px;
  padding: 12px;
  height: 100vh;
  overflow: hidden;
}

/* ---- Анимации появления и удаления ---- */
.row {
  opacity: 0;
  transform: translateX(-12px) translateY(8px);
  transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1),
              transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  will-change: opacity, transform;
}

.row.visible {
  opacity: 1;
  transform: translateX(0) translateY(0);
}

.row.removing {
  opacity: 0;
  transform: translateY(-6px);
  transition: opacity 0.25s ease, transform 0.25s ease;
}

/* ========================================================
   Обычное сообщение чата (.msg-card)
   ======================================================== */
.msg-card {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  background: rgba(16, 17, 24, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 12px;
  padding: 8px 11px 8px 9px;
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: 0 2px 14px rgba(0, 0, 0, 0.28);
  word-break: break-word;
}

/* Аватарка в чате */
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
  font-size: 12px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.95);
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
  font-size: 13px;
  margin-right: 6px;
  letter-spacing: 0.01em;
}

.msg-text {
  color: #e2e5f5;
  font-size: 13px;
}

/* ========================================================
   Награда за баллы (.reward-card)
   ======================================================== */
.reward-card {
  background: linear-gradient(135deg, rgba(130, 60, 255, 0.26) 0%, rgba(80, 25, 195, 0.16) 100%);
  border: 1px solid rgba(155, 90, 255, 0.42);
  border-radius: 14px;
  padding: 10px 13px;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 0 0 1px rgba(155, 90, 255, 0.08),
              0 4px 22px rgba(105, 45, 225, 0.22);
  word-break: break-word;
}

.reward-header {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 7px;
}

.reward-crown {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: rgba(145, 80, 255, 0.35);
  color: #d6bfff;
  flex-shrink: 0;
}

.reward-title {
  font-weight: 700;
  font-size: 13px;
  color: #f1edff;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.reward-cost {
  flex-shrink: 0;
  background: rgba(145, 80, 255, 0.25);
  border: 1px solid rgba(145, 80, 255, 0.45);
  color: #d6bfff;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 20px;
}

.reward-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.reward-avatar {
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  background: rgba(145, 80, 255, 0.35);
  color: #e6dcff;
  font-size: 9.5px;
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
  color: #d1b8ff;
}

.reward-verb {
  font-size: 11.5px;
  color: rgba(210, 200, 255, 0.5);
}

.reward-input {
  margin-top: 8px;
  padding: 6px 9px;
  background: rgba(0, 0, 0, 0.22);
  border-left: 2px solid rgba(155, 90, 255, 0.45);
  border-radius: 0 6px 6px 0;
  font-size: 12.5px;
  color: rgba(230, 225, 255, 0.75);
  font-style: italic;
  line-height: 1.4;
}
```

---

## 6. Как настроить в OBS Studio

1. Откройте **OBS Studio**.
2. В панели «Источники» (Sources) нажмите **`+`** и выберите **«Браузер»** (Browser).
3. Назовите источник, например: `ReChat Widget`.
4. В поле **URL** укажите:
   - Для стандартной темы: `http://localhost:3500/widget/chat`
   - Для вашей темы: `http://localhost:3500/widget/chat?theme=<папка_темы>`
5. Установите размеры (например, Ширина: `450`, Высота: `700`).
6. Очистите поле **Пользовательский CSS** (Custom CSS), стили уже встроены в тему.
7. Рекомендуется включить галочки:
   - ✅ *Выключать источник, когда он невидим*
   - ✅ *Обновлять браузер, когда сцена становится активной*
8. Нажмите **ОК**. Готово!

---

## 7. Чек-лист для создания кастомной темы

Когда вы просите агента разработать тему:
1. Укажите желаемый стиль (минимализм, киберпанк, ретро, аниме, неоморфизм, неоновые акценты и т.д.).
2. Создайте новую папку: `themes/<ваше_название>/`.
3. Положите туда `index.html` и `style.css`.
4. Проверьте в браузере по адресу `http://localhost:3500/widget/chat?theme=<ваше_название>&test=1`.
