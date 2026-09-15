import React, { useState } from 'react';
import TwitchIcon from './TwitchIcon';
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
  mutedChannels = new Set(),
  onToggleMuteChannel,
  onAddChannel,
  onOpenSettings,
  settings,
  onToggleTTS,
  onStopTTS,
  ttsActive = false,
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');

  const globalIconColor = getTwitchIconColor(settings.iconColor, '#10B981');

  const handleAddSubmit = (e) => {
    e.preventDefault();
    const clean = newChannelName.trim().replace(/^#/, '').toLowerCase();
    if (clean && onAddChannel) {
      onAddChannel(clean);
      setNewChannelName('');
      setIsAdding(false);
    }
  };

  return (
    <header className="h-9 px-2.5 border-b border-white/[0.07] bg-[#0F111A]/95 backdrop-blur-md flex items-center justify-between gap-2 shrink-0 select-none z-10">
      {/* Channels List */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-1 min-w-0">
        <div className="flex items-center gap-1 text-[11px] font-mono text-[#64748B] shrink-0 mr-1">
          <Radio className="w-3 h-3 text-[#9146FF]" />
          <span className="font-semibold text-[#94A3B8]">CHANNELS:</span>
        </div>

        {joinedChannels.length === 0 ? (
          <span className="text-[11px] font-sans text-[#64748B] italic shrink-0">
            Нет активных каналов
          </span>
        ) : (
          joinedChannels.map((ch) => {
            const isMuted = mutedChannels.has(ch.toLowerCase());
            const isOwn =
              settings.username &&
              ch.toLowerCase() === settings.username.toLowerCase();
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
                key={ch}
                type="button"
                onClick={() => onToggleMuteChannel && onToggleMuteChannel(ch)}
                title={
                  isMuted
                    ? `Включить #${ch} (сейчас скрыт)`
                    : `Скрыть #${ch} (клик для отключения)`
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
                className={`px-2 py-0.5 rounded-md border text-[11px] font-mono font-medium flex items-center gap-1.5 shrink-0 cursor-pointer transition-all duration-150 ${
                  isMuted
                    ? 'bg-white/[0.02] border-white/[0.06] text-[#475569] opacity-50 hover:opacity-80 line-through'
                    : isOwn
                    ? 'border-emerald-500/40 text-emerald-300 hover:border-emerald-500/70 shadow-sm shadow-emerald-950/40'
                    : 'hover:border-white/[0.2] hover:scale-[1.02]'
                }`}
              >
                {isMuted ? (
                  <EyeOff className="w-2.5 h-2.5 text-[#64748B]" />
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

        {/* Quick Add Channel */}
        {isAdding ? (
          <form
            onSubmit={handleAddSubmit}
            className="flex items-center gap-1 bg-[#161926] border border-purple-500/40 rounded-md px-1.5 py-0.5 shrink-0"
          >
            <span className="text-[11px] font-mono text-[#64748B]">#</span>
            <input
              type="text"
              autoFocus
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              placeholder="channel"
              className="bg-transparent border-none outline-none text-[11px] font-mono text-[#F8FAFC] w-20 px-0.5 placeholder:text-[#475569]"
            />
            <button
              type="submit"
              className="text-emerald-400 hover:text-emerald-300 p-0.5"
              title="Добавить"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setNewChannelName('');
              }}
              className="text-[#94A3B8] hover:text-[#F8FAFC] p-0.5"
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
            className="px-1.5 py-0.5 rounded-md border border-dashed border-white/[0.1] hover:border-purple-400/50 bg-white/[0.02] hover:bg-purple-500/10 text-[#94A3B8] hover:text-purple-300 text-[11px] font-mono flex items-center gap-1 shrink-0 transition-all cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Канал</span>
          </button>
        )}
      </div>

      {/* Header Right Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Quick TTS Mute / Status */}
        {settings.ttsEnabled && (
          <button
            type="button"
            onClick={onStopTTS}
            title={ttsActive ? "Остановить текущий голос TTS" : "TTS активен"}
            className={`p-1 border rounded-md transition-all duration-150 flex items-center gap-1 cursor-pointer ${
              ttsActive
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 animate-pulse'
                : 'bg-white/[0.04] border-white/[0.08] text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/[0.08]'
            }`}
          >
            {ttsActive ? (
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-[#94A3B8]" />
            )}
          </button>
        )}

        {/* Settings Button */}
        <button
          type="button"
          onClick={onOpenSettings}
          title="Открыть панель настроек (Settings)"
          className="p-1.5 bg-white/[0.04] border border-white/[0.08] text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/[0.08] active:bg-white/[0.12] rounded-md transition-all duration-150 cursor-pointer hover:border-purple-400/40"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
}
