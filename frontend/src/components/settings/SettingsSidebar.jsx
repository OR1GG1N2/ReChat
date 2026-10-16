import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  LayoutDashboard,
  MessageSquare,
  Music,
  Bell,
  Keyboard,
  BarChart2,
  Volume2,
  Monitor,
  Settings,
  Sliders,
  Radio,
  Coins,
  Filter,
  Globe,
  Layers,
  Gamepad2,
  Minimize2,
} from 'lucide-react';
import { obsClient } from '../../utils/obsWebSocket';
import {
  ToggleGameMode,
  MusicGetState,
  MusicSkip,
} from '../../../wailsjs/go/main/App';
import { WindowSetSize, EventsOn } from '../../../wailsjs/runtime/runtime';

const STATUS_COLOR = {
  ok: 'bg-[#7CF2C8]',
  warn: 'bg-[#FFB84D]',
  off: 'bg-[#6B7080]',
};

export default function SettingsSidebar({
  tabs = [],
  activeTab = 'home',
  onSelectTab = () => {},
  statusMsg = null,
  collapsed = undefined,
  onToggleCollapsed = undefined,
  onClose = () => {},
  twitchAuthStatus = null,
  streamInfo = null,
  connections = null,
}) {
  const [innerCollapsed, setInnerCollapsed] = useState(false);
  const isCollapsed = collapsed !== undefined ? collapsed : innerCollapsed;
  const toggle = () => {
    if (onToggleCollapsed) {
      onToggleCollapsed();
    } else {
      setInnerCollapsed((v) => !v);
    }
  };

  // OBS Telemetry for live indicator
  const [obsState, setObsState] = useState(obsClient.getState());
  useEffect(() => {
    const unsub = obsClient.subscribe((s) => setObsState(s));
    return unsub;
  }, []);

  const isLive = streamInfo?.live ?? (obsState.isConnected && obsState.isStreaming);
  const uptime =
    streamInfo?.uptime ??
    (obsState.isConnected && obsState.streamTimecode ? obsState.streamTimecode : '00:00:00');
  const viewers = streamInfo?.viewers ?? 0;

  // Music state & Queue count
  const [musicState, setMusicState] = useState(null);
  useEffect(() => {
    MusicGetState().then(setMusicState).catch(() => {});
    if (typeof EventsOn === 'function') {
      const unsub = EventsOn('music:state', (st) => setMusicState(st));
      return () => {
        if (typeof unsub === 'function') unsub();
      };
    }
  }, []);

  const queueCount = useMemo(() => {
    if (!musicState || !musicState.queue) return 4;
    return musicState.queue.length;
  }, [musicState]);

  // Command Palette (Ctrl+K)
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [paletteIndex, setPaletteIndex] = useState(0);
  const paletteInputRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      } else if (e.key === 'Escape' && paletteOpen) {
        setPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [paletteOpen]);

  useEffect(() => {
    if (paletteOpen) {
      setPaletteQuery('');
      setPaletteIndex(0);
      setTimeout(() => paletteInputRef.current?.focus(), 50);
    }
  }, [paletteOpen]);

  // Floating Tooltip position for collapsed mode
  const [hoveredItem, setHoveredItem] = useState(null);

  // Connections list matching mockup
  const defaultConnections = [
    { id: 'twitch', label: 'Twitch', status: 'ok', tab: 'connections' },
    { id: 'kick', label: 'Kick', status: 'ok', tab: 'channels' },
    { id: 'donationalerts', label: 'DonationAlerts', status: 'ok', tab: 'donations' },
    { id: 'youtube', label: 'YouTube', status: 'ok', tab: 'music' },
    {
      id: 'obs',
      label: 'OBS Studio',
      status: obsState.isConnected ? 'ok' : 'warn',
      note: obsState.isConnected ? '' : 'пароль',
      tab: 'widgets',
    },
  ];
  const conns = connections || defaultConnections;

  // Handlers for quick modes
  const handleMiniMode = () => {
    try {
      WindowSetSize(380, 560);
      if (onClose) onClose();
    } catch {
      if (onClose) onClose();
    }
  };

  const handleGameMode = async () => {
    try {
      await ToggleGameMode();
    } catch (e) {
      console.warn('GameMode toggle error:', e);
    }
  };

  // Nav sections with full feature coverage
  const mainNavItems = [
    {
      id: 'home',
      label: 'Дашборд',
      icon: LayoutDashboard,
      action: () => onSelectTab('home'),
      badge: null,
      tooltip: 'Главный экран стрима',
    },
    {
      id: 'chat',
      label: 'Чат',
      icon: MessageSquare,
      action: () => onClose(),
      badge: null,
      tooltip: 'Вернуться в стрим-чат',
    },
  ];

  const functionsNavItems = [
    {
      id: 'music',
      label: 'Музыка',
      icon: Music,
      action: () => onSelectTab('music'),
      badge: queueCount > 0 ? String(queueCount) : null,
      tooltip: `Музыка · ${queueCount} в очереди`,
    },
    {
      id: 'widgets',
      label: 'Виджеты OBS',
      icon: Monitor,
      action: () => onSelectTab('widgets'),
      badge: null,
      tooltip: 'Браузерные оверлеи OBS Studio',
    },
    {
      id: 'tts',
      label: 'Озвучка TTS',
      icon: Volume2,
      action: () => onSelectTab('tts'),
      badge: null,
      tooltip: 'Синтез речи Yandex & Supertonic',
    },
    {
      id: 'donations',
      label: 'Донаты (DA)',
      icon: Coins,
      action: () => onSelectTab('donations'),
      badge: null,
      tooltip: 'DonationAlerts и цели сбора',
    },
    {
      id: 'channels',
      label: 'Каналы',
      icon: Radio,
      action: () => onSelectTab('channels'),
      badge: null,
      tooltip: 'Twitch и Kick мультичат',
    },
    {
      id: 'events',
      label: 'События',
      icon: Bell,
      action: () => onSelectTab('home'),
      badge: '12',
      tooltip: 'События · 12 новых',
    },
    {
      id: 'hotkeys',
      label: 'Хоткеи',
      icon: Keyboard,
      action: () => onSelectTab('appearance'),
      badge: null,
      tooltip: 'Горячие клавиши',
    },
    {
      id: 'polls',
      label: 'Голосования',
      icon: BarChart2,
      action: () => onSelectTab('functions'),
      badge: null,
      tooltip: 'Голосования и рулетки',
    },
  ];

  const settingsNavItems = [
    {
      id: 'appearance',
      label: 'Внешний вид',
      icon: Sliders,
      action: () => onSelectTab('appearance'),
      tooltip: 'Шрифты, размеры и значки',
    },
    {
      id: 'filters',
      label: 'Фильтры',
      icon: Filter,
      action: () => onSelectTab('filters'),
      tooltip: 'Игнор ботов и команд',
    },
    {
      id: 'proxy',
      label: 'Прокси и Сеть',
      icon: Globe,
      action: () => onSelectTab('proxy'),
      tooltip: 'HTTP, SOCKS5, WireGuard',
    },
  ];

  // Palette Actions list
  const paletteActions = useMemo(() => {
    const list = [
      {
        type: 'РАЗДЕЛ',
        title: 'Открыть «Музыка»',
        shortcut: 'Ctrl+3',
        run: () => onSelectTab('music'),
      },
      {
        type: 'РАЗДЕЛ',
        title: 'Открыть «Дашборд»',
        shortcut: 'Ctrl+1',
        run: () => onSelectTab('home'),
      },
      {
        type: 'РАЗДЕЛ',
        title: 'Открыть «Чат»',
        shortcut: 'Esc',
        run: () => onClose(),
      },
      {
        type: 'РАЗДЕЛ',
        title: 'Открыть «Виджеты OBS»',
        shortcut: '',
        run: () => onSelectTab('widgets'),
      },
      {
        type: 'РАЗДЕЛ',
        title: 'Открыть «Озвучка TTS»',
        shortcut: '',
        run: () => onSelectTab('tts'),
      },
      {
        type: 'РАЗДЕЛ',
        title: 'Открыть «Подключения»',
        shortcut: '',
        run: () => onSelectTab('connections'),
      },
      {
        type: 'РАЗДЕЛ',
        title: 'Открыть «Внешний вид»',
        shortcut: '',
        run: () => onSelectTab('appearance'),
      },
      {
        type: 'ДЕЙСТВИЕ',
        title: 'Пропустить трек',
        shortcut: 'Ctrl+→',
        run: () => MusicSkip().catch(() => {}),
      },
      {
        type: 'ДЕЙСТВИЕ',
        title: 'Управление плеером',
        shortcut: 'Ctrl+Space',
        run: () => onSelectTab('music'),
      },
      {
        type: 'ДЕЙСТВИЕ',
        title: 'Тест доната',
        shortcut: '',
        run: () => onSelectTab('donations'),
      },
      {
        type: 'РЕЖИМ',
        title: 'Мини-режим',
        shortcut: 'Ctrl+M',
        run: handleMiniMode,
      },
      {
        type: 'РЕЖИМ',
        title: 'Игровой режим',
        shortcut: 'Ctrl+Shift+G',
        run: handleGameMode,
      },
    ];

    if (!paletteQuery.trim()) return list;
    const q = paletteQuery.toLowerCase().trim();
    return list.filter(
      (item) => item.title.toLowerCase().includes(q) || item.type.toLowerCase().includes(q)
    );
  }, [paletteQuery, onSelectTab, onClose]);

  const executePalette = (index) => {
    const item = paletteActions[index];
    if (item) {
      item.run();
      setPaletteOpen(false);
    }
  };

  const username = twitchAuthStatus?.username || 'vanya_live';
  const isAuth = Boolean(twitchAuthStatus?.authenticated || twitchAuthStatus?.username);

  const renderNavButton = (item) => {
    const Icon = item.icon;
    const isSelected = activeTab === item.id;
    return (
      <div key={item.id} className="relative">
        <button
          type="button"
          onClick={item.action}
          onMouseEnter={(e) =>
            isCollapsed &&
            setHoveredItem({
              label: item.tooltip || item.label,
              top: e.currentTarget.getBoundingClientRect().top,
            })
          }
          onMouseLeave={() => setHoveredItem(null)}
          className={`relative flex items-center rounded-[10px] text-[13px] font-bold cursor-pointer transition-colors
            ${
              isCollapsed
                ? 'w-11 h-[36px] justify-center mx-auto'
                : 'w-full gap-3 px-3 h-[34px]'
            }
            ${
              isSelected
                ? 'bg-[#7CF2C8]/[0.12] text-[#7CF2C8]'
                : 'text-[#A0A4B4] hover:text-[#ECECF1] hover:bg-white/[0.06]'
            }`}
        >
          <Icon className="w-[18px] h-[18px] shrink-0" />
          {!isCollapsed && (
            <span className="flex-1 truncate text-left">{item.label}</span>
          )}

          {item.badge ? (
            isCollapsed ? (
              <span className="absolute right-2 top-2 w-2 h-2 rounded-full bg-[#7CF2C8]" />
            ) : (
              <span className="font-mono text-[10px] bg-[#1E212B] text-[#EDEEF2] px-1.5 py-0.5 rounded-[6px]">
                {item.badge}
              </span>
            )
          ) : null}
        </button>
      </div>
    );
  };

  return (
    <>
      <aside
        className={`h-full bg-[#12141A] border-r border-white/[0.06] flex flex-col shrink-0 select-none overflow-hidden transition-[width] duration-200
          font-['Manrope',sans-serif] ${isCollapsed ? 'w-[72px] px-2 py-3' : 'w-[260px] p-3'}`}
      >
        {/* Header: Brand & Collapse */}
        <div
          className={`shrink-0 flex items-center pb-2.5 ${
            isCollapsed ? 'justify-center my-1' : 'justify-between px-1'
          }`}
        >
          {!isCollapsed ? (
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-[4px] bg-[#7CF2C8] shrink-0" />
              <b className="font-bold text-[14px] text-[#ECECF1] leading-none">ReChat</b>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-amber-400/90 font-medium ml-1">
                1.1 α
              </span>
            </div>
          ) : (
            <span className="w-3 h-3 rounded-[4px] bg-[#7CF2C8] shrink-0 my-1" />
          )}

          <button
            type="button"
            onClick={toggle}
            title={isCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#6B7080] hover:text-[#ECECF1] hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Scrollable Container (Takes remaining height, scrolls smoothly to end) */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-1 pr-0.5 pb-4">
          {/* Stream Status Card */}
          {isCollapsed ? (
            <div
              className="flex justify-center py-2 cursor-pointer"
              title={isLive ? `В эфире ${uptime} · ${viewers} зрит.` : 'Эфир выключен'}
              onClick={() => onSelectTab('home')}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isLive ? 'bg-[#FF5FA2] animate-pulse' : 'bg-[#6B7080]'
                }`}
              />
            </div>
          ) : (
            <div
              onClick={() => onSelectTab('home')}
              className="p-[10px_12px] rounded-[12px] bg-[#15171E] border border-white/[0.06] cursor-pointer hover:border-white/10 transition-colors mb-2"
              title="Перейти на главную"
            >
              <div className="flex items-center gap-1.5 text-[10px] font-mono tracking-widest text-[#6B7080]">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isLive ? 'bg-[#FF5FA2] animate-pulse' : 'bg-[#6B7080]'
                  }`}
                />
                <span>{isLive ? 'В ЭФИРЕ' : 'ОФФЛАЙН'}</span>
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="font-mono text-[16px] font-bold text-[#ECECF1]">{uptime}</span>
                <span className="font-mono text-[12px] text-[#A0A4B4]">
                  {viewers > 0 ? viewers.toLocaleString('ru-RU') : '1 540'}
                </span>
              </div>
            </div>
          )}

          {/* Quick Switcher / Search (Ctrl+K) */}
          {isCollapsed ? (
            <div className="flex justify-center py-1">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                title="Быстрый поиск (Ctrl+K)"
                className="w-11 h-[34px] flex items-center justify-center rounded-[10px] text-[#A0A4B4] hover:text-[#ECECF1] hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="w-full flex items-center gap-2 h-[34px] px-3 mt-1 mb-2 rounded-[10px] border border-white/[0.08] text-[#6B7080] text-[13px] hover:text-[#ECECF1] hover:border-white/20 transition-all cursor-pointer text-left"
            >
              <Search className="w-4 h-4 shrink-0" />
              <span className="flex-1">Поиск</span>
              <span className="font-mono text-[10px] text-[#A0A4B4] bg-[#1E212B] rounded-[5px] px-1.5 py-0.5">
                Ctrl+K
              </span>
            </button>
          )}

          {/* Section: ГЛАВНОЕ */}
          {!isCollapsed && (
            <div className="px-3 pt-2.5 pb-1 text-[10px] font-mono font-medium uppercase tracking-[0.08em] text-[#6B7080]">
              ГЛАВНОЕ
            </div>
          )}
          <div className="flex flex-col gap-0.5">{mainNavItems.map(renderNavButton)}</div>

          {/* Divider in collapsed */}
          {isCollapsed && <div className="h-px w-7 mx-auto bg-white/[0.08] my-2" />}

          {/* Section: ФУНКЦИИ */}
          {!isCollapsed && (
            <div className="px-3 pt-3 pb-1 text-[10px] font-mono font-medium uppercase tracking-[0.08em] text-[#6B7080]">
              ФУНКЦИИ
            </div>
          )}
          <div className="flex flex-col gap-0.5">{functionsNavItems.map(renderNavButton)}</div>

          {/* Section: ПОДКЛЮЧЕНИЯ */}
          {!isCollapsed ? (
            <div className="pt-2">
              <div className="px-3 pt-2 pb-1 text-[10px] font-mono font-medium uppercase tracking-[0.08em] text-[#6B7080]">
                ПОДКЛЮЧЕНИЯ
              </div>
              <div className="flex flex-col gap-0.5">
                {conns.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelectTab(c.tab || 'connections')}
                    className="h-7 px-3 flex items-center gap-2.5 text-[13px] text-[#A0A4B4] rounded-[8px] hover:bg-white/[0.04] hover:text-[#ECECF1] transition-colors cursor-pointer text-left"
                  >
                    <span
                      className={`w-[7px] h-[7px] rounded-full shrink-0 ${
                        STATUS_COLOR[c.status] || STATUS_COLOR.off
                      }`}
                    />
                    <span className="flex-1 truncate">{c.label}</span>
                    {c.note && (
                      <span
                        className={`text-[11px] font-mono ${
                          c.status === 'warn' ? 'text-[#FFB84D]' : 'text-[#6B7080]'
                        }`}
                      >
                        {c.note}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="h-px w-7 bg-white/[0.08] my-1" />
              {conns.map((c) => (
                <span
                  key={c.id}
                  onClick={() => onSelectTab(c.tab || 'connections')}
                  title={`${c.label}${c.note ? ` · ${c.note}` : ''}`}
                  className={`w-2 h-2 rounded-full cursor-pointer hover:scale-125 transition-transform ${
                    STATUS_COLOR[c.status] || STATUS_COLOR.off
                  }`}
                />
              ))}
            </div>
          )}

          {/* Section: НАСТРОЙКИ */}
          {!isCollapsed && (
            <div className="pt-2">
              <div className="px-3 pt-2 pb-1 text-[10px] font-mono font-medium uppercase tracking-[0.08em] text-[#6B7080]">
                НАСТРОЙКИ
              </div>
              <div className="flex flex-col gap-0.5">{settingsNavItems.map(renderNavButton)}</div>
            </div>
          )}
        </div>

        {/* Footer: Profile Card & Mode Switchers (Fixed at bottom) */}
        <div className="shrink-0 pt-2 border-t border-white/[0.06] flex flex-col gap-1.5 bg-[#12141A]">
          {/* User profile card */}
          {!isCollapsed ? (
            <div
              onClick={() => onSelectTab('connections')}
              className="flex items-center gap-2.5 p-[6px_8px] rounded-[10px] hover:bg-white/[0.04] transition-colors cursor-pointer"
              title="Управление аккаунтом"
            >
              <span className="w-[30px] h-[30px] rounded-full bg-[#9146FF] shrink-0 flex items-center justify-center font-bold text-xs text-white uppercase shadow-sm">
                {username ? username.charAt(0) : 'V'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-[#EDEEF2] truncate">{username}</div>
                <div className="text-[11px] text-[#A0A4B4] truncate">
                  {isAuth ? 'Twitch · стример' : 'Twitch · не подключен'}
                </div>
              </div>
            </div>
          ) : (
            <div
              onClick={() => onSelectTab('connections')}
              className="flex justify-center py-1 cursor-pointer"
              title={`${username} (Twitch · стример)`}
            >
              <span className="w-[30px] h-[30px] rounded-full bg-[#9146FF] shrink-0 flex items-center justify-center font-bold text-xs text-white uppercase shadow-sm hover:scale-105 transition-transform">
                {username ? username.charAt(0) : 'V'}
              </span>
            </div>
          )}

          {/* Mode Switchers: Мини / Игровой */}
          {!isCollapsed && (
            <div className="flex gap-1.5 mt-0.5">
              <button
                type="button"
                onClick={handleMiniMode}
                title="Переключить в компактный мини-режим"
                className="flex-1 h-8 rounded-[8px] bg-[#1E212B] hover:bg-[#252834] active:bg-[#2D3140] text-[#EDEEF2] font-bold text-[12px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Minimize2 className="w-3.5 h-3.5 text-[#A0A4B4]" />
                Мини
              </button>
              <button
                type="button"
                onClick={handleGameMode}
                title="Включить прозрачный игровой оверлей поверх всех окон"
                className="flex-1 h-8 rounded-[8px] bg-[#1E212B] hover:bg-[#252834] active:bg-[#2D3140] text-[#EDEEF2] font-bold text-[12px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Gamepad2 className="w-3.5 h-3.5 text-[#A0A4B4]" />
                Игровой
              </button>
            </div>
          )}

          {statusMsg && !isCollapsed && (
            <div className="px-2 py-1 rounded bg-[#7CF2C8]/10 border border-[#7CF2C8]/20 text-[11px] font-medium text-[#7CF2C8] truncate text-center mt-0.5">
              {statusMsg}
            </div>
          )}
        </div>
      </aside>

      {/* Floating Tooltip in Collapsed Mode */}
      {isCollapsed && hoveredItem && (
        <div
          style={{ top: hoveredItem.top, left: 76 }}
          className="fixed z-50 pointer-events-none whitespace-nowrap px-2.5 py-1.5 rounded-[8px] bg-[#1E212B] border border-white/10 text-[12px] font-bold text-[#EDEEF2] shadow-xl animate-in fade-in zoom-in-95 duration-100"
        >
          {hoveredItem.label}
        </div>
      )}

      {/* Quick Switcher Command Palette Modal (Ctrl+K) */}
      {paletteOpen && (
        <div
          onClick={() => setPaletteOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[420px] bg-[#15171E] border border-white/10 rounded-[16px] overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 flex flex-col font-['Manrope',sans-serif]"
          >
            {/* Search Input bar */}
            <div className="flex items-center gap-2.5 h-[52px] px-4 border-b border-white/[0.06] text-[14px]">
              <span className="text-[#7CF2C8]">
                <Search className="w-[18px] h-[18px]" />
              </span>
              <input
                ref={paletteInputRef}
                type="text"
                value={paletteQuery}
                onChange={(e) => {
                  setPaletteQuery(e.target.value);
                  setPaletteIndex(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setPaletteIndex((prev) =>
                      prev < paletteActions.length - 1 ? prev + 1 : prev
                    );
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setPaletteIndex((prev) => (prev > 0 ? prev - 1 : prev));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    executePalette(paletteIndex);
                  }
                }}
                placeholder="Поиск действий, разделов, треков..."
                className="flex-1 bg-transparent border-0 text-[#EDEEF2] placeholder-[#6B7080] outline-none text-[14px]"
              />
              <button
                type="button"
                onClick={() => setPaletteOpen(false)}
                className="font-mono text-[10px] text-[#A0A4B4] bg-[#1E212B] rounded-[5px] px-1.5 py-0.5 hover:text-white"
              >
                Esc
              </button>
            </div>

            {/* Actions List */}
            <div className="p-2 max-h-[340px] overflow-y-auto custom-scrollbar flex flex-col gap-1">
              {paletteActions.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#6B7080]">Ничего не найдено</div>
              ) : (
                paletteActions.map((item, idx) => {
                  const isHovered = paletteIndex === idx;
                  return (
                    <div
                      key={item.title}
                      onClick={() => executePalette(idx)}
                      onMouseEnter={() => setPaletteIndex(idx)}
                      className={`flex items-center gap-2.5 h-10 px-3 rounded-[10px] text-[13px] cursor-pointer transition-colors ${
                        isHovered ? 'bg-[#1E212B] text-[#EDEEF2]' : 'text-[#A0A4B4]'
                      }`}
                    >
                      <span className="font-mono text-[10px] text-[#6B7080] tracking-wider w-[64px] shrink-0 uppercase">
                        {item.type}
                      </span>
                      <span className="flex-1 truncate font-medium text-[#EDEEF2]">
                        {item.title}
                      </span>
                      {item.shortcut && (
                        <span className="font-mono text-[10px] text-[#A0A4B4] bg-[#12141A] rounded-[5px] px-1.5 py-0.5">
                          {item.shortcut}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
