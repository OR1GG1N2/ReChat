// Mock browser environment
globalThis.window = {
  innerWidth: 450,
  innerHeight: 700,
  addEventListener: () => {},
  removeEventListener: () => {},
  speechSynthesis: {
    getVoices: () => [],
    speak: () => {},
    cancel: () => {},
  },
  go: {
    main: {
      App: {
        GetSettings: async () => ({}),
        SaveSettings: async () => {},
        GetTTSVoices: async () => ({}),
        GetJoinedChannels: async () => [],
        GetJoinedKickChannels: async () => [],
        WireGuardTunnelStatus: async () => ({ active: false }),
        GetTwitchAuthStatus: async () => ({ authenticated: false }),
        ResizeWindowForSettings: async () => {},
        GetGlobalBadges: async () => ({}),
        GetEmotes: async () => ({}),
        IsGameMode: async () => false,
        GetCurrentGoal: async () => null,
      }
    }
  },
  runtime: {
    EventsOn: () => () => {},
    EventsEmit: () => {},
    WindowMinimise: () => {},
    WindowToggleMaximise: () => {},
    Quit: () => {},
    WindowSetAlwaysOnTop: () => {},
    BrowserOpenURL: () => {},
  }
};
try {
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      clipboard: { writeText: async () => {} },
      mediaDevices: { enumerateDevices: async () => [] }
    },
    writable: true,
    configurable: true
  });
} catch (e) {}
globalThis.document = {
  body: { classList: { add: () => {}, remove: () => {} } },
  documentElement: { classList: { add: () => {}, remove: () => {} }, style: {} }
};

import React from 'react';
import { renderToString } from 'react-dom/server';

async function run() {
  try {
    console.log("Loading SettingsView...");
    const SettingsView = (await import('../frontend/src/components/SettingsView.jsx')).default;
    console.log("Rendering SettingsView...");
    const html = renderToString(React.createElement(SettingsView, { onClose: () => console.log('closed') }));
    console.log("SettingsView rendered successfully! Length:", html.length);
  } catch (err) {
    console.error("CRASH in SettingsView render:", err);
  }
}

run();
