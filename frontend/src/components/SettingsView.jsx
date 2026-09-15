import React, { useState, useEffect, useRef } from 'react';
import {
  GetSettings,
  SaveSettings,
  StartTwitchAuth,
  LogoutTwitch,
  JoinChannel,
  LeaveChannel,
  GetJoinedChannels,
  SpeakText,
  GetTTSVoices,
  GetWidgetURL,
  GetWidgetThemes,
  OpenThemesDir,
} from '../../wailsjs/go/main/App';
import { WindowSetAlwaysOnTop, EventsOn } from '../../wailsjs/runtime/runtime';
import TwitchIcon from './TwitchIcon';
import CustomTitleBar from './CustomTitleBar';
import {
  Sliders,
  Radio,
  User,
  Volume2,
  Filter,
  ChevronDown,
  Plus,
  Trash2,
  Play,
  Loader2,
  LayoutDashboard,
  LogOut,
  Check,
  Shield,
  Eye,
  Monitor,
  Copy,
  FolderOpen,
  ExternalLink,
} from 'lucide-react';

const FONT_OPTIONS = [
  { id: 'Lato', label: 'Lato' },
  { id: 'Inter', label: 'Inter' },
  { id: 'Geist', label: 'Geist' },
  { id: 'Roboto', label: 'Roboto' },
  { id: 'JetBrains Mono', label: 'JetBrains Mono' },
];

const SPACING_OPTIONS = [
  { id: 'compact', label: 'Compact' },
  { id: 'default', label: 'Default' },
  { id: 'relaxed', label: 'Relaxed' },
];

const ALIGN_OPTIONS = [
  { id: 'left', label: 'Left' },
  { id: 'center', label: 'Center' },
  { id: 'right', label: 'Right' },
];

