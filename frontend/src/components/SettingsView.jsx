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
  GetMusicWidgetURL,
  GetMusicWidgetThemes,
  GetCurrentTrack,
  SendTestMusicTrack,
  SendTestChatMessage,
  SendTestFollowMessage,
  OpenMusicThemesDir,
  TestProxyConnection,
  OpenAndImportWireGuardConf,
  WireGuardTunnelStatus,
} from '../../wailsjs/go/main/App';
import { WindowSetAlwaysOnTop, EventsOn, BrowserOpenURL } from '../../wailsjs/runtime/runtime';
import TwitchIcon from './TwitchIcon';
import CustomTitleBar from './CustomTitleBar';
import {
  Heart,
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
  Globe,
  Wifi,
  Music,
  Link,
  Palette,
  Code,
  Disc,
  Sparkles,
} from 'lucide-react';

const FONT_OPTIONS = [
  { id: 'Lato', label: 'Lato (Стандартный)' },
  { id: 'Inter', label: 'Inter (Современный)' },
  { id: 'Geist', label: 'Geist (Vercel)' },
  { id: 'Roboto', label: 'Roboto (Google)' },
  { id: 'JetBrains Mono', label: 'JetBrains Mono (Код)' },
];

const SPACING_OPTIONS = [
  { id: 'compact', label: 'Компактные строки' },
  { id: 'default', label: 'Стандартный отступ' },
  { id: 'relaxed', label: 'Свободный (Увеличенный)' },
];

