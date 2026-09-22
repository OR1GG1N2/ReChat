import React from 'react';

export default function KickIcon({ className = "w-4 h-4", fill = "currentColor" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={fill}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M3 2h5.5v7h2.5V5.5h5.5V2H21v6.5h-4.5V11H14v2h2.5v2.5H21V22h-4.5v-3.5H11v-3.5H8.5V22H3V2z" />
    </svg>
  );
}
