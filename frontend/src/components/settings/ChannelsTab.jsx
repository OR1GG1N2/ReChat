import React, { useState } from 'react';
import { Plus, Trash2, Check, Radio } from 'lucide-react';
import TwitchIcon from '../TwitchIcon';
import KickIcon from '../KickIcon';

export default function ChannelsTab({
  isWide,
  channelInput,
  setChannelInput,
  handleAddChannel,
  joinedChannels = [],
  handleRemoveChannel,
  kickChannelInput,
  setKickChannelInput,
  handleAddKickChannel,
  joinedKickChannels = [],
  handleRemoveKickChannel,
}) {
  const [platformTab, setPlatformTab] = useState('twitch');

  return (
    <div className={`space-y-5 animate-fade-in ${isWide ? 'grid grid-cols-1 gap-4' : 'max-w-lg mx-auto'}`}>
      {/* Platform Switcher Tabs */}
      <div className="flex p-1 bg-[#181920] rounded-2xl border border-white/[0.04]">
        <button
          type="button"
          onClick={() => setPlatformTab('twitch')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            platformTab === 'twitch'
              ? 'bg-[#9146FF] text-white shadow-md'
              : 'text-[#8E92A4] hover:text-[#ECECF1] hover:bg-white/[0.02]'
          }`}
        >
          <TwitchIcon className="w-3.5 h-3.5 fill-current" />
          <span>Twitch Каналы</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
            platformTab === 'twitch' ? 'bg-white/20 text-white' : 'bg-white/[0.06] text-[#8E92A4]'
          }`}>
            {joinedChannels.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setPlatformTab('kick')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            platformTab === 'kick'
              ? 'bg-[#53FC18] text-black shadow-md font-bold'
              : 'text-[#8E92A4] hover:text-[#ECECF1] hover:bg-white/[0.02]'
          }`}
        >
          <KickIcon className="w-3.5 h-3.5 fill-current" />
          <span>Kick Каналы</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
            platformTab === 'kick' ? 'bg-black/20 text-black' : 'bg-white/[0.06] text-[#8E92A4]'
          }`}>
            {joinedKickChannels.length}
          </span>
        </button>
      </div>

      {platformTab === 'twitch' ? (
        /* TWITCH CHANNELS SECTION */
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5 flex items-center justify-between">
              <span>Подключение канала Twitch</span>
              <span className="text-[11px] text-[#9146FF] font-medium">Twitch IRC & EventSub</span>
            </div>
            <form
              onSubmit={handleAddChannel}
              className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] shadow-sm flex items-center gap-2"
            >
              <input
                type="text"
                value={channelInput}
                onChange={(e) => setChannelInput(e.target.value)}
                placeholder="Введите имя канала Twitch (напр. shroud)"
                className="flex-1 bg-[#181920] border border-white/[0.06] rounded-xl px-3.5 py-2 text-xs text-[#ECECF1] placeholder:text-[#6C7082] outline-none focus:border-[#9146FF]"
              />
              <button
                type="submit"
                disabled={!channelInput.trim()}
                className="px-4 py-2 bg-[#9146FF] hover:bg-[#7c2cf1] disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Добавить</span>
              </button>
            </form>
          </div>

          <div>
            <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">
              Подключенные каналы Twitch ({joinedChannels.length})
            </div>
            <div className="bg-[#242631] rounded-2xl p-3 border border-white/[0.03] shadow-sm space-y-2">
              {joinedChannels.length === 0 ? (
                <p className="text-xs text-[#8E92A4] text-center py-4">
                  Нет подключенных каналов Twitch. Добавьте канал выше.
                </p>
              ) : (
                joinedChannels.map((ch) => (
                  <div
                    key={ch}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#181920] border border-white/[0.04] hover:border-white/[0.08] transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#9146FF]/20 text-[#9146FF]">
                        <TwitchIcon className="w-3 h-3 fill-current" />
                      </span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="text-xs font-semibold text-[#ECECF1]">
                        #{ch}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveChannel(ch)}
                      className="p-1.5 text-[#8E92A4] hover:text-rose-400 hover:bg-white/[0.04] rounded-lg transition-colors cursor-pointer"
                      title="Отключить канал"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* KICK CHANNELS SECTION */
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5 flex items-center justify-between">
              <span>Подключение канала Kick</span>
              <span className="text-[11px] text-[#53FC18] font-medium">Pusher Realtime Chat</span>
            </div>
            <form
              onSubmit={handleAddKickChannel}
              className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] shadow-sm flex items-center gap-2"
            >
              <input
                type="text"
                value={kickChannelInput}
                onChange={(e) => setKickChannelInput(e.target.value)}
                placeholder="Введите имя канала Kick (напр. xqc, adinross)"
                className="flex-1 bg-[#181920] border border-white/[0.06] rounded-xl px-3.5 py-2 text-xs text-[#ECECF1] placeholder:text-[#6C7082] outline-none focus:border-[#53FC18]"
              />
              <button
                type="submit"
                disabled={!kickChannelInput.trim()}
                className="px-4 py-2 bg-[#53FC18] hover:bg-[#46db13] disabled:opacity-50 text-black text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Добавить</span>
              </button>
            </form>
          </div>

          <div>
            <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">
              Подключенные каналы Kick ({joinedKickChannels.length})
            </div>
            <div className="bg-[#242631] rounded-2xl p-3 border border-white/[0.03] shadow-sm space-y-2">
              {joinedKickChannels.length === 0 ? (
                <p className="text-xs text-[#8E92A4] text-center py-4">
                  Нет подключенных каналов Kick. Введите слаг стримера выше.
                </p>
              ) : (
                joinedKickChannels.map((ch) => (
                  <div
                    key={ch}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#181920] border border-white/[0.04] hover:border-white/[0.08] transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#53FC18]/20 text-[#53FC18]">
                        <KickIcon className="w-3 h-3 fill-current" />
                      </span>
                      <span className="w-2 h-2 rounded-full bg-[#53FC18]" />
                      <span className="text-xs font-semibold text-[#ECECF1]">
                        kick.com/{ch}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveKickChannel(ch)}
                      className="p-1.5 text-[#8E92A4] hover:text-rose-400 hover:bg-white/[0.04] rounded-lg transition-colors cursor-pointer"
                      title="Отключить Kick канал"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
