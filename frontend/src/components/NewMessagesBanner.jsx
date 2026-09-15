import React from 'react';
import { ArrowDown } from 'lucide-react';

export default function NewMessagesBanner({ unreadCount, onClick }) {
  if (unreadCount <= 0) return null;

  return (
    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#9146FF] hover:bg-[#7E22CE] text-white text-xs font-medium font-sans shadow-lg shadow-purple-950/60 border border-purple-400/30 transition-all hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-sm"
      >
        <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
        <span>
          {unreadCount === 1 ? '1 новое сообщение' : `${unreadCount} новых сообщений`}
        </span>
      </button>
    </div>
  );
}
