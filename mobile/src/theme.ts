/**
 * Wachemo University Weather Station: shared design tokens (mobile).
 * Identical values to web/src/theme.ts so both apps look like one product.
 */

export const BRAND = {
  university: "Wachemo University",
  product: "Weather Station",
  full: "Wachemo University Weather Station",
} as const;

export const COLORS = {
  navy: "#0b2a55",
  primary: "#1f5fd6",
  primaryDark: "#174db0",
  gold: "#f2b33d",
  ink: "#0f1b2d",
  ink2: "#4a5a70",
  ink3: "#7a8799",
  ok: "#1fa463",
  warn: "#c47f08",
  danger: "#d64545",
} as const;

export const CHART_COLORS = {
  temperatureC: "#ef6a33",
  humidityPct: "#1f7ae0",
  pressureHpa: "#7c5ce0",
} as const;

/** Background "scene" that shifts from cool blue to warm amber with the temperature. */
const SCENE_STOPS: Array<{ t: number; top: [number, number, number]; bottom: [number, number, number] }> = [
  { t: 5, top: [200, 222, 255], bottom: [238, 245, 255] },
  { t: 15, top: [208, 233, 250], bottom: [243, 249, 255] },
  { t: 22, top: [217, 242, 236], bottom: [251, 250, 242] },
  { t: 28, top: [253, 233, 201], bottom: [255, 246, 232] },
  { t: 36, top: [252, 213, 184], bottom: [255, 240, 230] },
];

type RGB = [number, number, number];

function rgb(c: RGB): string {
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function mix(a: RGB, b: RGB, f: number): string {
  return rgb(a.map((v, i) => Math.round(v + (b[i]! - v) * f)) as RGB);
}

export function sceneColors(tempC: number | null): { top: string; bottom: string } {
  const t = tempC ?? 18;
  const first = SCENE_STOPS[0]!;
  const last = SCENE_STOPS[SCENE_STOPS.length - 1]!;
  if (t <= first.t) return { top: rgb(first.top), bottom: rgb(first.bottom) };
  if (t >= last.t) return { top: rgb(last.top), bottom: rgb(last.bottom) };
  for (let i = 0; i < SCENE_STOPS.length - 1; i++) {
    const a = SCENE_STOPS[i]!;
    const b = SCENE_STOPS[i + 1]!;
    if (t >= a.t && t <= b.t) {
      const f = (t - a.t) / (b.t - a.t);
      return { top: mix(a.top, b.top, f), bottom: mix(a.bottom, b.bottom, f) };
    }
  }
  return { top: rgb(first.top), bottom: rgb(first.bottom) };
}

export function formatTime(iso: string | null): string {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "No readings yet";
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const RADIUS = { lg: 28, md: 20, sm: 14, pill: 999 } as const;

export const CARD = {
  backgroundColor: "rgba(255,255,255,0.72)",
  borderColor: "rgba(255,255,255,0.95)",
  borderWidth: 1,
  borderRadius: RADIUS.md,
  shadowColor: "#0b2a55",
  shadowOpacity: 0.12,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 3,
} as const;
