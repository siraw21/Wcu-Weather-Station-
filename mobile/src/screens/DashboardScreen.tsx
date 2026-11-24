import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { askQuestion, requestInterpretation } from "../lib/api";
import { useLive } from "../lib/live";
import { Icon, IconName } from "../components/Icons";
import { Banner, Button, Card, Chip } from "../components/ui";
import { COLORS, formatDateTime, formatTime, RADIUS } from "../theme";
import { AskResponse, InterpretResponse } from "../types";

const Metric: React.FC<{
  icon: IconName;
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  stale?: boolean;
  meter?: number;
  capitalize?: boolean;
}> = ({ icon, label, value, unit, sub, stale, meter, capitalize }) => (
  <Card style={styles.tile}>
    <View style={styles.metricLabelRow}>
      <Icon name={icon} size={18} />
      <Text style={styles.metricLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
    <Text
      style={[
        styles.metricValue,
        capitalize && { fontSize: 22, textTransform: "capitalize" },
        stale && { opacity: 0.45 },
      ]}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {value}
      {unit ? <Text style={styles.metricUnit}> {unit}</Text> : null}
    </Text>
    {meter !== undefined && (
      <View style={styles.meter}>
        <View style={[styles.meterFill, { width: `${Math.min(Math.max(meter, 0), 100)}%` }]} />
      </View>
    )}
    {sub ? <Text style={styles.metricSub}>{sub}</Text> : null}
  </Card>
);

export const DashboardScreen: React.FC = () => {
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
  const deviceId = reading?.deviceId ?? device?.deviceId;
  const lastSeenLabel = device?.lastSeen ? `last seen at ${formatTime(device.lastSeen)}` : "never seen";

  const onInterpret = async (): Promise<void> => {
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

  const onAsk = async (): Promise<void> => {
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
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {wsState === "reconnecting" && <Banner tone="warn" text="Reconnecting… live updates are paused." />}
      {!online && hasData && (
        <Banner tone="warn" text={`Station offline: showing the last known values (${lastSeenLabel}).`} />
      )}
      {!hasData && <Banner text="Waiting for the first reading from the station…" />}

      <Card style={styles.hero}>
        <View style={styles.heroHead}>
          <View style={styles.metricLabelRow}>
            <Icon name="thermometer" size={18} />
            <Text style={styles.heroLabel}>Temperature</Text>
          </View>
          <Chip label={deviceId ? `Station ${deviceId}` : "No station"} />
        </View>
        <Text style={[styles.heroValue, stale && { opacity: 0.45 }]} numberOfLines={1} adjustsFontSizeToFit>
          {tempC !== null ? tempC.toFixed(1) : "—"}
          <Text style={styles.heroUnit}>°C</Text>
        </Text>
        <Text style={styles.heroSub}>
          {reading ? `Updated ${formatDateTime(reading.receivedAt)}` : "No readings yet"}
        </Text>
        <View style={styles.heroFacts}>
          <View>
            <Text style={styles.factLabel}>BMP280 sensor</Text>
            <Text style={styles.factValue}>
              {reading?.bmpTemperatureC != null ? `${reading.bmpTemperatureC.toFixed(1)} °C` : "—"}
            </Text>
          </View>
          <View>
            <Text style={styles.factLabel}>Update interval</Text>
            <Text style={styles.factValue}>
              {device?.intervalSeconds ? `${device.intervalSeconds} s` : "—"}
            </Text>
          </View>
        </View>
      </Card>

      <View style={styles.grid}>
        <Metric
          icon="droplet"
          label="Humidity"
          value={humidity !== null ? humidity.toFixed(0) : "—"}
          unit="%"
          meter={humidity ?? 0}
          stale={stale}
        />
        <Metric
          icon="gauge"
          label="Pressure"
          value={pressure !== null ? pressure.toFixed(1) : "—"}
          unit="hPa"
          sub="Barometer"
          stale={stale}
        />
        <Metric
          icon="dew"
          label="Dew point"
          value={indicators?.dewPointC != null ? indicators.dewPointC.toFixed(1) : "—"}
          unit="°C"
          sub="Calculated"
        />
        <Metric
          icon={trend === "rising" ? "up" : trend === "falling" ? "down" : "steady"}
          label="Pressure trend"
          value={indicators ? trend : "—"}
          capitalize
          sub={
            indicators?.deltaHpa3h != null
              ? `${indicators.deltaHpa3h >= 0 ? "+" : ""}${indicators.deltaHpa3h.toFixed(2)} hPa over 3 h`
              : "Not enough pressure data yet"
          }
        />
      </View>

      <Card style={styles.ai}>
        <Text style={styles.sectionTitle}>Weather interpretation</Text>
        <Text style={styles.muted}>A plain-language read of current conditions.</Text>
        <Button
          label="Interpret conditions"
          onPress={onInterpret}
          loading={interpretLoading}
          style={{ alignSelf: "flex-start", marginTop: 14 }}
        />

        {interpretError && <Text style={styles.reply}>{interpretError}</Text>}
        {interpretResult && (
          <View style={styles.reply}>
            {interpretResult.available ? (
              <>
                <Text style={styles.replyText}>{interpretResult.text}</Text>
                <Text style={styles.replyMeta}>
                  {interpretResult.model} · {interpretResult.cached ? "Cached (under 5 min)" : "Fresh"} ·{" "}
                  {formatDateTime(interpretResult.createdAt)}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.fallbackTag}>{interpretResult.message}. Not AI generated</Text>
                <Text style={styles.replyText}>{interpretResult.fallback}</Text>
              </>
            )}
          </View>
        )}

        <View style={styles.askRow}>
          <TextInput
            style={styles.input}
            placeholder="Ask about the station data"
            placeholderTextColor={COLORS.ink3}
            value={question}
            onChangeText={setQuestion}
            editable={!askLoading}
            returnKeyType="send"
            onSubmitEditing={onAsk}
          />
          <Button
            label="Ask"
            variant="secondary"
            onPress={onAsk}
            loading={askLoading}
            disabled={!question.trim()}
          />
        </View>

        {askError && <Text style={styles.reply}>{askError}</Text>}
        {askResult && (
          <View style={styles.reply}>
            <Text style={styles.replyText}>{askResult.available ? askResult.text : askResult.message}</Text>
            {askResult.available && <Text style={styles.replyMeta}>{askResult.model}</Text>}
          </View>
        )}
      </Card>

      <Text style={styles.footer}>Wachemo University Weather Station · ESP32 · DHT11 · BMP280</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 28 },
  hero: { padding: 22, borderRadius: RADIUS.lg, marginBottom: 14 },
  heroHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  heroLabel: { fontSize: 14, fontWeight: "600", color: COLORS.ink2 },
  heroValue: { fontSize: 84, fontWeight: "300", color: COLORS.navy, letterSpacing: -3 },
  heroUnit: { fontSize: 28, fontWeight: "400", color: COLORS.ink2, letterSpacing: 0 },
  heroSub: { fontSize: 13, color: COLORS.ink2, marginTop: 4 },
  heroFacts: { flexDirection: "row", gap: 32, marginTop: 18 },
  factLabel: { fontSize: 12, fontWeight: "600", color: COLORS.ink3, marginBottom: 2 },
  factValue: { fontSize: 18, fontWeight: "600", color: COLORS.navy },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 14 },
  tile: { width: "48%", flexGrow: 1, minHeight: 132, padding: 16 },
  metricLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  metricLabel: { flex: 1, fontSize: 13, fontWeight: "600", color: COLORS.ink2 },
  metricValue: { marginTop: "auto", paddingTop: 12, fontSize: 30, fontWeight: "600", color: COLORS.navy },
  metricUnit: { fontSize: 14, fontWeight: "500", color: COLORS.ink2 },
  metricSub: { fontSize: 12, color: COLORS.ink3, marginTop: 6 },
  meter: { height: 6, borderRadius: 3, backgroundColor: "rgba(15,27,45,0.08)", overflow: "hidden", marginTop: 10 },
  meterFill: { height: "100%", borderRadius: 3, backgroundColor: COLORS.primary },
  ai: { padding: 20, borderRadius: RADIUS.lg },
  sectionTitle: { fontSize: 19, fontWeight: "700", color: COLORS.navy },
  muted: { fontSize: 14, color: COLORS.ink2, marginTop: 2 },
  reply: {
    marginTop: 16,
    padding: 14,
    borderRadius: RADIUS.sm,
    backgroundColor: "rgba(31,95,214,0.06)",
    borderWidth: 1,
    borderColor: "rgba(31,95,214,0.12)",
    color: COLORS.ink,
    fontSize: 14,
  },
  replyText: { fontSize: 14, lineHeight: 21, color: COLORS.ink },
  replyMeta: { fontSize: 11, color: COLORS.ink3, marginTop: 8 },
  fallbackTag: {
    alignSelf: "flex-start",
    color: COLORS.danger,
    backgroundColor: "rgba(214,69,69,0.12)",
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
    overflow: "hidden",
    marginBottom: 8,
  },
  askRow: { flexDirection: "row", gap: 10, marginTop: 18, alignItems: "center" },
  input: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderColor: "rgba(15,27,45,0.09)",
    borderRadius: RADIUS.pill,
    paddingHorizontal: 18,
    fontSize: 15,
    color: COLORS.ink,
    backgroundColor: "rgba(255,255,255,0.8)",
  },
  footer: { textAlign: "center", fontSize: 12, color: COLORS.ink3, marginTop: 20 },
});
