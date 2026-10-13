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
  Sparkles,
  XCircle,
  HardDrive,
} from 'lucide-react';
import {
  GetSupertonicStatus,
  DownloadSupertonicModel,
  CancelSupertonicDownload,
  DeleteSupertonicModel,
  GetSupertonicVoices,
} from '../../../wailsjs/go/main/App';
import { EventsOn } from '../../../wailsjs/runtime/runtime';

function ToggleRow({ label, desc, checked, onChange, disabled = false }) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="pr-4">
        <span className="text-sm font-medium text-[#ECECF1] block leading-snug">{label}</span>
        {desc && <span className="text-xs text-[#8E92A4] block mt-0.5">{desc}</span>}
      </div>
      <button
        type="button"
        role="switch"
        disabled={disabled}
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer focus:outline-none shrink-0 ${
          checked ? 'bg-[#3B82F6]' : 'bg-[#383A48]'
        }`}
      >
        <div
          className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

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

  return (
    <div className={`space-y-4 ${isWide ? 'grid grid-cols-1 gap-4' : 'max-w-lg mx-auto'}`}>
      {/* 1. Playback & Voice Devices Card */}
      <div>
        <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">
          Воспроизведение и звук
        </div>
        <div className="bg-[#242631] rounded-2xl p-4 space-y-4 border border-white/[0.03] shadow-sm">
          <ToggleRow
            label="Включить озвучку сообщений (TTS)"
            desc="Автоматическое чтение входящих сообщений чата"
            checked={formData.ttsEnabled}
            onChange={(val) => updateAndSave({ ttsEnabled: val })}
          />

          <div className="h-px bg-white/[0.06]" />

          {/* Engine Selector */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-[#ECECF1] block">
                Движок озвучки
              </span>
              <span className="text-xs text-[#8E92A4]">
                Локальная нейросеть ONNX, облачная Алиса или ОС
              </span>
            </div>
            <div className="relative">
              <select
                value={formData.ttsEngine || 'yandex'}
                onChange={(e) => updateAndSave({ ttsEngine: e.target.value })}
                className="appearance-none bg-[#181920] hover:bg-[#1E202B] text-sm text-[#ECECF1] font-medium py-1.5 pl-3 pr-8 rounded-lg border border-white/[0.04] outline-none cursor-pointer"
              >
                <option value="supertonic">⚡ Supertonic AI (Локально ONNX)</option>
                <option value="yandex">🟣 Yandex Alice (Облако)</option>
                <option value="local">🎙 Локальный синтезатор (ОС)</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#8E92A4] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Dedicated Supertonic Model Manager Card */}
          {formData.ttsEngine === 'supertonic' && (
            <div className="bg-[#181920] rounded-xl p-3.5 border border-blue-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-[#ECECF1] block">
                      Модель Supertonic TTS (ONNX)
                    </span>
                    <span className="text-[11px] text-[#8E92A4]">
                      Supertone / supertonic (~398 MB)
                    </span>
                  </div>
                </div>

                {supertonicStatus.installed ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" />
                    Установлена
                  </span>
                ) : supertonicStatus.downloading ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Загрузка {supertonicStatus.progress.toFixed(0)}%
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <AlertCircle className="w-3 h-3" />
                    Не установлена
                  </span>
                )}
              </div>

              {/* Downloading Progress Bar */}
              {supertonicStatus.downloading && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-[11px] text-[#8E92A4]">
                    <span className="truncate max-w-[180px]">
                      {supertonicStatus.currentFile || 'Подготовка файлов...'}
                    </span>
                    <span className="font-mono text-[#ECECF1]">
                      {supertonicStatus.speed && `${supertonicStatus.speed} • `}
                      {formatBytes(supertonicStatus.downloadedBytes)} / {formatBytes(supertonicStatus.totalBytes)}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#2B2D3C] rounded-full overflow-hidden relative">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300 rounded-full"
                      style={{ width: `${Math.min(100, Math.max(2, supertonicStatus.progress))}%` }}
                    />
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleCancelDownload}
                      className="px-2.5 py-1 text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded-md border border-rose-500/20 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Отменить</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Error Banner */}
              {supertonicStatus.error && (
                <div className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                  {supertonicStatus.error}
                </div>
              )}

              {/* Not Installed Actions */}
              {!supertonicStatus.installed && !supertonicStatus.downloading && (
                <div className="space-y-2 pt-1">
                  <p className="text-xs text-[#8E92A4] leading-relaxed">
                    Нейросетевой синтез голоса работает полностью на вашем ПК без интернета и задержек. Нажмите кнопку ниже, чтобы автоматически скачать необходимые веса с Hugging Face.
                  </p>
                  <button
                    type="button"
                    onClick={handleStartDownload}
                    disabled={modelActionLoading}
                    className="w-full py-2 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    {modelActionLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    <span>Скачать модель Supertonic (~398 MB)</span>
                  </button>
                </div>
              )}

              {/* Installed Actions */}
              {supertonicStatus.installed && (
                <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
                  <span className="text-[11px] text-emerald-400/90 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Готово к локальному озвучиванию
                  </span>
                  <button
                    type="button"
                    onClick={handleDeleteModel}
                    disabled={modelActionLoading}
                    className="text-xs text-[#8E92A4] hover:text-rose-400 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Удалить модель</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Voice selector */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[#ECECF1]">
              {formData.ttsEngine === 'supertonic'
                ? 'Голосовой пресет Supertonic'
                : formData.ttsEngine === 'local'
                ? 'Системный голос'
                : 'Голос (Алиса / Яндекс)'}
            </span>
            <div className="relative">
              {formData.ttsEngine === 'supertonic' ? (
                <select
                  value={formData.ttsVoice || 'M1'}
                  onChange={(e) => updateAndSave({ ttsVoice: e.target.value })}
                  className="appearance-none bg-[#181920] hover:bg-[#1E202B] text-sm text-[#ECECF1] font-medium py-1.5 pl-3 pr-8 rounded-lg border border-white/[0.04] outline-none cursor-pointer max-w-[220px] truncate"
                >
                  {Object.entries(supertonicVoices).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              ) : formData.ttsEngine === 'local' ? (
                <select
                  value={formData.ttsVoiceLocal || ''}
                  onChange={(e) => updateAndSave({ ttsVoiceLocal: e.target.value })}
                  className="appearance-none bg-[#181920] hover:bg-[#1E202B] text-sm text-[#ECECF1] font-medium py-1.5 pl-3 pr-8 rounded-lg border border-white/[0.04] outline-none cursor-pointer max-w-[200px] truncate"
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
                </select>
              ) : (
                <select
                  value={formData.ttsVoice || 'shitova.us'}
                  onChange={(e) => updateAndSave({ ttsVoice: e.target.value })}
                  className="appearance-none bg-[#181920] hover:bg-[#1E202B] text-sm text-[#ECECF1] font-medium py-1.5 pl-3 pr-8 rounded-lg border border-white/[0.04] outline-none cursor-pointer"
                >
                  <option value="shitova.us">Татьяна Шитова (Алиса)</option>
                  <option value="alyss">Alyss</option>
                  <option value="ermil">Ermil (мужской)</option>
                  <option value="jane">Jane (женский)</option>
                  <option value="oksana">Oksana (женский)</option>
                  <option value="omazh">Omazh (женский)</option>
                  <option value="zahar">Zahar (мужской)</option>
                </select>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-[#8E92A4] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Speed slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#8E92A4]">Скорость воспроизведения</span>
              <span className="text-[#ECECF1] font-mono font-medium">
                {(Number(formData.ttsSpeed) || 1.0).toFixed(1)}x
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={formData.ttsSpeed !== undefined ? formData.ttsSpeed : 1.0}
              onChange={(e) =>
                updateAndSave({ ttsSpeed: parseFloat(e.target.value) })
              }
              className="w-full h-1.5 bg-[#383A48] rounded-lg appearance-none cursor-pointer accent-[#3B82F6]"
            />
            <div className="flex justify-between text-[10px] text-[#6C7082] font-mono">
              <span>0.5x (Медленно)</span>
              <span>1.0x (Стандарт)</span>
              <span>2.0x (Быстро)</span>
            </div>
          </div>

          {/* Volume slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#8E92A4]">Громкость</span>
              <span className="text-[#ECECF1] font-mono font-medium">
                {Math.round((formData.ttsVolume !== undefined ? formData.ttsVolume : 1.0) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={formData.ttsVolume !== undefined ? formData.ttsVolume : 1.0}
              onChange={(e) =>
                updateAndSave({ ttsVolume: parseFloat(e.target.value) })
              }
              className="w-full h-1.5 bg-[#383A48] rounded-lg appearance-none cursor-pointer accent-[#3B82F6]"
            />
          </div>

          {/* Audio Output Device */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-[#ECECF1] block">
                Устройство вывода звука
              </span>
              <span className="text-xs text-[#8E92A4]">
                Наушники, динамики или виртуальный кабель
              </span>
            </div>
            <div className="relative">
              <select
                value={formData.ttsAudioDevice || ''}
                onChange={(e) => updateAndSave({ ttsAudioDevice: e.target.value })}
                className="appearance-none bg-[#181920] hover:bg-[#1E202B] text-sm text-[#ECECF1] font-medium py-1.5 pl-3 pr-8 rounded-lg border border-white/[0.04] outline-none cursor-pointer max-w-[220px] truncate"
              >
                <option value="">По умолчанию (Системное)</option>
                {audioDevices.map((dev) => (
                  <option key={dev.deviceId} value={dev.deviceId}>
                    {dev.label || `Аудиоустройство (${dev.deviceId.slice(0, 6)}...)`}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#8E92A4] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Skip Hotkey */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-[#ECECF1] block">
                Клавиша пропуска текущей озвучки
              </span>
              <span className="text-xs text-[#8E92A4]">
                Мгновенно прерывает читаемое сейчас сообщение
              </span>
            </div>
            <div className="relative">
              <select
                value={formData.ttsSkipHotkey || 'Escape'}
                onChange={(e) => updateAndSave({ ttsSkipHotkey: e.target.value })}
                className="appearance-none bg-[#181920] hover:bg-[#1E202B] text-sm text-[#ECECF1] font-medium py-1.5 pl-3 pr-8 rounded-lg border border-white/[0.04] outline-none cursor-pointer"
              >
                <option value="Escape">Клавиша Esc (Escape)</option>
                <option value="F8">Клавиша F8</option>
                <option value="Ctrl+Shift+S">Ctrl + Shift + S</option>
                <option value="Space">Пробел (Space)</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#8E92A4] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Test button */}
          <button
            type="button"
            onClick={handleTestTTS}
            disabled={isTTSTesting}
            className="px-4 py-2 bg-white/[0.06] hover:bg-white/[0.1] text-[#ECECF1] text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors cursor-pointer border border-white/[0.06]"
          >
            {isTTSTesting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#3B82F6]" />
            ) : (
              <Play className="w-3.5 h-3.5 text-[#3B82F6]" />
            )}
            <span>{isTTSTesting ? 'Воспроизведение...' : 'Проверить звук TTS'}</span>
          </button>
        </div>
      </div>

      {/* 2. Message Targeting Card */}
      <div>
        <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">
          Кого озвучивать (Фильтрация сообщений)
        </div>
        <div className="bg-[#242631] rounded-2xl p-4 space-y-2 border border-white/[0.03] shadow-sm">
          <ToggleRow
            label="Озвучивать все сообщения"
            desc="Читать все входящие сообщения без ограничений по роли"
            checked={formData.ttsAllMessages}
            onChange={(val) => updateAndSave({ ttsAllMessages: val })}
          />
          <ToggleRow
            label="Не озвучивать упоминания и ответы"
            desc="Пропускать сообщения, содержащие @упоминания или адресованные другим пользователям"
            checked={formData.ttsSkipMentions}
            onChange={(val) => updateAndSave({ ttsSkipMentions: val })}
          />

          {!formData.ttsAllMessages && (
            <div className="pt-2 pl-2 border-t border-white/[0.04] space-y-1">
              <div className="text-[11px] text-[#3B82F6] font-medium pb-1">
                Озвучивать только выбранные категории:
              </div>
              <ToggleRow
                label="Озвучивать сообщения с ответом"
                desc="Сообщения, отправленные в ответ другим пользователям"
                checked={formData.ttsRepliesOnly}
                onChange={(val) => updateAndSave({ ttsRepliesOnly: val })}
              />
              <ToggleRow
                label="Озвучивать выделенные сообщения"
                desc="Сообщения, выделенные за баллы канала (Channel Points)"
                checked={formData.ttsHighlightedOnly}
                onChange={(val) => updateAndSave({ ttsHighlightedOnly: val })}
              />
              <ToggleRow
                label="Озвучивать сообщения подписчиков"
                desc="Сообщения от платных подписчиков (Subscribers)"
                checked={formData.ttsSubscribersOnly}
                onChange={(val) => updateAndSave({ ttsSubscribersOnly: val })}
              />
              <ToggleRow
                label="Озвучивать сообщения ВИП"
                desc="Сообщения от пользователей со значком VIP"
                checked={formData.ttsVipOnly}
                onChange={(val) => updateAndSave({ ttsVipOnly: val })}
              />
              <ToggleRow
                label="Озвучивать сообщения модеров"
                desc="Сообщения от модераторов и стримера"
                checked={formData.ttsModOnly}
                onChange={(val) => updateAndSave({ ttsModOnly: val })}
              />
            </div>
          )}
        </div>
      </div>

      {/* 3. Message Content Card */}
      <div>
        <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">
          Содержимое сообщения (Что читать)
        </div>
        <div className="bg-[#242631] rounded-2xl p-4 space-y-2 border border-white/[0.03] shadow-sm">
          <ToggleRow
            label="Озвучивать имя автора"
            desc="Добавлять имя пользователя перед сообщением (например, «shroud говорит: ...»)"
            checked={formData.ttsIncludeUsername}
            onChange={(val) => updateAndSave({ ttsIncludeUsername: val })}
          />
          <ToggleRow
            label="Озвучивать ссылки"
            desc="Если выключено, ссылки https://... автоматически удаляются из речи"
            checked={formData.ttsIncludeLinks}
            onChange={(val) => updateAndSave({ ttsIncludeLinks: val })}
          />
          <ToggleRow
            label="Озвучивать смайлики"
            desc="Если выключено, названия смайликов Twitch / 7TV / BTTV вырезаются из речи"
            checked={formData.ttsIncludeEmotes}
            onChange={(val) => updateAndSave({ ttsIncludeEmotes: val })}
          />
          <ToggleRow
            label="Озвучивать эмодзи"
            desc="Если выключено, стандартные Unicode-эмодзи удаляются из речи"
            checked={formData.ttsIncludeEmoji}
            onChange={(val) => updateAndSave({ ttsIncludeEmoji: val })}
          />
          <ToggleRow
            label="Озвучивать теги @упоминаний"
            desc="Если выключено, теги @username вырезаются из читаемого текста"
            checked={formData.ttsIncludeMentions}
            onChange={(val) => updateAndSave({ ttsIncludeMentions: val })}
          />
        </div>
      </div>

      {/* 4. Text Processing Card */}
      <div>
        <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">
          Обработка текста
        </div>
        <div className="bg-[#242631] rounded-2xl p-4 space-y-3 border border-white/[0.03] shadow-sm">
          <div>
            <label className="text-sm font-medium text-[#ECECF1] block mb-1">
              Удалять из текста слова или символы
            </label>
            <p className="text-xs text-[#8E92A4] mb-2 leading-relaxed">
              Укажите слова, фразы или символы через запятую или с новой строки. Они будут автоматически удаляться перед озвучкой.
            </p>
            <textarea
              rows={3}
              value={formData.ttsRemoveWords || ''}
              onChange={(e) => updateAndSave({ ttsRemoveWords: e.target.value })}
              placeholder="например: !, ?, http, стример, Kappa, LUL"
              className="w-full bg-[#181920] border border-white/[0.06] rounded-xl p-3 text-xs text-[#ECECF1] placeholder:text-[#6C7082] outline-none focus:border-[#3B82F6] resize-none font-mono"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
