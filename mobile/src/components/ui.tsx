import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { CARD, COLORS, RADIUS } from "../theme";

export const Card: React.FC<{ style?: StyleProp<ViewStyle>; children: React.ReactNode }> = ({
  style,
  children,
}) => <View style={[styles.card, style]}>{children}</View>;

export const Chip: React.FC<{ label: string }> = ({ label }) => (
  <View style={styles.chip}>
    <Text style={styles.chipText}>{label}</Text>
  </View>
);

interface ButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary";
  style?: StyleProp<ViewStyle>;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  disabled,
  loading,
  variant = "primary",
  style,
}) => {
  const primary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        primary ? styles.btnPrimary : styles.btnSecondary,
        (disabled || loading) && { opacity: 0.5 },
        pressed && { transform: [{ scale: 0.97 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? "#fff" : COLORS.primary} />
      ) : (
        <Text numberOfLines={1} style={[styles.btnText, { color: primary ? "#fff" : COLORS.primary }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
};

export const Banner: React.FC<{ text: string; tone?: "info" | "warn" }> = ({ text, tone = "info" }) => (
  <View style={[styles.banner, CARD]}>
    <Text style={[styles.bannerText, tone === "warn" && { color: COLORS.warn }]}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: { ...CARD, padding: 18 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: "rgba(31,95,214,0.10)",
  },
  chipText: { color: COLORS.primary, fontSize: 12, fontWeight: "600" },
  btn: {
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimary: { backgroundColor: COLORS.primary },
  btnSecondary: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: "rgba(31,95,214,0.25)",
  },
  btnText: { fontSize: 15, fontWeight: "600" },
  banner: { padding: 12, paddingHorizontal: 16, borderRadius: RADIUS.sm, marginBottom: 14 },
  bannerText: { color: COLORS.ink2, fontSize: 14, fontWeight: "500" },
});
