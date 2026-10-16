import React, { useState, useEffect } from 'react';
import {
  ChevronDown,
  Play,
  Loader2,
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Cloud,
  Monitor,
  Sparkles,
  XCircle,
} from 'lucide-react';
import {
  GetSupertonicStatus,
  DownloadSupertonicModel,
  CancelSupertonicDownload,
  DeleteSupertonicModel,
  GetSupertonicVoices,
} from '../../../wailsjs/go/main/App';
import { EventsOn } from '../../../wailsjs/runtime/runtime';

import PageHeader from './PageHeader';

/* ───────── Базовые элементы ───────── */

function Section({ title, children }) {
  return (
    <section>
      <h3 className="px-1 mb-2 text-[10px] font-mono font-medium uppercase tracking-[0.08em] text-[#8A8FA3]">{title}</h3>
      <div className="bg-[#15171E] rounded-[14px] border border-white/[0.06] px-4 divide-y divide-white/[0.06]">
        {children}
      </div>
    </section>
  );
}

function Row({ label, desc, children, stacked = false }) {
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

function Switch({ checked, onChange, disabled = false, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full shrink-0 cursor-pointer transition-colors
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7CF2C8]/60 disabled:opacity-50 disabled:pointer-events-none
        ${checked ? 'bg-[#7CF2C8]' : 'bg-[#2F3342]'}`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
          checked ? 'left-[18px] bg-[#0E0F13]' : 'left-0.5 bg-[#8A8FA3]'
        }`}
      />
    </button>
  );
}

function ToggleRow({ label, desc, checked, onChange, disabled = false }) {
  return (
    <Row label={label} desc={desc}>
      <Switch checked={!!checked} onChange={onChange} disabled={disabled} label={label} />
    </Row>
  );
}

function Select({ value, onChange, children, className = '' }) {
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

function Slider({ label, value, display, min, max, step, onChange, marks }) {
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
        onChange={(e) => onChange(parseFloat(e.target.value))}
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

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`px-3 h-8 rounded-lg text-xs font-bold cursor-pointer transition-colors
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7CF2C8]/60
        ${active ? 'bg-[#7CF2C8] text-[#0E0F13]' : 'bg-[#1E212B] text-[#EDEEF2] hover:bg-[#262A36]'}`}
    >
      {children}
    </button>
  );
}

const ENGINES = [
  { id: 'supertonic', title: 'Supertonic', sub: 'Локально, ONNX', icon: Cpu },
  { id: 'yandex', title: 'Алиса', sub: 'Облако Яндекса', icon: Cloud },
  { id: 'local', title: 'Система', sub: 'Голоса ОС', icon: Monitor },
];

const TARGET_CATEGORIES = [
  { key: 'ttsRepliesOnly', label: 'Ответы' },
  { key: 'ttsHighlightedOnly', label: 'Выделенные за баллы' },
  { key: 'ttsSubscribersOnly', label: 'Подписчики' },
  { key: 'ttsVipOnly', label: 'VIP' },
  { key: 'ttsModOnly', label: 'Модераторы и стример' },
];

/* ───────── Страница ───────── */

