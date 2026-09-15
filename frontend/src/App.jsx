import React, { useState, useEffect, useRef } from 'react';
import { EventsOn } from '../wailsjs/runtime/runtime';
import {
  GetJoinedChannels,
  GetSettings,
  GetGlobalBadges,
  GetEmotes,
  ResizeWindowForSettings,
  SpeakText,
} from '../wailsjs/go/main/App';
import SettingsView from './components/SettingsView';
import CustomTitleBar from './components/CustomTitleBar';
import TwitchIcon from './components/TwitchIcon';
import TwitchBadge from './components/TwitchBadge';
import EmoteText from './components/EmoteText';
import InlineEventMessage from './components/InlineEventMessage';
import { getChannelColor, getTwitchIconColor } from './utils/channelColors';
import {
  Settings,
  Radio,
  EyeOff,
  RadioTower,
} from 'lucide-react';

// Helper filters for ignoring commands, users, and emotes
function isUserIgnored(user, ignoredUsers) {
  if (!user || !Array.isArray(ignoredUsers)) return false;
  const userLower = user.toLowerCase().trim();
  return ignoredUsers.some((u) => u && u.toLowerCase().trim() === userLower);
}

function isCommandMessage(text, prefixesStr) {
  if (!text) return false;
  const trimmed = text.trim();
  const prefixes = (prefixesStr || '!, /, ., $, ?')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  return prefixes.some((p) => trimmed.startsWith(p));
}

function isEmoteOnlyMessage(text, emoteMap, msgEmoteMap) {
  if (!text) return false;
  const words = text.trim().split(/\s+/);
  if (words.length === 0) return false;
  const allKnownEmotes = { ...(emoteMap || {}), ...(msgEmoteMap || {}) };
  return words.every((w) => !!allKnownEmotes[w]);
}

function stripEmotesForTTS(text, emoteMap, msgEmoteMap) {
  if (!text) return '';
  const words = text.trim().split(/\s+/);
  const allKnownEmotes = { ...(emoteMap || {}), ...(msgEmoteMap || {}) };
  const filtered = words.filter((w) => !allKnownEmotes[w]);
  return filtered.join(' ').trim();
}

