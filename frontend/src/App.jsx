import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EventsOn } from '../wailsjs/runtime/runtime';
import {
  GetJoinedChannels,
  GetJoinedKickChannels,
  JoinKickChannel,
  GetSettings,
  GetGlobalBadges,
  GetEmotes,
  ResizeWindowForSettings,
  SpeakText,
  SpeakSupertonic,
  UpdateTTSStatus,
  JoinChannel,
  SendMessage,
  ToggleGameMode,
  IsGameMode,
  GetCurrentGoal,
} from '../wailsjs/go/main/App';
import SettingsView from './components/SettingsView';
import CustomTitleBar from './components/CustomTitleBar';
import ChannelBar from './components/ChannelBar';
import GoalTrackerBar from './components/GoalTrackerBar';
import ChatMessage from './components/ChatMessage';
import InlineEventMessage from './components/InlineEventMessage';
import NewMessagesBanner from './components/NewMessagesBanner';
import TwitchIcon from './components/TwitchIcon';
import { getTwitchIconColor } from './utils/channelColors';
import { Radio, Plus, Settings, Send, LogIn, ChevronDown, Smile, X, Volume2, Loader2, Sparkles } from 'lucide-react';

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

function isMessageEligibleForTTS(msg, s, mutedChannelsSet) {
  // 1. Channel muted/disabled in top panel
  if (msg.channel && mutedChannelsSet && mutedChannelsSet.has(msg.channel.toLowerCase())) {
    return false;
  }

  // DonationAlerts donations have their own TTS toggle and minimum threshold
  if (msg.eventType === 'donation') {
    if (s.daTTS === false) return false;
    const amount = parseFloat(msg.eventData?.amount || 0);
    if (amount < (s.daMinTTSAmount || 0)) return false;
    return true;
  }

  // Never voice rewards (channel points redemptions) or system events (follows, subs, raids, cheers, etc.)
  if (
    msg.isEvent ||
    msg.eventType === 'reward' ||
    msg.eventType === 'channel.channel_points_custom_reward_redemption.add' ||
    msg.eventType === 'follow' ||
    msg.eventType === 'channel.follow' ||
    msg.eventType === 'sub' ||
    msg.eventType === 'resub' ||
    msg.eventType === 'subgift' ||
    msg.eventType === 'raid' ||
    msg.eventType === 'cheer' ||
    msg.eventType === 'intro'
  ) {
    return false;
  }

  // Never voice music commands or music queue notifications (track addition announcements)
  const msgText = (msg.message || '').trim();
  const isMusicOrderCmd = /^!(?:заказ|sr|songrequest|song|музыка|трек|music)(\s|$)/i.test(msgText);
  const isMusicQueueReply = /(?:добавлен в очередь|отправлен на модерацию|заказ не принят|играет прямо сейчас)/i.test(msgText);
  if (isMusicOrderCmd || isMusicQueueReply) {
    return false;
  }

  // Mentions / Replies skipping if ttsSkipMentions is enabled
  const isReply = Boolean(
    (msg.eventData && msg.eventData['reply-parent-msg-id']) ||
    (msg.message && msg.message.trim().startsWith('@'))
  );
  const hasMention = Boolean(msg.message && /@[\p{L}\p{N}_]+/u.test(msg.message));

  if (s.ttsSkipMentions && (isReply || hasMention)) {
    return false;
  }

  if (s.ttsAllMessages !== false) {
    return true;
  }

  const badges = msg.badges || '';
  const isSub = badges.includes('subscriber');
  const isVip = badges.includes('vip');
  const isMod = badges.includes('moderator') || badges.includes('broadcaster');
  const isHighlighted = Boolean(
    (msg.eventData && msg.eventData['msg-id'] === 'highlighted-message') ||
    msg.isHighlighted ||
    msg.eventType === 'highlighted'
  );

  if (s.ttsRepliesOnly && isReply) return true;
  if (s.ttsHighlightedOnly && isHighlighted) return true;
  if (s.ttsSubscribersOnly && isSub) return true;
  if (s.ttsVipOnly && isVip) return true;
  if (s.ttsModOnly && isMod) return true;

  return false;
}

class SettingsErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('Settings view error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-[#181920] text-[#ECECF1] p-6 space-y-4">
          <div className="p-5 bg-[#242631] border border-rose-500/30 rounded-2xl max-w-md w-full text-center space-y-3 shadow-xl">
            <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto text-lg font-bold">!</div>
            <h3 className="text-sm font-bold text-[#ECECF1]">Не удалось загрузить раздел настроек</h3>
            <p className="text-xs text-[#8E92A4] font-mono break-words bg-[#181920] p-2.5 rounded-xl text-left border border-white/[0.04]">
              {this.state.error?.message || 'Неизвестная ошибка'}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                if (this.props.onClose) this.props.onClose();
              }}
              className="px-4 py-2 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl text-xs font-semibold cursor-pointer transition-all shadow-md"
            >
              Вернуться в чат
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Clean and prepare message content for TTS speech
function formatTextForTTS(msg, s, emoteMap) {
  // Only voice user chat messages, never system notifications
  let rawText = msg.message || '';
  if (!rawText) return '';

  let text = rawText;

  // 1. URLs / Links (if ttsIncludeLinks is false)
  if (!s.ttsIncludeLinks) {
    text = text.replace(/https?:\/\/\S+|www\.\S+/gi, '');
  }

  // 2. Mentions (if ttsIncludeMentions is false)
  if (!s.ttsIncludeMentions) {
    text = text.replace(/@[\p{L}\p{N}_]+[,:]?\s*/gu, '');
    text = text.replace(/^[,:\s-]+/, '');
  }

  // 3. Emotes (if ttsIncludeEmotes is false OR s.ttsFilterEmotes is true)
  if (!s.ttsIncludeEmotes || s.ttsFilterEmotes) {
    text = stripEmotesForTTS(text, emoteMap, msg.emoteMap);
  }

  // 4. Unicode Emoji (if ttsIncludeEmoji is false)
  if (!s.ttsIncludeEmoji) {
    text = text.replace(/[\p{Extended_Pictographic}\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
  }

  // 5. Remove blacklisted words or symbols (ttsRemoveWords)
  if (s.ttsRemoveWords && typeof s.ttsRemoveWords === 'string') {
    const removeList = s.ttsRemoveWords
      .split(/[\n,]+/)
      .map((w) => w.trim())
      .filter(Boolean);
    for (const token of removeList) {
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      text = text.replace(new RegExp(escaped, 'gi'), '');
    }
  }

  text = text.replace(/\s+/g, ' ').trim();
  if (!text) return '';

  // 6. Include author username (if ttsIncludeUsername is true)
  if (msg.eventType === 'donation') {
    const author = msg.displayName || msg.user || 'Донатер';
    const formattedAmount = msg.eventData?.formattedAmount || '';
    const donText = text ? `: ${text}` : '';
    return `Донат ${formattedAmount} от ${author}${donText}`;
  }

  if (s.ttsIncludeUsername) {
    const author = msg.displayName || msg.user || '';
    if (author) {
      if (msg.eventType === 'reward' || msg.eventType === 'channel.channel_points_custom_reward_redemption.add') {
        return `Заказ за баллы от ${author}: ${text}`;
      }
      return `${author} говорит: ${text}`;
    }
  }

  return text;
}

export default function App() {
  const [activeView, setActiveView] = useState('chat'); // 'chat' or 'settings'

  const [joinedChannels, setJoinedChannels] = useState([]);
  const [joinedKickChannels, setJoinedKickChannels] = useState([]);
  const [mutedChannels, setMutedChannels] = useState(new Set());
  const [dynamicBadges, setDynamicBadges] = useState({});
  const [emoteMap, setEmoteMap] = useState({});
  const [messages, setMessages] = useState([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isTTSActive, setIsTTSActive] = useState(false);
  const [isGameMode, setIsGameMode] = useState(false);
  const [currentGoal, setCurrentGoal] = useState(null);
  const [hideGoalBar, setHideGoalBar] = useState(false);
  const [isChatHovered, setIsChatHovered] = useState(false);
  const [showEmotePicker, setShowEmotePicker] = useState(false);
  const [emoteSearch, setEmoteSearch] = useState('');

  useEffect(() => {
    if (isGameMode) {
      document.body.classList.add('game-mode');
      document.documentElement.classList.add('game-mode');
      document.documentElement.style.background = 'transparent';
    } else {
      document.body.classList.remove('game-mode');
      document.documentElement.classList.remove('game-mode');
      document.documentElement.style.background = '';
    }
  }, [isGameMode]);
  const [showGameModeHint, setShowGameModeHint] = useState(false);

  const [settings, setSettings] = useState({
    defaultChannel: '',
    fontSize: 14,
    showTimestamps: true,
    timestampFormat: 'HH:MM:SS',
    showBadges: true,
    showFollows: true,
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
    ttsSpeed: 1.0,
    ttsAudioDevice: '',
    ttsSkipHotkey: 'Escape',
    ttsAllMessages: true,
    ttsRepliesOnly: false,
    ttsHighlightedOnly: false,
    ttsSubscribersOnly: false,
    ttsVipOnly: false,
    ttsModOnly: false,
    ttsIncludeUsername: false,
    ttsIncludeLinks: false,
    ttsIncludeEmotes: false,
    ttsIncludeEmoji: false,
    ttsIncludeMentions: true,
    ttsSkipMentions: false,
    ttsRemoveWords: '',
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
  const currentAudioRef = useRef(null);
  const currentUtteranceResolveRef = useRef(null);
  const [currentTTSItem, setCurrentTTSItem] = useState(null);
  const currentTTSItemRef = useRef(null);
  const ttsGenerationIdRef = useRef(0);
  const mutedChannelsRef = useRef(mutedChannels);
  const settingsRef = useRef(settings);
  const autoScrollRef = useRef(autoScroll);

  const [chatInput, setChatInput] = useState('');
  const [activeSendChannel, setActiveSendChannel] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [msgHistory, setMsgHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const chatInputRef = useRef(null);

  useEffect(() => {
    if (joinedChannels.length > 0 && (!activeSendChannel || !joinedChannels.includes(activeSendChannel))) {
      setActiveSendChannel(joinedChannels[0]);
    }
  }, [joinedChannels, activeSendChannel]);

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    const text = chatInput.trim();
    if (!text || isSending) return;

    if (!settings.oauthToken || !settings.username) {
      setSendError('Войдите через Twitch в настройках для отправки сообщений');
      setTimeout(() => setSendError(''), 3500);
      return;
    }

    const targetChan = activeSendChannel || joinedChannels[0];
    if (!targetChan) {
      setSendError('Сначала подключите канал в настройках');
      setTimeout(() => setSendError(''), 3000);
      return;
    }

    setIsSending(true);
    setSendError('');
    try {
      await SendMessage(targetChan, text);
      setMsgHistory((prev) => [text, ...prev.slice(0, 49)]);
      setHistoryIndex(-1);
      setChatInput('');
      scrollToBottom();
    } catch (err) {
      console.error('Failed to send message:', err);
      setSendError(String(err));
      setTimeout(() => setSendError(''), 4000);
    } finally {
      setIsSending(false);
    }
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      if (msgHistory.length > 0 && historyIndex < msgHistory.length - 1) {
        e.preventDefault();
        const nextIdx = historyIndex + 1;
        setHistoryIndex(nextIdx);
        setChatInput(msgHistory[nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      if (historyIndex > 0) {
        e.preventDefault();
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setChatInput(msgHistory[nextIdx]);
      } else if (historyIndex === 0) {
        e.preventDefault();
        setHistoryIndex(-1);
        setChatInput('');
      }
    }
  };

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    mutedChannelsRef.current = mutedChannels;
  }, [mutedChannels]);

  useEffect(() => {
    autoScrollRef.current = autoScroll;
  }, [autoScroll]);

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

    GetJoinedKickChannels()
      .then((kchans) => {
        if (kchans) setJoinedKickChannels(kchans);
      })
      .catch((err) => console.error('Failed to fetch Kick channels:', err));

    GetGlobalBadges()
      .then((badges) => {
        if (badges) setDynamicBadges(badges);
      })
      .catch((err) => console.error('Failed to fetch global badges:', err));

    GetCurrentGoal()
      .then((g) => {
        if (g && g.title) setCurrentGoal(g);
      })
      .catch((err) => console.error('Failed to fetch initial goal:', err));
  }, []);

  // Automatically fetch 7TV, BTTV & FFZ channel emotes whenever joined channels update
  useEffect(() => {
    GetEmotes()
      .then((emotes) => {
        if (emotes) setEmoteMap(emotes);
      })
      .catch((err) => console.error('Failed to fetch emotes:', err));
  }, [joinedChannels, joinedKickChannels]);

  // TTS queue processor — plays messages one at a time with real-time status updates
  const processTTSQueue = async () => {
    if (ttsPlayingRef.current) return;
    if (!settingsRef.current.ttsEnabled) return;
    ttsPlayingRef.current = true;
    setIsTTSActive(true);

    while (ttsQueueRef.current.length > 0) {
      if (!settingsRef.current.ttsEnabled) {
        ttsQueueRef.current = [];
        break;
      }

      const item = ttsQueueRef.current.shift();
      if (!item) continue;

      const itemChannel = (item.msg?.channel || '').toLowerCase();
      if (itemChannel && mutedChannelsRef.current.has(itemChannel)) {
        continue;
      }

      const text = typeof item === 'object' && item !== null ? item.text : String(item);
      const author = typeof item === 'object' && item !== null ? item.author : 'Зритель';
      const currentSettings = settingsRef.current;
      const engine = currentSettings.ttsEngine || 'supertonic';
      const voice = currentSettings.ttsVoice || (engine === 'supertonic' ? 'M1' : 'shitova.us');

      const genId = ++ttsGenerationIdRef.current;

      try {
        const playbackRate = Math.min(Math.max(Number(currentSettings.ttsSpeed) || 1.0, 0.5), 2.5);

        // 1. Notify status: Generating
        const generatingInfo = { state: 'generating', author, text, engine, voice, channel: itemChannel };
        currentTTSItemRef.current = generatingInfo;
        setCurrentTTSItem(generatingInfo);
        UpdateTTSStatus('generating', author, text, voice, engine, 0).catch(() => {});

        if (
          engine === 'local' &&
          typeof window !== 'undefined' &&
          window.speechSynthesis
        ) {
          if (ttsGenerationIdRef.current !== genId || !settingsRef.current.ttsEnabled) break;
          await new Promise((resolve) => {
            currentUtteranceResolveRef.current = resolve;
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = playbackRate;
            utterance.volume =
              currentSettings.ttsVolume !== undefined
                ? currentSettings.ttsVolume
                : 1.0;
            const voices = window.speechSynthesis.getVoices();
            const voiceObj = voices.find(
              (v) => v.name === currentSettings.ttsVoiceLocal
            );
            if (voiceObj) {
              utterance.voice = voiceObj;
            } else if (voices.length > 0) {
              utterance.voice = voices[0];
            }
            const onFinish = () => {
              currentUtteranceResolveRef.current = null;
              resolve();
            };
            utterance.onstart = () => {
              if (ttsGenerationIdRef.current !== genId || !settingsRef.current.ttsEnabled) {
                window.speechSynthesis.cancel();
                onFinish();
                return;
              }
              const playingInfo = { state: 'playing', author, text, engine, voice, channel: itemChannel };
              currentTTSItemRef.current = playingInfo;
              setCurrentTTSItem(playingInfo);
              UpdateTTSStatus('playing', author, text, voice, engine, 0).catch(() => {});
            };
            utterance.onend = onFinish;
            utterance.onerror = onFinish;
            window.speechSynthesis.speak(utterance);
          });
        } else {
          let dataUri = '';
          if (engine === 'supertonic') {
            dataUri = await SpeakSupertonic(text, voice);
          } else {
            dataUri = await SpeakText(text, voice);
          }

          // Abort if stopped, disabled or muted while synthesis was running
          if (ttsGenerationIdRef.current !== genId || !settingsRef.current.ttsEnabled) {
            break;
          }
          if (itemChannel && mutedChannelsRef.current.has(itemChannel)) {
            continue;
          }

          if (dataUri) {
            await new Promise((resolve) => {
              const audio = new Audio(dataUri);
              currentAudioRef.current = audio;
              currentUtteranceResolveRef.current = resolve;
              audio.playbackRate = playbackRate;
              audio.volume =
                currentSettings.ttsVolume !== undefined
                  ? currentSettings.ttsVolume
                  : 1.0;

              // Apply custom audio output device if set and supported
              if (
                currentSettings.ttsAudioDevice &&
                typeof audio.setSinkId === 'function'
              ) {
                audio
                  .setSinkId(currentSettings.ttsAudioDevice)
                  .catch((err) => console.warn('[TTS] setSinkId error:', err));
              }

              const onFinish = () => {
                if (currentAudioRef.current === audio) {
                  currentAudioRef.current = null;
                }
                currentUtteranceResolveRef.current = null;
                resolve();
              };

              audio.onplay = () => {
                if (ttsGenerationIdRef.current !== genId || !settingsRef.current.ttsEnabled) {
                  audio.pause();
                  audio.src = '';
                  onFinish();
                  return;
                }
                const duration = audio.duration || 0;
                const playingInfo = { state: 'playing', author, text, engine, voice, channel: itemChannel };
                currentTTSItemRef.current = playingInfo;
                setCurrentTTSItem(playingInfo);
                UpdateTTSStatus('playing', author, text, voice, engine, duration).catch(() => {});
              };

              audio.onended = onFinish;
              audio.onerror = onFinish;
              audio.play().catch(onFinish);
            });
          }
        }
      } catch (err) {
        console.error('[TTS] Error:', err);
      } finally {
        currentTTSItemRef.current = null;
        setCurrentTTSItem(null);
        UpdateTTSStatus('idle', '', '', '', '', 0).catch(() => {});
      }
    }

    ttsPlayingRef.current = false;
    setIsTTSActive(false);
    currentTTSItemRef.current = null;
    setCurrentTTSItem(null);
  };

  const handleSkipCurrentTTS = () => {
    ttsGenerationIdRef.current += 1;
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.src = '';
        currentAudioRef.current.currentTime = 0;
      } catch (_) {}
      currentAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (currentUtteranceResolveRef.current) {
      currentUtteranceResolveRef.current();
      currentUtteranceResolveRef.current = null;
    }
    currentTTSItemRef.current = null;
    setCurrentTTSItem(null);
    UpdateTTSStatus('idle', '', '', '', '', 0).catch(() => {});
  };

  const handleStopTTS = () => {
    ttsGenerationIdRef.current += 1;
    ttsQueueRef.current = [];
    handleSkipCurrentTTS();
    ttsPlayingRef.current = false;
    setIsTTSActive(false);
    currentTTSItemRef.current = null;
    setCurrentTTSItem(null);
  };

  const handleToggleTTS = async () => {
    const nextVal = !settings.ttsEnabled;
    if (!nextVal) {
      handleStopTTS();
    }
    const updated = { ...settings, ttsEnabled: nextVal };
    setSettings(updated);
    settingsRef.current = updated;
    try {
      await SaveSettings(updated);
    } catch (err) {
      console.error('Failed to save TTS toggle:', err);
    }
  };

  // Keyboard shortcut listener for Game Mode toggle and skipping current TTS
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Toggle Game Mode via keyboard shortcut (works in Russian / any keyboard layout via e.code)
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.code === 'KeyG' || e.key.toLowerCase() === 'g' || e.code === 'KeyO' || e.key.toLowerCase() === 'o')
      ) {
        e.preventDefault();
        handleToggleGameMode();
        return;
      }

      const hotkey = (settings.ttsSkipHotkey || 'Escape').trim().toLowerCase();
      let isMatch = false;

      if (hotkey === 'escape' && (e.key === 'Escape' || e.code === 'Escape')) {
        isMatch = true;
      } else if (hotkey === 'f8' && (e.key === 'F8' || e.code === 'F8')) {
        isMatch = true;
      } else if (hotkey === 'ctrl+shift+s') {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.code === 'KeyS' || e.key.toLowerCase() === 's')) isMatch = true;
      } else if (e.key.toLowerCase() === hotkey) {
        isMatch = true;
      }

      if (isMatch && isTTSActive) {
        e.preventDefault();
        handleSkipCurrentTTS();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settings.ttsSkipHotkey, isTTSActive]);

  // Game Mode (Overlay) state sync and global events
  useEffect(() => {
    IsGameMode()
      .then((active) => {
        setIsGameMode(Boolean(active));
      })
      .catch(() => {});

    const unsub = EventsOn('gamemode:changed', (enabled) => {
      const active = Boolean(enabled);
      setIsGameMode(active);
      if (active) {
        setShowGameModeHint(true);
        setTimeout(() => setShowGameModeHint(false), 4000);
      }
    });

    const unsubSkip = EventsOn('tts:skip', () => {
      handleSkipCurrentTTS();
    });

    return () => {
      if (typeof unsub === 'function') unsub();
      if (typeof unsubSkip === 'function') unsubSkip();
    };
  }, []);

  const handleToggleGameMode = async () => {
    try {
      const active = await ToggleGameMode();
      setIsGameMode(Boolean(active));
      if (active) {
        setShowGameModeHint(true);
        setTimeout(() => setShowGameModeHint(false), 4000);
      }
    } catch (err) {
      console.error('Failed to toggle game mode:', err);
    }
  };

  // Listen for realtime chat events from Go backend
  useEffect(() => {
    const unoffMsg = EventsOn('chat:message', (msg) => {
      const s = settingsRef.current;
      const user = msg.displayName || msg.user || '';
      const text = msg.message || '';

      const isIgnored = isUserIgnored(user, s.ignoredUsers);
      const isCmd = s.ignoreCommands && isCommandMessage(text, s.commandPrefixes);
      const isEmoteOnly =
        s.ignoreEmotesOnly && isEmoteOnlyMessage(text, emoteMap, msg.emoteMap);

      if (s.hideIgnoredFromChat && !msg.isEvent) {
        if (isIgnored || isCmd || isEmoteOnly) return;
      }

      setMessages((prev) => {
        // Prevent duplicate messages by ID
        if (msg.id && prev.some((m) => m.id === msg.id)) {
          return prev;
        }

        // Deduplicate channel points rewards that may arrive from both IRC and EventSub
        if (msg.eventType === 'reward') {
          const rewardId = msg.eventData?.rewardId;
          const userLower = (msg.user || msg.displayName || '').toLowerCase();
          const textTrimmed = (msg.message || '').trim().toLowerCase();
          const sliceOffset = Math.max(0, prev.length - 20);
          const dupRelIdx = prev.slice(-20).findIndex((m) => {
            if (m.eventType !== 'reward') return false;
            if (m.id && msg.id && m.id === msg.id) return true;
            const mUser = (m.user || m.displayName || '').toLowerCase();
            const mText = (m.message || '').trim().toLowerCase();
            if (mUser === userLower) {
              if (rewardId && m.eventData?.rewardId === rewardId) return true;
              if (textTrimmed && mText === textTrimmed) return true;
            }
            return false;
          });

          if (dupRelIdx !== -1) {
            const actualIdx = sliceOffset + dupRelIdx;
            const existing = prev[actualIdx];
            // If new message has rich EventSub info (rewardCost/rewardTitle) and existing doesn't, upgrade it
            if ((msg.eventData?.rewardCost || msg.eventData?.rewardTitle) && !existing.eventData?.rewardCost) {
              const copy = [...prev];
              copy[actualIdx] = { ...existing, ...msg };
              return copy;
            }
            return prev;
          }
        }

        const updated = [...prev, msg];
        if (updated.length > s.maxMessages) {
          return updated.slice(updated.length - s.maxMessages);
        }
        return updated;
      });

      if (!autoScrollRef.current) {
        setUnreadCount((c) => c + 1);
      }

      // Play soft mention chime if user is directly mentioned in chat
      if (s.username && text.toLowerCase().includes(`@${s.username.toLowerCase()}`)) {
        playMentionSound();
      }

      // Check if channel is muted/disabled in top bar
      const channelLower = (msg.channel || '').toLowerCase();
      const isChannelMuted = channelLower && mutedChannelsRef.current.has(channelLower);

      // Queue for TTS with detailed targeting and text cleaning
      const eligible = !isChannelMuted && isMessageEligibleForTTS(msg, s, mutedChannelsRef.current);
      const shouldSkipTTS = !s.ttsEnabled || isChannelMuted || isIgnored || isCmd || isEmoteOnly || !eligible;
      if (!shouldSkipTTS) {
        const ttsText = formatTextForTTS(msg, s, emoteMap);
        if (ttsText) {
          ttsQueueRef.current.push({
            text: ttsText,
            author: msg.displayName || msg.user || 'Зритель',
            msg,
          });
          processTTSQueue();
        }
      }
    });

    const unoffSettings = EventsOn('settings:updated', (updatedSettings) => {
      setSettings((prev) => ({
        ...prev,
        ...updatedSettings,
        channelColors:
          updatedSettings.channelColors || prev.channelColors || {},
      }));
    });

    const unoffAuth = EventsOn('auth:updated', (updatedAuthSettings) => {
      setSettings((prev) => ({ ...prev, ...updatedAuthSettings }));
    });

    const unoffChannels = EventsOn('channels:updated', (chans) => {
      setJoinedChannels(chans || []);
    });

    const unoffKickChannels = EventsOn('kick:channels:updated', (kchans) => {
      setJoinedKickChannels(kchans || []);
    });

    const unoffBadges = EventsOn('badges:loaded', (badgeMap) => {
      setDynamicBadges(badgeMap || {});
    });

    const unoffEmotes = EventsOn('emotes:loaded', (emotes) => {
      setEmoteMap(emotes || {});
    });

    const unoffGoal = EventsOn('goal:update', (goalData) => {
      if (goalData && goalData.title) {
        setCurrentGoal(goalData);
        setHideGoalBar(false);
      }
    });

    return () => {
      if (typeof unoffMsg === 'function') unoffMsg();
      if (typeof unoffSettings === 'function') unoffSettings();
      if (typeof unoffAuth === 'function') unoffAuth();
      if (typeof unoffChannels === 'function') unoffChannels();
      if (typeof unoffKickChannels === 'function') unoffKickChannels();
      if (typeof unoffBadges === 'function') unoffBadges();
      if (typeof unoffEmotes === 'function') unoffEmotes();
      if (typeof unoffGoal === 'function') unoffGoal();
    };
  }, [settings.maxMessages, emoteMap]);

  useEffect(() => {
    if (autoScroll && !isChatHovered && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll, isChatHovered]);

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 60;
    setAutoScroll(isAtBottom);
    if (isAtBottom) {
      setUnreadCount(0);
    }
  };

  const scrollToBottom = () => {
    setAutoScroll(true);
    setUnreadCount(0);
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const toggleMuteChannel = (channelName) => {
    if (!channelName) return;
    const lower = channelName.toLowerCase();
    setMutedChannels((prev) => {
      const next = new Set(prev);
      const isMuting = !next.has(lower);
      if (next.has(lower)) {
        next.delete(lower);
      } else {
        next.add(lower);
      }
      mutedChannelsRef.current = next;

      // If muting this channel, discard queued TTS items from this channel
      if (isMuting) {
        ttsQueueRef.current = ttsQueueRef.current.filter((item) => {
          const itemChan = (item.msg?.channel || '').toLowerCase();
          return itemChan !== lower;
        });

        // If current playing TTS message is from this channel, skip it immediately
        if (currentTTSItemRef.current?.channel?.toLowerCase() === lower) {
          handleSkipCurrentTTS();
        }
      }

      return next;
    });
  };

  const handleAddChannel = async (channelName) => {
    try {
      await JoinChannel(channelName);
    } catch (err) {
      console.error('Failed to join channel:', err);
    }
  };

  const handleAddKickChannel = async (channelName) => {
    try {
      await JoinKickChannel(channelName);
    } catch (err) {
      console.error('Failed to join Kick channel:', err);
    }
  };

  const playMentionSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } catch (_) {}
  };

  const handleMentionUser = (username) => {
    if (!username) return;
    setChatInput((prev) => {
      const prefix = `@${username} `;
      if (prev.startsWith(prefix)) return prev;
      return `${prefix}${prev}`;
    });
    if (chatInputRef.current) {
      chatInputRef.current.focus();
    }
  };

  const openSettings = () => {
    setActiveView('settings');
  };

  const closeSettings = useCallback(() => {
    GetSettings()
      .then((loaded) => {
        if (loaded) {
          setSettings((prev) => ({
            ...prev,
            ...loaded,
            channelColors: loaded.channelColors || {},
          }));
        }
      })
      .catch((err) => console.error('Failed to reload settings on close:', err));
    setActiveView('chat');
  }, []);

  // Filter messages based on muted channels, disabled events, and ignored users/commands
  const visibleMessages = messages.filter((msg) => {
    if (msg.channel && mutedChannels.has(msg.channel.toLowerCase()))
      return false;
    if (settings.showFollows === false && (msg.eventType === 'follow' || msg.eventType === 'channel.follow')) {
      return false;
    }
    if (settings.hideIgnoredFromChat && !msg.isEvent) {
      const user = msg.displayName || msg.user || '';
      const text = msg.message || '';
      if (isUserIgnored(user, settings.ignoredUsers)) return false;
      if (
        settings.ignoreCommands &&
        isCommandMessage(text, settings.commandPrefixes)
      )
        return false;
      if (
        settings.ignoreEmotesOnly &&
        isEmoteOnlyMessage(text, emoteMap, msg.emoteMap)
      )
        return false;
    }
    return true;
  });

  return (
    <div className="w-full h-screen relative overflow-hidden">
      {/* Settings View (kept permanently in DOM so background music, YouTube player, and state persist across view & mode switches) */}
      <div
        className="w-full h-full"
        style={
          activeView === 'settings'
            ? { display: 'block', position: 'relative' }
            : {
                position: 'absolute',
                top: 0,
                left: 0,
                width: '1px',
                height: '1px',
                overflow: 'hidden',
                opacity: 0,
                pointerEvents: 'none',
                zIndex: -10,
              }
        }
      >
        <SettingsErrorBoundary onClose={closeSettings}>
          <SettingsView onClose={closeSettings} />
        </SettingsErrorBoundary>
      </div>

      {/* Main Chat View */}
      <div
        className={`flex-col h-screen w-full select-none overflow-hidden font-sans relative ${
          activeView === 'chat' ? 'flex' : 'hidden'
        } ${
          isGameMode
            ? 'bg-transparent border-none outline-none shadow-none text-[#EDEEF2] pointer-events-none'
            : 'bg-[#0E0F13] text-[#EDEEF2] transition-colors'
        }`}
        style={isGameMode ? { background: 'transparent', backgroundColor: 'transparent' } : {}}
      >
      {!isGameMode && (
        <CustomTitleBar
          isSettingsMode={false}
          onOpenSettings={openSettings}
          onToggleGameMode={handleToggleGameMode}
        />
      )}

      {/* Multi-platform Channel Bar */}
      {!isGameMode && (
        <ChannelBar
          joinedChannels={joinedChannels}
          joinedKickChannels={joinedKickChannels}
          mutedChannels={mutedChannels}
          onToggleMuteChannel={toggleMuteChannel}
          onAddChannel={handleAddChannel}
          onAddKickChannel={handleAddKickChannel}
          onOpenSettings={openSettings}
          settings={settings}
          onToggleTTS={handleToggleTTS}
          onStopTTS={handleStopTTS}
          ttsActive={isTTSActive}
        />
      )}

      {/* Goal Tracker Bar pinned under channel / title header */}
      {!isGameMode && settings.daShowGoalBar !== false && currentGoal && !hideGoalBar && (
        <GoalTrackerBar
          goal={currentGoal}
          onClose={() => setHideGoalBar(true)}
        />
      )}

      {/* Floating Game Mode notification banner when activated */}
      {isGameMode && showGameModeHint && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-fade-in">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#181920]/95 border border-emerald-500/40 text-emerald-300 text-xs font-medium shadow-2xl backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Игровой режим (Оверлей)</span>
            <span className="text-[10px] opacity-80 font-mono bg-white/10 px-1.5 py-0.5 rounded border border-white/10">
              Ctrl+Shift+G
            </span>
          </div>
        </div>
      )}

      {/* Main Stream Chat View */}
      <main
        ref={chatContainerRef}
        onScroll={handleScroll}
        onMouseEnter={() => setIsChatHovered(true)}
        onMouseLeave={() => setIsChatHovered(false)}
        className={`relative flex-1 overflow-y-auto px-1.5 py-1.5 space-y-0.5 custom-scrollbar ${
          isGameMode
            ? 'bg-transparent border-none outline-none shadow-none no-scrollbar scrollbar-none [text-shadow:_0_1px_4px_rgba(0,0,0,0.9),_0_0_2px_rgba(0,0,0,0.9)]'
            : 'bg-[#0E0F13]'
        }`}
        style={isGameMode ? { background: 'transparent', backgroundColor: 'transparent' } : {}}
      >
        {visibleMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[#8E92A4] font-sans text-xs gap-3 select-none py-12 px-6 text-center">
            <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.04] shadow-sm">
              <TwitchIcon
                className="w-8 h-8 opacity-40 text-[#9146FF] fill-[#9146FF]"
              />
            </div>

            <div className="space-y-1 max-w-xs">
              <h3 className="text-xs font-semibold text-[#ECECF1]">
                {joinedChannels.length === 0 && joinedKickChannels.length === 0
                  ? 'Нет подключенных каналов'
                  : 'Ожидание сообщений...'}
              </h3>
              <p className="text-[11px] text-[#6C7082] leading-relaxed">
                {joinedChannels.length === 0 && joinedKickChannels.length === 0
                  ? 'Перейдите в настройки или добавьте канал в верхней панели.'
                  : `Слушаем ${[...joinedChannels.map((c) => '#' + c), ...joinedKickChannels.map((k) => 'kick:' + k)].join(', ')}`}
              </p>
            </div>

            {joinedChannels.length === 0 && joinedKickChannels.length === 0 && (
              <button
                type="button"
                onClick={openSettings}
                className="mt-1 px-3 py-1.5 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-lg text-xs font-semibold shadow transition-all cursor-pointer"
              >
                Открыть настройки
              </button>
            )}
          </div>
        ) : (
          visibleMessages.map((msg, index) => {
            const isSpecialEvent =
              (msg.isEvent ||
                msg.eventType === 'reward' ||
                msg.eventType === 'highlighted' ||
                Boolean(msg.eventData?.['custom-reward-id'])) &&
              !msg.isFirstMsg &&
              msg.eventType !== 'intro';

            if (isSpecialEvent) {
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

            return (
              <ChatMessage
                key={msg.id || index}
                msg={msg}
                settings={settings}
                dynamicBadges={dynamicBadges}
                emoteMap={emoteMap}
                onMentionUser={handleMentionUser}
              />
            );
          })
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Row right above input bar for banners & TTS indicator */}
      <div className="relative z-10 px-2 flex items-center justify-between pointer-events-none">
        {/* Floating Indicator for new messages when scrolled up */}
        <NewMessagesBanner
          unreadCount={unreadCount}
          onClick={scrollToBottom}
        />

        {/* Hover freeze notice */}
        {isChatHovered && !autoScroll && (
          <div className="pointer-events-auto ml-2 mb-1 px-2.5 py-0.5 rounded-full bg-[#242631]/95 border border-white/[0.08] text-[10px] font-medium text-amber-400 flex items-center gap-1 shadow-md animate-fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>Автопрокрутка на паузе</span>
          </div>
        )}

        {/* Floating TTS status & playback widget with Skip button */}
        {(isTTSActive || currentTTSItem) && (
          <div className="ml-auto pointer-events-auto flex items-center gap-2.5 px-3 py-1.5 mb-1.5 rounded-xl bg-[#1c1e2a]/95 backdrop-blur-md border border-white/[0.1] shadow-2xl select-none text-xs animate-fade-in max-w-[340px]">
            {currentTTSItem?.state === 'generating' ? (
              <div className="flex items-center gap-1.5 text-amber-400 shrink-0">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-[11px] font-bold tracking-wide">
                  {currentTTSItem?.engine === 'supertonic' ? '⚡ Supertonic AI' : 'Генерация TTS'}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-blue-400 shrink-0">
                <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span className="text-[10px] font-mono font-bold bg-white/[0.08] px-1.5 py-0.5 rounded text-blue-300">
                  {currentTTSItem?.voice || 'TTS'}
                </span>
              </div>
            )}

            <div className="truncate text-[11px] text-[#C7CBD6] flex-1">
              <span className="font-semibold text-white">@{currentTTSItem?.author || 'Зритель'}</span>
              {currentTTSItem?.text ? `: «${currentTTSItem.text}»` : '...'}
            </div>

            <button
              type="button"
              onClick={handleSkipCurrentTTS}
              className="px-2 py-0.5 bg-rose-500/20 hover:bg-rose-500/30 active:bg-rose-500/40 text-rose-300 text-[10px] font-bold rounded-lg border border-rose-500/30 transition-colors cursor-pointer flex items-center gap-1 shrink-0"
              title={`Пропустить озвучку (${settings.ttsSkipHotkey || 'Esc'})`}
            >
              <span>Пропуск</span>
              <kbd className="text-[9px] opacity-75 font-mono">[{settings.ttsSkipHotkey || 'Esc'}]</kbd>
            </button>
          </div>
        )}
      </div>

      {/* Docked Chat Input Bar (disabled/hidden in Game Mode) */}
      {!isGameMode && (
        <footer className="shrink-0 p-2 bg-[#0E0F13] border-t border-white/[0.06] relative">
          {/* Emote Picker Popover */}
          {showEmotePicker && (
            <div className="absolute bottom-14 right-2 w-72 max-h-64 bg-[#15171E]/95 border border-white/[0.08] rounded-2xl shadow-2xl p-2.5 z-30 flex flex-col gap-2 font-sans backdrop-blur-md animate-fade-in">
              <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-white/[0.06]">
                <input
                  type="text"
                  placeholder="Поиск смайла..."
                  value={emoteSearch}
                  onChange={(e) => setEmoteSearch(e.target.value)}
                  className="flex-1 bg-[#1E212B] border border-white/[0.06] rounded-lg px-2.5 py-1 text-xs text-[#EDEEF2] placeholder:text-[#6B7080] outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowEmotePicker(false)}
                  className="p-1 text-[#A0A4B4] hover:text-[#EDEEF2] rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto grid grid-cols-5 gap-1.5 custom-scrollbar max-h-48 p-1">
                {Object.entries(emoteMap)
                  .filter(([name]) => !emoteSearch || name.toLowerCase().includes(emoteSearch.toLowerCase()))
                  .slice(0, 60)
                  .map(([name, url]) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        setChatInput((prev) => `${prev ? prev.trim() + ' ' : ''}${name} `);
                        setShowEmotePicker(false);
                        chatInputRef.current?.focus();
                      }}
                      title={name}
                      className="p-1.5 rounded-lg hover:bg-white/[0.08] flex items-center justify-center transition-colors cursor-pointer group"
                    >
                      <img src={url} alt={name} className="h-6 object-contain group-hover:scale-110 transition-transform" />
                    </button>
                  ))}
              </div>
            </div>
          )}

          {sendError && (
            <div className="text-[11px] text-rose-400 font-medium px-2 pb-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
              <span className="truncate">{sendError}</span>
            </div>
          )}

          {settings.oauthToken && settings.username ? (
            <form
              onSubmit={handleSendMessage}
              className="flex items-center gap-1.5 bg-[#15171E] border border-white/[0.06] rounded-xl px-2.5 py-1.5 shadow-sm focus-within:border-[#7CF2C8]/50 transition-colors"
            >
              {/* Target channel selector / pill */}
              {joinedChannels.length > 1 ? (
                <div className="relative shrink-0">
                  <select
                    value={activeSendChannel || joinedChannels[0]}
                    onChange={(e) => setActiveSendChannel(e.target.value)}
                    className="appearance-none bg-[#1E212B] hover:bg-[#282C38] text-[#EDEEF2] text-[11px] font-semibold pl-2 pr-5 py-1 rounded-md border border-white/[0.06] outline-none cursor-pointer"
                    title="Выберите канал для отправки сообщения"
                  >
                    {joinedChannels.map((ch) => (
                      <option key={ch} value={ch}>
                        #{ch}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-[#A0A4B4] absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              ) : (
                <span
                  onClick={openSettings}
                  className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-[#A0A4B4] hover:text-[#EDEEF2] px-1 py-0.5 rounded cursor-pointer transition-colors select-none"
                  title="Нажмите для перехода в настройки каналов"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#7CF2C8] animate-pulse shrink-0" />
                  <span>#{activeSendChannel || joinedChannels[0] || 'chat'}</span>
                </span>
              )}

              {/* Message input field */}
              <input
                ref={chatInputRef}
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleInputKeyDown}
                disabled={joinedChannels.length === 0 || isSending}
                placeholder={
                  joinedChannels.length === 0
                    ? 'Сначала подключите канал в настройках...'
                    : `Сообщение в #${activeSendChannel || joinedChannels[0]}...`
                }
                className="flex-1 min-w-0 bg-transparent text-xs text-[#EDEEF2] placeholder:text-[#6B7080] outline-none select-text disabled:opacity-50"
              />

              {/* Emote Picker button */}
              <button
                type="button"
                onClick={() => setShowEmotePicker(!showEmotePicker)}
                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors cursor-pointer shrink-0 ${
                  showEmotePicker
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'text-[#A0A4B4] hover:text-[#EDEEF2] hover:bg-white/[0.04]'
                }`}
                title="Смайлы (7TV, BTTV, FFZ, Twitch)"
              >
                <Smile className="w-4 h-4" />
              </button>

              {/* Send button */}
              <button
                type="submit"
                disabled={!chatInput.trim() || isSending || joinedChannels.length === 0}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#7CF2C8] hover:bg-[#9af7d8] disabled:opacity-30 text-[#0E0F13] font-bold transition-all cursor-pointer shrink-0 shadow-xs"
                title="Отправить (Enter)"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            /* Not authenticated banner */
            <button
              type="button"
              onClick={openSettings}
              className="w-full flex items-center justify-between p-2 rounded-xl bg-[#15171E] hover:bg-[#1E212B] border border-white/[0.06] text-xs transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-[#9146FF] flex items-center justify-center text-white shrink-0 shadow-xs">
                  <TwitchIcon className="w-3.5 h-3.5 fill-white text-white" />
                </span>
                <span className="text-[#A0A4B4] group-hover:text-[#EDEEF2] transition-colors text-left text-[11px]">
                  Войдите через Twitch, чтобы писать в чат
                </span>
              </div>
              <span className="text-[11px] font-semibold text-[#7CF2C8] flex items-center gap-1 shrink-0">
                <span>Войти</span>
                <LogIn className="w-3 h-3" />
              </span>
            </button>
          )}
        </footer>
      )}
      </div>
    </div>
  );
}
