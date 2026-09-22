import React from 'react';
import TwitchIcon from './TwitchIcon';
import KickIcon from './KickIcon';
import TwitchBadge from './TwitchBadge';
import EmoteText from './EmoteText';
import { getChannelColor, getTwitchIconColor } from '../utils/channelColors';
import {
  Crown,
  Gift,
  Zap,
  Sparkles,
  Megaphone,
  ShieldAlert,
  Flame,
  UserCheck,
  Info,
  Heart,
  Radio,
  Share2,
  TrendingUp,
  AlertTriangle,
  Star,
  DollarSign,
  Coins,
  Smile,
} from 'lucide-react';

export default function InlineEventMessage({
  msg,
  emoteMap = {},
  dynamicBadges = {},
  settings = {},
}) {
  if (!msg) return null;

  const {
    eventType = 'notice',
    channel,
    user,
    displayName,
    color,
    message,
    timestamp,
    systemMsg,
    badges,
    eventData = {},
  } = msg;

  const isOwn =
    settings.username &&
    channel &&
    channel.toLowerCase() === settings.username.toLowerCase();
  const chTheme = getChannelColor(channel, settings.channelColors, isOwn);
  const iconFill = getTwitchIconColor(settings.iconColor, chTheme.accent);

  // Unified Dark Stream Companion design configurations for all events
  let config = {
    label: 'СОБЫТИЕ',
    icon: Info,
    bg: 'bg-gradient-to-r from-[#242631] via-[#20222d] to-[#1a1b24]',
    border: 'border-[#2C2E3C]',
    accent: '#6C7082',
    badgeBg: 'bg-[#181920]/80',
    badgeBorder: 'border-white/[0.12]',
    badgeText: 'text-[#ECECF1]',
  };

  switch (eventType) {
    // 👑 Monetization: Subscriptions
    case 'sub':
    case 'resub':
    case 'channel.subscribe':
    case 'channel.subscription.message':
      config = {
        label:
          eventType.includes('resub') || eventType.includes('message')
            ? 'ПЕРЕПОДПИСКА'
            : 'НОВАЯ ПОДПИСКА',
        icon: Crown,
        bg: 'bg-gradient-to-r from-[#281b36]/90 via-[#221f2e]/70 to-[#242631]/90',
        border: 'border-purple-500/25',
        accent: '#c084fc',
        badgeBg: 'bg-purple-950/70',
        badgeBorder: 'border-purple-500/40',
        badgeText: 'text-purple-300',
      };
      break;

    // 🎁 Monetization: Gift Subs
    case 'subgift':
    case 'anonsubgift':
    case 'submysterygift':
    case 'giftpaidupgrade':
    case 'primepaidupgrade':
    case 'channel.subscription.gift':
      config = {
        label: eventType.includes('mystery')
          ? 'МАССОВАЯ ПОДПИСКА'
          : 'ПОДАРОЧНАЯ ПОДПИСКА',
        icon: Gift,
        bg: 'bg-gradient-to-r from-[#31172a]/90 via-[#271d2b]/70 to-[#242631]/90',
        border: 'border-pink-500/25',
        accent: '#f472b6',
        badgeBg: 'bg-pink-950/70',
        badgeBorder: 'border-pink-500/40',
        badgeText: 'text-pink-300',
      };
      break;

    // ⚡ Community: Raids
    case 'raid':
    case 'unraid':
    case 'channel.raid':
      config = {
        label: 'РЕЙД',
        icon: Zap,
        bg: 'bg-gradient-to-r from-[#32171b]/90 via-[#291b22]/70 to-[#242631]/90',
        border: 'border-red-500/25',
        accent: '#f87171',
        badgeBg: 'bg-red-950/70',
        badgeBorder: 'border-red-500/40',
        badgeText: 'text-red-300',
      };
      break;

    // 💎 Monetization: Cheer & Bits
    case 'cheer':
    case 'bitsbadgetier':
    case 'channel.cheer':
    case 'extension.bits_transaction.create':
      config = {
        label: eventData.bits ? `${eventData.bits} BITS` : 'ДОНАТ BITS',
        icon: Sparkles,
        bg: 'bg-gradient-to-r from-[#2d2212]/90 via-[#262020]/70 to-[#242631]/90',
        border: 'border-amber-500/25',
        accent: '#fbbf24',
        badgeBg: 'bg-amber-950/70',
        badgeBorder: 'border-amber-500/40',
        badgeText: 'text-amber-300',
      };
      break;

    // 📢 Chat: Announcements
    case 'announcement':
    case 'channel.chat.notification':
      config = {
        label: 'ОБЪЯВЛЕНИЕ',
        icon: Megaphone,
        bg: 'bg-gradient-to-r from-[#11272c]/90 via-[#182329]/70 to-[#242631]/90',
        border: 'border-cyan-500/25',
        accent: '#22d3ee',
        badgeBg: 'bg-cyan-950/70',
        badgeBorder: 'border-cyan-500/40',
        badgeText: 'text-cyan-300',
      };
      break;

    // 🪙 Channel Points: Rewards & Redemptions
    case 'reward':
    case 'channel.channel_points_custom_reward_redemption.add':
      config = {
        label: 'ЗАКАЗ ЗА БАЛЛЫ',
        icon: Coins,
        bg: 'bg-gradient-to-r from-[#122822]/90 via-[#1b252a]/70 to-[#242631]/90',
        border: 'border-emerald-500/30',
        accent: '#10b981',
        badgeBg: 'bg-emerald-950/80',
        badgeBorder: 'border-emerald-500/45',
        badgeText: 'text-emerald-300',
        isReward: true,
      };
      break;

    // ✨ Highlighted Message
    case 'highlighted':
      config = {
        label: 'ВЫДЕЛЕННОЕ СООБЩЕНИЕ',
        icon: Sparkles,
        bg: 'bg-gradient-to-r from-[#251b32]/90 via-[#221f2d]/70 to-[#242631]/90',
        border: 'border-purple-500/30',
        accent: '#a855f7',
        badgeBg: 'bg-purple-950/80',
        badgeBorder: 'border-purple-500/45',
        badgeText: 'text-purple-300',
        isHighlighted: true,
      };
      break;

    // ⚡ Power-ups
    case 'powerup':
    case 'channel.custom_power_up_redemption.add':
      config = {
        label: 'POWER-UP',
        icon: Zap,
        bg: 'bg-gradient-to-r from-[#11272c]/90 via-[#182329]/70 to-[#242631]/90',
        border: 'border-cyan-500/25',
        accent: '#06b6d4',
        badgeBg: 'bg-cyan-950/70',
        badgeBorder: 'border-cyan-500/40',
        badgeText: 'text-cyan-300',
      };
      break;

    // 🚂 Community: Hype Train
    case 'hypetrainpk':
    case 'hypetrainlevel':
    case 'hypetrainend':
    case 'channel.hype_train.begin':
    case 'channel.hype_train.progress':
    case 'channel.hype_train.end':
      config = {
        label: 'ХАЙП-ТРЕЙН',
        icon: Flame,
        bg: 'bg-gradient-to-r from-[#301e12]/90 via-[#272120]/70 to-[#242631]/90',
        border: 'border-orange-500/25',
        accent: '#fb923c',
        badgeBg: 'bg-orange-950/70',
        badgeBorder: 'border-orange-500/40',
        badgeText: 'text-orange-300',
      };
      break;

    // 📊 Community: Predictions & Polls
    case 'poll':
    case 'prediction':
    case 'channel.poll.begin':
    case 'channel.poll.end':
    case 'channel.prediction.begin':
    case 'channel.prediction.end':
    case 'channel.prediction.lock':
      config = {
        label: eventType.includes('prediction') ? 'ПРОГНОЗ' : 'ОПРОС',
        icon: TrendingUp,
        bg: 'bg-gradient-to-r from-[#1b1c36]/90 via-[#1f202c]/70 to-[#242631]/90',
        border: 'border-indigo-500/25',
        accent: '#818cf8',
        badgeBg: 'bg-indigo-950/70',
        badgeBorder: 'border-indigo-500/40',
        badgeText: 'text-indigo-300',
      };
      break;

    // 📣 Community: Shoutouts
    case 'shoutout':
    case 'channel.shoutout.create':
    case 'channel.shoutout.receive':
      config = {
        label: 'ШАУТАУТ',
        icon: Share2,
        bg: 'bg-gradient-to-r from-[#102927]/90 via-[#192527]/70 to-[#242631]/90',
        border: 'border-teal-500/25',
        accent: '#2dd4bf',
        badgeBg: 'bg-teal-950/70',
        badgeBorder: 'border-teal-500/40',
        badgeText: 'text-teal-300',
      };
      break;

    // 🛡️ Moderation: Ban & Timeout
    case 'timeout':
    case 'ban':
    case 'unban':
    case 'clearchat':
    case 'deletemsg':
    case 'channel.ban':
    case 'channel.unban':
    case 'channel.chat.clear':
    case 'channel.chat.clear_user_messages':
      config = {
        label:
          eventType === 'timeout'
            ? 'ТАЙМАУТ'
            : eventType === 'ban' || eventType === 'channel.ban'
            ? 'БАН'
            : eventType === 'unban' || eventType === 'channel.unban'
            ? 'РАЗБАН'
            : eventType === 'deletemsg' || eventType === 'channel.chat.clear_user_messages'
            ? 'УДАЛЕНИЕ'
            : 'ОЧИСТКА ЧАТА',
        icon: ShieldAlert,
        bg: 'bg-gradient-to-r from-[#33151b]/90 via-[#291a20]/70 to-[#242631]/90',
        border: 'border-rose-500/25',
        accent: '#f43f5e',
        badgeBg: 'bg-rose-950/70',
        badgeBorder: 'border-rose-500/40',
        badgeText: 'text-rose-300',
      };
      break;

    // 🎖️ Moderation: Mod / VIP role changes
    case 'channel.moderator.add':
    case 'channel.moderator.remove':
    case 'channel.vip.add':
    case 'channel.vip.remove':
      config = {
        label: eventType.includes('moderator') ? 'МОДЕРАТОР' : 'VIP СТАТУС',
        icon: Star,
        bg: 'bg-gradient-to-r from-[#1d2915]/90 via-[#1f2520]/70 to-[#242631]/90',
        border: 'border-lime-500/25',
        accent: '#a3e635',
        badgeBg: 'bg-lime-950/70',
        badgeBorder: 'border-lime-500/40',
        badgeText: 'text-lime-300',
      };
      break;

    // 💚 Follows
    case 'follow':
    case 'channel.follow':
      config = {
        label: 'НОВЫЙ ФОЛЛОВЕР',
        icon: Heart,
        bg: 'bg-gradient-to-r from-[#14291e]/90 via-[#1a2525]/70 to-[#242631]/90',
        border: 'border-emerald-500/25',
        accent: '#4ade80',
        badgeBg: 'bg-emerald-950/70',
        badgeBorder: 'border-emerald-500/40',
        badgeText: 'text-emerald-300',
      };
      break;

    // 🔴 Stream Status
    case 'stream.online':
    case 'stream.offline':
      config = {
        label: eventType.includes('online') ? 'СТРИМ ОНЛАЙН' : 'СТРИМ ОФФЛАЙН',
        icon: Radio,
        bg: eventType.includes('online')
          ? 'bg-gradient-to-r from-[#32171b]/90 via-[#291b22]/70 to-[#242631]/90'
          : 'bg-[#242631]/80',
        border: eventType.includes('online')
          ? 'border-red-500/30'
          : 'border-[#2C2E3C]',
        accent: eventType.includes('online') ? '#ef4444' : '#6C7082',
        badgeBg: eventType.includes('online') ? 'bg-red-950/70' : 'bg-[#181920]/80',
        badgeBorder: eventType.includes('online')
          ? 'border-red-500/40'
          : 'border-white/[0.12]',
        badgeText: eventType.includes('online') ? 'text-red-300' : 'text-[#6C7082]',
      };
      break;

    // 💰 Monetization: DonationAlerts
    case 'donation':
    case 'donationalerts': {
      const numAmount = parseFloat(eventData?.amount || 0);
      const isBig = numAmount >= 500;
      config = {
        label: eventData?.formattedAmount ? `ДОНАТ ${eventData.formattedAmount}` : 'ДОНАТ',
        icon: Coins,
        bg: isBig
          ? 'bg-gradient-to-r from-[#391228]/95 via-[#2b172a]/85 to-[#1c1822]/90'
          : 'bg-gradient-to-r from-[#2f220c]/95 via-[#261f17]/85 to-[#1c1a20]/90',
        border: isBig ? 'border-pink-500/35' : 'border-amber-500/35',
        accent: isBig ? '#ec4899' : '#f59e0b',
        badgeBg: isBig ? 'bg-pink-950/80' : 'bg-amber-950/80',
        badgeBorder: isBig ? 'border-pink-500/50' : 'border-amber-500/50',
        badgeText: isBig ? 'text-pink-300' : 'text-amber-300',
        isDonation: true,
        isBigDonation: isBig,
      };
      break;
    }

    // 🎗️ Charity Campaign
    case 'charitydonation':
    case 'channel.charity_campaign.donate':
      config = {
        label: 'БЛАГОТВОРИТЕЛЬНОСТЬ',
        icon: DollarSign,
        bg: 'bg-gradient-to-r from-[#2b2413]/90 via-[#252220]/70 to-[#242631]/90',
        border: 'border-yellow-500/25',
        accent: '#facc15',
        badgeBg: 'bg-yellow-950/70',
        badgeBorder: 'border-yellow-500/40',
        badgeText: 'text-yellow-300',
      };
      break;

    // 👋 First Message / User Intro
    case 'intro':
      config = {
        label: 'ПЕРВОЕ СООБЩЕНИЕ',
        icon: UserCheck,
        bg: 'bg-gradient-to-r from-[#281934]/95 via-[#231b2c]/80 to-[#242631]/90',
        border: 'border-[#D946EF]/30',
        accent: '#d946ef',
        badgeBg: 'bg-[#281934]',
        badgeBorder: 'border-[#D946EF]/50',
        badgeText: 'text-pink-300',
      };
      break;

    // ⚠️ Warnings & Suspicious User
    case 'channel.warning.acknowledge':
    case 'channel.suspicious_user.message':
      config = {
        label: 'ПРЕДУПРЕЖДЕНИЕ',
        icon: AlertTriangle,
        bg: 'bg-gradient-to-r from-[#2e1f14]/90 via-[#262020]/70 to-[#242631]/90',
        border: 'border-amber-500/25',
        accent: '#f59e0b',
        badgeBg: 'bg-amber-950/70',
        badgeBorder: 'border-amber-500/40',
        badgeText: 'text-amber-300',
      };
      break;

    default:
      break;
  }

  const IconComp = config.icon;

  // Reward cost and title extraction
  const rewardCost = eventData?.rewardCost;
  const rewardTitle = eventData?.rewardTitle;

  return (
    <div
      className={`my-1.5 p-3 rounded-lg border ${config.border} ${config.bg} shadow-sm transition-all select-text`}
      style={{ borderLeftColor: config.accent, borderLeftWidth: '3.5px' }}
    >
      {/* Event Header Banner */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        {/* Platform Badge */}
        {config.isDonation ? (
          <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-[4px] bg-gradient-to-tr from-amber-500 to-orange-500 shadow-xs select-none shrink-0" title="DonationAlerts">
            <Coins className="w-2.5 h-2.5 text-white" />
          </span>
        ) : eventData?.platform === 'kick' || msg?.platform === 'kick' ? (
          <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-[4px] bg-[#53FC18] shadow-xs select-none shrink-0" title="Kick">
            <KickIcon className="w-2.5 h-2.5 text-black fill-black" />
          </span>
        ) : (
          <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-[4px] bg-[#9146FF] shadow-xs select-none shrink-0" title="Twitch">
            <TwitchIcon className="w-2.5 h-2.5 text-white fill-white" />
          </span>
        )}

        {/* Timestamp */}
        {settings.showTimestamps && timestamp && (
          <span className="text-[11px] font-mono text-[#6C7082] select-none tabular-nums">
            [{settings.timestampFormat === 'HH:MM' ? String(timestamp).slice(0, 5) : String(timestamp)}]
          </span>
        )}

        {/* Channel Badge (if not generic donations) */}
        {channel && channel !== 'donations' && (
          <span
            style={{
              backgroundColor: chTheme.bg,
              borderColor: chTheme.border,
              color: chTheme.text,
            }}
            className="px-1.5 py-0.5 border rounded text-[10px] font-mono font-medium flex items-center gap-1 shrink-0"
          >
            <span>#{channel}</span>
          </span>
        )}

        {/* Event Type Badge */}
        <span
          className={`px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold tracking-wide flex items-center gap-1 shrink-0 ${config.badgeBg} ${config.badgeBorder} ${config.badgeText}`}
        >
          <IconComp className="w-3 h-3" />
          <span>{config.label}</span>
        </span>

        {/* User Badges */}
        {settings.showBadges && badges && (
          <TwitchBadge badgeTag={badges} dynamicBadges={dynamicBadges} />
        )}

        {/* User Name */}
        {displayName && (
          <span
            className="font-bold text-xs font-sans truncate"
            style={{ color: color || '#ECECF1' }}
          >
            @{displayName}
          </span>
        )}
      </div>

      {/* Specific Channel Points Reward details pill if available */}
      {config.isReward && (rewardCost || rewardTitle) && (
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {rewardCost && (
            <span className="text-[11px] font-mono text-emerald-300 font-semibold bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
              <Coins className="w-3 h-3 text-emerald-400" />
              <span>{rewardCost} баллов</span>
            </span>
          )}
          {rewardTitle && (
            <span className="text-xs text-emerald-100 font-medium font-sans">
              «{rewardTitle}»
            </span>
          )}
        </div>
      )}

      {/* System Event Summary Line */}
      {(systemMsg || (!message && config.isReward)) && (
        <div className="text-xs text-[#ECECF1] font-sans font-medium mt-1.5 leading-relaxed flex items-center gap-1.5">
          <span>
            {systemMsg ||
              (config.isReward
                ? `Пользователь @${displayName || user} использовал баллы канала`
                : '')}
          </span>
        </div>
      )}

      {/* Attached User Message (e.g. Channel Points custom order prompt or resub message) */}
      {message && (
        <div
          className={`mt-2 p-2.5 rounded-md ${
            config.isDonation
              ? (config.isBigDonation ? 'bg-[#291024]/95 border border-pink-500/35 text-[#FDF2F8]' : 'bg-[#241a0b]/95 border border-amber-500/35 text-[#FEF3C7]')
              : config.isReward
              ? 'bg-[#0e1b17]/95 border border-emerald-500/25 text-[#ECFDF5]'
              : config.isHighlighted
              ? 'bg-[#181324]/95 border border-purple-500/25 text-[#F3E8FF]'
              : 'bg-[#181920]/95 border border-white/[0.08] text-[#ECECF1]'
          } font-sans leading-relaxed shadow-inner break-words`}
        >
          {config.isReward && (
            <div className="text-[10px] font-mono text-emerald-400/80 uppercase tracking-wider mb-1 flex items-center gap-1 font-semibold select-none">
              <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
              <span>Текст заказа:</span>
            </div>
          )}
          {config.isDonation && (
            <div className={`text-[10px] font-mono ${config.isBigDonation ? 'text-pink-400' : 'text-amber-400'} uppercase tracking-wider mb-1 flex items-center gap-1 font-semibold select-none`}>
              <Coins className="w-2.5 h-2.5" />
              <span>Сообщение донатера:</span>
            </div>
          )}
          <div className={config.isDonation || config.isReward || config.isHighlighted ? 'text-sm font-medium' : 'text-xs'}>
            <EmoteText
              text={message}
              emoteMap={emoteMap}
              twitchEmoteMap={msg.emoteMap}
            />
          </div>
        </div>
      )}
    </div>
  );
}
