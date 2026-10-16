import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  X,
  Check,
  Radio,
  VolumeX,
  Sparkles,
  Monitor,
  Gamepad2,
  SkipForward,
  Play,
  Pause,
  Edit3,
  Tv,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { obsClient } from '../../utils/obsWebSocket';
import {
  ToggleGameMode,
  SpeakText,
  UpdateTTSStatus,
  MusicGetState,
} from '../../../wailsjs/go/main/App';
import { EventsOn } from '../../../wailsjs/runtime/runtime';
import PageHeader from './PageHeader';

const DEFAULT_HOTKEYS = [
  { id: 'marker', title: 'Метка', key: 'F9', action: 'marker', isBuiltIn: true },
  { id: 'clip', title: 'Клип', key: 'F10', action: 'clip', isBuiltIn: true },
  { id: 'ad', title: 'Реклама', key: 'F11', action: 'ad', isBuiltIn: true },
  { id: 'tts_mute', title: 'Тишина TTS', key: 'F12', action: 'tts_mute', isBuiltIn: true },
  { id: 'scene_game', title: 'Сцена: Игра', key: 'Ctrl+1', action: 'game_mode', isBuiltIn: true },
  { id: 'scene_chat', title: 'Сцена: Чат', key: 'Ctrl+2', action: 'chat_scene', isBuiltIn: true },
  { id: 'track_skip', title: 'Пропуск трека', key: 'Ctrl+→', action: 'skip_track', isBuiltIn: true },
];

const INITIAL_EVENTS = [
  {
    id: 'evt-1',
    type: 'donation',
    icon: '₽',
    iconBg: '#FFB84D',
    iconColor: '#0E0F13',
    title: 'Артём · 500 ₽',
    subtitle: 'На микрофон!',
  },
  {
    id: 'evt-2',
    type: 'sub',
    icon: '★',
    iconBg: '#9146FF',
    iconColor: '#fff',
    title: 'sora_k подписалась',
    subtitle: '3 месяца подряд',
  },
  {
    id: 'evt-3',
    type: 'follow',
    icon: '♥',
    iconBg: '#FF5FA2',
    iconColor: '#0E0F13',
    title: 'nightfox подписался',
    subtitle: 'новый фолловер',
  },
];

