import React, { useState, useEffect, useRef } from 'react';
import { EventsOn } from '../wailsjs/runtime/runtime';
import { ConnectChannel, DisconnectChannel, GetSettings } from '../wailsjs/go/main/App';
import SettingsView from './components/SettingsView';

export default function App() {
  const [activeView, setActiveView] = useState('chat'); // 'chat' or 'settings'

  const [channel, setChannel] = useState('');
  const [activeChannel, setActiveChannel] = useState('');
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
  });

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Load initial settings from SQLite DB
  useEffect(() => {
    GetSettings()
      .then((loaded) => {
        if (loaded) {
          setSettings(loaded);
          if (loaded.defaultChannel) {
            setChannel(loaded.defaultChannel);
          }
        }
      })
      .catch((err) => console.error('Failed to load settings:', err));
  }, []);

  // Listen for Twitch chat events & live settings update events
  useEffect(() => {
    const unoffStatus = EventsOn('chat:status', (data) => {
      setStatus(data);
      if (data.status === 'connected') {
        setActiveChannel(data.channel);
      } else if (data.status === 'disconnected') {
        setActiveChannel('');
      }
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

    return () => {
      if (typeof unoffStatus === 'function') unoffStatus();
      if (typeof unoffMsg === 'function') unoffMsg();
      if (typeof unoffSettings === 'function') unoffSettings();
    };
  }, [settings.maxMessages]);

  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  const handleConnect = (e) => {
    e.preventDefault();
    if (!channel.trim()) return;
    setMessages([]);
    ConnectChannel(channel.trim()).catch((err) => {
      setStatus({ status: 'error', message: String(err) });
    });
  };

  const handleDisconnect = () => {
    DisconnectChannel();
  };

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 60;
    setAutoScroll(isAtBottom);
  };

  // Render Full Window Settings View
  if (activeView === 'settings') {
    return <SettingsView onClose={() => setActiveView('chat')} />;
  }

  return (
    <div
      className="flex flex-col h-screen w-full font-mono bg-neutral-900 text-neutral-200 select-none overflow-hidden"
      style={{ fontSize: `${settings.fontSize || 14}px` }}
    >
      {/* Header Bar */}
      <header className="p-3 border-b border-neutral-800 flex items-center gap-2 bg-neutral-950">
        <form onSubmit={handleConnect} className="flex flex-1 gap-2 items-center">
          <label htmlFor="channel-input" className="text-neutral-400 font-bold">#</label>
          <input
            id="channel-input"
            type="text"
            placeholder="Twitch channel (e.g. shroud)"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="flex-1 px-3 py-1 bg-neutral-900 border border-neutral-700 rounded focus:outline-none focus:border-neutral-500 text-neutral-100"
          />
          {activeChannel ? (
            <button
              type="button"
              onClick={handleDisconnect}
              className="px-3 py-1 bg-red-950 border border-red-800 text-red-300 rounded hover:bg-red-900 text-xs"
            >
              Disconnect
            </button>
          ) : (
            <button
              type="submit"
              className="px-3 py-1 bg-neutral-800 border border-neutral-600 text-neutral-200 rounded hover:bg-neutral-700 text-xs"
            >
              Connect
            </button>
          )}
        </form>

        {/* Settings Gear Button */}
        <button
          type="button"
          onClick={() => setActiveView('settings')}
          title="Open Settings"
          className="p-1.5 bg-neutral-900 border border-neutral-700 text-neutral-300 rounded hover:bg-neutral-800 hover:text-white"
        >
          ⚙
        </button>
      </header>

      {/* Status Bar */}
      <div className="px-3 py-1 bg-neutral-950 border-b border-neutral-800 text-xs flex justify-between items-center text-neutral-400">
        <div>
          Status: <span className="font-semibold text-neutral-200">{status.status}</span>
          {status.message && <span className="ml-2 text-neutral-500">({status.message})</span>}
        </div>
        <div>Messages: {messages.length}</div>
      </div>

      {/* Message Feed */}
      <main
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 space-y-1 bg-neutral-900"
      >
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-neutral-600 italic">
            {activeChannel ? 'Connected. Waiting for chat messages...' : 'Enter a channel name or configure a default channel in Settings.'}
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={msg.id || index} className="leading-relaxed break-words hover:bg-neutral-800/40 px-1 py-0.5 rounded">
              {settings.showTimestamps && (
                <span className="text-neutral-500 text-xs mr-2">[{msg.timestamp}]</span>
              )}
              {settings.showBadges && msg.badges && (
                <span className="text-neutral-400 text-xs mr-1 border border-neutral-700 px-1 rounded bg-neutral-800">
                  {msg.badges}
                </span>
              )}
              <span
                className="font-bold mr-1"
                style={{ color: msg.color || '#9ca3af' }}
              >
                {msg.displayName || msg.user}:
              </span>
              <span className="text-neutral-200">{msg.message}</span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Footer Bar */}
      <footer className="p-2 border-t border-neutral-800 bg-neutral-950 text-xs text-neutral-500 flex justify-between items-center">
        <span>Twitch IRC Client</span>
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
