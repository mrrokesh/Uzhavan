import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen } from "../../components/Chrome";
import { useFarmerCrops, useFarmerOrders, useFarmerSummary, useVerification } from "../../api/hooks";
import { useAuth } from "../../context/AuthContext";
import { FarmerAvatar } from "../../components/FarmerAvatar";
import type { FarmerStackParamList } from "../../navigation/types";
import { askFingerprint, biometricChoice, fingerprintAvailable, setBiometricChoice } from "../../lib/biometric";
import { useI18n, type Language } from "../../i18n";
import { colors } from "../../theme";

export function FarmerAccount() {
  const navigation = useNavigation<NativeStackNavigationProp<FarmerStackParamList>>();
  const { t, language, setLanguage } = useI18n();
  const { user, signOut } = useAuth();
  const [fingerprint, setFingerprint] = useState(false);
  const [canFingerprint, setCanFingerprint] = useState(false);
  const summary = useFarmerSummary();
  const crops = useFarmerCrops();
  const orders = useFarmerOrders();
  const farm = summary.data?.farm;
  const verification = useVerification();
  const verified = verification.data?.status === "VERIFIED";
  const pendingReview = verification.data?.status === "PENDING";
  const cropNames = (crops.data ?? []).map((c) => c.title.split(" ")[0]).slice(0, 3).join(", ");

  useEffect(() => {
    void fingerprintAvailable().then(setCanFingerprint);
    void biometricChoice().then((choice) => setFingerprint(choice === "on"));
  }, []);

  const toggleFingerprint = async (next: boolean) => {
    if (next) {
      const ok = await askFingerprint(t("lock.title"));
      if (!ok) return;
    }
    await setBiometricChoice(next ? "on" : "off");
    setFingerprint(next);
  };

  const switchLanguage = (next: Language) => {
    if (next !== language) void setLanguage(next);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={styles.top}>
          <Text style={styles.h1}>{t("profile.title")}</Text>
          <Pressable onPress={() => navigation.navigate("FarmProfile")} accessibilityLabel="Settings">
            <Ionicons name="settings-outline" size={22} color={colors.ink} />
          </Pressable>
        </View>

        <View style={styles.who}>
          <FarmerAvatar farm={farm} size={72} editable />
          <Text style={styles.name}>
            {user?.name} {verified ? <Text style={{ color: colors.blueTick }}>✓</Text> : null}
          </Text>
          <Text style={styles.farm}>{farm?.name}</Text>
          <Text style={styles.muted}>{verified ? "Verified farmer" : pendingReview ? "Documents under review" : "Not verified yet"}</Text>
          <Text style={styles.muted}>
            <Ionicons name="location-outline" size={13} color={colors.muted} /> {farm?.location}
          </Text>
        </View>

        <Pressable style={styles.edit} onPress={() => navigation.navigate("FarmProfile")}>
          <Text style={styles.editText}>{t("profile.edit")}</Text>
        </Pressable>

        <View style={styles.stats}>
          <Stat n={String(summary.data?.listedCrops ?? 0)} label={t("profile.active")} />
          <Stat n={String(summary.data?.orderCount ?? 0)} label={t("profile.orders")} />
          <Stat n={farm ? farm.rating.toFixed(1) : "—"} label={t("profile.rating")} star />
        </View>

        <Text style={styles.section}>{t("profile.farm")}</Text>
        <View style={styles.card}>
          <Detail icon="basket-outline" text={cropNames || t("profile.cropsEmpty")} />
          <Detail icon="location" text={farm?.district ? `${farm.district}` : t("profile.cropsEmpty")} />
          {user?.phone ? <Detail icon="call-outline" text={user.phone} /> : null}
        </View>

        <View style={styles.card}>
          <Link
            icon="document-text-outline"
            title={t("profile.docs")}
            value={verified ? "Verified" : pendingReview ? "Under review" : "Add documents"}
            onPress={() => navigation.navigate("Verification")}
          />
          <Link icon="card-outline" title={t("profile.payments")} onPress={() => navigation.navigate("FarmerPayouts")} />
          <Link icon="notifications-outline" title={t("profile.notifications")} onPress={() => navigation.navigate("Notifications")} />
          <View style={[styles.link, styles.linkLine]}>
            <Ionicons name="language-outline" size={18} color={colors.ink} />
            <Text style={styles.linkTitle}>{t("profile.language")}</Text>
            <Pressable onPress={() => switchLanguage("ta")} style={[styles.lang, language === "ta" && styles.langOn]}>
              <Text style={[styles.langText, language === "ta" && styles.langTextOn]}>தமிழ்</Text>
            </Pressable>
            <Pressable onPress={() => switchLanguage("en")} style={[styles.lang, language === "en" && styles.langOn]}>
              <Text style={[styles.langText, language === "en" && styles.langTextOn]}>EN</Text>
            </Pressable>
          </View>
          {canFingerprint ? (
            <View style={[styles.link, styles.linkLineTop]}>
              <Ionicons name="finger-print" size={18} color={colors.ink} />
              <View style={{ flex: 1 }}>
                <Text style={styles.linkTitle}>{t("profile.fingerprint")}</Text>
                <Text style={styles.linkSub}>{fingerprint ? t("profile.fingerprintOn") : t("profile.fingerprintOff")}</Text>
              </View>
              <Switch
                value={fingerprint}
                onValueChange={(next) => void toggleFingerprint(next)}
                trackColor={{ true: colors.forest, false: colors.line }}
              />
            </View>
          ) : null}
          <Link icon="help-circle-outline" title={t("profile.help")} onPress={() => navigation.navigate("Help")} last />
        </View>

        {(orders.data ?? []).length > 0 ? (
          <Text style={styles.hint}>{orders.data?.length} sales on this account</Text>
        ) : null}

        <Pressable style={styles.logout} onPress={() => void signOut()}>
          <Ionicons name="log-out-outline" size={16} color={colors.danger} />
          <Text style={styles.logoutText}>{t("profile.logout")}</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function Stat({ n, label, star }: { n: string; label: string; star?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statN}>{star ? `★ ${n}` : n}</Text>
      <Text style={styles.statL}>{label}</Text>
    </View>
  );
}

function Detail({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.detail}>
      <Ionicons name={icon} size={16} color={colors.forest} />
      <Text style={styles.detailText}>{text}</Text>
    </View>
  );
}