export default function HomeTab({
  onSelectTab = () => {},
  onClose,
  joinedChannels = [],
}) {
  // OBS Telemetry state
  const [obsState, setObsState] = useState(obsClient.getState());

  // Stream state
  const [streamSeconds, setStreamSeconds] = useState(8073); // fallback simulation 02:14:33
  const [simStreaming, setSimStreaming] = useState(true);
  const [viewers, setViewers] = useState(1540);
  const [streamTitle, setStreamTitle] = useState('Турнир по Apex Legends · Играем со зрителями');

  // Modals & UI
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddHotkeyOpen, setIsAddHotkeyOpen] = useState(false);
  const [newHotkeyTitle, setNewHotkeyTitle] = useState('');
  const [newHotkeyKey, setNewHotkeyKey] = useState('');
  const [activeHotkeyId, setActiveHotkeyId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Custom hotkeys from localStorage
  const [hotkeys, setHotkeys] = useState(() => {
    try {
      const saved = localStorage.getItem('rechat_home_hotkeys');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_HOTKEYS;
  });

  // Events list
  const [eventsList, setEventsList] = useState(INITIAL_EVENTS);

  // Metrics
  const [donationTotal, setDonationTotal] = useState(3450);
  const [followerCount, setFollowerCount] = useState(14);
  const [musicQueueCount, setMusicQueueCount] = useState(4);

  // Subscribe to OBS client
  useEffect(() => {
    const unsub = obsClient.subscribe((state) => {
      setObsState(state);
    });
    return unsub;
  }, []);

  // Timer simulation if OBS is not actively providing stream time
  useEffect(() => {
    if (obsState.isConnected && obsState.isStreaming) return;
    if (!simStreaming) return;

    const interval = setInterval(() => {
      setStreamSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [simStreaming, obsState.isConnected, obsState.isStreaming]);

  // Subscribe to real live Wails events (donations, goals, follows)
  useEffect(() => {
    let cancelChat = null;
    let cancelGoal = null;

    try {
      cancelChat = EventsOn('chat:message', (msg) => {
        if (!msg) return;

        if (msg.eventType === 'donation') {
          const amt = parseFloat(msg.eventData?.amount || 0);
          if (amt > 0) setDonationTotal((prev) => prev + amt);

          setEventsList((prev) => [
            {
              id: `live-don-${Date.now()}`,
              type: 'donation',
              icon: '₽',
              iconBg: '#FFB84D',
              iconColor: '#0E0F13',
              title: `${msg.displayName || msg.user || 'Аноним'} · ${amt} ₽`,
              subtitle: msg.message || 'Донат',
            },
            ...prev.slice(0, 15),
          ]);
        } else if (msg.eventType === 'follow' || msg.eventType === 'channel.follow') {
          setFollowerCount((prev) => prev + 1);
          setEventsList((prev) => [
            {
              id: `live-fol-${Date.now()}`,
              type: 'follow',
              icon: '♥',
              iconBg: '#FF5FA2',
              iconColor: '#0E0F13',
              title: `${msg.displayName || msg.user || 'Новый зритель'} подписался`,
              subtitle: 'новый фолловер',
            },
            ...prev.slice(0, 15),
          ]);
        } else if (msg.eventType === 'sub' || msg.eventType === 'resub') {
          setEventsList((prev) => [
            {
              id: `live-sub-${Date.now()}`,
              type: 'sub',
              icon: '★',
              iconBg: '#9146FF',
              iconColor: '#fff',
              title: `${msg.displayName || msg.user || 'Зритель'} оформил подписку`,
              subtitle: msg.eventData?.cumulative_months
                ? `${msg.eventData.cumulative_months} месяцев подряд`
                : 'Новая подписка',
            },
            ...prev.slice(0, 15),
          ]);
        }
      });

      cancelGoal = EventsOn('goal:update', (goal) => {
        if (goal && typeof goal.currentAmount === 'number') {
          setDonationTotal(goal.currentAmount);
        }
      });

      // Music state listener
      const cancelMusic = EventsOn('music:state', (state) => {
        if (state && typeof state.totalQueueCount === 'number') {
          setMusicQueueCount(state.totalQueueCount);
        }
      });

      // Initial music state fetch
      MusicGetState().then((st) => {
        if (st && typeof st.totalQueueCount === 'number') {
          setMusicQueueCount(st.totalQueueCount);
        }
      }).catch(() => {});
    } catch (e) {
      console.warn('EventsOn listeners not available in browser mode:', e);
    }

    return () => {
      if (typeof cancelChat === 'function') cancelChat();
      if (typeof cancelGoal === 'function') cancelGoal();
    };
  }, []);

  const formatStreamTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2400);
  };

  // Central Hotkey Execution
  const triggerHotkey = useCallback(
    (item) => {
      setActiveHotkeyId(item.id);
      setTimeout(() => setActiveHotkeyId(null), 300);

      switch (item.action) {
        case 'tts_mute':
          try {
            SpeakText('');
            UpdateTTSStatus('idle', '');
          } catch (e) {}
          showToast('Тишина: TTS остановлен');
          break;

        case 'game_mode':
          // Switch to game scene in OBS if connected
          if (obsState.isConnected) {
            obsClient.setScene('Игра');
          }
          try {
            ToggleGameMode();
          } catch (e) {}
          showToast('Сцена «Игра» / Оверлей включен');
          break;

        case 'chat_scene':
          if (obsState.isConnected) {
            obsClient.setScene('Чат');
          }
          if (onClose) {
            onClose();
          } else {
            onSelectTab('appearance');
          }
          showToast('Переключено на чат');
          break;

        case 'marker':
          if (obsState.isConnected) {
            obsClient.createStreamMarker();
          }
          showToast('Метка трансляции сохранена (F9)');
          break;

        case 'clip':
          showToast('Twitch клип создан (F10)');
          break;

        case 'ad':
          showToast('Запущена пауза рекламы (30 сек)');
          break;

        case 'skip_track':
          showToast('Музыкальный трек пропущен (Ctrl+→)');
          break;

        default:
          showToast(`Хоткей выполнен: ${item.title}`);
          break;
      }
    },
    [obsState.isConnected, onClose, onSelectTab]
  );

  // Global physical keyboard listener when HomeTab is active
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return;

      if (e.key === 'F9') {
        e.preventDefault();
        const hk = hotkeys.find((h) => h.key === 'F9');
        if (hk) triggerHotkey(hk);
      } else if (e.key === 'F10') {
        e.preventDefault();
        const hk = hotkeys.find((h) => h.key === 'F10');
        if (hk) triggerHotkey(hk);
      } else if (e.key === 'F11') {
        e.preventDefault();
        const hk = hotkeys.find((h) => h.key === 'F11');
        if (hk) triggerHotkey(hk);
      } else if (e.key === 'F12') {
        e.preventDefault();
        const hk = hotkeys.find((h) => h.key === 'F12');
        if (hk) triggerHotkey(hk);
      } else if (e.ctrlKey && (e.key === '1' || e.code === 'Digit1')) {
        e.preventDefault();
        const hk = hotkeys.find((h) => h.action === 'game_mode' || h.key === 'Ctrl+1');
        if (hk) triggerHotkey(hk);
      } else if (e.ctrlKey && (e.key === '2' || e.code === 'Digit2')) {
        e.preventDefault();
        const hk = hotkeys.find((h) => h.action === 'chat_scene' || h.key === 'Ctrl+2');
        if (hk) triggerHotkey(hk);
      } else if (e.ctrlKey && (e.key === 'ArrowRight' || e.key === 'Right')) {
        e.preventDefault();
        const hk = hotkeys.find((h) => h.action === 'skip_track' || h.key.includes('→'));
        if (hk) triggerHotkey(hk);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hotkeys, triggerHotkey]);

  // Add custom hotkey
  const handleAddHotkeySubmit = (e) => {
    e.preventDefault();
    if (!newHotkeyTitle.trim() || !newHotkeyKey.trim()) return;

    const nextHotkeys = [
      ...hotkeys,
      {
        id: `custom_${Date.now()}`,
        title: newHotkeyTitle.trim(),
        key: newHotkeyKey.trim().toUpperCase(),
        action: 'custom',
        isBuiltIn: false,
      },
    ];
    setHotkeys(nextHotkeys);
    localStorage.setItem('rechat_home_hotkeys', JSON.stringify(nextHotkeys));
    setNewHotkeyTitle('');
    setNewHotkeyKey('');
    setIsAddHotkeyOpen(false);
    showToast('Хоткей успешно добавлен!');
  };

  const handleRemoveCustomHotkey = (e, id) => {
    e.stopPropagation();
    const filtered = hotkeys.filter((h) => h.id !== id);
    setHotkeys(filtered);
    localStorage.setItem('rechat_home_hotkeys', JSON.stringify(filtered));
  };

  // Determine current stream display
  const isActuallyStreaming = obsState.isConnected ? obsState.isStreaming : simStreaming;
  const currentStreamTime = obsState.isConnected && obsState.isStreaming
    ? obsState.streamTimecode
    : formatStreamTime(streamSeconds);

  return (
    <div className="flex flex-col w-full font-['Manrope',sans-serif] text-[#EDEEF2] pb-6 select-none relative">
      {/* Toast popup */}
      {toastMessage && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 animate-fade-in pointer-events-none">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#15171E] border border-[#7CF2C8]/40 text-[#7CF2C8] text-xs font-bold shadow-2xl backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-[#7CF2C8] animate-pulse" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      <div className="p-4 pt-1 w-full">
        <PageHeader
          title="Дашборд"
          description="Статус трансляции, события стрима и быстрые действия"
          badge={{
            text: isActuallyStreaming
              ? `В эфире ${currentStreamTime}`
              : obsState.isConnected
              ? 'OBS подключен'
              : 'Офлайн',
            status: isActuallyStreaming ? 'ok' : 'off',
          }}
        />

        {/* Stream Status Row matching Screen 1 */}
        <div className="flex items-center gap-2 text-xs text-[#A0A4B4] mb-3">
          <span
            className={`w-[7px] h-[7px] rounded-full shrink-0 ${
              isActuallyStreaming
                ? 'bg-[#FF5FA2] animate-pulse'
                : obsState.isConnected
                ? 'bg-[#FFB84D]'
                : 'bg-[#6B7080]'
            }`}
          />
          <b className="text-[#EDEEF2] font-bold">
            {isActuallyStreaming
              ? `В эфире ${currentStreamTime}`
              : obsState.isConnected
              ? `OBS: Ожидание (${obsState.currentScene || 'Готов'})`
              : `Офлайн · ${currentStreamTime}`}
          </b>
          <span>· {viewers.toLocaleString('ru-RU')} зрителей</span>

          {obsState.isConnected && (
            <span className="text-[10px] font-mono text-[#7CF2C8] bg-[#7CF2C8]/10 px-1.5 py-0.5 rounded border border-[#7CF2C8]/20">
              {obsState.activeFps} FPS
            </span>
          )}

          <span className="flex-1" />

          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="border-0 rounded-lg px-2.5 py-1 text-xs font-bold bg-[#1E212B] text-[#EDEEF2] hover:bg-[#282C38] active:scale-95 transition cursor-pointer"
          >
            Править
          </button>
        </div>

        {/* Section: ХОТКЕИ */}
        <div className="font-mono text-[10px] font-medium tracking-[0.08em] text-[#6B7080] mt-4 mb-2 uppercase flex items-center justify-between">
          <span>ХОТКЕИ</span>
          <span className="text-[9px] opacity-70 lowercase">работают и с клавиатуры</span>
        </div>

        {/* Hotkeys Grid */}
        <div className="grid grid-cols-3 gap-2">
          {hotkeys.map((hk) => {
            const isActive = activeHotkeyId === hk.id;
            return (
              <div
                key={hk.id}
                onClick={() => triggerHotkey(hk)}
                className={`group relative h-[72px] rounded-[14px] p-2.5 box-border flex flex-col justify-between text-left text-[13px] font-bold transition cursor-pointer border ${
                  isActive
                    ? 'bg-[#1E212B] border-[#7CF2C8] scale-95 shadow-lg shadow-[#7CF2C8]/15'
                    : 'bg-[#15171E] border-white/[0.06] hover:bg-[#1A1D26] hover:border-white/10 active:scale-95'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[#EDEEF2] leading-tight truncate">
                    {hk.title}
                  </span>
                  {!hk.isBuiltIn && (
                    <button
                      type="button"
                      onClick={(e) => handleRemoveCustomHotkey(e, hk.id)}
                      className="opacity-0 group-hover:opacity-100 text-[#6B7080] hover:text-rose-400 transition p-0.5"
                      title="Удалить хоткей"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>

                <span className="font-mono text-[10px] font-medium tracking-[0.08em] text-[#7CF2C8]">
                  {hk.key}
                </span>
              </div>
            );
          })}

          {/* Add Hotkey button */}
          <button
            type="button"
            onClick={() => setIsAddHotkeyOpen(true)}
            className="h-[72px] rounded-[14px] border border-dashed border-white/15 text-[#6B7080] hover:border-[#7CF2C8]/50 hover:text-[#7CF2C8] hover:bg-white/[0.02] flex items-center justify-center gap-1.5 text-xs font-bold transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Добавить</span>
          </button>
        </div>

        {/* Section: СОБЫТИЯ */}
        <div className="font-mono text-[10px] font-medium tracking-[0.08em] text-[#6B7080] mt-4 mb-2 uppercase">
          СОБЫТИЯ
        </div>

        <div className="overflow-hidden rounded-[14px] border border-white/[0.06] bg-[#15171E]">
          {eventsList.slice(0, 3).map((evt, idx) => (
            <div
              key={evt.id || idx}
              onClick={() => showToast(`${evt.title}: ${evt.subtitle}`)}
              className="flex items-center gap-2.5 p-2.5 px-3 border-b border-white/[0.06] last:border-b-0 text-[13px] text-[#EDEEF2] hover:bg-white/[0.02] transition cursor-pointer"
            >
              <span
                style={{
                  backgroundColor: evt.iconBg,
                  color: evt.iconColor,
                }}
                className="w-[30px] h-[30px] rounded-[9px] grid place-items-center font-bold text-[13px] shrink-0"
              >
                {evt.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{evt.title}</div>
                <div className="text-xs text-[#A0A4B4] truncate">{evt.subtitle}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Metrics Row matching Screen 1 */}
        <div className="flex gap-2 mt-2.5">
          <div className="flex-1 p-2.5 px-3 rounded-[14px] border border-white/[0.06] bg-[#15171E]">
            <div className="font-mono text-[10px] font-medium tracking-[0.08em] text-[#6B7080] uppercase">
              ДОНАТЫ
            </div>
            <div className="font-mono text-[17px] font-medium mt-1.5 text-[#7CF2C8]">
              {donationTotal.toLocaleString('ru-RU')} ₽
            </div>
          </div>

          <div className="flex-1 p-2.5 px-3 rounded-[14px] border border-white/[0.06] bg-[#15171E]">
            <div className="font-mono text-[10px] font-medium tracking-[0.08em] text-[#6B7080] uppercase">
              ПОДПИСЧИКИ
            </div>
            <div className="font-mono text-[17px] font-medium mt-1.5 text-[#7CF2C8]">
              +{followerCount}
            </div>
          </div>

          <div
            onClick={() => onSelectTab('music')}
            className="flex-1 p-2.5 px-3 rounded-[14px] border border-white/[0.06] bg-[#15171E] hover:bg-[#1E212B] hover:border-[#7CF2C8]/30 transition-all cursor-pointer"
            title="Открыть заказы музыки и очередь"
          >
            <div className="font-mono text-[10px] font-medium tracking-[0.08em] text-[#6B7080] uppercase">
              ОЧЕРЕДЬ
            </div>
            <div className="font-mono text-[17px] font-medium mt-1.5 text-[#7CF2C8]">
              {musicQueueCount} трека
            </div>
          </div>
        </div>
      </div>

      {/* Edit Stream Modal */}
      {isEditModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsEditModalOpen(false);
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#15171E] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#EDEEF2]">Параметры трансляции</h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-[#6B7080] hover:text-[#EDEEF2] rounded-lg p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[#A0A4B4] font-medium block mb-1">Название стрима</label>
                <input
                  type="text"
                  value={streamTitle}
                  onChange={(e) => setStreamTitle(e.target.value)}
                  className="w-full bg-[#1E212B] border border-white/[0.08] rounded-lg px-3 py-2 text-[#EDEEF2] outline-none focus:border-[#7CF2C8]"
                />
              </div>

              <div>
                <label className="text-[#A0A4B4] font-medium block mb-1">Зрители</label>
                <input
                  type="number"
                  value={viewers}
                  onChange={(e) => setViewers(Number(e.target.value) || 0)}
                  className="w-full bg-[#1E212B] border border-white/[0.08] rounded-lg px-3 py-2 text-[#EDEEF2] outline-none focus:border-[#7CF2C8]"
                />
              </div>

              {/* OBS Integration status inside Edit */}
              <div className="p-3 rounded-xl bg-[#1E212B] border border-white/[0.06] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#EDEEF2]">Статус OBS Studio:</span>
                  <span
                    className={`font-mono font-bold text-[11px] ${
                      obsState.isConnected ? 'text-[#7CF2C8]' : 'text-[#6B7080]'
                    }`}
                  >
                    {obsState.isConnected ? 'Подключен' : 'Не подключен'}
                  </span>
                </div>
                {obsState.isConnected && (
                  <p className="text-[#A0A4B4] text-[11px]">
                    Текущая сцена: <b className="text-white">{obsState.currentScene || 'Игра'}</b> · FPS: {obsState.activeFps}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[#A0A4B4] font-medium">Статус эфира</span>
                {obsState.isConnected ? (
                  <button
                    type="button"
                    onClick={() => obsClient.toggleStream()}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      obsState.isStreaming
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-[#7CF2C8] text-[#0E0F13]'
                    }`}
                  >
                    {obsState.isStreaming ? 'Остановить стрим в OBS' : 'Запустить стрим в OBS'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSimStreaming(!simStreaming)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      simStreaming
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {simStreaming ? 'Остановить таймер' : 'Возобновить'}
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="flex-1 py-2 bg-[#7CF2C8] text-[#0E0F13] font-bold rounded-lg text-xs hover:bg-[#9af7d8] transition cursor-pointer"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Hotkey Modal */}
      {isAddHotkeyOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsAddHotkeyOpen(false);
          }}
        >
          <form
            onSubmit={handleAddHotkeySubmit}
            className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#15171E] p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#EDEEF2]">Новый хоткей</h3>
              <button
                type="button"
                onClick={() => setIsAddHotkeyOpen(false)}
                className="text-[#6B7080] hover:text-[#EDEEF2] rounded-lg p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[#A0A4B4] font-medium block mb-1">Название действия</label>
                <input
                  type="text"
                  placeholder="Например: Сброс звука или Сцена: Пауза"
                  value={newHotkeyTitle}
                  onChange={(e) => setNewHotkeyTitle(e.target.value)}
                  className="w-full bg-[#1E212B] border border-white/[0.08] rounded-lg px-3 py-2 text-[#EDEEF2] outline-none focus:border-[#7CF2C8]"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[#A0A4B4] font-medium block mb-1">Комбинация клавиш</label>
                <input
                  type="text"
                  placeholder="Например: F8 или Ctrl+3"
                  value={newHotkeyKey}
                  onChange={(e) => setNewHotkeyKey(e.target.value)}
                  className="w-full bg-[#1E212B] border border-white/[0.08] rounded-lg px-3 py-2 text-[#EDEEF2] outline-none focus:border-[#7CF2C8] font-mono"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddHotkeyOpen(false)}
                className="flex-1 py-2 bg-[#1E212B] text-[#EDEEF2] font-bold rounded-lg text-xs hover:bg-[#282C38] transition cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={!newHotkeyTitle.trim() || !newHotkeyKey.trim()}
                className="flex-1 py-2 bg-[#7CF2C8] text-[#0E0F13] font-bold rounded-lg text-xs hover:bg-[#9af7d8] disabled:opacity-40 transition cursor-pointer"
              >
                Добавить
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
