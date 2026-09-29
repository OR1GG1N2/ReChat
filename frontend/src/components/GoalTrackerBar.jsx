import React, { useState } from 'react';
import { Target, ChevronUp, ChevronDown, Sparkles, X } from 'lucide-react';

export default function GoalTrackerBar({ goal, onClose }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!goal || !goal.title) return null;

  const current = Number(goal.currentAmount || goal.current || 0);
  const target = Number(goal.targetAmount || goal.target || 0);
  const currency = goal.currency || 'RUB';
  const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : (goal.percent || 0);

  const formatNum = (num) => {
    return new Intl.NumberFormat('ru-RU').format(Math.round(num));
  };

  return (
    <div className="shrink-0 mx-2 mt-1 mb-1 rounded-xl bg-gradient-to-r from-[#171924]/95 via-[#1e202d]/95 to-[#171924]/95 border border-cyan-500/25 shadow-lg backdrop-blur-md transition-all duration-200 select-none overflow-hidden z-20">
      <div className="px-3 py-1.5 flex items-center justify-between gap-2">
        {/* Left: Icon & Title */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="p-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 shrink-0">
            <Target className="w-3.5 h-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-[#ECECF1] truncate">
                {goal.title}
              </span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-cyan-950/80 border border-cyan-500/40 text-cyan-300">
                {percent}%
              </span>
            </div>
          </div>
        </div>

        {/* Right: Amounts & Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right text-[11px] font-mono">
            <span className="font-bold text-cyan-300">{formatNum(current)}</span>
            {target > 0 ? (
              <span className="text-[#8E92A4]"> / {formatNum(target)} {currency}</span>
            ) : (
              <span className="text-[#8E92A4]"> {currency}</span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-md text-[#8E92A4] hover:text-[#ECECF1] hover:bg-white/[0.06] transition-colors cursor-pointer"
            title={isCollapsed ? 'Развернуть прогресс-бар' : 'Свернуть прогресс-бар'}
          >
            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-[#8E92A4] hover:text-rose-400 hover:bg-white/[0.06] transition-colors cursor-pointer"
              title="Скрыть панель сбора"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar Track */}
      {!isCollapsed && (
        <div className="px-3 pb-2 pt-0.5">
          <div className="h-2 w-full bg-[#101116] rounded-full overflow-hidden border border-white/[0.06] p-[1px] relative shadow-inner">
            <div
              className={`h-full rounded-full bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 transition-all duration-700 ease-out ${percent > 0 ? 'shadow-[0_0_12px_rgba(6,182,212,0.6)]' : 'opacity-0'}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
