import { useEffect } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppHeader, Screen } from "../components/Chrome";
import { SuccessMark } from "../components/Logo";
import { MapView } from "../components/MapView";
import { Chip, Divider, OutlineButton, PrimaryButton, Row } from "../components/ui";
import { RouteStops, Tracker } from "../components/Widgets";
import { useApp } from "../context/AppContext";
import { cargoFor, driver, fare, getTruck, IMAGES } from "../data/seed";
import { inr, kg } from "../lib/format";
import type { RootStackParamList } from "../navigation/types";
import { colors, shadow } from "../theme";

export function ReviewBooking() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { selectedTruckId, setBookingPaid, bookingSource, quantity } = useApp();
  const truck = getTruck(selectedTruckId);
  const order = cargoFor(bookingSource, quantity);

  return (
    <Screen
      footer={
        <PrimaryButton
          label={`Confirm & pay ${inr(fare.total)}`}
          onPress={() => {
            setBookingPaid(true);
            navigation.navigate("FindingTruck");
          }}
        />
      }
    >
      <AppHeader title="Review booking" />
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={[styles.card, { padding: 16 }]}>
          <RouteStops pickup={order.pickup} drop={order.destinationFull} />
          <Text style={styles.km}>57 km</Text>
        </View>
        <View style={[styles.card, styles.row]}>
          <Image source={order.image} style={styles.img48} />
          <Text style={styles.farm}>
            {order.product}, {kg(order.qtyKg)}
          </Text>
        </View>
        <View style={[styles.card, styles.row]}>
          <Image source={truck.photo} style={styles.img64} />
          <View style={{ flex: 1 }}>
            <Text style={styles.farm}>Mini Truck · 3.5T</Text>
            <Text style={styles.muted}>
              {driver.name} · {driver.rating} <Text style={{ color: colors.forest }}>Verified driver</Text>
            </Text>
            <Text style={styles.green}>ETA {truck.etaMin} min</Text>
          </View>
        </View>
        <View style={styles.card}>
          <Row label="Base fare" value={inr(fare.base)} />
          <Divider />
          <Row label="Loading assistance" value={inr(fare.loading)} />
          <Divider />
          <Row label="Goods protection" value={inr(fare.protection)} />
          <Divider />
          <Row label="Total" value={inr(fare.total)} green />
        </View>
        <View style={[styles.card, styles.between]}>
          <Text style={styles.muted}>Payment method</Text>
          <View style={styles.upi}>
            <View style={styles.upiBadge}>
              <Text style={styles.upiText}>UPI</Text>
            </View>
            <Text style={styles.farm}>UPI</Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

export function FindingTruck() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { selectedTruckId, setTruckAssigned, bookingSource, quantity } = useApp();
  const truck = getTruck(selectedTruckId);
  const order = cargoFor(bookingSource, quantity);

  useEffect(() => {
    const t = setTimeout(() => {
      setTruckAssigned(true);
      navigation.replace("TruckConfirmed");
    }, 2200);
    return () => clearTimeout(t);
  }, [navigation, setTruckAssigned]);

  return (
    <Screen>
      <AppHeader title="Finding truck" />
      <View style={{ height: 240 }}>
        <MapView variant="finding" pickupLabel={order.pickupShort} dropLabel={order.destination} />
      </View>
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.pulse}>
          <Ionicons name="car" size={28} color={colors.forest} />
        </View>
        <Text style={styles.h2}>Finding a nearby truck</Text>
        <Text style={styles.centerMuted}>Matching you with a verified local driver</Text>
        <View style={[styles.card, styles.row, { backgroundColor: colors.cream }]}>
          <Image source={truck.photo} style={styles.img48} />
          <View>
            <Text style={styles.farm}>Mini Truck · 3.5T</Text>
            <Text style={styles.muted}>
              {driver.name} · {driver.rating}
            </Text>
          </View>
        </View>
        <View style={styles.dots}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.dot, i === 0 && { backgroundColor: colors.forest }]} />
          ))}
        </View>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.cancel}>Cancel search</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

export function TruckConfirmed() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { bookingSource, quantity } = useApp();
  const truck = getTruck("mini");
  const order = cargoFor(bookingSource, quantity);

  return (
    <Screen
      footer={
        <>
          <PrimaryButton label="Track truck" onPress={() => navigation.navigate("TrackTruck")} />
          <OutlineButton label="Call driver" icon="call-outline" />
        </>
      }
    >
      <ScrollView contentContainerStyle={[styles.pad, { alignItems: "center", paddingTop: 24 }]}>
        <SuccessMark />
        <Text style={styles.h1}>Truck confirmed!</Text>
        <Text style={styles.centerMuted}>Your driver is on the way.</Text>
        <View style={[styles.card, styles.row, { width: "100%" }]}>
          <Image source={driver.photo} style={styles.av} />
          <View style={{ flex: 1 }}>
            <Text style={styles.farm}>{driver.name}</Text>
            <Text style={styles.muted}>
              ★ {driver.rating} ({driver.trips} trips)
            </Text>
          </View>
          <Chip label="Verified driver" tone="mint" />
        </View>
        <View style={[styles.card, { width: "100%", overflow: "hidden", padding: 0 }]}>
          <Image source={truck.photo} style={{ width: "100%", height: 112 }} />
          <View style={{ padding: 14 }}>
            <Text style={styles.farm}>Mini Truck · 3.5T</Text>
            <Text style={styles.muted}>{truck.plate}</Text>
            <Text style={styles.green}>Arrives in 12 min</Text>
          </View>
        </View>
        <View style={[styles.card, { width: "100%", padding: 16 }]}>
          <RouteStops pickup={order.pickup} drop={order.destinationFull} />
        </View>
      </ScrollView>
    </Screen>
  );
}

