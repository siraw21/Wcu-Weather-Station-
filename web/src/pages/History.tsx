import React, { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getExportCsvUrl, getHistory } from "../lib/api";
import { CHART_COLORS } from "../theme";
import { BucketedReading } from "../types";

type RangeKey = "1h" | "24h" | "7d";
type MetricKey = "temperatureC" | "humidityPct" | "pressureHpa";

const RANGES: Record<RangeKey, { label: string; ms: number; bucketSec: number }> = {
  "1h": { label: "1 h", ms: 60 * 60 * 1000, bucketSec: 15 },
  "24h": { label: "24 h", ms: 24 * 60 * 60 * 1000, bucketSec: 300 },
  "7d": { label: "7 d", ms: 7 * 24 * 60 * 60 * 1000, bucketSec: 1800 },
};

const CHARTS: Array<{ key: MetricKey; title: string; unit: string; decimals: number }> = [
  { key: "temperatureC", title: "Temperature", unit: "°C", decimals: 1 },
  { key: "humidityPct", title: "Humidity", unit: "%", decimals: 0 },
  { key: "pressureHpa", title: "Pressure", unit: "hPa", decimals: 1 },
];

function formatTick(iso: string, range: RangeKey): string {
  const d = new Date(iso);
  if (range === "7d") return d.toLocaleDateString([], { month: "short", day: "numeric" });
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function stats(points: BucketedReading[], key: MetricKey): { min: number; avg: number; max: number } | null {
  const vals = points.map((p) => p[key]).filter((v): v is number => v !== null && Number.isFinite(v));
  if (vals.length === 0) return null;
  return {
    min: Math.min(...vals),
    max: Math.max(...vals),
    avg: vals.reduce((a, b) => a + b, 0) / vals.length,
  };
}

export const History: React.FC = () => {
  const [range, setRange] = useState<RangeKey>("1h");
  const [points, setPoints] = useState<BucketedReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [windowIso, setWindowIso] = useState<{ from: string; to: string }>({
    from: new Date(Date.now() - RANGES["1h"].ms).toISOString(),
    to: new Date().toISOString(),
  });

  useEffect(() => {
    let active = true;
    setLoading(true);

    const cfg = RANGES[range];
    const to = new Date().toISOString();
    const from = new Date(Date.now() - cfg.ms).toISOString();
    setWindowIso({ from, to });

    getHistory(from, to, cfg.bucketSec)
      .then((data) => {
        if (active) setPoints(data);
      })
      .catch(() => {
        if (active) setPoints([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [range]);

  const summary = useMemo(
    () => Object.fromEntries(CHARTS.map((c) => [c.key, stats(points, c.key)])) as Record<MetricKey, ReturnType<typeof stats>>,
    [points]
  );

  return (
    <div className="page">
      <div className="toolbar">
        <div className="segmented glass" role="tablist" aria-label="Time range">
          {(Object.keys(RANGES) as RangeKey[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={range === key}
              className={range === key ? "active" : ""}
              onClick={() => setRange(key)}
            >
              {RANGES[key].label}
            </button>
          ))}
        </div>

        <a className="btn-secondary" href={getExportCsvUrl(windowIso.from, windowIso.to)} download>
          Export CSV
        </a>
      </div>

      {loading ? (
        <div className="glass empty-state">Loading history…</div>
      ) : points.length === 0 ? (
        <div className="glass empty-state">
          No readings in the last {RANGES[range].label}. Try a longer range.
        </div>
      ) : (
        CHARTS.map((chart) => {
          const color = CHART_COLORS[chart.key];
          const s = summary[chart.key];
          return (
            <section className="glass chart-card" key={chart.key}>
              <div className="chart-head">
                <h3 className="chart-title">
                  {chart.title} <span>{chart.unit}</span>
                </h3>
                {s && (
                  <div className="chart-stats">
                    <span>Min <b>{s.min.toFixed(chart.decimals)}</b></span>
                    <span>Avg <b>{s.avg.toFixed(chart.decimals)}</b></span>
                    <span>Max <b>{s.max.toFixed(chart.decimals)}</b></span>
                  </div>
                )}
              </div>
              <div className="chart-box">
                <ResponsiveContainer>
                  <AreaChart data={points} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id={`fill-${chart.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.32} />
                        <stop offset="100%" stopColor={color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="time"
                      tickFormatter={(v: string) => formatTick(v, range)}
                      minTickGap={36}
                      axisLine={false}
                      tickLine={false}
                      tickMargin={10}
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      axisLine={false}
                      tickLine={false}
                      width={chart.decimals === 0 ? 40 : 56}
                      tickFormatter={(v: number) => Number(v).toFixed(chart.decimals)}
                    />
                    <Tooltip
                      cursor={{ stroke: color, strokeOpacity: 0.4, strokeWidth: 1 }}
                      content={({ active, payload }) => {
                        const p = payload?.[0];
                        if (!active || !p) return null;
                        return (
                          <div className="chart-tip">
                            <b>
                              {p.value} {chart.unit}
                            </b>
                            <span>{new Date(String(p.payload.time)).toLocaleString()}</span>
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey={chart.key}
                      stroke={color}
                      strokeWidth={2.5}
                      fill={`url(#fill-${chart.key})`}
                      dot={false}
                      activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff", fill: color }}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
};
