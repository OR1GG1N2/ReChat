import React, { useState, useEffect } from 'react';
import { GetSettings, SaveSettings, StartTwitchAuth, LogoutTwitch, ConnectChannel, DisconnectChannel } from '../../wailsjs/go/main/App';
import { EventsOn } from '../../wailsjs/runtime/runtime';

export default function SettingsView({ onClose, currentStatus }) {
  const [formData, setFormData] = useState({
    defaultChannel: '',
    fontSize: 14,
    showTimestamps: true,
    showBadges: true,
    maxMessages: 300,
    oauthToken: '',
    username: '',
  });
  const [statusMsg, setStatusMsg] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    GetSettings()
      .then((loaded) => {
        if (loaded) setFormData(loaded);
      })
      .catch((err) => console.error('Failed to load settings:', err));

    const unoffAuth = EventsOn('auth:updated', (updatedSettings) => {
      setFormData((prev) => ({ ...prev, ...updatedSettings }));
      setIsAuthenticating(false);
      setStatusMsg(`Authenticated successfully as @${updatedSettings.username}!`);
    });

    return () => {
      if (typeof unoffAuth === 'function') unoffAuth();
    };
  }, []);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleStartAuth = () => {
    setIsAuthenticating(true);
    setStatusMsg('Opening browser for Twitch login...');
    StartTwitchAuth().catch((err) => {
      setIsAuthenticating(false);
      setStatusMsg('Auth failed: ' + String(err));
    });
  };

  const handleLogout = () => {
    LogoutTwitch().then(() => {
      setFormData((prev) => ({ ...prev, oauthToken: '', username: '' }));
      setStatusMsg('Logged out.');
    });
  };

  const handleConnectNow = () => {
    if (!formData.defaultChannel.trim()) {
      setStatusMsg('Please enter a channel name first.');
      return;
    }
    ConnectChannel(formData.defaultChannel.trim())
      .then(() => setStatusMsg(`Connecting to #${formData.defaultChannel}...`))
      .catch((err) => setStatusMsg('Connect error: ' + String(err)));
  };

  const handleDisconnectNow = () => {
    DisconnectChannel();
    setStatusMsg('Disconnected from chat.');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    SaveSettings(formData)
      .then(() => {
        setStatusMsg('Settings saved to SQLite (.db)!');
        setTimeout(() => {
          setStatusMsg('');
          onClose();
        }, 300);
      })
      .catch((err) => {
        setStatusMsg('Failed to save: ' + String(err));
      });
  };

  return (
    <div className="flex flex-col h-screen w-full font-sans bg-neutral-950 text-neutral-200 select-none overflow-hidden">
      {/* Top Header Bar */}
      <header className="px-5 py-3 border-b border-neutral-800 bg-neutral-900 flex justify-between items-center">
        <h1 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
          <span>⚙</span> Settings & Authentication
        </h1>
        <button
          onClick={onClose}
          className="text-xs bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-700 px-3 py-1.5 rounded transition-colors flex items-center gap-1"
        >
          ← Back to Chat
        </button>
      </header>

      {/* Settings Form Body */}
      <form onSubmit={handleSubmit} className="flex-1 p-6 space-y-6 overflow-y-auto max-w-2xl mx-auto w-full">
        {statusMsg && (
          <div className="px-4 py-2 bg-neutral-800 border border-neutral-700 text-xs text-neutral-200 rounded">
            {statusMsg}
          </div>
        )}

        {/* Twitch Authentication Section */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-4">
          <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider border-b border-neutral-800 pb-2 flex justify-between items-center">
            <span>Twitch Account</span>
            {formData.username && (
              <span className="text-emerald-400 normal-case font-mono font-normal">
                ● Logged in as @{formData.username}
              </span>
            )}
          </h2>

          {formData.username ? (
            <div className="flex items-center justify-between bg-neutral-950 p-3 rounded border border-neutral-800">
              <div>
                <div className="text-xs text-neutral-200 font-bold">@{formData.username}</div>
                <div className="text-[11px] text-neutral-500">Authenticated via Twitch OAuth Browser Login</div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="px-3 py-1.5 bg-red-950 border border-red-800 text-red-300 text-xs rounded hover:bg-red-900 transition-colors"
              >
                Log Out
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-neutral-400">
                Click below to log in with your Twitch account in your web browser.
              </p>
              <div>
                <button
                  type="button"
                  onClick={handleStartAuth}
                  disabled={isAuthenticating}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded transition-colors flex items-center gap-2"
                >
                  {isAuthenticating ? 'Waiting for browser login...' : '🔑 Login via Twitch Browser'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Channel Connection Section */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-4">
          <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider border-b border-neutral-800 pb-2">
            Channel Connection
          </h2>
          
          <div className="space-y-3">
            <div>
              <label htmlFor="settings-default-channel" className="block text-xs font-medium text-neutral-300 mb-1">
                Target Twitch Channel Name
              </label>
              <div className="flex gap-2">
                <input
                  id="settings-default-channel"
                  type="text"
                  placeholder="e.g. shroud, xqc"
                  value={formData.defaultChannel || ''}
                  onChange={(e) => handleChange('defaultChannel', e.target.value)}
                  className="flex-1 px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-neutral-100 text-xs focus:outline-none focus:border-neutral-600 font-mono"
                />
                <button
                  type="button"
                  onClick={handleConnectNow}
                  className="px-4 py-2 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 text-neutral-200 text-xs rounded transition-colors"
                >
                  Connect Now
                </button>
                {currentStatus?.status === 'connected' && (
                  <button
                    type="button"
                    onClick={handleDisconnectNow}
                    className="px-3 py-2 bg-red-950 border border-red-800 text-red-300 text-xs rounded hover:bg-red-900 transition-colors"
                  >
                    Disconnect
                  </button>
                )}
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">Connects to live Twitch IRC chat feed.</p>
            </div>
          </div>
        </div>

        {/* Appearance & Chat Options */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-4">
          <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider border-b border-neutral-800 pb-2">
            Appearance & Chat Feed
          </h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="settings-font-size" className="block text-xs font-medium text-neutral-300 mb-1">
                Chat Font Size ({formData.fontSize || 14}px)
              </label>
              <select
                id="settings-font-size"
                value={formData.fontSize || 14}
                onChange={(e) => handleChange('fontSize', parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-neutral-100 text-xs focus:outline-none focus:border-neutral-600"
              >
                <option value={12}>12px (Small)</option>
                <option value={14}>14px (Medium)</option>
                <option value={16}>16px (Large)</option>
                <option value={18}>18px (Extra Large)</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-3 bg-neutral-950 border border-neutral-800 rounded">
              <div>
                <div className="text-xs text-neutral-200 font-medium">Show Timestamps</div>
                <div className="text-[11px] text-neutral-500">Display timestamp prefixes like [15:04:05]</div>
              </div>
              <input
                id="settings-show-timestamps"
                type="checkbox"
                checked={!!formData.showTimestamps}
                onChange={(e) => handleChange('showTimestamps', e.target.checked)}
                className="rounded bg-neutral-900 border-neutral-700 text-neutral-400 focus:ring-0 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-neutral-950 border border-neutral-800 rounded">
              <div>
                <div className="text-xs text-neutral-200 font-medium">Show User Badges</div>
                <div className="text-[11px] text-neutral-500">Display subscriber/mod badges next to usernames</div>
              </div>
              <input
                id="settings-show-badges"
                type="checkbox"
                checked={!!formData.showBadges}
                onChange={(e) => handleChange('showBadges', e.target.checked)}
                className="rounded bg-neutral-900 border-neutral-700 text-neutral-400 focus:ring-0 cursor-pointer"
              />
            </div>

            <div>
              <label htmlFor="settings-max-messages" className="block text-xs font-medium text-neutral-300 mb-1">
                Max Messages History ({formData.maxMessages || 300})
              </label>
              <input
                id="settings-max-messages"
                type="range"
                min="50"
                max="1000"
                step="50"
                value={formData.maxMessages || 300}
                onChange={(e) => handleChange('maxMessages', parseInt(e.target.value, 10))}
                className="w-full accent-neutral-400"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-neutral-800 text-neutral-300 text-xs rounded hover:bg-neutral-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 bg-neutral-200 text-neutral-900 font-semibold text-xs rounded hover:bg-white transition-colors"
          >
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
}
