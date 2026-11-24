/**
 * Shared data contract between Backend, Web, and Mobile clients.
 */

export interface ReadingRecord {
  id: number;
  deviceId: string;
  receivedAt: string; // ISO-8601 UTC timestamp assigned by server
  seq: number;
  temperatureC: number | null;
  humidityPct: number | null;
  pressureHpa: number | null;
  bmpTemperatureC: number | null;
}

export interface BucketedReading {
  time: string; // ISO-8601 bucket start
  temperatureC: number | null;
  humidityPct: number | null;
  pressureHpa: number | null;
  bmpTemperatureC: number | null;
}

export interface DeviceStatus {
  deviceId: string;
  online: boolean;
  lastSeen: string; // ISO-8601
  intervalSeconds: number;
}

export type PressureTendency = "rising" | "falling" | "steady";

export interface Indicators {
  dewPointC: number | null;
  pressureTendency: PressureTendency;
  deltaHpa3h: number | null;
}

export interface StatsSummary {
  min: number | null;
  max: number | null;
  avg: number | null;
}

export interface StationFacts {
  deviceId: string;
  generatedAt: string;
  device: {
    online: boolean;
    lastSeen: string | null;
    secondsSinceLastSeen: number | null;
  };
  latestReading: {
    receivedAt: string;
    temperatureC: number | null;
    humidityPct: number | null;
    pressureHpa: number | null;
    bmpTemperatureC: number | null;
  } | null;
  last3Hours: {
    sampleCount: number;
    temperatureC: StatsSummary;
    humidityPct: StatsSummary;
    pressureHpa: StatsSummary;
    missingValueCount: number;
  };
  indicators: Indicators;
}

export interface InterpretSuccessResponse {
  available: true;
  text: string;
  model: string;
  createdAt: string;
  cached: boolean;
}

export interface InterpretFallbackResponse {
  available: false;
  message: string;
  fallback: string;
  fallbackIsAI: false;
}

export type InterpretResponse = InterpretSuccessResponse | InterpretFallbackResponse;

export interface AskSuccessResponse {
  available: true;
  text: string;
  model: string;
  createdAt: string;
}

export interface AskUnavailableResponse {
  available: false;
  message: string;
}

export type AskResponse = AskSuccessResponse | AskUnavailableResponse;

export type WsMessage =
  | { type: "snapshot"; reading: ReadingRecord | null; device: DeviceStatus | null }
  | { type: "reading"; reading: ReadingRecord }
  | { type: "device"; deviceId: string; online: boolean; lastSeen: string };
