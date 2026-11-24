import { httpBase } from "./settings";
import {
  AskResponse,
  BucketedReading,
  Indicators,
  InterpretResponse,
  LatestResponse,
} from "../types";

const TIMEOUT_MS = 12_000;

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${httpBase()}${path}`, {
      ...init,
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function getLatestReading(): Promise<LatestResponse | null> {
  const res = await fetch(`${httpBase()}/api/readings/latest`);
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as LatestResponse;
}

export async function getIndicators(): Promise<Indicators> {
  return fetchJson<Indicators>("/api/indicators");
}

export async function getHistory(
  fromIso: string,
  toIso: string,
  bucketSec: number
): Promise<BucketedReading[]> {
  const query = `from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(
    toIso
  )}&bucket=${encodeURIComponent(String(bucketSec))}`;
  return fetchJson<BucketedReading[]>(`/api/readings?${query}`);
}

export async function requestInterpretation(deviceId?: string): Promise<InterpretResponse> {
  return fetchJson<InterpretResponse>("/api/interpret", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId }),
  });
}

export async function askQuestion(
  question: string,
  deviceId?: string
): Promise<AskResponse> {
  return fetchJson<AskResponse>("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, question }),
  });
}
