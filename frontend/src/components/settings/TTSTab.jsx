import React from 'react';
import { ChevronDown, Play, Loader2 } from 'lucide-react';

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
                Облачная Алиса или локальный голос системы
              </span>
            </div>
            <div className="relative">
              <select
                value={formData.ttsEngine || 'yandex'}
                onChange={(e) => updateAndSave({ ttsEngine: e.target.value })}
                className="appearance-none bg-[#181920] hover:bg-[#1E202B] text-sm text-[#ECECF1] font-medium py-1.5 pl-3 pr-8 rounded-lg border border-white/[0.04] outline-none cursor-pointer"
              >
                <option value="yandex">Yandex Alice (Облако)</option>
                <option value="local">Локальный синтезатор (ОС)</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#8E92A4] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Voice selector */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[#ECECF1]">
              {formData.ttsEngine === 'local' ? 'Системный голос' : 'Голос (Алиса / Яндекс)'}
            </span>
            <div className="relative">
              {formData.ttsEngine === 'local' ? (
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
            label="Озвучивать упоминания"
            desc="Если выключено, теги @username удаляются из читаемого текста"
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
