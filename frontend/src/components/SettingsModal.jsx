import React, { useState } from 'react';

export default function SettingsModal({ isOpen, settings, onSave, onClose }) {
  const [formData, setFormData] = useState(settings);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg w-full max-w-md shadow-xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-4 py-3 border-b border-neutral-800 flex justify-between items-center bg-neutral-950">
          <h2 className="text-base font-bold text-neutral-200">Settings</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-200 text-lg leading-none"
          >
            &times;
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto max-h-[75vh]">
          {/* General Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">General</h3>
            
            <div>
              <label htmlFor="setting-default-channel" className="block text-xs text-neutral-300 mb-1">
                Default Channel
              </label>
              <input
                id="setting-default-channel"
                type="text"
                placeholder="e.g. shroud"
                value={formData.defaultChannel || ''}
                onChange={(e) => handleChange('defaultChannel', e.target.value)}
                className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded text-neutral-100 text-xs focus:outline-none focus:border-neutral-600"
              />
              <p className="text-[11px] text-neutral-500 mt-1">Auto-connects to this channel when app starts.</p>
            </div>

            <div>
              <label htmlFor="setting-max-messages" className="block text-xs text-neutral-300 mb-1">
                Max Messages Limit ({formData.maxMessages || 300})
              </label>
              <input
                id="setting-max-messages"
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

          <hr className="border-neutral-800" />

          {/* Appearance Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Appearance</h3>

            <div>
              <label htmlFor="setting-font-size" className="block text-xs text-neutral-300 mb-1">
                Font Size ({formData.fontSize || 14}px)
              </label>
              <select
                id="setting-font-size"
                value={formData.fontSize || 14}
                onChange={(e) => handleChange('fontSize', parseInt(e.target.value, 10))}
                className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded text-neutral-100 text-xs focus:outline-none focus:border-neutral-600"
              >
                <option value={12}>12px (Small)</option>
                <option value={14}>14px (Medium)</option>
                <option value={16}>16px (Large)</option>
                <option value={18}>18px (Extra Large)</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <label htmlFor="setting-show-timestamps" className="text-xs text-neutral-300">Show Timestamps</label>
              <input
                id="setting-show-timestamps"
                type="checkbox"
                checked={!!formData.showTimestamps}
                onChange={(e) => handleChange('showTimestamps', e.target.checked)}
                className="rounded bg-neutral-950 border-neutral-800 text-neutral-400 focus:ring-0"
              />
            </div>

            <div className="flex items-center justify-between">
              <label htmlFor="setting-show-badges" className="text-xs text-neutral-300">Show Badges</label>
              <input
                id="setting-show-badges"
                type="checkbox"
                checked={!!formData.showBadges}
                onChange={(e) => handleChange('showBadges', e.target.checked)}
                className="rounded bg-neutral-950 border-neutral-800 text-neutral-400 focus:ring-0"
              />
            </div>
          </div>

          <hr className="border-neutral-800" />

          {/* Account Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Authentication (Optional)</h3>
            
            <div>
              <label htmlFor="setting-oauth-token" className="block text-xs text-neutral-300 mb-1">
                OAuth Token
              </label>
              <input
                id="setting-oauth-token"
                type="password"
                placeholder="oauth:xxxxxxxxxxxx"
                value={formData.oauthToken || ''}
                onChange={(e) => handleChange('oauthToken', e.target.value)}
                className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded text-neutral-100 text-xs focus:outline-none focus:border-neutral-600"
              />
            </div>
          </div>

          {/* Modal Footer / Actions */}
          <div className="pt-2 flex justify-end gap-2 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-neutral-800 text-neutral-300 text-xs rounded hover:bg-neutral-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-neutral-200 text-neutral-900 font-semibold text-xs rounded hover:bg-white"
            >
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