export default function App() {
  const [activeView, setActiveView] = useState('chat'); // 'chat' or 'settings'

  const [joinedChannels, setJoinedChannels] = useState([]);
  const [mutedChannels, setMutedChannels] = useState(new Set());
  const [dynamicBadges, setDynamicBadges] = useState({});
  const [emoteMap, setEmoteMap] = useState({});
  const [messages, setMessages] = useState([]);
  const [autoScroll, setAutoScroll] = useState(true);

  const [settings, setSettings] = useState({
    defaultChannel: '',
    fontSize: 14,
    showTimestamps: true,
    timestampFormat: 'HH:MM:SS',
    showBadges: true,
    channelBadgeMode: 'name',
    iconColor: 'teal',
    maxMessages: 300,
    oauthToken: '',
    username: '',
    channelColors: {},
    ttsEnabled: false,
    ttsVolume: 1.0,
    ttsEngine: 'yandex',
    ttsVoice: 'shitova.us',
    ttsVoiceLocal: '',
    ignoreCommands: true,
    commandPrefixes: '!, /, ., $, ?',
    ignoreEmotesOnly: false,
    ttsFilterEmotes: true,
    ignoredUsers: ['Nightbot', 'StreamElements', 'Moobot', 'Fossabot'],
    hideIgnoredFromChat: false,
  });

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const ttsQueueRef = useRef([]);
  const ttsPlayingRef = useRef(false);
  const settingsRef = useRef(settings);

  // Keep settingsRef updated for closures
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Load initial settings, joined channels, & Twitch API global badges
  useEffect(() => {
    GetSettings()
      .then((loaded) => {
        if (loaded) {
          setSettings({
            ...loaded,
            channelColors: loaded.channelColors || {},
          });
        }
      })
      .catch((err) => console.error('Failed to load settings:', err));

    GetJoinedChannels()
      .then((chans) => {
        if (chans) setJoinedChannels(chans);
      })
      .catch((err) => console.error('Failed to fetch channels:', err));

    GetGlobalBadges()
      .then((badges) => {
        if (badges) setDynamicBadges(badges);
      })
      .catch((err) => console.error('Failed to fetch global badges:', err));
  }, []);

  // Automatically fetch 7TV, BTTV & FFZ channel emotes whenever joined channels update
  useEffect(() => {
    GetEmotes()
      .then((emotes) => {
        if (emotes) setEmoteMap(emotes);
      })
      .catch((err) => console.error('Failed to fetch emotes:', err));
  }, [joinedChannels]);

  // TTS queue processor — plays messages one at a time
  const processTTSQueue = async () => {
    if (ttsPlayingRef.current) return;
    ttsPlayingRef.current = true;
    while (ttsQueueRef.current.length > 0) {
      const text = ttsQueueRef.current.shift();
      try {
        const currentSettings = settingsRef.current;
        if (currentSettings.ttsEngine === 'local' && typeof window !== 'undefined' && window.speechSynthesis) {
          await new Promise((resolve) => {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.volume = currentSettings.ttsVolume !== undefined ? currentSettings.ttsVolume : 1.0;
            const voices = window.speechSynthesis.getVoices();
            const voice = voices.find((v) => v.name === currentSettings.ttsVoiceLocal);
            if (voice) {
              utterance.voice = voice;
            } else if (voices.length > 0) {
              utterance.voice = voices[0];
            }
            utterance.onend = resolve;
            utterance.onerror = resolve;
            window.speechSynthesis.speak(utterance);
          });
        } else {
          const dataUri = await SpeakText(text, currentSettings.ttsVoice || 'shitova.us');
          if (dataUri) {
            await new Promise((resolve) => {
              const audio = new Audio(dataUri);
              audio.volume = currentSettings.ttsVolume !== undefined ? currentSettings.ttsVolume : 1.0;
              audio.onended = resolve;
              audio.onerror = resolve;
              audio.play().catch(resolve);
            });
          }
        }
      } catch (err) {
        console.error('[TTS] Error:', err);
      }
    }
    ttsPlayingRef.current = false;
  };

  // Listen for Twitch chat messages and events
  useEffect(() => {
    const unoffMsg = EventsOn('chat:message', (msg) => {
      const s = settingsRef.current;
      const user = msg.displayName || msg.user || '';
      const text = msg.message || '';

      const isIgnored = isUserIgnored(user, s.ignoredUsers);
      const isCmd = !msg.isEvent && s.ignoreCommands && isCommandMessage(text, s.commandPrefixes);
      const isEmoteOnly = !msg.isEvent && s.ignoreEmotesOnly && isEmoteOnlyMessage(text, emoteMap, msg.emoteMap);

      // Add to messages buffer
      setMessages((prev) => {
        const next = [...prev, msg];
        const max = s.maxMessages || 300;
        if (next.length > max) return next.slice(next.length - max);
        return next;
      });

      // Queue for TTS
      const shouldSkipTTS = !s.ttsEnabled || isIgnored || isCmd || isEmoteOnly;
      if (!shouldSkipTTS) {
        let ttsText = '';
        if (msg.isEvent) {
          ttsText = msg.systemMsg || msg.message || '';
        } else if (text) {
          ttsText = s.ttsFilterEmotes ? stripEmotesForTTS(text, emoteMap, msg.emoteMap) : text;
        }

        if (ttsText) {
          ttsQueueRef.current.push(ttsText);
          processTTSQueue();
        }
      }
    });

    const unoffSettings = EventsOn('settings:updated', (updatedSettings) => {
      setSettings((prev) => ({
        ...prev,
        ...updatedSettings,
        channelColors: updatedSettings.channelColors || prev.channelColors || {},
      }));
    });

    const unoffAuth = EventsOn('auth:updated', (updatedAuthSettings) => {
      setSettings((prev) => ({ ...prev, ...updatedAuthSettings }));
    });

    const unoffChannels = EventsOn('channels:updated', (chans) => {
      setJoinedChannels(chans || []);
    });

    const unoffBadges = EventsOn('badges:loaded', (badgeMap) => {
      setDynamicBadges(badgeMap || {});
    });

    const unoffEmotes = EventsOn('emotes:loaded', (emotes) => {
      setEmoteMap(emotes || {});
    });

    return () => {
      if (typeof unoffMsg === 'function') unoffMsg();
      if (typeof unoffSettings === 'function') unoffSettings();
      if (typeof unoffAuth === 'function') unoffAuth();
      if (typeof unoffChannels === 'function') unoffChannels();
      if (typeof unoffBadges === 'function') unoffBadges();
      if (typeof unoffEmotes === 'function') unoffEmotes();
    };
  }, [settings.maxMessages]);

  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 60;
    setAutoScroll(isAtBottom);
  };

  const toggleMuteChannel = (channelName) => {
    if (!channelName) return;
    const lower = channelName.toLowerCase();
    setMutedChannels((prev) => {
      const next = new Set(prev);
      if (next.has(lower)) {
        next.delete(lower);
      } else {
        next.add(lower);
      }
      return next;
    });
  };

  const openSettings = () => {
    setActiveView('settings');
    if (typeof ResizeWindowForSettings === 'function') {
      ResizeWindowForSettings(true);
    }
  };

  const closeSettings = () => {
    setActiveView('chat');
    if (typeof ResizeWindowForSettings === 'function') {
      ResizeWindowForSettings(false);
    }
  };

  // Render Control Panel View when settings active
  if (activeView === 'settings') {
    return <SettingsView isStandaloneWindow={true} onClose={closeSettings} />;
  }

  // Get active icon fill color
  const globalIconColor = getTwitchIconColor(settings.iconColor || 'teal');

  // Filter messages and events
  const visibleMessages = messages.filter((msg) => {
    if (msg.channel && mutedChannels.has(msg.channel.toLowerCase())) return false;
    if (settings.hideIgnoredFromChat && !msg.isEvent) {
      const user = msg.displayName || msg.user || '';
      const text = msg.message || '';
      if (isUserIgnored(user, settings.ignoredUsers)) return false;
      if (settings.ignoreCommands && isCommandMessage(text, settings.commandPrefixes)) return false;
      if (settings.ignoreEmotesOnly && isEmoteOnlyMessage(text, emoteMap, msg.emoteMap)) return false;
    }
    return true;
  });

  return (
    <div
      className="flex flex-col h-screen w-full font-mono bg-[#0c0d12] text-[#f1f3f7] select-none overflow-hidden"
      style={{ fontSize: `${settings.fontSize || 14}px` }}
    >
      <CustomTitleBar title="ReChat — Twitch Chat Stream Monitor" />

      {/* Header Bar */}
      <header className="h-10 px-2.5 border-b border-white/[0.06] flex justify-between items-center bg-[#13151c] gap-2.5 shrink-0">
        {/* Stream Source Status */}
        <div className="flex items-center gap-1.5 font-sans font-semibold text-xs text-[#f1f3f7] pr-2.5 border-r border-white/[0.08] shrink-0 select-none">
          <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></span>
          <span className="font-mono text-[11px] text-[#8c93a4]">IRC:LIVE</span>
        </div>

        {/* Scrollable Joined Channels List */}
        <div className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 min-w-0">
          {joinedChannels.length === 0 ? (
            <span className="text-[11px] text-[#8c93a4] font-sans italic flex items-center gap-1.5 shrink-0">
              <Radio className="w-3 h-3 text-[#4e5564] animate-pulse" />
              <span>No channels connected — configure in settings</span>
            </span>
          ) : (
            joinedChannels.map((ch) => {
              const lower = ch.toLowerCase();
              const isOwn = settings.username && lower === settings.username.toLowerCase();
              const isMuted = mutedChannels.has(lower);
              const chTheme = getChannelColor(ch, settings.channelColors, isOwn);
              const iconFill = isMuted ? '#6b7280' : getTwitchIconColor(settings.iconColor, chTheme.accent);

              return (
                <button
                  key={ch}
                  type="button"
                  onClick={() => toggleMuteChannel(ch)}
                  title={isMuted ? `Click to show #${ch} chat` : `Click to hide #${ch} chat`}
                  style={
                    !isMuted
                      ? {
                          backgroundColor: chTheme.bg,
                          borderColor: chTheme.border,
                          color: chTheme.text,
                        }
                      : {}
                  }
                  className={`px-2 py-0.5 rounded border text-[11px] font-mono font-medium flex items-center gap-1.5 shrink-0 cursor-pointer transition-all ${
                    isMuted
                      ? 'bg-white/[0.02] border-white/[0.06] text-[#4e5564] opacity-50 hover:opacity-80 line-through'
                      : isOwn
                      ? 'border-emerald-500/40 text-emerald-300 hover:border-emerald-500/70'
                      : 'hover:border-white/[0.2]'
                  }`}
                >
                  {isMuted ? (
                    <EyeOff className="w-2.5 h-2.5 text-[#4e5564]" />
                  ) : (
                    <TwitchIcon className="w-2.5 h-2.5" fill={iconFill} />
                  )}
                  <span>#{ch}</span>
                  {isOwn && (
                    <span className="text-[9px] px-1 py-0.2 bg-emerald-950/80 border border-emerald-800/60 rounded text-emerald-400 font-bold uppercase tracking-wider">
                      host
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Header Right Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={openSettings}
            title="Open Control Panel (Settings)"
            className="p-1 bg-white/[0.04] border border-white/[0.08] text-[#8c93a4] hover:text-[#f1f3f7] hover:bg-white/[0.08] active:bg-white/[0.12] rounded transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Unified Message & Event Stream */}
      <main
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-2.5 space-y-1 bg-[#0c0d12] custom-scrollbar"
      >
        {visibleMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[#525866] font-sans text-xs gap-2 select-none py-8">
            <div className="p-3 rounded-full bg-white/[0.02] border border-white/[0.05]">
              <TwitchIcon className="w-6 h-6 opacity-30" fill={globalIconColor} />
            </div>
            <span>
              {joinedChannels.length === 0
                ? 'No active channels. Press (⚙) to join a channel.'
                : mutedChannels.size === joinedChannels.length
                ? 'All connected channels are currently muted.'
                : `Listening to ${joinedChannels.map((c) => '#' + c).join(', ')}...`}
            </span>
          </div>
        ) : (
          visibleMessages.map((msg, index) => {
            // If message is a Twitch event (Sub, Raid, Cheer, Announcement, Mod, Reward, etc.)
            if (msg.isEvent) {
              return (
                <InlineEventMessage
                  key={msg.id || `evt-${index}`}
                  msg={msg}
                  emoteMap={emoteMap}
                  dynamicBadges={dynamicBadges}
                  settings={settings}
                />
              );
            }

            // Normal chat message
            const isOwn =
              settings.username &&
              msg.channel &&
              msg.channel.toLowerCase() === settings.username.toLowerCase();
            const chTheme = getChannelColor(msg.channel, settings.channelColors, isOwn);
            const iconFill = getTwitchIconColor(settings.iconColor, chTheme.accent);
            const isAccentLine = settings.channelBadgeMode === 'accent_line';

            return (
              <div
                key={msg.id || index}
                style={isAccentLine && !isOwn ? { borderLeftColor: chTheme.accent, borderLeftWidth: '2px' } : {}}
                className={`flex items-baseline flex-wrap leading-snug px-1.5 py-0.5 rounded hover:bg-white/[0.03] transition-colors gap-x-1.5 ${
                  isAccentLine && !isOwn ? 'pl-2 bg-white/[0.01]' : ''
                }`}
              >
                {/* Channel Badge */}
                {msg.channel && (
                  <>
                    {settings.channelBadgeMode === 'icon_only' ? (
                      <span
                        title={`Channel: #${msg.channel}`}
                        style={{
                          backgroundColor: chTheme.bg,
                          borderColor: chTheme.border,
                        }}
                        className={`px-1 py-0.5 border rounded text-[10px] font-mono flex items-center justify-center self-center cursor-pointer hover:opacity-90 transition-opacity ${
                          isOwn ? 'border-emerald-500/40' : ''
                        }`}
                      >
                        <TwitchIcon className="w-2.5 h-2.5" fill={iconFill} />
                      </span>
                    ) : settings.channelBadgeMode === 'icon_bg' ? (
                      <span
                        title={`Channel: #${msg.channel}`}
                        style={{
                          backgroundColor: chTheme.bg,
                          borderColor: chTheme.border,
                          color: chTheme.text,
                        }}
                        className={`px-1.5 py-0.2 border rounded text-[10px] font-mono font-medium flex items-center gap-1 self-center cursor-pointer ${
                          isOwn ? 'border-emerald-500/40' : ''
                        }`}
                      >
                        <TwitchIcon className="w-2 h-2" fill={iconFill} />
                        <span>#{msg.channel}</span>
                      </span>
                    ) : settings.channelBadgeMode === 'accent_line' ? (
                      <span style={{ color: chTheme.text }} className="text-[10px] font-mono font-semibold self-center opacity-80">
                        #{msg.channel}
                      </span>
                    ) : (
                      <span
                        title={`Channel: #${msg.channel}`}
                        style={{
                          backgroundColor: chTheme.bg,
                          borderColor: chTheme.border,
                          color: chTheme.text,
                        }}
                        className={`px-1.5 py-0.2 border rounded text-[10px] font-mono font-medium self-center cursor-pointer ${
                          isOwn ? 'border-emerald-500/40' : ''
                        }`}
                      >
                        #{msg.channel}
                      </span>
                    )}
                  </>
                )}

                {/* Timestamp */}
                {settings.showTimestamps && msg.timestamp && (
                  <span className="text-[#525866] text-[11px] font-mono select-none self-center">
                    [{settings.timestampFormat === 'HH:MM' ? msg.timestamp.slice(0, 5) : msg.timestamp}]
                  </span>
                )}

                {/* Badges */}
                {settings.showBadges && msg.badges && (
                  <TwitchBadge badgeTag={msg.badges} dynamicBadges={dynamicBadges} />
                )}

                {/* Username */}
                <span
                  className="font-bold text-xs font-sans truncate self-baseline"
                  style={{ color: msg.color || '#10b981' }}
                >
                  {msg.displayName || msg.user || 'Anonymous'}:
                </span>

                {/* Message text with emotes */}
                <span className="text-[#f1f3f7] font-sans break-words min-w-0">
                  <EmoteText
                    text={msg.message}
                    emoteMap={emoteMap}
                    twitchEmoteMap={msg.emoteMap}
                  />
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Footer Status Bar */}
      <footer className="h-6 px-3 border-t border-white/[0.06] bg-[#12141a] flex items-center justify-between text-[11px] font-mono text-[#525866] shrink-0 select-none">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="text-[#8c93a4]">CHANNELS:</span>
            <span className="text-[#f1f3f7]">{joinedChannels.length - mutedChannels.size}/{joinedChannels.length}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="text-[#8c93a4]">MESSAGES:</span>
            <span className="text-[#f1f3f7]">{messages.length}</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          {settings.ttsEnabled && (
            <span className="text-emerald-400 flex items-center gap-1 text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              TTS ACTIVE
            </span>
          )}
          <span>RC-01 // TWITCH IRC</span>
        </div>
      </footer>
    </div>
  );
}
