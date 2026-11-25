import React from "react";

type IconName = "thermometer" | "droplet" | "gauge" | "dew" | "up" | "down" | "steady";

const PATHS: Record<IconName, React.ReactNode> = {
  thermometer: <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />,
  droplet: <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />,
  gauge: (
    <>
      <path d="M12 21a9 9 0 1 1 9-9" />
      <path d="M12 12l4.5-4.5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  dew: (
    <>
      <path d="M12 3l4.2 4.2a6 6 0 1 1-8.4 0z" />
      <path d="M9.5 14a2.6 2.6 0 0 0 2.5 2" />
    </>
  ),
  up: <path d="M7 17 17 7M9 7h8v8" />,
  down: <path d="M7 7l10 10M17 9v8H9" />,
  steady: <path d="M5 12h14M15 8l4 4-4 4" />,
};

export const Icon: React.FC<{ name: IconName; size?: number }> = ({ name, size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {PATHS[name]}
  </svg>
);
