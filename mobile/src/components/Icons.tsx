import React from "react";
import Svg, { Circle, Path } from "react-native-svg";

export type IconName =
  | "thermometer" | "droplet" | "gauge" | "dew" | "up" | "down" | "steady"
  | "dashboard" | "history" | "settings";

const PATHS: Record<IconName, React.ReactNode> = {
  thermometer: <Path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />,
  droplet: <Path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />,
  gauge: (
    <>
      <Path d="M12 21a9 9 0 1 1 9-9" />
      <Path d="M12 12l4.5-4.5" />
      <Circle cx="12" cy="12" r="1" />
    </>
  ),
  dew: (
    <>
      <Path d="M12 3l4.2 4.2a6 6 0 1 1-8.4 0z" />
      <Path d="M9.5 14a2.6 2.6 0 0 0 2.5 2" />
    </>
  ),
  up: <Path d="M7 17 17 7M9 7h8v8" />,
  down: <Path d="M7 7l10 10M17 9v8H9" />,
  steady: <Path d="M5 12h14M15 8l4 4-4 4" />,
  dashboard: <Path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z" />,
  history: <Path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  settings: <Path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />,
};

export const Icon: React.FC<{ name: IconName; size?: number; color?: string }> = ({
  name,
  size = 20,
  color = "#1f5fd6",
}) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {PATHS[name]}
  </Svg>
);
