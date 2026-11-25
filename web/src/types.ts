export interface ReadingRecord {
  id: number;
  deviceId: string;
  receivedAt: string;
  seq: number;
  temperatureC: number | null;
  humidityPct: number | null;
  pressureHpa: number | null;
  bmpTemperatureC: number | null;
}

export interface BucketedReading {
  time: string;
  temperatureC: number | null;
  humidityPct: number | null;
  pressureHpa: number | null;
  bmpTemperatureC: number | null;
}

export interface DeviceStatus {
  deviceId?: string;
  online: boolean;
  lastSeen: string | null;
  intervalSeconds: number;
}

export type PressureTendency = "rising" | "falling" | "steady";

export interface Indicators {
  dewPointC: number | null;
  pressureTendency: PressureTendency;
  deltaHpa3h: number | null;
}

export interface LatestResponse {
  reading: ReadingRecord | null;
  device: DeviceStatus | null;
}

export type InterpretResponse =
  | {
      available: true;
      text: string;
      model: string;
      createdAt: string;
      cached: boolean;
    }
  | {
      available: false;
      message: string;
      fallback: string;
      fallbackIsAI: false;
    };

export type AskResponse =
  | {
      available: true;
      text: string;
      model: string;
      createdAt: string;
    }
  | {
      available: false;
      message: string;
    };

export type WsMessage =
  | { type: "snapshot"; reading: ReadingRecord | null; device: DeviceStatus | null }
  | { type: "reading"; reading: ReadingRecord }
  | { type: "device"; deviceId: string; online: boolean; lastSeen: string };
