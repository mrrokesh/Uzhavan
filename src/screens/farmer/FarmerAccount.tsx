import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../components/Chrome";
import { Logo } from "../../components/Logo";
import { Chip, OutlineButton } from "../../components/ui";
import { useFarmerOrders, useFarmerSummary } from "../../api/hooks";
import { useAuth } from "../../context/AuthContext";
import { imageFor } from "../../lib/images";
import { inr, kg } from "../../lib/format";
import { colors, shadow } from "../../theme";

export function FarmerAccount() {
  const { user, signOut } = useAuth();
  const summary = useFarmerSummary();
  const orders = useFarmerOrders();

  const farm = summary.data?.farm;
  const sales = orders.data ?? [];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.pad}>
        <Logo compact />

        <View style={[styles.card, styles.row, { marginTop: 12 }]}>
          <Image source={imageFor(farm?.avatarKey ?? user?.avatarKey)} style={styles.av} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{farm?.name ?? user?.name}</Text>
            <Text style={styles.muted}>{user?.name} · Farmer</Text>
            <Text style={styles.muted}>{farm?.location}</Text>
          </View>
          {farm ? <Chip label={`★ ${farm.rating.toFixed(1)}`} tone="mint" /> : null}
        </View>

        <View style={[styles.card, { padding: 0, overflow: "hidden" }]}>
          <InfoRow icon="call-outline" title={user?.phone ?? "—"} sub="WhatsApp available" />
          <InfoRow icon="mail-outline" title={user?.email ?? "—"} sub="Sign-in email" />
          <InfoRow icon="location-outline" title={farm?.district ?? "—"} sub="District" last />
        </View>

        <Text style={styles.section}>Sales</Text>
        {orders.isLoading ? <ActivityIndicator color={colors.forest} style={{ marginTop: 12 }} /> : null}
        {!orders.isLoading && sales.length === 0 ? (
          <Text style={styles.empty}>No completed sales yet.</Text>
        ) : null}
        {sales.map((o) => (
          <View key={o.id} style={[styles.card, styles.row]}>
            <Image source={imageFor(o.crop?.imageKey)} style={styles.img} />
            <View style={{ flex: 1 }}>
              <Text style={styles.body}>{o.product}</Text>
              <Text style={styles.muted}>
                {kg(o.quantityKg)} · {o.buyer?.business ?? o.buyer?.name}
              </Text>
              <Text style={styles.faint}>{o.code}</Text>
            </View>
            <Text style={styles.green}>{inr(o.value)}</Text>
          </View>
        ))}

        <View style={{ marginTop: 20, flexDirection: "row" }}>
          <OutlineButton label="Sign out" tone="danger" icon="log-out-outline" onPress={() => void signOut()} />
        </View>
        <Text style={styles.foot}>Uzhavan · Direct from Tamil Nadu farms</Text>
      </ScrollView>
    </Screen>
  );
}

function InfoRow({
  icon,
  title,
  sub,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.info, !last && styles.infoBorder]}>
      <Ionicons name={icon} size={16} color={colors.forest} />
      <View>
        <Text style={styles.body}>{title}</Text>
        <Text style={styles.muted}>{sub}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 32 },
  card: { marginBottom: 12, backgroundColor: colors.white, borderRadius: 16, padding: 14, ...shadow },
  row: { flexDirection: "row", gap: 12, alignItems: "center" },
  av: { width: 56, height: 56, borderRadius: 28 },
  img: { width: 48, height: 48, borderRadius: 10 },
  title: { fontSize: 16, fontWeight: "600", color: colors.ink },
  body: { fontSize: 13.5, fontWeight: "500", color: colors.ink },
  muted: { fontSize: 12, color: colors.muted, marginTop: 2 },
  faint: { fontSize: 11, color: colors.faint, marginTop: 2 },
  green: { fontSize: 13.5, fontWeight: "700", color: colors.forest },
  section: { marginTop: 8, marginBottom: 10, fontSize: 13, fontWeight: "600", color: colors.forest },
  empty: { fontSize: 13, color: colors.muted, marginBottom: 12 },
  info: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  infoBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  foot: { marginTop: 24, textAlign: "center", fontSize: 12, color: colors.faint },
});