export default function SettingsView({ onClose }) {
  const [activeTab, setActiveTab] = useState('appearance');
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 450
  );
  const [widgetURL, setWidgetURL] = useState('');
  const [widgetThemes, setWidgetThemes] = useState([]);
  const [urlCopied, setUrlCopied] = useState(false);

  const [formData, setFormData] = useState({
    defaultChannel: '',
    fontSize: 14,
    fontFamily: 'Lato',
    messageSpacing: 'default',
    textAlign: 'left',
    alwaysOnTop: false,
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
    ttsRemoveWords: '',
    ignoreCommands: true,
    commandPrefixes: '!, /, ., $, ?',
    ignoreEmotesOnly: false,
    ttsFilterEmotes: true,
    ignoredUsers: ['Nightbot', 'StreamElements', 'Moobot', 'Fossabot'],
    hideIgnoredFromChat: false,
  });

  const [channelInput, setChannelInput] = useState('');
  const [newIgnoredUser, setNewIgnoredUser] = useState('');
  const [joinedChannels, setJoinedChannels] = useState([]);
  const [statusMsg, setStatusMsg] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [ttsVoices, setTtsVoices] = useState({});
  const [localVoices, setLocalVoices] = useState([]);
  const [audioDevices, setAudioDevices] = useState([]);
  const [isTTSTesting, setIsTTSTesting] = useState(false);
  const ttsAudioRef = useRef(null);

  // Resize listener for responsive control panel adaptation
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isWide = windowWidth >= 650;

  useEffect(() => {
    GetSettings()
      .then((loaded) => {
        if (loaded) {
          setFormData((prev) => ({
            ...prev,
            ...loaded,
            fontFamily: loaded.fontFamily || 'Lato',
            messageSpacing: loaded.messageSpacing || 'default',
            textAlign: loaded.textAlign || 'left',
            alwaysOnTop: loaded.alwaysOnTop || false,
            channelColors: loaded.channelColors || {},
            ttsSpeed: loaded.ttsSpeed !== undefined ? loaded.ttsSpeed : 1.0,
            ttsAudioDevice: loaded.ttsAudioDevice || '',
            ttsSkipHotkey: loaded.ttsSkipHotkey || 'Escape',
            ttsAllMessages: loaded.ttsAllMessages !== undefined ? loaded.ttsAllMessages : true,
            ttsRepliesOnly: !!loaded.ttsRepliesOnly,
            ttsHighlightedOnly: !!loaded.ttsHighlightedOnly,
            ttsSubscribersOnly: !!loaded.ttsSubscribersOnly,
            ttsVipOnly: !!loaded.ttsVipOnly,
            ttsModOnly: !!loaded.ttsModOnly,
            ttsIncludeUsername: !!loaded.ttsIncludeUsername,
            ttsIncludeLinks: !!loaded.ttsIncludeLinks,
            ttsIncludeEmotes: !!loaded.ttsIncludeEmotes,
            ttsIncludeEmoji: !!loaded.ttsIncludeEmoji,
            ttsIncludeMentions: loaded.ttsIncludeMentions !== undefined ? loaded.ttsIncludeMentions : true,
            ttsRemoveWords: loaded.ttsRemoveWords || '',
            ignoredUsers: Array.isArray(loaded.ignoredUsers)
              ? loaded.ignoredUsers
              : ['Nightbot', 'StreamElements', 'Moobot', 'Fossabot'],
          }));
        }
      })
      .catch((err) => console.error('Failed to load settings:', err));

    GetTTSVoices()
      .then((voices) => {
        if (voices) setTtsVoices(voices);
      })
      .catch((err) => console.error('Failed to load TTS voices:', err));

    const loadLocalVoices = () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          setLocalVoices(voices);
        }
      }
    };
    loadLocalVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadLocalVoices;
    }

    const loadAudioDevices = async () => {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const outputs = devices.filter((d) => d.kind === 'audiooutput');
          setAudioDevices(outputs);
        } catch (e) {
          console.warn('enumerateDevices error:', e);
        }
      }
    };
    loadAudioDevices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadLocalVoices;
    }

    GetJoinedChannels()
      .then((chans) => {
        if (chans) setJoinedChannels(chans);
      })
      .catch((err) => console.error('Failed to fetch channels:', err));

    const unoffAuth = EventsOn('auth:updated', (updatedSettings) => {
      setFormData((prev) => ({ ...prev, ...updatedSettings }));
      setIsAuthenticating(false);
      setStatusMsg(`Авторизован как @${updatedSettings.username}`);
    });

    const unoffChans = EventsOn('channels:updated', (chans) => {
      setJoinedChannels(chans || []);
    });

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (typeof unoffAuth === 'function') unoffAuth();
      if (typeof unoffChans === 'function') unoffChans();
    };
  }, [onClose]);

  // Live save helper
  const updateAndSave = async (updates) => {
    const next = { ...formData, ...updates };
    setFormData(next);
    try {
      if (updates.alwaysOnTop !== undefined) {
        WindowSetAlwaysOnTop(updates.alwaysOnTop);
      }
      await SaveSettings({
        ...next,
        fontSize: parseInt(next.fontSize, 10) || 14,
        maxMessages: parseInt(next.maxMessages, 10) || 300,
        ttsVolume: parseFloat(next.ttsVolume) || 1.0,
        ttsSpeed: parseFloat(next.ttsSpeed) || 1.0,
        ignoredUsers: Array.isArray(next.ignoredUsers) ? next.ignoredUsers : [],
      });
      setStatusMsg('Сохранено');
      setTimeout(() => setStatusMsg(''), 2000);
    } catch (err) {
      console.error('Failed to auto-save settings:', err);
    }
  };

  const handleToggleAlwaysOnTop = () => {
    updateAndSave({ alwaysOnTop: !formData.alwaysOnTop });
  };

  const handleFontSizeChange = (e) => {
    const val = parseInt(e.target.value, 10);
    updateAndSave({ fontSize: val });
  };

  const handleAddChannel = async (e) => {
    e?.preventDefault();
    const ch = channelInput.trim().replace(/^#/, '').toLowerCase();
    if (!ch) return;
    try {
      await JoinChannel(ch);
      setChannelInput('');
      setStatusMsg(`Подключен канал #${ch}`);
      setTimeout(() => setStatusMsg(''), 2000);
    } catch (err) {
      setStatusMsg(`Ошибка подключения #${ch}: ${err}`);
    }
  };

  const handleRemoveChannel = async (channelToRemove) => {
    const ch = channelToRemove.toLowerCase();
    try {
      await LeaveChannel(ch);
      setStatusMsg(`Канал #${ch} удален`);
      setTimeout(() => setStatusMsg(''), 2000);
    } catch (err) {
      setStatusMsg(`Ошибка удаления #${ch}: ${err}`);
    }
  };

  const handleAuth = async () => {
    setIsAuthenticating(true);
    setStatusMsg('Открываем авторизацию Twitch в браузере...');
    try {
      await StartTwitchAuth();
    } catch (err) {
      setStatusMsg('Ошибка авторизации: ' + String(err));
      setIsAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    try {
      await LogoutTwitch();
      setFormData((prev) => ({
        ...prev,
        oauthToken: '',
        username: '',
      }));
      setStatusMsg('Выход выполнен.');
      setTimeout(() => setStatusMsg(''), 2000);
    } catch (err) {
      setStatusMsg('Ошибка выхода: ' + String(err));
    }
  };

  const handleAddIgnoredUser = (e) => {
    e?.preventDefault();
    const u = newIgnoredUser.trim().replace(/^@/, '');
    if (!u) return;
    const current = Array.isArray(formData.ignoredUsers) ? formData.ignoredUsers : [];
    if (!current.some((x) => x && x.toLowerCase() === u.toLowerCase())) {
      const nextUsers = [...current, u];
      updateAndSave({ ignoredUsers: nextUsers });
    }
    setNewIgnoredUser('');
  };

  const handleRemoveIgnoredUser = (uToRemove) => {
    const nextUsers = (Array.isArray(formData.ignoredUsers) ? formData.ignoredUsers : []).filter(
      (u) => u.toLowerCase() !== uToRemove.toLowerCase()
    );
    updateAndSave({ ignoredUsers: nextUsers });
  };

  const handleTestTTS = async () => {
    setIsTTSTesting(true);
    const text = 'ReChat: голосовое оповещение работает отлично!';
    try {
      if (formData.ttsEngine === 'local') {
        const playbackRate = Math.min(Math.max(Number(formData.ttsSpeed) || 1.0, 0.5), 2.5);
        if (typeof window === 'undefined' || !window.speechSynthesis) {
          throw new Error('Local TTS not supported in this browser');
        }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = playbackRate;
        utterance.volume = formData.ttsVolume !== undefined ? formData.ttsVolume : 1.0;
        const voice = localVoices.find((v) => v.name === formData.ttsVoiceLocal);
        if (voice) utterance.voice = voice;
        utterance.onend = () => setIsTTSTesting(false);
        utterance.onerror = () => setIsTTSTesting(false);
        window.speechSynthesis.speak(utterance);
      } else {
        const dataUri = await SpeakText(text, formData.ttsVoice || 'shitova.us');
        if (dataUri) {
          if (ttsAudioRef.current) {
            ttsAudioRef.current.pause();
          }
          const audio = new Audio(dataUri);
          const playbackRate = Math.min(Math.max(Number(formData.ttsSpeed) || 1.0, 0.5), 2.5);
          audio.playbackRate = playbackRate;
          audio.volume = formData.ttsVolume !== undefined ? formData.ttsVolume : 1.0;
          if (formData.ttsAudioDevice && typeof audio.setSinkId === 'function') {
            audio.setSinkId(formData.ttsAudioDevice).catch((e) => console.warn('setSinkId error:', e));
          }
          ttsAudioRef.current = audio;
          audio.onended = () => setIsTTSTesting(false);
          audio.onerror = () => setIsTTSTesting(false);
          await audio.play();
        } else {
          setIsTTSTesting(false);
        }
      }
    } catch (err) {
      console.error('TTS test failed:', err);
      setStatusMsg('Ошибка проверки TTS: ' + String(err));
      setIsTTSTesting(false);
    }
  };

  const getScalingLabel = (size) => {
    if (size <= 12) return 'Small';
    if (size === 14) return 'Default';
    if (size === 16) return 'Medium';
    if (size === 18) return 'Large';
    return 'Extra Large';
  };

  const tabs = [
    { id: 'appearance', label: 'Appearance', desc: 'Theme, fonts & message preview', icon: Sliders },
    { id: 'channels', label: 'Channels', desc: 'Monitored Twitch channels', icon: Radio },
    { id: 'account', label: 'Account', desc: 'Twitch OAuth & credentials', icon: User },
    { id: 'tts', label: 'Voice & TTS', desc: 'Yandex Alice & speech synthesis', icon: Volume2 },
    { id: 'filters', label: 'Filters', desc: 'Bot commands & user ignore list', icon: Filter },
    { id: 'widgets', label: 'Widgets', desc: 'OBS Browser Source integration', icon: Monitor },
  ];

  const currentTabTitle = tabs.find((t) => t.id === activeTab)?.label || 'Settings';
  const currentTabDesc = tabs.find((t) => t.id === activeTab)?.desc || '';

  // Load widget info when that tab is opened
  useEffect(() => {
    if (activeTab === 'widgets') {
      GetWidgetURL().then(setWidgetURL).catch(console.error);
      GetWidgetThemes().then(setWidgetThemes).catch(console.error);
    }
  }, [activeTab]);

  const handleCopyWidgetURL = () => {
    if (widgetURL) {
      navigator.clipboard.writeText(widgetURL).then(() => {
        setUrlCopied(true);
        setTimeout(() => setUrlCopied(false), 2000);
      });
    }
  };

  const renderWidgetContent = () => (
    <div className="space-y-5">
      {/* OBS URL Card */}
      <div>
        <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">Browser Source URL</div>
        <div className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] shadow-sm space-y-3">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[#8E92A4] mb-1">Вставьте этот URL в OBS → Browser Source</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-[#181920] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-[#7CB9E8] font-mono break-all">
                  {widgetURL || 'http://localhost:3500/widget/chat'}
                </code>
                <button
                  type="button"
                  onClick={handleCopyWidgetURL}
                  title="Копировать URL"
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    urlCopied
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-white/[0.06] hover:bg-white/[0.12] text-[#ECECF1] border border-white/[0.04]'
                  }`}
                >
                  {urlCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {urlCopied ? 'Скопировано!' : 'Копировать'}
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-white/[0.04] pt-3">
            <p className="text-xs text-[#8E92A4] leading-relaxed">
              💡 <strong className="text-[#ECECF1]">Как добавить в OBS:</strong> Sources → + → Browser Source →
              вставьте URL → установите размер (напр. 400×600)
            </p>
          </div>
        </div>
      </div>

      {/* Themes Card */}
      <div>
        <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">Темы виджета</div>
        <div className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] shadow-sm space-y-3">
          <div className="flex flex-wrap gap-2">
            {widgetThemes.length === 0 ? (
              <span className="text-xs text-[#6C7082] italic">Нет тем</span>
            ) : (
              widgetThemes.map((theme) => (
                <span
                  key={theme}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#181920] border border-white/[0.06] text-xs font-medium text-[#ECECF1]"
                >
                  <Monitor className="w-3 h-3 text-[#9146FF]" />
                  {theme}
                </span>
              ))
            )}
          </div>

          <div className="border-t border-white/[0.04] pt-3">
            <p className="text-xs text-[#8E92A4] mb-2 leading-relaxed">
              Каждая тема — папка с <code className="text-[#7CB9E8]">index.html</code> и{' '}
              <code className="text-[#7CB9E8]">style.css</code>. Редактируйте в любом редакторе —
              виджет перезагрузится автоматически.
            </p>
            <button
              type="button"
              onClick={OpenThemesDir}
              className="flex items-center gap-2 px-3.5 py-2 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.04] text-[#ECECF1] text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Открыть папку тем
            </button>
          </div>
        </div>
      </div>

      {/* Theme URL hint */}
      <div>
        <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">Выбор темы</div>
        <div className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] shadow-sm">
          <p className="text-xs text-[#8E92A4] leading-relaxed">
            Чтобы выбрать тему, добавьте{' '}
            <code className="text-[#7CB9E8]">?theme=ИМЯ</code> к URL:
          </p>
          <code className="block mt-2 bg-[#181920] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-[#7CB9E8] font-mono">
            http://localhost:3500/widget/chat?theme=mytheme
          </code>
        </div>
      </div>
    </div>
  );

  const renderAppearanceContent = () => (
    <div className={`space-y-4 ${isWide ? 'grid grid-cols-1 gap-4' : 'max-w-lg mx-auto'}`}>
      {/* Window section */}
      <div>
        <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">
          Window
        </div>
        <div className="bg-[#242631] rounded-2xl p-4 flex items-center justify-between border border-white/[0.03] shadow-sm">
          <div>
            <span className="text-sm font-medium text-[#ECECF1] block">
              Show chat on top of all windows
            </span>
            {isWide && (
              <span className="text-xs text-[#8E92A4]">
                Окно чата будет оставаться поверх игр, браузера и полноэкранных приложений
              </span>
            )}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={formData.alwaysOnTop}
            onClick={handleToggleAlwaysOnTop}
            className={`w-12 h-6.5 rounded-full transition-colors relative p-0.5 cursor-pointer focus:outline-none shrink-0 ml-4 ${
              formData.alwaysOnTop ? 'bg-[#3B82F6]' : 'bg-[#383A48]'
            }`}
          >
            <div
              className={`w-5.5 h-5.5 rounded-full bg-white shadow-md transform transition-transform ${
                formData.alwaysOnTop ? 'translate-x-5.5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Message text section */}
      <div>
        <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">
          Message text
        </div>
        <div className="bg-[#242631] rounded-2xl p-4 space-y-4 border border-white/[0.03] shadow-sm">
          {/* Live Message Preview Box */}
          <div
            className="bg-[#181920] rounded-xl p-3 space-y-2 border border-white/[0.04] overflow-hidden"
            style={{
              fontSize: `${formData.fontSize || 14}px`,
              fontFamily: `"${formData.fontFamily || 'Lato'}", system-ui, sans-serif`,
              textAlign: formData.textAlign || 'left',
            }}
          >
            {/* Row 1: Twitch */}
            <div
              className={`flex items-center gap-1.5 leading-snug ${
                formData.textAlign === 'center'
                  ? 'justify-center'
                  : formData.textAlign === 'right'
                  ? 'justify-end'
                  : 'justify-start'
              }`}
            >
              <span className="shrink-0 inline-flex items-center justify-center w-[18px] h-[18px] rounded-[4px] bg-[#9146FF]">
                <TwitchIcon className="w-3 h-3 text-white fill-white" />
              </span>
              <span className="font-bold text-[#00B4D8]">Kappa:</span>
              <span className="text-[#ECECF1]">Hi!</span>
              <span className="text-base leading-none">🙋‍♀️</span>
            </div>

            {/* Row 2: YouTube */}
            <div
              className={`flex items-center gap-1.5 leading-snug ${
                formData.textAlign === 'center'
                  ? 'justify-center'
                  : formData.textAlign === 'right'
                  ? 'justify-end'
                  : 'justify-start'
              }`}
            >
              <span className="shrink-0 inline-flex items-center justify-center w-[18px] h-[18px] rounded-[4px] bg-[#FF0000]">
                <Play className="w-2.5 h-2.5 text-white fill-white ml-0.5" />
              </span>
              <span className="font-bold text-[#22C55E]">@Kappa:</span>
              <span className="text-[#ECECF1]">Hi!</span>
              <span className="text-base leading-none">🖐️</span>
            </div>

            {/* Row 3: TikTok */}
            <div
              className={`flex items-center gap-1.5 leading-snug ${
                formData.textAlign === 'center'
                  ? 'justify-center'
                  : formData.textAlign === 'right'
                  ? 'justify-end'
                  : 'justify-start'
              }`}
            >
              <span className="shrink-0 inline-flex items-center justify-center w-[18px] h-[18px] rounded-[4px] bg-[#000000] border border-white/20">
                <span className="text-[10px] font-black text-[#00F2FE]">♪</span>
              </span>
              <span className="font-bold text-[#F43F5E]">@Kappa:</span>
              <span className="text-[#ECECF1]">Hi!</span>
            </div>
          </div>

          {/* Text scaling control */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[#ECECF1]">
                Text scaling
              </span>
              <span className="text-xs text-[#8E92A4] font-medium">
                {getScalingLabel(formData.fontSize)}
              </span>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <span className="text-xs font-semibold text-[#8E92A4] select-none w-3 text-center">
                A
              </span>
              <div className="relative flex-1 flex items-center">
                <input
                  type="range"
                  min="12"
                  max="20"
                  step="2"
                  value={formData.fontSize || 14}
                  onChange={handleFontSizeChange}
                  className="w-full h-1.5 bg-[#383A48] rounded-lg appearance-none cursor-pointer accent-[#3B82F6]"
                />
              </div>
              <span className="text-lg font-bold text-[#8E92A4] select-none w-4 text-center">
                A
              </span>
            </div>
          </div>

          {/* Subtle Divider */}
          <div className="h-px bg-white/[0.06]" />

          {/* Font selector dropdown */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[#ECECF1]">
              Font
            </span>
            <div className="relative">
              <select
                value={formData.fontFamily || 'Lato'}
                onChange={(e) => updateAndSave({ fontFamily: e.target.value })}
                className="appearance-none bg-[#181920] hover:bg-[#1E202B] text-sm text-[#ECECF1] font-medium py-1.5 pl-3 pr-8 rounded-lg border border-white/[0.04] outline-none cursor-pointer"
              >
                {FONT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#8E92A4] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Distance between messages selector dropdown */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[#ECECF1]">
              Distance between messages
            </span>
            <div className="relative">
              <select
                value={formData.messageSpacing || 'default'}
                onChange={(e) =>
                  updateAndSave({ messageSpacing: e.target.value })
                }
                className="appearance-none bg-[#181920] hover:bg-[#1E202B] text-sm text-[#ECECF1] font-medium py-1.5 pl-3 pr-8 rounded-lg border border-white/[0.04] outline-none cursor-pointer"
              >
                {SPACING_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#8E92A4] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Text alignment selector dropdown */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[#ECECF1]">
              Text alignment
            </span>
            <div className="relative">
              <select
                value={formData.textAlign || 'left'}
                onChange={(e) => updateAndSave({ textAlign: e.target.value })}
                className="appearance-none bg-[#181920] hover:bg-[#1E202B] text-sm text-[#ECECF1] font-medium py-1.5 pl-3 pr-8 rounded-lg border border-white/[0.04] outline-none cursor-pointer"
              >
                {ALIGN_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#8E92A4] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Tab 2: Channels content
  const renderChannelsContent = () => (
    <div className={`space-y-4 ${isWide ? 'grid grid-cols-1 gap-4' : 'max-w-lg mx-auto'}`}>
      <div>
        <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">
          Add Channel
        </div>
        <form
          onSubmit={handleAddChannel}
          className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] shadow-sm flex items-center gap-2"
        >
          <input
            type="text"
            value={channelInput}
            onChange={(e) => setChannelInput(e.target.value)}
            placeholder="Введите имя канала (напр. shroud)"
            className="flex-1 bg-[#181920] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-[#ECECF1] placeholder:text-[#6C7082] outline-none focus:border-[#3B82F6]"
          />
          <button
            type="submit"
            disabled={!channelInput.trim()}
            className="px-4 py-2 bg-[#3B82F6] hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Добавить</span>
          </button>
        </form>
      </div>

      <div>
        <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">
          Connected Channels ({joinedChannels.length})
        </div>
        <div className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] shadow-sm space-y-2">
          {joinedChannels.length === 0 ? (
            <p className="text-xs text-[#8E92A4] text-center py-4">
              Нет подключенных каналов. Добавьте канал выше.
            </p>
          ) : (
            joinedChannels.map((ch) => (
              <div
                key={ch}
                className="flex items-center justify-between p-2.5 rounded-lg bg-[#181920] border border-white/[0.04]"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-sm font-semibold text-[#ECECF1]">
                    #{ch}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveChannel(ch)}
                  className="p-1.5 text-[#8E92A4] hover:text-rose-400 hover:bg-white/[0.04] rounded transition-colors cursor-pointer"
                  title="Отключить канал"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  // Tab 3: Account content
  const renderAccountContent = () => (
    <div className={`space-y-4 ${isWide ? 'grid grid-cols-1 gap-4' : 'max-w-lg mx-auto'}`}>
      <div>
        <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">
          Twitch Authorization
        </div>
        <div className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] shadow-sm space-y-3">
          {formData.username ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#9146FF]/20 border border-[#9146FF]/40 flex items-center justify-center text-white">
                  <TwitchIcon className="w-5 h-5 fill-white text-white" />
                </div>
                <div>
                  <span className="text-sm font-bold text-[#ECECF1] block">
                    @{formData.username}
                  </span>
                  <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Авторизован через Twitch OAuth
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="px-3.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-semibold rounded-lg border border-rose-500/30 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Выйти</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-[#8E92A4] leading-relaxed">
                Войдите через Twitch, чтобы отправлять сообщения и использовать персональные значки подписчика.
              </p>
              <button
                type="button"
                onClick={handleAuth}
                disabled={isAuthenticating}
                className="w-full py-2 bg-[#9146FF] hover:bg-[#772CE8] text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
              >
                <TwitchIcon className="w-4 h-4 fill-white text-white" />
                <span>{isAuthenticating ? 'Авторизация в браузере...' : 'Войти через Twitch'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Helper switch component for clean toggle lists
  const renderToggleRow = (label, desc, checked, onChange, disabled = false) => (
    <div className={`flex items-center justify-between py-1.5 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="pr-4">
        <span className="text-sm font-medium text-[#ECECF1] block leading-snug">{label}</span>
        {desc && <span className="text-xs text-[#8E92A4] block mt-0.5">{desc}</span>}
      </div>
      <button
        type="button"
        role="switch"
        disabled={disabled}
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer focus:outline-none shrink-0 ${
          checked ? 'bg-[#3B82F6]' : 'bg-[#383A48]'
        }`}
      >
        <div
          className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );

  // Tab 4: TTS content with all playback, targeting, content & text cleaning settings
  const renderTTSContent = () => (
    <div className={`space-y-4 ${isWide ? 'grid grid-cols-1 gap-4' : 'max-w-lg mx-auto'}`}>
      {/* 1. Playback & Voice Devices Card */}
      <div>
        <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">
          Воспроизведение и звук
        </div>
        <div className="bg-[#242631] rounded-2xl p-4 space-y-4 border border-white/[0.03] shadow-sm">
          {renderToggleRow(
            'Включить озвучку сообщений (TTS)',
            'Автоматическое чтение входящих сообщений чата',
            formData.ttsEnabled,
            (val) => updateAndSave({ ttsEnabled: val })
          )}

          <div className="h-px bg-white/[0.06]" />

          {/* Engine Selector */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-[#ECECF1] block">
                Движок озвучки
              </span>
              <span className="text-xs text-[#8E92A4]">
                Облачная Алиса или локальный голос системы
              </span>
            </div>
            <div className="relative">
              <select
                value={formData.ttsEngine || 'yandex'}
                onChange={(e) => updateAndSave({ ttsEngine: e.target.value })}
                className="appearance-none bg-[#181920] hover:bg-[#1E202B] text-sm text-[#ECECF1] font-medium py-1.5 pl-3 pr-8 rounded-lg border border-white/[0.04] outline-none cursor-pointer"
              >
                <option value="yandex">Yandex Alice (Облако)</option>
                <option value="local">Локальный синтезатор (ОС)</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#8E92A4] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Voice selector */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[#ECECF1]">
              {formData.ttsEngine === 'local' ? 'Системный голос' : 'Голос (Алиса / Яндекс)'}
            </span>
            <div className="relative">
              {formData.ttsEngine === 'local' ? (
                <select
                  value={formData.ttsVoiceLocal || ''}
                  onChange={(e) => updateAndSave({ ttsVoiceLocal: e.target.value })}
                  className="appearance-none bg-[#181920] hover:bg-[#1E202B] text-sm text-[#ECECF1] font-medium py-1.5 pl-3 pr-8 rounded-lg border border-white/[0.04] outline-none cursor-pointer max-w-[200px] truncate"
                >
                  {localVoices.length === 0 ? (
                    <option value="">Голоса не найдены</option>
                  ) : (
                    localVoices.map((v) => (
                      <option key={v.name} value={v.name}>
                        {v.name} ({v.lang})
                      </option>
                    ))
                  )}
                </select>
              ) : (
                <select
                  value={formData.ttsVoice || 'shitova.us'}
                  onChange={(e) => updateAndSave({ ttsVoice: e.target.value })}
                  className="appearance-none bg-[#181920] hover:bg-[#1E202B] text-sm text-[#ECECF1] font-medium py-1.5 pl-3 pr-8 rounded-lg border border-white/[0.04] outline-none cursor-pointer"
                >
                  <option value="shitova.us">Татьяна Шитова (Алиса)</option>
                  <option value="alyss">Alyss</option>
                  <option value="ermil">Ermil (мужской)</option>
                  <option value="jane">Jane (женский)</option>
                  <option value="oksana">Oksana (женский)</option>
                  <option value="omazh">Omazh (женский)</option>
                  <option value="zahar">Zahar (мужской)</option>
                </select>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-[#8E92A4] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Speed slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#8E92A4]">Скорость воспроизведения</span>
              <span className="text-[#ECECF1] font-mono font-medium">
                {(Number(formData.ttsSpeed) || 1.0).toFixed(1)}x
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={formData.ttsSpeed !== undefined ? formData.ttsSpeed : 1.0}
              onChange={(e) =>
                updateAndSave({ ttsSpeed: parseFloat(e.target.value) })
              }
              className="w-full h-1.5 bg-[#383A48] rounded-lg appearance-none cursor-pointer accent-[#3B82F6]"
            />
            <div className="flex justify-between text-[10px] text-[#6C7082] font-mono">
              <span>0.5x (Медленно)</span>
              <span>1.0x (Стандарт)</span>
              <span>2.0x (Быстро)</span>
            </div>
          </div>

          {/* Volume slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#8E92A4]">Громкость</span>
              <span className="text-[#ECECF1] font-mono font-medium">
                {Math.round((formData.ttsVolume !== undefined ? formData.ttsVolume : 1.0) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={formData.ttsVolume !== undefined ? formData.ttsVolume : 1.0}
              onChange={(e) =>
                updateAndSave({ ttsVolume: parseFloat(e.target.value) })
              }
              className="w-full h-1.5 bg-[#383A48] rounded-lg appearance-none cursor-pointer accent-[#3B82F6]"
            />
          </div>

          {/* Audio Output Device */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-[#ECECF1] block">
                Устройство вывода звука
              </span>
              <span className="text-xs text-[#8E92A4]">
                Наушники, динамики или виртуальный кабель
              </span>
            </div>
            <div className="relative">
              <select
                value={formData.ttsAudioDevice || ''}
                onChange={(e) => updateAndSave({ ttsAudioDevice: e.target.value })}
                className="appearance-none bg-[#181920] hover:bg-[#1E202B] text-sm text-[#ECECF1] font-medium py-1.5 pl-3 pr-8 rounded-lg border border-white/[0.04] outline-none cursor-pointer max-w-[220px] truncate"
              >
                <option value="">По умолчанию (Системное)</option>
                {audioDevices.map((dev) => (
                  <option key={dev.deviceId} value={dev.deviceId}>
                    {dev.label || `Аудиоустройство (${dev.deviceId.slice(0, 6)}...)`}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#8E92A4] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Skip Hotkey */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-[#ECECF1] block">
                Клавиша пропуска текущей озвучки
              </span>
              <span className="text-xs text-[#8E92A4]">
                Мгновенно прерывает читаемое сейчас сообщение
              </span>
            </div>
            <div className="relative">
              <select
                value={formData.ttsSkipHotkey || 'Escape'}
                onChange={(e) => updateAndSave({ ttsSkipHotkey: e.target.value })}
                className="appearance-none bg-[#181920] hover:bg-[#1E202B] text-sm text-[#ECECF1] font-medium py-1.5 pl-3 pr-8 rounded-lg border border-white/[0.04] outline-none cursor-pointer"
              >
                <option value="Escape">Клавиша Esc (Escape)</option>
                <option value="F8">Клавиша F8</option>
                <option value="Ctrl+Shift+S">Ctrl + Shift + S</option>
                <option value="Space">Пробел (Space)</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#8E92A4] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Test button */}
          <button
            type="button"
            onClick={handleTestTTS}
            disabled={isTTSTesting}
            className="px-4 py-2 bg-white/[0.06] hover:bg-white/[0.1] text-[#ECECF1] text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors cursor-pointer border border-white/[0.06]"
          >
            {isTTSTesting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#3B82F6]" />
            ) : (
              <Play className="w-3.5 h-3.5 text-[#3B82F6]" />
            )}
            <span>{isTTSTesting ? 'Воспроизведение...' : 'Проверить звук TTS'}</span>
          </button>
        </div>
      </div>

      {/* 2. Message Targeting Card */}
      <div>
        <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">
          Кого озвучивать (Фильтрация сообщений)
        </div>
        <div className="bg-[#242631] rounded-2xl p-4 space-y-2 border border-white/[0.03] shadow-sm">
          {renderToggleRow(
            'Озвучивать все сообщения',
            'Читать все входящие сообщения без ограничений по роли',
            formData.ttsAllMessages,
            (val) => updateAndSave({ ttsAllMessages: val })
          )}

          {!formData.ttsAllMessages && (
            <div className="pt-2 pl-2 border-t border-white/[0.04] space-y-1">
              <div className="text-[11px] text-[#3B82F6] font-medium pb-1">
                Озвучивать только выбранные категории:
              </div>
              {renderToggleRow(
                'Озвучивать сообщения с ответом',
                'Сообщения, отправленные в ответ другим пользователям',
                formData.ttsRepliesOnly,
                (val) => updateAndSave({ ttsRepliesOnly: val })
              )}
              {renderToggleRow(
                'Озвучивать выделенные сообщения',
                'Сообщения, выделенные за баллы канала (Channel Points)',
                formData.ttsHighlightedOnly,
                (val) => updateAndSave({ ttsHighlightedOnly: val })
              )}
              {renderToggleRow(
                'Озвучивать сообщения подписчиков',
                'Сообщения от платных подписчиков (Subscribers)',
                formData.ttsSubscribersOnly,
                (val) => updateAndSave({ ttsSubscribersOnly: val })
              )}
              {renderToggleRow(
                'Озвучивать сообщения ВИП',
                'Сообщения от пользователей со значком VIP',
                formData.ttsVipOnly,
                (val) => updateAndSave({ ttsVipOnly: val })
              )}
              {renderToggleRow(
                'Озвучивать сообщения модеров',
                'Сообщения от модераторов и стримера',
                formData.ttsModOnly,
                (val) => updateAndSave({ ttsModOnly: val })
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. Message Content Card */}
      <div>
        <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">
          Содержимое сообщения (Что читать)
        </div>
        <div className="bg-[#242631] rounded-2xl p-4 space-y-2 border border-white/[0.03] shadow-sm">
          {renderToggleRow(
            'Озвучивать имя автора',
            'Добавлять имя пользователя перед сообщением (например, «shroud говорит: ...»)',
            formData.ttsIncludeUsername,
            (val) => updateAndSave({ ttsIncludeUsername: val })
          )}
          {renderToggleRow(
            'Озвучивать ссылки',
            'Если выключено, ссылки https://... автоматически удаляются из речи',
            formData.ttsIncludeLinks,
            (val) => updateAndSave({ ttsIncludeLinks: val })
          )}
          {renderToggleRow(
            'Озвучивать смайлики',
            'Если выключено, названия смайликов Twitch / 7TV / BTTV вырезаются из речи',
            formData.ttsIncludeEmotes,
            (val) => updateAndSave({ ttsIncludeEmotes: val })
          )}
          {renderToggleRow(
            'Озвучивать эмодзи',
            'Если выключено, стандартные Unicode-эмодзи удаляются из речи',
            formData.ttsIncludeEmoji,
            (val) => updateAndSave({ ttsIncludeEmoji: val })
          )}
          {renderToggleRow(
            'Озвучивать упоминания',
            'Если выключено, теги @username удаляются из читаемого текста',
            formData.ttsIncludeMentions,
            (val) => updateAndSave({ ttsIncludeMentions: val })
          )}
        </div>
      </div>

      {/* 4. Text Processing: Word / Symbol Blacklist Card */}
      <div>
        <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">
          Обработка текста
        </div>
        <div className="bg-[#242631] rounded-2xl p-4 space-y-3 border border-white/[0.03] shadow-sm">
          <div>
            <label className="text-sm font-medium text-[#ECECF1] block mb-1">
              Удалять из текста слова или символы
            </label>
            <p className="text-xs text-[#8E92A4] mb-2 leading-relaxed">
              Укажите слова, фразы или символы через запятую или с новой строки. Они будут автоматически удаляться перед озвучкой.
            </p>
            <textarea
              rows={3}
              value={formData.ttsRemoveWords || ''}
              onChange={(e) => updateAndSave({ ttsRemoveWords: e.target.value })}
              placeholder="например: !, ?, http, стример, Kappa, LUL"
              className="w-full bg-[#181920] border border-white/[0.06] rounded-xl p-3 text-xs text-[#ECECF1] placeholder:text-[#6C7082] outline-none focus:border-[#3B82F6] resize-none font-mono"
            />
          </div>
        </div>
      </div>
    </div>
  );

  // Tab 5: Filters content
  const renderFiltersContent = () => (
    <div className={`space-y-4 ${isWide ? 'grid grid-cols-1 gap-4' : 'max-w-lg mx-auto'}`}>
      <div>
        <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">
          Chat Filters
        </div>
        <div className="bg-[#242631] rounded-2xl p-4 space-y-4 border border-white/[0.03] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[#ECECF1]">
              Игнорировать команды бота (!, /, ., $, ?)
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={formData.ignoreCommands}
              onClick={() =>
                updateAndSave({ ignoreCommands: !formData.ignoreCommands })
              }
              className={`w-12 h-6.5 rounded-full transition-colors relative p-0.5 cursor-pointer focus:outline-none ${
                formData.ignoreCommands ? 'bg-[#3B82F6]' : 'bg-[#383A48]'
              }`}
            >
              <div
                className={`w-5.5 h-5.5 rounded-full bg-white shadow-md transform transition-transform ${
                  formData.ignoreCommands ? 'translate-x-5.5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <div className="h-px bg-white/[0.06]" />

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[#ECECF1]">
              Скрывать игнорируемые из чата
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={formData.hideIgnoredFromChat}
              onClick={() =>
                updateAndSave({
                  hideIgnoredFromChat: !formData.hideIgnoredFromChat,
                })
              }
              className={`w-12 h-6.5 rounded-full transition-colors relative p-0.5 cursor-pointer focus:outline-none ${
                formData.hideIgnoredFromChat ? 'bg-[#3B82F6]' : 'bg-[#383A48]'
              }`}
            >
              <div
                className={`w-5.5 h-5.5 rounded-full bg-white shadow-md transform transition-transform ${
                  formData.hideIgnoredFromChat ? 'translate-x-5.5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">
          Игнорируемые пользователи и боты
        </div>
        <div className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] shadow-sm space-y-3">
          <form onSubmit={handleAddIgnoredUser} className="flex gap-2">
            <input
              type="text"
              value={newIgnoredUser}
              onChange={(e) => setNewIgnoredUser(e.target.value)}
              placeholder="Имя пользователя (напр. Nightbot)"
              className="flex-1 bg-[#181920] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-[#ECECF1] placeholder:text-[#6C7082] outline-none focus:border-[#3B82F6]"
            />
            <button
              type="submit"
              disabled={!newIgnoredUser.trim()}
              className="px-3.5 py-2 bg-white/[0.08] hover:bg-white/[0.12] disabled:opacity-50 text-[#ECECF1] text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Добавить
            </button>
          </form>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {(formData.ignoredUsers || []).map((u) => (
              <span
                key={u}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#181920] border border-white/[0.06] text-xs font-medium text-[#ECECF1]"
              >
                <span>@{u}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveIgnoredUser(u)}
                  className="text-[#8E92A4] hover:text-rose-400 cursor-pointer"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen w-full bg-[#181920] text-[#ECECF1] select-none overflow-hidden font-sans">
      <CustomTitleBar
        isSettingsMode={true}
        settingsTitle={isWide ? 'ReChat Control Panel' : currentTabTitle}
        onCloseSettings={onClose}
        onBack={() => {
          if (activeTab !== 'appearance' && !isWide) {
            setActiveTab('appearance');
          } else {
            onClose();
          }
        }}
      />

      {/* DYNAMIC LAYOUT:
          - If isWide (width >= 650px): Full 2-column Control Panel with sidebar!
          - If compact (width < 650px): Minimalist stream companion settings from Screenshot 2!
      */}
      {isWide ? (
        <div className="flex flex-1 min-h-0 w-full overflow-hidden">
          {/* Left Control Panel Sidebar */}
          <aside className="w-64 bg-[#14151C] border-r border-white/[0.04] flex flex-col justify-between shrink-0 p-3 space-y-3 select-none">
            <div className="space-y-3">
              {/* User Profile Card */}
              <div className="p-2.5 rounded-xl bg-[#242631] border border-white/[0.04] flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#9146FF] flex items-center justify-center text-white shrink-0 shadow-sm">
                  <TwitchIcon className="w-4 h-4 fill-white text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-[#ECECF1] truncate">
                    {formData.username ? `@${formData.username}` : 'Гостевой режим'}
                  </div>
                  <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {formData.username ? 'Подключен' : 'Offline'}
                  </div>
                </div>
              </div>

              {/* Sidebar Tabs */}
              <nav className="space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all text-left ${
                        isActive
                          ? 'bg-[#3B82F6] text-white shadow-md'
                          : 'text-[#8E92A4] hover:text-[#ECECF1] hover:bg-white/[0.04]'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate leading-tight">{tab.label}</div>
                        <div
                          className={`text-[10px] font-normal truncate mt-0.5 ${
                            isActive ? 'text-blue-100' : 'text-[#6C7082]'
                          }`}
                        >
                          {tab.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Sidebar Footer */}
            <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between text-[11px] text-[#6C7082] font-mono px-1">
              <span>RC-01 // DESKTOP</span>
              <button
                type="button"
                onClick={onClose}
                className="hover:text-[#ECECF1] transition-colors cursor-pointer"
              >
                Вернуться к чату →
              </button>
            </div>
          </aside>

          {/* Right Main Control Panel Pane */}
          <section className="flex-1 flex flex-col min-w-0 bg-[#181920]">
            {/* Header bar */}
            <div className="h-12 px-6 border-b border-white/[0.04] flex items-center justify-between shrink-0 bg-[#181920]/80 backdrop-blur">
              <div>
                <h2 className="text-sm font-bold text-[#ECECF1]">{currentTabTitle}</h2>
                <p className="text-[11px] text-[#8E92A4]">{currentTabDesc}</p>
              </div>
              <div className="flex items-center gap-3">
                {statusMsg && (
                  <span className="text-xs text-emerald-400 font-medium animate-fade-in">
                    ✓ {statusMsg}
                  </span>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-[#ECECF1] text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Закрыть панель
                </button>
              </div>
            </div>

            {/* Scrollable Form Content */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <div className="max-w-2xl mx-auto">
                {activeTab === 'appearance' && renderAppearanceContent()}
                {activeTab === 'channels' && renderChannelsContent()}
                {activeTab === 'account' && renderAccountContent()}
                {activeTab === 'tts' && renderTTSContent()}
                {activeTab === 'filters' && renderFiltersContent()}
                {activeTab === 'widgets' && renderWidgetContent()}
              </div>
            </div>
          </section>
        </div>
      ) : (
        /* COMPACT MODE (Screenshot 2) */
        <>
          {/* Horizontal pill navigation */}
          <div className="flex items-center gap-1 px-3 py-2 bg-[#181920] border-b border-white/[0.04] overflow-x-auto no-scrollbar shrink-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0 ${
                    isActive
                      ? 'bg-[#3B82F6] text-white shadow-sm'
                      : 'text-[#8E92A4] hover:text-[#ECECF1] hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Compact Scrollable Content Area */}
          <main className="flex-1 overflow-y-auto px-3.5 py-3 space-y-4 custom-scrollbar">
            {activeTab === 'appearance' && renderAppearanceContent()}
            {activeTab === 'channels' && renderChannelsContent()}
            {activeTab === 'account' && renderAccountContent()}
            {activeTab === 'tts' && renderTTSContent()}
            {activeTab === 'filters' && renderFiltersContent()}
            {activeTab === 'widgets' && renderWidgetContent()}

            {statusMsg && (
              <div className="text-center text-xs text-[#3B82F6] font-mono py-1">
                {statusMsg}
              </div>
            )}
          </main>
        </>
      )}
    </div>
  );
}
