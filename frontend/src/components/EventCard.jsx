import React from 'react';
import TwitchIcon from './TwitchIcon';
import EmoteText from './EmoteText';
import { getChannelColor, getTwitchIconColor } from '../utils/channelColors';
import {
  Crown,
  Gift,
  Zap,
  Sparkles,
  Megaphone,
  ShieldAlert,
  Bell,
} from 'lucide-react';

export default function EventCard({ event, emoteMap = {}, settings = {} }) {
  if (!event) return null;

  const {
    type,
    channel,
    user,
    displayName,
    color,
    message,
    timestamp,
    systemMsg,
    details = {},
  } = event;

  const isOwn =
    settings.username &&
    channel &&
    channel.toLowerCase() === settings.username.toLowerCase();
  const chTheme = getChannelColor(channel, settings.channelColors, isOwn);
  const iconFill = getTwitchIconColor(settings.iconColor, chTheme.accent);

  // Determine Event Styling & Badge
  let badgeConfig = {
    label: 'EVENT',
    icon: Bell,
    bg: 'bg-white/[0.05]',
    border: 'border-white/[0.1]',
    text: 'text-[#f1f3f7]',
    accent: '#8c93a4',
  };

  switch (type) {
    case 'sub':
    case 'resub':
      badgeConfig = {
        label: type === 'resub' ? 'RESUB' : 'SUB',
        icon: Crown,
        bg: 'bg-purple-950/70',
        border: 'border-purple-800/80',
        text: 'text-purple-300',
        accent: '#c084fc',
      };
      break;
    case 'subgift':
    case 'anonsubgift':
    case 'submysterygift':
      badgeConfig = {
        label: 'GIFT SUB',
        icon: Gift,
        bg: 'bg-pink-950/70',
        border: 'border-pink-800/80',
        text: 'text-pink-300',
        accent: '#f472b6',
      };
      break;
    case 'raid':
      badgeConfig = {
        label: 'RAID',
        icon: Zap,
        bg: 'bg-red-950/70',
        border: 'border-red-800/80',
        text: 'text-red-300',
        accent: '#f87171',
      };
      break;
    case 'cheer':
      badgeConfig = {
        label: details.bits ? `${details.bits} BITS` : 'CHEER',
        icon: Sparkles,
        bg: 'bg-amber-950/70',
        border: 'border-amber-800/80',
        text: 'text-amber-300',
        accent: '#fbbf24',
      };
      break;
    case 'announcement':
      badgeConfig = {
        label: 'ANNOUNCEMENT',
        icon: Megaphone,
        bg: 'bg-cyan-950/70',
        border: 'border-cyan-800/80',
        text: 'text-cyan-300',
        accent: '#38bdf8',
      };
      break;
    case 'timeout':
    case 'ban':
      badgeConfig = {
        label: type === 'timeout' ? 'TIMEOUT' : 'BAN',
        icon: ShieldAlert,
        bg: 'bg-rose-950/70',
        border: 'border-rose-800/80',
        text: 'text-rose-300',
        accent: '#fb7185',
      };
      break;
    default:
      break;
  }

  const BadgeIcon = badgeConfig.icon;

  return (
    <div
      className={`p-2.5 rounded-lg border bg-[#13151c] transition-all hover:bg-[#161822] shadow-xs flex flex-col gap-1.5 ${badgeConfig.border}`}
      style={{ borderLeftColor: badgeConfig.accent, borderLeftWidth: '3px' }}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Timestamp */}
          {timestamp && (
            <span className="text-[10px] font-mono text-[#525866]">
              [{timestamp}]
            </span>
          )}

          {/* Channel Tag */}
          {channel && (
            <span
              style={{
                backgroundColor: chTheme.bg,
                borderColor: chTheme.border,
                color: chTheme.text,
              }}
              className="px-1.5 py-0.2 border rounded text-[10px] font-mono font-medium flex items-center gap-1"
            >
              <TwitchIcon className="w-2 h-2" fill={iconFill} />
              <span>#{channel}</span>
            </span>
          )}

          {/* Event Type Badge */}
          <span
            className={`px-1.5 py-0.2 rounded border text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 ${badgeConfig.bg} ${badgeConfig.border} ${badgeConfig.text}`}
          >
            <BadgeIcon className="w-3 h-3" />
            <span>{badgeConfig.label}</span>
          </span>

          {/* User Display Name */}
          {displayName && (
            <span
              className="font-bold text-xs font-sans truncate"
              style={{ color: color || '#f1f3f7' }}
            >
              @{displayName}
            </span>
          )}
        </div>
      </div>

      {/* System Description / Event Summary */}
      {systemMsg && (
        <div className="text-xs text-[#f1f3f7] font-sans font-medium leading-relaxed">
          {systemMsg}
        </div>
      )}

      {/* User Attached Message */}
      {message && (
        <div className="text-xs text-[#d1d5db] font-mono bg-[#0c0d12] p-2 rounded border border-white/[0.04] mt-0.5 leading-snug">
          <EmoteText text={message} emoteMap={emoteMap} />
        </div>
      )}
    </div>
  );
}
