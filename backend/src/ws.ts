import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { WeatherDb } from "./db";
import { WsMessage } from "./types";
import { logger } from "./logger";

/**
 * WebSocket hub at /ws pushing live readings and online/offline transitions
 * to both Web and Mobile clients.
 */
export class WeatherWsHub {
  private readonly wss: WebSocketServer;

  constructor(server: http.Server, private readonly db: WeatherDb) {
    this.wss = new WebSocketServer({ server, path: "/ws" });

    this.wss.on("connection", (socket) => {
      const deviceId = this.db.getDefaultDeviceId() ?? undefined;
      const snapshot: WsMessage = {
        type: "snapshot",
        reading: this.db.getLatestReading(deviceId),
        device: this.db.getDeviceStatus(deviceId),
      };
      this.sendSafe(socket, snapshot);
    });

    this.wss.on("error", (err) => {
      logger.error(`WebSocket server error: ${err.message}`);
    });
  }

  private sendSafe(socket: WebSocket, msg: WsMessage): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(msg));
    }
  }

  public broadcast(msg: WsMessage): void {
    const payload = JSON.stringify(msg);
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  public close(): void {
    this.wss.close();
  }
}
