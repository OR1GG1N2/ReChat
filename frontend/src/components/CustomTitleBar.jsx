import React from 'react';
import { WindowMinimise, WindowToggleMaximise, Quit } from '../../wailsjs/runtime/runtime';
import { Settings, Minus, Square, X, ArrowLeft, Gamepad2 } from 'lucide-react';

export default function CustomTitleBar({
  isSettingsMode = false,
  settingsTitle = 'Appearance',
  onOpenSettings,
  onCloseSettings,
  onBack,
  onToggleGameMode,
}) {
  return (
    <header
      className="h-8 bg-[#181920] border-b border-white/[0.04] flex items-center justify-between px-2.5 font-sans text-xs text-[#9E9EB2] select-none shrink-0 tracking-tight transition-colors"
      style={{ '--wails-draggable': 'drag' }}
      onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      {/* Left side / Title area: always draggable */}
      <div
        className="flex items-center gap-2 flex-1 min-w-0 h-full"
        style={{ '--wails-draggable': 'drag' }}
      >
        {isSettingsMode ? (
          <div className="flex items-center gap-2 h-full">
            <button
              type="button"
              style={{ '--wails-draggable': 'no-drag' }}
              onClick={onBack || onCloseSettings}
              className="w-6 h-6 flex items-center justify-center rounded-md text-[#ECECF1] hover:bg-white/[0.08] active:bg-white/[0.12] transition-colors cursor-pointer"
              title="Назад"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span
              className="text-sm font-semibold text-[#ECECF1] tracking-tight truncate select-none"
              style={{ '--wails-draggable': 'drag' }}
            >
              {settingsTitle}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
            <span className="font-semibold text-[11px] text-[#6C7082] tracking-wider uppercase">
              ReChat
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-amber-400/90 font-medium tracking-tight">
              1.1 - Alpha
            </span>
          </div>
        )}
      </div>

      {/* Right side: Settings button (in chat mode) / Close view (in settings mode) + Windows controls */}
      <div
        className="flex items-center gap-1 shrink-0"
        style={{ '--wails-draggable': 'no-drag' }}
      >
        {isSettingsMode ? (
          <button
            type="button"
            onClick={onCloseSettings}
            className="w-6 h-6 flex items-center justify-center rounded-md text-[#9E9EB2] hover:text-[#ECECF1] hover:bg-white/[0.08] active:bg-white/[0.12] transition-colors cursor-pointer mr-1"
            title="Закрыть настройки"
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onToggleGameMode}
              className="w-6 h-6 flex items-center justify-center rounded-md text-[#9E9EB2] hover:text-emerald-400 hover:bg-white/[0.08] active:bg-white/[0.12] transition-colors cursor-pointer"
              title="Игровой режим (Ctrl+Shift+G)"
            >
              <Gamepad2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="w-6 h-6 flex items-center justify-center rounded-md text-[#9E9EB2] hover:text-[#ECECF1] hover:bg-white/[0.08] active:bg-white/[0.12] transition-colors cursor-pointer"
              title="Настройки"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </>
        )}

        {/* Windows System Control Buttons */}
        <button
          type="button"
          onClick={WindowMinimise}
          className="w-6 h-6 flex items-center justify-center rounded-md text-[#9E9EB2] hover:text-[#ECECF1] hover:bg-white/[0.08] active:bg-white/[0.12] transition-colors cursor-pointer"
          title="Свернуть"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={WindowToggleMaximise}
          className="w-6 h-6 flex items-center justify-center rounded-md text-[#9E9EB2] hover:text-[#ECECF1] hover:bg-white/[0.08] active:bg-white/[0.12] transition-colors cursor-pointer"
          title="Развернуть / Восстановить"
        >
          <Square className="w-2.5 h-2.5" />
        </button>
        <button
          type="button"
          onClick={Quit}
          className="w-6 h-6 flex items-center justify-center rounded-md text-[#9E9EB2] hover:text-white hover:bg-rose-600/90 active:bg-rose-700 transition-colors cursor-pointer"
          title="Закрыть приложение"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
}
