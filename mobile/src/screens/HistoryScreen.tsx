import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getHistory } from "../lib/api";
import { SimpleLineChart } from "../components/SimpleLineChart";
import { Card } from "../components/ui";
import { CARD, CHART_COLORS, COLORS, RADIUS } from "../theme";
import { BucketedReading } from "../types";

type RangeKey = "1h" | "24h" | "7d";

const RANGES: Record<RangeKey, { label: string; ms: number; bucketSec: number }> = {
  "1h": { label: "1 h", ms: 60 * 60 * 1000, bucketSec: 15 },
  "24h": { label: "24 h", ms: 24 * 60 * 60 * 1000, bucketSec: 300 },
  "7d": { label: "7 d", ms: 7 * 24 * 60 * 60 * 1000, bucketSec: 1800 },
};

export const HistoryScreen: React.FC = () => {
  const [range, setRange] = useState<RangeKey>("1h");
  const [points, setPoints] = useState<BucketedReading[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const cfg = RANGES[range];
    const to = new Date().toISOString();
    const from = new Date(Date.now() - cfg.ms).toISOString();

    getHistory(from, to, cfg.bucketSec)
      .then((data) => active && setPoints(data))
      .catch(() => active && setPoints([]))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [range]);

  const timeFormat = (iso: string): string => {
    const d = new Date(iso);
    return range === "7d"
      ? d.toLocaleDateString([], { month: "short", day: "numeric" })
      : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };
  const times = points.map((p) => p.time);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.segmented}>
        {(Object.keys(RANGES) as RangeKey[]).map((key) => (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: range === key }}
            style={[styles.seg, range === key && styles.segActive]}
            onPress={() => setRange(key)}
          >
            <Text style={[styles.segText, range === key && styles.segTextActive]}>{RANGES[key].label}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : points.length === 0 ? (
        <Card style={{ alignItems: "center", paddingVertical: 40 }}>
          <Text style={styles.empty}>No readings in the last {RANGES[range].label}. Try a longer range.</Text>
        </Card>
      ) : (
        <>
          <SimpleLineChart
            title="Temperature"
            unit="°C"
            decimals={1}
            color={CHART_COLORS.temperatureC}
            values={points.map((p) => p.temperatureC)}
            times={times}
            timeFormat={timeFormat}
          />
          <SimpleLineChart
            title="Humidity"
            unit="%"
            decimals={0}
            color={CHART_COLORS.humidityPct}
            values={points.map((p) => p.humidityPct)}
            times={times}
            timeFormat={timeFormat}
          />
          <SimpleLineChart
            title="Pressure"
            unit="hPa"
            decimals={1}
            color={CHART_COLORS.pressureHpa}
            values={points.map((p) => p.pressureHpa)}
            times={times}
            timeFormat={timeFormat}
          />
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 28 },
  segmented: { ...CARD, flexDirection: "row", padding: 4, borderRadius: RADIUS.pill, marginBottom: 14 },
  seg: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.pill, alignItems: "center" },
  segActive: { backgroundColor: COLORS.primary },
  segText: { fontWeight: "600", color: COLORS.ink2, fontSize: 14 },
  segTextActive: { color: "#fff" },
  empty: { color: COLORS.ink2, textAlign: "center" },
});
