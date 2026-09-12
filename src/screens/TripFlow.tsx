import { useState } from "react";
import { ActivityIndicator, Share, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppHeader, Screen } from "../components/Chrome";
import { MapView } from "../components/MapView";
import { Chip, Divider, InfoNote, OutlineButton, PrimaryButton, Row } from "../components/ui";
import { RatePrompt } from "../components/RatePrompt";
import { RouteStops, Tracker } from "../components/Widgets";
import {
  useBooking,
  useCancelBooking,
  useCreateBooking,
  useFare,
  useOrder,
  usePayBooking,
  useTrucks,
} from "../api/hooks";
import { BOOKING_LABEL, TRIP_STEPS, tripStepIndex } from "../api/types";
import { imageFor } from "../lib/images";
import { ApiError } from "../lib/api";
import { inr, kg } from "../lib/format";
import type { RootStackParamList } from "../navigation/types";
import { colors, shadow } from "../theme";

export function ReviewBooking() {
  const { orderId, truckId } = useRoute<RouteProp<RootStackParamList, "ReviewBooking">>().params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const order = useOrder(orderId).data;
  const trucks = useTrucks(order?.quantityKg);
  const truck = (trucks.data ?? []).find((t) => t.id === truckId);
  const fare = useFare(truckId).data;

  const createBooking = useCreateBooking();
  const pay = usePayBooking();
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  if (!order || !truck || !fare) {
    return (
      <Screen>
        <AppHeader title="Review booking" />
        <ActivityIndicator color={colors.forest} style={{ marginTop: 48 }} />
      </Screen>
    );
  }

  const confirmAndPay = async () => {
    setWorking(true);
    setError(null);
    try {
      const booking = await createBooking.mutateAsync({ orderId, truckId });
      await pay.mutateAsync(booking.id);
      navigation.replace("TrackTruck", { bookingId: booking.id });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t complete the booking.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <Screen
      footer={
        <>
          <PrimaryButton
            label={`Confirm & pay ${inr(fare.total)}`}
            onPress={confirmAndPay}
            loading={working}
            disabled={working}
          />
          {error ? <Text style={styles.err}>{error}</Text> : null}
        </>
      }
    >
      <AppHeader title="Review booking" />
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={[styles.card, { padding: 16 }]}>
          <RouteStops pickup={order.pickup} drop={order.destination} />
        </View>

        <View style={[styles.card, styles.row]}>
          <Image source={imageFor(order.crop?.imageKey)} style={styles.img48} />
          <Text style={styles.farm}>
            {order.product}, {kg(order.quantityKg)}
          </Text>
        </View>

        <View style={[styles.card, styles.row]}>
          <Image source={truck.photo} style={styles.img64} />
          <View style={{ flex: 1 }}>
            <Text style={styles.farm}>{truck.name}</Text>
            <Text style={styles.muted}>
              {truck.driver?.name} · ★ {truck.driver?.rating.toFixed(1)}{" "}
              <Text style={{ color: colors.forest }}>Verified driver</Text>
            </Text>
            <Text style={styles.green}>ETA {truck.etaMin} min</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Row label="Base fare" value={inr(fare.baseFare)} />
          <Divider />
          <Row label="Loading assistance" value={inr(fare.loadingFee)} />
          <Divider />
          <Row label="Goods protection" value={inr(fare.protectionFee)} />
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

        <View style={{ marginTop: 12 }}>
          <InfoNote>
            <Ionicons name="information-circle-outline" size={16} color={colors.forest} />
            <Text style={{ flex: 1, color: colors.forest, fontSize: 12.5 }}>
              After payment the driver gets the job. You’ll see live status once they accept.
            </Text>
          </InfoNote>
        </View>
      </ScrollView>
    </Screen>
  );
}

/**
 * Live trip tracking. Every state here comes from the driver's own app — this
 * screen only polls and renders. Nothing advances on a timer.
 */
export function TrackTruck() {
  const { bookingId } = useRoute<RouteProp<RootStackParamList, "TrackTruck">>().params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const query = useBooking(bookingId, true);
  const cancel = useCancelBooking();
  const booking = query.data;

  if (!booking) {
    return (
      <Screen>
        <AppHeader title="Track truck" />
        <ActivityIndicator color={colors.forest} style={{ marginTop: 48 }} />
      </Screen>
    );
  }

  const stepIndex = tripStepIndex(booking.status);
  const waiting = booking.status === "PAID";
  const delivered = booking.status === "DELIVERED";
  const cancelled = booking.status === "CANCELLED";
  const driver = booking.driver;
  const phone = driver?.user?.phone;

  const eventTime = (status: string) => {
    const e = booking.events?.find((ev) => ev.status === status);
    return e ? new Date(e.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : null;
  };

  return (
    <Screen
      footer={
        delivered ? (
          <PrimaryButton
            label="View delivery receipt"
            onPress={() => navigation.replace("DeliveryCompleted", { bookingId })}
          />
        ) : waiting ? (
          <OutlineButton
            label="Cancel booking"
            tone="danger"
            onPress={() => cancel.mutate(bookingId)}
          />
        ) : undefined
      }
    >
      <View style={{ height: 260 }}>
        <MapView
          variant={waiting ? "finding" : "tracking"}
          chip={BOOKING_LABEL[booking.status]}
          pickupLabel={booking.pickup}
          dropLabel={booking.destination}
        />
        <Pressable style={styles.back} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView style={styles.trackSheet} contentContainerStyle={{ padding: 16 }}>
        {waiting ? (
          <View style={styles.waiting}>
            <ActivityIndicator color={colors.forest} />
            <View style={{ flex: 1 }}>
              <Text style={styles.farm}>Waiting for the driver to accept</Text>
              <Text style={styles.muted}>
                {driver?.name} has been sent this trip. This updates the moment they accept.
              </Text>
            </View>
          </View>
        ) : null}

        {cancelled ? (
          <InfoNote tone="amber">
            <Ionicons name="close-circle-outline" size={16} color={colors.amberText} />
            <Text style={{ flex: 1, color: colors.amberText, fontSize: 12.5 }}>
              This trip was cancelled{booking.cancelReason ? ` — ${booking.cancelReason}` : ""}. Book another
              truck from My Orders.
            </Text>
          </InfoNote>
        ) : null}

        {driver && !cancelled ? (
          <View style={styles.row}>
            <Image source={imageFor(driver.photoKey)} style={styles.avSm} />
            <View style={{ flex: 1 }}>
              <Text style={styles.farm}>{driver.name}</Text>
              <Text style={styles.muted}>
                {booking.truck?.name} · {booking.truck?.plate}
              </Text>
            </View>
            {phone ? (
              <Pressable style={styles.callBtn} onPress={() => Linking.openURL(`tel:${phone}`)}>
                <Ionicons name="call" size={16} color={colors.white} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={{ marginTop: 16 }}>
          <Tracker
            steps={TRIP_STEPS.map((s, i) => ({
              title: s.title,
              meta: eventTime(s.status) ?? (i <= stepIndex ? "Done" : i === stepIndex + 1 ? "Next" : "Pending"),
              state: i <= stepIndex ? "done" : i === stepIndex + 1 && !cancelled ? "current" : "pending",
            }))}
          />
        </View>

        <View style={styles.fareCard}>
          <Row label="Booking ID" value={booking.code} strong />
          <Divider />
          <Row label="Distance" value={`${booking.distanceKm} km`} />
          <Divider />
          <Row label="Total paid" value={inr(booking.total)} green />
        </View>

        {!delivered && !cancelled && !waiting ? (
          <View style={styles.two}>
            <OutlineButton
              label="Share details"
              icon="share-outline"
              onPress={() =>
                // Text, not a link: there's no public tracking page to point at,
                // and a warehouse gateman needs the plate and the code anyway.
                void Share.share({
                  message:
                    `Uzhavan delivery ${booking.code}
` +
                    `${kg(booking.order?.quantityKg ?? 0)} ${booking.order?.product ?? "crop"}
` +
                    `${booking.pickup} → ${booking.destination}
` +
                    `Truck ${booking.truck?.plate ?? "—"}, driver ${booking.driver?.name ?? "—"}` +
                    (booking.driver?.user?.phone ? ` (${booking.driver.user.phone})` : ""),
                })
              }
            />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

export function DeliveryCompleted() {
  const { bookingId } = useRoute<RouteProp<RootStackParamList, "DeliveryCompleted">>().params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const booking = useBooking(bookingId).data;

  if (!booking) {
    return (
      <Screen>
        <AppHeader title="Delivery" />
        <ActivityIndicator color={colors.forest} style={{ marginTop: 48 }} />
      </Screen>
    );
  }

  const deliveredAt = booking.deliveredAt
    ? new Date(booking.deliveredAt).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <Screen
      footer={
        <PrimaryButton label="Back to My Orders" onPress={() => navigation.navigate("Tabs")} />
      }
    >
      <ScrollView contentContainerStyle={[styles.pad, { alignItems: "center", paddingTop: 16 }]}>
        <Text style={{ fontSize: 64 }}>🏭</Text>
        <View style={styles.ok}>
          <Ionicons name="checkmark" size={22} color={colors.forest} />
        </View>
        <Text style={styles.h1}>Delivery completed</Text>
        <Text style={styles.centerMuted}>
          {kg(booking.order?.quantityKg ?? 0)} {booking.order?.product?.toLowerCase()} reached{" "}
          {booking.destination} safely.
        </Text>

        <View style={[styles.card, { width: "100%" }]}>
          <Row label="Booking ID" value={booking.code} strong />
          <Divider />
          <Row label="Delivered on" value={deliveredAt} />
          <Divider />
          <Row label="Total paid" value={inr(booking.total)} green />
        </View>

        {booking.proofReceivedBy ? (
          <View style={[styles.card, { width: "100%" }]}>
            <Text style={styles.muted}>Proof of delivery</Text>
            <View style={[styles.row, { marginTop: 8 }]}>
              <View style={styles.proofAvatar}>
                <Ionicons name="person" size={18} color={colors.forest} />
              </View>
              <View>
                <Text style={styles.farm}>Received by {booking.proofReceivedBy}</Text>
                <Text style={styles.muted}>Confirmed by {booking.driver?.name}</Text>
              </View>
            </View>
          </View>
        ) : null}

        <View style={[styles.card, { width: "100%" }]}>
          <Chip label="Delivered" tone="mint" />
          <View style={{ marginTop: 10 }}>
            <RouteStops pickup={booking.pickup} drop={booking.destination} />
          </View>
        </View>

        {/* Asked here because this is the moment someone still remembers the
            detail. A prompt a week later gets a shrug and a five. */}
        {booking.orderId ? (
          <View style={{ width: "100%" }}>
            <RatePrompt orderId={booking.orderId} />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 24 },
  card: { marginTop: 12, backgroundColor: colors.white, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, ...shadow },
  fareCard: { marginTop: 20, backgroundColor: colors.white, borderRadius: 16, paddingHorizontal: 16, ...shadow },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  farm: { fontSize: 14, fontWeight: "600", color: colors.ink },
  muted: { fontSize: 12, color: colors.muted, marginTop: 2 },
  green: { fontSize: 13, fontWeight: "600", color: colors.forest },
  err: { marginTop: 8, textAlign: "center", fontSize: 12, color: colors.danger },
  img48: { width: 48, height: 48, borderRadius: 10 },
  img64: { width: 64, height: 56, borderRadius: 10 },
  avSm: { width: 44, height: 44, borderRadius: 22 },
  callBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.forest, alignItems: "center", justifyContent: "center" },
  upi: { flexDirection: "row", alignItems: "center", gap: 8 },
  upiBadge: { backgroundColor: "#6C3BEF", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  upiText: { color: colors.white, fontSize: 10, fontWeight: "700" },
  h1: { marginTop: 12, fontSize: 22, fontWeight: "600" },
  centerMuted: { marginTop: 6, textAlign: "center", fontSize: 13.5, color: colors.muted, maxWidth: 300 },
  back: { position: "absolute", top: 12, left: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  trackSheet: { flex: 1, backgroundColor: colors.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20 },
  waiting: { flexDirection: "row", gap: 14, alignItems: "center", backgroundColor: colors.white, borderRadius: 16, padding: 14, marginBottom: 12, ...shadow },
  two: { marginTop: 16, flexDirection: "row", gap: 8 },
  ok: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center", marginTop: 8 },
  proofAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
});
