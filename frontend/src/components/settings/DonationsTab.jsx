import React from 'react';
import {
  Coins,
  Check,
  Loader2,
  Play,
  Key,
} from 'lucide-react';

export default function DonationsTab({
  formData,
  updateAndSave,
  daTestResult,
  handleSendTestDonation,
  isTestingDonation,
  handleSendTestGoal,
  isTestingGoal,
  setActiveTab,
}) {
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#302111] via-[#241a1c] to-[#1a1b24] rounded-2xl p-5 border border-amber-500/25 shadow-sm relative overflow-hidden">
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-[#F59E0B]" />
            <h3 className="text-sm font-bold text-[#ECECF1]">Интеграция с DonationAlerts</h3>
          </div>
          <p className="text-xs text-[#8E92A4] leading-relaxed max-w-xl">
            Прием донатов и сборов средств в реальном времени. Отображение в чате, озвучка сообщений через TTS и специализированные оверлеи для OBS Studio.
          </p>
        </div>
        <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Connection Status Card */}
      <div>
        <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5 flex items-center justify-between">
          <span>Статус подключения</span>
          {daTestResult && (
            <span className={`text-[11px] font-medium flex items-center gap-1 ${daTestResult.success ? 'text-emerald-400' : 'text-rose-400'}`}>
              {daTestResult.success ? <Check className="w-3 h-3" /> : '✗'}
              {daTestResult.success ? `@${daTestResult.username}` : (daTestResult.error || 'Ошибка')}
            </span>
          )}
        </div>
        <div className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${formData.daToken && formData.daEnabled !== false ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <div className="text-xs font-bold text-[#ECECF1]">
                {formData.daToken
                  ? (daTestResult?.success ? `Подключено: @${daTestResult.username}` : 'Токен DonationAlerts сохранен')
                  : 'Токен DonationAlerts не настроен'}
              </div>
            </div>
            <div className="text-[11px] text-[#8E92A4]">
              {formData.daToken
                ? 'Интеграция активна. Управление токеном и переподключение находятся во вкладке «Авторизация».'
                : 'Для приема донатов и целей сбора укажите ваш API токен во вкладке «Авторизация».'}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {formData.daToken && (
              <>
                <button
                  type="button"
                  onClick={handleSendTestDonation}
                  disabled={isTestingDonation}
                  className="px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] active:bg-white/[0.14] text-[#ECECF1] rounded-xl text-xs font-semibold border border-white/[0.06] transition-all cursor-pointer flex items-center gap-1.5"
                  title="Отправить тестовый донат в чат и виджеты"
                >
                  {isTestingDonation ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" /> : <Play className="w-3.5 h-3.5 text-amber-400" />}
                  <span>Тест доната</span>
                </button>
                <button
                  type="button"
                  onClick={handleSendTestGoal}
                  disabled={isTestingGoal}
                  className="px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] active:bg-white/[0.14] text-[#ECECF1] rounded-xl text-xs font-semibold border border-white/[0.06] transition-all cursor-pointer flex items-center gap-1.5"
                  title="Отправить тестовую цель сбора"
                >
                  {isTestingGoal ? <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" /> : <Play className="w-3.5 h-3.5 text-cyan-400" />}
                  <span>Тест цели</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('account')}
              className="px-3.5 py-1.5 bg-[#F59E0B]/15 hover:bg-[#F59E0B]/25 text-[#F59E0B] border border-[#F59E0B]/30 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Key className="w-3.5 h-3.5" />
              <span>{formData.daToken ? 'Настройки токена' : 'Ввести токен'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Chat Display Settings */}
      <div>
        <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">Отображение в чате</div>
        <div className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] shadow-sm space-y-4">
          {/* Show In Chat */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-[#ECECF1]">Показывать донаты в окне чата</div>
              <div className="text-[11px] text-[#8E92A4]">Выделенные карточки с именем донатера, суммой и текстом</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer ml-4 shrink-0">
              <input
                type="checkbox"
                checked={formData.daShowInChat !== false}
                onChange={(e) => updateAndSave({ daShowInChat: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#181920] border border-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#F59E0B]" />
            </label>
          </div>

          <div className="h-px bg-white/[0.04]" />

          {/* Min Chat Amount */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-medium text-[#ECECF1]">Минимальная сумма для чата (₽)</div>
              <div className="text-[11px] text-[#8E92A4]">Донаты меньше этой суммы не будут отображаться в ленте сообщений (0 — без ограничений)</div>
            </div>
            <div className="w-32 shrink-0">
              <input
                type="number"
                min="0"
                step="10"
                value={formData.daMinChatAmount !== undefined ? formData.daMinChatAmount : 0}
                onChange={(e) => updateAndSave({ daMinChatAmount: Math.max(0, parseFloat(e.target.value) || 0) })}
                className="w-full bg-[#181920] border border-white/[0.06] rounded-xl px-3 py-1.5 text-xs text-[#ECECF1] text-right font-mono focus:outline-none focus:border-[#F59E0B]"
              />
            </div>
          </div>

          <div className="h-px bg-white/[0.04]" />

          {/* Pinned Goal Bar */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-[#ECECF1]">Закреплять цель сбора в шапке чата</div>
              <div className="text-[11px] text-[#8E92A4]">Компактная плашка сбора средств с прогресс-баром и процентом под заголовком</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer ml-4 shrink-0">
              <input
                type="checkbox"
                checked={formData.daShowGoalBar !== false}
                onChange={(e) => updateAndSave({ daShowGoalBar: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#181920] border border-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#06B6D4]" />
            </label>
          </div>
        </div>
      </div>

      {/* TTS Integration Settings */}
      <div>
        <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">Озвучка донатов (TTS)</div>
        <div className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] shadow-sm space-y-4">
          {/* Enable DA TTS */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-[#ECECF1]">Озвучивать сообщения донатов</div>
              <div className="text-[11px] text-[#8E92A4]">Использует настроенный голос Яндекс Алисы или системный TTS</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer ml-4 shrink-0">
              <input
                type="checkbox"
                checked={formData.daTTS !== false}
                onChange={(e) => updateAndSave({ daTTS: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#181920] border border-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#F59E0B]" />
            </label>
          </div>

          <div className="h-px bg-white/[0.04]" />

          {/* Min TTS Amount */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-medium text-[#ECECF1]">Минимальная сумма для озвучки (₽)</div>
              <div className="text-[11px] text-[#8E92A4]">Донаты ниже этого порога отобразятся в чате, но не будут зачитываться голосом</div>
            </div>
            <div className="w-32 shrink-0">
              <input
                type="number"
                min="0"
                step="50"
                value={formData.daMinTTSAmount !== undefined ? formData.daMinTTSAmount : 0}
                onChange={(e) => updateAndSave({ daMinTTSAmount: Math.max(0, parseFloat(e.target.value) || 0) })}
                className="w-full bg-[#181920] border border-white/[0.06] rounded-xl px-3 py-1.5 text-xs text-[#ECECF1] text-right font-mono focus:outline-none focus:border-[#F59E0B]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* OBS Widgets Shortcuts */}
      <div className="bg-[#1e1e28] rounded-2xl p-4 border border-white/[0.04] flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs font-semibold text-[#ECECF1]">Нужны оверлеи для OBS Studio?</div>
          <div className="text-[11px] text-[#8E92A4]">Перейдите к индивидуальной настройке виджетов донатов и сборов</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('widget_donation')}
            className="px-3 py-1.5 bg-[#F59E0B]/20 hover:bg-[#F59E0B]/30 text-amber-300 text-xs font-semibold rounded-lg border border-amber-500/30 transition-colors cursor-pointer"
          >
            Виджет донатов OBS
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('widget_goal')}
            className="px-3 py-1.5 bg-[#06B6D4]/20 hover:bg-[#06B6D4]/30 text-cyan-300 text-xs font-semibold rounded-lg border border-cyan-500/30 transition-colors cursor-pointer"
          >
            Виджет цели сбора OBS
          </button>
        </div>
      </div>
    </div>
  );
}
