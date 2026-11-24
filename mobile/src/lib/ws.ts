import { wsUrl } from "./settings";
import { WsMessage } from "../types";

export type WsConnectionState = "connecting" | "connected" | "reconnecting";

export function connectWeatherWs(callbacks: {
  onMessage: (msg: WsMessage) => void;
  onStateChange: (state: WsConnectionState) => void;
}): () => void {
  let socket: WebSocket | null = null;
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;

  const open = (): void => {
    if (closed) return;
    callbacks.onStateChange(attempt === 0 ? "connecting" : "reconnecting");

    socket = new WebSocket(wsUrl());

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
      if (closed) return;
      callbacks.onStateChange("reconnecting");
      const delay = Math.min(1000 * 2 ** attempt, 10_000);
      attempt++;
      timer = setTimeout(open, delay);
    };

    socket.onerror = () => {
      socket?.close();
    };
  };

  open();

  return () => {
    closed = true;
    if (timer) clearTimeout(timer);
    socket?.close();
  };
}
