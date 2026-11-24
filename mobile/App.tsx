import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandMark } from "./src/components/BrandMark";
import { Icon, IconName } from "./src/components/Icons";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { HistoryScreen } from "./src/screens/HistoryScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { LiveProvider, useLive } from "./src/lib/live";
import { loadServerConfig } from "./src/lib/settings";
import { BRAND, CARD, COLORS, RADIUS, sceneColors } from "./src/theme";

type Tab = "dashboard" | "history" | "settings";

const TABS: Array<{ key: Tab; label: string; icon: IconName }> = [
  { key: "dashboard", label: "Dashboard", icon: "dashboard" },
  { key: "history", label: "History", icon: "history" },
  { key: "settings", label: "Settings", icon: "settings" },
];

const Header: React.FC = () => {
  const { online, wsState } = useLive();
  const label = online ? "Online" : wsState === "reconnecting" ? "Reconnecting" : "Offline";
  return (
    <View style={styles.header}>
      <BrandMark size={42} />
      <View style={{ flex: 1 }}>
        <Text style={styles.eyebrow}>{BRAND.university.toUpperCase()}</Text>
        <Text style={styles.title}>{BRAND.product}</Text>
      </View>
      <View style={[styles.status, CARD, { borderRadius: RADIUS.pill }]}>
        <View style={[styles.dot, { backgroundColor: online ? COLORS.ok : COLORS.ink3 }]} />
        <Text style={[styles.statusText, online && { color: COLORS.ok }]}>{label}</Text>
      </View>
    </View>
  );
};

/** Unconfigured state: only the Settings screen is shown (no live data yet). */
const SetupHeader: React.FC = () => (
  <View style={styles.header}>
    <BrandMark size={42} />
    <View style={{ flex: 1 }}>
      <Text style={styles.eyebrow}>{BRAND.university.toUpperCase()}</Text>
      <Text style={styles.title}>{BRAND.product}</Text>
    </View>
  </View>
);

const Main: React.FC<{
  tab: Tab;
  setTab: (t: Tab) => void;
  onSaved: () => void;
}> = ({ tab, setTab, onSaved }) => {
  const { reading } = useLive();
  const insets = useSafeAreaInsets();
  const scene = sceneColors(reading?.temperatureC ?? null);

  return (
    <LinearGradient colors={[scene.top, scene.bottom]} style={styles.flex}>
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <Header />
        <View style={styles.flex}>
          {tab === "dashboard" && <DashboardScreen />}
          {tab === "history" && <HistoryScreen />}
          {tab === "settings" && <SettingsScreen firstRun={false} onSaved={onSaved} />}
        </View>
        <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          {TABS.map(({ key, label, icon }) => {
            const active = tab === key;
            return (
              <Pressable key={key} style={styles.tabBtn} onPress={() => setTab(key)} accessibilityRole="tab">
                <Icon name={icon} size={22} color={active ? COLORS.primary : COLORS.ink3} />
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </LinearGradient>
  );
};

function Root(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [loaded, setLoaded] = useState(false);
  const [configured, setConfigured] = useState(false);
  // bumped on every save so the live connection is rebuilt against the new server
  const [configVersion, setConfigVersion] = useState(0);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadServerConfig().then((cfg) => {
      setConfigured(!!cfg);
      setLoaded(true);
    });
  }, []);

  const onSaved = (): void => {
    setConfigured(true);
    setConfigVersion((v) => v + 1);
    setTab("dashboard");
  };

  const bg = sceneColors(null);

  if (!loaded) {
    return (
      <LinearGradient colors={[bg.top, bg.bottom]} style={[styles.flex, styles.center]}>
        <ActivityIndicator color={COLORS.primary} />
      </LinearGradient>
    );
  }

  if (!configured) {
    return (
      <LinearGradient colors={[bg.top, bg.bottom]} style={styles.flex}>
        <View style={{ flex: 1, paddingTop: insets.top }}>
          <SetupHeader />
          <SettingsScreen firstRun onSaved={onSaved} />
        </View>
      </LinearGradient>
    );
  }

  return (
    <LiveProvider key={configVersion}>
      <Main tab={tab} setTab={setTab} onSaved={onSaved} />
    </LiveProvider>
  );
}

export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Root />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, color: COLORS.primary },
  title: { fontSize: 20, fontWeight: "700", color: COLORS.navy, letterSpacing: -0.3 },
  status: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 12, paddingVertical: 7 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: "600", color: COLORS.ink2 },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.88)",
    borderTopWidth: 1,
    borderTopColor: "rgba(15,27,45,0.08)",
    paddingTop: 8,
  },
  tabBtn: { flex: 1, alignItems: "center", gap: 3, paddingVertical: 4 },
  tabText: { fontSize: 12, fontWeight: "600", color: COLORS.ink3 },
  tabTextActive: { color: COLORS.primary },
});