const ALIGN_OPTIONS = [
  { id: 'left', label: 'По левому краю' },
  { id: 'center', label: 'По центру' },
  { id: 'right', label: 'По правому краю' },
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
    proxyEnabled: false,
    proxyType: 'http',
    proxyAddress: '127.0.0.1:7890',
    proxyAuth: false,
    proxyUser: '',
    proxyPassword: '',
    musicStyle: 'glass',
    musicAccentColor: 'emerald',
    musicShowCover: true,
    musicShowVisualizer: true,
    musicShowArtist: true,
    musicHideOnPause: true,
    musicPauseDelay: 3,
    musicScale: 100,
    musicBgOpacity: 85,
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
  const [isTestingProxy, setIsTestingProxy] = useState(false);
  const [proxyTestResult, setProxyTestResult] = useState(null);
  const [showProxyPassword, setShowProxyPassword] = useState(false);
  const [wgImportResult, setWgImportResult] = useState(null);
  const [isImportingWg, setIsImportingWg] = useState(false);
  const [wgTunnelActive, setWgTunnelActive] = useState(false);
  const [musicWidgetUrl, setMusicWidgetUrl] = useState('');
  const [musicThemes, setMusicThemes] = useState([]);
  const [selectedMusicTheme, setSelectedMusicTheme] = useState('default');
  const [chatCopyMode, setChatCopyMode] = useState('obs');
  const [musicCopyMode, setMusicCopyMode] = useState('obs');
  const [selectedChatTheme, setSelectedChatTheme] = useState('default');
  const [widgetSubTab, setWidgetSubTab] = useState('music');
  const [widgetsMenuOpen, setWidgetsMenuOpen] = useState(true);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [musicCopied, setMusicCopied] = useState(false);
  const [isTestingMusic, setIsTestingMusic] = useState(false);
  const [isTestingChat, setIsTestingChat] = useState(false);
  const ttsAudioRef = useRef(null);

  // Resize listener for responsive control panel adaptation
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isWide = windowWidth >= 650;

  useEffect(() => {
    WireGuardTunnelStatus()
      .then((status) => {
        if (status) {
          setWgTunnelActive(Boolean(status.active));
          if (status.endpoint || status.address) {
            setWgImportResult({
              success: true,
              endpoint: status.endpoint,
              address: status.address,
            });
          }
        }
      })
      .catch(() => {});

    GetSettings()
      .then((loaded) => {
        if (loaded) {
          setFormData((prev) => ({
            ...prev,
            ...loaded,
            fontFamily: loaded.fontFamily || 'Lato',
            showFollows: loaded.showFollows !== undefined ? Boolean(loaded.showFollows) : true,
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
            proxyEnabled: loaded.proxyEnabled !== undefined ? loaded.proxyEnabled : false,
            proxyType: loaded.proxyType || 'http',
            proxyAddress: loaded.proxyAddress || '127.0.0.1:7890',
            proxyAuth: !!loaded.proxyAuth,
            proxyUser: loaded.proxyUser || '',
            proxyPassword: loaded.proxyPassword || '',
            musicStyle: loaded.musicStyle || 'glass',
            musicAccentColor: loaded.musicAccentColor || 'emerald',
            musicShowCover: loaded.musicShowCover !== undefined ? loaded.musicShowCover : true,
            musicShowVisualizer: loaded.musicShowVisualizer !== undefined ? loaded.musicShowVisualizer : true,
            musicShowArtist: loaded.musicShowArtist !== undefined ? loaded.musicShowArtist : true,
            musicHideOnPause: loaded.musicHideOnPause !== undefined ? loaded.musicHideOnPause : true,
            musicPauseDelay: loaded.musicPauseDelay !== undefined ? loaded.musicPauseDelay : 3,
            musicScale: loaded.musicScale !== undefined ? loaded.musicScale : 100,
            musicBgOpacity: loaded.musicBgOpacity !== undefined ? loaded.musicBgOpacity : 85,
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
        showTimestamps: next.showTimestamps !== undefined ? Boolean(next.showTimestamps) : true,
        timestampFormat: next.timestampFormat || 'HH:MM:SS',
        showBadges: next.showBadges !== undefined ? Boolean(next.showBadges) : true,
        showFollows: next.showFollows !== undefined ? Boolean(next.showFollows) : true,
        channelBadgeMode: next.channelBadgeMode || 'name',
        iconColor: next.iconColor || 'purple',
        fontFamily: next.fontFamily || 'Lato',
        messageSpacing: next.messageSpacing || 'default',
        textAlign: next.textAlign || 'left',
        ttsVolume: parseFloat(next.ttsVolume) || 1.0,
        ttsSpeed: parseFloat(next.ttsSpeed) || 1.0,
        ignoredUsers: Array.isArray(next.ignoredUsers) ? next.ignoredUsers : [],
        proxyEnabled: Boolean(next.proxyEnabled),
        proxyType: next.proxyType || 'http',
        proxyAddress: next.proxyAddress || '',
        proxyAuth: Boolean(next.proxyAuth),
        proxyUser: next.proxyUser || '',
        proxyPassword: next.proxyPassword || '',
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

  const handleTestProxy = async () => {
    setIsTestingProxy(true);
    setProxyTestResult(null);
    try {
      const res = await TestProxyConnection(
        formData.proxyType || 'http',
        formData.proxyAddress || '',
        Boolean(formData.proxyAuth),
        formData.proxyUser || '',
        formData.proxyPassword || ''
      );
      setProxyTestResult(res);
    } catch (err) {
      setProxyTestResult({
        success: false,
        latency: 0,
        message: err?.message || String(err),
      });
    } finally {
      setIsTestingProxy(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'widgets') {
      const poll = () => {
        GetCurrentTrack().then((tr) => {
          if (tr) setCurrentTrack(tr);
        }).catch(() => {});
      };
      poll();
      const id = setInterval(poll, 2000);
      return () => clearInterval(id);
    }
  }, [activeTab]);

    const handleSendTestChat = async () => {
    setIsTestingChat(true);
    try {
      await SendTestChatMessage();
      setStatusMsg('Тестовое сообщение отправлено в OBS!');
      setTimeout(() => setStatusMsg(''), 2500);
    } catch (err) {
      console.error('Failed to send test chat message:', err);
    } finally {
      setTimeout(() => setIsTestingChat(false), 800);
    }
  };

  const [isTestingFollow, setIsTestingFollow] = useState(false);
  const handleSendTestFollow = async () => {
    setIsTestingFollow(true);
    try {
      await SendTestFollowMessage();
      setStatusMsg('Тестовый фолловер отправлен в чат!');
      setTimeout(() => setStatusMsg(''), 2500);
    } catch (err) {
      console.error('Failed to send test follow message:', err);
    } finally {
      setTimeout(() => setIsTestingFollow(false), 800);
    }
  };

  const handleSendTestMusic = async () => {
    setIsTestingMusic(true);
    try {
      await SendTestMusicTrack();
      const tr = await GetCurrentTrack();
      if (tr) setCurrentTrack(tr);
    } catch (err) {
      console.error('Failed to send test music track:', err);
    } finally {
      setTimeout(() => setIsTestingMusic(false), 800);
    }
  };

  const handleImportWireGuard = async () => {
    setIsImportingWg(true);
    setWgImportResult(null);
    try {
      const res = await OpenAndImportWireGuardConf();
      if (res && res.success) {
        setWgImportResult(res);
        setWgTunnelActive(true);
        setFormData((prev) => ({
          ...prev,
          proxyType: 'wireguard',
          proxyEnabled: true,
        }));
      } else {
        setWgImportResult({ success: false, error: res?.error || 'Не удалось импортировать файл' });
      }
    } catch (err) {
      setWgImportResult({ success: false, error: err?.message || String(err) });
    } finally {
      setIsImportingWg(false);
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
    if (size <= 12) return 'Компактный';
    if (size === 14) return 'Стандартный';
    if (size === 16) return 'Средний';
    if (size === 18) return 'Крупный';
    return 'Очень крупный';
  };

  const allTabsMetadata = [
    { id: 'appearance', label: 'Настройки чата', desc: 'Шрифты, размер текста, значки и окно', icon: Sliders },
    { id: 'channels', label: 'Каналы Twitch', desc: 'Подключенные каналы и чаты', icon: Radio },
    { id: 'account', label: 'Аккаунт', desc: 'Twitch OAuth и авторизация', icon: User },
    { id: 'tts', label: 'Озвучка (TTS)', desc: 'Яндекс Алиса и синтез речи', icon: Volume2 },
    { id: 'filters', label: 'Фильтры', desc: 'Игнор ботов, команд и пользователей', icon: Filter },
    { id: 'widgets', label: 'Виджеты OBS', desc: 'Каталог оверлеев для OBS Studio', icon: LayoutDashboard },
    { id: 'widget_chat', label: 'Виджет чата', desc: 'Оверлей сообщений чата Twitch', icon: Monitor },
    { id: 'widget_music', label: 'Виджет музыки', desc: 'Now Playing оверлей трека', icon: Music },
    { id: 'proxy', label: 'Прокси и Сеть', desc: 'HTTP, SOCKS5 и WireGuard', icon: Globe },
  ];

  const sidebarTabs = [
    { id: 'appearance', label: 'Настройки чата', desc: 'Шрифт, размер и значки', icon: Sliders },
    { id: 'channels', label: 'Каналы Twitch', desc: 'Подключенные каналы', icon: Radio },
    { id: 'account', label: 'Аккаунт', desc: 'Twitch OAuth', icon: User },
    { id: 'tts', label: 'Озвучка (TTS)', desc: 'Алиса и синтез речи', icon: Volume2 },
    { id: 'filters', label: 'Фильтры', desc: 'Команды и боты', icon: Filter },
    {
      id: 'widgets',
      label: 'Виджеты OBS',
      desc: 'Оверлеи для стрима',
      icon: LayoutDashboard,
      hasSubmenu: true,
      children: [
        { id: 'widgets', label: 'Каталог оверлеев', icon: LayoutDashboard },
        { id: 'widget_chat', label: 'Виджет чата', icon: Monitor, color: '#9146FF' },
        { id: 'widget_music', label: 'Виджет музыки', icon: Music, color: '#10B981' },
      ],
    },
    { id: 'proxy', label: 'Прокси и Сеть', desc: 'HTTP, SOCKS5, WireGuard', icon: Globe },
  ];

  const currentTabTitle = allTabsMetadata.find((t) => t.id === activeTab)?.label || 'Settings';
  const currentTabDesc = allTabsMetadata.find((t) => t.id === activeTab)?.desc || '';

  // Load widget info when any widget tab is opened
  useEffect(() => {
    if (activeTab === 'widgets' || activeTab === 'widget_chat' || activeTab === 'widget_music') {
      GetWidgetURL().then(setWidgetURL).catch(console.error);
      GetWidgetThemes().then(setWidgetThemes).catch(console.error);
      GetMusicWidgetURL().then(setMusicWidgetUrl).catch(console.error);
      GetMusicWidgetThemes().then(setMusicThemes).catch(console.error);
      GetCurrentTrack().then(setCurrentTrack).catch(console.error);
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

    const ACCENT_COLORS = [
    { id: 'emerald', label: 'Изумруд', hex: '#10B981', border: 'border-emerald-500', glow: 'rgba(16, 185, 129, 0.4)' },
    { id: 'purple',  label: 'Twitch', hex: '#9146FF', border: 'border-purple-500', glow: 'rgba(145, 70, 255, 0.4)' },
    { id: 'blue',    label: 'Сапфир', hex: '#3B82F6', border: 'border-blue-500', glow: 'rgba(59, 130, 246, 0.4)' },
    { id: 'pink',    label: 'Неон Пинк', hex: '#EC4899', border: 'border-pink-500', glow: 'rgba(236, 72, 153, 0.4)' },
    { id: 'amber',   label: 'Янтарь', hex: '#F59E0B', border: 'border-amber-500', glow: 'rgba(245, 158, 11, 0.4)' },
    { id: 'white',   label: 'Серебро', hex: '#F3F4F6', border: 'border-gray-300', glow: 'rgba(243, 244, 246, 0.4)' },
  ];

  const STYLES = [
    { id: 'glass', label: 'Glassmorphism', desc: 'Матовое стекло, блюр и глубина', icon: '💎' },
    { id: 'compact', label: 'Компактный Pill', desc: 'Узкая овальная плашка для стримов', icon: '💊' },
    { id: 'vinyl', label: 'Виниловая пластинка', desc: 'Вращающийся винил с конвертом', icon: '💿' },
    { id: 'retro98', label: 'Windows 98 Retro', desc: 'Классический винтажный плеер и пиксели', icon: '💾' },
    { id: 'aurora', label: 'Aurora Glow', desc: 'Анимированное северное сияние и аура', icon: '🌌' },
    { id: 'cassette', label: 'Аудиокассета 80-х', desc: 'Ретро-кассета с крутящимися бобинами', icon: '📼' },
    { id: 'cd', label: 'CD Jewel Case', desc: 'Глянцевый бокс компакт-диска с переливом', icon: '💽' },
    { id: 'neon', label: 'Неоновый кибер', desc: 'Яркие неоновые контуры и свечение', icon: '✨' },
    { id: 'spotify', label: 'Spotify Player', desc: 'Таймлайн прогресс-бар и классическая карточка', icon: '🎧' },
    { id: 'minimal', label: 'Минималистичный', desc: 'Чистый оверлей без рамок и фона', icon: '🍃' },
  ];

  // Tab: Widgets Hub (Каталог виджетов с кнопками-плитками)
  const renderWidgetsHubContent = () => {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-[#201a33] via-[#1a232c] to-[#142320] rounded-2xl p-5 border border-white/[0.06] shadow-sm relative overflow-hidden">
          <div className="relative z-10 space-y-1">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5 text-[#9146FF]" />
              <h3 className="text-sm font-bold text-[#ECECF1]">Каталог виджетов для OBS Studio</h3>
            </div>
            <p className="text-xs text-[#8E92A4] leading-relaxed max-w-xl">
              Легковесные анимированные веб-оверлеи, работающие локально через Server-Sent Events (SSE). 
              Нажмите на плитку виджета, чтобы перейти к его индивидуальным настройкам, или скопируйте ссылку в один клик.
            </p>
          </div>
          <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
        </div>

        {/* TILES GRID (Кнопки-плитки для перехода в настройку каждого виджета) */}
        <div>
          <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-3 flex items-center justify-between">
            <span>ДОСТУПНЫЕ ВИДЖЕТЫ</span>
            <span className="text-[11px] text-[#6C7082] font-mono">PORT: 3500 // LOCAL SERVER</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* TILE 1: ЧАТ ДЛЯ СТРИМА */}
            <div
              className="relative p-5 rounded-2xl border border-white/[0.06] hover:border-[#9146FF]/60 bg-gradient-to-b from-[#1e1a29] to-[#161420] hover:shadow-[0_0_28px_rgba(145,70,255,0.18)] transition-all duration-200 flex flex-col justify-between gap-4 group cursor-pointer"
              onClick={() => setActiveTab('widget_chat')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveTab('widget_chat')}
            >
              <div className="space-y-3">
                {/* Header Row */}
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#9146FF] to-[#7c3aed] flex items-center justify-center text-white shadow-lg shadow-purple-500/25 group-hover:scale-105 transition-transform">
                    <Monitor className="w-6 h-6" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#9146FF]/20 text-[#c084fc] border border-[#9146FF]/35">
                      CHAT OVERLAY
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div>
                  <h4 className="text-base font-bold text-[#ECECF1] group-hover:text-purple-300 transition-colors flex items-center gap-2">
                    <span>Виджет чата</span>
                  </h4>
                  <p className="text-xs text-[#8E92A4] mt-1.5 leading-relaxed">
                    Плавный оверлей сообщений Twitch с поддержкой ников, цветных значков, смайликов и кастомных тем оформления.
                  </p>
                </div>

                {/* Feature tags */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="px-2 py-0.5 rounded-md bg-white/[0.04] text-[10px] font-mono text-[#a855f7] border border-purple-500/20">
                    /widget/chat
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-white/[0.04] text-[10px] text-[#8E92A4]">
                    SSE Hot-Reload
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-white/[0.04] text-[10px] text-[#8E92A4]">
                    HTML/CSS Темы
                  </span>
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="pt-3 border-t border-white/[0.06] flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setActiveTab('widget_chat')}
                  className="flex-1 py-2 px-3 bg-[#9146FF] hover:bg-[#7c3aed] active:bg-[#6d28d9] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Настроить виджет</span>
                  <span>→</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(widgetURL || 'http://localhost:3500/widget/chat');
                    setUrlCopied(true);
                    setTimeout(() => setUrlCopied(false), 2000);
                  }}
                  title="Скопировать ссылку для OBS"
                  className="p-2 bg-white/[0.05] hover:bg-white/[0.1] text-[#ECECF1] rounded-xl border border-white/[0.06] text-xs transition-all cursor-pointer flex items-center gap-1"
                >
                  {urlCopied ? <Check className="w-4 h-4 text-purple-400" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={handleSendTestChat}
                  disabled={isTestingChat}
                  title="Отправить тестовое сообщение"
                  className="p-2 bg-white/[0.05] hover:bg-white/[0.1] text-[#ECECF1] rounded-xl border border-white/[0.06] text-xs transition-all cursor-pointer flex items-center gap-1"
                >
                  {isTestingChat ? <Loader2 className="w-4 h-4 animate-spin text-purple-400" /> : <Play className="w-4 h-4 text-purple-400" />}
                </button>
              </div>
            </div>

            {/* TILE 2: МУЗЫКА (NOW PLAYING) */}
            <div
              className="relative p-5 rounded-2xl border border-white/[0.06] hover:border-[#10B981]/60 bg-gradient-to-b from-[#18231e] to-[#121915] hover:shadow-[0_0_28px_rgba(16,185,129,0.18)] transition-all duration-200 flex flex-col justify-between gap-4 group cursor-pointer"
              onClick={() => setActiveTab('widget_music')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveTab('widget_music')}
            >
              <div className="space-y-3">
                {/* Header Row */}
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#10B981] to-[#059669] flex items-center justify-center text-white shadow-lg shadow-emerald-500/25 group-hover:scale-105 transition-transform">
                    <Music className="w-6 h-6" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#10B981]/20 text-[#6ee7b7] border border-[#10B981]/35">
                      NOW PLAYING
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div>
                  <h4 className="text-base font-bold text-[#ECECF1] group-hover:text-emerald-300 transition-colors flex items-center gap-2">
                    <span>Виджет музыки</span>
                  </h4>
                  <p className="text-xs text-[#8E92A4] mt-1.5 leading-relaxed">
                    Оверлей текущей музыки из Spotify, Яндекс Музыки, VK и браузеров с обложкой, стилями Glass/Vinyl/Neon и эквалайзером.
                  </p>
                </div>

                {/* Feature tags */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="px-2 py-0.5 rounded-md bg-white/[0.04] text-[10px] font-mono text-emerald-400 border border-emerald-500/20">
                    /widget/music
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-white/[0.04] text-[10px] text-[#8E92A4]">
                    {currentTrack?.status === 'playing' ? `▶ ${currentTrack.title?.slice(0, 16) || 'Играет'}` : '⏸ Пауза'}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-white/[0.04] text-[10px] text-[#8E92A4] capitalize">
                    {formData.musicStyle || 'glass'}
                  </span>
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="pt-3 border-t border-white/[0.06] flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setActiveTab('widget_music')}
                  className="flex-1 py-2 px-3 bg-[#10B981] hover:bg-emerald-600 active:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Настроить виджет</span>
                  <span>→</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(musicWidgetUrl || 'http://localhost:3500/widget/music');
                    setMusicCopied(true);
                    setTimeout(() => setMusicCopied(false), 2000);
                  }}
                  title="Скопировать ссылку для OBS"
                  className="p-2 bg-white/[0.05] hover:bg-white/[0.1] text-[#ECECF1] rounded-xl border border-white/[0.06] text-xs transition-all cursor-pointer flex items-center gap-1"
                >
                  {musicCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={handleSendTestMusic}
                  disabled={isTestingMusic}
                  title="Отправить тестовый трек в OBS"
                  className="p-2 bg-white/[0.05] hover:bg-white/[0.1] text-[#ECECF1] rounded-xl border border-white/[0.06] text-xs transition-all cursor-pointer flex items-center gap-1"
                >
                  {isTestingMusic ? <Loader2 className="w-4 h-4 animate-spin text-emerald-400" /> : <Play className="w-4 h-4 text-emerald-400" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Help Section */}
        <div className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] shadow-sm text-xs text-[#8E92A4] space-y-2">
          <div className="font-semibold text-[#ECECF1] flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#3B82F6]" />
            <span>Интеграция с OBS Studio</span>
          </div>
          <p className="leading-relaxed text-[11px]">
            В OBS добавьте источник типа <strong>«Браузер»</strong> и вставьте ссылку нужного виджета. Все виджеты подключаются к локальному SSE серверу на порту 3500. При любых изменениях настроек в ReChat оверлеи обновляются в реальном времени без перезапуска источников.
          </p>
        </div>
      </div>
    );
  };

  // Tab: Chat Widget (Отдельная вкладка детальной настройки чата)
  const renderChatWidgetContent = () => {
    const currentTheme = selectedChatTheme || widgetThemes[0] || 'default';
    const baseUrl = widgetURL || 'http://localhost:3500/widget/chat';

    const getChatCopyContent = () => {
      if (chatCopyMode === 'obs') return baseUrl;
      if (chatCopyMode === 'theme') return `${baseUrl}?theme=${currentTheme}`;
      if (chatCopyMode === 'css') {
        return `/* OBS Browser Custom CSS */
body {
  background-color: rgba(0, 0, 0, 0) !important;
  margin: 0px auto !important;
  overflow: hidden !important;
}`;
      }
      if (chatCopyMode === 'iframe') {
        return `<iframe src="${baseUrl}" width="450" height="700" frameborder="0" allowtransparency="true"></iframe>`;
      }
      return baseUrl;
    };

    const chatCopyText = getChatCopyContent();

    return (
      <div className="space-y-5 animate-fade-in">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('widgets')}
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#8E92A4] hover:text-[#ECECF1] px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.04] transition-all cursor-pointer"
          >
            <span>← Все виджеты</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#9146FF]/20 text-[#c084fc] border border-[#9146FF]/40">
              <span className="w-1.5 h-1.5 rounded-full bg-[#9146FF] animate-pulse" />
              <span>Оверлей чата</span>
            </span>
          </div>
        </div>

        {/* Live Chat Preview Canvas */}
        <div>
          <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5 flex items-center justify-between">
            <span>Предпросмотр чата (OBS Stream Overlay)</span>
            <span className="text-[11px] text-[#6C7082] font-mono">ТЕМА: {currentTheme}</span>
          </div>
          <div className="relative rounded-2xl border border-white/[0.08] p-4 overflow-hidden min-h-[170px] bg-[#12131a] bg-[radial-gradient(#1f2233_1px,transparent_1px)] [background-size:16px_16px] flex flex-col justify-end gap-2.5">
            {/* Simulated Message 1: Broadcaster */}
            <div className="flex items-start gap-2.5 bg-[#101118]/75 border border-white/[0.06] rounded-xl p-2.5 backdrop-blur-md max-w-md shadow-lg">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#9146FF] to-[#7c3aed] flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
                SH
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center px-1 rounded bg-[#9146FF] text-[9px] font-bold text-white uppercase">
                    STREAMER
                  </span>
                  <span className="text-xs font-bold text-[#a855f7]">StreamHero</span>
                  <span className="text-[10px] text-[#6C7082] font-mono">15:04</span>
                </div>
                <div className="text-xs text-[#ECECF1] mt-0.5 leading-snug">
                  Всем привет! Оверлей чата подключен и работает в реальном времени ✨ 👋
                </div>
              </div>
            </div>

            {/* Simulated Message 2: VIP / Subscriber */}
            <div className="flex items-start gap-2.5 bg-[#101118]/75 border border-white/[0.06] rounded-xl p-2.5 backdrop-blur-md max-w-md shadow-lg">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#10B981] to-[#059669] flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
                KP
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center px-1 rounded bg-[#10B981] text-[9px] font-bold text-white uppercase">
                    SUB 12M
                  </span>
                  <span className="text-xs font-bold text-[#10B981]">KappaKing</span>
                  <span className="text-[10px] text-[#6C7082] font-mono">15:04</span>
                </div>
                <div className="text-xs text-[#ECECF1] mt-0.5 leading-snug">
                  Поддерживаю! Красивая плашка с полупрозрачным фоном 🚀
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* OBS Integration Link Card with Dropdown Selectors */}
        <div className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-[#ECECF1] flex items-center gap-2">
                <Monitor className="w-4 h-4 text-[#9146FF]" />
                <span>Интеграция чата с OBS Studio</span>
              </div>
              <div className="text-[11px] text-[#8E92A4] mt-0.5">
                Выберите тему оформления и формат ссылки в выпадающих меню, затем скопируйте.
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-purple-500/15 text-purple-300 border border-purple-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-[#9146FF] animate-pulse" />
              <span>Порт 3500</span>
            </span>
          </div>

          {/* 2 Dropdown Menus: Theme & Copy Format */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Dropdown 1: Выбор темы */}
            <div>
              <label className="block text-xs font-semibold text-[#8E92A4] mb-1.5">
                Тема оформления (каталог themes/chat):
              </label>
              <div className="relative">
                <select
                  value={selectedChatTheme}
                  onChange={(e) => {
                    setSelectedChatTheme(e.target.value);
                    if (chatCopyMode === 'obs') {
                      setChatCopyMode('theme');
                    }
                  }}
                  className="w-full appearance-none bg-[#181920] hover:bg-[#1E202B] text-xs text-[#ECECF1] font-medium py-2 pl-3 pr-8 rounded-xl border border-white/[0.06] outline-none cursor-pointer focus:border-[#9146FF]"
                >
                  {widgetThemes.length === 0 ? (
                    <option value="default">default (Стандартная тема)</option>
                  ) : (
                    widgetThemes.map((theme) => (
                      <option key={theme} value={theme}>
                        {theme === 'default' ? 'default (Стандартная тема)' : theme}
                      </option>
                    ))
                  )}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-[#8E92A4] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Dropdown 2: Формат ссылки / что скопировать */}
            <div>
              <label className="block text-xs font-semibold text-[#8E92A4] mb-1.5">
                Что скопировать (Формат ссылки):
              </label>
              <div className="relative">
                <select
                  value={chatCopyMode}
                  onChange={(e) => setChatCopyMode(e.target.value)}
                  className="w-full appearance-none bg-[#181920] hover:bg-[#1E202B] text-xs text-[#ECECF1] font-medium py-2 pl-3 pr-8 rounded-xl border border-white/[0.06] outline-none cursor-pointer focus:border-[#9146FF]"
                >
                  <option value="obs">Ссылка для OBS (По умолчанию)</option>
                  <option value="theme">Ссылка с выбранной темой (?theme={currentTheme})</option>
                  <option value="css">Пользовательский CSS для OBS</option>
                  <option value="iframe">HTML iFrame Embed</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-[#8E92A4] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Value Display and Copy Button */}
          <div className="flex gap-2 items-stretch">
            {chatCopyMode === 'css' ? (
              <textarea
                readOnly
                rows={3}
                value={chatCopyText}
                className="flex-1 bg-[#181920] border border-white/[0.06] rounded-xl px-3.5 py-2 text-xs text-[#ECECF1] font-mono select-all focus:outline-none resize-none leading-relaxed"
              />
            ) : (
              <input
                type="text"
                readOnly
                value={chatCopyText}
                className="flex-1 bg-[#181920] border border-white/[0.06] rounded-xl px-3.5 py-2 text-xs text-[#ECECF1] font-mono select-all focus:outline-none"
              />
            )}
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(chatCopyText);
                setUrlCopied(true);
                setTimeout(() => setUrlCopied(false), 2000);
              }}
              className="px-4 py-2 bg-[#9146FF] hover:bg-[#7c3aed] active:bg-[#6d28d9] text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              {urlCopied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{urlCopied ? 'Скопировано!' : 'Копировать'}</span>
            </button>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-0.5">
            <button
              type="button"
              onClick={handleSendTestChat}
              disabled={isTestingChat}
              className="px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] active:bg-white/[0.14] text-[#ECECF1] rounded-xl text-xs font-semibold border border-white/[0.06] transition-all cursor-pointer flex items-center gap-1.5"
            >
              {isTestingChat ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 text-[#9146FF]" />}
              <span>Тестовое сообщение</span>
            </button>
            <button
              type="button"
              onClick={handleSendTestFollow}
              disabled={isTestingFollow}
              className="px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] active:bg-white/[0.14] text-[#ECECF1] rounded-xl text-xs font-semibold border border-white/[0.06] transition-all cursor-pointer flex items-center gap-1.5"
            >
              {isTestingFollow ? <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" /> : <Heart className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400/20" />}
              <span>Тест фолловера</span>
            </button>
            <button
              type="button"
              onClick={() => BrowserOpenURL(selectedChatTheme && selectedChatTheme !== 'default' ? `${baseUrl}?theme=${selectedChatTheme}` : baseUrl)}
              className="px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-[#ECECF1] rounded-xl text-xs font-semibold border border-white/[0.06] transition-all cursor-pointer flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              <span>Открыть в браузере</span>
            </button>
            <button
              type="button"
              onClick={OpenThemesDir}
              className="px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-[#ECECF1] rounded-xl text-xs font-semibold border border-white/[0.06] transition-all cursor-pointer flex items-center gap-1.5"
            >
              <FolderOpen className="w-3.5 h-3.5 opacity-70" />
              <span>Папка тем чата (themes/chat)</span>
            </button>
          </div>

          <div className="border-t border-white/[0.04] pt-3">
            <p className="text-xs text-[#8E92A4] leading-relaxed">
              Все темы чата хранятся в папке <code className="text-[#a855f7] font-mono">themes/chat/</code> (файлы <code className="text-[#a855f7] font-mono">index.html</code> и <code className="text-[#a855f7] font-mono">style.css</code>) и изолированы от виджета музыки. Создайте новую папку внутри <code className="text-[#a855f7] font-mono">themes/chat/</code>, чтобы добавить свою тему!
            </p>
          </div>
        </div>

        {/* Quick OBS Setup Guide */}
        <div>
          <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">Как подключить в OBS Studio</div>
          <div className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] shadow-sm space-y-2.5 text-xs text-[#8E92A4]">
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-white/[0.06] text-[#ECECF1] text-[11px] font-bold flex items-center justify-center shrink-0">1</span>
              <span>В OBS в панели «Источники» нажмите <strong>+</strong> и выберите <strong>«Браузер»</strong>.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-white/[0.06] text-[#ECECF1] text-[11px] font-bold flex items-center justify-center shrink-0">2</span>
              <span>Вставьте скопированный URL в поле адреса и задайте разрешение (рекомендуется: ширина <strong>450</strong>, высота <strong>700</strong>).</span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-white/[0.06] text-[#ECECF1] text-[11px] font-bold flex items-center justify-center shrink-0">3</span>
              <span>Включите галочку <em>«Обновлять браузер, когда сцена становится активной»</em> и нажмите ОК.</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Tab: Music Widget (Отдельная вкладка детальной настройки музыки)
  const renderMusicWidgetContent = () => {
    const previewTrack = currentTrack?.title ? currentTrack : {
      title: 'Never Gonna Give You Up',
      artist: 'Rick Astley',
      album: 'Whenever You Need Somebody',
      status: 'playing',
      source: 'Spotify.exe'
    };

    const activeAccent = ACCENT_COLORS.find(c => c.id === (formData.musicAccentColor || 'emerald')) || ACCENT_COLORS[0];
    const currentMusicTheme = selectedMusicTheme || musicThemes[0] || 'default';
    const baseMusicUrl = musicWidgetUrl || 'http://localhost:3500/widget/music';

    const getMusicCopyContent = () => {
      if (musicCopyMode === 'obs') return baseMusicUrl;
      if (musicCopyMode === 'theme') return `${baseMusicUrl}?theme=${currentMusicTheme}`;
      if (musicCopyMode === 'preset') {
        const style = formData.musicStyle || 'glass';
        const accent = formData.musicAccentColor || 'emerald';
        const scale = formData.musicScale || 100;
        return `${baseMusicUrl}?theme=${currentMusicTheme}&style=${style}&accent=${accent}&scale=${scale}`;
      }
      if (musicCopyMode === 'css') {
        return `/* OBS Browser Custom CSS for Music Overlay */
body {
  background-color: rgba(0, 0, 0, 0) !important;
  margin: 0px auto !important;
  overflow: hidden !important;
}`;
      }
      if (musicCopyMode === 'iframe') {
        return `<iframe src="${baseMusicUrl}?theme=${currentMusicTheme}" width="480" height="160" frameborder="0" allowtransparency="true"></iframe>`;
      }
      return baseMusicUrl;
    };

    const musicCopyText = getMusicCopyContent();

    return (
      <div className="space-y-5 animate-fade-in">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('widgets')}
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#8E92A4] hover:text-[#ECECF1] px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.04] transition-all cursor-pointer"
          >
            <span>← Все виджеты</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#10B981]/20 text-[#6ee7b7] border border-[#10B981]/40">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
              <span>Оверлей музыки</span>
            </span>
          </div>
        </div>

        {/* Interactive Live Preview Canvas */}
        <div>
          <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5 flex items-center justify-between">
            <span>Предпросмотр виджета (Live Preview)</span>
            <span className="text-[11px] text-[#6C7082]">Масштаб: {formData.musicScale || 100}%</span>
          </div>
          <div className="relative rounded-2xl border border-white/[0.08] p-6 overflow-hidden flex items-center justify-center min-h-[140px] bg-[#12131a] bg-[radial-gradient(#1f2233_1px,transparent_1px)] [background-size:16px_16px]">
            {/* Scaled Preview Widget Element */}
            <div
              style={{
                transform: `scale(${((formData.musicScale || 100) / 100)})`,
                transformOrigin: 'center center',
                transition: 'all 0.3s ease'
              }}
            >
              <div
                className={`flex items-center gap-3.5 transition-all ${
                  formData.musicStyle === 'compact'
                    ? 'py-1.5 px-4 rounded-full border'
                    : formData.musicStyle === 'neon'
                    ? 'p-3 rounded-2xl border'
                    : formData.musicStyle === 'minimal'
                    ? 'p-2'
                    : 'p-3 rounded-2xl border'
                }`}
                style={{
                  background: formData.musicStyle === 'minimal'
                    ? 'transparent'
                    : `rgba(18, 20, 29, ${(formData.musicBgOpacity !== undefined ? formData.musicBgOpacity : 85) / 100})`,
                  backdropFilter: formData.musicStyle === 'minimal' ? 'none' : 'blur(20px)',
                  borderColor: formData.musicStyle === 'neon'
                    ? activeAccent.hex
                    : 'rgba(255, 255, 255, 0.08)',
                  boxShadow: formData.musicStyle === 'neon'
                    ? `0 0 20px ${activeAccent.glow}, inset 0 0 10px ${activeAccent.glow}`
                    : formData.musicStyle === 'minimal'
                    ? 'none'
                    : '0 12px 32px -4px rgba(0,0,0,0.6)',
                  maxWidth: '420px',
                  minWidth: '270px'
                }}
              >
                {/* Vinyl Record */}
                {(formData.musicStyle === 'vinyl' || selectedMusicTheme === 'vinyl') && (
                  <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
                    <div
                      className="w-12 h-12 rounded-full absolute -right-2 top-0 shadow-lg border border-black/50 animate-spin"
                      style={{
                        background: 'repeating-radial-gradient(#111, #111 2px, #222 3px, #111 4px)',
                        animationDuration: '5s'
                      }}
                    >
                      <div
                        className="w-3.5 h-3.5 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                        style={{ background: activeAccent.hex }}
                      />
                    </div>
                  </div>
                )}

                {/* Cassette Spools */}
                {selectedMusicTheme === 'cassette' && (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0f1118] border border-white/10 shrink-0">
                    <div className="w-4 h-4 rounded-full bg-[#e5e7eb] flex items-center justify-center animate-spin shadow-sm" style={{ animationDuration: '2.5s' }}>
                      <div className="w-1 h-1 rounded-full bg-[#111]" />
                    </div>
                    <div className="w-3.5 h-1 bg-[#5b3829] rounded-sm" />
                    <div className="w-4 h-4 rounded-full bg-[#e5e7eb] flex items-center justify-center animate-spin shadow-sm" style={{ animationDuration: '2.5s' }}>
                      <div className="w-1 h-1 rounded-full bg-[#111]" />
                    </div>
                  </div>
                )}

                {/* Album Cover */}
                {formData.musicShowCover && (
                  <div className={`relative shrink-0 overflow-hidden shadow-md bg-[#1e2130] z-10 ${
                    formData.musicStyle === 'compact' ? 'w-9 h-9 rounded-full' : 'w-12 h-12 rounded-xl'
                  }`}>
                    {previewTrack.thumbnail ? (
                      <img src={previewTrack.thumbnail} alt="Cover" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ color: activeAccent.hex }}>
                        <Music className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                )}

                {/* Track Typography */}
                <div className="min-w-0 flex-1 z-10">
                  <div
                    className="text-xs font-bold text-[#f1f3f9] truncate"
                    style={{ textShadow: formData.musicStyle === 'neon' ? `0 0 10px ${activeAccent.glow}` : 'none' }}
                  >
                    {previewTrack.title}
                  </div>
                  {formData.musicShowArtist && (
                    <div className="text-[11px] font-medium text-[#8c93a8] truncate mt-0.5">
                      {previewTrack.artist || previewTrack.album}
                    </div>
                  )}
                </div>

                {/* Equalizer Visualizer Bars */}
                {formData.musicShowVisualizer && (
                  <div className="flex items-end gap-1 h-4 pl-1 shrink-0 z-10">
                    {[14, 18, 10, 16].map((h, i) => (
                      <span
                        key={i}
                        className="w-1 rounded-full animate-pulse"
                        style={{
                          height: `${h}px`,
                          backgroundColor: activeAccent.hex,
                          boxShadow: `0 0 6px ${activeAccent.glow}`,
                          animationDelay: `${i * 0.15}s`
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* OBS Integration Link Card with Dropdown Selectors */}
        <div className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-[#ECECF1] flex items-center gap-2">
                <Music className="w-4 h-4 text-[#10B981]" />
                <span>Интеграция музыки с OBS Studio</span>
              </div>
              <div className="text-[11px] text-[#8E92A4] mt-0.5">
                Выберите тему оформления и формат ссылки в выпадающих меню, затем скопируйте.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Порт 3500</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono text-[#8E92A4] bg-white/[0.04]">
                themes/music
              </span>
            </div>
          </div>

          {/* 2 Dropdown Menus: Theme & Copy Format */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Dropdown 1: Выбор темы */}
            <div>
              <label className="block text-xs font-semibold text-[#8E92A4] mb-1.5">
                Тема оформления (каталог themes/music):
              </label>
              <div className="relative">
                <select
                  value={selectedMusicTheme}
                  onChange={(e) => {
                    setSelectedMusicTheme(e.target.value);
                    if (musicCopyMode === 'obs') {
                      setMusicCopyMode('theme');
                    }
                  }}
                  className="w-full appearance-none bg-[#181920] hover:bg-[#1E202B] text-xs text-[#ECECF1] font-medium py-2 pl-3 pr-8 rounded-xl border border-white/[0.06] outline-none cursor-pointer focus:border-[#10B981]"
                >
                  {musicThemes.length === 0 ? (
                    <option value="default">💎 default (Glassmorphism)</option>
                  ) : (
                    musicThemes.map((theme) => {
                      const themeLabels = {
                        default: '💎 default (Glassmorphism)',
                        retro98: '💾 retro98 (Windows 98 Retro)',
                        vinyl: '💿 vinyl (Виниловая пластинка)',
                        compact: '💊 compact (Компактный Pill)',
                        cyberpunk: '⚡ cyberpunk (Cyberpunk HUD)',
                        cassette: '📼 cassette (Ретро-кассета Lo-Fi)',
                      };
                      return (
                        <option key={theme} value={theme}>
                          {themeLabels[theme] || `🎵 ${theme}`}
                        </option>
                      );
                    })
                  )}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-[#8E92A4] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Dropdown 2: Формат ссылки / что скопировать */}
            <div>
              <label className="block text-xs font-semibold text-[#8E92A4] mb-1.5">
                Что скопировать (Формат ссылки):
              </label>
              <div className="relative">
                <select
                  value={musicCopyMode}
                  onChange={(e) => setMusicCopyMode(e.target.value)}
                  className="w-full appearance-none bg-[#181920] hover:bg-[#1E202B] text-xs text-[#ECECF1] font-medium py-2 pl-3 pr-8 rounded-xl border border-white/[0.06] outline-none cursor-pointer focus:border-[#10B981]"
                >
                  <option value="obs">Ссылка для OBS (По умолчанию)</option>
                  <option value="theme">Ссылка с выбранной темой (?theme={currentMusicTheme})</option>
                  <option value="preset">Ссылка с темой и пресетом стиля</option>
                  <option value="css">Пользовательский CSS для OBS</option>
                  <option value="iframe">HTML iFrame Embed</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-[#8E92A4] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Value Display and Copy Button */}
          <div className="flex gap-2 items-stretch">
            {musicCopyMode === 'css' ? (
              <textarea
                readOnly
                rows={3}
                value={musicCopyText}
                className="flex-1 bg-[#181920] border border-white/[0.06] rounded-xl px-3.5 py-2 text-xs text-[#ECECF1] font-mono select-all focus:outline-none resize-none leading-relaxed"
              />
            ) : (
              <input
                type="text"
                readOnly
                value={musicCopyText}
                className="flex-1 bg-[#181920] border border-white/[0.06] rounded-xl px-3.5 py-2 text-xs text-[#ECECF1] font-mono select-all focus:outline-none"
              />
            )}
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(musicCopyText);
                setMusicCopied(true);
                setTimeout(() => setMusicCopied(false), 2000);
              }}
              className="px-4 py-2 bg-[#10B981] hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              {musicCopied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{musicCopied ? 'Скопировано!' : 'Копировать'}</span>
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-0.5">
            <button
              type="button"
              onClick={handleSendTestMusic}
              disabled={isTestingMusic}
              className="px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] active:bg-white/[0.14] text-[#ECECF1] rounded-xl text-xs font-semibold border border-white/[0.06] transition-all cursor-pointer flex items-center gap-1.5"
            >
              {isTestingMusic ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 text-[#10B981]" />}
              <span>Отправить тестовый трек в OBS</span>
            </button>
            <button
              type="button"
              onClick={() => BrowserOpenURL(currentMusicTheme !== 'default' ? `${baseMusicUrl}?theme=${currentMusicTheme}` : baseMusicUrl)}
              className="px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-[#ECECF1] rounded-xl text-xs font-semibold border border-white/[0.06] transition-all cursor-pointer flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              <span>Открыть тему в браузере</span>
            </button>
            <button
              type="button"
              onClick={OpenMusicThemesDir}
              className="px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-[#ECECF1] rounded-xl text-xs font-semibold border border-white/[0.06] transition-all cursor-pointer flex items-center gap-1.5"
            >
              <FolderOpen className="w-3.5 h-3.5 opacity-70" />
              <span>Папка тем музыки (themes/music)</span>
            </button>
          </div>

          <div className="border-t border-white/[0.04] pt-3">
            <p className="text-xs text-[#8E92A4] leading-relaxed">
              Все темы музыки хранятся в папке <code className="text-emerald-400 font-mono">themes/music/</code> (файлы <code className="text-emerald-400 font-mono">index.html</code> и <code className="text-emerald-400 font-mono">style.css</code>) и строго отделены от тем чата. Создайте новую папку внутри <code className="text-emerald-400 font-mono">themes/music/</code>, чтобы добавить свою тему без изменения кода!
            </p>
          </div>
        </div>

        {/* Visual Presets */}
        <div>
          <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">Стиль оформления (Preset)</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {STYLES.map((st) => {
              const isSelected = (formData.musicStyle || 'glass') === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => updateAndSave({ musicStyle: st.id })}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                    isSelected
                      ? 'bg-[#10B981]/10 border-[#10B981] text-white shadow-md'
                      : 'bg-[#242631] border-white/[0.04] text-[#8E92A4] hover:text-[#ECECF1] hover:bg-[#2A2D3A]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base">{st.icon}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#10B981]" />}
                  </div>
                  <div>
                    <div className={`text-xs font-semibold ${isSelected ? 'text-white' : 'text-[#ECECF1]'}`}>
                      {st.label}
                    </div>
                    <div className="text-[10px] text-[#8E92A4] mt-0.5 leading-snug">
                      {st.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Accent Color Picker */}
        <div>
          <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">Акцентный цвет свечения и эквалайзера</div>
          <div className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] shadow-sm">
            <div className="flex flex-wrap gap-3">
              {ACCENT_COLORS.map((col) => {
                const isSelected = (formData.musicAccentColor || 'emerald') === col.id;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => updateAndSave({ musicAccentColor: col.id })}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#181920] text-white shadow-sm border-white/20'
                        : 'bg-[#181920]/60 border-white/[0.04] text-[#8E92A4] hover:text-[#ECECF1]'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                      style={{
                        backgroundColor: col.hex,
                        boxShadow: isSelected ? `0 0 8px ${col.glow}` : 'none'
                      }}
                    />
                    <span className="text-xs font-medium">{col.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Interactive Elements Toggles */}
        <div>
          <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">Отображение элементов</div>
          <div className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] shadow-sm divide-y divide-white/[0.04]">
            {/* Album Cover Toggle */}
            <div className="flex items-center justify-between pb-3">
              <div>
                <div className="text-xs font-medium text-[#ECECF1]">Обложка альбома</div>
                <div className="text-[11px] text-[#8E92A4]">Показывать обложку текущего трека</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.musicShowCover !== false}
                  onChange={(e) => updateAndSave({ musicShowCover: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-[#181920] border border-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#10B981]" />
              </label>
            </div>

            {/* Artist Toggle */}
            <div className="flex items-center justify-between py-3">
              <div>
                <div className="text-xs font-medium text-[#ECECF1]">Исполнитель и альбом</div>
                <div className="text-[11px] text-[#8E92A4]">Показывать автора под названием трека</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.musicShowArtist !== false}
                  onChange={(e) => updateAndSave({ musicShowArtist: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-[#181920] border border-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#10B981]" />
              </label>
            </div>

            {/* Visualizer Bars Toggle */}
            <div className="flex items-center justify-between py-3">
              <div>
                <div className="text-xs font-medium text-[#ECECF1]">Анимированный эквалайзер</div>
                <div className="text-[11px] text-[#8E92A4]">Анимированные полосы звука в цвет акцента</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.musicShowVisualizer !== false}
                  onChange={(e) => updateAndSave({ musicShowVisualizer: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-[#181920] border border-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#10B981]" />
              </label>
            </div>

            {/* Hide On Pause */}
            <div className="flex items-center justify-between py-3">
              <div>
                <div className="text-xs font-medium text-[#ECECF1]">Скрывать при паузе</div>
                <div className="text-[11px] text-[#8E92A4]">Плавно прятать виджет, когда музыка остановлена</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.musicHideOnPause !== false}
                  onChange={(e) => updateAndSave({ musicHideOnPause: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-[#181920] border border-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#10B981]" />
              </label>
            </div>

            {/* Pause Delay */}
            {formData.musicHideOnPause !== false && (
              <div className="flex items-center justify-between pt-3">
                <div>
                  <div className="text-xs font-medium text-[#ECECF1]">Задержка скрытия (сек)</div>
                  <div className="text-[11px] text-[#8E92A4]">Сколько секунд ждать перед скрытием виджета</div>
                </div>
                <div className="flex items-center gap-1.5">
                  {[0, 3, 5, 10].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => updateAndSave({ musicPauseDelay: sec })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                        (formData.musicPauseDelay ?? 3) === sec
                          ? 'bg-[#10B981] text-white border-[#10B981]'
                          : 'bg-[#181920] border-white/[0.04] text-[#8E92A4] hover:text-[#ECECF1]'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Geometry: Scale & Opacity */}
        <div>
          <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">Геометрия и прозрачность</div>
          <div className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] shadow-sm space-y-4">
            {/* Scale buttons */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#8E92A4]">Масштаб виджета</span>
                <span className="font-mono text-[#ECECF1] font-semibold">{formData.musicScale || 100}%</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[80, 100, 120, 140].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => updateAndSave({ musicScale: s })}
                    className={`py-1.5 px-1 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                      (formData.musicScale || 100) === s
                        ? 'bg-[#10B981]/15 border-[#10B981] text-white'
                        : 'bg-[#181920] border-white/[0.04] text-[#8E92A4] hover:text-[#ECECF1]'
                    }`}
                  >
                    {s}%
                  </button>
                ))}
              </div>
            </div>

            {/* Opacity slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#8E92A4]">Прозрачность фона</span>
                <span className="font-mono text-[#ECECF1] font-semibold">{formData.musicBgOpacity !== undefined ? formData.musicBgOpacity : 85}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={formData.musicBgOpacity !== undefined ? formData.musicBgOpacity : 85}
                onChange={(e) => updateAndSave({ musicBgOpacity: Number(e.target.value) })}
                className="w-full accent-[#10B981] h-1.5 bg-[#181920] rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

    const renderProxyContent = () => (
    <div className="space-y-5 animate-fade-in">
      {/* Master Enable/Disable Card */}
      <div>
        <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">Сеть и Прокси</div>
        <div className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl transition-colors ${formData.proxyEnabled ? 'bg-blue-500/20 text-blue-400' : 'bg-white/[0.04] text-[#8E92A4]'}`}>
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-[#ECECF1]">Использовать прокси</div>
                <div className="text-xs text-[#8E92A4]">Маршрутизация Twitch IRC, EventSub, Helix API, смайликов и TTS</div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(formData.proxyEnabled)}
                onChange={(e) => updateAndSave({ proxyEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#181920] border border-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3B82F6]" />
            </label>
          </div>
        </div>
      </div>

      {/* Proxy Type & Configuration */}
      <div className={`space-y-4 transition-opacity duration-200 ${formData.proxyEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
        <div>
          <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">Тип прокси</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { id: 'http', label: 'HTTP(S)', desc: 'Стандартный HTTP(S) (Sing-box, V2Ray, Xray, Clash)', defaultPort: '127.0.0.1:7890' },
              { id: 'socks5', label: 'SOCKS5', desc: 'Быстрый TCP SOCKS5 прокси', defaultPort: '127.0.0.1:10808' },
              { id: 'wireguard', label: 'WireGuard', desc: 'Встроенный туннель (без сторонних программ)', defaultPort: '' },
            ].map((pType) => {
              const isSelected = (formData.proxyType || 'http') === pType.id;
              return (
                <button
                  key={pType.id}
                  type="button"
                  onClick={() => {
                    const updates = { proxyType: pType.id };
                    if (pType.id !== 'wireguard' && (!formData.proxyAddress || formData.proxyAddress === '127.0.0.1:7890' || formData.proxyAddress === '127.0.0.1:10808')) {
                      updates.proxyAddress = pType.defaultPort;
                    }
                    updateAndSave(updates);
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    isSelected
                      ? 'bg-[#3B82F6]/10 border-[#3B82F6] text-white shadow-sm'
                      : 'bg-[#242631] border-white/[0.03] text-[#8E92A4] hover:border-white/10 hover:text-[#ECECF1]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold ${isSelected ? 'text-[#3B82F6]' : 'text-[#ECECF1]'}`}>
                      {pType.label}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#3B82F6]" />}
                  </div>
                  <span className="text-[10px] text-[#8E92A4] leading-tight">
                    {pType.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* WireGuard Embedded Section */}
        {formData.proxyType === 'wireguard' ? (
          <div className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] shadow-sm space-y-4">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-[#ECECF1] flex items-center gap-2">
                <Wifi className="w-3.5 h-3.5 text-[#3B82F6]" />
                Встроенный WireGuard туннель
              </div>
              <p className="text-[11px] text-[#8E92A4] leading-relaxed">
                Туннель работает прямо внутри программы через пользовательский сетевой стек gVisor.
                Не требует установки wireproxy, wintun или прав администратора.
              </p>
            </div>

            {/* Status indicator */}
            <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
              wgTunnelActive
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-white/[0.03] border-white/[0.06] text-[#8E92A4]'
            }`}>
              <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${wgTunnelActive ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[#ECECF1]">
                  {wgTunnelActive ? 'WireGuard туннель активен' : 'Туннель не запущен'}
                </div>
                {wgImportResult?.endpoint && (
                  <div className="text-[11px] opacity-80 font-mono mt-0.5 truncate">
                    Сервер: {wgImportResult.endpoint}
                  </div>
                )}
                {wgImportResult?.address && (
                  <div className="text-[11px] opacity-80 font-mono truncate">
                    IP: {wgImportResult.address}
                  </div>
                )}
                {!wgTunnelActive && (
                  <div className="text-[11px] text-[#8E92A4] mt-0.5">
                    Импортируйте .conf файл (WARP или от любого провайдера), чтобы активировать туннель
                  </div>
                )}
              </div>
            </div>

            {/* Import Button */}
            <div>
              <button
                type="button"
                onClick={handleImportWireGuard}
                disabled={isImportingWg}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#3B82F6] hover:bg-blue-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
              >
                {isImportingWg ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Импорт...</span></>
                ) : (
                  <><FolderOpen className="w-3.5 h-3.5" /><span>Выбрать .conf файл WireGuard</span></>
                )}
              </button>
            </div>

            {wgImportResult && !wgImportResult.success && (
              <div className="p-3 rounded-xl border bg-rose-500/10 border-rose-500/30 text-rose-300 text-xs animate-fade-in">
                <span className="font-semibold">Ошибка импорта: </span>{wgImportResult.error}
              </div>
            )}
          </div>
        ) : (
          /* Address, Port & Auth for HTTP / SOCKS5 */
          <div className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] shadow-sm space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#ECECF1] mb-1.5">
                Адрес и порт (Хост:Порт)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.proxyAddress || ''}
                  onChange={(e) => updateAndSave({ proxyAddress: e.target.value })}
                  placeholder={formData.proxyType === 'socks5' ? '127.0.0.1:10808' : '127.0.0.1:7890'}
                  className="w-full bg-[#181920] border border-white/[0.06] rounded-xl px-3.5 py-2 text-xs text-[#ECECF1] placeholder-[#474A58] focus:outline-none focus:border-[#3B82F6] font-mono transition-colors"
                />
              </div>
            </div>

            {/* Authentication toggle & fields */}
            <div className="pt-2 border-t border-white/[0.04] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-[#ECECF1]">Авторизация (логин и пароль)</div>
                  <div className="text-[11px] text-[#8E92A4]">Если прокси требует имени пользователя</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(formData.proxyAuth)}
                    onChange={(e) => updateAndSave({ proxyAuth: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[#181920] border border-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#3B82F6]" />
                </label>
              </div>

              {formData.proxyAuth && (
                <div className="grid grid-cols-2 gap-3 pt-1 animate-fade-in">
                  <div>
                    <label className="block text-[11px] text-[#8E92A4] mb-1">Пользователь (Username)</label>
                    <input
                      type="text"
                      value={formData.proxyUser || ''}
                      onChange={(e) => updateAndSave({ proxyUser: e.target.value })}
                      placeholder="user"
                      className="w-full bg-[#181920] border border-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-[#ECECF1] placeholder-[#474A58] focus:outline-none focus:border-[#3B82F6]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#8E92A4] mb-1">Пароль (Password)</label>
                    <div className="relative">
                      <input
                        type={showProxyPassword ? 'text' : 'password'}
                        value={formData.proxyPassword || ''}
                        onChange={(e) => updateAndSave({ proxyPassword: e.target.value })}
                        placeholder="••••••••"
                        className="w-full bg-[#181920] border border-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-[#ECECF1] placeholder-[#474A58] focus:outline-none focus:border-[#3B82F6] pr-8"
                      />
                      <button
                        type="button"
                        onClick={() => setShowProxyPassword(!showProxyPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6C7082] hover:text-[#ECECF1]"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Test Connection Button and Result Box */}
        <div className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-[#ECECF1]">Проверка соединения</div>
              <div className="text-[11px] text-[#8E92A4]">
                {formData.proxyType === 'wireguard'
                  ? 'Тестовый запрос к серверам Twitch через встроенный WireGuard туннель'
                  : 'Тестовый запрос к серверам Twitch через настроенный прокси'}
              </div>
            </div>
            <button
              type="button"
              onClick={handleTestProxy}
              disabled={isTestingProxy || (formData.proxyType !== 'wireguard' && !formData.proxyAddress)}
              className="px-3.5 py-1.5 bg-[#3B82F6] hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              {isTestingProxy ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Проверка...</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5" />
                  <span>Проверить</span>
                </>
              )}
            </button>
          </div>

          {proxyTestResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 animate-fade-in ${
                proxyTestResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {proxyTestResult.success ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <div className="w-4 h-4 rounded-full border border-rose-400 flex items-center justify-center font-bold text-[10px] shrink-0">!</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold">
                  {proxyTestResult.success ? 'Соединение успешно' : 'Ошибка соединения'}
                </div>
                <div className="text-[11px] opacity-90 truncate font-mono">
                  {proxyTestResult.message}
                </div>
              </div>
              {proxyTestResult.latency > 0 && (
                <div className="px-2 py-0.5 rounded bg-black/20 text-[10px] font-mono shrink-0">
                  {proxyTestResult.latency} ms
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );


  const renderAppearanceContent = () => {
    const spacingClass =
      formData.messageSpacing === 'compact'
        ? 'py-0.5'
        : formData.messageSpacing === 'relaxed'
        ? 'py-2'
        : 'py-1';

    const alignClass =
      formData.textAlign === 'center'
        ? 'justify-center text-center'
        : formData.textAlign === 'right'
        ? 'justify-end text-right'
        : 'justify-start text-left';

    return (
      <div className={`space-y-4 ${isWide ? 'grid grid-cols-1 gap-4' : 'max-w-lg mx-auto'}`}>
        {/* Live Message Preview Box */}
        <div>
          <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5 flex items-center justify-between">
            <span>Предпросмотр чата (Live Preview)</span>
            <span className="text-[11px] text-[#3B82F6] font-mono font-medium">
              {formData.fontFamily || 'Lato'} · {formData.fontSize || 14}px
            </span>
          </div>
          <div className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] shadow-sm space-y-2">
            <div
              className="bg-[#181920] rounded-xl p-3.5 space-y-1.5 border border-white/[0.04] overflow-hidden"
              style={{
                fontSize: `${formData.fontSize || 14}px`,
                fontFamily: `"${formData.fontFamily || 'Lato'}", system-ui, sans-serif`,
                textAlign: formData.textAlign || 'left',
              }}
            >
              {/* Message 1: Broadcaster */}
              <div
                className={`flex items-center gap-1.5 leading-snug break-words ${spacingClass} ${alignClass}`}
              >
                <span className="shrink-0 inline-flex items-center justify-center w-[18px] h-[18px] rounded-[4px] bg-[#9146FF] shadow-xs select-none">
                  <TwitchIcon className="w-3 h-3 text-white fill-white" />
                </span>

                {formData.showBadges && (
                  <span className="inline-flex items-center px-1 rounded bg-[#E91916] text-[9px] font-bold text-white uppercase tracking-wider shrink-0 select-none">
                    STREAMER
                  </span>
                )}

                {formData.showTimestamps && (
                  <span className="text-[#6C7082] text-[11px] font-mono tabular-nums shrink-0 select-none">
                    {formData.timestampFormat === 'HH:MM' ? '15:04' : '15:04:22'}
                  </span>
                )}

                <span className="font-bold text-[#A855F7] shrink-0">StreamHero:</span>
                <span className="text-[#ECECF1]">Добро пожаловать на стрим! Все настройки чата синхронизированы ✨</span>
              </div>

              {/* Message 2: VIP / Subscriber */}
              <div
                className={`flex items-center gap-1.5 leading-snug break-words ${spacingClass} ${alignClass}`}
              >
                <span className="shrink-0 inline-flex items-center justify-center w-[18px] h-[18px] rounded-[4px] bg-[#9146FF] shadow-xs select-none">
                  <TwitchIcon className="w-3 h-3 text-white fill-white" />
                </span>

                {formData.showBadges && (
                  <span className="inline-flex items-center px-1 rounded bg-[#10B981] text-[9px] font-bold text-white uppercase tracking-wider shrink-0 select-none">
                    SUB 12M
                  </span>
                )}

                {formData.showTimestamps && (
                  <span className="text-[#6C7082] text-[11px] font-mono tabular-nums shrink-0 select-none">
                    {formData.timestampFormat === 'HH:MM' ? '15:04' : '15:04:35'}
                  </span>
                )}

                <span className="font-bold text-[#10B981] shrink-0">KappaKing:</span>
                <span className="text-[#ECECF1]">Шрифт и размер меняются сразу же без перезапуска! 🚀</span>
                <span className="text-base leading-none select-none">👋</span>
              </div>
            </div>
          </div>
        </div>

        {/* Window section */}
        <div>
          <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">
            Окно приложения
          </div>
          <div className="bg-[#242631] rounded-2xl p-4 flex items-center justify-between border border-white/[0.03] shadow-sm">
            <div>
              <span className="text-sm font-medium text-[#ECECF1] block">
                Отображать поверх всех окон
              </span>
              <span className="text-xs text-[#8E92A4] block mt-0.5">
                Окно чата будет оставаться поверх игр, браузера и других программ
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer ml-4 shrink-0">
              <input
                type="checkbox"
                checked={Boolean(formData.alwaysOnTop)}
                onChange={handleToggleAlwaysOnTop}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#181920] border border-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3B82F6]" />
            </label>
          </div>
        </div>

        {/* Message text formatting section */}
        <div>
          <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">
            Шрифт и размер текста
          </div>
          <div className="bg-[#242631] rounded-2xl p-4 space-y-4 border border-white/[0.03] shadow-sm">
            {/* Text scaling control */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#ECECF1]">
                  Размер текста
                </span>
                <span className="text-xs text-[#3B82F6] font-mono font-semibold">
                  {formData.fontSize || 14}px ({getScalingLabel(formData.fontSize)})
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
                    className="w-full h-1.5 bg-[#181920] rounded-lg appearance-none cursor-pointer accent-[#3B82F6]"
                  />
                </div>
                <span className="text-lg font-bold text-[#8E92A4] select-none w-4 text-center">
                  A
                </span>
              </div>

              {/* Quick size presets */}
              <div className="grid grid-cols-5 gap-1.5 pt-1">
                {[12, 14, 16, 18, 20].map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => updateAndSave({ fontSize: sz })}
                    className={`py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                      (formData.fontSize || 14) === sz
                        ? 'bg-[#3B82F6] text-white border-[#3B82F6] font-semibold'
                        : 'bg-[#181920] border-white/[0.04] text-[#8E92A4] hover:text-[#ECECF1]'
                    }`}
                  >
                    {sz}px
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px bg-white/[0.06]" />

            {/* Font selector dropdown */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-[#ECECF1] block">
                  Шрифт чата
                </span>
                <span className="text-xs text-[#8E92A4]">
                  Семейство шрифта для отображения сообщений
                </span>
              </div>
              <div className="relative">
                <select
                  value={formData.fontFamily || 'Lato'}
                  onChange={(e) => updateAndSave({ fontFamily: e.target.value })}
                  className="appearance-none bg-[#181920] hover:bg-[#1E202B] text-xs text-[#ECECF1] font-medium py-2 pl-3 pr-8 rounded-xl border border-white/[0.06] outline-none cursor-pointer focus:border-[#3B82F6]"
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
              <div>
                <span className="text-sm font-medium text-[#ECECF1] block">
                  Расстояние между сообщениями
                </span>
                <span className="text-xs text-[#8E92A4]">
                  Вертикальные отступы между строками
                </span>
              </div>
              <div className="relative">
                <select
                  value={formData.messageSpacing || 'default'}
                  onChange={(e) => updateAndSave({ messageSpacing: e.target.value })}
                  className="appearance-none bg-[#181920] hover:bg-[#1E202B] text-xs text-[#ECECF1] font-medium py-2 pl-3 pr-8 rounded-xl border border-white/[0.06] outline-none cursor-pointer focus:border-[#3B82F6]"
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
              <div>
                <span className="text-sm font-medium text-[#ECECF1] block">
                  Выравнивание текста
                </span>
                <span className="text-xs text-[#8E92A4]">
                  Позиция текста сообщений в окне
                </span>
              </div>
              <div className="relative">
                <select
                  value={formData.textAlign || 'left'}
                  onChange={(e) => updateAndSave({ textAlign: e.target.value })}
                  className="appearance-none bg-[#181920] hover:bg-[#1E202B] text-xs text-[#ECECF1] font-medium py-2 pl-3 pr-8 rounded-xl border border-white/[0.06] outline-none cursor-pointer focus:border-[#3B82F6]"
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

        {/* Message Elements Section (Timestamps, Badges & History Limit) */}
        <div>
          <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">
            Элементы сообщений
          </div>
          <div className="bg-[#242631] rounded-2xl p-4 space-y-3.5 border border-white/[0.03] shadow-sm">
            {/* Show Timestamps Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-[#ECECF1] block">
                  Время сообщений (Таймстампы)
                </span>
                <span className="text-xs text-[#8E92A4]">
                  Отображать точное время отправки перед ником
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4 shrink-0">
                <input
                  type="checkbox"
                  checked={formData.showTimestamps !== false}
                  onChange={(e) => updateAndSave({ showTimestamps: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#181920] border border-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3B82F6]" />
              </label>
            </div>

            {/* Timestamp format (if enabled) */}
            {formData.showTimestamps !== false && (
              <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
                <div>
                  <span className="text-xs font-medium text-[#ECECF1] block">
                    Формат времени
                  </span>
                  <span className="text-[11px] text-[#8E92A4]">
                    Отображение с секундами или без
                  </span>
                </div>
                <div className="relative">
                  <select
                    value={formData.timestampFormat || 'HH:MM:SS'}
                    onChange={(e) => updateAndSave({ timestampFormat: e.target.value })}
                    className="appearance-none bg-[#181920] hover:bg-[#1E202B] text-xs text-[#ECECF1] font-medium py-1.5 pl-3 pr-8 rounded-xl border border-white/[0.06] outline-none cursor-pointer focus:border-[#3B82F6]"
                  >
                    <option value="HH:MM:SS">ЧЧ:ММ:СС (15:04:22)</option>
                    <option value="HH:MM">ЧЧ:ММ (15:04)</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-[#8E92A4] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}

            <div className="h-px bg-white/[0.06]" />

            {/* Show Badges Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-[#ECECF1] block">
                  Значки пользователей (Badges)
                </span>
                <span className="text-xs text-[#8E92A4]">
                  Значки подписчика, VIP, модератора и стримера
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4 shrink-0">
                <input
                  type="checkbox"
                  checked={formData.showBadges !== false}
                  onChange={(e) => updateAndSave({ showBadges: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#181920] border border-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3B82F6]" />
              </label>
            </div>

            <div className="h-px bg-white/[0.06]" />

            {/* Show Follows Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-[#ECECF1] block">
                  Новые фолловеры (Follow)
                </span>
                <span className="text-xs text-[#8E92A4]">
                  Отображать баннер в чате, когда зритель отслеживает канал
                </span>
              </div>
              <div className="flex items-center gap-3 ml-4 shrink-0">
                <button
                  type="button"
                  onClick={handleSendTestFollow}
                  disabled={isTestingFollow}
                  title="Отправить тестовое оповещение фолловера"
                  className="px-2.5 py-1 bg-white/[0.05] hover:bg-white/[0.1] active:bg-white/[0.15] text-[#ECECF1] rounded-lg border border-white/[0.06] text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {isTestingFollow ? (
                    <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                  ) : (
                    <Heart className="w-3 h-3 text-emerald-400 fill-emerald-400/20" />
                  )}
                  <span>Тест</span>
                </button>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.showFollows !== false}
                    onChange={(e) => updateAndSave({ showFollows: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-[#181920] border border-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#10B981]" />
                </label>
              </div>
            </div>

            <div className="h-px bg-white/[0.06]" />

            {/* Max messages in history */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-[#ECECF1] block">
                  Лимит сообщений в чате
                </span>
                <span className="text-xs text-[#8E92A4]">
                  Максимум хранимых сообщений в окне приложения
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {[100, 200, 300, 500].map((lim) => (
                  <button
                    key={lim}
                    type="button"
                    onClick={() => updateAndSave({ maxMessages: lim })}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                      (formData.maxMessages || 300) === lim
                        ? 'bg-[#3B82F6] text-white border-[#3B82F6] font-semibold'
                        : 'bg-[#181920] border-white/[0.04] text-[#8E92A4] hover:text-[#ECECF1]'
                    }`}
                  >
                    {lim}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

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
          if (activeTab === 'widget_chat' || activeTab === 'widget_music') {
            setActiveTab('widgets');
          } else if (activeTab !== 'appearance' && !isWide) {
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

              {/* Sidebar Tabs with Widgets Submenu */}
              <nav className="space-y-1">
                {sidebarTabs.map((tab) => {
                  const Icon = tab.icon;

                  if (tab.hasSubmenu) {
                    const isAnyChildActive = activeTab === 'widgets' || activeTab === 'widget_chat' || activeTab === 'widget_music';
                    const isExpanded = widgetsMenuOpen || isAnyChildActive;

                    return (
                      <div key={tab.id} className="space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (!isAnyChildActive) {
                              setActiveTab('widgets');
                            }
                            setWidgetsMenuOpen(!widgetsMenuOpen);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all text-left ${
                            isAnyChildActive
                              ? 'bg-white/[0.07] text-[#ECECF1] shadow-xs'
                              : 'text-[#8E92A4] hover:text-[#ECECF1] hover:bg-white/[0.04]'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <Icon className={`w-4 h-4 shrink-0 ${isAnyChildActive ? 'text-[#9146FF]' : ''}`} />
                            <div className="min-w-0 flex-1">
                              <div className="truncate leading-tight flex items-center gap-1.5">
                                <span>{tab.label}</span>
                                <span className="text-[10px] font-normal text-[#8E92A4]">({tab.children.length})</span>
                              </div>
                              <div className="text-[10px] font-normal truncate mt-0.5 text-[#6C7082]">
                                {tab.desc}
                              </div>
                            </div>
                          </div>
                          <ChevronDown className={`w-3.5 h-3.5 text-[#8E92A4] transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-180 text-white' : ''}`} />
                        </button>

                        {/* Submenu under Widgets */}
                        {isExpanded && (
                          <div className="ml-3 pl-3 border-l border-white/[0.08] space-y-1 py-0.5 animate-fade-in">
                            {tab.children.map((child) => {
                              const ChildIcon = child.icon;
                              const isChildActive = activeTab === child.id;
                              return (
                                <button
                                  key={child.id}
                                  type="button"
                                  onClick={() => setActiveTab(child.id)}
                                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all text-left ${
                                    isChildActive
                                      ? 'bg-[#3B82F6] text-white shadow-sm font-semibold'
                                      : 'text-[#8E92A4] hover:text-[#ECECF1] hover:bg-white/[0.04]'
                                  }`}
                                >
                                  <ChildIcon
                                    className="w-3.5 h-3.5 shrink-0"
                                    style={!isChildActive && child.color ? { color: child.color } : {}}
                                  />
                                  <span className="truncate">{child.label}</span>
                                  {isChildActive && <Check className="w-3 h-3 ml-auto shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }

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
                {activeTab === 'widgets' && renderWidgetsHubContent()}
                {activeTab === 'widget_chat' && renderChatWidgetContent()}
                {activeTab === 'widget_music' && renderMusicWidgetContent()}
                {activeTab === 'proxy' && renderProxyContent()}
              </div>
            </div>
          </section>
        </div>
      ) : (
        /* COMPACT MODE (Screenshot 2) */
        <>
          {/* Horizontal pill navigation */}
          <div className="flex items-center gap-1 px-3 py-2 bg-[#181920] border-b border-white/[0.04] overflow-x-auto no-scrollbar shrink-0">
            {sidebarTabs.map((tab) => {
              const Icon = tab.icon;
              const isTabActive = tab.hasSubmenu
                ? (activeTab === 'widgets' || activeTab === 'widget_chat' || activeTab === 'widget_music')
                : activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    if (tab.hasSubmenu) {
                      setActiveTab('widgets');
                    } else {
                      setActiveTab(tab.id);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0 ${
                    isTabActive
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

          {/* Secondary sub-bar when any widget view is active in compact mode */}
          {(activeTab === 'widgets' || activeTab === 'widget_chat' || activeTab === 'widget_music') && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#14151C] border-b border-white/[0.04] overflow-x-auto no-scrollbar shrink-0">
              <span className="text-[10px] uppercase font-bold text-[#6C7082] px-1 font-mono shrink-0">Виджеты:</span>
              <button
                type="button"
                onClick={() => setActiveTab('widgets')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all shrink-0 ${
                  activeTab === 'widgets' ? 'bg-white/[0.12] text-white font-semibold' : 'text-[#8E92A4] hover:text-white'
                }`}
              >
                Каталог
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('widget_chat')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 ${
                  activeTab === 'widget_chat' ? 'bg-[#9146FF] text-white font-semibold' : 'text-[#8E92A4] hover:text-white'
                }`}
              >
                <Monitor className="w-3 h-3 text-purple-400" />
                <span>Чат</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('widget_music')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 ${
                  activeTab === 'widget_music' ? 'bg-[#10B981] text-white font-semibold' : 'text-[#8E92A4] hover:text-white'
                }`}
              >
                <Music className="w-3 h-3 text-emerald-400" />
                <span>Музыка</span>
              </button>
            </div>
          )}

          {/* Compact Scrollable Content Area */}
          <main className="flex-1 overflow-y-auto px-3.5 py-3 space-y-4 custom-scrollbar">
            {activeTab === 'appearance' && renderAppearanceContent()}
            {activeTab === 'channels' && renderChannelsContent()}
            {activeTab === 'account' && renderAccountContent()}
            {activeTab === 'tts' && renderTTSContent()}
            {activeTab === 'filters' && renderFiltersContent()}
            {activeTab === 'widgets' && renderWidgetsHubContent()}
            {activeTab === 'widget_chat' && renderChatWidgetContent()}
            {activeTab === 'widget_music' && renderMusicWidgetContent()}
            {activeTab === 'proxy' && renderProxyContent()}

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
