/* Hallmark · genre: atmospheric · theme: Terminal/Obsidian · pre-emit critique: P5 H5 E5 S5 R5 V5 */
import React from 'react';
import { WindowMinimise, WindowToggleMaximise, Quit } from '../../wailsjs/runtime/runtime';
import TwitchIcon from './TwitchIcon';
import { Minus, Square, X } from 'lucide-react';

export default function CustomTitleBar({ title = 'ReChat — Twitch Chat Monitor' }) {
  return (
    <div
      className="h-7 bg-[#0c0d12] border-b border-white/[0.06] flex items-center justify-between px-2.5 font-sans text-xs text-[#8c93a4] select-none shrink-0 tracking-tight"
      style={{ '--wails-draggable': 'drag' }}
    >
      {/* App Branding & Status */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">
          <TwitchIcon className="w-3 h-3 fill-[#10b981] text-[#10b981]" />
          <span className="font-mono text-[10px] font-semibold text-[#f1f3f7] uppercase tracking-wider">RC-01</span>
        </div>
        <span className="text-[11px] font-medium text-[#8c93a4] truncate">{title}</span>
      </div>

      {/* Tactile Window Controls */}
      <div
        className="flex items-center gap-0.5"
        style={{ '--wails-draggable': 'no-drag' }}
      >
        <button
          type="button"
          onClick={WindowMinimise}
          className="w-5 h-5 flex items-center justify-center rounded text-[#8c93a4] hover:text-[#f1f3f7] hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors"
          title="Minimize"
        >
          <Minus className="w-2.5 h-2.5" />
        </button>
        <button
          type="button"
          onClick={WindowToggleMaximise}
          className="w-5 h-5 flex items-center justify-center rounded text-[#8c93a4] hover:text-[#f1f3f7] hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors"
          title="Maximize / Restore"
        >
          <Square className="w-2 h-2" />
        </button>
        <button
          type="button"
          onClick={Quit}
          className="w-5 h-5 flex items-center justify-center rounded text-[#8c93a4] hover:text-white hover:bg-rose-600/80 active:bg-rose-700 transition-colors"
          title="Close Application"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
