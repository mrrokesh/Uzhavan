import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, shadow } from "../theme";

export function Card({
  children,
  selected,
  onPress,
  style,
}: {
  children: ReactNode;
  selected?: boolean;
  onPress?: () => void;
  style?: object;
}) {
  const inner = (
    <View style={[styles.card, selected && styles.cardSelected, style]}>{children}</View>
  );
  if (!onPress) return inner;
  return <Pressable onPress={onPress}>{inner}</Pressable>;
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.primary, disabled && { opacity: 0.4 }]}>
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

export function OutlineButton({
  label,
  onPress,
  tone = "default",
  icon,
}: {
  label: string;
  onPress?: () => void;
  tone?: "default" | "danger";
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const color = tone === "danger" ? colors.danger : colors.forest;
  return (
    <Pressable onPress={onPress} style={[styles.outline, { borderColor: tone === "danger" ? colors.danger : "#1B5E3B33" }]}>
      {icon ? <Ionicons name={icon} size={16} color={color} /> : null}
      <Text style={[styles.outlineText, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  tone = "neutral",
  onPress,
}: {
  label: string;
  active?: boolean;
  tone?: "neutral" | "amber" | "mint" | "forest";
  onPress?: () => void;
}) {
  const bg =
    tone === "amber"
      ? colors.amberBg
      : tone === "mint"
        ? colors.mint
        : tone === "forest" || active
          ? colors.forest
          : colors.white;
  const fg =
    tone === "amber"
      ? colors.amberText
      : tone === "mint"
        ? colors.forest
        : tone === "forest" || active
          ? colors.white
          : colors.ink;
  const node = (
    <View style={[styles.chip, { backgroundColor: bg, borderColor: tone === "neutral" && !active ? colors.line : "transparent" }]}>
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{node}</Pressable> : node;
}

export function Row({
  label,
  value,
  strong,
  green,
}: {
  label: string;
  value: string;
  strong?: boolean;
  green?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[
          styles.rowValue,
          strong && { fontWeight: "600" },
          green && { color: colors.forest, fontSize: 17, fontWeight: "700" },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function InfoNote({ children, tone = "mint" }: { children: ReactNode; tone?: "mint" | "amber" }) {
  return (
    <View style={[styles.note, { backgroundColor: tone === "amber" ? colors.amberBg : colors.mint }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    ...shadow,
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: colors.forest,
  },
  primary: {
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.forest,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: colors.white, fontSize: 15, fontWeight: "600" },
  outline: {
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    flex: 1,
  },
  outlineText: { fontSize: 15, fontWeight: "600" },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: "500" },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 10 },
  rowLabel: { fontSize: 13, color: colors.muted, flex: 1 },
  rowValue: { fontSize: 13, color: colors.ink, fontWeight: "500", textAlign: "right", flex: 1 },
  divider: { height: 1, backgroundColor: colors.line },
  note: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", gap: 10 },
});
