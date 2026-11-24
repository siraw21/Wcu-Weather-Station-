import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Button, Card } from "../components/ui";
import { DEFAULT_HOST, DEFAULT_PORT } from "../config";
import { COLORS, RADIUS } from "../theme";
import {
  getServerConfig,
  parseServerInput,
  saveServerConfig,
  testServerConfig,
} from "../lib/settings";

interface Props {
  firstRun: boolean;
  onSaved: () => void;
}

export const SettingsScreen: React.FC<Props> = ({ firstRun, onSaved }) => {
  const initial = getServerConfig();
  const [host, setHost] = useState(initial?.host ?? DEFAULT_HOST);
  const [port, setPort] = useState(initial?.port ?? DEFAULT_PORT);
  const [secure, setSecure] = useState(initial?.secure ?? false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const validate = () => {
    const parsed = parseServerInput(host, port, secure);
    if ("error" in parsed) {
      setMessage({ kind: "err", text: parsed.error });
      return null;
    }
    // reflect normalised values back in the form
    setHost(parsed.config.host);
    setPort(parsed.config.port);
    setSecure(parsed.config.secure);
    return parsed.config;
  };

  const onTest = async (): Promise<void> => {
    const config = validate();
    if (!config) return;
    setBusy(true);
    setMessage(null);
    const err = await testServerConfig(config);
    setBusy(false);
    setMessage(err ? { kind: "err", text: err } : { kind: "ok", text: "Connection successful." });
  };

  const onSave = async (): Promise<void> => {
    const config = validate();
    if (!config) return;
    setBusy(true);
    try {
      await saveServerConfig(config);
      setMessage({ kind: "ok", text: "Saved." });
      onSaved();
    } catch {
      setMessage({ kind: "err", text: "Could not save settings on this device." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {firstRun && (
          <View style={styles.infoBanner}>
            <Text style={styles.infoText}>
              Welcome! Enter the address of your weather station backend to get started. You can
              change it any time from this tab.
            </Text>
          </View>
        )}

        <Card style={{ gap: 6, borderRadius: RADIUS.lg, padding: 20 }}>
          <Text style={styles.title}>Backend server</Text>
          <Text style={styles.hint}>The address of the computer running the weather station backend.</Text>

          <Text style={styles.label}>IP address or hostname</Text>
          <TextInput
            style={styles.input}
            value={host}
            onChangeText={setHost}
            placeholder="e.g. 192.168.1.50"
            placeholderTextColor={COLORS.ink3}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <Text style={styles.label}>Port</Text>
          <TextInput
            style={styles.input}
            value={port}
            onChangeText={setPort}
            placeholder={DEFAULT_PORT}
            placeholderTextColor={COLORS.ink3}
            keyboardType="number-pad"
          />

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Use HTTPS / WSS</Text>
              <Text style={styles.hint}>Leave off for a plain LAN backend.</Text>
            </View>
            <Switch value={secure} onValueChange={setSecure} trackColor={{ true: COLORS.primary }} />
          </View>

          {message && (
            <Text style={message.kind === "ok" ? styles.okText : styles.errText}>
              {message.text}
            </Text>
          )}

          <View style={styles.btnRow}>
            <Button
              label="Test connection"
              variant="secondary"
              onPress={onTest}
              disabled={busy}
              style={{ flex: 1.6 }}
            />
            <Button label="Save" onPress={onSave} loading={busy} style={{ flex: 1 }} />
          </View>
        </Card>

        <Text style={styles.hint}>
          Tip: on a physical phone use your computer's LAN IP (not localhost). The Android
          emulator can use 10.0.2.2.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14, paddingBottom: 28 },
  infoBanner: { backgroundColor: "rgba(31,95,214,0.10)", borderRadius: RADIUS.sm, padding: 14 },
  infoText: { color: COLORS.navy, fontSize: 14, lineHeight: 20 },
  title: { fontSize: 19, fontWeight: "700", color: COLORS.navy, marginBottom: 6 },
  label: { fontSize: 13, fontWeight: "600", color: COLORS.ink2, marginTop: 10 },
  hint: { fontSize: 12, color: COLORS.ink3 },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "rgba(15,27,45,0.09)",
    borderRadius: RADIUS.pill,
    paddingHorizontal: 18,
    fontSize: 16,
    color: COLORS.ink,
    backgroundColor: "rgba(255,255,255,0.8)",
  },
  switchRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  okText: { color: COLORS.ok, marginTop: 10, fontWeight: "600" },
  errText: { color: COLORS.danger, marginTop: 10 },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 16 },
});
