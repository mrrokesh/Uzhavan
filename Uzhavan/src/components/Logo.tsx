import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
  return <Text style={[styles.word, compact && { fontSize: 18 }]}>{APP_NAME}</Text>;
}

export function SuccessMark() {
  return (
    <View style={styles.wrap}>
      <View style={styles.circle}>
        <Ionicons name="checkmark" size={36} color={colors.forest} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  word: { fontSize: 20, fontWeight: "700", color: colors.forest, letterSpacing: -0.3 },
  wrap: { alignItems: "center", justifyContent: "center", height: 108 },
  circle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
  },
});
