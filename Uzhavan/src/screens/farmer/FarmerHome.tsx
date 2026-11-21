import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp } from "@react-navigation/native";
import { Screen } from "../../components/Chrome";
import { Logo } from "../../components/Logo";
import { useFarmerCrops, useFarmerRequests, useFarmerSummary } from "../../api/hooks";
import { useAuth } from "../../context/AuthContext";
import { FarmerAvatar } from "../../components/FarmerAvatar";
import { imageFor } from "../../lib/images";
import { inr, kg } from "../../lib/format";
import type { FarmerStackParamList, FarmerTabParamList } from "../../navigation/types";
import { useI18n } from "../../i18n";
import { colors, shadow } from "../../theme";

export function FarmerHome() {
  const navigation = useNavigation<NavigationProp<FarmerTabParamList & FarmerStackParamList>>();
  const { t, language } = useI18n();
  const { user } = useAuth();
  const summary = useFarmerSummary();
  const crops = useFarmerCrops();
  const requests = useFarmerRequests();
  const farm = summary.data?.farm;
  const first = (user?.name ?? "farmer").split(" ")[0];
  const listed = crops.data ?? [];
  const expectedKg = listed.reduce((sum, c) => sum + c.expectedKg, 0);
  const expectedValue = listed.reduce((sum, c) => sum + c.expectedKg * c.pricePerKg, 0);
  const pending = (requests.data ?? []).filter((r) => r.status === "PENDING");

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={styles.top}>
          <Logo compact />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Pressable onPress={() => navigation.navigate("Help")} accessibilityLabel="Support" hitSlop={8}>
              <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.ink} />
            </Pressable>
            <Pressable onPress={() => navigation.navigate("Notifications")} accessibilityLabel="Notifications" hitSlop={8}>
              <Ionicons name="notifications-outline" size={22} color={colors.ink} />
            </Pressable>
          </View>
        </View>

        <View style={styles.hello}>
          <FarmerAvatar farm={farm} size={44} />
          <View>
            <Text style={styles.helloTitle}>{language === "ta" ? "வணக்கம்" : "Vanakkam"}, {first}</Text>
            <Text style={styles.verified}>
              {user?.verification === "VERIFIED" ? (
                <>
                  {t("home.verified")} <Text style={{ color: colors.blueTick }}>✓</Text>
                </>
              ) : user?.verification === "PENDING" ? (
                "Papers under review"
              ) : (
                "Not verified yet"
              )}
            </Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Image source={imageFor("farm")} style={styles.heroImg} />
          <View style={styles.heroShade} />
          <View style={styles.heroText}>
            <Text style={styles.heroKicker}>{t("home.season")}</Text>
            <View style={styles.heroStats}>
              <View>
                <Text style={styles.heroNum}>{summary.data?.listedCrops ?? listed.length}</Text>
                <Text style={styles.heroLabel}>{t("home.active")}</Text>
              </View>
              <View>
                <Text style={styles.heroNum}>{kg(expectedKg).replace(" kg", "")}</Text>
                <Text style={styles.heroLabel}>{t("home.kg")}</Text>
              </View>
            </View>
          </View>
        </View>

        <Pressable style={styles.add} onPress={() => navigation.navigate("CropForm", {})}>
          <Ionicons name="add" size={18} color={colors.white} />
          <Text style={styles.addText}>{t("home.add")}</Text>
        </Pressable>

        <View style={styles.tiles}>
          <Tile n={String(pending.length)} label={t("home.requests")} onPress={() => navigation.navigate("Requests")} />
          <Tile n={String(summary.data?.orderCount ?? 0)} label={t("home.confirmed")} />
          <Tile n={inr(expectedValue)} label={t("home.expected")} />
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.section}>{t("home.harvests")}</Text>
          <Text style={styles.link}>{t("home.viewAll")}</Text>
        </View>
        {listed.map((crop) => (
          <Pressable key={crop.id} style={styles.crop} onPress={() => navigation.navigate("CropForm", { cropId: crop.id })}>
            <Image source={crop.image} style={styles.cropImg} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cropTitle}>{crop.title}</Text>
              <View style={styles.ready}>
                <Text style={styles.readyText}>{crop.status === "ready" ? t("home.ready") : t("home.upcoming")}</Text>
              </View>
              <Text style={styles.muted}>{kg(crop.expectedKg)}</Text>
              <Text style={styles.muted}>{crop.location}</Text>
            </View>
          </Pressable>
        ))}

        {pending.length > 0 ? (
          <Pressable style={styles.banner} onPress={() => navigation.navigate("Requests")}>
            <Text style={styles.bannerText}>
              {pending.length} {pending.length === 1 ? t("home.interestedOne") : t("home.interestedMany")}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.forest} />
          </Pressable>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Tile({ n, label, onPress }: { n: string; label: string; onPress?: () => void }) {
  return (
    <Pressable style={styles.tile} onPress={onPress}>
      <Text style={styles.tileN} numberOfLines={1}>{n}</Text>
      <Text style={styles.tileL}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 28 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  hello: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14 },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  helloTitle: { fontSize: 18, fontWeight: "700", color: colors.ink },
  verified: { fontSize: 12.5, color: colors.forest, marginTop: 2 },
  hero: { marginTop: 16, height: 148, borderRadius: 18, overflow: "hidden" },
  heroImg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" },
  heroShade: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(12,40,24,0.45)" },
  heroText: { flex: 1, justifyContent: "flex-end", padding: 16 },
  heroKicker: { color: "rgba(255,255,255,0.85)", fontSize: 13 },
  heroStats: { flexDirection: "row", gap: 28, marginTop: 6 },
  heroNum: { color: colors.white, fontSize: 26, fontWeight: "800" },
  heroLabel: { color: "rgba(255,255,255,0.85)", fontSize: 12 },
  add: { marginTop: 12, height: 48, borderRadius: 14, backgroundColor: colors.forest, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  addText: { color: colors.white, fontWeight: "700", fontSize: 15 },
  tiles: { flexDirection: "row", gap: 8, marginTop: 14 },
  tile: { flex: 1, backgroundColor: colors.white, borderRadius: 14, padding: 12, ...shadow },
  tileN: { fontSize: 16, fontWeight: "800", color: colors.ink },
  tileL: { marginTop: 4, fontSize: 11, color: colors.muted },
  sectionRow: { marginTop: 22, marginBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  section: { fontSize: 16, fontWeight: "700", color: colors.ink },
  link: { fontSize: 13, color: colors.forest, fontWeight: "600" },
  crop: { flexDirection: "row", gap: 12, backgroundColor: colors.white, borderRadius: 16, padding: 12, marginBottom: 10, ...shadow },
  cropImg: { width: 72, height: 72, borderRadius: 12 },
  cropTitle: { fontSize: 15, fontWeight: "700", color: colors.ink },
  ready: { alignSelf: "flex-start", marginTop: 4, backgroundColor: colors.amberBg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  readyText: { fontSize: 11, color: colors.amberText, fontWeight: "600" },
  muted: { marginTop: 3, fontSize: 12.5, color: colors.muted },
  banner: { marginTop: 6, backgroundColor: colors.mint, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 8 },
  bannerText: { flex: 1, color: colors.forest, fontWeight: "600", fontSize: 13.5 },
});
