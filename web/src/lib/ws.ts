import { WsMessage } from "../types";

export type WsConnectionState = "connecting" | "connected" | "reconnecting";

export interface WsCallbacks {
  onMessage: (msg: WsMessage) => void;
  onStateChange: (state: WsConnectionState) => void;
}

/**
 * Connects to /ws with automatic exponential backoff reconnect.
 */
export function connectWeatherWs(callbacks: WsCallbacks): () => void {
  let socket: WebSocket | null = null;
  let closedByCaller = false;
  let retryTimer: number | null = null;
  let attempt = 0;

  const getWsUrl = (): string => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/ws`;
  };

  const open = (): void => {
    if (closedByCaller) return;
    callbacks.onStateChange(attempt === 0 ? "connecting" : "reconnecting");

    socket = new WebSocket(getWsUrl());

    socket.onopen = () => {
      attempt = 0;
      callbacks.onStateChange("connected");
    };

    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(String(event.data)) as WsMessage;
        callbacks.onMessage(parsed);
      } catch {
        // Ignore malformed frame
      }
    };

    socket.onclose = () => {
      if (closedByCaller) return;
      callbacks.onStateChange("reconnecting");
      const delayMs = Math.min(1000 * 2 ** attempt, 10_000);
      attempt++;
      retryTimer = window.setTimeout(open, delayMs);
    };

    socket.onerror = () => {
      socket?.close();
    };
  };

  open();

  return () => {
    closedByCaller = true;
    if (retryTimer !== null) window.clearTimeout(retryTimer);
    socket?.close();
  };
}
