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
} from '../../wailsjs/go/main/App';
import { EventsOn } from '../../wailsjs/runtime/runtime';
import TwitchIcon from './TwitchIcon';
import CustomTitleBar from './CustomTitleBar';
import { ICON_COLORS } from '../utils/channelColors';
import {
  User,
  Radio,
  Filter,
  UserX,
  Smile,
  Palette,
  Clock,
  MessageSquare,
  LayoutGrid,
  Volume2,
  Sliders,
  Check,
  Plus,
  Trash2,
  LogOut,
  Tag,
  Monitor,
  ExternalLink,
  Shield,
  Play,
  Loader2,
  X,
} from 'lucide-react';

export default function SettingsView({ onClose, isStandaloneWindow = false }) {
  const [activeTab, setActiveTab] = useState('account');
  const [formData, setFormData] = useState({
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

  const [channelInput, setChannelInput] = useState('');
  const [newIgnoredUser, setNewIgnoredUser] = useState('');
  const [joinedChannels, setJoinedChannels] = useState([]);
  const [statusMsg, setStatusMsg] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [ttsVoices, setTtsVoices] = useState({});
  const [localVoices, setLocalVoices] = useState([]);
  const [isTTSTesting, setIsTTSTesting] = useState(false);
  const ttsAudioRef = useRef(null);

  useEffect(() => {
    GetSettings()
      .then((loaded) => {
        if (loaded) {
          setFormData({
            ...loaded,
            channelColors: loaded.channelColors || {},
            ttsEnabled: loaded.ttsEnabled || false,
            ttsVolume: loaded.ttsVolume !== undefined ? loaded.ttsVolume : 1.0,
            ttsEngine: loaded.ttsEngine || 'yandex',
            ttsVoice: loaded.ttsVoice || 'shitova.us',
            ttsVoiceLocal: loaded.ttsVoiceLocal || '',
            ignoreCommands: loaded.ignoreCommands !== undefined ? loaded.ignoreCommands : true,
            commandPrefixes: loaded.commandPrefixes || '!, /, ., $, ?',
            ignoreEmotesOnly: loaded.ignoreEmotesOnly || false,
            ttsFilterEmotes: loaded.ttsFilterEmotes !== undefined ? loaded.ttsFilterEmotes : true,
            ignoredUsers: Array.isArray(loaded.ignoredUsers)
              ? loaded.ignoredUsers
              : ['Nightbot', 'StreamElements', 'Moobot', 'Fossabot'],
            hideIgnoredFromChat: loaded.hideIgnoredFromChat || false,
          });
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

    GetJoinedChannels()
      .then((chans) => {
        if (chans) setJoinedChannels(chans);
      })
      .catch((err) => console.error('Failed to fetch channels:', err));

    const unoffAuth = EventsOn('auth:updated', (updatedSettings) => {
      setFormData((prev) => ({ ...prev, ...updatedSettings }));
      setIsAuthenticating(false);
      setStatusMsg(`Authenticated as @${updatedSettings.username}`);
    });

    const unoffChans = EventsOn('channels:updated', (chans) => {
      setJoinedChannels(chans || []);
    });

    return () => {
      if (typeof unoffAuth === 'function') unoffAuth();
      if (typeof unoffChans === 'function') unoffChans();
    };
  }, []);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setIsSaved(false);
  };

  const handleChannelColorChange = (ch, colorHex) => {
    setFormData((prev) => ({
      ...prev,
      channelColors: {
        ...(prev.channelColors || {}),
        [ch.toLowerCase()]: colorHex,
      },
    }));
    setIsSaved(false);
  };

  const handleAddChannel = async (e) => {
    e?.preventDefault();
    const ch = channelInput.trim().replace(/^#/, '').toLowerCase();
    if (!ch) return;
    try {
      await JoinChannel(ch);
      setChannelInput('');
      setStatusMsg(`Joined #${ch}`);
      setIsSaved(false);
    } catch (err) {
      setStatusMsg(`Failed to join #${ch}: ${err}`);
    }
  };

  const handleRemoveChannel = async (channelToRemove) => {
    const ch = channelToRemove.toLowerCase();
    try {
      await LeaveChannel(ch);
      setStatusMsg(`Left #${ch}`);
      setIsSaved(false);
    } catch (err) {
      setStatusMsg(`Failed to leave #${ch}: ${err}`);
    }
  };

  const handleAddIgnoredUser = (e) => {
    e?.preventDefault();
    const u = newIgnoredUser.trim().replace(/^@/, '');
    if (!u) return;
    const current = Array.isArray(formData.ignoredUsers) ? formData.ignoredUsers : [];
    if (!current.some((x) => x && x.toLowerCase() === u.toLowerCase())) {
      setFormData((prev) => ({
        ...prev,
        ignoredUsers: [...(Array.isArray(prev.ignoredUsers) ? prev.ignoredUsers : []), u],
      }));
      setIsSaved(false);
    }
    setNewIgnoredUser('');
  };

  const handleRemoveIgnoredUser = (uToRemove) => {
    setFormData((prev) => ({
      ...prev,
      ignoredUsers: (Array.isArray(prev.ignoredUsers) ? prev.ignoredUsers : []).filter(
        (u) => u.toLowerCase() !== uToRemove.toLowerCase()
      ),
    }));
    setIsSaved(false);
  };

  const handleAuth = async () => {
    setIsAuthenticating(true);
    setStatusMsg('Opening Twitch OAuth in browser...');
    try {
      await StartTwitchAuth();
    } catch (err) {
      setStatusMsg('Auth failed: ' + String(err));
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
      setStatusMsg('Logged out successfully.');
      setIsSaved(false);
    } catch (err) {
      setStatusMsg('Logout failed: ' + String(err));
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    try {
      await SaveSettings({
        ...formData,
        fontSize: parseInt(formData.fontSize, 10) || 14,
        maxMessages: parseInt(formData.maxMessages, 10) || 300,
        ttsVolume: parseFloat(formData.ttsVolume) || 1.0,
        ignoredUsers: Array.isArray(formData.ignoredUsers) ? formData.ignoredUsers : [],
      });
      setIsSaved(true);
      setStatusMsg('Settings saved successfully.');
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err) {
      setStatusMsg('Failed to save settings: ' + String(err));
    }
  };

  const handleTestTTS = async () => {
    setIsTTSTesting(true);
    const text = 'ReChat: голосовое оповещение работает отлично!';
    try {
      if (formData.ttsEngine === 'local') {
        if (typeof window === 'undefined' || !window.speechSynthesis) {
          throw new Error('Local TTS not supported in this browser');
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.volume = formData.ttsVolume !== undefined ? formData.ttsVolume : 1.0;
        const voice = localVoices.find((v) => v.name === formData.ttsVoiceLocal);
        if (voice) {
          utterance.voice = voice;
        } else if (localVoices.length > 0) {
          utterance.voice = localVoices[0];
        }
        utterance.onend = () => setIsTTSTesting(false);
        utterance.onerror = () => setIsTTSTesting(false);
        window.speechSynthesis.speak(utterance);
      } else {
        const dataUri = await SpeakText(text, formData.ttsVoice || 'shitova.us');
        if (dataUri) {
          const audio = new Audio(dataUri);
          audio.volume = formData.ttsVolume !== undefined ? formData.ttsVolume : 1.0;
          ttsAudioRef.current = audio;
          audio.play();
          audio.onended = () => setIsTTSTesting(false);
          audio.onerror = () => setIsTTSTesting(false);
        } else {
          setIsTTSTesting(false);
          setStatusMsg('TTS: No audio received');
        }
      }
    } catch (err) {
      setIsTTSTesting(false);
      setStatusMsg('TTS error: ' + String(err));
    }
  };

  const tabs = [
    { id: 'account', label: 'Twitch Account', icon: User, desc: 'OAuth Login & Authorization' },
    { id: 'channels', label: 'Channels', icon: Radio, desc: 'Channel List & Custom Colors' },
    { id: 'filters', label: 'Filters & Ignore', icon: Filter, desc: 'Commands, Emotes & Users' },
    { id: 'appearance', label: 'Appearance', icon: Palette, desc: 'Theme, Badges & Font Sizes' },
    { id: 'chat', label: 'Chat & History', icon: MessageSquare, desc: 'Timestamps & Message Buffer' },
    { id: 'tts', label: 'TTS / Voice', icon: Volume2, desc: 'Text-to-Speech & Speech Engines' },
  ];

  const currentIgnoredUsers = Array.isArray(formData.ignoredUsers) ? formData.ignoredUsers : [];

  const content = (
    <div className="flex flex-col h-full w-full bg-[#0c0d12] text-[#f1f3f7] font-sans select-none overflow-hidden">
      <CustomTitleBar title="ReChat — Control Panel (Settings)" />
      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
        {/* Control Panel Sidebar */}
        <aside className="w-56 bg-[#12141a] border-r border-white/[0.06] flex flex-col justify-between shrink-0">
          <div className="flex flex-col min-h-0">
            {/* StreamTools Logo & Header */}
            <div className="h-12 px-4 border-b border-white/[0.06] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded bg-[#10b981] flex items-center justify-center text-[#0c0d12] font-black text-xs">
                  <Sliders className="w-3.5 h-3.5" />
                </div>
                <h1 className="text-xs font-bold text-[#f1f3f7] uppercase tracking-wider">ReChat Settings</h1>
              </div>
            </div>

            {/* User Profile Card */}
            <div className="p-3 flex items-center gap-2.5 shrink-0 border-b border-white/[0.06] bg-[#0c0d12]/50">
              <div className="h-8 w-8 rounded bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[#10b981] font-bold overflow-hidden shrink-0">
                {formData.username ? (
                  <span className="text-xs font-mono font-bold text-[#10b981]">
                    {formData.username.slice(0, 2).toUpperCase()}
                  </span>
                ) : (
                  <User className="w-4 h-4 text-[#8c93a4]" />
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-mono font-bold text-[#f1f3f7] truncate">
                  {formData.username ? `@${formData.username}` : 'Guest Mode'}
                </span>
                <span className="text-[10px] text-[#8c93a4] truncate">
                  {formData.username ? 'Connected User' : 'Not Connected'}
                </span>
              </div>
            </div>

            {/* Navigation Category Tabs */}
            <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-1 custom-scrollbar">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-xs font-medium transition-colors text-left ${
                      isActive
                        ? 'bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20 font-semibold'
                        : 'text-[#8c93a4] hover:bg-white/[0.04] hover:text-[#f1f3f7] border border-transparent'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#10b981]' : 'text-[#8c93a4]'}`} />
                    <div className="truncate">
                      <div className="leading-tight">{tab.label}</div>
                      <div className="text-[9px] opacity-70 font-normal truncate mt-0.5">{tab.desc}</div>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Footer System Info */}
          <div className="p-3 border-t border-white/[0.06] bg-[#0c0d12]/50 space-y-1 shrink-0">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-[#8c93a4]">STATUS:</span>
              <span className="text-[#10b981] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse"></span>
                ACTIVE
              </span>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0c0d12]">
          {/* Top Bar Header */}
          <header className="h-12 px-5 border-b border-white/[0.06] bg-[#12141a] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded bg-[#10b981]/10 flex items-center justify-center border border-[#10b981]/20 text-[#10b981]">
                {activeTab === 'account' && <User className="w-3.5 h-3.5" />}
                {activeTab === 'channels' && <Radio className="w-3.5 h-3.5" />}
                {activeTab === 'filters' && <Filter className="w-3.5 h-3.5" />}
                {activeTab === 'appearance' && <Palette className="w-3.5 h-3.5" />}
                {activeTab === 'chat' && <MessageSquare className="w-3.5 h-3.5" />}
                {activeTab === 'tts' && <Volume2 className="w-3.5 h-3.5" />}
              </div>
              <div>
                <h2 className="text-xs font-bold text-[#f1f3f7] uppercase tracking-wider">
                  {tabs.find((t) => t.id === activeTab)?.label}
                </h2>
                <p className="text-[10px] text-[#8c93a4]">
                  {tabs.find((t) => t.id === activeTab)?.desc}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-[#8c93a4] hover:text-[#f1f3f7] hover:bg-white/[0.06] transition-colors"
              title="Close Window"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          {/* Tab Content Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
            {/* TAB 1: TWITCH ACCOUNT */}
            {activeTab === 'account' && (
              <div className="space-y-4">
                <div className="bg-[#13151c] border border-white/[0.06] rounded-lg p-4 space-y-3 transition-colors hover:border-white/[0.12]">
                  <div className="flex justify-between items-center border-b border-white/[0.06] pb-2.5">
                    <div className="flex items-center gap-2">
                      <TwitchIcon className="w-4 h-4 fill-emerald-400 text-emerald-400" />
                      <span className="text-xs font-bold text-[#f1f3f7] uppercase tracking-wider">
                        Twitch OAuth Authentication
                      </span>
                    </div>
                    {formData.username ? (
                      <span className="px-2 py-0.5 text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-800 rounded font-mono flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        @{formData.username}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] bg-white/[0.04] text-[#8c93a4] border border-white/[0.08] rounded">
                        Not Logged In
                      </span>
                    )}
                  </div>

                  {formData.username ? (
                    <div className="flex items-center justify-between bg-[#0c0d12] p-3 rounded-lg border border-white/[0.06]">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-950/80 border border-emerald-800 rounded-full">
                          <User className="w-4 h-4 text-emerald-300" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#f1f3f7]">@{formData.username}</div>
                          <div className="text-[11px] text-[#8c93a4]">Authenticated via Twitch Browser OAuth</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="px-3 py-1.5 bg-red-950/60 border border-red-800/60 text-red-300 text-xs rounded hover:bg-red-900 transition-colors flex items-center gap-1.5 font-medium"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Log Out</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-[#8c93a4] leading-relaxed">
                        Log in via Twitch OAuth to access your subscriber emotes, badges, and read chat in real-time.
                      </p>
                      <button
                        type="button"
                        onClick={handleAuth}
                        disabled={isAuthenticating}
                        className="px-4 py-2 bg-[#9146ff] hover:bg-[#772ce8] text-white text-xs font-semibold rounded flex items-center gap-2 transition-colors disabled:opacity-50"
                      >
                        <TwitchIcon className="w-4 h-4 fill-white" />
                        <span>{isAuthenticating ? 'Waiting for Browser Login...' : 'Log in with Twitch'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: CHANNELS */}
            {activeTab === 'channels' && (
              <div className="space-y-4">
                <div className="bg-[#13151c] border border-white/[0.06] rounded-lg p-4 space-y-3 transition-colors hover:border-white/[0.12]">
                  <h3 className="text-xs font-bold text-[#f1f3f7] uppercase tracking-wider border-b border-white/[0.06] pb-2 flex items-center gap-2">
                    <Radio className="w-4 h-4 text-emerald-400" />
                    <span>Joined Channels</span>
                  </h3>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter channel name (e.g. shroud)"
                      value={channelInput}
                      onChange={(e) => setChannelInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddChannel();
                        }
                      }}
                      className="flex-1 px-3 py-1.5 bg-[#0c0d12] border border-white/[0.08] focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981]/20 rounded text-xs text-[#f1f3f7] font-mono outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddChannel}
                      className="px-3.5 py-1.5 bg-[#10b981] hover:bg-[#059669] text-[#0c0d12] font-semibold text-xs rounded transition-colors flex items-center gap-1.5 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Join</span>
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pt-1">
                    {joinedChannels.length === 0 ? (
                      <div className="text-center py-4 text-[#525866] text-xs italic">
                        No channels joined yet. Add a channel above.
                      </div>
                    ) : (
                      joinedChannels.map((ch) => {
                        const isOwn = formData.username && ch.toLowerCase() === formData.username.toLowerCase();
                        const currentColor = formData.channelColors?.[ch.toLowerCase()] || '#10b981';
                        return (
                          <div
                            key={ch}
                            className="flex items-center justify-between p-2 rounded bg-[#0c0d12] border border-white/[0.05] text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <TwitchIcon className="w-3.5 h-3.5 fill-emerald-400 text-emerald-400" />
                              <span className="text-xs font-mono font-bold text-[#f1f3f7]">#{ch}</span>
                              {isOwn ? (
                                <span className="px-2 py-0.5 text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-800 rounded font-semibold">
                                  Own Channel
                                </span>
                              ) : (
                                <div className="flex items-center gap-1.5 ml-2">
                                  <span className="text-[10px] text-[#8c93a4]">Color:</span>
                                  <input
                                    type="color"
                                    value={currentColor}
                                    onChange={(e) => handleChannelColorChange(ch, e.target.value)}
                                    className="w-4 h-4 rounded bg-transparent cursor-pointer border border-white/[0.1] p-0"
                                    title={`Color for #${ch}`}
                                  />
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveChannel(ch)}
                              className="px-2 py-1 bg-white/[0.04] border border-white/[0.08] text-[#8c93a4] hover:text-red-400 hover:border-red-900/60 text-xs rounded transition-colors flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove</span>
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: FILTERS & IGNORE */}
            {activeTab === 'filters' && (
              <div className="space-y-4">
                {/* Command Filters Card */}
                <div className="bg-[#13151c] border border-white/[0.06] rounded-lg p-4 space-y-3 transition-colors hover:border-white/[0.12]">
                  <div className="flex justify-between items-center border-b border-white/[0.06] pb-2.5">
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-[#f1f3f7] uppercase tracking-wider">
                        Command Filtering
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-mono rounded ${
                        formData.ignoreCommands
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80'
                          : 'bg-white/[0.04] text-[#8c93a4] border border-white/[0.08]'
                      }`}
                    >
                      {formData.ignoreCommands ? 'ACTIVE' : 'OFF'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-[#0c0d12] border border-white/[0.06] rounded-lg">
                    <div>
                      <div className="text-xs text-[#f1f3f7] font-medium">Ignore Chat Commands</div>
                      <div className="text-[11px] text-[#8c93a4]">Skip bot commands from TTS and chat feed</div>
                    </div>
                    <input
                      id="ctrl-ignore-commands-checkbox"
                      type="checkbox"
                      checked={!!formData.ignoreCommands}
                      onChange={(e) => handleChange('ignoreCommands', e.target.checked)}
                      className="w-4 h-4 rounded bg-[#13151c] border-white/[0.2] text-emerald-500 accent-emerald-500 cursor-pointer"
                    />
                  </div>

                  {formData.ignoreCommands && (
                    <div className="space-y-1.5 pt-1">
                      <label htmlFor="ctrl-command-prefixes-input" className="block text-[11px] text-[#8c93a4]">
                        Command Prefixes (comma separated):
                      </label>
                      <input
                        id="ctrl-command-prefixes-input"
                        type="text"
                        placeholder="!, /, ., $, ?, #"
                        value={formData.commandPrefixes || ''}
                        onChange={(e) => handleChange('commandPrefixes', e.target.value)}
                        className="w-full px-3 py-1.5 bg-[#0c0d12] border border-white/[0.08] focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981]/20 rounded text-xs text-[#f1f3f7] font-mono outline-none"
                      />
                      <p className="text-[10px] text-[#525866]">
                        Messages starting with any of these characters (e.g. <code>!drop</code>, <code>/me</code>, <code>$gamble</code>) will be skipped.
                      </p>
                    </div>
                  )}
                </div>

                {/* Emote Filters Card */}
                <div className="bg-[#13151c] border border-white/[0.06] rounded-lg p-4 space-y-3 transition-colors hover:border-white/[0.12]">
                  <h3 className="text-xs font-bold text-[#f1f3f7] uppercase tracking-wider border-b border-white/[0.06] pb-2.5 flex items-center gap-2">
                    <Smile className="w-4 h-4 text-emerald-400" />
                    <span>Emote Filtering</span>
                  </h3>

                  <div className="flex items-center justify-between p-3 bg-[#0c0d12] border border-white/[0.06] rounded-lg">
                    <div>
                      <div className="text-xs text-[#f1f3f7] font-medium">Ignore Emote-Only Spam</div>
                      <div className="text-[11px] text-[#8c93a4]">Skip messages consisting only of emotes/reactions</div>
                    </div>
                    <input
                      id="ctrl-ignore-emotes-only-checkbox"
                      type="checkbox"
                      checked={!!formData.ignoreEmotesOnly}
                      onChange={(e) => handleChange('ignoreEmotesOnly', e.target.checked)}
                      className="w-4 h-4 rounded bg-[#13151c] border-white/[0.2] text-emerald-500 accent-emerald-500 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-[#0c0d12] border border-white/[0.06] rounded-lg">
                    <div>
                      <div className="text-xs text-[#f1f3f7] font-medium">Strip Emotes from TTS Voice</div>
                      <div className="text-[11px] text-[#8c93a4]">Voice will pronounce text without reading emote codes</div>
                    </div>
                    <input
                      id="ctrl-tts-filter-emotes-checkbox"
                      type="checkbox"
                      checked={!!formData.ttsFilterEmotes}
                      onChange={(e) => handleChange('ttsFilterEmotes', e.target.checked)}
                      className="w-4 h-4 rounded bg-[#13151c] border-white/[0.2] text-emerald-500 accent-emerald-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Ignored Users & Bots Card */}
                <div className="bg-[#13151c] border border-white/[0.06] rounded-lg p-4 space-y-3 transition-colors hover:border-white/[0.12]">
                  <h3 className="text-xs font-bold text-[#f1f3f7] uppercase tracking-wider border-b border-white/[0.06] pb-2.5 flex items-center gap-2">
                    <UserX className="w-4 h-4 text-emerald-400" />
                    <span>Ignored Users & Bots</span>
                  </h3>

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#525866] text-xs font-mono">@</span>
                      <input
                        id="ctrl-add-ignored-user-input"
                        type="text"
                        placeholder="Username or bot (e.g. Nightbot, Moobot)"
                        value={newIgnoredUser}
                        onChange={(e) => setNewIgnoredUser(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddIgnoredUser();
                          }
                        }}
                        className="w-full pl-7 pr-3 py-1.5 bg-[#0c0d12] border border-white/[0.08] focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981]/20 rounded text-xs text-[#f1f3f7] font-mono outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddIgnoredUser}
                      className="px-3.5 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] text-[#f1f3f7] border border-white/[0.1] text-xs font-semibold rounded transition-colors flex items-center gap-1.5 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>

                  {/* List of ignored users */}
                  <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pt-1">
                    {currentIgnoredUsers.length === 0 ? (
                      <div className="text-center py-4 text-[#525866] text-xs italic">
                        No ignored users. Add bot or user names above.
                      </div>
                    ) : (
                      currentIgnoredUsers.map((u) => (
                        <div
                          key={u}
                          className="flex items-center justify-between p-2 rounded bg-[#0c0d12] border border-white/[0.05] text-xs"
                        >
                          <div className="flex items-center gap-2 font-mono text-[#f1f3f7]">
                            <UserX className="w-3.5 h-3.5 text-rose-400/80" />
                            <span>@{u}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveIgnoredUser(u)}
                            className="p-1 text-[#8c93a4] hover:text-rose-400 transition-colors"
                            title={`Unignore @${u}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Hide from chat UI switch */}
                  <div className="flex items-center justify-between p-3 bg-[#0c0d12] border border-white/[0.06] rounded-lg mt-2">
                    <div>
                      <div className="text-xs text-[#f1f3f7] font-medium">Hide from Chat Stream</div>
                      <div className="text-[11px] text-[#8c93a4]">
                        When enabled, ignored messages won't appear in the chat view
                      </div>
                    </div>
                    <input
                      id="ctrl-hide-ignored-chat-checkbox"
                      type="checkbox"
                      checked={!!formData.hideIgnoredFromChat}
                      onChange={(e) => handleChange('hideIgnoredFromChat', e.target.checked)}
                      className="w-4 h-4 rounded bg-[#13151c] border-white/[0.2] text-emerald-500 accent-emerald-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: APPEARANCE */}
            {activeTab === 'appearance' && (
              <div className="space-y-4">
                <div className="bg-[#13151c] border border-white/[0.06] rounded-lg p-4 space-y-3 transition-colors hover:border-white/[0.12]">
                  <h3 className="text-xs font-bold text-[#f1f3f7] uppercase tracking-wider border-b border-white/[0.06] pb-2 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-emerald-400" />
                    <span>Channel Identification Display Mode</span>
                  </h3>
                  <div>
                    <select
                      id="ctrl-channel-badge-mode"
                      value={formData.channelBadgeMode || 'name'}
                      onChange={(e) => handleChange('channelBadgeMode', e.target.value)}
                      className="w-full px-3 py-2 bg-[#0c0d12] border border-white/[0.08] focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981]/20 rounded text-xs text-[#f1f3f7] font-mono outline-none"
                    >
                      <option value="name">Full Channel Name (#channelname)</option>
                      <option value="icon_only">Compact Icon Only + Unique Channel Background Color</option>
                      <option value="icon_bg">Icon + Name + Unique Channel Background Color</option>
                      <option value="accent_line">Colored Left Accent Border Line per Channel</option>
                    </select>
                  </div>
                </div>

                <div className="bg-[#13151c] border border-white/[0.06] rounded-lg p-4 space-y-3 transition-colors hover:border-white/[0.12]">
                  <h3 className="text-xs font-bold text-[#f1f3f7] uppercase tracking-wider border-b border-white/[0.06] pb-2 flex items-center gap-2">
                    <Palette className="w-4 h-4 text-emerald-400" />
                    <span>Twitch Icon Accent Color</span>
                  </h3>
                  <div>
                    <select
                      id="ctrl-icon-color"
                      value={formData.iconColor || 'teal'}
                      onChange={(e) => handleChange('iconColor', e.target.value)}
                      className="w-full px-3 py-2 bg-[#0c0d12] border border-white/[0.08] focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981]/20 rounded text-xs text-[#f1f3f7] font-mono outline-none"
                    >
                      {Object.entries(ICON_COLORS).map(([key, item]) => (
                        <option key={key} value={key}>
                          {item.name} {item.hex !== 'auto' ? `(${item.hex})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="bg-[#13151c] border border-white/[0.06] rounded-lg p-4 space-y-3 transition-colors hover:border-white/[0.12]">
                  <h3 className="text-xs font-bold text-[#f1f3f7] uppercase tracking-wider flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-emerald-400" />
                    <span>Chat Font Size</span>
                  </h3>
                  <select
                    id="ctrl-font-size-select"
                    value={formData.fontSize || 14}
                    onChange={(e) => handleChange('fontSize', parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 bg-[#0c0d12] border border-white/[0.08] focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981]/20 rounded text-xs text-[#f1f3f7] font-mono outline-none"
                  >
                    <option value={12}>12px (Small)</option>
                    <option value={14}>14px (Medium)</option>
                    <option value={16}>16px (Large)</option>
                    <option value={18}>18px (Extra Large)</option>
                  </select>
                </div>
              </div>
            )}

            {/* TAB 5: CHAT & HISTORY */}
            {activeTab === 'chat' && (
              <div className="space-y-4">
                <div className="bg-[#13151c] border border-white/[0.06] rounded-lg p-4 space-y-3 transition-colors hover:border-white/[0.12]">
                  <h3 className="text-xs font-bold text-[#f1f3f7] uppercase tracking-wider border-b border-white/[0.06] pb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <span>Timestamps</span>
                  </h3>
                  <div className="flex items-center justify-between p-3 bg-[#0c0d12] border border-white/[0.06] rounded-lg">
                    <div>
                      <div className="text-xs text-[#f1f3f7] font-medium">Show Timestamps</div>
                      <div className="text-[11px] text-[#8c93a4]">Display time prefix before chat messages</div>
                    </div>
                    <input
                      id="ctrl-show-timestamps-checkbox"
                      type="checkbox"
                      checked={!!formData.showTimestamps}
                      onChange={(e) => handleChange('showTimestamps', e.target.checked)}
                      className="w-4 h-4 rounded bg-[#13151c] border-white/[0.2] text-emerald-500 accent-emerald-500 cursor-pointer"
                    />
                  </div>

                  {formData.showTimestamps && (
                    <div className="flex items-center justify-between p-3 bg-[#0c0d12] border border-white/[0.06] rounded-lg">
                      <label htmlFor="ctrl-timestamp-format-select" className="text-xs text-[#f1f3f7]">
                        Timestamp Format
                      </label>
                      <select
                        id="ctrl-timestamp-format-select"
                        value={formData.timestampFormat || 'HH:MM:SS'}
                        onChange={(e) => handleChange('timestampFormat', e.target.value)}
                        className="px-3 py-1.5 bg-[#13151c] border border-white/[0.08] focus:border-[#10b981] rounded text-[#f1f3f7] text-xs font-mono outline-none"
                      >
                        <option value="HH:MM:SS">[15:04:05] (Full)</option>
                        <option value="HH:MM">[15:04] (Short)</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="bg-[#13151c] border border-white/[0.06] rounded-lg p-4 space-y-3 transition-colors hover:border-white/[0.12]">
                  <h3 className="text-xs font-bold text-[#f1f3f7] uppercase tracking-wider border-b border-white/[0.06] pb-2 flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-emerald-400" />
                    <span>Twitch User Badges</span>
                  </h3>
                  <div className="flex items-center justify-between p-3 bg-[#0c0d12] border border-white/[0.06] rounded-lg">
                    <div>
                      <div className="text-xs text-[#f1f3f7] font-medium">Show User Badges</div>
                      <div className="text-[11px] text-[#8c93a4]">Broadcaster, Moderator, Subscriber, VIP icons</div>
                    </div>
                    <input
                      id="ctrl-show-badges-checkbox"
                      type="checkbox"
                      checked={!!formData.showBadges}
                      onChange={(e) => handleChange('showBadges', e.target.checked)}
                      className="w-4 h-4 rounded bg-[#13151c] border-white/[0.2] text-emerald-500 accent-emerald-500 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="bg-[#13151c] border border-white/[0.06] rounded-lg p-4 space-y-3 transition-colors hover:border-white/[0.12]">
                  <h3 className="text-xs font-bold text-[#f1f3f7] uppercase tracking-wider flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    <span>Message Buffer Limit</span>
                  </h3>
                  <div className="space-y-1.5">
                    <input
                      id="ctrl-max-messages-input"
                      type="number"
                      min={100}
                      max={1000}
                      step={50}
                      value={formData.maxMessages || 300}
                      onChange={(e) => handleChange('maxMessages', parseInt(e.target.value, 10))}
                      className="w-full px-3 py-1.5 bg-[#0c0d12] border border-white/[0.08] focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981]/20 rounded text-xs text-[#f1f3f7] font-mono outline-none"
                    />
                    <p className="text-[10px] text-[#8c93a4]">
                      Maximum number of messages kept in memory (100 - 1000).
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 6: TTS / VOICE */}
            {activeTab === 'tts' && (
              <div className="space-y-4">
                <div className="bg-[#13151c] border border-white/[0.06] rounded-lg p-4 space-y-3 transition-colors hover:border-white/[0.12]">
                  <div className="flex justify-between items-center border-b border-white/[0.06] pb-2.5">
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-[#f1f3f7] uppercase tracking-wider">
                        Text-to-Speech Engine
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-mono rounded ${
                        formData.ttsEnabled
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80'
                          : 'bg-white/[0.04] text-[#8c93a4] border border-white/[0.08]'
                      }`}
                    >
                      {formData.ttsEnabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-[#0c0d12] border border-white/[0.06] rounded-lg">
                    <div>
                      <div className="text-xs text-[#f1f3f7] font-medium">Enable Chat Voice (TTS)</div>
                      <div className="text-[11px] text-[#8c93a4]">Read incoming chat messages aloud automatically</div>
                    </div>
                    <input
                      id="ctrl-tts-enabled-checkbox"
                      type="checkbox"
                      checked={!!formData.ttsEnabled}
                      onChange={(e) => handleChange('ttsEnabled', e.target.checked)}
                      className="w-4 h-4 rounded bg-[#13151c] border-white/[0.2] text-emerald-500 accent-emerald-500 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs text-[#f1f3f7]">
                      <span>Speech Volume:</span>
                      <span className="font-mono text-emerald-400">
                        {Math.round((formData.ttsVolume !== undefined ? formData.ttsVolume : 1.0) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={formData.ttsVolume !== undefined ? formData.ttsVolume : 1.0}
                      onChange={(e) => handleChange('ttsVolume', parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-[#0c0d12] rounded-lg appearance-none cursor-pointer accent-[#10b981]"
                    />
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <label htmlFor="ctrl-tts-engine-select" className="block text-xs text-[#f1f3f7]">
                      TTS Voice Provider Engine:
                    </label>
                    <select
                      id="ctrl-tts-engine-select"
                      value={formData.ttsEngine || 'yandex'}
                      onChange={(e) => handleChange('ttsEngine', e.target.value)}
                      className="w-full px-3 py-1.5 bg-[#0c0d12] border border-white/[0.08] focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981]/20 rounded text-xs text-[#f1f3f7] font-mono outline-none"
                    >
                      <option value="yandex">Yandex SpeechKit Cloud (Alice / Shitova, Maxim, etc.)</option>
                      <option value="local">Local System SAPI / OS Speech Synthesis</option>
                    </select>
                  </div>

                  {formData.ttsEngine === 'local' ? (
                    <div className="space-y-1.5 pt-1">
                      <label htmlFor="ctrl-tts-voice-local-select" className="block text-xs text-[#f1f3f7]">
                        Installed System Voice:
                      </label>
                      <select
                        id="ctrl-tts-voice-local-select"
                        value={formData.ttsVoiceLocal || ''}
                        onChange={(e) => handleChange('ttsVoiceLocal', e.target.value)}
                        className="w-full px-3 py-1.5 bg-[#0c0d12] border border-white/[0.08] focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981]/20 rounded text-xs text-[#f1f3f7] font-mono outline-none"
                      >
                        {localVoices.length === 0 ? (
                          <option value="">Default System Voice</option>
                        ) : (
                          localVoices.map((v) => (
                            <option key={v.name} value={v.name}>
                              {v.name} ({v.lang})
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-1.5 pt-1">
                      <label htmlFor="ctrl-tts-voice-select" className="block text-xs text-[#f1f3f7]">
                        Yandex Voice Character:
                      </label>
                      <select
                        id="ctrl-tts-voice-select"
                        value={formData.ttsVoice || 'shitova.us'}
                        onChange={(e) => handleChange('ttsVoice', e.target.value)}
                        className="w-full px-3 py-1.5 bg-[#0c0d12] border border-white/[0.08] focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981]/20 rounded text-xs text-[#f1f3f7] font-mono outline-none"
                      >
                        {Object.keys(ttsVoices).length === 0 ? (
                          <>
                            <option value="shitova.us">Татьяна Шитова (Алиса)</option>
                            <option value="alyss">Alyss</option>
                            <option value="ermil">Ermil</option>
                            <option value="jane">Jane</option>
                            <option value="oksana">Oksana</option>
                            <option value="omazh">Omazh</option>
                            <option value="zahar">Zahar</option>
                          </>
                        ) : (
                          Object.entries(ttsVoices).map(([id, name]) => (
                            <option key={id} value={id}>
                              {name} ({id})
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleTestTTS}
                      disabled={isTTSTesting}
                      className="px-3.5 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] active:bg-white/[0.15] text-[#f1f3f7] border border-white/[0.1] text-xs font-semibold rounded transition-colors flex items-center gap-1.5"
                    >
                      {isTTSTesting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      ) : (
                        <Play className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                      <span>{isTTSTesting ? 'Speaking...' : 'Test Voice Synthesis'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </form>

          {/* Footer Save Actions */}
          <footer className="h-14 px-5 border-t border-white/[0.06] bg-[#12141a] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              {statusMsg && <span className="text-[11px] font-mono text-[#10b981]">{statusMsg}</span>}
              {isSaved && <span className="text-[11px] font-mono text-[#10b981] font-bold">✓ Saved</span>}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-[#8c93a4] hover:text-[#f1f3f7] text-xs rounded transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="px-4 py-1.5 bg-[#10b981] hover:bg-[#059669] active:bg-[#047857] text-[#0c0d12] font-semibold text-xs rounded transition-all shadow-xs flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save & Apply</span>
              </button>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );

  if (isStandaloneWindow) {
    return (
      <div className="w-screen h-screen bg-[#0c0d12] p-0 m-0 overflow-hidden flex flex-col">
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#0c0d12]/80 backdrop-blur-sm flex items-center justify-center p-0">
      <div className="w-full h-full max-w-4xl bg-[#0c0d12] rounded-lg shadow-2xl overflow-hidden flex flex-col border border-white/[0.08]">
        {content}
      </div>
    </div>
  );
}
