import React, { useState, useEffect, useRef } from 'react';
import {
  GetSettings,
  SaveSettings,
  StartTwitchAuth,
  LogoutTwitch,
  GetTwitchAuthStatus,
  JoinChannel,
  LeaveChannel,
  GetJoinedChannels,
  JoinKickChannel,
  LeaveKickChannel,
  GetJoinedKickChannels,
  SpeakText,
  SpeakSupertonic,
  GetTTSVoices,
  TestProxyConnection,
  OpenAndImportWireGuardConf,
  WireGuardTunnelStatus,
  SetDAToken,
  TestDAConnection,
  SendTestDonation,
  SendTestGoal,
  SendTestFollowMessage,
} from '../../wailsjs/go/main/App';
import { WindowSetAlwaysOnTop, EventsOn } from '../../wailsjs/runtime/runtime';
import CustomTitleBar from './CustomTitleBar';
import {
  Sliders,
  Radio,
  User,
  Coins,
  Volume2,
  Filter,
  LayoutDashboard,
  Globe,
} from 'lucide-react';

import AppearanceTab from './settings/AppearanceTab';
import ChannelsTab from './settings/ChannelsTab';
import AccountTab from './settings/AccountTab';
import DonationsTab from './settings/DonationsTab';
import TTSTab from './settings/TTSTab';
import FiltersTab from './settings/FiltersTab';
import ProxyTab from './settings/ProxyTab';
import WidgetsTab from './settings/WidgetsTab';

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
  const [activeWidgetSubTab, setActiveWidgetSubTab] = useState('catalog');
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 500
  );

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
    iconColor: 'purple',
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
    daEnabled: true,
    daToken: '',
    daShowInChat: true,
    daMinChatAmount: 0,
    daTTS: true,
    daMinTTSAmount: 0,
    daShowGoalBar: true,
    kickEnabled: true,
    kickChannels: [],
  });

  // Channels state
  const [channelInput, setChannelInput] = useState('');
  const [joinedChannels, setJoinedChannels] = useState([]);
  const [kickChannelInput, setKickChannelInput] = useState('');
  const [joinedKickChannels, setJoinedKickChannels] = useState([]);

  // Auth & Status state
  const [statusMsg, setStatusMsg] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [twitchAuthStatus, setTwitchAuthStatus] = useState(null);

  // DA states
  const [showDAToken, setShowDAToken] = useState(false);
  const [isTestingDA, setIsTestingDA] = useState(false);
  const [daTestResult, setDaTestResult] = useState(null);
  const [isTestingDonation, setIsTestingDonation] = useState(false);
  const [isTestingGoal, setIsTestingGoal] = useState(false);
  const [isTestingFollow, setIsTestingFollow] = useState(false);

  // TTS states
  const [localVoices, setLocalVoices] = useState([]);
  const [audioDevices, setAudioDevices] = useState([]);
  const [isTTSTesting, setIsTTSTesting] = useState(false);
  const ttsAudioRef = useRef(null);

  // Proxy states
  const [isTestingProxy, setIsTestingProxy] = useState(false);
  const [proxyTestResult, setProxyTestResult] = useState(null);
  const [showProxyPassword, setShowProxyPassword] = useState(false);
  const [wgImportResult, setWgImportResult] = useState(null);
  const [isImportingWg, setIsImportingWg] = useState(false);
  const [wgTunnelActive, setWgTunnelActive] = useState(false);

  // Filters state
  const [newIgnoredUser, setNewIgnoredUser] = useState('');

  // Resize listener
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
            channelColors: loaded.channelColors || {},
            ignoredUsers: Array.isArray(loaded.ignoredUsers) ? loaded.ignoredUsers : prev.ignoredUsers,
          }));
        }
      })
      .catch(console.error);

    GetTwitchAuthStatus()
      .then((st) => {
        if (st) setTwitchAuthStatus(st);
      })
      .catch(() => {});

    const loadLocalVoices = () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) setLocalVoices(voices);
      }
    };
    loadLocalVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadLocalVoices;
    }

    const loadAudioDevices = async () => {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          setAudioDevices(devices.filter((d) => d.kind === 'audiooutput'));
        } catch (_) {}
      }
    };
    loadAudioDevices();

    GetJoinedChannels()
      .then((chans) => {
        if (chans) setJoinedChannels(chans);
      })
      .catch(console.error);

    GetJoinedKickChannels()
      .then((kchans) => {
        if (kchans) setJoinedKickChannels(kchans);
      })
      .catch(console.error);

    const unoffAuth = EventsOn('auth:updated', (updatedSettings) => {
      setFormData((prev) => ({ ...prev, ...updatedSettings }));
      setIsAuthenticating(false);
      setStatusMsg(`Авторизован как @${updatedSettings.username}`);
      GetTwitchAuthStatus().then(setTwitchAuthStatus).catch(() => {});
    });

    const unoffChans = EventsOn('channels:updated', (chans) => {
      setJoinedChannels(chans || []);
    });

    const unoffKickChans = EventsOn('kick:channels:updated', (kchans) => {
      setJoinedKickChannels(kchans || []);
    });

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (typeof unoffAuth === 'function') unoffAuth();
      if (typeof unoffChans === 'function') unoffChans();
      if (typeof unoffKickChans === 'function') unoffKickChans();
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
        showBadges: next.showBadges !== undefined ? Boolean(next.showBadges) : true,
        showFollows: next.showFollows !== undefined ? Boolean(next.showFollows) : true,
        ttsVolume: parseFloat(next.ttsVolume) || 1.0,
        ttsSpeed: parseFloat(next.ttsSpeed) || 1.0,
        ignoredUsers: Array.isArray(next.ignoredUsers) ? next.ignoredUsers : [],
        proxyEnabled: Boolean(next.proxyEnabled),
        daEnabled: Boolean(next.daEnabled),
        daToken: String(next.daToken || '').trim(),
      });
      setStatusMsg('Сохранено');
      setTimeout(() => setStatusMsg(''), 1800);
    } catch (err) {
      console.error('Save error:', err);
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
      setStatusMsg(`Подключен Twitch #${ch}`);
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

  const handleAddKickChannel = async (e) => {
    e?.preventDefault();
    const kch = kickChannelInput.trim().replace(/^#/, '').toLowerCase();
    if (!kch) return;
    try {
      await JoinKickChannel(kch);
      setKickChannelInput('');
      setStatusMsg(`Подключен Kick #${kch}`);
      setTimeout(() => setStatusMsg(''), 2000);
    } catch (err) {
      setStatusMsg(`Ошибка подключения Kick #${kch}: ${err}`);
    }
  };

  const handleRemoveKickChannel = async (channelToRemove) => {
    const kch = channelToRemove.toLowerCase();
    try {
      await LeaveKickChannel(kch);
      setStatusMsg(`Kick канал #${kch} удален`);
      setTimeout(() => setStatusMsg(''), 2000);
    } catch (err) {
      setStatusMsg(`Ошибка удаления Kick #${kch}: ${err}`);
    }
  };

  const handleAuth = async () => {
    setIsAuthenticating(true);
    setStatusMsg('Открываем браузер для авторизации...');
    try {
      await StartTwitchAuth();
    } catch (err) {
      setStatusMsg(`Ошибка авторизации: ${err}`);
      setIsAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    try {
      await LogoutTwitch();
      setFormData((prev) => ({ ...prev, oauthToken: '', username: '' }));
      setTwitchAuthStatus(null);
      setStatusMsg('Выход выполнен.');
      setTimeout(() => setStatusMsg(''), 2000);
    } catch (err) {
      setStatusMsg(`Ошибка выхода: ${err}`);
    }
  };

  const handleTestDA = async () => {
    setIsTestingDA(true);
    setDaTestResult(null);
    try {
      const res = await TestDAConnection(formData.daToken || '');
      setDaTestResult(res);
      if (res?.success) {
        setStatusMsg(`DA подключен: @${res.username}`);
      } else {
        setStatusMsg('Ошибка токена DonationAlerts');
      }
    } catch (err) {
      setDaTestResult({ success: false, error: String(err) });
    } finally {
      setIsTestingDA(false);
    }
  };

  const handleSendTestDonation = async () => {
    setIsTestingDonation(true);
    try {
      await SendTestDonation(150, 'RUB', 'Донатер', 'Спасибо за стрим! Держи на кофе ☕');
      setStatusMsg('Тестовый донат отправлен!');
      setTimeout(() => setStatusMsg(''), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setIsTestingDonation(false), 800);
    }
  };

  const handleSendTestGoal = async () => {
    setIsTestingGoal(true);
    try {
      await SendTestGoal('Сбор на новый микрофон', 6500, 10000, 'RUB');
      setStatusMsg('Тестовый сбор обновлен!');
      setTimeout(() => setStatusMsg(''), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setIsTestingGoal(false), 800);
    }
  };

  const handleSendTestFollow = async () => {
    setIsTestingFollow(true);
    try {
      await SendTestFollowMessage();
      setStatusMsg('Тестовый фолловер отправлен в чат!');
      setTimeout(() => setStatusMsg(''), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setIsTestingFollow(false), 800);
    }
  };

  const handleTestTTS = async () => {
    setIsTTSTesting(true);
    const text = 'ReChat: голосовое оповещение работает отлично!';
    try {
      if (formData.ttsEngine === 'supertonic') {
        const dataUri = await SpeakSupertonic(text, formData.ttsVoice || 'M1');
        if (dataUri) {
          if (ttsAudioRef.current) ttsAudioRef.current.pause();
          const audio = new Audio(dataUri);
          const playbackRate = Math.min(Math.max(Number(formData.ttsSpeed) || 1.0, 0.5), 2.5);
          audio.playbackRate = playbackRate;
          audio.volume = formData.ttsVolume !== undefined ? formData.ttsVolume : 1.0;
          if (formData.ttsAudioDevice && typeof audio.setSinkId === 'function') {
            audio.setSinkId(formData.ttsAudioDevice).catch(console.warn);
          }
          ttsAudioRef.current = audio;
          audio.onended = () => setIsTTSTesting(false);
          audio.play().catch(() => setIsTTSTesting(false));
        } else {
          setIsTTSTesting(false);
        }
      } else if (formData.ttsEngine === 'local') {
        const playbackRate = Math.min(Math.max(Number(formData.ttsSpeed) || 1.0, 0.5), 2.5);
        if (typeof window === 'undefined' || !window.speechSynthesis) {
          throw new Error('Local TTS not supported');
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
          if (ttsAudioRef.current) ttsAudioRef.current.pause();
          const audio = new Audio(dataUri);
          const playbackRate = Math.min(Math.max(Number(formData.ttsSpeed) || 1.0, 0.5), 2.5);
          audio.playbackRate = playbackRate;
          audio.volume = formData.ttsVolume !== undefined ? formData.ttsVolume : 1.0;
          if (formData.ttsAudioDevice && typeof audio.setSinkId === 'function') {
            audio.setSinkId(formData.ttsAudioDevice).catch(console.warn);
          }
          ttsAudioRef.current = audio;
          audio.onended = () => setIsTTSTesting(false);
          audio.onerror = () => setIsTTSTesting(false);
          audio.play().catch(() => setIsTTSTesting(false));
        } else {
          setIsTTSTesting(false);
        }
      }
    } catch (err) {
      setStatusMsg(`Ошибка TTS: ${err}`);
      setIsTTSTesting(false);
    }
  };

  const handleAddIgnoredUser = (e) => {
    e?.preventDefault();
    const u = newIgnoredUser.trim().replace(/^@/, '');
    if (!u) return;
    const current = Array.isArray(formData.ignoredUsers) ? formData.ignoredUsers : [];
    if (!current.some((x) => x && x.toLowerCase() === u.toLowerCase())) {
      updateAndSave({ ignoredUsers: [...current, u] });
    }
    setNewIgnoredUser('');
  };

  const handleRemoveIgnoredUser = (uToRemove) => {
    const nextUsers = (Array.isArray(formData.ignoredUsers) ? formData.ignoredUsers : []).filter(
      (u) => u.toLowerCase() !== uToRemove.toLowerCase()
    );
    updateAndSave({ ignoredUsers: nextUsers });
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
      setProxyTestResult({ success: false, message: String(err) });
    } finally {
      setIsTestingProxy(false);
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
        setFormData((prev) => ({ ...prev, proxyType: 'wireguard', proxyEnabled: true }));
      } else {
        setWgImportResult({ success: false, error: res?.error || 'Ошибка импорта' });
      }
    } catch (err) {
      setWgImportResult({ success: false, error: String(err) });
    } finally {
      setIsImportingWg(false);
    }
  };

  const getScalingLabel = (size) => {
    if (size <= 12) return 'Компактный';
    if (size === 14) return 'Стандартный';
    if (size === 16) return 'Средний';
    if (size === 18) return 'Крупный';
    return 'Очень крупный';
  };

  const sidebarTabs = [
    { id: 'appearance', label: 'Внешний вид', desc: 'Шрифты, размеры и значки', icon: Sliders },
    { id: 'channels', label: 'Каналы', desc: 'Twitch и Kick мультичат', icon: Radio },
    { id: 'account', label: 'Аккаунт', desc: 'Twitch OAuth & доступ', icon: User },
    { id: 'donations', label: 'Донаты (DA)', desc: 'DonationAlerts и сборы', icon: Coins },
    { id: 'tts', label: 'Озвучка (TTS)', desc: 'Алиса и синтез речи', icon: Volume2 },
    { id: 'filters', label: 'Фильтры', desc: 'Боты и команды', icon: Filter },
    { id: 'widgets', label: 'Виджеты OBS', desc: 'Все 5 оверлеев стрима', icon: LayoutDashboard },
    { id: 'proxy', label: 'Прокси и Сеть', desc: 'HTTP, SOCKS5, WireGuard', icon: Globe },
  ];

  const currentTabObj = sidebarTabs.find((t) => t.id === activeTab) || sidebarTabs[0];

  return (
    <div className="flex flex-col h-screen w-full bg-[#181920] text-[#ECECF1] select-none font-sans overflow-hidden">
      <CustomTitleBar
        isSettingsMode={true}
        settingsTitle={currentTabObj.label}
        onCloseSettings={onClose}
      />

      {isWide ? (
        /* WIDE DESKTOP MODE (Sidebar Navigation) */
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <aside className="w-56 bg-[#14151C] border-r border-white/[0.04] p-3 flex flex-col justify-between shrink-0">
            <div className="space-y-1">
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#6C7082] px-2.5 py-1">
                Настройки
              </div>
              {sidebarTabs.map((tab) => {
                const Icon = tab.icon;
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id);
                      if (tab.id === 'widgets') setActiveWidgetSubTab('catalog');
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all text-left ${
                      isSelected
                        ? 'bg-[#3B82F6] text-white shadow-md'
                        : 'text-[#8E92A4] hover:text-[#ECECF1] hover:bg-white/[0.04]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {statusMsg && (
              <div className="text-[11px] text-center text-emerald-400 font-medium bg-emerald-500/10 border border-emerald-500/20 py-1.5 px-2 rounded-lg animate-fade-in truncate">
                {statusMsg}
              </div>
            )}
          </aside>

          {/* Main Content Area */}
          <section className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-[#181920]">
            <div className="max-w-2xl mx-auto">
              {activeTab === 'appearance' && (
                <AppearanceTab
                  isWide={true}
                  formData={formData}
                  updateAndSave={updateAndSave}
                  FONT_OPTIONS={FONT_OPTIONS}
                  SPACING_OPTIONS={SPACING_OPTIONS}
                  ALIGN_OPTIONS={ALIGN_OPTIONS}
                  getScalingLabel={getScalingLabel}
                  handleFontSizeChange={handleFontSizeChange}
                  handleToggleAlwaysOnTop={handleToggleAlwaysOnTop}
                  handleSendTestFollow={handleSendTestFollow}
                  isTestingFollow={isTestingFollow}
                />
              )}

              {activeTab === 'channels' && (
                <ChannelsTab
                  isWide={true}
                  channelInput={channelInput}
                  setChannelInput={setChannelInput}
                  handleAddChannel={handleAddChannel}
                  joinedChannels={joinedChannels}
                  handleRemoveChannel={handleRemoveChannel}
                  kickChannelInput={kickChannelInput}
                  setKickChannelInput={setKickChannelInput}
                  handleAddKickChannel={handleAddKickChannel}
                  joinedKickChannels={joinedKickChannels}
                  handleRemoveKickChannel={handleRemoveKickChannel}
                />
              )}

              {activeTab === 'account' && (
                <AccountTab
                  isWide={true}
                  formData={formData}
                  updateAndSave={updateAndSave}
                  handleAuth={handleAuth}
                  handleLogout={handleLogout}
                  isAuthenticating={isAuthenticating}
                  twitchAuthStatus={twitchAuthStatus}
                  daTestResult={daTestResult}
                  showDAToken={showDAToken}
                  setShowDAToken={setShowDAToken}
                  handleTestDA={handleTestDA}
                  isTestingDA={isTestingDA}
                  handleSendTestDonation={handleSendTestDonation}
                  isTestingDonation={isTestingDonation}
                  handleSendTestGoal={handleSendTestGoal}
                  isTestingGoal={isTestingGoal}
                />
              )}

              {activeTab === 'donations' && (
                <DonationsTab
                  formData={formData}
                  updateAndSave={updateAndSave}
                  daTestResult={daTestResult}
                  handleSendTestDonation={handleSendTestDonation}
                  isTestingDonation={isTestingDonation}
                  handleSendTestGoal={handleSendTestGoal}
                  isTestingGoal={isTestingGoal}
                  setActiveTab={setActiveTab}
                />
              )}

              {activeTab === 'tts' && (
                <TTSTab
                  isWide={true}
                  formData={formData}
                  updateAndSave={updateAndSave}
                  localVoices={localVoices}
                  audioDevices={audioDevices}
                  isTTSTesting={isTTSTesting}
                  handleTestTTS={handleTestTTS}
                />
              )}

              {activeTab === 'filters' && (
                <FiltersTab
                  isWide={true}
                  formData={formData}
                  updateAndSave={updateAndSave}
                  newIgnoredUser={newIgnoredUser}
                  setNewIgnoredUser={setNewIgnoredUser}
                  handleAddIgnoredUser={handleAddIgnoredUser}
                  handleRemoveIgnoredUser={handleRemoveIgnoredUser}
                />
              )}

              {activeTab === 'widgets' && (
                <WidgetsTab
                  formData={formData}
                  updateAndSave={updateAndSave}
                  activeSubTab={activeWidgetSubTab}
                  setActiveSubTab={setActiveWidgetSubTab}
                />
              )}

              {activeTab === 'proxy' && (
                <ProxyTab
                  formData={formData}
                  updateAndSave={updateAndSave}
                  wgTunnelActive={wgTunnelActive}
                  wgImportResult={wgImportResult}
                  handleImportWireGuard={handleImportWireGuard}
                  isImportingWg={isImportingWg}
                  showProxyPassword={showProxyPassword}
                  setShowProxyPassword={setShowProxyPassword}
                  handleTestProxy={handleTestProxy}
                  isTestingProxy={isTestingProxy}
                  proxyTestResult={proxyTestResult}
                />
              )}
            </div>
          </section>
        </div>
      ) : (
        /* COMPACT MODE (Top horizontal pills) */
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center gap-1 px-2.5 py-1.5 bg-[#14151C] border-b border-white/[0.04] overflow-x-auto no-scrollbar shrink-0">
            {sidebarTabs.map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (tab.id === 'widgets') setActiveWidgetSubTab('catalog');
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all shrink-0 ${
                    isSelected
                      ? 'bg-[#3B82F6] text-white shadow-xs'
                      : 'text-[#8E92A4] hover:text-[#ECECF1] hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <main className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[#181920]">
            {activeTab === 'appearance' && (
              <AppearanceTab
                isWide={false}
                formData={formData}
                updateAndSave={updateAndSave}
                FONT_OPTIONS={FONT_OPTIONS}
                SPACING_OPTIONS={SPACING_OPTIONS}
                ALIGN_OPTIONS={ALIGN_OPTIONS}
                getScalingLabel={getScalingLabel}
                handleFontSizeChange={handleFontSizeChange}
                handleToggleAlwaysOnTop={handleToggleAlwaysOnTop}
                handleSendTestFollow={handleSendTestFollow}
                isTestingFollow={isTestingFollow}
              />
            )}

            {activeTab === 'channels' && (
              <ChannelsTab
                isWide={false}
                channelInput={channelInput}
                setChannelInput={setChannelInput}
                handleAddChannel={handleAddChannel}
                joinedChannels={joinedChannels}
                handleRemoveChannel={handleRemoveChannel}
                kickChannelInput={kickChannelInput}
                setKickChannelInput={setKickChannelInput}
                handleAddKickChannel={handleAddKickChannel}
                joinedKickChannels={joinedKickChannels}
                handleRemoveKickChannel={handleRemoveKickChannel}
              />
            )}

            {activeTab === 'account' && (
              <AccountTab
                isWide={false}
                formData={formData}
                updateAndSave={updateAndSave}
                handleAuth={handleAuth}
                handleLogout={handleLogout}
                isAuthenticating={isAuthenticating}
                twitchAuthStatus={twitchAuthStatus}
                daTestResult={daTestResult}
                showDAToken={showDAToken}
                setShowDAToken={setShowDAToken}
                handleTestDA={handleTestDA}
                isTestingDA={isTestingDA}
                handleSendTestDonation={handleSendTestDonation}
                isTestingDonation={isTestingDonation}
                handleSendTestGoal={handleSendTestGoal}
                isTestingGoal={isTestingGoal}
              />
            )}

            {activeTab === 'donations' && (
              <DonationsTab
                formData={formData}
                updateAndSave={updateAndSave}
                daTestResult={daTestResult}
                handleSendTestDonation={handleSendTestDonation}
                isTestingDonation={isTestingDonation}
                handleSendTestGoal={handleSendTestGoal}
                isTestingGoal={isTestingGoal}
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === 'tts' && (
              <TTSTab
                isWide={false}
                formData={formData}
                updateAndSave={updateAndSave}
                localVoices={localVoices}
                audioDevices={audioDevices}
                isTTSTesting={isTTSTesting}
                handleTestTTS={handleTestTTS}
              />
            )}

            {activeTab === 'filters' && (
              <FiltersTab
                isWide={false}
                formData={formData}
                updateAndSave={updateAndSave}
                newIgnoredUser={newIgnoredUser}
                setNewIgnoredUser={setNewIgnoredUser}
                handleAddIgnoredUser={handleAddIgnoredUser}
                handleRemoveIgnoredUser={handleRemoveIgnoredUser}
              />
            )}

            {activeTab === 'widgets' && (
              <WidgetsTab
                formData={formData}
                updateAndSave={updateAndSave}
                activeSubTab={activeWidgetSubTab}
                setActiveSubTab={setActiveWidgetSubTab}
              />
            )}

            {activeTab === 'proxy' && (
              <ProxyTab
                formData={formData}
                updateAndSave={updateAndSave}
                wgTunnelActive={wgTunnelActive}
                wgImportResult={wgImportResult}
                handleImportWireGuard={handleImportWireGuard}
                isImportingWg={isImportingWg}
                showProxyPassword={showProxyPassword}
                setShowProxyPassword={setShowProxyPassword}
                handleTestProxy={handleTestProxy}
                isTestingProxy={isTestingProxy}
                proxyTestResult={proxyTestResult}
              />
            )}

            {statusMsg && (
              <div className="text-[11px] text-center text-emerald-400 font-medium py-2">
                {statusMsg}
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
