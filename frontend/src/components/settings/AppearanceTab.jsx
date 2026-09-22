import React from 'react';
import TwitchIcon from '../TwitchIcon';
import { ChevronDown, Heart, Loader2 } from 'lucide-react';

export default function AppearanceTab({
  isWide,
  formData,
  updateAndSave,
  FONT_OPTIONS,
  SPACING_OPTIONS,
  ALIGN_OPTIONS,
  getScalingLabel,
  handleFontSizeChange,
  handleToggleAlwaysOnTop,
  handleSendTestFollow,
  isTestingFollow,
}) {
  const spacingClass =
    formData.messageSpacing === 'compact'
      ? 'py-0.5'
      : formData.messageSpacing === 'relaxed'
      ? 'py-2'
      : 'py-1';

  const alignClass =
    formData.textAlign === 'center'
      ? 'justify-center text-center'
      : formData.textAlign === 'right'
      ? 'justify-end text-right'
      : 'justify-start text-left';

  return (
    <div className={`space-y-4 ${isWide ? 'grid grid-cols-1 gap-4' : 'max-w-lg mx-auto'}`}>
      {/* Live Message Preview Box */}
      <div>
        <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5 flex items-center justify-between">
          <span>Предпросмотр чата (Live Preview)</span>
          <span className="text-[11px] text-[#3B82F6] font-mono font-medium">
            {formData.fontFamily || 'Lato'} · {formData.fontSize || 14}px
          </span>
        </div>
        <div className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] shadow-sm space-y-2">
          <div
            className="bg-[#181920] rounded-xl p-3.5 space-y-1.5 border border-white/[0.04] overflow-hidden"
            style={{
              fontSize: `${formData.fontSize || 14}px`,
              fontFamily: `"${formData.fontFamily || 'Lato'}", system-ui, sans-serif`,
              textAlign: formData.textAlign || 'left',
            }}
          >
            {/* Message 1: Broadcaster */}
            <div
              className={`flex items-center gap-1.5 leading-snug break-words ${spacingClass} ${alignClass}`}
            >
              <span className="shrink-0 inline-flex items-center justify-center w-[18px] h-[18px] rounded-[4px] bg-[#9146FF] shadow-xs select-none">
                <TwitchIcon className="w-3 h-3 text-white fill-white" />
              </span>

              {formData.showBadges && (
                <span className="inline-flex items-center px-1 rounded bg-[#E91916] text-[9px] font-bold text-white uppercase tracking-wider shrink-0 select-none">
                  STREAMER
                </span>
              )}

              {formData.showTimestamps && (
                <span className="text-[#6C7082] text-[11px] font-mono tabular-nums shrink-0 select-none">
                  {formData.timestampFormat === 'HH:MM' ? '15:04' : '15:04:22'}
                </span>
              )}

              <span className="font-bold text-[#A855F7] shrink-0">StreamHero:</span>
              <span className="text-[#ECECF1]">Добро пожаловать на стрим! Все настройки чата синхронизированы ✨</span>
            </div>

            {/* Message 2: VIP / Subscriber */}
            <div
              className={`flex items-center gap-1.5 leading-snug break-words ${spacingClass} ${alignClass}`}
            >
              <span className="shrink-0 inline-flex items-center justify-center w-[18px] h-[18px] rounded-[4px] bg-[#9146FF] shadow-xs select-none">
                <TwitchIcon className="w-3 h-3 text-white fill-white" />
              </span>

              {formData.showBadges && (
                <span className="inline-flex items-center px-1 rounded bg-[#10B981] text-[9px] font-bold text-white uppercase tracking-wider shrink-0 select-none">
                  SUB 12M
                </span>
              )}

              {formData.showTimestamps && (
                <span className="text-[#6C7082] text-[11px] font-mono tabular-nums shrink-0 select-none">
                  {formData.timestampFormat === 'HH:MM' ? '15:04' : '15:04:35'}
                </span>
              )}

              <span className="font-bold text-[#10B981] shrink-0">KappaKing:</span>
              <span className="text-[#ECECF1]">Шрифт и размер меняются сразу же без перезапуска! 🚀</span>
              <span className="text-base leading-none select-none">👋</span>
            </div>
          </div>
        </div>
      </div>

      {/* Window section */}
      <div>
        <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">
          Окно приложения
        </div>
        <div className="bg-[#242631] rounded-2xl p-4 flex items-center justify-between border border-white/[0.03] shadow-sm">
          <div>
            <span className="text-sm font-medium text-[#ECECF1] block">
              Отображать поверх всех окон
            </span>
            <span className="text-xs text-[#8E92A4] block mt-0.5">
              Окно чата будет оставаться поверх игр, браузера и других программ
            </span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer ml-4 shrink-0">
            <input
              type="checkbox"
              checked={Boolean(formData.alwaysOnTop)}
              onChange={handleToggleAlwaysOnTop}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-[#181920] border border-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3B82F6]" />
          </label>
        </div>
      </div>

      {/* Message text formatting section */}
      <div>
        <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">
          Шрифт и размер текста
        </div>
        <div className="bg-[#242631] rounded-2xl p-4 space-y-4 border border-white/[0.03] shadow-sm">
          {/* Text scaling control */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[#ECECF1]">
                Размер текста
              </span>
              <span className="text-xs text-[#3B82F6] font-mono font-semibold">
                {formData.fontSize || 14}px ({getScalingLabel(formData.fontSize)})
              </span>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <span className="text-xs font-semibold text-[#8E92A4] select-none w-3 text-center">
                A
              </span>
              <div className="relative flex-1 flex items-center">
                <input
                  type="range"
                  min="12"
                  max="20"
                  step="2"
                  value={formData.fontSize || 14}
                  onChange={handleFontSizeChange}
                  className="w-full h-1.5 bg-[#181920] rounded-lg appearance-none cursor-pointer accent-[#3B82F6]"
                />
              </div>
              <span className="text-lg font-bold text-[#8E92A4] select-none w-4 text-center">
                A
              </span>
            </div>

            {/* Quick size presets */}
            <div className="grid grid-cols-5 gap-1.5 pt-1">
              {[12, 14, 16, 18, 20].map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => updateAndSave({ fontSize: sz })}
                  className={`py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                    (formData.fontSize || 14) === sz
                      ? 'bg-[#3B82F6] text-white border-[#3B82F6] font-semibold'
                      : 'bg-[#181920] border-white/[0.04] text-[#8E92A4] hover:text-[#ECECF1]'
                  }`}
                >
                  {sz}px
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-white/[0.06]" />

          {/* Font selector dropdown */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-[#ECECF1] block">
                Шрифт чата
              </span>
              <span className="text-xs text-[#8E92A4]">
                Семейство шрифта для отображения сообщений
              </span>
            </div>
            <div className="relative">
              <select
                value={formData.fontFamily || 'Lato'}
                onChange={(e) => updateAndSave({ fontFamily: e.target.value })}
                className="appearance-none bg-[#181920] hover:bg-[#1E202B] text-xs text-[#ECECF1] font-medium py-2 pl-3 pr-8 rounded-xl border border-white/[0.06] outline-none cursor-pointer focus:border-[#3B82F6]"
              >
                {FONT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#8E92A4] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Distance between messages selector dropdown */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-[#ECECF1] block">
                Расстояние между сообщениями
              </span>
              <span className="text-xs text-[#8E92A4]">
                Вертикальные отступы между строками
              </span>
            </div>
            <div className="relative">
              <select
                value={formData.messageSpacing || 'default'}
                onChange={(e) => updateAndSave({ messageSpacing: e.target.value })}
                className="appearance-none bg-[#181920] hover:bg-[#1E202B] text-xs text-[#ECECF1] font-medium py-2 pl-3 pr-8 rounded-xl border border-white/[0.06] outline-none cursor-pointer focus:border-[#3B82F6]"
              >
                {SPACING_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#8E92A4] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Text alignment selector dropdown */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-[#ECECF1] block">
                Выравнивание текста
              </span>
              <span className="text-xs text-[#8E92A4]">
                Позиция текста сообщений в окне
              </span>
            </div>
            <div className="relative">
              <select
                value={formData.textAlign || 'left'}
                onChange={(e) => updateAndSave({ textAlign: e.target.value })}
                className="appearance-none bg-[#181920] hover:bg-[#1E202B] text-xs text-[#ECECF1] font-medium py-2 pl-3 pr-8 rounded-xl border border-white/[0.06] outline-none cursor-pointer focus:border-[#3B82F6]"
              >
                {ALIGN_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#8E92A4] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Message Elements Section */}
      <div>
        <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">
          Элементы сообщений
        </div>
        <div className="bg-[#242631] rounded-2xl p-4 space-y-3.5 border border-white/[0.03] shadow-sm">
          {/* Show Timestamps Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-[#ECECF1] block">
                Время сообщений (Таймстампы)
              </span>
              <span className="text-xs text-[#8E92A4]">
                Отображать точное время отправки перед ником
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer ml-4 shrink-0">
              <input
                type="checkbox"
                checked={formData.showTimestamps !== false}
                onChange={(e) => updateAndSave({ showTimestamps: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#181920] border border-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3B82F6]" />
            </label>
          </div>

          {/* Timestamp format (if enabled) */}
          {formData.showTimestamps !== false && (
            <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
              <div>
                <span className="text-xs font-medium text-[#ECECF1] block">
                  Формат времени
                </span>
                <span className="text-[11px] text-[#8E92A4]">
                  Отображение с секундами или без
                </span>
              </div>
              <div className="relative">
                <select
                  value={formData.timestampFormat || 'HH:MM:SS'}
                  onChange={(e) => updateAndSave({ timestampFormat: e.target.value })}
                  className="appearance-none bg-[#181920] hover:bg-[#1E202B] text-xs text-[#ECECF1] font-medium py-1.5 pl-3 pr-8 rounded-xl border border-white/[0.06] outline-none cursor-pointer focus:border-[#3B82F6]"
                >
                  <option value="HH:MM:SS">ЧЧ:ММ:СС (15:04:22)</option>
                  <option value="HH:MM">ЧЧ:ММ (15:04)</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-[#8E92A4] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          )}

          <div className="h-px bg-white/[0.06]" />

          {/* Show Badges Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-[#ECECF1] block">
                Значки пользователей (Badges)
              </span>
              <span className="text-xs text-[#8E92A4]">
                Значки подписчика, VIP, модератора и стримера
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer ml-4 shrink-0">
              <input
                type="checkbox"
                checked={formData.showBadges !== false}
                onChange={(e) => updateAndSave({ showBadges: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#181920] border border-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3B82F6]" />
            </label>
          </div>

          <div className="h-px bg-white/[0.06]" />

          {/* Show Follows Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-[#ECECF1] block">
                Новые фолловеры (Follow)
              </span>
              <span className="text-xs text-[#8E92A4]">
                Отображать баннер в чате, когда зритель отслеживает канал
              </span>
            </div>
            <div className="flex items-center gap-3 ml-4 shrink-0">
              <button
                type="button"
                onClick={handleSendTestFollow}
                disabled={isTestingFollow}
                title="Отправить тестовое оповещение фолловера"
                className="px-2.5 py-1 bg-white/[0.05] hover:bg-white/[0.1] active:bg-white/[0.15] text-[#ECECF1] rounded-lg border border-white/[0.06] text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5"
              >
                {isTestingFollow ? (
                  <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                ) : (
                  <Heart className="w-3 h-3 text-emerald-400 fill-emerald-400/20" />
                )}
                <span>Тест</span>
              </button>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.showFollows !== false}
                  onChange={(e) => updateAndSave({ showFollows: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#181920] border border-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#10B981]" />
              </label>
            </div>
          </div>

          <div className="h-px bg-white/[0.06]" />

          {/* Max messages in history */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-[#ECECF1] block">
                Лимит сообщений в чате
              </span>
              <span className="text-xs text-[#8E92A4]">
                Максимум хранимых сообщений в окне приложения
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {[100, 200, 300, 500].map((lim) => (
                <button
                  key={lim}
                  type="button"
                  onClick={() => updateAndSave({ maxMessages: lim })}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                    (formData.maxMessages || 300) === lim
                      ? 'bg-[#3B82F6] text-white border-[#3B82F6] font-semibold'
                      : 'bg-[#181920] border-white/[0.04] text-[#8E92A4] hover:text-[#ECECF1]'
                  }`}
                >
                  {lim}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