export default function TTSTab({
  isWide,
  formData,
  updateAndSave,
  localVoices = [],
  audioDevices = [],
  isTTSTesting,
  handleTestTTS,
}) {
  const [supertonicStatus, setSupertonicStatus] = useState({
    installed: false,
    downloading: false,
    progress: 0,
    currentFile: '',
    downloadedBytes: 0,
    totalBytes: 0,
    speed: '',
    error: '',
  });
  const [supertonicVoices, setSupertonicVoices] = useState({
    M1: 'Supertonic — Мужской (M1 Глубокий)',
    M2: 'Supertonic — Мужской (M2 Энергичный)',
    F1: 'Supertonic — Женский (F1 Мягкий)',
    F2: 'Supertonic — Женский (F2 Выразительный)',
  });
  const [modelActionLoading, setModelActionLoading] = useState(false);

  useEffect(() => {
    GetSupertonicStatus()
      .then((st) => {
        if (st) setSupertonicStatus(st);
      })
      .catch(() => {});

    GetSupertonicVoices()
      .then((v) => {
        if (v && Object.keys(v).length > 0) setSupertonicVoices(v);
      })
      .catch(() => {});

    const unsub = EventsOn('supertonic:progress', (st) => {
      if (st) setSupertonicStatus(st);
    });

    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  const handleStartDownload = async () => {
    setModelActionLoading(true);
    try {
      await DownloadSupertonicModel();
    } catch (e) {
      console.error(e);
    } finally {
      setModelActionLoading(false);
    }
  };

  const handleCancelDownload = async () => {
    try {
      await CancelSupertonicDownload();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteModel = async () => {
    if (!window.confirm('Удалить скачанные файлы модели Supertonic (~398 MB)?')) return;
    setModelActionLoading(true);
    try {
      await DeleteSupertonicModel();
      const st = await GetSupertonicStatus();
      if (st) setSupertonicStatus(st);
    } catch (e) {
      console.error(e);
    } finally {
      setModelActionLoading(false);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes <= 0) return '0 MB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const engine = formData.ttsEngine || 'yandex';
  const speed = Number(formData.ttsSpeed) || 1.0;
  const volume = formData.ttsVolume !== undefined ? formData.ttsVolume : 1.0;

  const currentEngineTitle =
    engine === 'supertonic'
      ? 'Supertonic M1'
      : engine === 'yandex'
      ? 'Алиса'
      : 'Система';

  return (
    <div className="w-full font-['Manrope',sans-serif]">
      {isWide && (
        <PageHeader
          title="Озвучка TTS"
          description="Что и как читается вслух"
          badge={{
            text: formData.ttsEnabled
              ? `Озвучка включена · ${currentEngineTitle}`
              : 'Озвучка выключена',
            status: formData.ttsEnabled ? 'ok' : 'off',
          }}
        />
      )}

      <div
        className={
          isWide
            ? 'grid grid-cols-1 lg:grid-cols-2 gap-5 items-start'
            : 'space-y-5 max-w-lg mx-auto'
        }
      >
        <div className="space-y-5">
      {/* 1. Озвучка и звук */}
      <Section title="Озвучка и звук">
        <ToggleRow
          label="Озвучивать сообщения чата"
          desc="Новые сообщения читаются вслух по очереди"
          checked={formData.ttsEnabled}
          onChange={(val) => updateAndSave({ ttsEnabled: val })}
        />

        {/* Движок */}
        <Row label="Движок" desc="Где синтезируется голос" stacked>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Движок озвучки">
            {ENGINES.map(({ id, title, sub, icon: Icon }) => {
              const active = engine === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => updateAndSave({ ttsEngine: id })}
                  className={`flex flex-col items-start gap-1 p-3 rounded-xl text-left cursor-pointer transition-colors border
                    focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7CF2C8]/60
                    ${active
                      ? 'bg-[#7CF2C8]/[0.12] border-[#7CF2C8]/40 text-[#7CF2C8]'
                      : 'bg-[#0E0F13] border-white/[0.06] text-[#A0A4B4] hover:text-[#EDEEF2] hover:bg-[#1A1C25]'}`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[13px] font-bold leading-tight">{title}</span>
                  <span className="text-[11px] font-medium opacity-80">{sub}</span>
                </button>
              );
            })}
          </div>
        </Row>

        {/* Менеджер модели Supertonic */}
        {engine === 'supertonic' && (
          <div className="py-3">
            <div className="bg-[#0E0F13] rounded-xl p-3.5 border border-white/[0.06] space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="block text-[13px] font-bold text-[#EDEEF2]">Модель Supertonic</span>
                  <span className="block text-xs text-[#A0A4B4]">Supertone / supertonic · ~398 MB</span>
                </div>

                {supertonicStatus.installed ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#7CF2C8]/[0.12] text-[#7CF2C8] shrink-0">
                    <CheckCircle2 className="w-3 h-3" />
                    Установлена
                  </span>
                ) : supertonicStatus.downloading ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/[0.08] text-[#EDEEF2] shrink-0">
                    <Loader2 className="w-3 h-3 animate-spin text-[#7CF2C8]" />
                    Загрузка {supertonicStatus.progress.toFixed(0)}%
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#FFB84D]/[0.12] text-[#FFB84D] shrink-0">
                    <AlertCircle className="w-3 h-3" />
                    Не установлена
                  </span>
                )}
              </div>

              {supertonicStatus.downloading && (
                <div className="space-y-2">
                  <div className="flex justify-between gap-3 text-[11px] text-[#A0A4B4]">
                    <span className="truncate">{supertonicStatus.currentFile || 'Подготовка файлов…'}</span>
                    <span className="font-mono text-[#EDEEF2] shrink-0">
                      {supertonicStatus.speed && `${supertonicStatus.speed} · `}
                      {formatBytes(supertonicStatus.downloadedBytes)} / {formatBytes(supertonicStatus.totalBytes)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[#15171E] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#7CF2C8] rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(2, supertonicStatus.progress))}%` }}
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleCancelDownload}
                      className="h-8 px-3 text-xs font-bold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Отменить
                    </button>
                  </div>
                </div>
              )}

              {supertonicStatus.error && (
                <div role="alert" className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-lg">
                  {supertonicStatus.error}
                </div>
              )}

              {!supertonicStatus.installed && !supertonicStatus.downloading && (
                <div className="space-y-2.5">
                  <p className="text-xs text-[#A0A4B4] leading-relaxed">
                    Голос синтезируется на вашем компьютере: без интернета и задержек. Веса модели скачиваются с Hugging Face.
                  </p>
                  <button
                    type="button"
                    onClick={handleStartDownload}
                    disabled={modelActionLoading}
                    className="w-full h-9 px-3 bg-[#7CF2C8] hover:bg-[#95F5D3] text-[#0E0F13] text-[13px] font-bold rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {modelActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Скачать модель (~398 MB)
                  </button>
                </div>
              )}

              {supertonicStatus.installed && (
                <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                  <span className="text-xs text-[#7CF2C8] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Готова к локальной озвучке
                  </span>
                  <button
                    type="button"
                    onClick={handleDeleteModel}
                    disabled={modelActionLoading}
                    className="text-xs font-bold text-[#A0A4B4] hover:text-rose-400 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Удалить модель
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Голос */}
        <Row label={engine === 'supertonic' ? 'Голосовой пресет' : engine === 'local' ? 'Системный голос' : 'Голос'}>
          {engine === 'supertonic' ? (
            <Select
              value={formData.ttsVoice || 'M1'}
              onChange={(e) => updateAndSave({ ttsVoice: e.target.value })}
              className="max-w-[280px]"
            >
              {Object.entries(supertonicVoices).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </Select>
          ) : engine === 'local' ? (
            <Select
              value={formData.ttsVoiceLocal || ''}
              onChange={(e) => updateAndSave({ ttsVoiceLocal: e.target.value })}
              className="max-w-[280px]"
            >
              {localVoices.length === 0 ? (
                <option value="">Голоса не найдены</option>
              ) : (
                localVoices.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))
              )}
            </Select>
          ) : (
            <Select value={formData.ttsVoice || 'shitova.us'} onChange={(e) => updateAndSave({ ttsVoice: e.target.value })}>
              <option value="shitova.us">Татьяна Шитова (Алиса)</option>
              <option value="alyss">Alyss</option>
              <option value="ermil">Ermil (мужской)</option>
              <option value="jane">Jane (женский)</option>
              <option value="oksana">Oksana (женский)</option>
              <option value="omazh">Omazh (женский)</option>
              <option value="zahar">Zahar (мужской)</option>
            </Select>
          )}
        </Row>

        <Slider
          label="Скорость"
          value={formData.ttsSpeed !== undefined ? formData.ttsSpeed : 1.0}
          display={`${speed.toFixed(1)}x`}
          min="0.5"
          max="2.0"
          step="0.1"
          onChange={(v) => updateAndSave({ ttsSpeed: v })}
          marks={[{ v: 0.5, l: '0.5x' }, { v: 1, l: '1.0x' }, { v: 2, l: '2.0x' }]}
        />

        <Slider
          label="Громкость"
          value={volume}
          display={`${Math.round(volume * 100)}%`}
          min="0"
          max="1"
          step="0.05"
          onChange={(v) => updateAndSave({ ttsVolume: v })}
        />

        <Row label="Устройство вывода" desc="Наушники, динамики или виртуальный кабель">
          <Select
            value={formData.ttsAudioDevice || ''}
            onChange={(e) => updateAndSave({ ttsAudioDevice: e.target.value })}
            className="max-w-[280px]"
          >
            <option value="">По умолчанию (системное)</option>
            {audioDevices.map((dev) => (
              <option key={dev.deviceId} value={dev.deviceId}>
                {dev.label || `Аудиоустройство (${dev.deviceId.slice(0, 6)}…)`}
              </option>
            ))}
          </Select>
        </Row>

        <Row label="Пропуск текущей озвучки" desc="Сразу прерывает читаемое сообщение">
          <Select value={formData.ttsSkipHotkey || 'Escape'} onChange={(e) => updateAndSave({ ttsSkipHotkey: e.target.value })}>
            <option value="Escape">Esc</option>
            <option value="F8">F8</option>
            <option value="Ctrl+Shift+S">Ctrl + Shift + S</option>
            <option value="Space">Пробел</option>
          </Select>
        </Row>

        <div className="py-3">
          <button
            type="button"
            onClick={handleTestTTS}
            disabled={isTTSTesting}
            className="h-9 px-4 bg-[#1E212B] hover:bg-[#262A36] text-[#EDEEF2] text-[13px] font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-70
              focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7CF2C8]/60"
          >
            {isTTSTesting ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#7CF2C8]" />
            ) : (
              <Play className="w-4 h-4 text-[#7CF2C8]" />
            )}
            {isTTSTesting ? 'Воспроизведение…' : 'Проверить звук'}
          </button>
        </div>
      </Section>

      </div>

      <div className="space-y-5">
      {/* 2. Кого озвучивать */}
      <Section title="Кого озвучивать">
        <ToggleRow
          label="Все сообщения"
          desc="Читать без ограничений по роли"
          checked={formData.ttsAllMessages}
          onChange={(val) => updateAndSave({ ttsAllMessages: val })}
        />
        <ToggleRow
          label="Пропускать упоминания и ответы другим"
          desc="Сообщения с @упоминаниями и адресованные другим зрителям"
          checked={formData.ttsSkipMentions}
          onChange={(val) => updateAndSave({ ttsSkipMentions: val })}
        />
        {!formData.ttsAllMessages && (
          <Row label="Только выбранные категории" desc="Читаются сообщения, подходящие хотя бы под одну" stacked>
            <div className="flex flex-wrap gap-2">
              {TARGET_CATEGORIES.map(({ key, label }) => (
                <Chip key={key} active={!!formData[key]} onClick={() => updateAndSave({ [key]: !formData[key] })}>
                  {label}
                </Chip>
              ))}
            </div>
          </Row>
        )}
      </Section>

      {/* 3. Что читать */}
      <Section title="Что читать">
        <ToggleRow
          label="Имя автора"
          desc="Перед сообщением: «shroud говорит: …»"
          checked={formData.ttsIncludeUsername}
          onChange={(val) => updateAndSave({ ttsIncludeUsername: val })}
        />
        <ToggleRow
          label="Ссылки"
          desc="Если выключено, https://… вырезаются из речи"
          checked={formData.ttsIncludeLinks}
          onChange={(val) => updateAndSave({ ttsIncludeLinks: val })}
        />
        <ToggleRow
          label="Смайлы"
          desc="Названия смайлов Twitch, 7TV и BTTV"
          checked={formData.ttsIncludeEmotes}
          onChange={(val) => updateAndSave({ ttsIncludeEmotes: val })}
        />
        <ToggleRow
          label="Эмодзи"
          desc="Стандартные Unicode-эмодзи"
          checked={formData.ttsIncludeEmoji}
          onChange={(val) => updateAndSave({ ttsIncludeEmoji: val })}
        />
        <ToggleRow
          label="Теги @упоминаний"
          desc="Если выключено, @username вырезаются из текста"
          checked={formData.ttsIncludeMentions}
          onChange={(val) => updateAndSave({ ttsIncludeMentions: val })}
        />
      </Section>

      {/* 4. Обработка текста */}
      <Section title="Обработка текста">
        <div className="py-3 space-y-2.5">
          <label htmlFor="tts-remove-words" className="block">
            <span className="block text-[13px] font-bold text-[#EDEEF2]">Удалять слова и символы</span>
            <span className="block text-xs text-[#A0A4B4] mt-0.5 leading-relaxed">
              Через запятую или с новой строки. Удаляются из текста перед озвучкой.
            </span>
          </label>
          <textarea
            id="tts-remove-words"
            rows={3}
            value={formData.ttsRemoveWords || ''}
            onChange={(e) => updateAndSave({ ttsRemoveWords: e.target.value })}
            placeholder="например: !, ?, http, Kappa, LUL"
            className="w-full bg-[#0E0F13] border border-white/[0.08] rounded-xl p-3 text-xs text-[#EDEEF2] placeholder:text-[#6B7080] outline-none focus-visible:border-[#7CF2C8]/60 resize-none font-mono"
          />
        </div>
      </Section>
      </div>
    </div>
    </div>
  );
}