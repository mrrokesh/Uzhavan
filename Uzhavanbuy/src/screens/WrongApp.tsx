import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Logo } from "../components/Logo";
import { OutlineButton } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { APP_NAME, OTHER_APP_NAME } from "../lib/appInfo";
import { colors } from "../theme";

const FOR_ROLE: Record<string, string> = {
  BUYER: "Buyer accounts",
  FARMER: "Farmer accounts",
  DRIVER: "Driver accounts",
  STAFF: "Staff accounts",
  ADMIN: "Admin accounts",
};

/**
 * A real account signed into the wrong one of the two apps. Never a dead end:
 * say which app they want and let them sign out to try another account.
 *
 * Staff and admin have no mobile app at all — they belong in the web console —
 * so they get told that rather than pointed at a download.
 */
export function WrongApp() {
  const { user, signOut } = useAuth();
  // Read as a plain string: STAFF and ADMIN come back from the server but
  // aren't in the mobile Role union.
  const role: string = user?.role ?? "BUYER";
  const isConsole = role === "STAFF" || role === "ADMIN";

  return (
    <View style={styles.wrap}>
      <Logo />
      <View style={styles.icon}>
        <Ionicons name="swap-horizontal-outline" size={32} color={colors.forest} />
      </View>

      <Text style={styles.h1}>Wrong app</Text>
      <Text style={styles.body}>
        {isConsole
          ? `${FOR_ROLE[role]} sign in on the Uzhavan web console, not on a phone.`
          : `${FOR_ROLE[role]} belong in ${OTHER_APP_NAME}. This is ${APP_NAME}.`}
      </Text>
      {!isConsole ? (
        <Text style={styles.hint}>
          Install {OTHER_APP_NAME} and sign in with the same email and password.
        </Text>
      ) : null}

      <View style={styles.actions}>
        <OutlineButton label="Sign out" tone="danger" icon="log-out-outline" onPress={() => void signOut()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  icon: {
    marginTop: 28,
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  h1: { marginTop: 18, fontSize: 22, fontWeight: "700", color: colors.ink },
  body: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
    textAlign: "center",
    maxWidth: 300,
  },
  hint: {
    marginTop: 10,
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.faint,
    textAlign: "center",
    maxWidth: 300,
  },
  actions: { marginTop: 26, flexDirection: "row" },
});
