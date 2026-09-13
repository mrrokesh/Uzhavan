import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import { APP_NAME } from "../lib/appInfo";
import { colors } from "../theme";

/**
 * The wordmark, which is whichever app this build is.
 *
 * It was hardcoded to "Uzhavan", so Uzhavan Buy shipped with the wrong name at
 * the top of every screen — the launcher icon and splash said one thing and the
 * app itself said another. Reading APP_NAME keeps the two from drifting again.
 */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <View style={styles.row}>
      <Ionicons name="leaf" size={compact ? 20 : 24} color={colors.forest} />
      <Text style={[styles.word, compact && { fontSize: 18 }]}>{APP_NAME}</Text>
    </View>
  );
}

export function SuccessMark() {
  return (
    <View style={styles.wrap}>
      <Svg width={34} height={40} viewBox="0 0 34 40" style={styles.leafL}>
        <Path d="M18 36c1-12-7-18-14-20 3 9 8 16 14 20z" fill="#1B5E3B" opacity="0.35" />
        <Path d="M20 34c3-10 10-14 14-15-2 8-7 12-14 15z" fill="#2E8A55" opacity="0.45" />
      </Svg>
      <View style={styles.circle}>
        <Ionicons name="checkmark" size={36} color={colors.forest} />
      </View>
      <Svg width={34} height={40} viewBox="0 0 34 40" style={styles.leafR}>
        <Path d="M18 36c1-12-7-18-14-20 3 9 8 16 14 20z" fill="#1B5E3B" opacity="0.35" />
        <Path d="M20 34c3-10 10-14 14-15-2 8-7 12-14 15z" fill="#2E8A55" opacity="0.45" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  word: { fontSize: 20, fontWeight: "700", color: colors.forest, letterSpacing: -0.3 },
  wrap: { flexDirection: "row", alignItems: "center", justifyContent: "center", height: 108 },
  circle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  leafL: { marginRight: -6 },
  leafR: { marginLeft: -6, transform: [{ scaleX: -1 }] },
});
