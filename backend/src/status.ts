import { WeatherDb } from "./db";
import { WeatherWsHub } from "./ws";
import { logger } from "./logger";

/**
 * Computes offline threshold in ms:
 *   min(max(3 * interval_seconds * 1000, 15000), 30000)
 */
export function computeOfflineThresholdMs(intervalSeconds: number): number {
  return Math.min(Math.max(3 * intervalSeconds * 1000, 15_000), 30_000);
}

/**
 * Runs every 5 seconds to detect devices that stopped posting (no MQTT).
 */
export function startOfflineMonitor(db: WeatherDb, wsHub: WeatherWsHub): NodeJS.Timeout {
  return setInterval(() => {
    const now = Date.now();
    const onlineDevices = db.getAllOnlineDevices();

    for (const device of onlineDevices) {
      const lastSeenMs = Date.parse(device.lastSeen);
      const thresholdMs = computeOfflineThresholdMs(device.intervalSeconds);

      if (now - lastSeenMs > thresholdMs) {
        db.markDeviceOffline(device.deviceId);
        logger.warn(
          `Device transition device=${device.deviceId} state=OFFLINE lastSeen=${device.lastSeen} thresholdMs=${thresholdMs}`
        );
        wsHub.broadcast({
          type: "device",
          deviceId: device.deviceId,
          online: false,
          lastSeen: device.lastSeen,
        });
      }
    }
  }, 5_000);
}
