import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Chip } from "./ui";
import { useTickets, useVerification } from "../api/hooks";
import { useAuth } from "../context/AuthContext";
import type { SharedScreens } from "../navigation/types";
import { colors, shadow } from "../theme";

const STATUS: Record<string, { label: string; tone: "mint" | "amber" | "neutral" }> = {
  VERIFIED: { label: "Verified", tone: "mint" },
  PENDING: { label: "Under review", tone: "amber" },
  REJECTED: { label: "Action needed", tone: "amber" },
  UNVERIFIED: { label: "Not verified", tone: "neutral" },
};

/**
 * Verification and support entry points, shared by all three profile tabs so
 * the same links appear wherever someone goes looking for help.
 */
export function ProfileLinks() {
  const navigation = useNavigation<NativeStackNavigationProp<SharedScreens>>();
  const { user } = useAuth();
  const tickets = useTickets();

  // Drivers are vetted when they register their truck; KYC is for the two
  // sides that exchange money.
  const needsKyc = user?.role === "FARMER" || user?.role === "BUYER";
  const verification = useVerification();
  const status = verification.data?.status ?? "UNVERIFIED";
  const badge = STATUS[status];

  const openCount = (tickets.data ?? []).filter(
    (t) => t.status !== "RESOLVED" && t.status !== "CLOSED",
  ).length;

  return (
    <View style={styles.card}>
      {needsKyc ? (
        <Pressable style={styles.row} onPress={() => navigation.navigate("Verification")}>
          <View style={styles.icon}>
            <Ionicons name="shield-checkmark-outline" size={17} color={colors.forest} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Verification</Text>
            <Text style={styles.sub}>
              {status === "VERIFIED"
                ? "Your account is verified"
                : status === "PENDING"
                  ? "We’re checking your documents"
                  : status === "REJECTED"
                    ? "Something needs fixing"
                    : "Get the verified badge"}
            </Text>
          </View>
          <Chip label={badge.label} tone={badge.tone} />
        </Pressable>
      ) : null}

      <Pressable
        style={[styles.row, styles.last]}
        onPress={() => navigation.navigate("Help")}
      >
        <View style={styles.icon}>
          <Ionicons name="help-buoy-outline" size={17} color={colors.forest} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Help & support</Text>
          <Text style={styles.sub}>
            {openCount > 0
              ? `${openCount} open ${openCount === 1 ? "issue" : "issues"}`
              : "Raise an issue or call us"}
          </Text>
        </View>
        {openCount > 0 ? <Chip label={String(openCount)} tone="amber" /> : null}
        <Ionicons name="chevron-forward" size={17} color={colors.faint} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    backgroundColor: colors.white,
    borderRadius: 16,
    overflow: "hidden",
    ...shadow,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  last: { borderBottomWidth: 0 },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 14, fontWeight: "600", color: colors.ink },
  sub: { marginTop: 1, fontSize: 12, color: colors.muted },
});
