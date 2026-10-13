import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Monitor,
  Music,
  Heart,
  Coins,
  Target,
  Copy,
  Check,
  Play,
  Loader2,
  FolderOpen,
  ExternalLink,
  Sliders,
  Sparkles,
  CheckCircle2,
  Volume2,
} from 'lucide-react';
import {
  GetWidgetURL,
  GetWidgetThemes,
  OpenThemesDir,
  SendTestChatMessage,
  GetMusicWidgetURL,
  GetMusicWidgetThemes,
  OpenMusicThemesDir,
  SendTestMusicTrack,
  GetCurrentTrack,
  GetFollowerWidgetURL,
  GetFollowerWidgetThemes,
  OpenFollowerThemesDir,
  SendTestFollowMessage,
  GetDonationWidgetURL,
  OpenDonationThemesDir,
  SendTestDonation,
  GetGoalWidgetURL,
  OpenGoalThemesDir,
  SendTestGoal,
  GetTTSWidgetURL,
  GetTTSWidgetThemes,
  OpenTTSThemesDir,
  SendTestTTSStatus,
} from '../../../wailsjs/go/main/App';

export default function WidgetsTab({
  formData = {},
  updateAndSave,
  activeSubTab = 'catalog',
  setActiveSubTab,
}) {
  const [copiedKey, setCopiedKey] = useState('');
  const [loadingAction, setLoadingAction] = useState('');

  // URLs & Themes states
  const [chatUrl, setChatUrl] = useState('http://localhost:3500/widget/chat');
  const [chatThemes, setChatThemes] = useState([]);
  const [selectedChatTheme, setSelectedChatTheme] = useState('default');

  const [musicUrl, setMusicUrl] = useState('http://localhost:3500/widget/music');
  const [musicThemes, setMusicThemes] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(null);

  const [followerUrl, setFollowerUrl] = useState('http://localhost:3500/widget/follower');
  const [followerThemes, setFollowerThemes] = useState([]);

  const [donationUrl, setDonationUrl] = useState('http://localhost:3500/widget/donation');
  const [goalUrl, setGoalUrl] = useState('http://localhost:3500/widget/goal');

  const [ttsUrl, setTtsUrl] = useState('http://localhost:3500/widget/tts');
  const [ttsThemes, setTtsThemes] = useState([]);

  useEffect(() => {
    GetWidgetURL().then(setChatUrl).catch(() => {});
    GetWidgetThemes().then((t) => setChatThemes(t || [])).catch(() => {});

    GetMusicWidgetURL().then(setMusicUrl).catch(() => {});
    GetMusicWidgetThemes().then((t) => setMusicThemes(t || [])).catch(() => {});
    GetCurrentTrack().then(setCurrentTrack).catch(() => {});

    GetFollowerWidgetURL().then(setFollowerUrl).catch(() => {});
    GetFollowerWidgetThemes().then((t) => setFollowerThemes(t || [])).catch(() => {});

    GetDonationWidgetURL().then(setDonationUrl).catch(() => {});
    GetGoalWidgetURL().then(setGoalUrl).catch(() => {});

    GetTTSWidgetURL().then(setTtsUrl).catch(() => {});
    GetTTSWidgetThemes().then((t) => setTtsThemes(t || [])).catch(() => {});
  }, []);

  const copyToClipboard = (text, key) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  const runAction = async (key, fn) => {
    setLoadingAction(key);
    try {
      await fn();
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setLoadingAction(''), 800);
    }
  };

  const STYLES = [
    { id: 'glass', label: 'Glassmorphism', desc: 'Матовое стекло и блюр', icon: '💎' },
    { id: 'compact', label: 'Компактный Pill', desc: 'Узкая овальная плашка', icon: '💊' },
    { id: 'vinyl', label: 'Виниловая пластинка', desc: 'Вращающийся винил', icon: '💿' },
    { id: 'retro98', label: 'Windows 98 Retro', desc: 'Классический винтажный плеер', icon: '💾' },
    { id: 'aurora', label: 'Aurora Glow', desc: 'Северное сияние и аура', icon: '🌌' },
    { id: 'cassette', label: 'Аудиокассета 80-х', desc: 'Ретро-кассета с бобинами', icon: '📼' },
    { id: 'neon', label: 'Неоновый кибер', desc: 'Яркие неоновые контуры', icon: '✨' },
    { id: 'minimal', label: 'Минималистичный', desc: 'Чистый виджет без фона', icon: '🍃' },
  ];

  const ACCENT_COLORS = [
    { id: 'emerald', label: 'Изумруд', hex: '#10B981', border: 'border-emerald-500' },
    { id: 'purple', label: 'Twitch', hex: '#9146FF', border: 'border-purple-500' },
    { id: 'blue', label: 'Сапфир', hex: '#3B82F6', border: 'border-blue-500' },
    { id: 'pink', label: 'Неон Пинк', hex: '#EC4899', border: 'border-pink-500' },
    { id: 'amber', label: 'Янтарь', hex: '#F59E0B', border: 'border-amber-500' },
  ];

  /* 1. CATALOG / HUB */
  if (!activeSubTab || activeSubTab === 'catalog') {
    return (
      <div className="space-y-6 animate-fade-in font-sans">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-[#201a33] via-[#1a232c] to-[#142320] rounded-2xl p-5 border border-white/[0.06] shadow-sm relative overflow-hidden">
          <div className="relative z-10 space-y-1">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5 text-[#9146FF]" />
              <h3 className="text-sm font-bold text-[#ECECF1]">Каталог виджетов для OBS Studio</h3>
            </div>
            <p className="text-xs text-[#8E92A4] leading-relaxed max-w-xl">
              Легковесные локальные оверлеи с горячей перезагрузкой (SSE Hot-Reload). 
              Вставьте ссылку в источник «Браузер» в OBS Studio. Любые изменения в темах и настройках обновляются мгновенно.
            </p>
          </div>
          <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
        </div>

        {/* 5 WIDGET TILES */}
        <div>
          <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-3 flex items-center justify-between">
            <span>ДОСТУПНЫЕ ОВЕРЛЕИ</span>
            <span className="text-[11px] text-[#6C7082] font-mono">PORT 3500 // LOCAL SERVER</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* TILE 1: ЧАТ */}
            <div className="p-4 rounded-2xl border border-white/[0.06] hover:border-[#9146FF]/60 bg-gradient-to-b from-[#1e1a29] to-[#161420] transition-all flex flex-col justify-between gap-3 group">
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#9146FF] to-[#7c3aed] flex items-center justify-center text-white shadow-md">
                    <Monitor className="w-5 h-5" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#9146FF]/20 text-[#c084fc] border border-[#9146FF]/35 font-mono">
                    CHAT OVERLAY
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#ECECF1] group-hover:text-purple-300 transition-colors">
                    Виджет чата
                  </h4>
                  <p className="text-xs text-[#8E92A4] mt-1 leading-relaxed">
                    Сообщения Twitch и Kick с цветными никами, значками и анимациями.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-white/[0.06] flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('chat')}
                  className="flex-1 py-1.5 px-3 bg-[#9146FF] hover:bg-[#7c3aed] text-white text-xs font-bold rounded-xl transition-all cursor-pointer text-center"
                >
                  Настроить →
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(chatUrl, 'chat')}
                  title="Скопировать ссылку для OBS"
                  className="p-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-[#ECECF1] rounded-xl border border-white/[0.06] transition-all cursor-pointer"
                >
                  {copiedKey === 'chat' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => runAction('chat', SendTestChatMessage)}
                  title="Тестовое сообщение"
                  className="p-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-[#ECECF1] rounded-xl border border-white/[0.06] transition-all cursor-pointer"
                >
                  {loadingAction === 'chat' ? <Loader2 className="w-4 h-4 animate-spin text-purple-400" /> : <Play className="w-4 h-4 text-purple-400" />}
                </button>
              </div>
            </div>

            {/* TILE 2: МУЗЫКА */}
            <div className="p-4 rounded-2xl border border-white/[0.06] hover:border-[#10B981]/60 bg-gradient-to-b from-[#18231e] to-[#121915] transition-all flex flex-col justify-between gap-3 group">
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10B981] to-[#059669] flex items-center justify-center text-white shadow-md">
                    <Music className="w-5 h-5" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#10B981]/20 text-[#6ee7b7] border border-[#10B981]/35 font-mono">
                    NOW PLAYING
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#ECECF1] group-hover:text-emerald-300 transition-colors">
                    Виджет музыки
                  </h4>
                  <p className="text-xs text-[#8E92A4] mt-1 leading-relaxed">
                    Текущий трек из Spotify, Яндекс Музыки, VK с обложкой и эквалайзером.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-white/[0.06] flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('music')}
                  className="flex-1 py-1.5 px-3 bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all cursor-pointer text-center"
                >
                  Настроить →
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(musicUrl, 'music')}
                  title="Скопировать ссылку для OBS"
                  className="p-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-[#ECECF1] rounded-xl border border-white/[0.06] transition-all cursor-pointer"
                >
                  {copiedKey === 'music' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => runAction('music', SendTestMusicTrack)}
                  title="Тестовый трек"
                  className="p-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-[#ECECF1] rounded-xl border border-white/[0.06] transition-all cursor-pointer"
                >
                  {loadingAction === 'music' ? <Loader2 className="w-4 h-4 animate-spin text-emerald-400" /> : <Play className="w-4 h-4 text-emerald-400" />}
                </button>
              </div>
            </div>

            {/* TILE 3: ФОЛЛОВЕРЫ */}
            <div className="p-4 rounded-2xl border border-white/[0.06] hover:border-[#EC4899]/60 bg-gradient-to-b from-[#241723] to-[#181118] transition-all flex flex-col justify-between gap-3 group">
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#EC4899] to-[#be185d] flex items-center justify-center text-white shadow-md">
                    <Heart className="w-5 h-5" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EC4899]/20 text-[#f472b6] border border-[#EC4899]/35 font-mono">
                    FOLLOWER ALERT
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#ECECF1] group-hover:text-pink-300 transition-colors">
                    Оповещение о фолловере
                  </h4>
                  <p className="text-xs text-[#8E92A4] mt-1 leading-relaxed">
                    Всплывающая плашка при подписке нового зрителя на Twitch.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-white/[0.06] flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('follower')}
                  className="flex-1 py-1.5 px-3 bg-[#EC4899] hover:bg-pink-600 text-white text-xs font-bold rounded-xl transition-all cursor-pointer text-center"
                >
                  Настроить →
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(followerUrl, 'follower')}
                  title="Скопировать ссылку для OBS"
                  className="p-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-[#ECECF1] rounded-xl border border-white/[0.06] transition-all cursor-pointer"
                >
                  {copiedKey === 'follower' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => runAction('follower', SendTestFollowMessage)}
                  title="Тест фолловера"
                  className="p-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-[#ECECF1] rounded-xl border border-white/[0.06] transition-all cursor-pointer"
                >
                  {loadingAction === 'follower' ? <Loader2 className="w-4 h-4 animate-spin text-pink-400" /> : <Play className="w-4 h-4 text-pink-400" />}
                </button>
              </div>
            </div>

            {/* TILE 4: ДОНАТЫ */}
            <div className="p-4 rounded-2xl border border-white/[0.06] hover:border-[#F59E0B]/60 bg-gradient-to-b from-[#241d13] to-[#18140e] transition-all flex flex-col justify-between gap-3 group">
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F59E0B] to-[#b45309] flex items-center justify-center text-white shadow-md">
                    <Coins className="w-5 h-5" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F59E0B]/20 text-[#fbbf24] border border-[#F59E0B]/35 font-mono">
                    DONATION ALERT
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#ECECF1] group-hover:text-amber-300 transition-colors">
                    Оповещение о донатах
                  </h4>
                  <p className="text-xs text-[#8E92A4] mt-1 leading-relaxed">
                    Анимированный баннер доната с суммой, именем и текстом из DonationAlerts.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-white/[0.06] flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('donation')}
                  className="flex-1 py-1.5 px-3 bg-[#F59E0B] hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-all cursor-pointer text-center"
                >
                  Настроить →
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(donationUrl, 'donation')}
                  title="Скопировать ссылку для OBS"
                  className="p-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-[#ECECF1] rounded-xl border border-white/[0.06] transition-all cursor-pointer"
                >
                  {copiedKey === 'donation' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => runAction('donation', () => SendTestDonation(150, 'RUB', 'Донатер', 'Спасибо за стрим!'))}
                  title="Тест доната (150 ₽)"
                  className="p-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-[#ECECF1] rounded-xl border border-white/[0.06] transition-all cursor-pointer"
                >
                  {loadingAction === 'donation' ? <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> : <Play className="w-4 h-4 text-amber-400" />}
                </button>
              </div>
            </div>

            {/* TILE 5: СБОР СРЕДСТВ */}
            <div className="p-4 rounded-2xl border border-white/[0.06] hover:border-[#06B6D4]/60 bg-gradient-to-b from-[#142024] to-[#0e1619] transition-all flex flex-col justify-between gap-3 group">
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#06B6D4] to-[#0e7490] flex items-center justify-center text-white shadow-md">
                    <Target className="w-5 h-5" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#06B6D4]/20 text-[#67e8f9] border border-[#06B6D4]/35 font-mono">
                    GOAL PROGRESS
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#ECECF1] group-hover:text-cyan-300 transition-colors">
                    Полоса сбора средств
                  </h4>
                  <p className="text-xs text-[#8E92A4] mt-1 leading-relaxed">
                    Стильный оверлей прогресса сбора средств (цели из DonationAlerts).
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-white/[0.06] flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('goal')}
                  className="flex-1 py-1.5 px-3 bg-[#06B6D4] hover:bg-cyan-600 text-white text-xs font-bold rounded-xl transition-all cursor-pointer text-center"
                >
                  Настроить →
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(goalUrl, 'goal')}
                  title="Скопировать ссылку для OBS"
                  className="p-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-[#ECECF1] rounded-xl border border-white/[0.06] transition-all cursor-pointer"
                >
                  {copiedKey === 'goal' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => runAction('goal', () => SendTestGoal('Сбор на микрофон', 6500, 10000, 'RUB'))}
                  title="Тест сбора"
                  className="p-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-[#ECECF1] rounded-xl border border-white/[0.06] transition-all cursor-pointer"
                >
                  {loadingAction === 'goal' ? <Loader2 className="w-4 h-4 animate-spin text-cyan-400" /> : <Play className="w-4 h-4 text-cyan-400" />}
                </button>
              </div>
            </div>

            {/* TILE 6: СТАТУС ОЗВУЧКИ */}
            <div className="p-4 rounded-2xl border border-white/[0.06] hover:border-blue-500/60 bg-gradient-to-b from-[#141b2b] to-[#0e121d] transition-all flex flex-col justify-between gap-3 group">
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
                    <Volume2 className="w-5 h-5" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/35 font-mono">
                    TTS STATUS
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#ECECF1] group-hover:text-blue-300 transition-colors">
                    Статус генерации озвучки
                  </h4>
                  <p className="text-xs text-[#8E92A4] mt-1 leading-relaxed">
                    Отображает в OBS генерацию Supertonic / Алисы и динамический эквалайзер озвучки.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-white/[0.06] flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('tts')}
                  className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer text-center"
                >
                  Настроить →
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(ttsUrl, 'tts')}
                  title="Скопировать ссылку для OBS"
                  className="p-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-[#ECECF1] rounded-xl border border-white/[0.06] transition-all cursor-pointer"
                >
                  {copiedKey === 'tts' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => runAction('tts', SendTestTTSStatus)}
                  title="Тест статуса TTS"
                  className="p-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-[#ECECF1] rounded-xl border border-white/[0.06] transition-all cursor-pointer"
                >
                  {loadingAction === 'tts' ? <Loader2 className="w-4 h-4 animate-spin text-blue-400" /> : <Play className="w-4 h-4 text-blue-400" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* 2. CHAT WIDGET VIEW */
  if (activeSubTab === 'chat') {
    return (
      <div className="space-y-5 animate-fade-in font-sans">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setActiveSubTab('catalog')}
            className="text-xs font-semibold text-[#8E92A4] hover:text-[#ECECF1] px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.04] cursor-pointer"
          >
            ← Все виджеты
          </button>
          <span className="text-xs font-bold text-[#c084fc] px-2.5 py-0.5 rounded-full bg-[#9146FF]/20 border border-[#9146FF]/30">
            Виджет чата
          </span>
        </div>

        {/* OBS URL CARD */}
        <div className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] space-y-3">
          <label className="text-xs font-semibold text-[#ECECF1] block">
            Ссылка для источника «Браузер» в OBS
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={chatUrl}
              className="flex-1 bg-[#181920] border border-white/[0.06] rounded-xl px-3.5 py-2 text-xs font-mono text-purple-300 select-all outline-none"
            />
            <button
              type="button"
              onClick={() => copyToClipboard(chatUrl, 'chatUrl')}
              className="px-3 py-2 bg-[#9146FF] hover:bg-purple-600 text-white rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5"
            >
              {copiedKey === 'chatUrl' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Скопировать</span>
            </button>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => runAction('chatTest', SendTestChatMessage)}
              className="px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-[#ECECF1] rounded-xl text-xs font-medium border border-white/[0.06] cursor-pointer flex items-center gap-1.5"
            >
              {loadingAction === 'chatTest' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" /> : <Play className="w-3.5 h-3.5 text-purple-400" />}
              <span>Отправить тест в OBS</span>
            </button>
            <button
              type="button"
              onClick={() => OpenThemesDir()}
              className="px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-[#8E92A4] hover:text-[#ECECF1] rounded-xl text-xs font-medium border border-white/[0.06] cursor-pointer flex items-center gap-1.5"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Открыть папку тем</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* 3. MUSIC WIDGET VIEW */
  if (activeSubTab === 'music') {
    return (
      <div className="space-y-5 animate-fade-in font-sans">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setActiveSubTab('catalog')}
            className="text-xs font-semibold text-[#8E92A4] hover:text-[#ECECF1] px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.04] cursor-pointer"
          >
            ← Все виджеты
          </button>
          <span className="text-xs font-bold text-[#6ee7b7] px-2.5 py-0.5 rounded-full bg-[#10B981]/20 border border-[#10B981]/30">
            Виджет музыки
          </span>
        </div>

        {/* OBS URL CARD */}
        <div className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] space-y-3">
          <label className="text-xs font-semibold text-[#ECECF1] block">
            Ссылка для источника «Браузер» в OBS
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={musicUrl}
              className="flex-1 bg-[#181920] border border-white/[0.06] rounded-xl px-3.5 py-2 text-xs font-mono text-emerald-400 select-all outline-none"
            />
            <button
              type="button"
              onClick={() => copyToClipboard(musicUrl, 'musicUrl')}
              className="px-3 py-2 bg-[#10B981] hover:bg-emerald-600 text-white rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5"
            >
              {copiedKey === 'musicUrl' ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Скопировать</span>
            </button>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => runAction('musicTest', SendTestMusicTrack)}
              className="px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-[#ECECF1] rounded-xl text-xs font-medium border border-white/[0.06] cursor-pointer flex items-center gap-1.5"
            >
              {loadingAction === 'musicTest' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
              <span>Тестовый трек</span>
            </button>
            <button
              type="button"
              onClick={() => OpenMusicThemesDir()}
              className="px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-[#8E92A4] hover:text-[#ECECF1] rounded-xl text-xs font-medium border border-white/[0.06] cursor-pointer flex items-center gap-1.5"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Папка тем музыки</span>
            </button>
          </div>
        </div>

        {/* Music Styles Grid */}
        <div>
          <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-2">Стиль оверлея</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {STYLES.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => updateAndSave({ musicStyle: st.id })}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  (formData.musicStyle || 'glass') === st.id
                    ? 'bg-emerald-500/15 border-emerald-500 text-[#ECECF1] shadow-xs'
                    : 'bg-[#242631] border-white/[0.04] text-[#8E92A4] hover:border-white/20'
                }`}
              >
                <div className="text-xl mb-1">{st.icon}</div>
                <div className="text-xs font-bold text-[#ECECF1]">{st.label}</div>
                <div className="text-[10px] text-[#6C7082] mt-0.5 leading-tight">{st.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* 4. FOLLOWER WIDGET VIEW */
  if (activeSubTab === 'follower') {
    return (
      <div className="space-y-5 animate-fade-in font-sans">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setActiveSubTab('catalog')}
            className="text-xs font-semibold text-[#8E92A4] hover:text-[#ECECF1] px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.04] cursor-pointer"
          >
            ← Все виджеты
          </button>
          <span className="text-xs font-bold text-[#f472b6] px-2.5 py-0.5 rounded-full bg-[#EC4899]/20 border border-[#EC4899]/30">
            Оповещение о фолловерах
          </span>
        </div>

        <div className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] space-y-3">
          <label className="text-xs font-semibold text-[#ECECF1] block">
            Ссылка для источника «Браузер» в OBS
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={followerUrl}
              className="flex-1 bg-[#181920] border border-white/[0.06] rounded-xl px-3.5 py-2 text-xs font-mono text-pink-400 select-all outline-none"
            />
            <button
              type="button"
              onClick={() => copyToClipboard(followerUrl, 'followerUrl')}
              className="px-3 py-2 bg-[#EC4899] hover:bg-pink-600 text-white rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5"
            >
              {copiedKey === 'followerUrl' ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Скопировать</span>
            </button>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => runAction('followerTest', SendTestFollowMessage)}
              className="px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-[#ECECF1] rounded-xl text-xs font-medium border border-white/[0.06] cursor-pointer flex items-center gap-1.5"
            >
              {loadingAction === 'followerTest' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-pink-400" /> : <Play className="w-3.5 h-3.5 text-pink-400" />}
              <span>Тестовый фолловер</span>
            </button>
            <button
              type="button"
              onClick={() => OpenFollowerThemesDir()}
              className="px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-[#8E92A4] hover:text-[#ECECF1] rounded-xl text-xs font-medium border border-white/[0.06] cursor-pointer flex items-center gap-1.5"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Папка тем фолловеров</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* 5. DONATION WIDGET VIEW */
  if (activeSubTab === 'donation') {
    return (
      <div className="space-y-5 animate-fade-in font-sans">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setActiveSubTab('catalog')}
            className="text-xs font-semibold text-[#8E92A4] hover:text-[#ECECF1] px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.04] cursor-pointer"
          >
            ← Все виджеты
          </button>
          <span className="text-xs font-bold text-[#fbbf24] px-2.5 py-0.5 rounded-full bg-[#F59E0B]/20 border border-[#F59E0B]/30">
            Оповещение о донатах
          </span>
        </div>

        <div className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] space-y-3">
          <label className="text-xs font-semibold text-[#ECECF1] block">
            Ссылка для источника «Браузер» в OBS
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={donationUrl}
              className="flex-1 bg-[#181920] border border-white/[0.06] rounded-xl px-3.5 py-2 text-xs font-mono text-amber-400 select-all outline-none"
            />
            <button
              type="button"
              onClick={() => copyToClipboard(donationUrl, 'donationUrl')}
              className="px-3 py-2 bg-[#F59E0B] hover:bg-amber-600 text-white rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5"
            >
              {copiedKey === 'donationUrl' ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Скопировать</span>
            </button>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => runAction('donTest', () => SendTestDonation(150, 'RUB', 'Донатер', 'Спасибо за стрим!'))}
              className="px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-[#ECECF1] rounded-xl text-xs font-medium border border-white/[0.06] cursor-pointer flex items-center gap-1.5"
            >
              {loadingAction === 'donTest' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" /> : <Play className="w-3.5 h-3.5 text-amber-400" />}
              <span>Тестовый донат (150 ₽)</span>
            </button>
            <button
              type="button"
              onClick={() => OpenDonationThemesDir()}
              className="px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-[#8E92A4] hover:text-[#ECECF1] rounded-xl text-xs font-medium border border-white/[0.06] cursor-pointer flex items-center gap-1.5"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Папка тем донатов</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* 6. GOAL WIDGET VIEW */
  if (activeSubTab === 'goal') {
    return (
      <div className="space-y-5 animate-fade-in font-sans">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setActiveSubTab('catalog')}
            className="text-xs font-semibold text-[#8E92A4] hover:text-[#ECECF1] px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.04] cursor-pointer"
          >
            ← Все виджеты
          </button>
          <span className="text-xs font-bold text-[#67e8f9] px-2.5 py-0.5 rounded-full bg-[#06B6D4]/20 border border-[#06B6D4]/30">
            Полоса сбора средств
          </span>
        </div>

        <div className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] space-y-3">
          <label className="text-xs font-semibold text-[#ECECF1] block">
            Ссылка для источника «Браузер» в OBS
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={goalUrl}
              className="flex-1 bg-[#181920] border border-white/[0.06] rounded-xl px-3.5 py-2 text-xs font-mono text-cyan-400 select-all outline-none"
            />
            <button
              type="button"
              onClick={() => copyToClipboard(goalUrl, 'goalUrl')}
              className="px-3 py-2 bg-[#06B6D4] hover:bg-cyan-600 text-white rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5"
            >
              {copiedKey === 'goalUrl' ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Скопировать</span>
            </button>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => runAction('goalTest', () => SendTestGoal('Сбор на микрофон', 6500, 10000, 'RUB'))}
              className="px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-[#ECECF1] rounded-xl text-xs font-medium border border-white/[0.06] cursor-pointer flex items-center gap-1.5"
            >
              {loadingAction === 'goalTest' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" /> : <Play className="w-3.5 h-3.5 text-cyan-400" />}
              <span>Тестовый сбор</span>
            </button>
            <button
              type="button"
              onClick={() => OpenGoalThemesDir()}
              className="px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-[#8E92A4] hover:text-[#ECECF1] rounded-xl text-xs font-medium border border-white/[0.06] cursor-pointer flex items-center gap-1.5"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Папка тем сбора</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* 7. TTS STATUS WIDGET VIEW */
  if (activeSubTab === 'tts') {
    return (
      <div className="space-y-5 animate-fade-in font-sans">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setActiveSubTab('catalog')}
            className="text-xs font-semibold text-[#8E92A4] hover:text-[#ECECF1] px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.04] cursor-pointer"
          >
            ← Все виджеты
          </button>
          <span className="text-xs font-bold text-blue-400 px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30">
            Оверлей статуса озвучки
          </span>
        </div>

        {/* URL Card */}
        <div className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] space-y-3">
          <label className="text-xs font-semibold text-[#ECECF1] block">
            Ссылка для источника «Браузер» в OBS
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={ttsUrl}
              className="flex-1 bg-[#181920] border border-white/[0.06] rounded-xl px-3.5 py-2 text-xs font-mono text-blue-400 select-all outline-none"
            />
            <button
              type="button"
              onClick={() => copyToClipboard(ttsUrl, 'ttsUrl')}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5"
            >
              {copiedKey === 'ttsUrl' ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Скопировать</span>
            </button>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => runAction('ttsTestView', SendTestTTSStatus)}
              className="px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-[#ECECF1] rounded-xl text-xs font-medium border border-white/[0.06] cursor-pointer flex items-center gap-1.5"
            >
              {loadingAction === 'ttsTestView' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" /> : <Play className="w-3.5 h-3.5 text-blue-400" />}
              <span>Тестовая генерация (3.5 сек)</span>
            </button>
            <button
              type="button"
              onClick={() => OpenTTSThemesDir()}
              className="px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-[#8E92A4] hover:text-[#ECECF1] rounded-xl text-xs font-medium border border-white/[0.06] cursor-pointer flex items-center gap-1.5"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Папка тем TTS</span>
            </button>
          </div>
        </div>

        {/* Styles & Features Card */}
        <div className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] space-y-4">
          <div className="text-xs font-semibold text-[#8E92A4]">
            Возможности и стили оверлея
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div
              onClick={() => copyToClipboard(`${ttsUrl}?style=glass`, 'glass')}
              className="p-3 rounded-xl bg-[#181920] border border-white/[0.06] hover:border-blue-500/40 cursor-pointer transition-all group"
            >
              <div className="text-base mb-1">💎</div>
              <div className="text-xs font-bold text-[#ECECF1] group-hover:text-blue-300">Glassmorphism</div>
              <div className="text-[11px] text-[#8E92A4] mt-0.5">Размытие стекла и мягкое свечение</div>
              <div className="text-[10px] text-blue-400 mt-2 font-mono">
                {copiedKey === 'glass' ? '✓ Скопировано' : '?style=glass'}
              </div>
            </div>

            <div
              onClick={() => copyToClipboard(`${ttsUrl}?style=neon`, 'neon')}
              className="p-3 rounded-xl bg-[#181920] border border-white/[0.06] hover:border-blue-500/40 cursor-pointer transition-all group"
            >
              <div className="text-base mb-1">✨</div>
              <div className="text-xs font-bold text-[#ECECF1] group-hover:text-blue-300">Cyberpunk Neon</div>
              <div className="text-[11px] text-[#8E92A4] mt-0.5">Яркая неоновая окантовка и эквалайзер</div>
              <div className="text-[10px] text-blue-400 mt-2 font-mono">
                {copiedKey === 'neon' ? '✓ Скопировано' : '?style=neon'}
              </div>
            </div>

            <div
              onClick={() => copyToClipboard(`${ttsUrl}?style=compact`, 'compact')}
              className="p-3 rounded-xl bg-[#181920] border border-white/[0.06] hover:border-blue-500/40 cursor-pointer transition-all group"
            >
              <div className="text-base mb-1">💊</div>
              <div className="text-xs font-bold text-[#ECECF1] group-hover:text-blue-300">Compact Pill</div>
              <div className="text-[11px] text-[#8E92A4] mt-0.5">Мини-капсула в углу экрана</div>
              <div className="text-[10px] text-blue-400 mt-2 font-mono">
                {copiedKey === 'compact' ? '✓ Скопировано' : '?style=compact'}
              </div>
            </div>
          </div>

          <div className="p-3 bg-[#181920] rounded-xl border border-white/[0.04] space-y-1 text-xs text-[#8E92A4]">
            <div className="font-semibold text-[#ECECF1] flex items-center gap-1.5">
              <span>Параметры URL:</span>
            </div>
            <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
              <li><code className="text-blue-300">?style=glass|neon|compact</code> — визуальный стиль карточки</li>
              <li><code className="text-blue-300">?position=bottom-right|bottom-left|top-right|top-left</code> — угол экрана</li>
              <li><code className="text-blue-300">?accent=#3b82f6</code> — кастомный цвет свечения и эквалайзера</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
