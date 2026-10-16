import React from 'react';
import TwitchIcon from '../TwitchIcon';
import { Heart, Loader2 } from 'lucide-react';
import { Section, Row, ToggleRow, Select, Slider, Chip } from './SettingsUI';

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
  const fontSize = formData.fontSize || 14;
  const fontFamily = formData.fontFamily || 'Lato';

  const spacingClass =
    formData.messageSpacing === 'compact' ? 'py-0.5' : formData.messageSpacing === 'relaxed' ? 'py-2' : 'py-1';

  const alignClass =
    formData.textAlign === 'center'
      ? 'justify-center text-center'
      : formData.textAlign === 'right'
      ? 'justify-end text-right'
      : 'justify-start text-left';

  const showTimestamps = formData.showTimestamps !== false;
  const showBadges = formData.showBadges !== false;
  const showFollows = formData.showFollows !== false;

  return (
    // Раскладка зависит только от ширины окна: до 1180 px одна колонка, дальше две
    <div
      className={`font-['Manrope',sans-serif] grid grid-cols-1 gap-5 items-start min-[1180px]:grid-cols-2 ${
        isWide ? '' : 'max-w-lg mx-auto'
      }`}
    >
      <div className="space-y-5">
        {/* Предпросмотр */}
        <section>
          <div className="px-1 mb-2 flex items-center justify-between">
            <h3 className="text-[10px] font-mono font-medium uppercase tracking-[0.08em] text-[#8A8FA3]">Предпросмотр</h3>
            <span className="text-[11px] font-mono font-medium text-[#7CF2C8]">
              {fontFamily} · {fontSize}px
            </span>
          </div>
          <div className="bg-[#15171E] rounded-[14px] border border-white/[0.06] p-3">
            <div
              className="bg-[#0E0F13] rounded-xl py-2 px-3 overflow-hidden"
              style={{
                fontSize: `${fontSize}px`,
                fontFamily: `"${fontFamily}", system-ui, sans-serif`,
                textAlign: formData.textAlign || 'left',
              }}
            >
              <div className={`flex items-center gap-1.5 leading-snug break-words ${spacingClass} ${alignClass}`}>
                <span className="shrink-0 inline-flex items-center justify-center w-[18px] h-[18px] rounded-[4px] bg-[#9146FF] select-none">
                  <TwitchIcon className="w-3 h-3 text-white fill-white" />
                </span>
                {showBadges && (
                  <span className="inline-flex items-center px-1 rounded bg-[#E91916] text-[9px] font-bold text-white uppercase tracking-wider shrink-0 select-none">
                    STREAMER
                  </span>
                )}
                {showTimestamps && (
                  <span className="text-[#6B7080] text-[11px] font-mono tabular-nums shrink-0 select-none">
                    {formData.timestampFormat === 'HH:MM' ? '15:04' : '15:04:22'}
                  </span>
                )}
                <span className="font-bold text-[#A855F7] shrink-0">StreamHero:</span>
                <span className="text-[#EDEEF2]">Добро пожаловать на стрим! Настройки чата уже применены.</span>
              </div>

              <div className={`flex items-center gap-1.5 leading-snug break-words ${spacingClass} ${alignClass}`}>
                <span className="shrink-0 inline-flex items-center justify-center w-[18px] h-[18px] rounded-[4px] bg-[#9146FF] select-none">
                  <TwitchIcon className="w-3 h-3 text-white fill-white" />
                </span>
                {showBadges && (
                  <span className="inline-flex items-center px-1 rounded bg-[#10B981] text-[9px] font-bold text-white uppercase tracking-wider shrink-0 select-none">
                    SUB 12M
                  </span>
                )}
                {showTimestamps && (
                  <span className="text-[#6B7080] text-[11px] font-mono tabular-nums shrink-0 select-none">
                    {formData.timestampFormat === 'HH:MM' ? '15:04' : '15:04:35'}
                  </span>
                )}
                <span className="font-bold text-[#10B981] shrink-0">KappaKing:</span>
                <span className="text-[#EDEEF2]">Шрифт и размер меняются сразу, без перезапуска.</span>
              </div>
            </div>
          </div>
        </section>

        {/* Шрифт и размер */}
        <Section title="Шрифт и размер">
          <Slider
            label="Размер текста"
            value={fontSize}
            display={`${fontSize}px · ${getScalingLabel(formData.fontSize)}`}
            min="12"
            max="20"
            step="2"
            onChange={(_, e) => handleFontSizeChange(e)}
          />
          <div className="py-3 flex gap-1.5">
            {[12, 14, 16, 18, 20].map((sz) => (
              <Chip key={sz} mono active={fontSize === sz} onClick={() => updateAndSave({ fontSize: sz })}>
                {sz}
              </Chip>
            ))}
          </div>

          <Row label="Шрифт чата" desc="Семейство шрифта сообщений">
            <Select value={fontFamily} onChange={(e) => updateAndSave({ fontFamily: e.target.value })} className="max-w-[200px]">
              {FONT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Row>

          <Row label="Расстояние между сообщениями" desc="Вертикальные отступы между строками" stacked>
            <div className="flex flex-wrap gap-1.5">
              {SPACING_OPTIONS.map((opt) => (
                <Chip
                  key={opt.id}
                  active={(formData.messageSpacing || 'default') === opt.id}
                  onClick={() => updateAndSave({ messageSpacing: opt.id })}
                >
                  {opt.label}
                </Chip>
              ))}
            </div>
          </Row>

          <Row label="Выравнивание текста" desc="Положение сообщений в окне" stacked>
            <div className="flex flex-wrap gap-1.5">
              {ALIGN_OPTIONS.map((opt) => (
                <Chip
                  key={opt.id}
                  active={(formData.textAlign || 'left') === opt.id}
                  onClick={() => updateAndSave({ textAlign: opt.id })}
                >
                  {opt.label}
                </Chip>
              ))}
            </div>
          </Row>
        </Section>
      </div>

      <div className="space-y-5">
        {/* Окно */}
        <Section title="Окно приложения">
          <ToggleRow
            label="Поверх всех окон"
            desc="Чат остаётся над играми, браузером и другими программами"
            checked={Boolean(formData.alwaysOnTop)}
            onChange={(_, e) => handleToggleAlwaysOnTop(e)}
          />
        </Section>

        {/* Элементы сообщений */}
        <Section title="Элементы сообщений">
          <ToggleRow
            label="Время сообщений"
            desc="Точное время отправки перед ником"
            checked={showTimestamps}
            onChange={(val) => updateAndSave({ showTimestamps: val })}
          />
          {showTimestamps && (
            <Row label="Формат времени" desc="С секундами или без">
              <div className="flex gap-1.5">
                {['HH:MM:SS', 'HH:MM'].map((fmt) => (
                  <Chip
                    key={fmt}
                    mono
                    active={(formData.timestampFormat || 'HH:MM:SS') === fmt}
                    onClick={() => updateAndSave({ timestampFormat: fmt })}
                  >
                    {fmt === 'HH:MM:SS' ? '15:04:22' : '15:04'}
                  </Chip>
                ))}
              </div>
            </Row>
          )}

          <ToggleRow
            label="Значки пользователей"
            desc="Подписчик, VIP, модератор и стример"
            checked={showBadges}
            onChange={(val) => updateAndSave({ showBadges: val })}
          />

          <ToggleRow
            label="Новые фолловеры"
            desc="Баннер в чате, когда зритель подписывается на канал"
            checked={showFollows}
            onChange={(val) => updateAndSave({ showFollows: val })}
            extra={
              <button
                type="button"
                onClick={handleSendTestFollow}
                disabled={isTestingFollow}
                title="Отправить тестовое оповещение фолловера"
                className="h-8 px-3 rounded-lg bg-[#1E212B] hover:bg-[#262A36] text-[#EDEEF2] text-xs font-bold transition-colors cursor-pointer
                  flex items-center gap-1.5 disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7CF2C8]/60"
              >
                {isTestingFollow ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#7CF2C8]" />
                ) : (
                  <Heart className="w-3.5 h-3.5 text-[#7CF2C8]" />
                )}
                Тест
              </button>
            }
          />

          <Row label="Лимит сообщений в чате" desc="Сколько сообщений хранится в окне" stacked>
            <div className="flex flex-wrap gap-1.5">
              {[100, 200, 300, 500].map((lim) => (
                <Chip key={lim} mono active={(formData.maxMessages || 300) === lim} onClick={() => updateAndSave({ maxMessages: lim })}>
                  {lim}
                </Chip>
              ))}
            </div>
          </Row>
        </Section>
      </div>
    </div>
  );
}