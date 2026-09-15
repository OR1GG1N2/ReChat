import React, { useState } from 'react';
import TwitchIcon from './TwitchIcon';
import TwitchBadge from './TwitchBadge';
import EmoteText from './EmoteText';
import { Copy, Check, AtSign } from 'lucide-react';

export default function ChatMessage({
  msg,
  settings = {},
  dynamicBadges = {},
  emoteMap = {},
  onCopyUser,
}) {
  const [copied, setCopied] = useState(false);

  const isFirstMessage =
    msg.isFirstMsg ||
    (msg.eventData && msg.eventData.firstMsg === '1') ||
    msg.eventType === 'intro';

  const copyText = (e) => {
    e.stopPropagation();
    if (msg.message) {
      navigator.clipboard?.writeText(msg.message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const copyUsername = (e) => {
    e.stopPropagation();
    const uname = msg.displayName || msg.user;
    if (uname) {
      navigator.clipboard?.writeText(`@${uname}`);
      if (onCopyUser) onCopyUser(uname);
    }
  };

  const spacingClass =
    settings.messageSpacing === 'compact'
      ? 'py-0.5'
      : settings.messageSpacing === 'relaxed'
      ? 'py-2'
      : 'py-1';

  const alignClass =
    settings.textAlign === 'center'
      ? 'text-center justify-center'
      : settings.textAlign === 'right'
      ? 'text-right justify-end'
      : 'text-left justify-start';

  const fontFamily = settings.fontFamily
    ? `"${settings.fontFamily}", system-ui, sans-serif`
    : '"Lato", system-ui, sans-serif';

  const messageRow = (
    <div
      style={{
        fontSize: `${settings.fontSize || 14}px`,
        fontFamily,
      }}
      className={`group relative leading-relaxed px-2 rounded transition-colors duration-100 hover:bg-white/[0.03] break-words ${spacingClass} ${alignClass}`}
    >
      {/* Platform Icon Badge */}
      <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-[4px] bg-[#9146FF] shadow-xs mr-1.5 align-middle select-none">
        <TwitchIcon className="w-3 h-3 text-white fill-white" />
      </span>

      {/* Badges */}
      {settings.showBadges && msg.badges && (
        <span className="inline-flex items-center align-middle gap-0.5 mr-1.5 select-none">
          <TwitchBadge badgeTag={msg.badges} dynamicBadges={dynamicBadges} />
        </span>
      )}

      {/* Timestamp */}
      {settings.showTimestamps && msg.timestamp && (
        <span className="text-[#6C7082] text-[11px] font-mono select-none align-middle mr-1.5 tabular-nums">
          {settings.timestampFormat === 'HH:MM'
            ? msg.timestamp.slice(0, 5)
            : msg.timestamp}
        </span>
      )}

      {/* Username */}
      <span
        onClick={copyUsername}
        title="Нажмите для копирования @username"
        className="font-bold cursor-pointer hover:underline underline-offset-2 transition-all mr-1.5 align-baseline select-text"
        style={{ color: msg.color || '#A855F7' }}
      >
        {msg.displayName || msg.user || 'Anonymous'}:
      </span>

      {/* Message Text & Inline Emotes */}
      <span className="text-[#ECECF1] select-text align-baseline">
        <EmoteText
          text={msg.message}
          emoteMap={emoteMap}
          twitchEmoteMap={msg.emoteMap}
        />
      </span>

      {/* Micro-Actions on Hover */}
      <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 absolute right-1.5 top-1 flex items-center gap-1 bg-[#242631]/95 backdrop-blur border border-white/[0.08] px-1 py-0.5 rounded shadow-lg select-none z-10">
        <button
          type="button"
          onClick={copyText}
          title="Копировать сообщение"
          className="p-1 hover:bg-white/[0.08] text-[#9E9EB2] hover:text-[#ECECF1] rounded transition-colors"
        >
          {copied ? (
            <Check className="w-3 h-3 text-emerald-400" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
        </button>
        <button
          type="button"
          onClick={copyUsername}
          title="Копировать @ник"
          className="p-1 hover:bg-white/[0.08] text-[#9E9EB2] hover:text-[#ECECF1] rounded transition-colors"
        >
          <AtSign className="w-3 h-3" />
        </button>
      </div>
    </div>
  );

  // If this is a First Message, wrap in the special violet card from Screenshot 1
  if (isFirstMessage) {
    return (
      <div className="my-1 mx-1 rounded-lg bg-[#281934] border-l-2 border-r-2 border-[#D946EF] py-1.5 px-1 shadow-sm transition-all">
        <div className="text-[9px] font-bold tracking-widest text-[#D946EF] uppercase px-2 mb-0.5 select-none">
          FIRST MESSAGE
        </div>
        {messageRow}
      </div>
    );
  }

  return messageRow;
}