export function TrackTruck() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { bookingSource, quantity } = useApp();
  const truck = getTruck("mini");
  const order = cargoFor(bookingSource, quantity);

  return (
    <Screen>
      <View style={{ height: 300 }}>
        <MapView variant="tracking" chip="Heading to the farm" pickupLabel={order.pickupShort} dropLabel={order.destination} />
        <Pressable style={styles.back} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
      </View>
      <ScrollView style={styles.trackSheet} contentContainerStyle={{ padding: 16 }}>
        <View style={styles.row}>
          <Image source={driver.photo} style={styles.avSm} />
          <View style={{ flex: 1 }}>
            <Text style={styles.farm}>{driver.name}</Text>
            <Text style={styles.muted}>{truck.plate}</Text>
          </View>
          <Text style={styles.eta}>ETA 8 min</Text>
        </View>
        <View style={{ marginTop: 16 }}>
          <Tracker
            steps={[
              { title: "Truck assigned", meta: "4:10 PM", state: "done" },
              { title: "Reaching farmer", meta: "4:27 PM · On the way to pickup location", state: "current" },
              { title: "Crop loaded", meta: "Pending", state: "pending" },
              { title: "On the way", meta: "Pending", state: "pending" },
              { title: "Delivered", meta: "Pending", state: "pending" },
            ]}
          />
        </View>
        <View style={styles.two}>
          <OutlineButton label="Call driver" icon="call-outline" />
          <OutlineButton label="Share tracking" icon="share-outline" />
        </View>
        <Pressable onPress={() => navigation.navigate("DeliveryCompleted")}>
          <Text style={styles.skip}>Skip to delivery completed</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

export function DeliveryCompleted() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { setDelivered, bookingSource, quantity } = useApp();
  const order = cargoFor(bookingSource, quantity);

  useEffect(() => {
    setDelivered(true);
  }, [setDelivered]);

  return (
    <Screen
      footer={
        <>
          <PrimaryButton label="View order" onPress={() => navigation.navigate("Tabs")} />
          <OutlineButton label="Rate driver" icon="star-outline" />
        </>
      }
    >
      <ScrollView contentContainerStyle={[styles.pad, { alignItems: "center", paddingTop: 16 }]}>
        <Text style={{ fontSize: 64 }}>🏭</Text>
        <View style={styles.ok}>
          <Ionicons name="checkmark" size={22} color={colors.forest} />
        </View>
        <Text style={styles.h1}>Delivery completed</Text>
        <Text style={styles.centerMuted}>
          {kg(order.qtyKg)} {order.product.toLowerCase()} reached {order.destination} safely.
        </Text>
        <View style={[styles.card, { width: "100%" }]}>
          <Row label="Booking ID" value={order.bookingId} strong />
          <Divider />
          <Row label="Delivered on" value="04 Sep 2024, 4:35 PM" />
          <Divider />
          <Row label="Total paid" value={inr(3450)} />
        </View>
        <View style={[styles.card, { width: "100%" }]}>
          <Text style={styles.muted}>Proof of delivery</Text>
          <View style={[styles.row, { marginTop: 8 }]}>
            <Image source={IMAGES.ramesh} style={styles.img48} />
            <View>
              <Text style={styles.farm}>Received by Ramesh Kumar</Text>
              <Text style={styles.muted}>Warehouse Manager</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 24 },
  card: { marginTop: 12, backgroundColor: colors.white, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, ...shadow },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  farm: { fontSize: 14, fontWeight: "600", color: colors.ink },
  muted: { fontSize: 12, color: colors.muted },
  green: { fontSize: 13, fontWeight: "600", color: colors.forest },
  km: { marginTop: 12, textAlign: "right", fontSize: 12, fontWeight: "600", color: colors.muted },
  img48: { width: 48, height: 48, borderRadius: 10 },
  img64: { width: 64, height: 56, borderRadius: 10 },
  av: { width: 48, height: 48, borderRadius: 24 },
  avSm: { width: 44, height: 44, borderRadius: 22 },
  upi: { flexDirection: "row", alignItems: "center", gap: 8 },
  upiBadge: { backgroundColor: "#6C3BEF", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  upiText: { color: colors.white, fontSize: 10, fontWeight: "700" },
  sheet: { flex: 1, backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -16, padding: 20 },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#e4ddd2", marginBottom: 12 },
  pulse: { alignSelf: "center", width: 64, height: 64, borderRadius: 32, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
  h1: { marginTop: 12, fontSize: 22, fontWeight: "600" },
  h2: { marginTop: 12, textAlign: "center", fontSize: 18, fontWeight: "600" },
  centerMuted: { marginTop: 6, textAlign: "center", fontSize: 13.5, color: colors.muted, maxWidth: 300 },
  dots: { marginTop: 20, flexDirection: "row", justifyContent: "center", gap: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.line },
  cancel: { marginTop: 24, textAlign: "center", fontSize: 14, fontWeight: "600", color: colors.muted },
  back: { position: "absolute", top: 12, left: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  trackSheet: { flex: 1, backgroundColor: colors.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20 },
  eta: { fontSize: 20, fontWeight: "700", color: colors.forest },
  two: { marginTop: 8, flexDirection: "row", gap: 8 },
  skip: { marginTop: 12, marginBottom: 16, textAlign: "center", fontSize: 12, color: colors.muted, textDecorationLine: "underline" },
  ok: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center", marginTop: 8 },
});
