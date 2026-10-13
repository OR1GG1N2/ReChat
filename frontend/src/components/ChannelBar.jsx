import React, { useState } from 'react';
import TwitchIcon from './TwitchIcon';
import KickIcon from './KickIcon';
import { getChannelColor, getTwitchIconColor } from '../utils/channelColors';
import {
  Settings,
  Radio,
  EyeOff,
  Plus,
  Volume2,
  VolumeX,
  X,
  Check,
} from 'lucide-react';

export default function ChannelBar({
  joinedChannels = [],
  joinedKickChannels = [],
  mutedChannels = new Set(),
  onToggleMuteChannel,
  onAddChannel,
  onAddKickChannel,
  onOpenSettings,
  settings = {},
  onToggleTTS,
  onStopTTS,
  ttsActive = false,
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [addPlatform, setAddPlatform] = useState('twitch'); // 'twitch' | 'kick'

  const handleAddSubmit = (e) => {
    e.preventDefault();
    const clean = newChannelName.trim().replace(/^#/, '').toLowerCase();
    if (!clean) return;

    if (addPlatform === 'kick') {
      if (onAddKickChannel) onAddKickChannel(clean);
    } else {
      if (onAddChannel) onAddChannel(clean);
    }
    setNewChannelName('');
    setIsAdding(false);
  };

  const hasAnyChannels = (joinedChannels?.length || 0) + (joinedKickChannels?.length || 0) > 0;

  return (
    <header className="h-8 px-2.5 border-b border-white/[0.04] bg-[#14151C]/95 backdrop-blur-md flex items-center justify-between gap-2 shrink-0 select-none z-10 font-sans">
      {/* Channels List */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-1 min-w-0">
        <div className="flex items-center gap-1 text-[10px] font-mono text-[#6C7082] shrink-0 mr-0.5">
          <Radio className="w-3 h-3 text-[#9146FF]" />
          <span className="font-bold tracking-wider">CHANNELS:</span>
        </div>

        {!hasAnyChannels ? (
          <span className="text-[11px] font-sans text-[#6C7082] italic shrink-0">
            Нет активных каналов
          </span>
        ) : (
          <>
            {/* Twitch Channels */}
            {joinedChannels.map((ch) => {
              const lower = ch.toLowerCase();
              const isMuted = mutedChannels.has(lower);
              const isOwn =
                settings.username &&
                lower === settings.username.toLowerCase();
              const chTheme = getChannelColor(
                ch,
                settings.channelColors,
                isOwn
              );
              const iconFill = getTwitchIconColor(
                settings.iconColor,
                chTheme.accent
              );

              return (
                <button
                  key={`twitch-${ch}`}
                  type="button"
                  onClick={() => onToggleMuteChannel && onToggleMuteChannel(ch)}
                  title={
                    isMuted
                      ? `Включить Twitch #${ch} (сейчас скрыт)`
                      : `Скрыть Twitch #${ch} (клик для отключения)`
                  }
                  style={
                    !isMuted
                      ? {
                          backgroundColor: chTheme.bg,
                          borderColor: chTheme.border,
                          color: chTheme.text,
                        }
                      : {}
                  }
                  className={`px-2 py-0.5 rounded-md border text-[11px] font-medium flex items-center gap-1 shrink-0 cursor-pointer transition-all duration-150 ${
                    isMuted
                      ? 'bg-white/[0.02] border-white/[0.06] text-[#474A58] opacity-50 hover:opacity-80 line-through'
                      : isOwn
                      ? 'border-emerald-500/40 text-emerald-300 hover:border-emerald-500/70 shadow-xs'
                      : 'hover:border-white/[0.2] hover:scale-[1.02]'
                  }`}
                >
                  {isMuted ? (
                    <EyeOff className="w-2.5 h-2.5 text-[#6C7082]" />
                  ) : (
                    <TwitchIcon className="w-2.5 h-2.5" fill={iconFill} />
                  )}
                  <span>#{ch}</span>
                  {isOwn && (
                    <span className="text-[8px] px-1 py-0.2 bg-emerald-950/80 border border-emerald-800/60 rounded text-emerald-400 font-bold uppercase tracking-wider">
                      host
                    </span>
                  )}
                </button>
              );
            })}

            {/* Kick Channels */}
            {joinedKickChannels.map((kch) => {
              const lower = kch.toLowerCase();
              const isMuted = mutedChannels.has(lower);

              return (
                <button
                  key={`kick-${kch}`}
                  type="button"
                  onClick={() => onToggleMuteChannel && onToggleMuteChannel(kch)}
                  title={
                    isMuted
                      ? `Включить Kick #${kch} (сейчас скрыт)`
                      : `Скрыть Kick #${kch} (клик для отключения)`
                  }
                  className={`px-2 py-0.5 rounded-md border text-[11px] font-medium flex items-center gap-1 shrink-0 cursor-pointer transition-all duration-150 ${
                    isMuted
                      ? 'bg-white/[0.02] border-white/[0.06] text-[#474A58] opacity-50 hover:opacity-80 line-through'
                      : 'bg-[#53FC18]/10 border-[#53FC18]/30 text-[#53FC18] hover:border-[#53FC18]/60 shadow-xs hover:scale-[1.02]'
                  }`}
                >
                  {isMuted ? (
                    <EyeOff className="w-2.5 h-2.5 text-[#6C7082]" />
                  ) : (
                    <KickIcon className="w-2.5 h-2.5 text-[#53FC18] fill-[#53FC18]" />
                  )}
                  <span>#{kch}</span>
                  <span className="text-[8px] px-1 py-0.2 bg-black/60 border border-[#53FC18]/40 rounded text-[#53FC18] font-bold uppercase tracking-wider">
                    kick
                  </span>
                </button>
              );
            })}
          </>
        )}

        {/* Quick Add Channel */}
        {isAdding ? (
          <form
            onSubmit={handleAddSubmit}
            className="flex items-center gap-1 bg-[#1E202B] border border-purple-500/50 rounded-md px-1.5 py-0.5 shrink-0"
          >
            <button
              type="button"
              onClick={() => setAddPlatform(addPlatform === 'twitch' ? 'kick' : 'twitch')}
              title={`Платформа: ${addPlatform === 'twitch' ? 'Twitch (клик переключить на Kick)' : 'Kick (клик переключить на Twitch)'}`}
              className="text-[10px] font-mono px-1 py-0.5 rounded cursor-pointer bg-white/[0.06] text-[#ECECF1] hover:bg-white/[0.12] transition-colors"
            >
              {addPlatform === 'twitch' ? 'TW' : 'KICK'}
            </button>
            <span className="text-[11px] font-mono text-[#6C7082]">#</span>
            <input
              type="text"
              autoFocus
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              placeholder="канал..."
              className="bg-transparent border-none outline-none text-[11px] font-mono text-[#ECECF1] w-20 px-0.5 placeholder:text-[#6C7082]"
            />
            <button
              type="submit"
              className="text-emerald-400 hover:text-emerald-300 p-0.5 cursor-pointer"
              title="Добавить канал"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setNewChannelName('');
              }}
              className="text-[#8E92A4] hover:text-[#ECECF1] p-0.5 cursor-pointer"
              title="Отмена"
            >
              <X className="w-3 h-3" />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            title="Быстро добавить канал"
            className="px-1.5 py-0.5 rounded-md border border-dashed border-white/[0.1] hover:border-purple-400/50 bg-white/[0.02] hover:bg-purple-500/10 text-[#8E92A4] hover:text-purple-300 text-[10px] font-mono flex items-center gap-1 shrink-0 transition-all cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Канал</span>
          </button>
        )}
      </div>

      {/* Header Right Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Quick TTS Mute / Status */}
        <button
          type="button"
          onClick={onToggleTTS || onStopTTS}
          title={
            settings.ttsEnabled
              ? ttsActive
                ? 'Озвучка активна (клик: отключить TTS)'
                : 'Озвучка включена (клик: отключить TTS)'
              : 'Озвучка отключена (клик: включить TTS)'
          }
          className={`p-1 border rounded-md transition-all duration-150 flex items-center gap-1 cursor-pointer ${
            settings.ttsEnabled
              ? ttsActive
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 animate-pulse'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
              : 'bg-white/[0.02] border-white/[0.06] text-[#6C7082] hover:text-rose-400 hover:border-rose-400/40 hover:bg-rose-500/10'
          }`}
        >
          {settings.ttsEnabled ? (
            <Volume2 className={`w-3 h-3 ${ttsActive ? 'text-emerald-400' : 'text-emerald-400'}`} />
          ) : (
            <VolumeX className="w-3 h-3 text-[#6C7082]" />
          )}
        </button>

        {/* Settings Button */}
        <button
          type="button"
          onClick={onOpenSettings}
          title="Открыть панель настроек"
          className="p-1 bg-white/[0.04] border border-white/[0.08] text-[#8E92A4] hover:text-[#ECECF1] hover:bg-white/[0.08] active:bg-white/[0.12] rounded-md transition-all duration-150 cursor-pointer hover:border-purple-400/40"
        >
          <Settings className="w-3 h-3" />
        </button>
      </div>
    </header>
  );
}
