import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Logo } from "../components/Logo";
import { OutlineButton, PrimaryButton } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme";

/**
 * Shown when the app holds a saved session but couldn't reach the server to
 * confirm it. The session is kept — this is not a logout — so the way out is
 * to try again, not to sign in again.
 */
export function Reconnect() {
  const { retry, signOut } = useAuth();

  return (
    <View style={styles.wrap}>
      <Logo />
      <View style={styles.icon}>
        <Ionicons name="cloud-offline-outline" size={32} color={colors.forest} />
      </View>

      <Text style={styles.h1}>Can’t reach Uzhavan</Text>
      <Text style={styles.body}>
        You’re still signed in — we just couldn’t get through to the server. Check your connection
        and try again.
      </Text>

      <View style={styles.actions}>
        <PrimaryButton label="Try again" onPress={retry} />
      </View>
      <View style={{ marginTop: 10, flexDirection: "row" }}>
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
  actions: { marginTop: 26, alignSelf: "stretch", paddingHorizontal: 8 },
});
