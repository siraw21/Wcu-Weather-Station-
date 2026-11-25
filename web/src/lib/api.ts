import {
  AskResponse,
  BucketedReading,
  Indicators,
  InterpretResponse,
  LatestResponse,
} from "../types";

const REQUEST_TIMEOUT_MS = 12_000;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function getLatestReading(): Promise<LatestResponse | null> {
  const res = await fetch("/api/readings/latest");
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
  const params = new URLSearchParams({
    from: fromIso,
    to: toIso,
    bucket: String(bucketSec),
  });
  return fetchJson<BucketedReading[]>(`/api/readings?${params.toString()}`);
}

export function getExportCsvUrl(fromIso: string, toIso: string): string {
  const params = new URLSearchParams({ from: fromIso, to: toIso });
  return `/api/readings/export?${params.toString()}`;
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
