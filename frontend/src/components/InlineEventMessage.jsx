import React from 'react';
import TwitchIcon from './TwitchIcon';
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
  Award,
  Flame,
  UserCheck,
  Info,
  Heart,
  Radio,
  Share2,
  TrendingUp,
  HelpCircle,
  AlertTriangle,
  Star,
  Shield,
  DollarSign,
  Tv,
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

  // Complete styling configuration for all Twitch EventSub & IRC events
  let config = {
    label: 'EVENT',
    icon: Info,
    bg: 'bg-white/[0.04]',
    border: 'border-white/[0.08]',
    accent: '#8c93a4',
    text: 'text-[#f1f3f7]',
  };

  switch (eventType) {
    // 👑 Monetization: Subscriptions
    case 'sub':
    case 'resub':
    case 'channel.subscribe':
    case 'channel.subscription.message':
      config = {
        label: eventType.includes('resub') || eventType.includes('message') ? 'RESUB' : 'NEW SUB',
        icon: Crown,
        bg: 'bg-purple-950/40',
        border: 'border-purple-800/60',
        accent: '#a855f7',
        text: 'text-purple-300',
      };
      break;

    // 🎁 Monetization: Gift Subs & Mystery Gifts
    case 'subgift':
    case 'anonsubgift':
    case 'submysterygift':
    case 'giftpaidupgrade':
    case 'primepaidupgrade':
    case 'channel.subscription.gift':
      config = {
        label: eventType.includes('mystery') ? 'MASS GIFT SUB' : 'GIFT SUB',
        icon: Gift,
        bg: 'bg-pink-950/40',
        border: 'border-pink-800/60',
        accent: '#ec4899',
        text: 'text-pink-300',
      };
      break;

    // 🚀 Community: Raids
    case 'raid':
    case 'unraid':
    case 'channel.raid':
      config = {
        label: 'RAID',
        icon: Zap,
        bg: 'bg-red-950/40',
        border: 'border-red-800/60',
        accent: '#ef4444',
        text: 'text-red-300',
      };
      break;

    // 💎 Monetization: Cheer & Bits
    case 'cheer':
    case 'bitsbadgetier':
    case 'channel.cheer':
    case 'extension.bits_transaction.create':
      config = {
        label: eventData.bits ? `${eventData.bits} BITS` : 'CHEER',
        icon: Sparkles,
        bg: 'bg-amber-950/40',
        border: 'border-amber-800/60',
        accent: '#f59e0b',
        text: 'text-amber-300',
      };
      break;

    // 📢 Chat: Announcements
    case 'announcement':
    case 'channel.chat.notification':
      config = {
        label: 'ANNOUNCEMENT',
        icon: Megaphone,
        bg: 'bg-cyan-950/40',
        border: 'border-cyan-800/60',
        accent: '#06b6d4',
        text: 'text-cyan-300',
      };
      break;

    // 🏆 Channel Points & Power-ups
    case 'reward':
    case 'powerup':
    case 'highlighted':
    case 'channel.channel_points_custom_reward_redemption.add':
    case 'channel.custom_power_up_redemption.add':
      config = {
        label: eventType === 'reward' ? 'CHANNEL POINTS' : eventType === 'powerup' ? 'POWER-UP' : 'HIGHLIGHT',
        icon: Award,
        bg: 'bg-emerald-950/40',
        border: 'border-emerald-800/60',
        accent: '#10b981',
        text: 'text-emerald-300',
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
        label: 'HYPE TRAIN',
        icon: Flame,
        bg: 'bg-orange-950/40',
        border: 'border-orange-800/60',
        accent: '#f97316',
        text: 'text-orange-300',
      };
      break;

    // 🔮 Community: Predictions & Polls
    case 'poll':
    case 'prediction':
    case 'channel.poll.begin':
    case 'channel.poll.end':
    case 'channel.prediction.begin':
    case 'channel.prediction.end':
    case 'channel.prediction.lock':
      config = {
        label: eventType.includes('prediction') ? 'PREDICTION' : 'POLL',
        icon: TrendingUp,
        bg: 'bg-violet-950/40',
        border: 'border-violet-800/60',
        accent: '#8b5cf6',
        text: 'text-violet-300',
      };
      break;

    // 📣 Community: Shoutouts
    case 'shoutout':
    case 'channel.shoutout.create':
    case 'channel.shoutout.receive':
      config = {
        label: 'SHOUTOUT',
        icon: Share2,
        bg: 'bg-teal-950/40',
        border: 'border-teal-800/60',
        accent: '#14b8a6',
        text: 'text-teal-300',
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
        label: eventType === 'timeout' ? 'TIMEOUT' : eventType === 'ban' ? 'BAN' : 'MODERATION',
        icon: ShieldAlert,
        bg: 'bg-rose-950/40',
        border: 'border-rose-800/60',
        accent: '#f43f5e',
        text: 'text-rose-300',
      };
      break;

    // 🎖️ Moderation: Mod / VIP role changes
    case 'channel.moderator.add':
    case 'channel.moderator.remove':
    case 'channel.vip.add':
    case 'channel.vip.remove':
      config = {
        label: eventType.includes('moderator') ? 'MODERATOR' : 'VIP STATUS',
        icon: Star,
        bg: 'bg-lime-950/40',
        border: 'border-lime-800/60',
        accent: '#84cc16',
        text: 'text-lime-300',
      };
      break;

    // 💚 Follows
    case 'follow':
    case 'channel.follow':
      config = {
        label: 'NEW FOLLOWER',
        icon: Heart,
        bg: 'bg-emerald-950/40',
        border: 'border-emerald-800/60',
        accent: '#22c55e',
        text: 'text-emerald-300',
      };
      break;

    // 🔴 Stream Status
    case 'stream.online':
    case 'stream.offline':
      config = {
        label: eventType.includes('online') ? 'STREAM LIVE' : 'STREAM OFFLINE',
        icon: Radio,
        bg: eventType.includes('online') ? 'bg-red-950/40' : 'bg-zinc-900/60',
        border: eventType.includes('online') ? 'border-red-800/60' : 'border-zinc-800/60',
        accent: eventType.includes('online') ? '#ef4444' : '#71717a',
        text: eventType.includes('online') ? 'text-red-300' : 'text-zinc-400',
      };
      break;

    // 🎗️ Charity Campaign
    case 'charitydonation':
    case 'channel.charity_campaign.donate':
      config = {
        label: 'CHARITY DONATION',
        icon: DollarSign,
        bg: 'bg-yellow-950/40',
        border: 'border-yellow-800/60',
        accent: '#eab308',
        text: 'text-yellow-300',
      };
      break;

    // 👋 First Message / User Intro
    case 'intro':
      config = {
        label: 'FIRST MESSAGE',
        icon: UserCheck,
        bg: 'bg-indigo-950/40',
        border: 'border-indigo-800/60',
        accent: '#6366f1',
        text: 'text-indigo-300',
      };
      break;

    // ⚠️ Warnings & Suspicious User
    case 'channel.warning.acknowledge':
    case 'channel.suspicious_user.message':
      config = {
        label: 'CHANNEL WARNING',
        icon: AlertTriangle,
        bg: 'bg-amber-950/40',
        border: 'border-amber-800/60',
        accent: '#d97706',
        text: 'text-amber-300',
      };
      break;

    default:
      break;
  }

  const IconComp = config.icon;

  return (
    <div
      className={`my-1 p-2 rounded-md border ${config.bg} ${config.border} transition-colors select-text`}
      style={{ borderLeftColor: config.accent, borderLeftWidth: '3px' }}
    >
      {/* Event Header Banner */}
      <div className="flex items-center gap-1.5 flex-wrap text-xs">
        {/* Timestamp */}
        {settings.showTimestamps && timestamp && (
          <span className="text-[10px] font-mono text-[#525866] select-none">
            [{settings.timestampFormat === 'HH:MM' ? timestamp.slice(0, 5) : timestamp}]
          </span>
        )}

        {/* Channel Badge */}
        {channel && (
          <span
            style={{
              backgroundColor: chTheme.bg,
              borderColor: chTheme.border,
              color: chTheme.text,
            }}
            className="px-1.5 py-0.2 border rounded text-[10px] font-mono font-medium flex items-center gap-1 shrink-0"
          >
            <TwitchIcon className="w-2 h-2" fill={iconFill} />
            <span>#{channel}</span>
          </span>
        )}

        {/* Event Type Badge */}
        <span
          className={`px-1.5 py-0.2 rounded border text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 shrink-0 ${config.text} ${config.border} bg-[#0c0d12]/70`}
        >
          <IconComp className="w-3 h-3" />
          <span>{config.label}</span>
        </span>

        {/* Badges if present */}
        {settings.showBadges && badges && (
          <TwitchBadge badgeTag={badges} dynamicBadges={dynamicBadges} />
        )}

        {/* User Name */}
        {displayName && (
          <span
            className="font-bold text-xs font-sans truncate"
            style={{ color: color || '#f1f3f7' }}
          >
            @{displayName}
          </span>
        )}
      </div>

      {/* System Event Summary Line */}
      {systemMsg && (
        <div className="text-xs text-[#f1f3f7] font-sans font-medium mt-1 leading-relaxed">
          {systemMsg}
        </div>
      )}

      {/* User Custom / Attached Message */}
      {message && (
        <div className="text-xs text-[#d1d5db] font-mono bg-[#0c0d12]/80 p-2 rounded border border-white/[0.04] mt-1.5 leading-snug">
          <EmoteText
            text={message}
            emoteMap={emoteMap}
            twitchEmoteMap={msg.emoteMap}
          />
        </div>
      )}
    </div>
  );
}
