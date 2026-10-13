# ReChat — Карта репозитория и руководство для AI-агентов

> **Назначение**: Этот документ содержит структурированную карту кодовой базы ReChat для AI-агентов (и разработчиков). Он описывает назначение каждого пакета, потоки данных, ключевые структуры и архитектурные правила проекта.

---

## 1. Обзор проекта и стек

**ReChat** — настольное приложение мультичата и стрим-оверлея для стримеров (Twitch, Kick, DonationAlerts).

- **Backend**: Go 1.22+ ([main.go](file:///d:/code/ReChat/main.go), [app.go](file:///d:/code/ReChat/app.go))
- **Десктоп-фреймворк**: [Wails v2](https://wails.io/) (безрамочное прозрачное окно Webview2 на Windows)
- **Frontend**: React 18, Vite, Tailwind CSS ([frontend/](file:///d:/code/ReChat/frontend))
- **База данных**: Pure-Go SQLite ([modernc.org/sqlite](https://pkg.go.dev/modernc.org/sqlite), без CGO, файл `settings.db`)
- **Оверлей / Game Mode**: Win32 API (`user32.dll`, `dwmapi.dll`) — прозрачный click-through режим поверх полноэкранных игр
- **Виджет-сервер**: Встроенный HTTP/SSE сервер на порту `3500` ([widget/](file:///d:/code/ReChat/widget)) с автоматическим Hot Reload (`fsnotify`) для источников браузера OBS
- **Медиа-контроллер**: Отслеживание текущего трека через Windows GSMTC ([mediawatcher.exe](file:///d:/code/ReChat/media/mediawatcher.exe) на C#)
- **Озвучка (TTS)**: Yandex Alice SpeechKit через стриминг WebSocket ([tts/yandex.go](file:///d:/code/ReChat/tts/yandex.go))

---

## 2. Структура проекта (Карта директорий)

```
ReChat/
├── main.go                     # Точка входа приложения, настройка окна Wails
├── app.go                      # Главный контроллер App (мост между Go и React)
├── go.mod / go.sum             # Зависимости Go
├── wails.json                  # Конфигурация сборщика Wails v2
├── WIDGET_AGENT.md             # Инструкция для агентов по созданию тем/виджетов OBS
├── AGENTS.md                   # Данная карта кодовой базы
│
├── auth/                       # Авторизация OAuth
│   └── oauth.go                # Локальный HTTP callback-сервер (:17777) для Twitch OAuth
│
├── config/                     # Конфигурация и персистентность
│   ├── keys.go                 # Константы (Twitch ClientID, порты, API URLs)
│   └── settings.go             # Схема AppSettings, CRUD операции в SQLite (settings.db)
│
├── donationalerts/             # Интеграция с DonationAlerts
│   └── client.go               # Centrifugo WebSocket клиент (донаты и сбор средств)
│
├── kick/                       # Интеграция с платформой Kick
│   ├── client.go               # Pusher WebSocket клиент для чатов Kick
│   └── client_test.go          # Тесты клиента Kick
│
├── media/                      # Интеграция с системным медиаплеером Windows
│   ├── manager.go              # Управление фоновым процессом mediawatcher.exe
│   ├── mediawatcher.exe        # Скомпилированный бинарник C# WinRT (GSMTC)
│   └── src/                    # Исходный код mediawatcher (C# .NET)
│
├── overlay/                    # Игровой оверлей и Game Mode (Click-Through)
│   ├── gamemode_windows.go     # Win32 API хуки (WS_EX_TRANSPARENT, глобальные хоткеи)
│   └── gamemode_other.go       # Заглушки для не-Windows ОС
│
├── pipeline/                   # Центральный брокер сообщений и дедупликация
│   ├── pipeline.go             # Прием, нормализация, дедупликация и рассылка сообщений
│   └── pipeline_test.go        # Тесты дедупликации наград
│
├── proxy/                      # Сеть, прокси и туннелирование
│   ├── proxy.go                # Конфигуратор HTTP, SOCKS5 и WireGuard клиентов
│   └── wireguard.go            # Встроенный userspace WireGuard туннель
│
├── themes/                     # Темы для OBS виджетов (HTML / CSS / JS)
│   ├── chat/                   # Кастомная тема чата
│   ├── default/                # Дефолтная тема чата
│   ├── donation/               # Тема оповещений о донатах
│   ├── follower/               # Тема оповещений о фолловерах
│   ├── goal/                   # Тема полосы сбора средств
│   └── music/                  # Тема текущего трека (Now Playing)
│
├── tts/                        # Озвучка текста (Text-To-Speech)
│   ├── yandex.go               # WebSocket клиент Yandex SpeechKit (Алиса)
│   └── supertonic.go           # Локальный нейросетевой синтез Supertonic (скачивание моделей Hugging Face, ONNX)
│
├── twitch/                     # Интеграция с платформой Twitch
│   ├── client.go               # Twitch IRC WebSocket клиент (сообщения чата)
│   ├── eventsub.go             # Twitch EventSub WebSocket клиент (награды, фолловы, сабы)
│   ├── irc_parser.go           # RFC-парсер протокола Twitch IRC (теги, бейджи, эмодзи)
│   ├── irc_parser_test.go      # Тесты IRC парсера
│   ├── badges.go               # Загрузчик глобальных и канальных бейджей (Helix API)
│   └── emotes.go               # Загрузчик смайлов (Twitch, BTTV, 7TV, FFZ) с кэшем
│
├── widget/                     # Встроенный HTTP-сервер для OBS Browser Source (:3500)
│   ├── server.go               # Маршруты HTTP, вещание SSE (/events), Hot Reload (fsnotify)
│   ├── avatars.go              # Кэширование и загрузка аватарок через Twitch Helix
│   ├── themes.go               # Встроенные fallback-темы чата
│   ├── donation_theme.go       # Встроенная тема донатов
│   ├── follower_theme.go       # Встроенная тема фолловеров
│   ├── goal_theme.go           # Встроенная тема сбора средств
│   ├── music_theme.go          # Встроенная тема музыки
│   └── tts_theme.go            # Встроенная тема статуса озвучки и эквалайзера (/widget/tts)
│
└── frontend/                   # Клиентский интерфейс React (Webview)
    ├── package.json            # Зависимости npm
    ├── vite.config.js          # Конфиг сборщика Vite
    ├── tailwind.config.js      # Стилизация Tailwind CSS
    ├── index.html              # Точка входа Webview
    ├── wailsjs/                # Автогенерированные Wails Go-биндинги и runtime
    └── src/
        ├── main.jsx            # Точка монтирования React
        ├── App.jsx             # Корневой компонент, лента чата, логика скролла, hotkeys
        ├── index.css           # Глобальные CSS переменные и стили
        ├── components/
        │   ├── CustomTitleBar.jsx    # Кастомный заголовок окна (drag & drop, сворачивание)
        │   ├── ChannelBar.jsx        # Панель переключения каналов и статусы
        │   ├── ChatMessage.jsx       # Отображение сообщения чата (бейджи, ники, текст)
        │   ├── InlineEventMessage.jsx# Отображение наград, фолловеров, сабов и донатов
        │   ├── GoalTrackerBar.jsx    # Индикатор сбора средств DonationAlerts
        │   ├── NewMessagesBanner.jsx # Плашка прокрутки вниз при новых сообщениях
        │   ├── TwitchBadge.jsx       # Отрисовка бейджей Twitch
        │   ├── TwitchIcon.jsx        # Иконка Twitch
        │   ├── KickIcon.jsx          # Иконка Kick
        │   ├── SettingsView.jsx      # Модальное окно настроек со вкладками
        │   └── settings/             # Вкладки панели настроек
        │       ├── AccountTab.jsx    # Вход через Twitch OAuth, статус профиля
        │       ├── AppearanceTab.jsx # Шрифты, прозрачность, темы, размеры
        │       ├── ChannelsTab.jsx   # Добавление каналов Twitch/Kick и цвета
        │       ├── DonationsTab.jsx  # Настройки и токен DonationAlerts
        │       ├── FiltersTab.jsx    # Игнорируемые пользователи, команды, смайлы
        │       ├── ProxyTab.jsx      # Настройка прокси (HTTP, SOCKS5, WireGuard)
        │       └── TTSTab.jsx        # Настройка параметров озвучки (голоса, громкость)
        ├── hooks/                    # Кастомные React-хуки
        └── utils/                    # Хелперы цветов каналов, форматирования времени
```

---

## 3. Архитектура и потоки данных

```
               ┌───────────────────────────────┐
               │       Внешние сервисы         │
               │  Twitch IRC / EventSub /      │
               │  Kick Pusher / DonationAlerts │
               └───────────────┬───────────────┘
                               │
                               ▼
               ┌───────────────────────────────┐
               │       pipeline.Pipeline       │
               │     (pipeline/pipeline.go)    │
               │  - Нормализация сообщений     │
               │  - Дедупликация наград/ивентов│
               │  - Распределение по подписчикам│
               └───────┬───────────────┬───────┘
                       │               │
        ┌──────────────┘               └──────────────┐
        ▼                                             ▼
┌───────────────────────────────┐     ┌───────────────────────────────┐
│       Wails Application       │     │     WidgetServer (:3500)      │
│           (app.go)            │     │      (widget/server.go)       │
│ - runtime.EventsEmit()        │     │ - SSE поток (/widget/events)  │
│ - Озвучка TTS                 │     │ - OBS Browser Sources         │
└───────────────┬───────────────┘     └───────────────┬───────────────┘
                ▼                                     ▼
┌───────────────────────────────┐     ┌───────────────────────────────┐
│        Окно ReChat UI         │     │         Стрим в OBS           │
│     (frontend/src/App.jsx)    │     │    (themes/*/index.html)      │
└───────────────────────────────┘     └───────────────────────────────┘
```

### 3.1. Прием и дедупликация сообщений
1. **Twitch IRC** ([twitch/client.go](file:///d:/code/ReChat/twitch/client.go)): соединяется с `wss://irc-ws.chat.twitch.tv:443`. Парсит сырые IRC фреймы с тегами в структуру `twitch.ChatMessage`.
2. **Twitch EventSub** ([twitch/eventsub.go](file:///d:/code/ReChat/twitch/eventsub.go)): WebSocket соединение с `wss://eventsub.wss.twitch.tv/ws`. Ловит активации наград за баллы (`channel_points_custom_reward_redemption`), фолловы, сабы, рейды.
3. **Kick Chat** ([kick/client.go](file:///d:/code/ReChat/kick/client.go)): соединяется с Pusher WebSocket `wss://ws-us2.pusher.com`, транслирует сообщения Kick в унифицированную структуру `twitch.ChatMessage`.
4. **DonationAlerts** ([donationalerts/client.go](file:///d:/code/ReChat/donationalerts/client.go)): соединяется с сервером Centrifugo, получает события донатов и целей сбора.
5. **Центральный Pipeline** ([pipeline/pipeline.go](file:///d:/code/ReChat/pipeline/pipeline.go)):
   - **Проблема**: Награды Twitch за баллы канала приходят **одновременно** и через IRC, и через EventSub.
   - **Решение**: `Pipeline` дедуплицирует их по `custom-reward-id`, имени автора и временному окну. Сообщения трансформируются в `WidgetMessage` и отправляются в UI и OBS без дублей.

### 3.2. Виджеты для OBS Browser Source ([widget/](file:///d:/code/ReChat/widget))
- Сервер работает на `http://localhost:3500`.
- Основные эндпоинты:
  - `/widget/chat`: Чат-виджет (по умолчанию тема `default`, либо `?theme=<имя>`).
  - `/widget/music`: Оверлей текущего трека.
  - `/widget/goal`: Виджет сбора средств.
  - `/widget/follower`: Оповещение о новых фолловерах.
  - `/widget/donation`: Оповещение о донатах.
  - `/widget/events`: Server-Sent Events (SSE) стрим данных в реальном времени.
- **Hot Reload**: Сервер отслеживает папку `themes/` через `fsnotify`. При сохранении любого `.html`, `.css` или `.js` клиентам отправляется событие `reload`, и виджет в OBS перезагружается без ручного вмешательства.

### 3.3. Режим поверх игр (Game Mode / Click-Through) ([overlay/](file:///d:/code/ReChat/overlay))
- Реализован в [overlay/gamemode_windows.go](file:///d:/code/ReChat/overlay/gamemode_windows.go) через Windows API.
- Переключает стиль окна: добавляет флаги `WS_EX_TRANSPARENT | WS_EX_LAYERED`, делает окно кликабельным насквозь и закрепляет поверх всех окон (`HWND_TOPMOST`).
- Управляется глобальными горячими клавишами (`RegisterHotKey`) или из интерфейса.

### 3.4. Прокси и туннелирование ([proxy/](file:///d:/code/ReChat/proxy))
- Все исходящие HTTP-запросы и WebSocket-соединения обязаны использовать `proxy.GetHTTPClient()` и `proxy.GetWebSocketDialer()`.
- Поддерживаются: прямое соединение, HTTP/HTTPS прокси, SOCKS5 (с авторизацией), а также встроенный туннель WireGuard без сторонних демонов.

---

## 4. Ключевые файлы и их ответственность

| Файл / Пакет | Ответственность |
| :--- | :--- |
| [app.go](file:///d:/code/ReChat/app.go) | Центральный сервис Wails. Создает экземпляры всех клиентов, связывает pipeline, экспортирует методы в JavaScript. |
| [main.go](file:///d:/code/ReChat/main.go) | Конфигурация Wails-рантайма: размеры, прозрачность, frameless-режим, обработчики старта и завершения. |
| [config/settings.go](file:///d:/code/ReChat/config/settings.go) | Загрузка и сохранение настроек пользователя в SQLite (`settings.db`). Хранит шрифты, цвета, токены, настройки TTS и прокси. |
| [config/keys.go](file:///d:/code/ReChat/config/keys.go) | Центральное хранилище констант: Twitch ClientID, порт OAuth (`17777`), URL вебсокетов. |
| [pipeline/pipeline.go](file:///d:/code/ReChat/pipeline/pipeline.go) | Брокер сообщений: связывает источники сообщений, исключает дублирование наград и рассылает события в UI, OBS и TTS. |
| [widget/server.go](file:///d:/code/ReChat/widget/server.go) | HTTP-сервер для OBS (:3500). Вещает события по SSE, отслеживает изменения в `themes/` для hot reload. |
| [media/manager.go](file:///d:/code/ReChat/media/manager.go) | Запускает и считывает `mediawatcher.exe`, оповещая виджет музыки об изменениях трека (название, автор, обложка). |
| [frontend/src/App.jsx](file:///d:/code/ReChat/frontend/src/App.jsx) | Главный компонент интерфейса: подписка на события Wails (`EventsOn`), лента чата, логика автоскролла, запуск TTS. |
| [frontend/src/components/SettingsView.jsx](file:///d:/code/ReChat/frontend/src/components/SettingsView.jsx) | Диалоговое окно настроек с табами (Аккаунт, Каналы, Внешний вид, TTS, Фильтры, Прокси, Донаты). |

---

## 5. Важные правила и предостережения для агентов

1. **Генерация Wails-биндингов**:
   - При добавлении или изменении сигнатур публичных методов в `app.go` необходимо обновлять биндинги Wails (`wails generate module` или перезапуск dev-сервера). В коде фронтенда методы импортируются из `frontend/wailsjs/go/main/App`.
2. **Драйвер SQLite**:
   - Используется `modernc.org/sqlite` (чистый Go). Не заменяйте его на `mattn/go-sqlite3`, иначе проект перестанет компилироваться без установленного GCC/CGO.
3. **Сетевые вызовы и прокси**:
   - Никогда не создавайте напрямую `http.DefaultClient` или `websocket.DefaultDialer` для внешних сервисов Twitch, Kick или DonationAlerts. Всегда вызывайте `proxy.GetHTTPClient()` и `proxy.GetWebSocketDialer()`.
4. **Дедупликация сообщений**:
   - Не передавайте сообщения напрямую из IRC или EventSub в UI мимо `pipeline/pipeline.go`. Pipeline защищает от дублирования наград за баллы и нормализует форматы данных.
5. **Безрамочное окно (Frameless)**:
   - Окно десктопа не имеет стандартного заголовка Windows. Перемещение окна осуществляется через CSS `--wails-drop-target: drag` в [frontend/src/components/CustomTitleBar.jsx](file:///d:/code/ReChat/frontend/src/components/CustomTitleBar.jsx).
6. **Темы виджетов OBS**:
   - При создании или изменении тем руководствуйтесь [WIDGET_AGENT.md](file:///d:/code/ReChat/WIDGET_AGENT.md). Все темы должны лежать в `themes/<имя_темы>/` и содержать `index.html` и `style.css`.
