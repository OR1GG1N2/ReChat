import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Music,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Volume1,
  Trash2,
  ArrowUp,
  X,
  Plus,
  ExternalLink,
  Sliders,
  Settings,
  Search,
  List,
  Clock,
  RotateCcw,
  Sparkles,
  Tv,
  Check,
  Edit2,
  MoreHorizontal,
  ChevronDown,
  Copy,
  Radio,
} from 'lucide-react';
import {
  MusicGetState,
  MusicGetRules,
  MusicUpdateRules,
  MusicAddTrack,
  MusicRemoveTrack,
  MusicMoveUp,
  MusicReorder,
  MusicSkip,
  MusicNext,
  MusicPrev,
  MusicPlayFromHistory,
  MusicRequeueFromHistory,
  MusicApprove,
  MusicReject,
  MusicUpdatePlayback,
  MusicClearQueue,
  MusicClearHistory,
} from '../../../wailsjs/go/main/App';
import { EventsOn } from '../../../wailsjs/runtime/runtime';

// Helper to format seconds into M:SS or MM:SS
function formatTime(totalSec) {
  if (!totalSec || isNaN(totalSec) || totalSec < 0) return '0:00';
  const sec = Math.floor(totalSec);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function MusicTab({ isWide = true }) {
  // Main music state from Go backend
  const [musicState, setMusicState] = useState({
    currentTrack: null,
    queue: [],
    moderation: [],
    history: [],
    totalQueueCount: 0,
    totalQueueDuration: 0,
    totalQueueDurationStr: '0:00',
    isPlaying: false,
    currentTime: 0,
    volume: 60,
    rules: {
      ordersEnabled: true,
      chatCommandEnabled: true,
      twitchRewardEnabled: true,
      donationOrdersEnabled: true,
      webOrdersEnabled: false,
      source: 'youtube',
      twitchPoints: 50,
      rewardTitle: 'Заказать трек',
      minDonation: 100,
      maxTracksPerUser: 2,
      blockPlaylists: true,
      maxDurationSec: 501, // ~8:21
      manualApproval: false,
      interruptOnRequest: true,
      pauseSystemMedia: true,
      blacklistChannels: [],
      blacklistTracks: [],
      youtubeApiKey: '',
      fallbackQuery: 'Lofi hip hop stream safe beats',
    },
  });

  // UI state
  const [activeSubTab, setActiveSubTab] = useState('queue'); // 'queue' | 'history' | 'moderation'
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addInputQuery, setAddInputQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isEditRulesOpen, setIsEditRulesOpen] = useState(false);
  const [editRulesForm, setEditRulesForm] = useState(musicState.rules);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showPiPVideo, setShowPiPVideo] = useState(true);
  const [showRightSidebarMobile, setShowRightSidebarMobile] = useState(false);
  const [activeMenuTrackId, setActiveMenuTrackId] = useState(null);

  // Audio output device selection
  const [isAudioDropdownOpen, setIsAudioDropdownOpen] = useState(false);
  const [audioDevicesList, setAudioDevicesList] = useState([]);
  const [selectedDeviceLabel, setSelectedDeviceLabel] = useState(() => {
    try {
      return localStorage.getItem('rechat_audio_device') || 'Динамики (fifine Headset)';
    } catch (_) {
      return 'Динамики (fifine Headset)';
    }
  });

  // Notifications
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Drag and Drop state
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Playback & player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(60);

  const playerRef = useRef(null);
  const currentPlayingIdRef = useRef(null);
  const currentTimeRef = useRef(0);
  const wsRef = useRef(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [isYtReady, setIsYtReady] = useState(Boolean(typeof window !== 'undefined' && window.YT && window.YT.Player));

  // Show status toasts
  const showError = (msg) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 3500);
  };
  const showSuccess = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 2500);
  };

  // Enumerate audio output devices if supported
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const audioOutputs = devices.filter((d) => d.kind === 'audiooutput');
        if (audioOutputs.length > 0) {
          setAudioDevicesList(audioOutputs);
        }
      }).catch(() => {});
    }
  }, []);

  // Wait for or load YouTube IFrame API script
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.YT && window.YT.Player) {
      setIsYtReady(true);
      return;
    }

    const timer = setInterval(() => {
      if (window.YT && window.YT.Player) {
        setIsYtReady(true);
        clearInterval(timer);
      }
    }, 200);

    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prevReady === 'function') prevReady();
      setIsYtReady(true);
    };

    if (!document.getElementById('yt-iframe-api')) {
      const tag = document.createElement('script');
      tag.id = 'yt-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }

    return () => clearInterval(timer);
  }, []);

  // Fetch initial state from Go backend via Wails
  const fetchState = useCallback(async () => {
    try {
      const state = await MusicGetState();
      if (state) {
        setMusicState((prev) => ({
          ...prev,
          ...state,
          rules: {
            ...prev.rules,
            ...(state.rules || {}),
          },
        }));
        setIsPlaying(Boolean(state.isPlaying));
        if (state.volume !== undefined) setVolume(state.volume);
        if (state.currentTrack) {
          setDuration(state.currentTrack.duration || 0);
        }
      }
    } catch (err) {
      console.warn('[Music] Error fetching state:', err);
    }
  }, []);

  // --- WebSocket Connection for Real-Time Music Queue ---
  useEffect(() => {
    let ws = null;
    let reconnectTimeout = null;
    let isDisposed = false;

    const connectWS = () => {
      if (isDisposed) return;
      try {
        const host = (typeof window !== 'undefined' && window.location.hostname) ? window.location.hostname : 'localhost';
        const wsUrl = `ws://${host}:3500/widget/music/ws`;
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          if (isDisposed) return;
          setWsConnected(true);
        };

        ws.onmessage = (event) => {
          if (isDisposed) return;
          try {
            const parsed = JSON.parse(event.data);
            if (parsed && parsed.type === 'state' && parsed.data) {
              const newState = parsed.data;
              setMusicState((prev) => ({
                ...prev,
                ...newState,
                rules: {
                  ...prev.rules,
                  ...(newState.rules || {}),
                },
              }));
              setIsPlaying(Boolean(newState.isPlaying));
              if (newState.volume !== undefined) setVolume(newState.volume);
              if (newState.currentTrack) {
                setDuration(newState.currentTrack.duration || 0);
              }
            }
          } catch (e) {
            console.warn('[Music WS] Parse error:', e);
          }
        };

        ws.onclose = () => {
          if (isDisposed) return;
          setWsConnected(false);
          reconnectTimeout = setTimeout(connectWS, 2500);
        };

        ws.onerror = () => {
          if (ws) ws.close();
        };

        wsRef.current = ws;
      } catch (e) {
        reconnectTimeout = setTimeout(connectWS, 3000);
      }
    };

    connectWS();

    return () => {
      isDisposed = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, []);

  // Send action via WebSocket if connected
  const sendWSAction = useCallback((actionPayload) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(actionPayload));
        return true;
      } catch (_) {}
    }
    return false;
  }, []);

  // Also listen for Wails runtime events as fallback
  useEffect(() => {
    fetchState();

    let unsub = null;
    try {
      unsub = EventsOn('music:state', (newState) => {
        if (newState) {
          setMusicState((prev) => ({
            ...prev,
            ...newState,
            rules: {
              ...prev.rules,
              ...(newState.rules || {}),
            },
          }));
          setIsPlaying(Boolean(newState.isPlaying));
          if (newState.currentTrack) {
            setDuration(newState.currentTrack.duration || 0);
          }
        }
      });
    } catch (e) {
      console.warn('[Music] EventsOn music:state fallback:', e);
    }

    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [fetchState]);

  const handleNext = useCallback(async () => {
    try {
      if (!sendWSAction({ action: 'next' })) {
        await MusicNext();
      }
      await fetchState();
    } catch (e) {
      console.warn('Next track error:', e);
    }
  }, [fetchState, sendWSAction]);

  // Sync track changes with YouTube Player
  const current = musicState.currentTrack;
  const currentVideoId = current?.videoId;

  // Initialize or update YouTube Player
  useEffect(() => {
    if (!currentVideoId) {
      currentPlayingIdRef.current = null;
      if (playerRef.current) {
        try {
          if (typeof playerRef.current.stopVideo === 'function') {
            playerRef.current.stopVideo();
          }
        } catch (_) {}
      }
      return;
    }

    if (!isYtReady) return;

    // If the same track is already loaded in the player, do not reload
    if (currentPlayingIdRef.current === currentVideoId && playerRef.current) {
      return;
    }

    // If player instance already exists and is healthy, load new track
    if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
      try {
        currentPlayingIdRef.current = currentVideoId;
        currentTimeRef.current = 0;
        playerRef.current.loadVideoById({
          videoId: currentVideoId,
          startSeconds: 0,
        });
        playerRef.current.setVolume(volume);
        setIsPlaying(true);
        return;
      } catch (err) {
        console.warn('Could not loadVideoById on existing player, re-creating:', err);
      }
    }

    // Create player in container
    try {
      const container = document.getElementById('youtube-player-element');
      if (!container) return;

      currentPlayingIdRef.current = currentVideoId;
      const startSec = Math.floor(currentTimeRef.current || musicState.currentTime || 0);

      playerRef.current = new window.YT.Player(container.id, {
        height: '100%',
        width: '100%',
        videoId: currentVideoId,
        playerVars: {
          autoplay: 1,
          controls: 1,
          rel: 0,
          enablejsapi: 1,
          modestbranding: 1,
          start: startSec,
        },
        events: {
          onReady: (event) => {
            try {
              event.target.setVolume(volume);
              if (startSec > 0 && typeof event.target.seekTo === 'function') {
                event.target.seekTo(startSec, true);
              }
              event.target.playVideo();
              setIsPlaying(true);
            } catch (_) {}
          },
          onStateChange: (event) => {
            if (event.data === 1) {
              setIsPlaying(true);
              const t = typeof event.target.getCurrentTime === 'function' ? event.target.getCurrentTime() : 0;
              currentTimeRef.current = t;
              sendWSAction({ action: 'updatePlayback', currentTime: t, isPlaying: true, volume });
              MusicUpdatePlayback(t, true, volume);
            } else if (event.data === 2) {
              setIsPlaying(false);
              const t = typeof event.target.getCurrentTime === 'function' ? event.target.getCurrentTime() : 0;
              currentTimeRef.current = t;
              sendWSAction({ action: 'updatePlayback', currentTime: t, isPlaying: false, volume });
              MusicUpdatePlayback(t, false, volume);
            } else if (event.data === 0) {
              setIsPlaying(false);
              currentPlayingIdRef.current = null;
              currentTimeRef.current = 0;
              handleNext();
            }
          },
        },
      });
    } catch (err) {
      console.warn('Failed to initialize YouTube Player:', err);
    }
  }, [currentVideoId, isYtReady, handleNext, sendWSAction, volume, musicState.currentTime]);

  // Live progress polling from YouTube player
  useEffect(() => {
    if (!isPlaying || !current) return;

    const interval = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        try {
          const t = playerRef.current.getCurrentTime();
          const d = playerRef.current.getDuration();
          if (typeof t === 'number' && !isNaN(t)) {
            setCurrentTime(t);
            currentTimeRef.current = t;
          }
          if (typeof d === 'number' && !isNaN(d) && d > 0) {
            setDuration(d);
          }
        } catch (_) {}
      } else {
        setCurrentTime((prev) => {
          const next = prev + 0.5;
          if (duration > 0 && next >= duration) {
            handleNext();
            return 0;
          }
          return next;
        });
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isPlaying, current, duration, handleNext]);

  // Controls
  const handlePrev = async () => {
    try {
      currentPlayingIdRef.current = null;
      currentTimeRef.current = 0;
      if (!sendWSAction({ action: 'prev' })) {
        await MusicPrev();
      }
      await fetchState();
      showSuccess('Предыдущий трек');
    } catch (err) {
      showError(String(err));
    }
  };

  const togglePlayPause = () => {
    if (playerRef.current && typeof playerRef.current.getPlayerState === 'function') {
      try {
        const state = playerRef.current.getPlayerState();
        if (state === 1) {
          playerRef.current.pauseVideo();
          setIsPlaying(false);
          sendWSAction({ action: 'updatePlayback', currentTime, isPlaying: false, volume });
          MusicUpdatePlayback(currentTime, false, volume);
        } else {
          playerRef.current.playVideo();
          setIsPlaying(true);
          sendWSAction({ action: 'updatePlayback', currentTime, isPlaying: true, volume });
          MusicUpdatePlayback(currentTime, true, volume);
        }
        return;
      } catch (_) {}
    }
    const nextState = !isPlaying;
    setIsPlaying(nextState);
    sendWSAction({ action: 'updatePlayback', currentTime, isPlaying: nextState, volume });
    MusicUpdatePlayback(currentTime, nextState, volume);
  };

  const handleSkip = async () => {
    try {
      if (playerRef.current && typeof playerRef.current.stopVideo === 'function') {
        try {
          playerRef.current.stopVideo();
        } catch (_) {}
      }
      if (!sendWSAction({ action: 'skip' })) {
        await MusicSkip();
      }
      await fetchState();
      showSuccess('Трек пропущен');
    } catch (e) {
      showError('Не удалось пропустить: ' + e);
    }
  };

  const handleSeek = (e) => {
    if (!duration || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = pct * duration;
    setCurrentTime(newTime);
    if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      try {
        playerRef.current.seekTo(newTime, true);
      } catch (_) {}
    }
    sendWSAction({ action: 'updatePlayback', currentTime: newTime, isPlaying, volume });
    MusicUpdatePlayback(newTime, isPlaying, volume);
  };

  const handleVolumeChange = (newVol) => {
    const clamped = Math.max(0, Math.min(100, newVol));
    setVolume(clamped);
    if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
      try {
        playerRef.current.setVolume(clamped);
      } catch (_) {}
    }
    sendWSAction({ action: 'updatePlayback', currentTime, isPlaying, volume: clamped });
    MusicUpdatePlayback(currentTime, isPlaying, clamped);
  };

  // Add track
  const handleAddTrack = async (e) => {
    if (e) e.preventDefault();
    const query = addInputQuery.trim();
    if (!query) return;

    setIsAdding(true);
    try {
      if (!sendWSAction({ action: 'add', query, user: 'Стример', platform: 'manual', cost: 'Вручную' })) {
        await MusicAddTrack(query, 'manual', 'Вручную');
      }
      setAddInputQuery('');
      setIsAddModalOpen(false);
      await fetchState();
      showSuccess('Трек добавлен в очередь');
    } catch (err) {
      showError(String(err));
    } finally {
      setIsAdding(false);
    }
  };

  // Generate stream-safe background track
  const handleRegenerateBackground = async () => {
    const query = musicState.rules.fallbackQuery || 'Lofi hip hop stream safe beats';
    try {
      showSuccess('Генерация фонового трека...');
      if (!sendWSAction({ action: 'add', query, user: 'Фон', platform: 'manual', cost: 'Фон' })) {
        await MusicAddTrack(query, 'manual', 'Фон');
      }
      await fetchState();
      showSuccess('Фоновый трек добавлен в очередь');
    } catch (err) {
      showError('Ошибка добавления: ' + err);
    }
  };

  // Queue actions
  const handleMoveUp = async (id) => {
    try {
      if (!sendWSAction({ action: 'moveUp', id })) {
        await MusicMoveUp(id);
      }
      await fetchState();
    } catch (err) {
      showError(String(err));
    }
  };

  const handleRemove = async (id) => {
    try {
      if (!sendWSAction({ action: 'remove', id })) {
        await MusicRemoveTrack(id);
      }
      await fetchState();
      showSuccess('Трек удален');
    } catch (err) {
      showError(String(err));
    }
  };

  // Drag and Drop reordering implementation
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', String(index));
    } catch (_) {}
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = async (e, toIndex) => {
    e.preventDefault();
    const fromIndex = draggedIndex;
    setDraggedIndex(null);
    setDragOverIndex(null);

    if (fromIndex === null || fromIndex === undefined || fromIndex === toIndex) {
      return;
    }

    // Optimistic UI update
    setMusicState((prev) => {
      const newQueue = [...prev.queue];
      const [moved] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, moved);
      return { ...prev, queue: newQueue };
    });

    try {
      // Send via WebSocket or Wails
      if (!sendWSAction({ action: 'reorder', from: fromIndex, to: toIndex })) {
        await MusicReorder(fromIndex, toIndex);
      }
      await fetchState();
    } catch (err) {
      showError('Ошибка перестановки трека: ' + err);
      fetchState();
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // History actions
  const handlePlayFromHistory = async (id) => {
    try {
      currentPlayingIdRef.current = null;
      currentTimeRef.current = 0;
      if (!sendWSAction({ action: 'playFromHistory', id })) {
        await MusicPlayFromHistory(id);
      }
      await fetchState();
      showSuccess('Воспроизведение из истории');
    } catch (err) {
      showError(String(err));
    }
  };

  const handleRequeueFromHistory = async (id) => {
    try {
      if (!sendWSAction({ action: 'requeueFromHistory', id })) {
        await MusicRequeueFromHistory(id);
      }
      await fetchState();
      showSuccess('Трек добавлен в очередь');
    } catch (err) {
      showError(String(err));
    }
  };

  // Moderation
  const handleApprove = async (id) => {
    try {
      if (!sendWSAction({ action: 'approve', id })) {
        await MusicApprove(id);
      }
      await fetchState();
      showSuccess('Трек одобрен');
    } catch (err) {
      showError(String(err));
    }
  };

  const handleReject = async (id) => {
    try {
      if (!sendWSAction({ action: 'reject', id, reason: 'Отклонено модератором' })) {
        await MusicReject(id, 'Отклонено модератором');
      }
      await fetchState();
      showSuccess('Трек отклонен');
    } catch (err) {
      showError(String(err));
    }
  };

  // Toggle individual order source switch
  const toggleSourceRule = async (key, name) => {
    const currentVal = Boolean(musicState.rules[key]);
    const updated = {
      ...musicState.rules,
      [key]: !currentVal,
    };
    setMusicState((prev) => ({ ...prev, rules: updated }));
    try {
      await MusicUpdateRules(updated);
      showSuccess(`${name}: ${!currentVal ? 'включено' : 'выключено'}`);
    } catch (err) {
      showError('Ошибка: ' + err);
    }
  };

  // Rules saving
  const handleSaveRulesModal = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ordersEnabled: Boolean(editRulesForm.ordersEnabled),
        chatCommandEnabled: Boolean(editRulesForm.chatCommandEnabled),
        twitchRewardEnabled: Boolean(editRulesForm.twitchRewardEnabled),
        donationOrdersEnabled: Boolean(editRulesForm.donationOrdersEnabled),
        webOrdersEnabled: Boolean(editRulesForm.webOrdersEnabled),
        source: editRulesForm.source || 'youtube',
        twitchPoints: Number(editRulesForm.twitchPoints) || 50,
        rewardTitle: editRulesForm.rewardTitle || 'Заказать трек',
        minDonation: Number(editRulesForm.minDonation) || 100,
        maxTracksPerUser: Number(editRulesForm.maxTracksPerUser) || 2,
        blockPlaylists: Boolean(editRulesForm.blockPlaylists),
        maxDurationSec: Number(editRulesForm.maxDurationSec) || 501,
        manualApproval: Boolean(editRulesForm.manualApproval),
        interruptOnRequest: Boolean(editRulesForm.interruptOnRequest),
        pauseSystemMedia: Boolean(editRulesForm.pauseSystemMedia),
        blacklistChannels: Array.isArray(editRulesForm.blacklistChannels) ? editRulesForm.blacklistChannels : [],
        blacklistTracks: Array.isArray(editRulesForm.blacklistTracks) ? editRulesForm.blacklistTracks : [],
        youtubeApiKey: editRulesForm.youtubeApiKey || '',
        fallbackQuery: editRulesForm.fallbackQuery || 'Lofi hip hop stream safe beats',
      };
      await MusicUpdateRules(payload);
      setMusicState((prev) => ({ ...prev, rules: payload }));
      setIsEditRulesOpen(false);
      await fetchState();
      showSuccess('Правила сохранены');
    } catch (err) {
      showError('Ошибка сохранения правил: ' + err);
    }
  };

  const handleOpenRulesModal = () => {
    const r = musicState.rules || {};
    setEditRulesForm({
      ordersEnabled: r.ordersEnabled ?? true,
      chatCommandEnabled: r.chatCommandEnabled ?? true,
      twitchRewardEnabled: r.twitchRewardEnabled ?? true,
      donationOrdersEnabled: r.donationOrdersEnabled ?? true,
      webOrdersEnabled: r.webOrdersEnabled ?? false,
      source: r.source || 'youtube',
      twitchPoints: r.twitchPoints ?? 50,
      rewardTitle: r.rewardTitle || 'Заказать трек',
      minDonation: r.minDonation ?? 100,
      maxTracksPerUser: r.maxTracksPerUser ?? 2,
      blockPlaylists: r.blockPlaylists ?? true,
      maxDurationSec: r.maxDurationSec ?? 501,
      manualApproval: r.manualApproval ?? false,
      interruptOnRequest: r.interruptOnRequest ?? true,
      pauseSystemMedia: r.pauseSystemMedia ?? true,
      blacklistChannels: Array.isArray(r.blacklistChannels) ? r.blacklistChannels : [],
      blacklistTracks: Array.isArray(r.blacklistTracks) ? r.blacklistTracks : [],
      youtubeApiKey: r.youtubeApiKey || '',
      fallbackQuery: r.fallbackQuery || 'Lofi hip hop stream safe beats',
    });
    setIsEditRulesOpen(true);
  };

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  // Filtered queue / history list based on search query
  const filteredQueue = (musicState.queue || []).filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (t.title && t.title.toLowerCase().includes(q)) ||
      (t.author && t.author.toLowerCase().includes(q)) ||
      (t.requestedBy && t.requestedBy.toLowerCase().includes(q))
    );
  });

  const filteredHistory = (musicState.history || []).filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (t.title && t.title.toLowerCase().includes(q)) ||
      (t.author && t.author.toLowerCase().includes(q)) ||
      (t.requestedBy && t.requestedBy.toLowerCase().includes(q))
    );
  });

  // Most recent played track for history preview banner
  const lastPlayed = musicState.history && musicState.history.length > 0 ? musicState.history[0] : null;

  return (
    <div className="w-full h-full bg-[#0E0F13] text-[#EDEEF2] font-['Manrope',sans-serif] select-none flex flex-col relative overflow-hidden flex-1 min-h-0">
      {/* Toast notifications */}
      {errorMessage && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 animate-fade-in pointer-events-none">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#15171E] border border-rose-500/50 text-rose-300 text-xs font-bold shadow-2xl backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span>{errorMessage}</span>
          </div>
        </div>
      )}
      {successMessage && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 animate-fade-in pointer-events-none">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#15171E] border border-[#7CF2C8]/50 text-[#7CF2C8] text-xs font-bold shadow-2xl backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-[#7CF2C8] animate-pulse" />
            <span>{successMessage}</span>
          </div>
        </div>
      )}

      {/* TOP BAR / HEADER (Responsive matching both 1600px and 400px mockups) */}
      <div className={`shrink-0 flex items-center justify-between border-b border-white/[0.06] ${isWide ? 'h-14 px-6 gap-3' : 'h-12 px-3 gap-2'}`}>
        {/* Navigation tabs */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveSubTab('queue')}
            className={`border-0 rounded-lg font-bold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
              isWide ? 'px-3 py-1.5' : 'px-2.5 py-1.5'
            } ${
              activeSubTab === 'queue'
                ? 'bg-[#7CF2C8] text-[#0E0F13] shadow-xs'
                : 'bg-transparent text-[#A0A4B4] hover:text-[#EDEEF2] hover:bg-white/[0.04]'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>Очередь</span>
            {musicState.queue.length > 0 && (
              <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded-md ${activeSubTab === 'queue' ? 'bg-[#0E0F13]/20 text-[#0E0F13]' : 'bg-[#1E212B] text-[#EDEEF2]'}`}>
                {musicState.queue.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('history')}
            className={`border-0 rounded-lg font-bold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
              isWide ? 'px-3 py-1.5' : 'px-2.5 py-1.5'
            } ${
              activeSubTab === 'history'
                ? 'bg-[#7CF2C8] text-[#0E0F13] shadow-xs'
                : 'bg-transparent text-[#A0A4B4] hover:text-[#EDEEF2] hover:bg-white/[0.04]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>История</span>
            {musicState.history.length > 0 && (
              <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded-md ${activeSubTab === 'history' ? 'bg-[#0E0F13]/20 text-[#0E0F13]' : 'bg-[#1E212B] text-[#EDEEF2]'}`}>
                {musicState.history.length}
              </span>
            )}
          </button>

          {musicState.moderation.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveSubTab('moderation')}
              className={`border-0 rounded-lg font-bold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                isWide ? 'px-3 py-1.5' : 'px-2.5 py-1.5'
              } ${
                activeSubTab === 'moderation'
                  ? 'bg-[#7CF2C8] text-[#0E0F13]'
                  : 'bg-transparent text-amber-300 hover:bg-amber-500/10'
              }`}
            >
              <span>Модерация</span>
              <span className="font-mono text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded-md">
                {musicState.moderation.length}
              </span>
            </button>
          )}
        </div>

        <div className="flex-1" />

        {/* Search bar & action buttons */}
        <div className="flex items-center gap-2">
          {/* Search: Full view has dedicated input, compact has toggle button */}
          {isWide ? (
            <div className="w-[240px] h-[34px] box-border flex items-center gap-2 px-3 rounded-lg bg-[#0E0F13] border border-white/[0.08] text-xs text-[#6B7080] focus-within:border-[#7CF2C8]/50 focus-within:text-[#EDEEF2] transition-colors">
              <Search className="w-3.5 h-3.5 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск в очереди"
                className="w-full bg-transparent text-[#EDEEF2] placeholder:text-[#6B7080] outline-none text-xs select-text"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-[#6B7080] hover:text-[#EDEEF2]"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ) : (
            <>
              {showSearchInput ? (
                <div className="w-[140px] h-[32px] flex items-center gap-1 px-2 rounded-lg bg-[#0E0F13] border border-white/[0.08] text-xs">
                  <Search className="w-3 h-3 text-[#6B7080] shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Поиск..."
                    className="w-full bg-transparent text-[#EDEEF2] outline-none text-xs select-text"
                    autoFocus
                  />
                  <button type="button" onClick={() => { setSearchQuery(''); setShowSearchInput(false); }}>
                    <X className="w-3 h-3 text-[#6B7080]" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSearchInput(true)}
                  className="p-1.5 rounded-lg bg-[#1E212B] text-[#A0A4B4] hover:text-[#EDEEF2] transition cursor-pointer"
                  title="Поиск"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}

          {/* Add tracks button */}
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className={`border-0 rounded-lg font-bold text-xs bg-[#7CF2C8] hover:bg-[#9af7d8] text-[#0E0F13] flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs ${
              isWide ? 'px-3 py-1.5' : 'p-2'
            }`}
            title="Добавить треки"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            {isWide && <span>Добавить треки</span>}
          </button>

          {/* Clear queue button */}
          {activeSubTab === 'queue' && musicState.queue.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Очистить всю текущую очередь треков?')) {
                  if (!sendWSAction({ action: 'clearQueue' })) {
                    MusicClearQueue();
                  }
                  fetchState();
                  showSuccess('Очередь очищена');
                }
              }}
              className={`border-0 rounded-lg font-bold text-xs bg-[#1E212B] hover:bg-rose-500/20 hover:text-rose-300 text-[#EDEEF2] flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                isWide ? 'px-3 py-1.5' : 'p-2'
              }`}
              title="Очистить очередь"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {isWide && <span>Очистить очередь</span>}
            </button>
          )}

          {/* Settings / Rules toggle button */}
          <button
            type="button"
            onClick={handleOpenRulesModal}
            className="p-2 rounded-lg bg-[#1E212B] hover:bg-[#282C38] text-[#A0A4B4] hover:text-[#EDEEF2] transition cursor-pointer"
            title="Настройка правил заказа"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* CENTER / QUEUE & NOW PLAYING COLUMN */}
        <div className="flex-1 min-w-0 flex flex-col overflow-y-auto custom-scrollbar pb-[76px]">
          {/* 1. DIMMED PREVIOUS TRACK ROW (if history item exists) */}
          {activeSubTab === 'queue' && lastPlayed && !searchQuery && (
            <div className="flex items-center gap-3.5 px-6 py-2.5 opacity-55 border-b border-white/[0.05] hover:opacity-85 transition-opacity">
              <span className="w-3.5 text-center text-[10px] text-[#6B7080] font-mono shrink-0">◂</span>
              <div
                className="w-14 h-8 rounded-md bg-[#2A2D3A] shrink-0 bg-cover bg-center overflow-hidden border border-white/[0.06]"
                style={{
                  backgroundImage: lastPlayed.thumbnail ? `url(${lastPlayed.thumbnail})` : 'none',
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex gap-2 items-center text-xs text-[#A0A4B4]">
                  <span className="w-3 h-3 rounded-xs bg-[#9146FF] shrink-0 inline-block" />
                  <b className="text-[#EDEEF2] text-[11px] truncate">{lastPlayed.requestedBy || 'Зритель'}</b>
                  <span className="text-[11px] opacity-75 font-mono">
                    {lastPlayed.createdAt ? new Date(lastPlayed.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Ранее'}
                  </span>
                  <span className="font-mono text-[10px] bg-[#1E212B] text-[#A0A4B4] px-1.5 py-0.5 rounded-sm">
                    {lastPlayed.cost || '50 баллов'}
                  </span>
                  <span className="text-[#7CF2C8] shrink-0">
                    <Music className="w-3 h-3" />
                  </span>
                </div>
                <div className="text-[13px] font-bold text-[#EDEEF2] truncate mt-0.5" title={lastPlayed.title}>
                  {lastPlayed.title}
                </div>
              </div>
              <span className="font-mono text-xs text-[#8A8FA3] shrink-0">
                {lastPlayed.durationStr || formatTime(lastPlayed.duration)}
              </span>
            </div>
          )}

          {/* 2. CURRENTLY PLAYING HERO CARD (StreamQ style) */}
          {activeSubTab === 'queue' && (
            <div className={`relative flex items-center bg-[#7CF2C8]/[0.08] border-l-[3px] border-l-[#7CF2C8] border-y border-white/[0.06] ${
              isWide ? 'gap-4 p-4 px-6' : 'gap-3 p-3 px-3.5'
            }`}>
              {/* Thumbnail / Hero Preview with Play/Pause button */}
              <div
                onClick={togglePlayPause}
                className={`relative rounded-lg bg-[#2A2D3A] shrink-0 overflow-hidden cursor-pointer group flex items-center justify-center border border-white/[0.08] shadow-md bg-cover bg-center ${
                  isWide ? 'w-[190px] h-[106px]' : 'w-[112px] h-[64px]'
                }`}
                style={{
                  backgroundImage: current?.thumbnail ? `url(${current.thumbnail})` : 'none',
                }}
              >
                {!current?.thumbnail && (
                  <Music className="w-7 h-7 text-[#8A8FA3]" />
                )}
                <div className="absolute inset-0 bg-black/35 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                  <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center text-white transition transform group-hover:scale-110">
                    {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                  </div>
                </div>
              </div>

              {/* Track Metadata */}
              <div className="flex-1 min-w-0 pr-1">
                {/* Requester bar */}
                <div className="flex items-center gap-2 text-xs text-[#A0A4B4] mb-1">
                  <span
                    className="w-3.5 h-3.5 rounded-xs shrink-0 inline-block"
                    style={{
                      backgroundColor: current?.cost?.includes('₽') ? '#FFB84D' : current?.platform === 'kick' ? '#53FC18' : '#9146FF',
                    }}
                  />
                  <b className="text-[#EDEEF2] truncate text-xs">
                    {current?.requestedBy || 'Очередь свободна'}
                  </b>
                  <span className="text-[11px] font-mono text-[#8A8FA3]">
                    {current?.createdAt ? new Date(current.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Сейчас'}
                  </span>
                  <span className="font-mono text-[10px] bg-[#1E212B] text-[#A0A4B4] px-1.5 py-0.5 rounded-sm">
                    {current?.cost || '50 баллов'}
                  </span>
                </div>

                {/* Track Title */}
                <div className="flex items-center gap-2">
                  <div
                    className={`font-bold text-[#EDEEF2] truncate leading-tight ${isWide ? 'text-lg' : 'text-sm'}`}
                    title={current?.title || 'Нет активного трека'}
                  >
                    {current?.title || 'Очередь треков пуста'}
                  </div>
                  {current?.videoId && (
                    <a
                      href={`https://youtu.be/${current.videoId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#6B7080] hover:text-[#EDEEF2] shrink-0"
                      title="Открыть на YouTube"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                {/* Channel / views */}
                <div className="text-xs text-[#A0A4B4] truncate mt-0.5">
                  {current?.author ? `${current.author} · YouTube` : 'Закажите трек через !заказ или награду Twitch'}
                </div>

                {/* "Воспроизводится сейчас" badge with equalizer wave */}
                <div className="mt-2.5 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#7CF2C8]/40 text-[#7CF2C8] text-xs font-bold bg-[#7CF2C8]/10">
                    <span className="flex items-end gap-0.5 h-2.5">
                      <span className="w-0.5 h-full bg-[#7CF2C8] animate-pulse" />
                      <span className="w-0.5 h-1.5 bg-[#7CF2C8] animate-pulse delay-75" />
                      <span className="w-0.5 h-2.5 bg-[#7CF2C8] animate-pulse delay-150" />
                    </span>
                    <span>Воспроизводится сейчас</span>
                  </span>
                </div>
              </div>

              {/* Progress time label */}
              <div className="font-mono text-sm text-[#EDEEF2] shrink-0 self-start mt-1">
                {formatTime(currentTime)} <span className="text-[#6B7080] text-xs">/ {formatTime(duration)}</span>
              </div>

              {/* Bottom interactive progress bar */}
              <div
                onClick={handleSeek}
                className="absolute left-0 right-0 bottom-0 h-[3px] bg-white/[0.06] cursor-pointer group"
                title="Кликните для перемотки"
              >
                <div
                  style={{ width: `${progressPct}%` }}
                  className="h-[3px] bg-[#7CF2C8] transition-all duration-200"
                />
              </div>
            </div>
          )}

          {/* 3. "В ОЧЕРЕДИ" SECTION HEADER */}
          {activeSubTab === 'queue' && (
            <div className={`flex items-center gap-3 font-semibold text-xs text-[#EDEEF2] ${isWide ? 'px-6 pt-4 pb-2' : 'px-3.5 pt-3 pb-1.5'}`}>
              <b className="text-[13px] text-[#EDEEF2]">В очереди</b>
              <span className="w-7 h-[1px] bg-white/[0.12]" />
              <span className="font-mono text-xs text-[#A0A4B4] flex gap-3">
                <span>{filteredQueue.length} {filteredQueue.length === 1 ? 'трек' : 'трека'}</span>
                <span>{musicState.totalQueueDurationStr}</span>
              </span>
              <div className="flex-1" />
              {wsConnected && (
                <span className="font-mono text-[10px] text-[#7CF2C8] flex items-center gap-1 opacity-80" title="WebSocket очередь подключена">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#7CF2C8] animate-ping" />
                  WS онлайн
                </span>
              )}
            </div>
          )}

          {/* 4. QUEUE TRACKS LIST WITH DRAG AND DROP REORDERING */}
          {activeSubTab === 'queue' && (
            <div className="flex flex-col">
              {filteredQueue.length === 0 ? (
                <div className="py-12 px-6 text-center text-xs text-[#6B7080] font-mono">
                  {searchQuery ? 'Треки по запросу не найдены' : 'Очередь треков пуста. Нажмите «+ Добавить треки» или зрители могут написать !заказ в чат.'}
                </div>
              ) : (
                filteredQueue.map((track, idx) => {
                  const isBeingDragged = draggedIndex === idx;
                  const isDropTarget = dragOverIndex === idx && draggedIndex !== idx;

                  return (
                    <div
                      key={track.id || idx}
                      draggable
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={(e) => handleDrop(e, idx)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-3.5 border-b border-white/[0.05] hover:bg-white/[0.03] transition-colors group cursor-grab active:cursor-grabbing select-none relative ${
                        isWide ? 'px-6 py-2.5' : 'px-3.5 py-2'
                      } ${isBeingDragged ? 'opacity-35 bg-white/[0.02]' : ''} ${
                        isDropTarget ? 'border-t-2 border-t-[#7CF2C8] bg-[#7CF2C8]/[0.05]' : ''
                      }`}
                    >
                      {/* Index / Drag handle */}
                      <span className="font-mono text-[11px] text-[#8A8FA3] w-3.5 text-right shrink-0 group-hover:hidden">
                        {idx + 1}
                      </span>
                      <span className="font-mono text-[11px] text-[#7CF2C8] w-3.5 text-right shrink-0 hidden group-hover:inline-block cursor-grab">
                        ⋮⋮
                      </span>

                      {/* Thumbnail */}
                      <div
                        className={`rounded-md bg-[#2A2D3A] shrink-0 bg-cover bg-center overflow-hidden border border-white/[0.06] ${
                          isWide ? 'w-24 h-[54px]' : 'w-14 h-8'
                        }`}
                        style={{
                          backgroundImage: track.thumbnail ? `url(${track.thumbnail})` : 'none',
                        }}
                      />

                      {/* Track info */}
                      <div className="flex-1 min-w-0 pr-1">
                        <div className="flex items-center gap-2 text-xs text-[#A0A4B4]">
                          <span
                            className="w-3 h-3 rounded-xs shrink-0 inline-block"
                            style={{
                              backgroundColor: track.cost?.includes('₽') ? '#FFB84D' : track.platform === 'kick' ? '#53FC18' : '#9146FF',
                            }}
                          />
                          <b className="text-[#EDEEF2] truncate text-xs">{track.requestedBy || 'Зритель'}</b>
                          <span className="text-[11px] opacity-75 font-mono">
                            {track.createdAt ? new Date(track.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '00:00'}
                          </span>
                          <span className="font-mono text-[10px] bg-[#1E212B] text-[#A0A4B4] px-1.5 py-0.5 rounded-sm">
                            {track.cost || '50 баллов'}
                          </span>
                        </div>

                        <div className="text-sm font-bold text-[#EDEEF2] truncate mt-0.5 flex items-center gap-1.5">
                          <span className="truncate">{track.title}</span>
                          {track.videoId && (
                            <a
                              href={`https://youtu.be/${track.videoId}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[#6B7080] hover:text-[#EDEEF2] shrink-0"
                              title="Открыть на YouTube"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>

                        <div className="text-xs text-[#A0A4B4] truncate">
                          {track.author || 'YouTube'}
                        </div>
                      </div>

                      {/* Action buttons (Move Up, Remove) */}
                      <div className="flex items-center gap-1 shrink-0">
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() => handleMoveUp(track.id)}
                            className="p-1.5 rounded-md bg-[#1E212B] hover:bg-[#282C38] text-[#A0A4B4] hover:text-[#EDEEF2] transition active:scale-95 cursor-pointer"
                            title="Переместить вверх"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemove(track.id)}
                          className="p-1.5 rounded-md bg-[#1E212B] hover:bg-rose-500/20 text-[#A0A4B4] hover:text-rose-300 transition active:scale-95 cursor-pointer"
                          title="Удалить из очереди"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Duration */}
                      <span className="font-mono text-xs text-[#8A8FA3] shrink-0 w-11 text-right">
                        {track.durationStr || formatTime(track.duration)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* 5. HISTORY SUBTAB LIST */}
          {activeSubTab === 'history' && (
            <div className="flex flex-col">
              <div className="flex items-center justify-between px-6 py-3 border-b border-white/[0.06] text-xs font-semibold text-[#A0A4B4]">
                <span>История последних воспроизведенных треков ({filteredHistory.length})</span>
                {musicState.history.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Очистить всю историю треков?')) {
                        if (!sendWSAction({ action: 'clearHistory' })) {
                          MusicClearHistory();
                        }
                        fetchState();
                        showSuccess('История очищена');
                      }
                    }}
                    className="text-xs text-rose-400 hover:underline cursor-pointer"
                  >
                    очистить
                  </button>
                )}
              </div>

              {filteredHistory.length === 0 ? (
                <div className="py-12 px-6 text-center text-xs text-[#6B7080] font-mono">
                  История воспроизведения пуста
                </div>
              ) : (
                filteredHistory.map((track, idx) => (
                  <div
                    key={track.id || idx}
                    className="flex items-center gap-3.5 px-6 py-2.5 border-b border-white/[0.05] hover:bg-white/[0.03] transition-colors"
                  >
                    <span className="font-mono text-xs text-[#8A8FA3] w-4 text-center">{idx + 1}</span>
                    <div
                      className="w-14 h-8 rounded-md bg-[#2A2D3A] shrink-0 bg-cover bg-center overflow-hidden border border-white/[0.06]"
                      style={{
                        backgroundImage: track.thumbnail ? `url(${track.thumbnail})` : 'none',
                      }}
                    />
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="text-xs font-bold text-[#EDEEF2] truncate" title={track.title}>
                        {track.title}
                      </div>
                      <div className="text-[11px] text-[#A0A4B4] truncate">
                        {track.author ? `${track.author} · ` : ''}заказал {track.requestedBy || 'Зритель'}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handlePlayFromHistory(track.id)}
                        className="px-2.5 py-1 rounded-md bg-[#7CF2C8]/15 hover:bg-[#7CF2C8] text-[#7CF2C8] hover:text-[#0E0F13] font-bold text-xs transition cursor-pointer flex items-center gap-1"
                        title="Включить сейчас"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Играть</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRequeueFromHistory(track.id)}
                        className="p-1.5 rounded-md bg-[#1E212B] hover:bg-[#282C38] text-[#EDEEF2] transition cursor-pointer"
                        title="В очередь"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <span className="font-mono text-xs text-[#8A8FA3] shrink-0 w-11 text-right">
                      {track.durationStr || formatTime(track.duration)}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* 6. MODERATION SUBTAB LIST */}
          {activeSubTab === 'moderation' && (
            <div className="flex flex-col p-4 space-y-3">
              <div className="text-xs font-semibold text-[#A0A4B4]">
                Треки, требующие одобрения модератора ({musicState.moderation.length})
              </div>
              {musicState.moderation.length === 0 ? (
                <div className="py-10 text-center text-xs text-[#6B7080] font-mono">
                  Нет треков на модерации
                </div>
              ) : (
                musicState.moderation.map((track) => (
                  <div
                    key={track.id}
                    className="p-3 rounded-xl bg-[#15171E] border border-white/[0.06] flex items-center gap-3.5"
                  >
                    <div
                      className="w-16 h-10 rounded-md bg-[#2A2D3A] shrink-0 bg-cover bg-center overflow-hidden border border-white/[0.06]"
                      style={{
                        backgroundImage: track.thumbnail ? `url(${track.thumbnail})` : 'none',
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-[#EDEEF2] truncate">{track.title}</div>
                      <div className="text-xs text-[#A0A4B4] mt-0.5 truncate">
                        {track.requestedBy} · {track.rejectReason || 'Ручная проверка'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleApprove(track.id)}
                        className="px-3 py-1.5 rounded-lg bg-[#7CF2C8] hover:bg-[#9af7d8] text-[#0E0F13] font-bold text-xs transition cursor-pointer"
                      >
                        Принять
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(track.id)}
                        className="px-3 py-1.5 rounded-lg bg-[#1E212B] hover:bg-rose-500/20 text-rose-300 font-bold text-xs transition cursor-pointer"
                      >
                        Отклонить
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* 7. "ФОНОВОЕ ВОСПРОИЗВЕДЕНИЕ" SECTION */}
          {activeSubTab === 'queue' && (
            <div className="mt-4 pt-3 border-t border-white/[0.06]">
              <div className={`flex items-center gap-3 text-xs ${isWide ? 'px-6' : 'px-3.5'}`}>
                <b className="text-[13px] text-[#EDEEF2]">Фоновое воспроизведение</b>
                <span className="w-7 h-[1px] bg-white/[0.12]" />
                <span className="font-mono text-xs text-[#A0A4B4]">0 / 0 · 0:00</span>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={handleRegenerateBackground}
                  className="px-2.5 py-1 rounded-lg bg-[#1E212B] hover:bg-[#282C38] text-[#EDEEF2] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                  title="Сгенерировать безопасную фоновую музыку"
                >
                  <RotateCcw className="w-3 h-3 text-[#7CF2C8]" />
                  <span>Перегенерировать</span>
                </button>
              </div>
              <div className={`text-xs text-[#A0A4B4] mt-1 ${isWide ? 'px-6' : 'px-3.5'}`}>
                Играет, когда очередь пуста
              </div>
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR: AUDIO OUTPUT & ORDER SOURCES (Wide layout as mockup) */}
        {isWide && (
          <div className="w-[340px] shrink-0 border-l border-white/[0.06] p-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
            {/* ВЫВОД ЗВУКА */}
            <div className="relative">
              <div className="font-mono text-[10px] text-[#8A8FA3] tracking-[0.08em] mb-2 uppercase">
                ВЫВОД ЗВУКА
              </div>
              <div
                onClick={() => setIsAudioDropdownOpen(!isAudioDropdownOpen)}
                className="h-9 flex items-center justify-between px-3 rounded-lg bg-[#0E0F13] border border-white/[0.08] text-xs font-bold text-[#EDEEF2] cursor-pointer hover:border-white/[0.15] transition-colors"
              >
                <span className="truncate">{selectedDeviceLabel}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-[#6B7080] shrink-0 ml-1.5 transition-transform ${isAudioDropdownOpen ? 'rotate-180' : ''}`} />
              </div>

              {/* Audio devices dropdown menu */}
              {isAudioDropdownOpen && (
                <div className="absolute top-16 left-0 right-0 z-50 bg-[#15171E] border border-white/[0.1] rounded-xl shadow-2xl p-1.5 space-y-1">
                  <div
                    onClick={() => {
                      setSelectedDeviceLabel('Динамики (fifine Headset)');
                      setIsAudioDropdownOpen(false);
                      showSuccess('Вывод: fifine Headset');
                    }}
                    className="p-2 rounded-lg hover:bg-white/[0.05] cursor-pointer flex items-center justify-between text-xs text-[#EDEEF2]"
                  >
                    <span className="truncate">Динамики (fifine Headset)</span>
                    {selectedDeviceLabel.includes('fifine') && <Check className="w-3.5 h-3.5 text-[#7CF2C8]" />}
                  </div>

                  {audioDevicesList.map((dev, idx) => (
                    <div
                      key={dev.deviceId || idx}
                      onClick={() => {
                        const lbl = dev.label || `Аудиоустройство ${idx + 1}`;
                        setSelectedDeviceLabel(lbl);
                        setIsAudioDropdownOpen(false);
                        try {
                          localStorage.setItem('rechat_audio_device', lbl);
                        } catch (_) {}
                        showSuccess(`Вывод: ${lbl}`);
                      }}
                      className="p-2 rounded-lg hover:bg-white/[0.05] cursor-pointer flex items-center justify-between text-xs text-[#EDEEF2]"
                    >
                      <span className="truncate">{dev.label || `Аудиовыход ${idx + 1}`}</span>
                      {selectedDeviceLabel === dev.label && <Check className="w-3.5 h-3.5 text-[#7CF2C8]" />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ИСТОЧНИКИ ЗАКАЗОВ */}
            <div>
              <div className="font-mono text-[10px] text-[#8A8FA3] tracking-[0.08em] mb-2 uppercase flex items-center justify-between">
                <span>ИСТОЧНИКИ ЗАКАЗОВ</span>
                <button
                  type="button"
                  onClick={handleOpenRulesModal}
                  className="text-[10px] text-[#7CF2C8] hover:underline lowercase cursor-pointer"
                >
                  изменить
                </button>
              </div>

              {/* Source 1: Reward Twitch */}
              <div className="bg-[#15171E] border border-white/[0.06] rounded-[14px] p-3 mb-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-4 h-4 rounded-xs bg-[#9146FF] shrink-0 inline-block" />
                  <b className="flex-1 text-xs text-[#EDEEF2] truncate font-bold">
                    Награда «{musicState.rules.rewardTitle || 'Заказать трек'}»
                  </b>
                  <span className="font-mono text-[10px] bg-[#1E212B] text-[#A0A4B4] px-1.5 py-0.5 rounded-sm shrink-0">
                    {musicState.rules.twitchPoints || 50} баллов
                  </span>
                  <button
                    type="button"
                    onClick={handleOpenRulesModal}
                    className="text-[#8A8FA3] hover:text-[#EDEEF2]"
                    title="Редактировать"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  {/* Switch */}
                  <div
                    onClick={() => toggleSourceRule('twitchRewardEnabled', 'Награда Twitch')}
                    className={`w-9 h-5 rounded-[10px] relative shrink-0 transition-colors cursor-pointer ${
                      musicState.rules.twitchRewardEnabled ? 'bg-[#7CF2C8]' : 'bg-[#2F3342]'
                    }`}
                  >
                    <i
                      className={`absolute top-[2px] w-4 h-4 rounded-full transition-all ${
                        musicState.rules.twitchRewardEnabled ? 'right-[2px] bg-[#0E0F13]' : 'left-[2px] bg-[#8A8FA3]'
                      }`}
                    />
                  </div>
                </div>

                <div className="font-mono text-xs text-[#A0A4B4] flex gap-4 mt-2.5">
                  <span className="flex items-center gap-1.5">
                    <List className="w-3 h-3 text-[#6B7080]" />
                    <span className="text-[#FFB84D]">{musicState.queue.length} / {musicState.rules.maxTracksPerUser || 2}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-[#6B7080]" />
                    <span className="text-[#FFB84D]">{musicState.totalQueueDurationStr}</span> / {formatTime(musicState.rules.maxDurationSec || 501)}
                  </span>
                </div>
              </div>

              {/* Source 2: Command !заказ */}
              <div className="bg-[#15171E] border border-white/[0.06] rounded-[14px] p-3 mb-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-4 h-4 rounded-xs bg-[#9146FF] shrink-0 inline-block" />
                  <b className="flex-1 text-xs text-[#EDEEF2] truncate font-bold">Команда !заказ</b>
                  <span className="font-mono text-[10px] bg-[#1E212B] text-[#A0A4B4] px-1.5 py-0.5 rounded-sm shrink-0">
                    бесплатно
                  </span>
                  <button
                    type="button"
                    onClick={handleOpenRulesModal}
                    className="text-[#8A8FA3] hover:text-[#EDEEF2]"
                    title="Редактировать"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <div
                    onClick={() => toggleSourceRule('chatCommandEnabled', 'Команда !заказ')}
                    className={`w-9 h-5 rounded-[10px] relative shrink-0 transition-colors cursor-pointer ${
                      musicState.rules.chatCommandEnabled ? 'bg-[#7CF2C8]' : 'bg-[#2F3342]'
                    }`}
                  >
                    <i
                      className={`absolute top-[2px] w-4 h-4 rounded-full transition-all ${
                        musicState.rules.chatCommandEnabled ? 'right-[2px] bg-[#0E0F13]' : 'left-[2px] bg-[#8A8FA3]'
                      }`}
                    />
                  </div>
                </div>

                <div className="font-mono text-xs text-[#A0A4B4] flex gap-4 mt-2.5">
                  <span className="flex items-center gap-1.5">
                    <List className="w-3 h-3 text-[#6B7080]" />
                    <span>1 / {musicState.rules.maxTracksPerUser || 3}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-[#6B7080]" />
                    <span>{musicState.totalQueueDurationStr} / {formatTime(musicState.rules.maxDurationSec || 600)}</span>
                  </span>
                </div>
              </div>

              {/* Source 3: Donation */}
              <div className="bg-[#15171E] border border-white/[0.06] rounded-[14px] p-3 mb-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-4 h-4 rounded-xs bg-[#FFB84D] shrink-0 inline-block" />
                  <b className="flex-1 text-xs text-[#EDEEF2] truncate font-bold">
                    Донат от {musicState.rules.minDonation || 100} ₽
                  </b>
                  <span className="font-mono text-[10px] bg-[#1E212B] text-[#A0A4B4] px-1.5 py-0.5 rounded-sm shrink-0">
                    {musicState.rules.minDonation || 100} ₽
                  </span>
                  <button
                    type="button"
                    onClick={handleOpenRulesModal}
                    className="text-[#8A8FA3] hover:text-[#EDEEF2]"
                    title="Редактировать"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <div
                    onClick={() => toggleSourceRule('donationOrdersEnabled', 'Донаты DonationAlerts')}
                    className={`w-9 h-5 rounded-[10px] relative shrink-0 transition-colors cursor-pointer ${
                      musicState.rules.donationOrdersEnabled ? 'bg-[#7CF2C8]' : 'bg-[#2F3342]'
                    }`}
                  >
                    <i
                      className={`absolute top-[2px] w-4 h-4 rounded-full transition-all ${
                        musicState.rules.donationOrdersEnabled ? 'right-[2px] bg-[#0E0F13]' : 'left-[2px] bg-[#8A8FA3]'
                      }`}
                    />
                  </div>
                </div>

                <div className="font-mono text-xs text-[#A0A4B4] flex gap-4 mt-2.5">
                  <span className="flex items-center gap-1.5">
                    <List className="w-3 h-3 text-[#6B7080]" />
                    <span>1 / 5</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-[#6B7080]" />
                    <span>6:08 / 20:00</span>
                  </span>
                </div>
              </div>

              {/* Source 4: Web */}
              <div className="bg-[#15171E] border border-white/[0.06] rounded-[14px] p-3 mb-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="text-[#A0A4B4] shrink-0">
                    <ExternalLink className="w-4 h-4" />
                  </span>
                  <b className="flex-1 text-xs text-[#EDEEF2] truncate font-bold">Через веб</b>
                  <span className="font-mono text-[10px] bg-[#1E212B] text-[#A0A4B4] px-1.5 py-0.5 rounded-sm shrink-0">
                    бесплатно
                  </span>
                  <button
                    type="button"
                    onClick={handleOpenRulesModal}
                    className="text-[#8A8FA3] hover:text-[#EDEEF2]"
                    title="Редактировать"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <div
                    onClick={() => toggleSourceRule('webOrdersEnabled', 'Заказы через веб')}
                    className={`w-9 h-5 rounded-[10px] relative shrink-0 transition-colors cursor-pointer ${
                      musicState.rules.webOrdersEnabled ? 'bg-[#7CF2C8]' : 'bg-[#2F3342]'
                    }`}
                  >
                    <i
                      className={`absolute top-[2px] w-4 h-4 rounded-full transition-all ${
                        musicState.rules.webOrdersEnabled ? 'right-[2px] bg-[#0E0F13]' : 'left-[2px] bg-[#8A8FA3]'
                      }`}
                    />
                  </div>
                </div>

                <div className="font-mono text-xs text-[#A0A4B4] flex gap-4 mt-2.5">
                  <span className="flex items-center gap-1.5">
                    <List className="w-3 h-3 text-[#6B7080]" />
                    <span>0 / 2</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-[#6B7080]" />
                    <span>0:00 / 8:21</span>
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-[#A0A4B4] mt-3 leading-relaxed">
                Лимиты считаются на зрителя: сколько треков и сколько минут он может держать в очереди.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PERMANENT YOUTUBE PLAYER CONTAINER (Never unmounts, audio continues uninterrupted) */}
      <div
        id="youtube-player-outer"
        className={
          showPiPVideo
            ? isWide
              ? 'absolute left-6 bottom-20 z-40 w-[356px] h-[200px] rounded-xl bg-black border-2 border-[#7CF2C8] shadow-2xl overflow-hidden group flex flex-col justify-end'
              : 'fixed right-3 bottom-[68px] z-40 w-[220px] h-[124px] rounded-lg bg-black border border-[#7CF2C8] shadow-xl overflow-hidden group flex flex-col justify-end'
            : 'fixed -left-[9999px] -bottom-[9999px] w-[320px] h-[180px] opacity-0 pointer-events-none overflow-hidden'
        }
      >
        <div className="absolute inset-0 z-0">
          <div id="youtube-player-element" className="w-full h-full" />
        </div>

        {/* Overlay controls when hovering PiP player */}
        {showPiPVideo && (
          <div className="relative z-10 p-2.5 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-center justify-between text-white opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="min-w-0 flex-1 pr-2">
              <div className="text-xs font-bold truncate">{current?.title || 'YouTube Player'}</div>
              <div className="text-[10px] text-gray-300 truncate">{current?.author || 'Воспроизведение'}</div>
            </div>
            <button
              type="button"
              onClick={() => setShowPiPVideo(false)}
              className="p-1 rounded bg-black/60 hover:bg-black text-white cursor-pointer"
              title="Скрыть видео"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {showPiPVideo && (
          <span className="absolute right-2.5 bottom-2 z-10 text-[11px] font-bold text-[#FF6B6B] pointer-events-none drop-shadow">
            ▶ YouTube
          </span>
        )}
      </div>

      {/* PERSISTENT BOTTOM PLAYER BAR (Matching both mockups) */}
      <div className={`shrink-0 bg-[#12141A] border-t border-white/[0.06] flex items-center gap-3.5 relative z-30 select-none ${
        isWide ? 'h-16 px-6' : 'h-[60px] px-3.5 gap-2.5'
      }`}>
        {/* Top 2px progress bar */}
        <div
          onClick={handleSeek}
          className="absolute left-0 right-0 top-[-1px] h-[2px] bg-white/[0.06] cursor-pointer"
        >
          <div
            style={{ width: `${progressPct}%` }}
            className="h-[2px] bg-[#7CF2C8]"
          />
        </div>

        {/* Media control buttons */}
        <div className="flex items-center gap-3 text-[#A0A4B4]">
          <button
            type="button"
            onClick={handlePrev}
            disabled={musicState.history.length === 0}
            className="hover:text-[#EDEEF2] disabled:opacity-30 transition cursor-pointer"
            title="Предыдущий трек"
          >
            <SkipBack className={isWide ? 'w-5 h-5' : 'w-4 h-4'} />
          </button>

          <button
            type="button"
            onClick={togglePlayPause}
            className={`rounded-full bg-[#7CF2C8] text-[#0E0F13] flex items-center justify-center transition active:scale-95 cursor-pointer shadow-md ${
              isWide ? 'w-9 h-9' : 'w-[34px] h-[34px]'
            }`}
            title={isPlaying ? 'Пауза' : 'Играть'}
          >
            {isPlaying ? (
              <Pause className={isWide ? 'w-4 h-4 fill-current' : 'w-3.5 h-3.5 fill-current'} />
            ) : (
              <Play className={isWide ? 'w-4 h-4 fill-current ml-0.5' : 'w-3.5 h-3.5 fill-current ml-0.5'} />
            )}
          </button>

          <button
            type="button"
            onClick={handleSkip}
            disabled={!current && musicState.queue.length === 0}
            className="hover:text-[#EDEEF2] disabled:opacity-30 transition cursor-pointer"
            title="Следующий трек"
          >
            <SkipForward className={isWide ? 'w-5 h-5' : 'w-4 h-4'} />
          </button>
        </div>

        {/* Mini thumbnail */}
        <div
          className="w-14 h-8 rounded-md bg-[#2A2D3A] shrink-0 bg-cover bg-center border border-white/[0.06] overflow-hidden hidden sm:block"
          style={{
            backgroundImage: current?.thumbnail ? `url(${current.thumbnail})` : 'none',
          }}
        />

        {/* Track Title and author in player */}
        <div className="min-w-0 max-w-[260px] truncate hidden sm:block">
          <div className="text-[13px] font-bold text-[#EDEEF2] truncate">
            {current?.title || 'Очередь пуста'}
          </div>
          <div className="text-xs text-[#A0A4B4] truncate">
            {current?.author || 'YouTube'}
          </div>
        </div>

        <div className="flex-1" />

        {/* Monospace time: 0:03 / 0:53 */}
        <span className="font-mono text-xs text-[#EDEEF2] shrink-0">
          {formatTime(currentTime)} <span className="text-[#6B7080]">/ {formatTime(duration)}</span>
        </span>

        {/* Volume button & popover */}
        <div className="relative flex items-center">
          <button
            type="button"
            onClick={() => setShowVolumeSlider(!showVolumeSlider)}
            className="text-[#A0A4B4] hover:text-[#EDEEF2] transition cursor-pointer p-1"
            title="Громкость"
          >
            {volume === 0 ? (
              <VolumeX className="w-4 h-4" />
            ) : volume < 50 ? (
              <Volume1 className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>

          {/* Volume slider popover or inline */}
          {isWide ? (
            <div className="w-28 h-1 rounded-sm bg-[#2F3342] ml-2 relative cursor-pointer" onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = (e.clientX - rect.left) / rect.width;
              handleVolumeChange(Math.round(pct * 100));
            }}>
              <span
                style={{ width: `${volume}%` }}
                className="absolute left-0 top-0 bottom-0 rounded-sm bg-[#7CF2C8]"
              />
            </div>
          ) : (
            showVolumeSlider && (
              <div className="absolute bottom-12 right-0 z-50 p-2.5 rounded-xl bg-[#15171E] border border-white/[0.1] shadow-2xl flex flex-col items-center gap-1.5 w-28">
                <span className="text-[10px] font-mono text-[#7CF2C8]">{volume}%</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="w-full accent-[#7CF2C8] cursor-pointer"
                />
              </div>
            )
          )}
        </div>

        {/* PiP video toggle button */}
        <button
          type="button"
          onClick={() => setShowPiPVideo(!showPiPVideo)}
          className={`border-0 rounded-lg p-1.5 transition cursor-pointer ${
            showPiPVideo ? 'bg-[#7CF2C8] text-[#0E0F13]' : 'bg-[#1E212B] text-[#A0A4B4] hover:text-[#EDEEF2]'
          }`}
          title={showPiPVideo ? 'Скрыть видео плеер' : 'Показать видео плеер'}
        >
          <Tv className="w-4 h-4" />
        </button>

        {/* Toggle Right sidebar on compact view */}
        {!isWide && (
          <button
            type="button"
            onClick={() => setShowRightSidebarMobile(!showRightSidebarMobile)}
            className={`border-0 rounded-lg p-1.5 transition cursor-pointer ${
              showRightSidebarMobile ? 'bg-[#7CF2C8] text-[#0E0F13]' : 'bg-[#1E212B] text-[#A0A4B4] hover:text-[#EDEEF2]'
            }`}
            title="Источники и правила"
          >
            <Sliders className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* MOBILE / COMPACT SOURCES & RULES DRAWER */}
      {!isWide && showRightSidebarMobile && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex flex-col justify-end" onClick={() => setShowRightSidebarMobile(false)}>
          <div className="bg-[#15171E] rounded-t-2xl border-t border-white/[0.1] p-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <b className="text-sm text-[#EDEEF2]">Источники заказов</b>
              <button type="button" onClick={() => setShowRightSidebarMobile(false)} className="text-[#A0A4B4]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-3 space-y-3">
              <div className="p-3 rounded-xl bg-[#0E0F13] border border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#EDEEF2]">Награда за баллы Twitch</span>
                  <div
                    onClick={() => toggleSourceRule('twitchRewardEnabled', 'Награда Twitch')}
                    className={`w-9 h-5 rounded-[10px] relative shrink-0 transition-colors cursor-pointer ${
                      musicState.rules.twitchRewardEnabled ? 'bg-[#7CF2C8]' : 'bg-[#2F3342]'
                    }`}
                  >
                    <i
                      className={`absolute top-[2px] w-4 h-4 rounded-full transition-all ${
                        musicState.rules.twitchRewardEnabled ? 'right-[2px] bg-[#0E0F13]' : 'left-[2px] bg-[#8A8FA3]'
                      }`}
                    />
                  </div>
                </div>
                <div className="text-[11px] text-[#A0A4B4] mt-1 font-mono">
                  {musicState.rules.twitchPoints} баллов · «{musicState.rules.rewardTitle}»
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#0E0F13] border border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#EDEEF2]">Команда !заказ</span>
                  <div
                    onClick={() => toggleSourceRule('chatCommandEnabled', 'Команда !заказ')}
                    className={`w-9 h-5 rounded-[10px] relative shrink-0 transition-colors cursor-pointer ${
                      musicState.rules.chatCommandEnabled ? 'bg-[#7CF2C8]' : 'bg-[#2F3342]'
                    }`}
                  >
                    <i
                      className={`absolute top-[2px] w-4 h-4 rounded-full transition-all ${
                        musicState.rules.chatCommandEnabled ? 'right-[2px] bg-[#0E0F13]' : 'left-[2px] bg-[#8A8FA3]'
                      }`}
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#0E0F13] border border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#EDEEF2]">Донаты DonationAlerts</span>
                  <div
                    onClick={() => toggleSourceRule('donationOrdersEnabled', 'Донаты DA')}
                    className={`w-9 h-5 rounded-[10px] relative shrink-0 transition-colors cursor-pointer ${
                      musicState.rules.donationOrdersEnabled ? 'bg-[#7CF2C8]' : 'bg-[#2F3342]'
                    }`}
                  >
                    <i
                      className={`absolute top-[2px] w-4 h-4 rounded-full transition-all ${
                        musicState.rules.donationOrdersEnabled ? 'right-[2px] bg-[#0E0F13]' : 'left-[2px] bg-[#8A8FA3]'
                      }`}
                    />
                  </div>
                </div>
                <div className="text-[11px] text-[#FFB84D] font-mono mt-1">от {musicState.rules.minDonation} ₽</div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowRightSidebarMobile(false);
                  handleOpenRulesModal();
                }}
                className="w-full py-2.5 rounded-lg bg-[#7CF2C8] text-[#0E0F13] font-bold text-xs"
              >
                Все настройки правил
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD TRACK MODAL */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsAddModalOpen(false);
          }}
        >
          <form
            onSubmit={handleAddTrack}
            className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#15171E] p-5 shadow-2xl space-y-4 animate-fade-in"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#EDEEF2] flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#7CF2C8]" />
                <span>Добавить трек в очередь</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-[#6B7080] hover:text-[#EDEEF2] rounded-lg p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#A0A4B4] block mb-1.5">
                  Ссылка YouTube или название песни
                </label>
                <input
                  type="text"
                  value={addInputQuery}
                  onChange={(e) => setAddInputQuery(e.target.value)}
                  placeholder="https://youtu.be/... или Daft Punk - Get Lucky"
                  autoFocus
                  disabled={isAdding}
                  className="w-full bg-[#0E0F13] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-[#EDEEF2] outline-none focus:border-[#7CF2C8] select-text"
                />
              </div>

              <div className="text-[11px] text-[#8A8FA3] font-mono leading-relaxed bg-[#0E0F13] p-2.5 rounded-lg border border-white/[0.04]">
                💡 Поддерживаются ссылки YouTube видео, клипов, а также обычный текстовый поиск песен.
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="flex-1 py-2 bg-[#1E212B] text-[#EDEEF2] font-bold rounded-lg text-xs hover:bg-[#282C38] transition cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={!addInputQuery.trim() || isAdding}
                className="flex-1 py-2 bg-[#7CF2C8] text-[#0E0F13] font-bold rounded-lg text-xs hover:bg-[#9af7d8] transition cursor-pointer disabled:opacity-40"
              >
                {isAdding ? 'Поиск и добавление...' : 'Добавить трек'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EDIT RULES MODAL */}
      {isEditRulesOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsEditRulesOpen(false);
          }}
        >
          <form
            onSubmit={handleSaveRulesModal}
            className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#15171E] p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar animate-fade-in"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#EDEEF2] flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#7CF2C8]" />
                <span>Настройка правил заказов</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEditRulesOpen(false)}
                className="text-[#6B7080] hover:text-[#EDEEF2] rounded-lg p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#1E212B]">
                <span className="font-bold text-[#EDEEF2]">Общий приём заказов разрешён</span>
                <input
                  type="checkbox"
                  checked={Boolean(editRulesForm.ordersEnabled)}
                  onChange={(e) =>
                    setEditRulesForm((prev) => ({ ...prev, ordersEnabled: e.target.checked }))
                  }
                  className="w-4 h-4 accent-[#7CF2C8] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#1E212B]">
                <span className="font-bold text-[#EDEEF2]">Заказы через команду !заказ</span>
                <input
                  type="checkbox"
                  checked={Boolean(editRulesForm.chatCommandEnabled)}
                  onChange={(e) =>
                    setEditRulesForm((prev) => ({ ...prev, chatCommandEnabled: e.target.checked }))
                  }
                  className="w-4 h-4 accent-[#7CF2C8] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#1E212B]">
                <span className="font-bold text-[#EDEEF2]">Заказы через награду Twitch</span>
                <input
                  type="checkbox"
                  checked={Boolean(editRulesForm.twitchRewardEnabled)}
                  onChange={(e) =>
                    setEditRulesForm((prev) => ({ ...prev, twitchRewardEnabled: e.target.checked }))
                  }
                  className="w-4 h-4 accent-[#7CF2C8] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#1E212B]">
                <span className="font-bold text-[#EDEEF2]">Заказы через донаты DA</span>
                <input
                  type="checkbox"
                  checked={Boolean(editRulesForm.donationOrdersEnabled)}
                  onChange={(e) =>
                    setEditRulesForm((prev) => ({ ...prev, donationOrdersEnabled: e.target.checked }))
                  }
                  className="w-4 h-4 accent-[#7CF2C8] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#1E212B]">
                <span className="font-bold text-[#EDEEF2]">Блокировать ссылки на плейлисты</span>
                <input
                  type="checkbox"
                  checked={Boolean(editRulesForm.blockPlaylists)}
                  onChange={(e) =>
                    setEditRulesForm((prev) => ({ ...prev, blockPlaylists: e.target.checked }))
                  }
                  className="w-4 h-4 accent-[#7CF2C8] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#1E212B]">
                <span className="font-bold text-[#EDEEF2]">Ручное одобрение (модерация)</span>
                <input
                  type="checkbox"
                  checked={Boolean(editRulesForm.manualApproval)}
                  onChange={(e) =>
                    setEditRulesForm((prev) => ({ ...prev, manualApproval: e.target.checked }))
                  }
                  className="w-4 h-4 accent-[#7CF2C8] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#1E212B]">
                <span className="font-bold text-[#EDEEF2]">Останавливать плеер Windows при заказе</span>
                <input
                  type="checkbox"
                  checked={Boolean(editRulesForm.pauseSystemMedia)}
                  onChange={(e) =>
                    setEditRulesForm((prev) => ({ ...prev, pauseSystemMedia: e.target.checked }))
                  }
                  className="w-4 h-4 accent-[#7CF2C8] cursor-pointer"
                />
              </div>

              <div>
                <label className="text-[#A0A4B4] font-medium block mb-1">
                  Название награды Twitch для заказа треков
                </label>
                <input
                  type="text"
                  value={editRulesForm.rewardTitle}
                  onChange={(e) =>
                    setEditRulesForm((prev) => ({ ...prev, rewardTitle: e.target.value }))
                  }
                  placeholder="Заказать трек"
                  className="w-full bg-[#1E212B] border border-white/[0.08] rounded-lg px-3 py-2 text-[#EDEEF2] outline-none focus:border-[#7CF2C8]"
                />
              </div>

              <div>
                <label className="text-[#A0A4B4] font-medium block mb-1">
                  Стоимость награды за баллы Twitch
                </label>
                <input
                  type="number"
                  value={editRulesForm.twitchPoints}
                  onChange={(e) =>
                    setEditRulesForm((prev) => ({ ...prev, twitchPoints: Number(e.target.value) || 0 }))
                  }
                  className="w-full bg-[#1E212B] border border-white/[0.08] rounded-lg px-3 py-2 text-[#EDEEF2] outline-none focus:border-[#7CF2C8] font-mono"
                />
              </div>

              <div>
                <label className="text-[#A0A4B4] font-medium block mb-1">
                  Минимальный донат DonationAlerts (₽)
                </label>
                <input
                  type="number"
                  value={editRulesForm.minDonation}
                  onChange={(e) =>
                    setEditRulesForm((prev) => ({ ...prev, minDonation: Number(e.target.value) || 0 }))
                  }
                  className="w-full bg-[#1E212B] border border-white/[0.08] rounded-lg px-3 py-2 text-[#EDEEF2] outline-none focus:border-[#7CF2C8] font-mono"
                />
              </div>

              <div>
                <label className="text-[#A0A4B4] font-medium block mb-1">
                  Макс. длительность одного трека (секунды, например 501 = 8:21)
                </label>
                <input
                  type="number"
                  value={editRulesForm.maxDurationSec}
                  onChange={(e) =>
                    setEditRulesForm((prev) => ({ ...prev, maxDurationSec: Number(e.target.value) || 0 }))
                  }
                  className="w-full bg-[#1E212B] border border-white/[0.08] rounded-lg px-3 py-2 text-[#EDEEF2] outline-none focus:border-[#7CF2C8] font-mono"
                />
              </div>

              <div>
                <label className="text-[#A0A4B4] font-medium block mb-1">
                  Лимит треков на одного зрителя в очереди
                </label>
                <input
                  type="number"
                  value={editRulesForm.maxTracksPerUser}
                  onChange={(e) =>
                    setEditRulesForm((prev) => ({ ...prev, maxTracksPerUser: Number(e.target.value) || 0 }))
                  }
                  className="w-full bg-[#1E212B] border border-white/[0.08] rounded-lg px-3 py-2 text-[#EDEEF2] outline-none focus:border-[#7CF2C8] font-mono"
                />
              </div>

              <div>
                <label className="text-[#A0A4B4] font-medium block mb-1">
                  Запрос фонового воспроизведения (когда очередь пуста)
                </label>
                <input
                  type="text"
                  value={editRulesForm.fallbackQuery}
                  onChange={(e) =>
                    setEditRulesForm((prev) => ({ ...prev, fallbackQuery: e.target.value }))
                  }
                  placeholder="Lofi hip hop stream safe beats"
                  className="w-full bg-[#1E212B] border border-white/[0.08] rounded-lg px-3 py-2 text-[#EDEEF2] outline-none focus:border-[#7CF2C8]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditRulesOpen(false)}
                className="flex-1 py-2 bg-[#1E212B] text-[#EDEEF2] font-bold rounded-lg text-xs hover:bg-[#282C38] transition cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-[#7CF2C8] text-[#0E0F13] font-bold rounded-lg text-xs hover:bg-[#9af7d8] transition cursor-pointer shadow-xs"
              >
                Сохранить правила
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
