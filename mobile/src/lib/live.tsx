import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getIndicators, getLatestReading } from "./api";
import { connectWeatherWs, WsConnectionState } from "./ws";
import { DeviceStatus, Indicators, ReadingRecord } from "../types";

interface LiveState {
  reading: ReadingRecord | null;
  device: DeviceStatus | null;
  indicators: Indicators | null;
  wsState: WsConnectionState;
  online: boolean;
  hasData: boolean;
}

const LiveContext = createContext<LiveState | null>(null);

/** One WebSocket + initial fetch shared by the header, Dashboard and History. */
export const LiveProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [reading, setReading] = useState<ReadingRecord | null>(null);
  const [device, setDevice] = useState<DeviceStatus | null>(null);
  const [indicators, setIndicators] = useState<Indicators | null>(null);
  const [wsState, setWsState] = useState<WsConnectionState>("connecting");

  useEffect(() => {
    const refreshIndicators = (): void => {
      getIndicators()
        .then(setIndicators)
        .catch(() => {});
    };

    getLatestReading()
      .then((data) => {
        if (data) {
          setReading(data.reading);
          setDevice(data.device);
        }
      })
      .catch(() => {});
    refreshIndicators();

    return connectWeatherWs({
      onStateChange: setWsState,
      onMessage: (msg) => {
        if (msg.type === "snapshot") {
          setReading(msg.reading);
          setDevice(msg.device);
          refreshIndicators();
        } else if (msg.type === "reading") {
          setReading(msg.reading);
          setDevice((prev) => ({
            deviceId: msg.reading.deviceId,
            online: true,
            lastSeen: msg.reading.receivedAt,
            intervalSeconds: prev?.intervalSeconds ?? 5,
          }));
          refreshIndicators();
        } else if (msg.type === "device") {
          setDevice((prev) => ({
            deviceId: msg.deviceId,
            online: msg.online,
            lastSeen: msg.lastSeen,
            intervalSeconds: prev?.intervalSeconds ?? 5,
          }));
        }
      },
    });
  }, []);

  const value = useMemo<LiveState>(
    () => ({ reading, device, indicators, wsState, online: device?.online ?? false, hasData: reading !== null }),
    [reading, device, indicators, wsState]
  );

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
};

export function useLive(): LiveState {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error("useLive must be used inside <LiveProvider>");
  return ctx;
}
