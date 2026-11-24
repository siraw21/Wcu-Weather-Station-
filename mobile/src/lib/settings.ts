import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_PORT } from "../config";

export interface ServerConfig {
  host: string;
  port: string;
  secure: boolean; // https / wss
}

const STORAGE_KEY = "weather-station/server-config/v1";

let current: ServerConfig | null = null;

export function getServerConfig(): ServerConfig | null {
  return current;
}

export function httpBase(): string {
  if (!current) throw new Error("Server not configured");
  return `${current.secure ? "https" : "http"}://${hostPort(current)}`;
}

export function wsUrl(): string {
  if (!current) throw new Error("Server not configured");
  return `${current.secure ? "wss" : "ws"}://${hostPort(current)}/ws`;
}

function hostPort(c: ServerConfig): string {
  const host = c.host.includes(":") && !c.host.startsWith("[") ? `[${c.host}]` : c.host; // IPv6
  return c.port ? `${host}:${c.port}` : host;
}

/**
 * Accepts "192.168.1.50", "192.168.1.50:3000", or a pasted URL such as
 * "http://192.168.1.50:3000/" and returns a normalised config (or an error).
 */
export function parseServerInput(
  hostInput: string,
  portInput: string,
  secureInput: boolean
): { config: ServerConfig } | { error: string } {
  let host = hostInput.trim();
  let port = portInput.trim();
  let secure = secureInput;

  const scheme = host.match(/^(https?|wss?):\/\//i);
  if (scheme) {
    secure = /^(https|wss)$/i.test(scheme[1] ?? "");
    host = host.slice(scheme[0].length);
  }
  host = host.split("/")[0] ?? "";

  const hp = host.match(/^([^:]+):(\d+)$/); // host:port (not bare IPv6)
  if (hp) {
    host = hp[1] ?? "";
    if (!port || port === DEFAULT_PORT) port = hp[2] ?? port;
  }

  if (!host) return { error: "Enter the server IP address or hostname." };
  if (/\s/.test(host)) return { error: "Host must not contain spaces." };
  if (port) {
    const n = Number(port);
    if (!/^\d+$/.test(port) || n < 1 || n > 65535) {
      return { error: "Port must be a number between 1 and 65535." };
    }
  }
  return { config: { host, port, secure } };
}

export async function loadServerConfig(): Promise<ServerConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ServerConfig>;
      if (typeof parsed.host === "string" && parsed.host) {
        current = {
          host: parsed.host,
          port: typeof parsed.port === "string" ? parsed.port : DEFAULT_PORT,
          secure: !!parsed.secure,
        };
      }
    }
  } catch {
    // treat as not configured
  }
  return current;
}

export async function saveServerConfig(config: ServerConfig): Promise<void> {
  current = config;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

/** Quick reachability check against a candidate config (does not save it). */
export async function testServerConfig(config: ServerConfig): Promise<string | null> {
  const base = `${config.secure ? "https" : "http"}://${hostPort(config)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`${base}/api/readings/latest`, { signal: controller.signal });
    if (res.ok || res.status === 204) return null;
    return `Server answered with HTTP ${res.status}. Is this the weather station backend?`;
  } catch {
    return "Could not reach the server. Check the IP/port, that the phone is on the same network, and that the backend is running.";
  } finally {
    clearTimeout(timer);
  }
}
