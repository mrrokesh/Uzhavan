import { useEffect, useState, type ReactNode } from "react";
import type { ImageSourcePropType } from "react-native";
import { ActivityIndicator, Alert, Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Logo } from "../components/Logo";
import { Screen } from "../components/Chrome";
import { Chip, OutlineButton } from "../components/ui";
import { ProfileLinks } from "../components/ProfileLinks";
import { useMe, useOrders, useRequests, useUpdateProfile } from "../api/hooks";
import { BuyerLocation, type ShopPlace } from "../components/LocationSheet";
import { loadPlace, savePlace } from "../lib/place";
import { useApp } from "../context/AppContext";
import { ApiError } from "../lib/api";
import { BOOKING_LABEL, REQUEST_LABEL, type RequestStatus } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { imageFor } from "../lib/images";
import { inr, kg } from "../lib/format";
import type { RootStackParamList, TabParamList } from "../navigation/types";
import { APP_NAME } from "../lib/appInfo";
import { colors, shadow } from "../theme";
import { Avatar } from "../components/Avatar";

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
          <Pressable onPress={() => navigation.navigate("Notifications")} accessibilityLabel="Notifications">
            <Ionicons name="notifications-outline" size={18} color={colors.ink} />
          </Pressable>
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
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const tabs = useNavigation<NavigationProp<TabParamList>>();
  const { user, signOut } = useAuth();
  const { setFilter, setSavedOnly } = useApp();
  const me = useMe();
  const updateProfile = useUpdateProfile();
  const [districtOpen, setDistrictOpen] = useState(false);
  const [shop, setShop] = useState<ShopPlace>({
    state: "Tamil Nadu",
    district: user?.district ?? "",
    radiusKm: 100,
  });

  useEffect(() => {
    void loadPlace().then((saved) => {
      if (saved) setShop(saved);
      else if (user?.district) setShop({ state: "Tamil Nadu", district: user.district, radiusKm: 100 });
    });
  }, [user?.district]);

  const following = me.data?.following ?? [];
  const saved = me.data?.saved ?? [];
  const profile = me.data ?? user;

  const saveDistrict = async (next: ShopPlace) => {
    setShop(next);
    await savePlace(next);
    if (next.state !== "Tamil Nadu") return;
    try {
      await updateProfile.mutateAsync({ district: next.district });
    } catch (err) {
      Alert.alert("Couldn’t save the district", err instanceof ApiError ? err.message : "Try again.");
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.pad}>
        <Logo compact />
        <View style={[styles.card, styles.row, { marginTop: 12 }]}>
          <Avatar size={56} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{profile?.name}</Text>
            <Text style={styles.muted}>
              {profile?.business} · {profile?.role === "BUYER" ? "Wholesale buyer" : profile?.role}
            </Text>
            <Pressable onPress={() => setDistrictOpen(true)}>
              <Text style={styles.muted}>
                {shop.district || profile?.district || "Set location"}, {shop.state}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.card, { padding: 0, overflow: "hidden" }]}>
          <InfoRow icon="business-outline" title={profile?.warehouse ?? "—"} sub={profile?.warehouseAddress ?? "Warehouse"} />
          <InfoRow icon="location-outline" title={profile?.market || "No extra market yet"} sub="Also buys for" />
          <InfoRow
            icon="call-outline"
            title={profile?.phone ?? "—"}
            sub="Tap to call"
            onPress={() => {
              if (profile?.phone) void Linking.openURL(`tel:${profile.phone}`);
            }}
          />
          <InfoRow icon="mail-outline" title={profile?.email ?? "—"} sub="Sign-in email" last />
        </View>

        <ProfileLinks />

        <View style={styles.stats}>
          <Stat
            n={String(following.length)}
            l="Following"
            onPress={() => {
              setSavedOnly(false);
              setFilter("following");
              tabs.navigate("Home");
            }}
          />
          <Stat
            n={String(saved.length)}
            l="Saved crops"
            onPress={() => {
              setSavedOnly(true);
              setFilter("for-you");
              tabs.navigate("Home");
            }}
          />
        </View>
        <BuyerLocation
          visible={districtOpen}
          place={shop}
          onApply={(next) => void saveDistrict(next)}
          onClose={() => setDistrictOpen(false)}
        />

        <View style={{ marginTop: 8, flexDirection: "row" }}>
          <OutlineButton label="Sign out" tone="danger" icon="log-out-outline" onPress={() => void signOut()} />
        </View>
        <Text style={styles.foot}>{APP_NAME} · Direct from Tamil Nadu farms</Text>
      </ScrollView>
    </Screen>
  );
}

function InfoRow({
  icon,
  title,
  sub,
  last,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  last?: boolean;
  onPress?: () => void;
}) {
  const body = (
    <View style={[styles.info, !last && styles.infoBorder]}>
      <Ionicons name={icon} size={16} color={colors.forest} />
      <View style={{ flex: 1 }}>
        <Text style={styles.body}>{title}</Text>
        <Text style={styles.muted}>{sub}</Text>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={14} color={colors.faint} /> : null}
    </View>
  );
  if (!onPress) return body;
  return <Pressable onPress={onPress}>{body}</Pressable>;
}

function Stat({ n, l, onPress }: { n: string; l: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.card, { flex: 1, alignItems: "center" }]} onPress={onPress}>
      <Text style={styles.statN}>{n}</Text>
      <Text style={styles.muted}>{l}</Text>
    </Pressable>
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
