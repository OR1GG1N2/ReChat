import React from 'react';
import TwitchIcon from '../TwitchIcon';
import { BrowserOpenURL } from '../../../wailsjs/runtime/runtime';
import {
  LogOut,
  AlertTriangle,
  Check,
  Coins,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Play,
} from 'lucide-react';

export default function AccountTab({
  isWide,
  formData,
  updateAndSave,
  handleAuth,
  handleLogout,
  isAuthenticating,
  twitchAuthStatus,
  daTestResult,
  showDAToken,
  setShowDAToken,
  handleTestDA,
  isTestingDA,
  handleSendTestDonation,
  isTestingDonation,
  handleSendTestGoal,
  isTestingGoal,
}) {
  return (
    <div className={`space-y-4 ${isWide ? 'grid grid-cols-1 gap-4' : 'max-w-lg mx-auto'}`}>
      <div>
        <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">
          Авторизация Twitch (Twitch Authorization)
        </div>
        <div className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] shadow-sm space-y-3">
          {formData.username ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#9146FF]/20 border border-[#9146FF]/40 flex items-center justify-center text-white">
                    <TwitchIcon className="w-5 h-5 fill-white text-white" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-[#ECECF1] block">
                      @{formData.username}
                    </span>
                    <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Авторизован через Twitch OAuth
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-semibold rounded-lg border border-rose-500/30 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Выйти</span>
                </button>
              </div>

              {twitchAuthStatus && !twitchAuthStatus.hasFollowerScope && (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2.5 animate-fade-in">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold text-amber-200">
                        Отсутствуют права на оповещения о фолловерах
                      </div>
                      <div className="text-[11px] text-amber-300/80 mt-0.5 leading-relaxed">
                        Twitch требует разрешение <code>moderator:read:followers</code> для получения событий новых подписчиков. Без него сервер Twitch возвращает ошибку 403 Forbidden.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAuth}
                    disabled={isAuthenticating}
                    className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                  >
                    <TwitchIcon className="w-3.5 h-3.5 fill-black text-black" />
                    <span>{isAuthenticating ? 'Авторизация в браузере...' : 'Обновить авторизацию Twitch (выдать права)'}</span>
                  </button>
                </div>
              )}

              {twitchAuthStatus && twitchAuthStatus.hasFollowerScope && (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-xs text-emerald-300">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Права на получение событий фолловеров активны</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-[#8E92A4] leading-relaxed">
                Войдите через Twitch, чтобы отправлять сообщения и использовать персональные значки подписчика.
              </p>
              <button
                type="button"
                onClick={handleAuth}
                disabled={isAuthenticating}
                className="w-full py-2 bg-[#9146FF] hover:bg-[#772CE8] text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
              >
                <TwitchIcon className="w-4 h-4 fill-white text-white" />
                <span>{isAuthenticating ? 'Авторизация в браузере...' : 'Войти через Twitch'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* DonationAlerts Authorization */}
      <div>
        <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-[#F59E0B]" />
            <span>DonationAlerts Authorization</span>
          </div>
          {daTestResult && (
            <span className={`text-[11px] font-medium flex items-center gap-1 ${daTestResult.success ? 'text-emerald-400' : 'text-rose-400'}`}>
              {daTestResult.success ? <Check className="w-3 h-3" /> : '✗'}
              {daTestResult.success ? `@${daTestResult.username}` : (daTestResult.error || 'Ошибка')}
            </span>
          )}
        </div>
        <div className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] shadow-sm space-y-4">
          {/* Master Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-[#ECECF1]">Включить интеграцию DonationAlerts</div>
              <div className="text-[11px] text-[#8E92A4]">Слушать донаты и обновления целей в фоновом режиме</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer ml-4 shrink-0">
              <input
                type="checkbox"
                checked={formData.daEnabled !== false}
                onChange={(e) => updateAndSave({ daEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#181920] border border-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#F59E0B]" />
            </label>
          </div>

          <div className="h-px bg-white/[0.04]" />

          {/* Token Input Field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[#ECECF1]">
                Личный токен авторизации (API Token)
              </label>
              <button
                type="button"
                onClick={() => BrowserOpenURL('https://www.donationalerts.com/dashboard/general-settings')}
                className="text-[11px] text-[#F59E0B] hover:text-amber-300 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Где взять токен?</span>
              </button>
            </div>

            <div className="relative flex items-center">
              <input
                type={showDAToken ? 'text' : 'password'}
                value={formData.daToken || ''}
                onChange={(e) => updateAndSave({ daToken: e.target.value })}
                placeholder="Вставьте токен из настроек DonationAlerts..."
                className="w-full bg-[#181920] border border-white/[0.06] rounded-xl px-3.5 py-2 text-xs text-[#ECECF1] placeholder-[#6C7082] focus:outline-none focus:border-[#F59E0B] font-mono transition-colors pr-10"
              />
              <button
                type="button"
                onClick={() => setShowDAToken(!showDAToken)}
                className="absolute right-3 text-[#8E92A4] hover:text-[#ECECF1] transition-colors cursor-pointer"
                title={showDAToken ? 'Скрыть токен' : 'Показать токен'}
              >
                {showDAToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="text-[11px] text-[#6C7082] leading-relaxed">
              Перейдите в личный кабинет DonationAlerts → «Настройки» → «Основные настройки» → «Токен» (или сгенерируйте в API).
            </div>
          </div>

          {/* Connection Check Actions */}
          <div className="pt-1 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleTestDA}
              disabled={isTestingDA || !formData.daToken}
              className="px-3.5 py-2 bg-gradient-to-r from-[#F59E0B] to-[#D97706] hover:from-[#d97706] hover:to-[#b45309] text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isTestingDA ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>{isTestingDA ? 'Проверка...' : 'Проверить подключение'}</span>
            </button>

            <button
              type="button"
              onClick={handleSendTestDonation}
              disabled={isTestingDonation}
              className="px-3.5 py-2 bg-white/[0.06] hover:bg-white/[0.1] active:bg-white/[0.14] text-[#ECECF1] rounded-xl text-xs font-semibold border border-white/[0.06] transition-all cursor-pointer flex items-center gap-1.5"
            >
              {isTestingDonation ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" /> : <Play className="w-3.5 h-3.5 text-amber-400" />}
              <span>Тест доната (150 ₽)</span>
            </button>

            <button
              type="button"
              onClick={handleSendTestGoal}
              disabled={isTestingGoal}
              className="px-3.5 py-2 bg-white/[0.06] hover:bg-white/[0.1] active:bg-white/[0.14] text-[#ECECF1] rounded-xl text-xs font-semibold border border-white/[0.06] transition-all cursor-pointer flex items-center gap-1.5"
            >
              {isTestingGoal ? <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" /> : <Play className="w-3.5 h-3.5 text-cyan-400" />}
              <span>Тест цели сбора</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
