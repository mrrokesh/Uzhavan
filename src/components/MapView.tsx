import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

export function MapView({
  variant = "route",
  pickupLabel = "Muthu Farms",
  dropLabel = "Salem Agro Warehouse",
  chip,
}: {
  variant?: "route" | "nearby" | "finding" | "tracking";
  pickupLabel?: string;
  dropLabel?: string;
  chip?: string;
}) {
  return (
    <View style={[styles.map, variant === "finding" && { opacity: 0.55 }]}>
      <View style={styles.roadH} />
      <View style={styles.roadV} />
      <View style={styles.route} />
      <View style={[styles.badge, { top: "42%", left: "40%" }]}>
        <Text style={styles.badgeText}>57 km</Text>
      </View>
      <Pin top="70%" left="16%" label={pickupLabel} color={colors.forest} />
      <Pin top="18%" left="68%" label={dropLabel} color={colors.amberText} />
      {(variant === "nearby" || variant === "finding") && (
        <>
          <TruckDot top="56%" left="38%" />
          <TruckDot top="44%" left="54%" />
          <TruckDot top="32%" left="46%" />
          <View style={[styles.you, { top: "62%", left: "48%" }]} />
        </>
      )}
      {variant === "tracking" ? (
        <View style={[styles.truckMove, { top: "46%", left: "40%" }]}>
          <Ionicons name="car" size={16} color={colors.white} />
        </View>
      ) : null}
      {chip ? (
        <View style={styles.chip}>
          <Text style={styles.chipText}>{chip}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Pin({ top, left, label, color }: { top: `${number}%`; left: `${number}%`; label: string; color: string }) {
  return (
    <View style={[styles.pinWrap, { top, left }]}>
      <View style={styles.pinLabel}>
        <Text style={styles.pinText}>{label}</Text>
      </View>
      <View style={[styles.pin, { backgroundColor: color }]} />
    </View>
  );
}

function TruckDot({ top, left }: { top: `${number}%`; left: `${number}%` }) {
  return (
    <View style={[styles.truckDot, { top, left }]}>
      <Ionicons name="car" size={12} color={colors.white} />
    </View>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1, backgroundColor: "#d9e6d4", overflow: "hidden" },
  roadH: { position: "absolute", top: "58%", left: 0, right: 0, height: 12, backgroundColor: "#cfc4a8" },
  roadV: { position: "absolute", left: "46%", top: 0, bottom: 0, width: 12, backgroundColor: "#cfc4a8" },
  route: {
    position: "absolute",
    left: "20%",
    top: "24%",
    width: 180,
    height: 180,
    borderLeftWidth: 5,
    borderBottomWidth: 5,
    borderColor: colors.forest,
    borderRadius: 8,
    transform: [{ rotate: "18deg" }],
  },
  badge: { position: "absolute", backgroundColor: colors.forest, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  badgeText: { color: colors.white, fontSize: 9, fontWeight: "700" },
  pinWrap: { position: "absolute", alignItems: "center", width: 110, marginLeft: -55 },
  pinLabel: { backgroundColor: colors.white, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginBottom: 4 },
  pinText: { fontSize: 9, fontWeight: "600", color: colors.ink, textAlign: "center" },
  pin: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.white },
  truckDot: {
    position: "absolute",
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.forest,
    alignItems: "center",
    justifyContent: "center",
  },
  you: { position: "absolute", width: 12, height: 12, borderRadius: 6, backgroundColor: "#2B7BFF", borderWidth: 2, borderColor: colors.white },
  truckMove: {
    position: "absolute",
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.forest,
    alignItems: "center",
    justifyContent: "center",
  },
  chip: {
    position: "absolute",
    top: 12,
    alignSelf: "center",
    left: "28%",
    backgroundColor: colors.mint,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.forest },
});
