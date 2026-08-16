import React, { useState, useEffect } from 'react';
import { GetSettings, SaveSettings } from '../../wailsjs/go/main/App';

export default function SettingsView({ onClose }) {
  const [formData, setFormData] = useState({
    defaultChannel: '',
    fontSize: 14,
    showTimestamps: true,
    showBadges: true,
    maxMessages: 300,
    oauthToken: '',
  });
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    GetSettings()
      .then((loaded) => {
        if (loaded) setFormData(loaded);
      })
      .catch((err) => console.error('Failed to load settings:', err));
  }, []);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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
          <span>⚙</span> Settings (Stored in .db)
        </h1>
        <button
          onClick={onClose}
          className="text-xs bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-700 px-3 py-1.5 rounded transition-colors flex items-center gap-1"
        >
          ← Back to Chat
        </button>
      </header>

      {/* Settings Form Body (Full Window) */}
      <form onSubmit={handleSubmit} className="flex-1 p-6 space-y-6 overflow-y-auto max-w-2xl mx-auto w-full">
        {statusMsg && (
          <div className="px-4 py-2 bg-neutral-800 border border-neutral-700 text-xs text-neutral-200 rounded">
            {statusMsg}
          </div>
        )}

        {/* General Options */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-4">
          <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider border-b border-neutral-800 pb-2">
            General Options
          </h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="settings-default-channel-full" className="block text-xs font-medium text-neutral-300 mb-1">
                Default Twitch Channel
              </label>
              <input
                id="settings-default-channel-full"
                type="text"
                placeholder="e.g. shroud"
                value={formData.defaultChannel || ''}
                onChange={(e) => handleChange('defaultChannel', e.target.value)}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-neutral-100 text-xs focus:outline-none focus:border-neutral-600 font-mono"
              />
              <p className="text-[11px] text-neutral-500 mt-1">Automatically connects to this channel on startup.</p>
            </div>

            <div>
              <label htmlFor="settings-max-messages-full" className="block text-xs font-medium text-neutral-300 mb-1">
                Max Chat Messages History ({formData.maxMessages || 300})
              </label>
              <input
                id="settings-max-messages-full"
                type="range"
                min="50"
                max="1000"
                step="50"
                value={formData.maxMessages || 300}
                onChange={(e) => handleChange('maxMessages', parseInt(e.target.value, 10))}
                className="w-full accent-neutral-400"
              />
              <div className="flex justify-between text-[10px] text-neutral-500 mt-1">
                <span>50 msgs</span>
                <span>500 msgs</span>
                <span>1000 msgs</span>
              </div>
            </div>
          </div>
        </div>

        {/* Appearance Options */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-4">
          <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider border-b border-neutral-800 pb-2">
            Appearance & Chat Feed
          </h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="settings-font-size-full" className="block text-xs font-medium text-neutral-300 mb-1">
                Chat Font Size ({formData.fontSize || 14}px)
              </label>
              <select
                id="settings-font-size-full"
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
                id="settings-show-timestamps-full"
                type="checkbox"
                checked={!!formData.showTimestamps}
                onChange={(e) => handleChange('showTimestamps', e.target.checked)}
                className="rounded bg-neutral-900 border-neutral-700 text-neutral-400 focus:ring-0 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-neutral-950 border border-neutral-800 rounded">
              <div>
                <div className="text-xs text-neutral-200 font-medium">Show User Badges</div>
                <div className="text-[11px] text-neutral-500">Display sub/mod badges next to usernames</div>
              </div>
              <input
                id="settings-show-badges-full"
                type="checkbox"
                checked={!!formData.showBadges}
                onChange={(e) => handleChange('showBadges', e.target.checked)}
                className="rounded bg-neutral-900 border-neutral-700 text-neutral-400 focus:ring-0 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Authentication Options */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-4">
          <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider border-b border-neutral-800 pb-2">
            Authentication (Optional)
          </h2>
          
          <div>
            <label htmlFor="settings-oauth-token-full" className="block text-xs font-medium text-neutral-300 mb-1">
              Twitch OAuth Token
            </label>
            <input
              id="settings-oauth-token-full"
              type="password"
              placeholder="oauth:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={formData.oauthToken || ''}
              onChange={(e) => handleChange('oauthToken', e.target.value)}
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-neutral-100 text-xs focus:outline-none focus:border-neutral-600 font-mono"
            />
            <p className="text-[11px] text-neutral-500 mt-1">Optional for authenticated access or future chat posting.</p>
          </div>
        </div>

        {/* Form Action Buttons */}
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
