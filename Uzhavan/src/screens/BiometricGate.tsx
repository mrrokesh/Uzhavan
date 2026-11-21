import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { PrimaryButton } from "../components/ui";
import { askFingerprint, setBiometricChoice } from "../lib/biometric";
import { useI18n } from "../i18n";
import { colors } from "../theme";

export function EnableFingerprint({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enable = async () => {
    setWorking(true);
    setError(null);
    const ok = await askFingerprint(t("lock.title"));
    setWorking(false);
    if (!ok) {
      setError(t("lock.failed"));
      return;
    }
    await setBiometricChoice("on");
    onDone();
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.icon}>
        <Ionicons name="finger-print" size={36} color={colors.forest} />
      </View>
      <Text style={styles.title}>{t("lock.enableTitle")}</Text>
      <Text style={styles.body}>{t("lock.enableBody")}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <PrimaryButton label={t("lock.enable")} onPress={() => void enable()} loading={working} />
        <Pressable
          onPress={() => {
            void setBiometricChoice("off").then(onDone);
          }}
          style={styles.later}
        >
          <Text style={styles.laterText}>{t("lock.later")}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export function BiometricLock({ onUnlock, onPassword }: { onUnlock: () => void; onPassword: () => void }) {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const unlock = async () => {
    setWorking(true);
    setError(null);
    const ok = await askFingerprint(t("lock.title"));
    setWorking(false);
    if (ok) onUnlock();
    else setError(t("lock.failed"));
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.icon}>
        <Ionicons name="finger-print" size={36} color={colors.forest} />
      </View>
      <Text style={styles.title}>{t("lock.title")}</Text>
      <Text style={styles.body}>{t("lock.body")}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <PrimaryButton label={t("lock.button")} onPress={() => void unlock()} loading={working} />
        <Pressable onPress={onPassword} style={styles.later}>
          <Text style={styles.laterText}>{t("lock.password")}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream, paddingHorizontal: 24, justifyContent: "center" },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
  },
  title: { marginTop: 18, fontSize: 26, fontWeight: "800", color: colors.ink },
  body: { marginTop: 8, fontSize: 15, lineHeight: 22, color: colors.muted },
  error: { marginTop: 12, color: colors.danger, fontSize: 13 },
  actions: { marginTop: 28, gap: 8 },
  later: { height: 46, alignItems: "center", justifyContent: "center" },
  laterText: { color: colors.forest, fontWeight: "700", fontSize: 15 },
});
