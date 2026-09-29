import React from 'react';
import {
  Globe,
  Check,
  Wifi,
  FolderOpen,
  Loader2,
  Eye,
} from 'lucide-react';

export default function ProxyTab({
  formData,
  updateAndSave,
  wgTunnelActive,
  wgImportResult,
  handleImportWireGuard,
  isImportingWg,
  showProxyPassword,
  setShowProxyPassword,
  handleTestProxy,
  isTestingProxy,
  proxyTestResult,
}) {
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Master Enable/Disable Card */}
      <div>
        <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">Сеть и Прокси</div>
        <div className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl transition-colors ${formData.proxyEnabled ? 'bg-blue-500/20 text-blue-400' : 'bg-white/[0.04] text-[#8E92A4]'}`}>
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-[#ECECF1]">Использовать прокси</div>
                <div className="text-xs text-[#8E92A4]">Маршрутизация Twitch IRC, EventSub, Helix API, смайликов и TTS</div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(formData.proxyEnabled)}
                onChange={(e) => updateAndSave({ proxyEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#181920] border border-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3B82F6]" />
            </label>
          </div>
        </div>
      </div>

      {/* Proxy Type & Configuration */}
      <div className={`space-y-4 transition-opacity duration-200 ${formData.proxyEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
        <div>
          <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">Тип прокси</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { id: 'http', label: 'HTTP(S)', desc: 'Стандартный HTTP(S) (Sing-box, V2Ray, Xray, Clash)', defaultPort: '127.0.0.1:7890' },
              { id: 'socks5', label: 'SOCKS5', desc: 'Быстрый TCP SOCKS5 прокси', defaultPort: '127.0.0.1:10808' },
              { id: 'wireguard', label: 'WireGuard', desc: 'Встроенный туннель (без сторонних программ)', defaultPort: '' },
            ].map((pType) => {
              const isSelected = (formData.proxyType || 'http') === pType.id;
              return (
                <button
                  key={pType.id}
                  type="button"
                  onClick={() => {
                    const updates = { proxyType: pType.id };
                    if (pType.id !== 'wireguard' && (!formData.proxyAddress || formData.proxyAddress === '127.0.0.1:7890' || formData.proxyAddress === '127.0.0.1:10808')) {
                      updates.proxyAddress = pType.defaultPort;
                    }
                    updateAndSave(updates);
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    isSelected
                      ? 'bg-[#3B82F6]/10 border-[#3B82F6] text-white shadow-sm'
                      : 'bg-[#242631] border-white/[0.03] text-[#8E92A4] hover:border-white/10 hover:text-[#ECECF1]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold ${isSelected ? 'text-[#3B82F6]' : 'text-[#ECECF1]'}`}>
                      {pType.label}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#3B82F6]" />}
                  </div>
                  <span className="text-[10px] text-[#8E92A4] leading-tight">
                    {pType.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* WireGuard Embedded Section */}
        {formData.proxyType === 'wireguard' ? (
          <div className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] shadow-sm space-y-4">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-[#ECECF1] flex items-center gap-2">
                <Wifi className="w-3.5 h-3.5 text-[#3B82F6]" />
                Встроенный WireGuard туннель
              </div>
              <p className="text-[11px] text-[#8E92A4] leading-relaxed">
                Туннель работает прямо внутри программы через пользовательский сетевой стек gVisor.
                Не требует установки wireproxy, wintun или прав администратора.
              </p>
            </div>

            {/* Status indicator */}
            <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
              wgTunnelActive
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-white/[0.03] border-white/[0.06] text-[#8E92A4]'
            }`}>
              <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${wgTunnelActive ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[#ECECF1]">
                  {wgTunnelActive ? 'WireGuard туннель активен' : 'Туннель не запущен'}
                </div>
                {wgImportResult?.endpoint && (
                  <div className="text-[11px] opacity-80 font-mono mt-0.5 truncate">
                    Сервер: {wgImportResult.endpoint}
                  </div>
                )}
                {wgImportResult?.address && (
                  <div className="text-[11px] opacity-80 font-mono truncate">
                    IP: {wgImportResult.address}
                  </div>
                )}
                {!wgTunnelActive && (
                  <div className="text-[11px] text-[#8E92A4] mt-0.5">
                    Импортируйте .conf файл (WARP или от любого провайдера), чтобы активировать туннель
                  </div>
                )}
              </div>
            </div>

            {/* Import Button */}
            <div>
              <button
                type="button"
                onClick={handleImportWireGuard}
                disabled={isImportingWg}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#3B82F6] hover:bg-blue-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
              >
                {isImportingWg ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Импорт...</span></>
                ) : (
                  <><FolderOpen className="w-3.5 h-3.5" /><span>Выбрать .conf файл WireGuard</span></>
                )}
              </button>
            </div>

            {wgImportResult && !wgImportResult.success && (
              <div className="p-3 rounded-xl border bg-rose-500/10 border-rose-500/30 text-rose-300 text-xs animate-fade-in">
                <span className="font-semibold">Ошибка импорта: </span>{wgImportResult.error}
              </div>
            )}
          </div>
        ) : (
          /* Address, Port & Auth for HTTP / SOCKS5 */
          <div className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] shadow-sm space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#ECECF1] mb-1.5">
                Адрес и порт (Хост:Порт)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.proxyAddress || ''}
                  onChange={(e) => updateAndSave({ proxyAddress: e.target.value })}
                  placeholder={formData.proxyType === 'socks5' ? '127.0.0.1:10808' : '127.0.0.1:7890'}
                  className="w-full bg-[#181920] border border-white/[0.06] rounded-xl px-3.5 py-2 text-xs text-[#ECECF1] placeholder-[#474A58] focus:outline-none focus:border-[#3B82F6] font-mono transition-colors"
                />
              </div>
            </div>

            {/* Authentication toggle & fields */}
            <div className="pt-2 border-t border-white/[0.04] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-[#ECECF1]">Авторизация (логин и пароль)</div>
                  <div className="text-[11px] text-[#8E92A4]">Если прокси требует имени пользователя</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(formData.proxyAuth)}
                    onChange={(e) => updateAndSave({ proxyAuth: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[#181920] border border-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#3B82F6]" />
                </label>
              </div>

              {formData.proxyAuth && (
                <div className="grid grid-cols-2 gap-3 pt-1 animate-fade-in">
                  <div>
                    <label className="block text-[11px] text-[#8E92A4] mb-1">Пользователь (Username)</label>
                    <input
                      type="text"
                      value={formData.proxyUser || ''}
                      onChange={(e) => updateAndSave({ proxyUser: e.target.value })}
                      placeholder="user"
                      className="w-full bg-[#181920] border border-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-[#ECECF1] placeholder-[#474A58] focus:outline-none focus:border-[#3B82F6]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#8E92A4] mb-1">Пароль (Password)</label>
                    <div className="relative">
                      <input
                        type={showProxyPassword ? 'text' : 'password'}
                        value={formData.proxyPassword || ''}
                        onChange={(e) => updateAndSave({ proxyPassword: e.target.value })}
                        placeholder="••••••••"
                        className="w-full bg-[#181920] border border-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-[#ECECF1] placeholder-[#474A58] focus:outline-none focus:border-[#3B82F6] pr-8"
                      />
                      <button
                        type="button"
                        onClick={() => setShowProxyPassword(!showProxyPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6C7082] hover:text-[#ECECF1]"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Test Connection Button and Result Box */}
        <div className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-[#ECECF1]">Проверка соединения</div>
              <div className="text-[11px] text-[#8E92A4]">
                {formData.proxyType === 'wireguard'
                  ? 'Тестовый запрос к серверам Twitch через встроенный WireGuard туннель'
                  : 'Тестовый запрос к серверам Twitch через настроенный прокси'}
              </div>
            </div>
            <button
              type="button"
              onClick={handleTestProxy}
              disabled={isTestingProxy || (formData.proxyType !== 'wireguard' && !formData.proxyAddress)}
              className="px-3.5 py-1.5 bg-[#3B82F6] hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              {isTestingProxy ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Проверка...</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5" />
                  <span>Проверить</span>
                </>
              )}
            </button>
          </div>

          {proxyTestResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 animate-fade-in ${
                proxyTestResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {proxyTestResult.success ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <div className="w-4 h-4 rounded-full border border-rose-400 flex items-center justify-center font-bold text-[10px] shrink-0">!</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold">
                  {proxyTestResult.success ? 'Соединение успешно' : 'Ошибка соединения'}
                </div>
                <div className="text-[11px] opacity-90 truncate font-mono">
                  {proxyTestResult.message}
                </div>
              </div>
              {proxyTestResult.latency > 0 && (
                <div className="px-2 py-0.5 rounded bg-black/20 text-[10px] font-mono shrink-0">
                  {proxyTestResult.latency} ms
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
