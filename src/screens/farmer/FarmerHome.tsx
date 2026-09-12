import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen } from "../../components/Chrome";
import { Logo } from "../../components/Logo";
import { Chip } from "../../components/ui";
import { NotificationBell } from "../../components/NotificationBell";
import { useFarmerOrders, useFarmerSummary } from "../../api/hooks";
import { imageFor } from "../../lib/images";
import { inr, kg } from "../../lib/format";
import type { FarmerStackParamList } from "../../navigation/types";
import { colors, shadow } from "../../theme";

export function FarmerHome() {
  const navigation = useNavigation<NativeStackNavigationProp<FarmerStackParamList>>();
  const summary = useFarmerSummary();
  const orders = useFarmerOrders();

  if (summary.isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.forest} style={{ marginTop: 64 }} />
      </Screen>
    );
  }

  const s = summary.data;
  const recent = (orders.data ?? []).slice(0, 3);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={styles.top}>
          <Logo />
          <NotificationBell />
        </View>

        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>{s?.farm.name ?? "Your farm"}</Text>
            <Text style={styles.muted}>{s?.farm.location}</Text>
          </View>
          <Image source={imageFor(s?.farm.avatarKey)} style={styles.avatar} />
        </View>

        {s && s.pendingRequests > 0 ? (
          <Pressable style={styles.alert} onPress={() => navigation.navigate("FarmerTabs")}>
            <View style={styles.alertIcon}>
              <Ionicons name="mail-unread-outline" size={18} color={colors.amberText} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>
                {s.pendingRequests} buyer {s.pendingRequests === 1 ? "request" : "requests"} waiting
              </Text>
              <Text style={styles.alertSub}>Open the Requests tab to set your final price.</Text>
            </View>
          </Pressable>
        ) : null}

        <View style={styles.stats}>
          <Stat n={String(s?.listedCrops ?? 0)} l="Listed crops" />
          <Stat n={String(s?.awaitingBuyer ?? 0)} l="Awaiting buyer" />
        </View>
        <View style={styles.stats}>
          <Stat n={String(s?.orderCount ?? 0)} l="Orders" />
          <Stat n={inr(s?.salesValue ?? 0)} l="Sales value" />
        </View>

        <Pressable style={styles.cta} onPress={() => navigation.navigate("CropForm", {})}>
          <Ionicons name="add-circle-outline" size={20} color={colors.white} />
          <Text style={styles.ctaText}>List a new crop</Text>
        </Pressable>

        <Pressable style={styles.demand} onPress={() => navigation.navigate("Demand")}>
          <View style={styles.demandIcon}>
            <Ionicons name="trending-up-outline" size={18} color={colors.forest} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.demandTitle}>What buyers want</Text>
            <Text style={styles.demandSub}>
              Which crops buyers near you are asking for, and what they pay.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.faint} />
        </Pressable>

        <Text style={styles.sectionTitle}>Recent orders</Text>
        {orders.isLoading ? <ActivityIndicator color={colors.forest} style={{ marginTop: 16 }} /> : null}
        {!orders.isLoading && recent.length === 0 ? (
          <Text style={styles.empty}>No orders yet. List a crop and buyers will find you.</Text>
        ) : null}
        {recent.map((o) => (
          <View key={o.id} style={styles.orderCard}>
            <Image source={imageFor(o.crop?.imageKey)} style={styles.orderImg} />
            <View style={{ flex: 1 }}>
              <View style={styles.between}>
                <Text style={styles.orderTitle}>{o.product}</Text>
                <Chip
                  label={o.status === "DELIVERED" ? "Delivered" : o.booking ? "In transit" : "Awaiting truck"}
                  tone={o.status === "DELIVERED" ? "mint" : "amber"}
                />
              </View>
              <Text style={styles.muted}>
                {kg(o.quantityKg)} · {o.buyer?.business ?? o.buyer?.name}
              </Text>
              <Text style={styles.green}>{inr(o.value)}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statN}>{n}</Text>
      <Text style={styles.muted}>{l}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 32 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  hero: { marginTop: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  h1: { fontSize: 22, fontWeight: "700", color: colors.ink },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  muted: { fontSize: 12.5, color: colors.muted },
  alert: { marginTop: 16, flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: colors.amberBg, borderRadius: 16, padding: 14 },
  alertIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  alertTitle: { fontSize: 14, fontWeight: "600", color: colors.amberText },
  alertSub: { marginTop: 2, fontSize: 12, color: colors.amberText },
  stats: { marginTop: 12, flexDirection: "row", gap: 8 },
  stat: { flex: 1, backgroundColor: colors.white, borderRadius: 16, padding: 14, alignItems: "center", ...shadow },
  statN: { fontSize: 19, fontWeight: "700", color: colors.forest },
  cta: { marginTop: 20, height: 52, borderRadius: 12, backgroundColor: colors.forest, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  demand: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.white, borderRadius: 16, padding: 14, ...shadow },
  demandIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
  demandTitle: { fontSize: 14.5, fontWeight: "600", color: colors.ink },
  demandSub: { marginTop: 2, fontSize: 12, lineHeight: 17, color: colors.muted },
  ctaText: { color: colors.white, fontSize: 15, fontWeight: "600" },
  sectionTitle: { marginTop: 28, fontSize: 15, fontWeight: "600", color: colors.ink },
  empty: { marginTop: 16, fontSize: 13, color: colors.muted },
  orderCard: { marginTop: 12, flexDirection: "row", gap: 12, backgroundColor: colors.white, borderRadius: 16, padding: 12, ...shadow },
  orderImg: { width: 56, height: 56, borderRadius: 12 },
  orderTitle: { fontSize: 14.5, fontWeight: "600", color: colors.ink },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  green: { marginTop: 4, fontSize: 13.5, fontWeight: "700", color: colors.forest },
});
