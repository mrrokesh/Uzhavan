import { useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppHeader, Screen } from "../components/Chrome";
import { Logo } from "../components/Logo";
import { MapView } from "../components/MapView";
import { Chip, InfoNote, PrimaryButton } from "../components/ui";
import { useOrder, useOrders, useTrucks } from "../api/hooks";
import { imageFor } from "../lib/images";
import { inr, kg } from "../lib/format";
import type { RootStackParamList } from "../navigation/types";
import { colors, shadow } from "../theme";
import { Avatar } from "../components/Avatar";

/** Orders that still need transport arranged. */
function useTransportable() {
  const orders = useOrders();
  const rows = (orders.data ?? []).filter(
    (o) => o.transport === "BOOK" && (!o.booking || o.booking.status === "CANCELLED"),
  );
  return { orders, rows };
}

export function BookTrackHome() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { orders, rows } = useTransportable();

  return (
    <Screen
      footer={
        rows.length > 0 ? (
          <PrimaryButton label="Book truck" onPress={() => navigation.navigate("ChooseOrder")} />
        ) : undefined
      }
    >
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={styles.top}>
          <Logo />
          <Pressable style={styles.bell} onPress={() => navigation.navigate("Notifications")} accessibilityLabel="Notifications">
            <Ionicons name="notifications-outline" size={18} color={colors.ink} />
          </Pressable>
        </View>

        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>Book a truck</Text>
            <Text style={styles.muted}>
              Confirmed orders that still need a vehicle. Drivers join in the Uzhavan app, set a standard fare, and take or leave each trip.
            </Text>
          </View>
        </View>

        {orders.isLoading ? <ActivityIndicator color={colors.forest} style={{ marginTop: 32 }} /> : null}

        {!orders.isLoading && rows.length === 0 ? (
          <Text style={styles.empty}>
            Nothing to transport yet. Once a farmer accepts a request and you confirm it, the order shows
            up here ready for pickup.
          </Text>
        ) : null}

        {rows.map((o) => (
          <View key={o.id} style={styles.card}>
            <View style={{ flexDirection: "row" }}>
              <Chip label="Ready for pickup" tone="mint" />
            </View>
            <View style={styles.row}>
              <Image source={imageFor(o.crop?.imageKey)} style={styles.img64} />
              <View style={{ flex: 1 }}>
                <View style={styles.between}>
                  <Text style={styles.title}>{o.product}</Text>
                  <Text style={styles.muted}>{kg(o.quantityKg)}</Text>
                </View>
                <Text style={styles.body}>{o.crop?.farm.ownerName}</Text>
                <Text style={styles.muted}>{o.pickup}</Text>
                <Text style={styles.muted}>{o.harvestDate}</Text>
              </View>
            </View>
          </View>
        ))}

      </ScrollView>
    </Screen>
  );
}

