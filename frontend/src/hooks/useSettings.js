import { useState, useEffect, useRef, useCallback } from 'react';
import { GetSettings, SaveSettings } from '../../wailsjs/go/main/App';
import { WindowSetAlwaysOnTop, EventsOn } from '../../wailsjs/runtime/runtime';

export const DEFAULT_SETTINGS = {
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
  daEnabled: true,
  daToken: '',
  daShowInChat: true,
  daMinChatAmount: 0,
  daTTS: true,
  daMinTTSAmount: 0,
  daShowGoalBar: true,
  kickEnabled: true,
  kickChannels: [],
};

export function coerceSettings(raw) {
  const merged = { ...DEFAULT_SETTINGS, ...raw };
  return {
    ...merged,
    ttsEnabled: Boolean(merged.ttsEnabled),
    ttsAllMessages: merged.ttsAllMessages !== undefined ? Boolean(merged.ttsAllMessages) : true,
    ttsRepliesOnly: Boolean(merged.ttsRepliesOnly),
    ttsHighlightedOnly: Boolean(merged.ttsHighlightedOnly),
    ttsSubscribersOnly: Boolean(merged.ttsSubscribersOnly),
    ttsVipOnly: Boolean(merged.ttsVipOnly),
    ttsModOnly: Boolean(merged.ttsModOnly),
    ttsIncludeUsername: Boolean(merged.ttsIncludeUsername),
    ttsIncludeLinks: Boolean(merged.ttsIncludeLinks),
    ttsIncludeEmotes: Boolean(merged.ttsIncludeEmotes),
    ttsIncludeEmoji: Boolean(merged.ttsIncludeEmoji),
    ttsIncludeMentions: merged.ttsIncludeMentions !== undefined ? Boolean(merged.ttsIncludeMentions) : true,
    ttsFilterEmotes: merged.ttsFilterEmotes !== undefined ? Boolean(merged.ttsFilterEmotes) : true,
    ignoreCommands: merged.ignoreCommands !== undefined ? Boolean(merged.ignoreCommands) : true,
    ignoreEmotesOnly: Boolean(merged.ignoreEmotesOnly),
    hideIgnoredFromChat: Boolean(merged.hideIgnoredFromChat),
    fontSize: parseInt(merged.fontSize, 10) || 14,
    maxMessages: parseInt(merged.maxMessages, 10) || 300,
    showTimestamps: merged.showTimestamps !== undefined ? Boolean(merged.showTimestamps) : true,
    timestampFormat: merged.timestampFormat || 'HH:MM:SS',
    showBadges: merged.showBadges !== undefined ? Boolean(merged.showBadges) : true,
    showFollows: merged.showFollows !== undefined ? Boolean(merged.showFollows) : true,
    channelBadgeMode: merged.channelBadgeMode || 'name',
    iconColor: merged.iconColor || 'purple',
    fontFamily: merged.fontFamily || 'Lato',
    messageSpacing: merged.messageSpacing || 'default',
    textAlign: merged.textAlign || 'left',
    ttsVolume: parseFloat(merged.ttsVolume) || 1.0,
    ttsSpeed: parseFloat(merged.ttsSpeed) || 1.0,
    ttsAudioDevice: merged.ttsAudioDevice || '',
    ttsSkipHotkey: merged.ttsSkipHotkey || 'Escape',
    ttsRemoveWords: merged.ttsRemoveWords || '',
    ignoredUsers: Array.isArray(merged.ignoredUsers)
      ? merged.ignoredUsers
      : DEFAULT_SETTINGS.ignoredUsers,
    proxyEnabled: Boolean(merged.proxyEnabled),
    proxyType: merged.proxyType || 'http',
    proxyAddress: merged.proxyAddress || '',
    proxyAuth: Boolean(merged.proxyAuth),
    proxyUser: merged.proxyUser || '',
    proxyPassword: merged.proxyPassword || '',
    daEnabled: merged.daEnabled !== undefined ? Boolean(merged.daEnabled) : true,
    daToken: merged.daToken || '',
    daShowInChat: merged.daShowInChat !== undefined ? Boolean(merged.daShowInChat) : true,
    daMinChatAmount: parseFloat(merged.daMinChatAmount) || 0,
    daTTS: merged.daTTS !== undefined ? Boolean(merged.daTTS) : true,
    daMinTTSAmount: parseFloat(merged.daMinTTSAmount) || 0,
    daShowGoalBar: merged.daShowGoalBar !== undefined ? Boolean(merged.daShowGoalBar) : true,
    kickEnabled: merged.kickEnabled !== undefined ? Boolean(merged.kickEnabled) : true,
    kickChannels: Array.isArray(merged.kickChannels) ? merged.kickChannels : [],
  };
}

export function useSettings() {
  const [formData, setFormData] = useState(DEFAULT_SETTINGS);
  const formDataRef = useRef(DEFAULT_SETTINGS);
  const [statusMsg, setStatusMsg] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);
  const statusTimerRef = useRef(null);

  useEffect(() => {
    GetSettings()
      .then((loaded) => {
        if (loaded) {
          const nextData = coerceSettings({ ...formDataRef.current, ...loaded });
          formDataRef.current = nextData;
          setFormData(nextData);
        }
        setIsLoaded(true);
      })
      .catch((err) => {
        console.error('Failed to load settings:', err);
        setIsLoaded(true);
      });

    const unoffAuth = EventsOn('auth:updated', (updatedSettings) => {
      setFormData((prev) => {
        const merged = { ...prev, ...updatedSettings };
        formDataRef.current = merged;
        return merged;
      });
      setStatusMsg(`Авторизован как @${updatedSettings.username}`);
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      statusTimerRef.current = setTimeout(() => setStatusMsg(''), 2500);
    });

    return () => {
      if (typeof unoffAuth === 'function') unoffAuth();
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, []);

  const updateAndSave = useCallback(async (updates) => {
    const next = { ...formDataRef.current, ...updates };
    const coerced = coerceSettings(next);
    formDataRef.current = coerced;
    setFormData(coerced);

    try {
      if (updates.alwaysOnTop !== undefined) {
        WindowSetAlwaysOnTop(updates.alwaysOnTop);
      }
      await SaveSettings(coerced);
      setStatusMsg('Сохранено');
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      statusTimerRef.current = setTimeout(() => setStatusMsg(''), 2000);
      return true;
    } catch (err) {
      console.error('Failed to auto-save settings:', err);
      setStatusMsg('Ошибка сохранения');
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      statusTimerRef.current = setTimeout(() => setStatusMsg(''), 3000);
      return false;
    }
  }, []);

  const updateSetting = useCallback((key, value) => {
    return updateAndSave({ [key]: value });
  }, [updateAndSave]);

  return {
    formData,
    setFormData,
    formDataRef,
    updateAndSave,
    updateSetting,
    statusMsg,
    setStatusMsg,
    isLoaded,
  };
}
