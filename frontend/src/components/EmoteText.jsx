import React, { useState } from 'react';

// Single Emote Component with Protocol Sanitization & Graceful Fallback
function SingleEmote({ word, cleanWord, emoteUrl, trailingPunctuation }) {
  const [hasError, setHasError] = useState(false);

  // Force absolute https:// scheme for Wails WebView2 compatibility
  let srcUrl = emoteUrl || '';
  if (srcUrl.startsWith('//')) {
    srcUrl = 'https:' + srcUrl;
  } else if (!srcUrl.startsWith('http://') && !srcUrl.startsWith('https://')) {
    srcUrl = 'https://' + srcUrl;
  }

  if (hasError) {
    return (
      <span>
        {word}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center align-middle">
      <img
        src={srcUrl}
        alt={cleanWord}
        title={cleanWord}
        className="inline-block h-6 mx-0.5 align-middle object-contain select-none"
        onError={() => {
          console.warn(`[EmoteText] Image load failed: ${srcUrl} (${cleanWord})`);
          setHasError(true);
        }}
      />
      {trailingPunctuation && <span>{trailingPunctuation}</span>}
    </span>
  );
}

export default function EmoteText({ text, emoteMap = {}, msgEmoteMap = {} }) {
  if (!text) return null;

  // Merge global 7TV/BTTV/FFZ emote map with message-specific native Twitch emote map
  const activeEmoteMap = { ...emoteMap, ...msgEmoteMap };

  // Split message into words by whitespace
  const words = text.split(/\s+/);

  return (
    <span className="align-middle">
      {words.map((word, idx) => {
        if (!word) return null;

        let cleanWord = word;
        let trailingPunct = '';

        // Strip trailing punctuation e.g. "monkaS!", "KEKW.", "catJAM,"
        const match = word.match(/^(.+?)([.,!?;:)]+)$/);
        if (match) {
          cleanWord = match[1];
          trailingPunct = match[2];
        }

        const emoteUrl = activeEmoteMap[cleanWord] || activeEmoteMap[word];
        const targetWord = activeEmoteMap[cleanWord] ? cleanWord : word;
        const punct = activeEmoteMap[cleanWord] ? trailingPunct : '';

        if (emoteUrl) {
          return (
            <React.Fragment key={idx}>
              <SingleEmote
                word={word}
                cleanWord={targetWord}
                emoteUrl={emoteUrl}
                trailingPunctuation={punct}
              />
              {idx < words.length - 1 ? ' ' : ''}
            </React.Fragment>
          );
        }

        return idx < words.length - 1 ? `${word} ` : word;
      })}
    </span>
  );
}
