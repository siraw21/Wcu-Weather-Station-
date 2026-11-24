import { WeatherDb } from "./db";
import { Indicators, PressureTendency, ReadingRecord, StationFacts, StatsSummary } from "./types";

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

/**
 * Computes dew point (°C) using the Magnus-Tetens approximation.
 */
export function computeDewPointC(tempC: number | null, humidityPct: number | null): number | null {
  if (tempC === null || humidityPct === null || humidityPct <= 0 || humidityPct > 100) {
    return null;
  }
  const a = 17.625;
  const b = 243.04;
  const gamma = Math.log(humidityPct / 100) + (a * tempC) / (b + tempC);
  const dewPoint = (b * gamma) / (a - gamma);
  return Math.round(dewPoint * 10) / 10;
}

function summarize(values: Array<number | null>): StatsSummary {
  const valid = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (valid.length === 0) {
    return { min: null, max: null, avg: null };
  }
  let min = valid[0]!;
  let max = valid[0]!;
  let sum = 0;
  for (const v of valid) {
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  return {
    min: Math.round(min * 100) / 100,
    max: Math.round(max * 100) / 100,
    avg: Math.round((sum / valid.length) * 100) / 100,
  };
}

/**
 * Computes derived meteorological indicators from the last 3 hours of stored readings.
 * Gracefully handles missing pressure or humidity values.
 */
export function computeIndicators(db: WeatherDb, deviceId?: string): Indicators {
  const nowIso = new Date().toISOString();
  const threeHoursAgoIso = new Date(Date.now() - THREE_HOURS_MS).toISOString();

  const latest = db.getLatestReading(deviceId);
  const recent = db.getRawReadingsInRange(threeHoursAgoIso, nowIso, deviceId);

  const dewPointC = latest
    ? computeDewPointC(latest.temperatureC, latest.humidityPct)
    : null;

  const validPressures = recent.filter(
    (r): r is ReadingRecord & { pressureHpa: number } => r.pressureHpa !== null
  );

  let deltaHpa3h: number | null = null;
  let pressureTendency: PressureTendency = "steady";

  if (validPressures.length >= 2) {
    const earliest = validPressures[0]!;
    const newest = validPressures[validPressures.length - 1]!;
    deltaHpa3h = Math.round((newest.pressureHpa - earliest.pressureHpa) * 100) / 100;

    if (deltaHpa3h >= 0.5) {
      pressureTendency = "rising";
    } else if (deltaHpa3h <= -0.5) {
      pressureTendency = "falling";
    } else {
      pressureTendency = "steady";
    }
  }

  return {
    dewPointC,
    pressureTendency,
    deltaHpa3h,
  };
}

export function buildStationFacts(db: WeatherDb, deviceId: string): StationFacts {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const threeHoursAgoIso = new Date(nowMs - THREE_HOURS_MS).toISOString();

  const device = db.getDeviceStatus(deviceId);
  const latest = db.getLatestReading(deviceId);
  const recent = db.getRawReadingsInRange(threeHoursAgoIso, nowIso, deviceId);
  const indicators = computeIndicators(db, deviceId);

  let missingValueCount = 0;
  for (const r of recent) {
    if (r.temperatureC === null) missingValueCount++;
    if (r.humidityPct === null) missingValueCount++;
    if (r.pressureHpa === null) missingValueCount++;
  }

  const secondsSinceLastSeen = device
    ? Math.max(0, Math.round((nowMs - Date.parse(device.lastSeen)) / 1000))
    : null;

  return {
    deviceId,
    generatedAt: nowIso,
    device: {
      online: device?.online ?? false,
      lastSeen: device?.lastSeen ?? null,
      secondsSinceLastSeen,
    },
    latestReading: latest
      ? {
          receivedAt: latest.receivedAt,
          temperatureC: latest.temperatureC,
          humidityPct: latest.humidityPct,
          pressureHpa: latest.pressureHpa,
          bmpTemperatureC: latest.bmpTemperatureC,
        }
      : null,
    last3Hours: {
      sampleCount: recent.length,
      temperatureC: summarize(recent.map((r) => r.temperatureC)),
      humidityPct: summarize(recent.map((r) => r.humidityPct)),
      pressureHpa: summarize(recent.map((r) => r.pressureHpa)),
      missingValueCount,
    },
    indicators,
  };
}
