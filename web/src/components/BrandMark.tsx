import React from "react";

/** Logo mark. To use the official university logo instead, replace this component's body with an <img>. */
export const BrandMark: React.FC<{ size?: number }> = ({ size = 44 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <linearGradient id="bm-bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#2A6FE8" />
        <stop offset="1" stopColor="#0B2A55" />
      </linearGradient>
      <linearGradient id="bm-sun" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#FFD36B" />
        <stop offset="1" stopColor="#F2A92E" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="16" fill="url(#bm-bg)" />
    <g stroke="#FFD36B" strokeWidth="2.6" strokeLinecap="round">
      <path d="M42 9v4M55 22h-4M51.2 12.8l-2.8 2.8M32.8 12.8l2.8 2.8" />
    </g>
    <circle cx="42" cy="24" r="8.5" fill="url(#bm-sun)" />
    <path d="M19 49a8.5 8.5 0 0 1-.6-17 11.5 11.5 0 0 1 22.2 2.6A7.2 7.2 0 0 1 41.5 49Z" fill="#fff" />
  </svg>
);
