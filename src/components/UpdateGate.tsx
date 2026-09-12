import { useState, type ReactNode } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppConfig } from "../api/hooks";
import { APP_KIND, APP_VERSION } from "../lib/appInfo";
import { Logo } from "./Logo";
import { PrimaryButton } from "./ui";
import { colors } from "../theme";

/**
 * Wraps the whole app, outside auth, because a forced update has to work
 * before anyone signs in.
 *
 *   force → full-screen block, no way past it
 *   soft  → dismissible banner over the app
 *   ok    → renders children untouched
 *
 * If the config call fails the app carries on. Never lock people out of a
 * working build because the network blipped.
 */
export function UpdateGate({ children }: { children: ReactNode }) {
  const config = useAppConfig(APP_KIND, APP_VERSION);
  const [dismissed, setDismissed] = useState(false);

  const update = config.data?.update;
  const support = config.data?.support;

  const openStore = () => {
    if (update?.storeUrl) Linking.openURL(update.storeUrl);
  };

  if (update?.action === "force") {
    return (
      <View style={styles.block}>
        <Logo />
        <View style={styles.icon}>
          <Ionicons name="cloud-download-outline" size={34} color={colors.forest} />
        </View>
        <Text style={styles.h1}>Time to update</Text>
        <Text style={styles.body}>
          This version of Uzhavan is no longer supported. Update to keep buying, selling and
          delivering.
        </Text>
        {update.releaseNotes ? <Text style={styles.notes}>{update.releaseNotes}</Text> : null}
        <Text style={styles.version}>
          You have {APP_VERSION} · latest is {update.latestVersion}
        </Text>

        <View style={styles.actions}>
          {update.storeUrl ? (
            <PrimaryButton label="Update now" onPress={openStore} />
          ) : (
            <Text style={styles.body}>Please update from the Play Store or App Store.</Text>
          )}
        </View>

        {support?.phone ? (
          <Pressable
            onPress={() => Linking.openURL(`tel:${support.phone.replace(/\s/g, "")}`)}
            style={{ marginTop: 20 }}
          >
            <Text style={styles.help}>Need help? Call {support.phone}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {update?.action === "soft" && !dismissed ? (
        <View style={styles.banner}>
          <Ionicons name="arrow-up-circle-outline" size={18} color={colors.forest} />
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Version {update.latestVersion} is out</Text>
            {update.releaseNotes ? (
              <Text style={styles.bannerSub} numberOfLines={1}>
                {update.releaseNotes}
              </Text>
            ) : null}
          </View>
          {update.storeUrl ? (
            <Pressable onPress={openStore}>
              <Text style={styles.bannerAction}>Update</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => setDismissed(true)} hitSlop={8}>
            <Ionicons name="close" size={18} color={colors.muted} />
          </Pressable>
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  icon: {
    marginTop: 28,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  h1: { marginTop: 18, fontSize: 23, fontWeight: "700", color: colors.ink },
  body: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
    textAlign: "center",
    maxWidth: 300,
  },
  notes: {
    marginTop: 14,
    fontSize: 13,
    lineHeight: 19,
    color: colors.forest,
    textAlign: "center",
    maxWidth: 300,
  },
  version: { marginTop: 16, fontSize: 12, color: colors.faint },
  actions: { marginTop: 26, alignSelf: "stretch", paddingHorizontal: 8 },
  help: { fontSize: 13, fontWeight: "600", color: colors.forest },

  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.mint,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bannerTitle: { fontSize: 13, fontWeight: "600", color: colors.forest },
  bannerSub: { fontSize: 11.5, color: "#1B5E3BAA" },
  bannerAction: { fontSize: 13, fontWeight: "700", color: colors.forest },
});
