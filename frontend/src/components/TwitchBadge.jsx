import React from 'react';

// Common badge fallbacks if global API badges aren't loaded yet
const STATIC_BADGES = {
  'broadcaster/1': 'https://static-cdn.jtvnw.net/badges/v1/5527c58c-fb7d-422d-b71b-f309dcb85cc1/1',
  'moderator/1': 'https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/1',
  'vip/1': 'https://static-cdn.jtvnw.net/badges/v1/b817aba4-fad8-49e2-b88a-7cc744dfa6ec/1',
  'subscriber/0': 'https://static-cdn.jtvnw.net/badges/v1/5d9f2208-5dd8-11e7-8513-2aa4b878e69d/1',
  'subscriber/1': 'https://static-cdn.jtvnw.net/badges/v1/5d9f2208-5dd8-11e7-8513-2aa4b878e69d/1',
  'partner/1': 'https://static-cdn.jtvnw.net/badges/v1/d12a2e27-16f6-41d0-ab77-b780518f00a3/1',
  'premium/1': 'https://static-cdn.jtvnw.net/badges/v1/bbbe0db0-a998-4c63-8bc5-eb07a378127a/1',
  'turbo/1': 'https://static-cdn.jtvnw.net/badges/v1/bd444ec6-8f34-4bf9-abac-f6c23f00388c/1',
};

export default function TwitchBadge({ badgeTag, dynamicBadges = {} }) {
  if (!badgeTag) return null;

  // badgeTag can be a string like "broadcaster/1,subscriber/12" or an array
  const badgeKeys =
    typeof badgeTag === 'string'
      ? badgeTag
          .split(',')
          .map((b) => b.trim())
          .filter(Boolean)
      : Array.isArray(badgeTag)
      ? badgeTag
      : [];

  if (badgeKeys.length === 0) return null;

  return (
    <span className="inline-flex items-center gap-0.5 select-none self-center mr-1">
      {badgeKeys.map((key) => {
        const url = (dynamicBadges && dynamicBadges[key]) || STATIC_BADGES[key];
        const [badgeName, version] = key.split('/');

        if (url) {
          return (
            <img
              key={key}
              src={url}
              alt={badgeName || key}
              title={`${badgeName || 'badge'} (${version || '1'})`}
              className="w-3.5 h-3.5 rounded inline-block object-contain"
              loading="lazy"
            />
          );
        }

        // Text fallback badge if no image available
        return (
          <span
            key={key}
            title={key}
            className="px-1 py-0.2 rounded bg-purple-900/60 border border-purple-500/40 text-[9px] font-mono text-purple-300 uppercase tracking-tighter"
          >
            {badgeName ? badgeName.slice(0, 3) : key}
          </span>
        );
      })}
    </span>
  );
}
