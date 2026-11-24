import React from "react";
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";

/** Logo mark. To use the official university logo instead, replace this with an <Image>. */
export const BrandMark: React.FC<{ size?: number }> = ({ size = 44 }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Defs>
      <LinearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#2A6FE8" />
        <Stop offset="1" stopColor="#0B2A55" />
      </LinearGradient>
      <LinearGradient id="sun" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#FFD36B" />
        <Stop offset="1" stopColor="#F2A92E" />
      </LinearGradient>
    </Defs>
    <Rect width="64" height="64" rx="16" fill="url(#bg)" />
    <G stroke="#FFD36B" strokeWidth="2.6" strokeLinecap="round">
      <Path d="M42 9v4M55 22h-4M51.2 12.8l-2.8 2.8M32.8 12.8l2.8 2.8" />
    </G>
    <Circle cx="42" cy="24" r="8.5" fill="url(#sun)" />
    <Path d="M19 49a8.5 8.5 0 0 1-.6-17 11.5 11.5 0 0 1 22.2 2.6A7.2 7.2 0 0 1 41.5 49Z" fill="#fff" />
  </Svg>
);
