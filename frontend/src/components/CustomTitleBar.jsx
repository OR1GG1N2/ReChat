import React from 'react';
import { WindowMinimise, WindowToggleMaximise, Quit } from '../../wailsjs/runtime/runtime';
import { QuitApp } from '../../wailsjs/go/main/App';
import { Minus, Square, X, ArrowLeft, Gamepad2, Settings } from 'lucide-react';

const DRAG = { '--wails-draggable': 'drag' };
const NO_DRAG = { '--wails-draggable': 'no-drag' };

export default function CustomTitleBar({
  isSettingsMode = false,
  settingsTitle = 'ReChat',
  onOpenSettings,
  onCloseSettings,
  onBack,
  onToggleGameMode,
}) {
  return (
    <header
      className="h-8 bg-[#0E0F13] border-b border-white/[0.06] flex items-center justify-between px-2.5 font-sans text-xs text-[#A0A4B4] select-none shrink-0 tracking-tight transition-colors z-40"
      style={DRAG}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {/* Left side / Title area: always draggable */}
      <div className="flex items-center gap-2 flex-1 min-w-0 h-full" style={DRAG}>
        {isSettingsMode ? (
          <div className="flex items-center gap-2 h-full">
            <button
              type="button"
              style={NO_DRAG}
              onClick={(e) => {
                e.stopPropagation();
                if (onBack) onBack();
                else if (onCloseSettings) onCloseSettings();
              }}
              className="w-6 h-6 flex items-center justify-center rounded-md text-[#ECECF1] hover:bg-white/[0.08] active:bg-white/[0.12] transition-colors cursor-pointer"
              title="Назад"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span
              className="text-sm font-semibold text-[#ECECF1] tracking-tight truncate select-none"
              style={DRAG}
            >
              {settingsTitle}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
            <span className="w-2.5 h-2.5 rounded-[3px] bg-[#7CF2C8] shrink-0" />
            <span className="font-bold text-xs text-[#ECECF1] tracking-wider">
              ReChat
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-amber-400/90 font-medium">
              1.1 - Alpha
            </span>
          </div>
        )}
      </div>

      {/* Right side: Controls */}
      <div className="flex items-center gap-1 shrink-0" style={NO_DRAG}>
        {isSettingsMode ? (
          <button
            type="button"
            style={NO_DRAG}
            onClick={(e) => {
              e.stopPropagation();
              if (onCloseSettings) onCloseSettings();
            }}
            className="px-2 h-6 flex items-center gap-1 rounded-md text-xs font-medium text-[#9E9EB2] hover:text-[#ECECF1] hover:bg-white/[0.08] active:bg-white/[0.12] transition-colors cursor-pointer mr-1"
            title="Вернуться к чату (Esc)"
          >
            <span>В чат</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              style={NO_DRAG}
              onClick={(e) => {
                e.stopPropagation();
                if (onToggleGameMode) onToggleGameMode();
              }}
              className="w-6 h-6 flex items-center justify-center rounded-md text-[#9E9EB2] hover:text-emerald-400 hover:bg-white/[0.08] active:bg-white/[0.12] transition-colors cursor-pointer"
              title="Игровой режим (Ctrl+Shift+G)"
            >
              <Gamepad2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              style={NO_DRAG}
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenSettings) onOpenSettings();
              }}
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
          style={NO_DRAG}
          onClick={(e) => {
            e.stopPropagation();
            WindowMinimise();
          }}
          className="w-6 h-6 flex items-center justify-center rounded-md text-[#9E9EB2] hover:text-[#ECECF1] hover:bg-white/[0.08] active:bg-white/[0.12] transition-colors cursor-pointer"
          title="Свернуть"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          style={NO_DRAG}
          onClick={(e) => {
            e.stopPropagation();
            WindowToggleMaximise();
          }}
          className="w-6 h-6 flex items-center justify-center rounded-md text-[#9E9EB2] hover:text-[#ECECF1] hover:bg-white/[0.08] active:bg-white/[0.12] transition-colors cursor-pointer"
          title="Развернуть / Восстановить"
        >
          <Square className="w-2.5 h-2.5" />
        </button>
        <button
          type="button"
          style={NO_DRAG}
          onClick={(e) => {
            e.stopPropagation();
            if (typeof QuitApp === 'function') {
              QuitApp();
            } else {
              Quit();
            }
          }}
          className="w-6 h-6 flex items-center justify-center rounded-md text-[#9E9EB2] hover:text-white hover:bg-rose-600/90 active:bg-rose-700 transition-colors cursor-pointer"
          title="Закрыть приложение"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
}