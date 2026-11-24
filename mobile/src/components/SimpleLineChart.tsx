import React, { useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";
import { Card } from "./ui";
import { COLORS } from "../theme";

interface Props {
  title: string;
  unit: string;
  color: string;
  decimals: number;
  values: Array<number | null>;
  times: string[];
  timeFormat: (iso: string) => string;
}

const HEIGHT = 150;
const PAD_X = 6;
const PAD_Y = 10;

/** Lightweight SVG area chart with gaps for null values and min/avg/max summary. */
export const SimpleLineChart: React.FC<Props> = ({ title, unit, color, decimals, values, times, timeFormat }) => {
  const [width, setWidth] = useState(300);
  const onLayout = (e: LayoutChangeEvent): void => setWidth(Math.max(e.nativeEvent.layout.width, 100));

  const valid = values.filter((v): v is number => v !== null && Number.isFinite(v));

  const header = (
    <View style={styles.head}>
      <Text style={styles.title}>
        {title} <Text style={styles.unit}>{unit}</Text>
      </Text>
      {valid.length > 0 && (
        <Text style={styles.stats}>
          Min <Text style={styles.statVal}>{Math.min(...valid).toFixed(decimals)}</Text>
          {"  "}Avg{" "}
          <Text style={styles.statVal}>{(valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(decimals)}</Text>
          {"  "}Max <Text style={styles.statVal}>{Math.max(...valid).toFixed(decimals)}</Text>
        </Text>
      )}
    </View>
  );

  if (valid.length === 0) {
    return (
      <Card style={styles.card}>
        {header}
        <Text style={styles.empty}>No valid values in this range.</Text>
      </Card>
    );
  }

  let min = Math.min(...valid);
  let max = Math.max(...valid);
  if (min === max) {
    min -= 1;
    max += 1;
  }

  const usableW = width - PAD_X * 2;
  const usableH = HEIGHT - PAD_Y * 2;
  const stepX = values.length > 1 ? usableW / (values.length - 1) : 0;
  const yOf = (v: number): number => PAD_Y + usableH - ((v - min) / (max - min)) * usableH;

  const lines: string[] = [];
  const areas: string[] = [];
  let seg: Array<[number, number]> = [];
  const flush = (): void => {
    if (seg.length > 1) {
      const d = seg.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
      lines.push(d);
      const first = seg[0]!;
      const last = seg[seg.length - 1]!;
      areas.push(`${d} L ${last[0].toFixed(1)} ${HEIGHT - PAD_Y} L ${first[0].toFixed(1)} ${HEIGHT - PAD_Y} Z`);
    }
    seg = [];
  };
  values.forEach((v, i) => {
    if (v === null || !Number.isFinite(v)) {
      flush();
      return;
    }
    seg.push([PAD_X + i * stepX, yOf(v)]);
  });
  flush();

  const gradId = `fill-${title}`;

  return (
    <Card style={styles.card}>
      {header}
      <View onLayout={onLayout}>
        <Svg width={width} height={HEIGHT}>
          <Defs>
            <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.32} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {[0, 0.5, 1].map((f) => (
            <Line
              key={f}
              x1={PAD_X}
              x2={width - PAD_X}
              y1={PAD_Y + usableH * f}
              y2={PAD_Y + usableH * f}
              stroke="rgba(15,27,45,0.08)"
              strokeWidth={1}
            />
          ))}
          {areas.map((d, i) => (
            <Path key={`a${i}`} d={d} fill={`url(#${gradId})`} />
          ))}
          {lines.map((d, i) => (
            <Path key={`l${i}`} d={d} fill="none" stroke={color} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
          ))}
        </Svg>
      </View>
      <View style={styles.axis}>
        <Text style={styles.axisText}>{times.length ? timeFormat(times[0]!) : ""}</Text>
        <Text style={styles.axisText}>{times.length ? timeFormat(times[times.length - 1]!) : ""}</Text>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { padding: 16, marginBottom: 14 },
  head: { marginBottom: 8, gap: 2 },
  title: { fontSize: 16, fontWeight: "700", color: COLORS.navy },
  unit: { fontSize: 13, fontWeight: "500", color: COLORS.ink3 },
  stats: { fontSize: 12, color: COLORS.ink3 },
  statVal: { fontWeight: "700", color: COLORS.ink },
  axis: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  axisText: { fontSize: 11, color: COLORS.ink3 },
  empty: { color: COLORS.ink2, paddingVertical: 20, textAlign: "center" },
});
