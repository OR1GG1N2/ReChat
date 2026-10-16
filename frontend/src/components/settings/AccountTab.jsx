import React, { useEffect, useState } from 'react';
import TwitchIcon from '../TwitchIcon';
import KickIcon from '../KickIcon';
import { BrowserOpenURL } from '../../../wailsjs/runtime/runtime';
import { obsClient } from '../../utils/obsWebSocket';
import PageHeader from './PageHeader';
import {
  X,
  Check,
  AlertTriangle,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Play,
  Radio,
  Coins,
  Tv,
  Plus,
  Trash2,
  RefreshCw,
} from 'lucide-react';

function StatusDot({ status = 'connected' }) {
  const bg =
    status === 'connected'
      ? 'bg-[#7CF2C8]'
      : status === 'pending'
      ? 'bg-[#FFB84D]'
      : 'bg-[#6B7080]';

  return <span className={`h-[7px] w-[7px] rounded-full shrink-0 ${bg}`} />;
}

function ConnectionRow({
  title,
  description,
  status = 'connected',
  onClick,
}) {
  const isConnected = status === 'connected';

  return (
    <div className="flex items-center gap-[10px] p-[10px_12px] border-b border-white/[0.06] last:border-b-0 text-[13px] text-[#EDEEF2] hover:bg-white/[0.02] transition">
      <StatusDot status={status} />
      <div className="min-w-0 flex-1">
        <div className="font-bold text-[#EDEEF2] leading-tight truncate">{title}</div>
        <div className="text-xs text-[#A0A4B4] leading-normal truncate">{description}</div>
      </div>
      <button
        type="button"
        onClick={onClick}
        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition active:scale-95 cursor-pointer ${
          isConnected
            ? 'bg-[#1E212B] text-[#EDEEF2] hover:bg-[#282C38]'
            : 'bg-[#7CF2C8] text-[#0E0F13] hover:bg-[#9af7d8]'
        }`}
      >
        {isConnected ? 'Настроить' : 'Подключить'}
      </button>
    </div>
  );
}

function Modal({ title, description, icon, onClose, children }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/65 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-white/[0.08] bg-[#15171E] shadow-2xl"
      >
        <header className="flex items-start gap-3 border-b border-white/[0.06] p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-[#1E212B] text-[#7CF2C8]">
            {icon}
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-[#EDEEF2]">{title}</h2>
            <p className="mt-0.5 text-xs text-[#A0A4B4]">{description}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded-lg p-1.5 text-[#6B7080] transition hover:bg-white/[0.06] hover:text-white cursor-pointer"
          >
            <X size={18} />
          </button>
        </header>

        <div className="space-y-4 p-5 text-xs">{children}</div>
      </section>
    </div>
  );
}

export default function AccountTab({
  isWide,
  formData = {},
  updateAndSave = () => {},
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
  joinedChannels = [],
  joinedKickChannels = [],
  handleAddKickChannel,
  handleRemoveKickChannel,
}) {
  const [activePopup, setActivePopup] = useState(null);
  const [kickInput, setKickInput] = useState('');

  // OBS WebSocket state
  const [obsState, setObsState] = useState(obsClient.getState());
  const [obsHostInput, setObsHostInput] = useState(obsClient.host);
  const [obsPortInput, setObsPortInput] = useState(obsClient.port);
  const [obsPassInput, setObsPassInput] = useState(obsClient.password);
  const [isConnectingObs, setIsConnectingObs] = useState(false);

  useEffect(() => {
    const unsubscribe = obsClient.subscribe((state) => {
      setObsState(state);
      setObsHostInput(state.host);
      setObsPortInput(state.port);
      setObsPassInput(state.password);
    });
    return unsubscribe;
  }, []);

  const daEnabled = formData?.daEnabled !== false;
  const daToken = formData?.daToken || '';

  const twitchConnected = Boolean(
    twitchAuthStatus?.connected ??
    twitchAuthStatus?.authenticated ??
    formData?.oauthToken ??
    formData?.username
  );

  const twitchUsername =
    formData?.username ||
    twitchAuthStatus?.username ||
    twitchAuthStatus?.login ||
    '';

  const hasFollowerScope = Boolean(
    twitchAuthStatus?.hasFollowerScope ??
    twitchAuthStatus?.has_follower_scope ??
    false
  );

  const isKickConnected = joinedKickChannels && joinedKickChannels.length > 0;
  const isObsConnected = obsState.isConnected;

  // Count active connections out of 4: Twitch, Kick, DonationAlerts, OBS Studio
  const connectedCount =
    Number(twitchConnected) +
    Number(isKickConnected) +
    Number(daEnabled && Boolean(daToken)) +
    Number(isObsConnected);

  const closePopup = () => setActivePopup(null);

  const handleConnectOBS = async () => {
    setIsConnectingObs(true);
    await obsClient.connect(obsHostInput, obsPortInput, obsPassInput);
    setTimeout(() => setIsConnectingObs(false), 600);
  };

  const handleDisconnectOBS = () => {
    obsClient.disconnect();
  };

  return (
    <div className="flex flex-col w-full font-['Manrope',sans-serif] text-[#EDEEF2] pb-6 select-none">
      <div className={`pt-1 w-full ${isWide ? '' : 'max-w-[500px] mx-auto'}`}>
        {isWide ? (
          <PageHeader
            title="Подключения"
            description="Авторизация стримера и интеграция внешних платформ"
            badge={{
              text: `Подключено ${connectedCount} из 4`,
              status: connectedCount > 0 ? 'ok' : 'warn',
            }}
          />
        ) : (
          <div className="pt-2 pb-2.5">
            <div className="text-[18px] font-bold text-[#EDEEF2] leading-tight">
              Подключения
            </div>
            <div className="text-xs text-[#A0A4B4] mt-0.5">
              Подключено {connectedCount} из 4
            </div>
          </div>
        )}

        {/* 4 Core Connections: Twitch, Kick, DonationAlerts, OBS Studio */}
        <div className="overflow-hidden rounded-[14px] border border-white/[0.06] bg-[#15171E]">
          {/* 1. Twitch */}
          <ConnectionRow
            title="Twitch"
            description={twitchUsername ? `@${twitchUsername} · Чат, награды, подписки` : 'Чат, награды, подписки'}
            status={twitchConnected ? 'connected' : 'disconnected'}
            onClick={() => setActivePopup('twitch')}
          />

          {/* 2. Kick */}
          <ConnectionRow
            title="Kick"
            description={
              isKickConnected
                ? `Подключено: ${joinedKickChannels.map((c) => 'kick.com/' + c).join(', ')}`
                : 'Чат и события'
            }
            status={isKickConnected ? 'connected' : 'disconnected'}
            onClick={() => setActivePopup('kick')}
          />

          {/* 3. DonationAlerts */}
          <ConnectionRow
            title="DonationAlerts"
            description="Донаты и цели"
            status={daEnabled && Boolean(daToken) ? 'connected' : 'pending'}
            onClick={() => setActivePopup('donationalerts')}
          />

          {/* 4. OBS Studio */}
          <ConnectionRow
            title="OBS Studio"
            description={
              isObsConnected
                ? `Подключено (${obsState.host}:${obsState.port}) · ${obsState.isStreaming ? 'Эфир идет' : 'В ожидании'}`
                : 'Нужен пароль WebSocket'
            }
            status={isObsConnected ? 'connected' : 'pending'}
            onClick={() => setActivePopup('obs')}
          />
        </div>
      </div>

      {/* Twitch Popup */}
      {activePopup === 'twitch' && (
        <Modal
          title="Настройки Twitch"
          description="Авторизация аккаунта и права доступа к чату"
          icon={<TwitchIcon className="w-5 h-5 fill-current" />}
          onClose={closePopup}
        >
          <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#1E212B] p-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#9146FF]/20 text-[#9146FF]">
              <TwitchIcon className="w-5 h-5 fill-current" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-[#EDEEF2] text-sm">
                {twitchUsername ? `@${twitchUsername}` : 'Аккаунт Twitch'}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[#A0A4B4]">
                <StatusDot status={twitchConnected ? 'connected' : 'disconnected'} />
                {twitchConnected ? 'Авторизация выполнена' : 'Требуется авторизация'}
              </p>
            </div>
          </div>

          {twitchConnected && twitchAuthStatus && !hasFollowerScope && (
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3.5 flex items-start gap-2.5">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-300" />
              <div>
                <p className="text-xs font-bold text-amber-200">
                  Не хватает разрешения на фолловеров
                </p>
                <p className="mt-0.5 text-xs text-[#A0A4B4] leading-relaxed">
                  Для отображения новых фолловеров требуется разрешение moderator:read:followers.
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleAuth}
              disabled={isAuthenticating}
              className="flex-1 py-2.5 bg-[#7CF2C8] text-[#0E0F13] font-bold rounded-xl text-xs hover:bg-[#9af7d8] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isAuthenticating ? <Loader2 size={16} className="animate-spin" /> : <Radio size={16} />}
              {isAuthenticating ? 'Подключение...' : twitchConnected ? 'Авторизоваться повторно' : 'Подключить Twitch'}
            </button>
            {twitchConnected && (
              <button
                type="button"
                onClick={handleLogout}
                disabled={isAuthenticating}
                className="px-4 py-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 font-bold rounded-xl text-xs hover:bg-rose-500/20 transition cursor-pointer"
              >
                Отключить
              </button>
            )}
          </div>
        </Modal>
      )}

      {/* Kick Popup */}
      {activePopup === 'kick' && (
        <Modal
          title="Настройки Kick"
          description="Подключение к каналам и чатам платформы Kick"
          icon={<KickIcon className="w-5 h-5" />}
          onClose={closePopup}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#1E212B] p-3.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#53FC18]/15 text-[#53FC18]">
                <KickIcon className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[#EDEEF2] text-sm">Мультичат Kick</p>
                <p className="mt-0.5 text-xs text-[#A0A4B4]">
                  WebSocket Pusher · Без ввода пароля
                </p>
              </div>
            </div>

            <div>
              <label className="text-[#A0A4B4] font-medium block mb-1">
                Подключить канал Kick
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Имя стримера на Kick"
                  value={kickInput}
                  onChange={(e) => setKickInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && kickInput.trim() && handleAddKickChannel) {
                      e.preventDefault();
                      handleAddKickChannel(kickInput.trim());
                      setKickInput('');
                    }
                  }}
                  className="flex-1 bg-[#1E212B] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-[#EDEEF2] outline-none focus:border-[#7CF2C8]"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (kickInput.trim() && handleAddKickChannel) {
                      handleAddKickChannel(kickInput.trim());
                      setKickInput('');
                    }
                  }}
                  className="px-4 bg-[#7CF2C8] text-[#0E0F13] font-bold rounded-xl text-xs hover:bg-[#9af7d8] transition cursor-pointer"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {joinedKickChannels && joinedKickChannels.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[#A0A4B4] text-[11px] block">Активные каналы Kick:</span>
                <div className="space-y-1">
                  {joinedKickChannels.map((ch) => (
                    <div
                      key={ch}
                      className="flex items-center justify-between p-2 px-3 rounded-lg bg-[#1E212B] border border-white/[0.04]"
                    >
                      <span className="font-bold text-[#EDEEF2]">kick.com/{ch}</span>
                      {handleRemoveKickChannel && (
                        <button
                          type="button"
                          onClick={() => handleRemoveKickChannel(ch)}
                          className="text-[#6B7080] hover:text-rose-400 p-1 cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* DonationAlerts Popup */}
      {activePopup === 'donationalerts' && (
        <Modal
          title="Настройки DonationAlerts"
          description="Управление API-токеном и проверка оповещений"
          icon={<Coins size={22} />}
          onClose={closePopup}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/[0.06] bg-[#1E212B]">
              <div>
                <p className="font-bold text-[#EDEEF2]">Интеграция DonationAlerts</p>
                <p className="text-xs text-[#A0A4B4]">Включить сбор донатов и шкалу</p>
              </div>
              <button
                type="button"
                onClick={() => updateAndSave('daEnabled', !daEnabled)}
                className={`relative h-6 w-11 rounded-full transition cursor-pointer ${
                  daEnabled ? 'bg-[#7CF2C8]' : 'bg-[#414655]'
                }`}
              >
                <span
                  className={`absolute top-1 h-4 w-4 rounded-full transition ${
                    daEnabled ? 'left-6 bg-[#0E0F13]' : 'left-1 bg-white'
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="text-[#A0A4B4] font-medium block mb-1">API-токен DonationAlerts</label>
              <div className="flex gap-2">
                <input
                  type={showDAToken ? 'text' : 'password'}
                  value={daToken}
                  onChange={(e) => updateAndSave('daToken', e.target.value)}
                  placeholder="Вставьте токен DonationAlerts"
                  className="flex-1 bg-[#1E212B] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-[#EDEEF2] outline-none focus:border-[#7CF2C8]"
                />
                <button
                  type="button"
                  onClick={() => setShowDAToken(!showDAToken)}
                  className="w-11 flex items-center justify-center rounded-xl border border-white/[0.08] bg-[#1E212B] text-[#A0A4B4] hover:text-white cursor-pointer"
                >
                  {showDAToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => BrowserOpenURL('https://www.donationalerts.com/dashboard/general-settings')}
                className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-[#7CF2C8] hover:underline"
              >
                Где получить токен DonationAlerts <ExternalLink size={12} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleSendTestDonation}
                disabled={!daEnabled || isTestingDonation}
                className="py-2.5 bg-[#1E212B] hover:bg-[#282C38] border border-white/[0.08] text-[#EDEEF2] font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-2"
              >
                {isTestingDonation ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                Тестовый донат
              </button>
              <button
                type="button"
                onClick={handleSendTestGoal}
                disabled={!daEnabled || isTestingGoal}
                className="py-2.5 bg-[#1E212B] hover:bg-[#282C38] border border-white/[0.08] text-[#EDEEF2] font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-2"
              >
                {isTestingGoal ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                Тестовая цель
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* OBS Studio Popup */}
      {activePopup === 'obs' && (
        <Modal
          title="Подключение OBS Studio"
          description="Передача статуса стрима, битрейта, FPS и управление сценами на главной странице"
          icon={<Tv size={22} />}
          onClose={closePopup}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#1E212B] p-3.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FFB84D]/20 text-[#FFB84D]">
                <Tv size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[#EDEEF2] text-sm">
                  {obsState.isConnected ? 'Подключено к OBS Studio' : 'OBS WebSocket v5'}
                </p>
                <p className="mt-0.5 text-xs text-[#A0A4B4] flex items-center gap-1.5">
                  <StatusDot status={obsState.isConnected ? 'connected' : 'pending'} />
                  {obsState.isConnected
                    ? `Сцена: ${obsState.currentScene || 'Основная'} · ${obsState.activeFps} FPS`
                    : 'Ожидание соединения'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[#A0A4B4] font-medium block mb-1">Хост / IP</label>
                <input
                  type="text"
                  value={obsHostInput}
                  onChange={(e) => setObsHostInput(e.target.value)}
                  placeholder="127.0.0.1"
                  className="w-full bg-[#1E212B] border border-white/[0.08] rounded-xl px-3 py-2 text-[#EDEEF2] outline-none focus:border-[#7CF2C8]"
                />
              </div>
              <div>
                <label className="text-[#A0A4B4] font-medium block mb-1">Порт WebSocket</label>
                <input
                  type="text"
                  value={obsPortInput}
                  onChange={(e) => setObsPortInput(e.target.value)}
                  placeholder="4455"
                  className="w-full bg-[#1E212B] border border-white/[0.08] rounded-xl px-3 py-2 text-[#EDEEF2] outline-none focus:border-[#7CF2C8]"
                />
              </div>
            </div>

            <div>
              <label className="text-[#A0A4B4] font-medium block mb-1">
                Пароль сервера (если задан в OBS)
              </label>
              <input
                type="password"
                placeholder="Оставьте пустым, если пароль выключен"
                value={obsPassInput}
                onChange={(e) => setObsPassInput(e.target.value)}
                className="w-full bg-[#1E212B] border border-white/[0.08] rounded-xl px-3 py-2 text-[#EDEEF2] outline-none focus:border-[#7CF2C8]"
              />
            </div>

            <div className="rounded-xl border border-white/[0.04] bg-[#1E212B]/60 p-3 text-[11px] text-[#A0A4B4] leading-relaxed">
              Включите сервер в OBS Studio: <b>Инструменты</b> → <b>Настройки сервера WebSocket</b> → Отметьте <i>«Включить сервер WebSocket»</i> (порт по умолчанию 4455).
            </div>

            <div className="flex gap-2 pt-1">
              {obsState.isConnected ? (
                <button
                  type="button"
                  onClick={handleDisconnectOBS}
                  className="flex-1 py-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 font-bold rounded-xl text-xs hover:bg-rose-500/20 transition cursor-pointer"
                >
                  Отключить OBS
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectOBS}
                  disabled={isConnectingObs}
                  className="flex-1 py-2.5 bg-[#7CF2C8] text-[#0E0F13] font-bold rounded-xl text-xs hover:bg-[#9af7d8] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isConnectingObs ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <RefreshCw size={16} />
                  )}
                  {isConnectingObs ? 'Подключение...' : 'Подключить OBS WebSocket'}
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