function Link({
  icon,
  title,
  value,
  onPress,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  value?: string;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.link, !last && styles.linkLine]}>
      <Ionicons name={icon} size={18} color={colors.ink} />
      <Text style={styles.linkTitle}>{title}</Text>
      {value ? <Text style={styles.linkValue}>{value}</Text> : null}
      {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.faint} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 32 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  h1: { fontSize: 26, fontWeight: "800", color: colors.ink },
  who: { alignItems: "center", marginTop: 12 },
  avatar: { width: 84, height: 84, borderRadius: 42 },
  name: { marginTop: 10, fontSize: 20, fontWeight: "800", color: colors.ink },
  farm: { marginTop: 2, fontSize: 14, color: colors.muted },
  muted: { marginTop: 4, fontSize: 13, color: colors.muted },
  edit: { alignSelf: "center", marginTop: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 18, height: 40, justifyContent: "center" },
  editText: { color: colors.ink, fontWeight: "700" },
  stats: { flexDirection: "row", marginTop: 18, backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.line },
  stat: { flex: 1, alignItems: "center", paddingVertical: 14 },
  statN: { fontSize: 18, fontWeight: "800", color: colors.ink },
  statL: { marginTop: 4, fontSize: 11, color: colors.muted, textAlign: "center" },
  section: { marginTop: 20, marginBottom: 8, fontSize: 15, fontWeight: "700", color: colors.ink },
  card: { backgroundColor: colors.white, borderRadius: 16, paddingHorizontal: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.line },
  detail: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  detailText: { fontSize: 14, color: colors.ink },
  link: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  linkLine: { borderBottomWidth: 1, borderBottomColor: colors.line },
  linkTitle: { flex: 1, fontSize: 15, color: colors.ink, fontWeight: "600" },
  linkSub: { marginTop: 2, fontSize: 12, lineHeight: 16, color: colors.muted },
  linkLineTop: { borderTopWidth: 1, borderTopColor: colors.line },
  lang: { borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 8, height: 28, justifyContent: "center" },
  langOn: { backgroundColor: colors.forest, borderColor: colors.forest },
  langText: { fontSize: 12, fontWeight: "700", color: colors.ink },
  langTextOn: { color: colors.white },
  linkValue: { fontSize: 13, color: colors.muted },
  hint: { textAlign: "center", color: colors.muted, fontSize: 12, marginTop: 4 },
  logout: { marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 46 },
  logoutText: { color: colors.danger, fontWeight: "700", fontSize: 15 },
});
