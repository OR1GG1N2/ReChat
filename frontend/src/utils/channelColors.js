// Generates a harmonious color palette for any Twitch channel name,
// respecting user-configured custom background colors and no background for own channel
export function getChannelColor(channelName, customColorMap = {}, isOwn = false) {
  if (isOwn) {
    return {
      bg: 'transparent',
      border: 'rgba(168, 85, 247, 0.5)',
      text: '#c084fc',
      accent: '#a855f7',
      isOwn: true,
    };
  }

  const str = (channelName || '').toLowerCase();

  // If user configured a custom background color for this specific channel
  if (customColorMap && customColorMap[str]) {
    const customHex = customColorMap[str];
    return {
      bg: customHex,
      border: customHex,
      text: '#ffffff',
      accent: customHex,
      isOwn: false,
    };
  }

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash) % 360;

  return {
    bg: `hsla(${hue}, 65%, 15%, 0.85)`,
    border: `hsla(${hue}, 60%, 35%, 0.7)`,
    text: `hsla(${hue}, 90%, 80%, 1)`,
    accent: `hsla(${hue}, 85%, 55%, 1)`,
    isOwn: false,
  };
}

export const ICON_COLORS = {
  purple: { name: 'Twitch Purple', hex: '#a855f7' },
  white: { name: 'Crisp White', hex: '#ffffff' },
  emerald: { name: 'Emerald Green', hex: '#10b981' },
  amber: { name: 'Amber Gold', hex: '#f59e0b' },
  cyan: { name: 'Neon Cyan', hex: '#06b6d4' },
  rose: { name: 'Hot Rose', hex: '#f43f5e' },
  channel: { name: 'Channel Accent Color', hex: 'auto' },
};

export function getTwitchIconColor(colorKey, fallbackAccent = '#a855f7') {
  if (colorKey === 'channel') return fallbackAccent;
  return ICON_COLORS[colorKey]?.hex || '#a855f7';
}
