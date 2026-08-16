import React, { useState, useEffect, useRef } from 'react';
import { EventsOn } from '../wailsjs/runtime/runtime';
import { JoinChannel, LeaveChannel, GetJoinedChannels, GetSettings } from '../wailsjs/go/main/App';
import SettingsView from './components/SettingsView';

export default function App() {
  const [activeView, setActiveView] = useState('chat'); // 'chat' or 'settings'

  const [channelInput, setChannelInput] = useState('');
  const [joinedChannels, setJoinedChannels] = useState([]);
  const [status, setStatus] = useState({ status: 'disconnected', message: 'Not connected' });
  const [messages, setMessages] = useState([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [settings, setSettings] = useState({
    defaultChannel: '',
    fontSize: 14,
    showTimestamps: true,
    showBadges: true,
    maxMessages: 300,
    oauthToken: '',
    username: '',
  });

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Load initial settings & joined channels
  useEffect(() => {
    GetSettings()
      .then((loaded) => {
        if (loaded) setSettings(loaded);
      })
      .catch((err) => console.error('Failed to load settings:', err));

    GetJoinedChannels()
      .then((chans) => {
        if (chans) setJoinedChannels(chans);
      })
      .catch((err) => console.error('Failed to fetch channels:', err));
  }, []);

  // Listen for Twitch chat events, auth updates, & live settings update events
  useEffect(() => {
    const unoffStatus = EventsOn('chat:status', (data) => {
      setStatus(data);
    });

    const unoffMsg = EventsOn('chat:message', (msg) => {
      setMessages((prev) => {
        const next = [...prev, msg];
        const max = settings.maxMessages || 300;
        if (next.length > max) return next.slice(next.length - max);
        return next;
      });
    });

    const unoffSettings = EventsOn('settings:updated', (updatedSettings) => {
      setSettings(updatedSettings);
    });

    const unoffAuth = EventsOn('auth:updated', (updatedAuthSettings) => {
      setSettings((prev) => ({ ...prev, ...updatedAuthSettings }));
      // Auto-join user's own channel right after OAuth browser login!
      if (updatedAuthSettings.username) {
        JoinChannel(updatedAuthSettings.username).catch((err) =>
          console.error('Failed auto-joining own channel:', err)
        );
      }
    });

    const unoffChannels = EventsOn('channels:updated', (chans) => {
      setJoinedChannels(chans || []);
    });

    return () => {
      if (typeof unoffStatus === 'function') unoffStatus();
      if (typeof unoffMsg === 'function') unoffMsg();
      if (typeof unoffSettings === 'function') unoffSettings();
      if (typeof unoffAuth === 'function') unoffAuth();
      if (typeof unoffChannels === 'function') unoffChannels();
    };
  }, [settings.maxMessages]);

  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  const handleJoinChannel = (e) => {
    e.preventDefault();
    if (!channelInput.trim()) return;
    const target = channelInput.trim();
    JoinChannel(target)
      .then(() => setChannelInput(''))
      .catch((err) => setStatus({ status: 'error', message: String(err) }));
  };

  const handleLeaveChannel = (ch) => {
    LeaveChannel(ch).catch((err) => setStatus({ status: 'error', message: String(err) }));
  };

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 60;
    setAutoScroll(isAtBottom);
  };

  // Render Full Window Settings View
  if (activeView === 'settings') {
    return <SettingsView onClose={() => setActiveView('chat')} currentStatus={status} />;
  }

  return (
    <div
      className="flex flex-col h-screen w-full font-mono bg-neutral-900 text-neutral-200 select-none overflow-hidden"
      style={{ fontSize: `${settings.fontSize || 14}px` }}
    >
      {/* Header Bar */}
      <header className="p-3 border-b border-neutral-800 flex flex-col gap-2 bg-neutral-950">
        <div className="flex items-center gap-2">
          {/* Join Channel Form */}
          <form onSubmit={handleJoinChannel} className="flex flex-1 gap-2 items-center">
            <label htmlFor="channel-input" className="text-neutral-400 font-bold">#</label>
            <input
              id="channel-input"
              type="text"
              placeholder="Add channel (e.g. shroud, xqc)"
              value={channelInput}
              onChange={(e) => setChannelInput(e.target.value)}
              className="flex-1 px-3 py-1 bg-neutral-900 border border-neutral-700 rounded focus:outline-none focus:border-neutral-500 text-neutral-100 text-xs font-mono"
            />
            <button
              type="submit"
              className="px-3 py-1 bg-neutral-800 border border-neutral-600 text-neutral-200 rounded hover:bg-neutral-700 text-xs font-sans"
            >
              + Join Channel
            </button>
          </form>

          {/* User Auth Profile Badge */}
          {settings.username ? (
            <div
              onClick={() => setActiveView('settings')}
              title={`Authenticated as @${settings.username}`}
              className="px-2 py-1 bg-purple-950/60 border border-purple-800/80 text-purple-300 rounded text-xs cursor-pointer hover:bg-purple-900/80 transition-colors flex items-center gap-1 font-sans"
            >
              <span>👤</span>
              <span>@{settings.username}</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setActiveView('settings')}
              className="px-2 py-1 bg-neutral-800 border border-neutral-700 text-neutral-300 rounded text-xs hover:bg-neutral-700 transition-colors font-sans"
            >
              Login
            </button>
          )}

          {/* Settings Gear Button */}
          <button
            type="button"
            onClick={() => setActiveView('settings')}
            title="Open Settings"
            className="p-1.5 bg-neutral-900 border border-neutral-700 text-neutral-300 rounded hover:bg-neutral-800 hover:text-white"
          >
            ⚙
          </button>
        </div>

        {/* Active Joined Channels List */}
        {joinedChannels.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-sans pt-1 border-t border-neutral-850">
            <span className="text-neutral-500 text-[11px]">Active Channels:</span>
            {joinedChannels.map((ch) => {
              const isOwn = settings.username && ch.toLowerCase() === settings.username.toLowerCase();
              return (
                <span
                  key={ch}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs ${
                    isOwn
                      ? 'bg-purple-950/70 border-purple-800 text-purple-300 font-bold'
                      : 'bg-neutral-900 border-neutral-700 text-neutral-300'
                  }`}
                >
                  <span>#{ch}</span>
                  {isOwn && <span className="text-[10px] text-purple-400">(own)</span>}
                  <button
                    type="button"
                    onClick={() => handleLeaveChannel(ch)}
                    title={`Leave #${ch}`}
                    className="ml-1 text-neutral-400 hover:text-red-400 leading-none font-bold"
                  >
                    &times;
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </header>

      {/* Status Bar */}
      <div className="px-3 py-1 bg-neutral-950 border-b border-neutral-800 text-xs flex justify-between items-center text-neutral-400">
        <div>
          Status: <span className="font-semibold text-neutral-200">{status.status}</span>
          {status.message && <span className="ml-2 text-neutral-500">({status.message})</span>}
        </div>
        <div>Joined: {joinedChannels.length} channel(s) | Messages: {messages.length}</div>
      </div>

      {/* Message Feed */}
      <main
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 space-y-1 bg-neutral-900"
      >
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-neutral-600 italic">
            {joinedChannels.length > 0
              ? `Connected to ${joinedChannels.map((c) => '#' + c).join(', ')}. Waiting for messages...`
              : 'Join a channel above or log in to auto-connect to your channel.'}
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={msg.id || index} className="leading-relaxed break-words hover:bg-neutral-800/40 px-1 py-0.5 rounded flex items-baseline flex-wrap">
              {/* Channel Badge (Icon/Tag) */}
              {msg.channel && (
                <span className="mr-1.5 px-1.5 py-0.2 bg-purple-950/70 border border-purple-800/60 text-purple-300 rounded text-[11px] font-sans font-medium">
                  #{msg.channel}
                </span>
              )}

              {/* Timestamp Badge */}
              {settings.showTimestamps && (
                <span className="text-neutral-500 text-xs mr-1.5">[{msg.timestamp}]</span>
              )}

              {/* User Badges */}
              {settings.showBadges && msg.badges && (
                <span className="text-neutral-400 text-xs mr-1 border border-neutral-700 px-1 rounded bg-neutral-800">
                  {msg.badges}
                </span>
              )}

              {/* Username */}
              <span
                className="font-bold mr-1"
                style={{ color: msg.color || '#9ca3af' }}
              >
                {msg.displayName || msg.user}:
              </span>

              {/* Message Content */}
              <span className="text-neutral-200">{msg.message}</span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Footer Bar */}
      <footer className="p-2 border-t border-neutral-800 bg-neutral-950 text-xs text-neutral-500 flex justify-between items-center">
        <span>
          Multi-Channel Twitch Chat {settings.username ? `(@${settings.username})` : '(Anonymous)'}
        </span>
        {!autoScroll && (
          <button
            type="button"
            onClick={() => setAutoScroll(true)}
            className="text-neutral-300 underline text-xs"
          >
            Resume Auto-Scroll
          </button>
        )}
      </footer>
    </div>
  );
}
