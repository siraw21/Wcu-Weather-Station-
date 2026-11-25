import React, { useState } from "react";
import { askQuestion, requestInterpretation } from "../lib/api";
import { useLive } from "../lib/live";
import { Icon } from "../components/Icons";
import { formatDateTime, formatTime } from "../theme";
import { AskResponse, InterpretResponse } from "../types";

export const Dashboard: React.FC = () => {
  const { reading, device, indicators, wsState, online, hasData } = useLive();

  const [interpretLoading, setInterpretLoading] = useState(false);
  const [interpretResult, setInterpretResult] = useState<InterpretResponse | null>(null);
  const [interpretError, setInterpretError] = useState<string | null>(null);

  const [question, setQuestion] = useState("");
  const [askLoading, setAskLoading] = useState(false);
  const [askResult, setAskResult] = useState<AskResponse | null>(null);
  const [askError, setAskError] = useState<string | null>(null);

  const stale = !online;
  const tempC = reading?.temperatureC ?? null;
  const humidity = reading?.humidityPct ?? null;
  const pressure = reading?.pressureHpa ?? null;
  const trend = indicators?.pressureTendency ?? "steady";
  const lastSeenLabel = device?.lastSeen ? `last seen at ${formatTime(device.lastSeen)}` : "never seen";
  const deviceId = reading?.deviceId ?? device?.deviceId;

  const handleInterpret = async (): Promise<void> => {
    setInterpretLoading(true);
    setInterpretError(null);
    try {
      setInterpretResult(await requestInterpretation(deviceId));
    } catch {
      setInterpretError("Request timed out or the backend is unreachable.");
    } finally {
      setInterpretLoading(false);
    }
  };

  const handleAsk = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!question.trim()) return;
    setAskLoading(true);
    setAskError(null);
    try {
      setAskResult(await askQuestion(question.trim(), deviceId));
    } catch {
      setAskError("Request timed out or the backend is unreachable.");
    } finally {
      setAskLoading(false);
    }
  };

  return (
    <div className="page">
      {wsState === "reconnecting" && (
        <div className="banner banner-warn glass">Reconnecting… live updates are paused.</div>
      )}
      {!online && hasData && (
        <div className="banner banner-warn glass">
          Station offline: showing the last known values ({lastSeenLabel}).
        </div>
      )}
      {!hasData && (
        <div className="banner glass">Waiting for the first reading from the station…</div>
      )}

      <section className={`hero glass ${stale ? "stale" : ""}`}>
        <div className="hero-head">
          <span className="hero-label">
            <Icon name="thermometer" size={18} /> Temperature
          </span>
          <span className="chip">{deviceId ? `Station ${deviceId}` : "No station"}</span>
        </div>
        <div className="hero-body">
          <div>
            <div className="hero-value">
              {tempC !== null ? tempC.toFixed(1) : "—"}
              <span className="unit">°C</span>
            </div>
            <div className="hero-sub">
              {reading ? `Updated ${formatDateTime(reading.receivedAt)}` : "No readings yet"}
            </div>
          </div>
          <dl className="hero-facts">
            <div>
              <dt>BMP280 sensor</dt>
              <dd>{reading?.bmpTemperatureC != null ? `${reading.bmpTemperatureC.toFixed(1)} °C` : "—"}</dd>
            </div>
            <div>
              <dt>Update interval</dt>
              <dd>{device?.intervalSeconds ? `${device.intervalSeconds} s` : "—"}</dd>
            </div>
          </dl>
        </div>
      </section>

      <div className="grid">
        <div className={`tile glass ${stale ? "stale" : ""}`}>
          <div className="metric-label">
            <Icon name="droplet" /> Humidity
          </div>
          <div className="metric-value">
            {humidity !== null ? humidity.toFixed(0) : "—"}
            <small>%</small>
          </div>
          <div className="meter" aria-hidden="true">
            <span style={{ width: `${Math.min(Math.max(humidity ?? 0, 0), 100)}%` }} />
          </div>
        </div>

        <div className={`tile glass ${stale ? "stale" : ""}`}>
          <div className="metric-label">
            <Icon name="gauge" /> Pressure
          </div>
          <div className="metric-value">
            {pressure !== null ? pressure.toFixed(1) : "—"}
            <small>hPa</small>
          </div>
          <div className="metric-sub">Barometer</div>
        </div>

        <div className="tile glass">
          <div className="metric-label">
            <Icon name="dew" /> Dew point
          </div>
          <div className="metric-value">
            {indicators?.dewPointC != null ? indicators.dewPointC.toFixed(1) : "—"}
            <small>°C</small>
          </div>
          <div className="metric-sub">Calculated</div>
        </div>

        <div className="tile glass">
          <div className="metric-label">
            <Icon name={trend === "rising" ? "up" : trend === "falling" ? "down" : "steady"} />
            Pressure trend
          </div>
          <div className="metric-value tendency">{indicators ? trend : "—"}</div>
          <div className="metric-sub">
            {indicators?.deltaHpa3h != null
              ? `${indicators.deltaHpa3h >= 0 ? "+" : ""}${indicators.deltaHpa3h.toFixed(2)} hPa over 3 h`
              : "Not enough pressure data yet"}
          </div>
        </div>
      </div>

      <section className="ai glass">
        <h2>Weather interpretation</h2>
        <p className="muted">A plain-language read of current conditions.</p>
        <button
          type="button"
          className="btn-primary"
          onClick={handleInterpret}
          disabled={interpretLoading}
        >
          {interpretLoading ? "Interpreting…" : "Interpret conditions"}
        </button>

        {interpretError && <div className="reply">{interpretError}</div>}

        {interpretResult && (
          <div className="reply">
            {interpretResult.available ? (
              <>
                <p>{interpretResult.text}</p>
                <small>
                  {interpretResult.model} · {interpretResult.cached ? "Cached (under 5 min)" : "Fresh"} ·{" "}
                  {formatDateTime(interpretResult.createdAt)}
                </small>
              </>
            ) : (
              <>
                <div className="fallback-tag">{interpretResult.message}. Not AI generated</div>
                <p>{interpretResult.fallback}</p>
              </>
            )}
          </div>
        )}

        <form className="ask-form" onSubmit={handleAsk}>
          <input
            type="text"
            placeholder="Ask about the station data"
            aria-label="Ask about the station data"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={askLoading}
          />
          <button type="submit" className="btn-secondary" disabled={askLoading || !question.trim()}>
            {askLoading ? "Asking…" : "Ask"}
          </button>
        </form>

        {askError && <div className="reply">{askError}</div>}
        {askResult && (
          <div className="reply">
            {askResult.available ? (
              <>
                <p>{askResult.text}</p>
                <small>{askResult.model}</small>
              </>
            ) : (
              <p>{askResult.message}</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