export function ChooseOrder() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { orders, rows } = useTransportable();
  const [selected, setSelected] = useState<string | null>(null);

  const activeId = selected ?? rows[0]?.id ?? null;
  const order = rows.find((o) => o.id === activeId);

  return (
    <Screen
      footer={
        order ? (
          <PrimaryButton
            label="Find nearby trucks"
            onPress={() => navigation.navigate("PickupDelivery", { orderId: order.id })}
          />
        ) : undefined
      }
    >
      <AppHeader title="Choose an order" />
      <ScrollView contentContainerStyle={styles.pad}>
        {orders.isLoading ? <ActivityIndicator color={colors.forest} style={{ marginTop: 32 }} /> : null}
        {!orders.isLoading && rows.length === 0 ? (
          <Text style={styles.empty}>No confirmed orders are waiting for a truck.</Text>
        ) : null}

        {rows.map((o) => (
          <Pressable
            key={o.id}
            onPress={() => setSelected(o.id)}
            style={[styles.card, o.id === activeId && { borderWidth: 2, borderColor: colors.forest }]}
          >
            <View style={styles.row}>
              <Image source={imageFor(o.crop?.imageKey)} style={styles.img64} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{o.product}</Text>
                <Text style={styles.muted}>{kg(o.quantityKg)}</Text>
                <Text style={styles.muted}>{o.pickup}</Text>
                <Text style={styles.faint}>{o.code}</Text>
              </View>
            </View>
          </Pressable>
        ))}

        {order ? (
          <>
            <View style={[styles.card, { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 20 }]}>
              <View style={styles.wh}>
                <Ionicons name="business-outline" size={18} color={colors.amberText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.farm}>Delivering to</Text>
                <Text style={styles.muted}>{order.destination}</Text>
              </View>
            </View>
            <View style={{ marginTop: 12 }}>
              <InfoNote>
                <Ionicons name="information-circle-outline" size={16} color={colors.forest} />
                <Text style={{ flex: 1, color: colors.forest, fontSize: 12.5 }}>
                  Full order of {kg(order.quantityKg)} will be transported.
                </Text>
              </InfoNote>
            </View>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

export function PickupDelivery() {
  const { orderId } = useRoute<RouteProp<RootStackParamList, "PickupDelivery">>().params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const order = useOrder(orderId).data;
  const trucks = useTrucks(order?.quantityKg);

  if (!order) {
    return (
      <Screen>
        <AppHeader title="Pickup & delivery" />
        <ActivityIndicator color={colors.forest} style={{ marginTop: 48 }} />
      </Screen>
    );
  }

  const usable = (trucks.data ?? []).filter((t) => !t.tooSmall).length;

  return (
    <Screen
      footer={
        <PrimaryButton label="Choose truck" onPress={() => navigation.navigate("NearbyTrucks", { orderId })} />
      }
    >
      <AppHeader title="Pickup & delivery" />
      <View style={{ height: 168 }}>
        <MapView variant="route" pickupLabel={order.pickup} dropLabel={order.destination} />
      </View>
      <View style={styles.pad}>
        <Line label="Pickup" title={order.pickup} color={colors.forest} />
        <Line label="Delivery" title={order.destination} color={colors.amberText} />
        <View style={styles.between}>
          <Text style={styles.muted}>Load</Text>
          <Text style={styles.farm}>{kg(order.quantityKg)}</Text>
        </View>
        <View style={[styles.between, { marginTop: 8 }]}>
          <Text style={styles.muted}>Available trucks</Text>
          <Text style={[styles.farm, { color: colors.forest }]}>
            {trucks.isLoading ? "Checking…" : `${usable} can carry this load`}
          </Text>
        </View>
      </View>
    </Screen>
  );
}

export function NearbyTrucks() {
  const { orderId } = useRoute<RouteProp<RootStackParamList, "NearbyTrucks">>().params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const order = useOrder(orderId).data;
  const trucks = useTrucks(order?.quantityKg);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = trucks.data ?? [];
  const usable = rows.filter((t) => !t.tooSmall);
  const activeId = selectedId ?? usable.find((t) => t.recommended)?.id ?? usable[0]?.id ?? null;

  return (
    <Screen
      footer={
        activeId ? (
          <PrimaryButton
            label="Continue"
            onPress={() => navigation.navigate("TruckDetails", { orderId, truckId: activeId })}
          />
        ) : undefined
      }
    >
      <AppHeader title="Nearby trucks" />
      <ScrollView>
        <View style={{ height: 200 }}>
          <MapView variant="nearby" pickupLabel={order?.pickup ?? ""} dropLabel={order?.destination ?? ""} />
        </View>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Trucks near the farmer</Text>

          {trucks.isLoading ? <ActivityIndicator color={colors.forest} style={{ marginTop: 16 }} /> : null}
          {!trucks.isLoading && rows.length === 0 ? (
            <Text style={styles.empty}>
              No drivers are online right now. Try again shortly — drivers come online through the day.
            </Text>
          ) : null}

          {rows.map((t) => {
            const small = t.tooSmall;
            const selected = activeId === t.id;
            return (
              <Pressable
                key={t.id}
                disabled={small}
                onPress={() => setSelectedId(t.id)}
                style={[
                  styles.truck,
                  small && { opacity: 0.5 },
                  selected && !small && { borderColor: colors.forest, borderWidth: 2 },
                ]}
              >
                <Image source={t.photo} style={styles.img56} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                    <Text style={styles.farm}>{t.name}</Text>
                    {t.recommended && !small ? <Chip label="Recommended" tone="mint" /> : null}
                    {small ? <Chip label="Too small" /> : null}
                  </View>
                  <Text style={styles.tiny}>
                    {t.driver?.name}
                    {t.driver ? ` · ${t.driver.rating.toFixed(1)} rating` : ""}
                  </Text>
                  <Text style={styles.muted}>
                    {t.capacityTons} ton capacity
                    {small ? ` · ${t.reason ?? "Not enough"}` : ` · ${t.etaMin} min away`}
                  </Text>
                </View>
                {!small ? <Text style={styles.price}>{inr(t.price)}</Text> : null}
              </Pressable>
            );
          })}
          <Text style={styles.trust}>Listed drivers are verified before they take a load.</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

export function TruckDetails() {
  const { orderId, truckId } = useRoute<RouteProp<RootStackParamList, "TruckDetails">>().params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const order = useOrder(orderId).data;
  const trucks = useTrucks(order?.quantityKg);
  const truck = (trucks.data ?? []).find((t) => t.id === truckId);

  if (!truck || !order) {
    return (
      <Screen>
        <AppHeader title="Truck details" />
        <ActivityIndicator color={colors.forest} style={{ marginTop: 48 }} />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <PrimaryButton
          label="Review booking"
          onPress={() => navigation.navigate("ReviewBooking", { orderId, truckId })}
        />
      }
    >
      <AppHeader title="Truck details" />
      <ScrollView contentContainerStyle={styles.pad}>
        {truck.driver ? (
          <View style={[styles.card, styles.row]}>
            <Avatar size={56} />
            <View style={{ flex: 1 }}>
              <Text style={styles.h2}>{truck.driver.name}</Text>
              <Text style={styles.muted}>
                {truck.driver.rating.toFixed(1)} rating · {truck.driver.trips} trips
              </Text>
            </View>
            {truck.driver.verified ? <Chip label="Verified driver" tone="mint" /> : null}
          </View>
        ) : null}

        <View style={[styles.card, { overflow: "hidden", padding: 0 }]}>
          <Image source={truck.photo} style={{ width: "100%", height: 140 }} />
          <View style={{ padding: 14 }}>
            <Text style={styles.title}>{truck.name}</Text>
            <Text style={styles.muted}>
              {truck.body} · {truck.plate} · {truck.etaMin} min away
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <RowLine label="This load" value={kg(order.quantityKg)} />
          <RowLine label="Truck capacity" value={kg(truck.capacityKg)} />
          <RowLine label="Body" value={truck.body} />
          <RowLine label="Plate" value={truck.plate} />
          <RowLine label="Standard fare" value={inr(truck.price)} />
          {truck.ratePerKm ? <RowLine label="Per kilometre" value={inr(truck.ratePerKm)} /> : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

function RowLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.between}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.farm}>{value}</Text>
    </View>
  );
}

function Line({ label, title, color }: { label: string; title: string; color: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[styles.tiny, { color }]}>{label}</Text>
      <Text style={styles.farm}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 24 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bell: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  hero: { marginTop: 16, flexDirection: "row", alignItems: "center" },
  h1: { fontSize: 22, fontWeight: "600" },
  h2: { fontSize: 17, fontWeight: "600" },
  title: { fontSize: 16, fontWeight: "600", color: colors.ink },
  farm: { fontSize: 14, fontWeight: "600", color: colors.ink },
  body: { fontSize: 13, color: colors.ink },
  muted: { fontSize: 12.5, color: colors.muted },
  tiny: { fontSize: 11, color: colors.muted },
  faint: { fontSize: 11, color: colors.faint, marginTop: 2 },
  empty: { marginTop: 24, textAlign: "center", fontSize: 13.5, lineHeight: 20, color: colors.muted },
  card: { marginTop: 16, backgroundColor: colors.white, borderRadius: 16, padding: 14, gap: 10, ...shadow },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  img64: { width: 64, height: 64, borderRadius: 12 },
  img56: { width: 56, height: 56, borderRadius: 10 },
  wh: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.amberBg, alignItems: "center", justifyContent: "center" },
  sheet: { marginTop: -12, backgroundColor: colors.cream, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16 },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#d7d0c4", marginBottom: 12 },
  truck: { marginTop: 8, flexDirection: "row", gap: 12, backgroundColor: colors.white, borderRadius: 16, padding: 12, borderWidth: 2, borderColor: "transparent", ...shadow },
  price: { fontSize: 14, fontWeight: "700" },
  trust: { marginTop: 12, textAlign: "center", fontSize: 12, color: colors.forest },
  fit: { marginTop: 12, flexDirection: "row", gap: 12, backgroundColor: colors.mint, borderRadius: 16, padding: 14 },
  inc: { marginTop: 10, flexDirection: "row", gap: 10, alignItems: "center" },
  incDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
});
