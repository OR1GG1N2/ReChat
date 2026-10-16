import React from 'react';
import { ChevronDown } from 'lucide-react';

/** Общие элементы страниц настроек: карточка-секция, строка, переключатель, список, ползунок, чип. */

export function Section({ title, children }) {
  return (
    <section>
      <h3 className="px-1 mb-2 text-[10px] font-mono font-medium uppercase tracking-[0.08em] text-[#8A8FA3]">{title}</h3>
      <div className="bg-[#15171E] rounded-[14px] border border-white/[0.06] px-4 divide-y divide-white/[0.06]">
        {children}
      </div>
    </section>
  );
}

export function Row({ label, desc, children, stacked = false }) {
  return (
    <div className={`py-3 ${stacked ? 'space-y-2.5' : 'flex items-center justify-between gap-4'}`}>
      <div className="min-w-0">
        <span className="block text-[13px] font-bold text-[#EDEEF2] leading-snug">{label}</span>
        {desc && <span className="block text-xs text-[#A0A4B4] mt-0.5 leading-relaxed">{desc}</span>}
      </div>
      {children}
    </div>
  );
}

/**
 * Переключатель на нативном checkbox.
 * onChange(checked, event): вторым аргументом приходит исходное событие,
 * поэтому старые обработчики вида (e) => e.target.checked продолжают работать.
 */
export function Switch({ checked, onChange, disabled = false, label }) {
  return (
    <label className={`relative inline-flex shrink-0 cursor-pointer ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        checked={!!checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked, e)}
        className="sr-only peer"
      />
      <span
        className="block w-9 h-5 rounded-full bg-[#2F3342] relative transition-colors
          after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:rounded-full
          after:bg-[#8A8FA3] after:transition-all
          peer-checked:bg-[#7CF2C8] peer-checked:after:left-[18px] peer-checked:after:bg-[#0E0F13]
          peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[#7CF2C8]/60"
      />
    </label>
  );
}

export function ToggleRow({ label, desc, checked, onChange, disabled = false, extra }) {
  return (
    <Row label={label} desc={desc}>
      <div className="flex items-center gap-3 shrink-0">
        {extra}
        <Switch checked={checked} onChange={onChange} disabled={disabled} label={label} />
      </div>
    </Row>
  );
}

export function Select({ value, onChange, children, className = '' }) {
  return (
    <div className="relative shrink-0">
      <select
        value={value}
        onChange={onChange}
        className={`appearance-none h-9 pl-3 pr-8 rounded-lg bg-[#0E0F13] hover:bg-[#1A1C25] text-[13px] font-bold text-[#EDEEF2]
          border border-white/[0.08] outline-none cursor-pointer focus-visible:border-[#7CF2C8]/60 truncate ${className}`}
      >
        {children}
      </select>
      <ChevronDown className="w-3.5 h-3.5 text-[#6B7080] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}

/** onChange(number, event). marks: [{ v, l }] расставляются по реальным позициям шкалы. */
export function Slider({ label, value, display, min, max, step, onChange, marks }) {
  const lo = Number(min);
  const hi = Number(max);
  const pct = Math.min(100, Math.max(0, ((Number(value) - lo) / (hi - lo)) * 100));
  return (
    <div className="py-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold text-[#EDEEF2]">{label}</span>
        <span className="text-xs font-mono font-medium text-[#7CF2C8]">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(parseFloat(e.target.value), e)}
        style={{ background: `linear-gradient(to right, #7CF2C8 ${pct}%, #2F3342 ${pct}%)` }}
        className="w-full h-1 rounded-full appearance-none cursor-pointer
          focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7CF2C8]/60
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#7CF2C8] [&::-webkit-slider-thumb]:border-0"
      />
      {marks && (
        <div className="relative h-3 text-[10px] font-mono text-[#8A8FA3]">
          {marks.map(({ v, l }) => {
            const p = ((v - lo) / (hi - lo)) * 100;
            return (
              <span
                key={l}
                className="absolute"
                style={{ left: `${p}%`, transform: p <= 0 ? 'none' : p >= 100 ? 'translateX(-100%)' : 'translateX(-50%)' }}
              >
                {l}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Chip({ active, onClick, children, mono = false }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`px-3 h-8 rounded-lg text-xs font-bold cursor-pointer transition-colors ${mono ? 'font-mono' : ''}
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7CF2C8]/60
        ${active ? 'bg-[#7CF2C8] text-[#0E0F13]' : 'bg-[#1E212B] text-[#EDEEF2] hover:bg-[#262A36]'}`}
    >
      {children}
    </button>
  );
}
