import type { ReactNode } from "react";
import type { ImageSourcePropType } from "react-native";
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Logo } from "../components/Logo";
import { Screen } from "../components/Chrome";
import { Chip, OutlineButton } from "../components/ui";
import { ProfileLinks } from "../components/ProfileLinks";
import { useMe, useOrders, useRequests } from "../api/hooks";
import { BOOKING_LABEL, REQUEST_LABEL, type RequestStatus } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { imageFor } from "../lib/images";
import { inr, kg } from "../lib/format";
import type { RootStackParamList } from "../navigation/types";
import { colors, shadow } from "../theme";

const REQUEST_TONE: Record<RequestStatus, "amber" | "mint" | "neutral"> = {
  PENDING: "amber",
  FARMER_ACCEPTED: "mint",
  CONFIRMED: "mint",
  FARMER_DECLINED: "neutral",
  BUYER_DECLINED: "neutral",
  CANCELLED: "neutral",
};

export function MyOrders() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const ordersQuery = useOrders();
  const requestsQuery = useRequests();

  const openRequests = (requestsQuery.data ?? []).filter((r) => r.status !== "CONFIRMED");
  const orders = ordersQuery.data ?? [];
  const loading = ordersQuery.isLoading || requestsQuery.isLoading;
  const refreshing = (ordersQuery.isFetching || requestsQuery.isFetching) && !loading;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.pad}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              ordersQuery.refetch();
              requestsQuery.refetch();
            }}
            tintColor={colors.forest}
          />
        }
      >
        <View style={styles.head}>
          <Text style={styles.h1}>My Orders</Text>
          <Ionicons name="notifications-outline" size={18} color={colors.ink} />
        </View>

        {loading ? <ActivityIndicator color={colors.forest} style={{ marginTop: 32 }} /> : null}

        {openRequests.length > 0 ? <Text style={styles.section}>Requests</Text> : null}
        {openRequests.map((r) => (
          <OrderCard
            key={r.id}
            image={imageFor(r.crop?.imageKey)}
            title={r.crop?.title ?? "Crop request"}
            meta={`${kg(r.quantityKg)} · ${r.crop?.farm.name ?? ""}`}
            id={r.code}
            chip={<Chip label={REQUEST_LABEL[r.status]} tone={REQUEST_TONE[r.status]} />}
            value={
              r.finalPricePerKg
                ? inr(r.finalPricePerKg * r.quantityKg)
                : `Est. ${inr(r.estimatedValue)}`
            }
            onPress={() => navigation.navigate("RequestDetails", { requestId: r.id })}
          />
        ))}

        {orders.length > 0 ? <Text style={styles.section}>Orders</Text> : null}
        {orders.map((o) => {
          const booking = o.booking && o.booking.status !== "CANCELLED" ? o.booking : null;
          const delivered = o.status === "DELIVERED";
          // Unpaid comes first: nothing else about the order matters until the
          // buyer has paid, and the farmer isn't owed anything either.
          const unpaid = !o.paidAt;
          return (
            <OrderCard
              key={o.id}
              image={imageFor(o.crop?.imageKey)}
              title={o.product}
              meta={`${kg(o.quantityKg)} · ${o.crop?.farm.name ?? o.pickup.split(",")[0]}`}
              id={o.code}
              chip={
                <Chip
                  label={
                    unpaid
                      ? "Payment due"
                      : booking
                        ? BOOKING_LABEL[booking.status]
                        : o.transport === "PRIVATE"
                          ? "Private truck"
                          : "Awaiting truck"
                  }
                  tone={unpaid ? "amber" : delivered ? "mint" : booking ? "amber" : "neutral"}
                />
              }
              value={inr(o.totalPayable || o.value)}
              onPress={() => {
                if (unpaid) navigation.navigate("Checkout", { orderId: o.id });
                else if (delivered && booking) navigation.navigate("DeliveryCompleted", { bookingId: booking.id });
                else if (booking) navigation.navigate("TrackTruck", { bookingId: booking.id });
                else navigation.navigate("BookTruckOrder", { orderId: o.id });
              }}
            />
          );
        })}

        {!loading && openRequests.length === 0 && orders.length === 0 ? (
          <Text style={styles.empty}>
            Nothing here yet. Find a crop on Home and send the farmer a request — price stays estimated
            until they confirm.
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function OrderCard({
  image,
  title,
  meta,
  id,
  chip,
  value,
  onPress,
}: {
  image: ImageSourcePropType;
  title: string;
  meta: string;
  id: string;
  chip: ReactNode;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <Image source={image} style={styles.img} />
        <View style={{ flex: 1 }}>
          <View style={styles.between}>
            <Text style={styles.title}>{title}</Text>
            {chip}
          </View>
          <Text style={styles.muted}>{meta}</Text>
          <Text style={styles.faint}>{id}</Text>
        </View>
      </View>
      <View style={[styles.between, { marginTop: 8 }]}>
        <Text style={styles.green}>{value}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.faint} />
      </View>
    </Pressable>
  );
}

export function Profile() {
  const { user, signOut } = useAuth();
  const me = useMe();

  const following = me.data?.following ?? [];
  const saved = me.data?.saved ?? [];
  const profile = me.data ?? user;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.pad}>
        <Logo compact />
        <View style={[styles.card, styles.row, { marginTop: 12 }]}>
          <Image source={imageFor(profile?.avatarKey)} style={styles.av} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{profile?.name}</Text>
            <Text style={styles.muted}>
              {profile?.business} · {profile?.role === "BUYER" ? "Wholesale buyer" : profile?.role}
            </Text>
            <Text style={styles.muted}>{profile?.district}, Tamil Nadu</Text>
          </View>
        </View>

        <View style={[styles.card, { padding: 0, overflow: "hidden" }]}>
          <InfoRow icon="business-outline" title={profile?.warehouse ?? "—"} sub={profile?.warehouseAddress ?? "Warehouse"} />
          <InfoRow icon="location-outline" title="Also buys for" sub={profile?.market ?? "—"} />
          <InfoRow icon="call-outline" title={profile?.phone ?? "—"} sub="WhatsApp available" />
          <InfoRow icon="mail-outline" title={profile?.email ?? "—"} sub="Sign-in email" />
          <InfoRow icon="language-outline" title="Language" sub="English · தமிழ் ready" last />
        </View>

        <ProfileLinks />

        <View style={styles.stats}>
          <Stat n={String(following.length)} l="Following" />
          <Stat n={String(saved.length)} l="Saved crops" />
        </View>

        <View style={{ marginTop: 8, flexDirection: "row" }}>
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
      <View style={{ flex: 1 }}>
        <Text style={styles.body}>{title}</Text>
        <Text style={styles.muted}>{sub}</Text>
      </View>
    </View>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <View style={[styles.card, { flex: 1, alignItems: "center" }]}>
      <Text style={styles.statN}>{n}</Text>
      <Text style={styles.muted}>{l}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 32 },
  head: { height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  h1: { fontSize: 17, fontWeight: "600" },
  section: { marginTop: 12, marginBottom: 4, fontSize: 13, fontWeight: "600", color: colors.forest },
  card: { marginBottom: 12, backgroundColor: colors.white, borderRadius: 16, padding: 14, ...shadow },
  row: { flexDirection: "row", gap: 12, alignItems: "center" },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  img: { width: 56, height: 56, borderRadius: 12 },
  av: { width: 56, height: 56, borderRadius: 28 },
  title: { fontSize: 15, fontWeight: "600", color: colors.ink, flexShrink: 1 },
  body: { fontSize: 13.5, fontWeight: "500" },
  muted: { fontSize: 12, color: colors.muted },
  faint: { fontSize: 11, color: colors.faint },
  green: { fontSize: 13, fontWeight: "600", color: colors.forest },
  empty: { marginTop: 24, textAlign: "center", fontSize: 13, lineHeight: 20, color: colors.muted },
  info: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  infoBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  stats: { flexDirection: "row", gap: 8 },
  statN: { fontSize: 20, fontWeight: "700", color: colors.forest },
  foot: { marginTop: 24, textAlign: "center", fontSize: 12, color: colors.faint },
});
