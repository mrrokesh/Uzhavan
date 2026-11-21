import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

/** Pickup and drop as a route list. No illustrated map. */
export function MapView({
  variant = "route",
  pickupLabel = "Pickup",
  dropLabel = "Delivery",
  chip,
}: {
  variant?: "route" | "nearby" | "finding" | "tracking";
  pickupLabel?: string;
  dropLabel?: string;
  chip?: string;
}) {
  const status =
    chip ??
    (variant === "finding"
      ? "Waiting for a driver"
      : variant === "tracking"
        ? "In transit"
        : variant === "nearby"
          ? "Trucks near pickup"
          : "Route");

  return (
    <View style={styles.map}>
      <Text style={styles.status}>{status}</Text>
      <Stop icon="ellipse-outline" label="Pickup" value={pickupLabel} />
      <View style={styles.rail} />
      <Stop icon="location-outline" label="Delivery" value={dropLabel} />
    </View>
  );
}

function Stop({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.stop}>
      <Ionicons name={icon} size={16} color={colors.ink} />
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingHorizontal: 16,
    paddingVertical: 16,
    justifyContent: "center",
    gap: 4,
  },
  status: { fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 8 },
  stop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  rail: { width: 1, height: 16, backgroundColor: colors.line, marginLeft: 7 },
  label: { fontSize: 11, color: colors.faint },
  value: { fontSize: 14, fontWeight: "600", color: colors.ink },
});
