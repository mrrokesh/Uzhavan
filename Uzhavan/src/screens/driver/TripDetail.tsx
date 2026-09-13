import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { AppHeader, Screen } from "../../components/Chrome";
import { Chip, Divider, Field, InfoNote, OutlineButton, PrimaryButton, Row } from "../../components/ui";
import { RouteStops, Tracker } from "../../components/Widgets";
import { useAdvanceTrip, useCancelTrip, useDriverTrips } from "../../api/hooks";
import { BOOKING_LABEL, TRIP_STEPS, tripStepIndex } from "../../api/types";
import { imageFor } from "../../lib/images";
import { ApiError } from "../../lib/api";
import { inr, kg } from "../../lib/format";
import type { DriverStackParamList } from "../../navigation/types";
import { colors, shadow } from "../../theme";

export function TripDetail() {
  const navigation = useNavigation();
  const { bookingId } = useRoute<RouteProp<DriverStackParamList, "TripDetail">>().params;
  const trips = useDriverTrips();
  const advance = useAdvanceTrip();
  const cancel = useCancelTrip();

  const [receivedBy, setReceivedBy] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const trip = useMemo(() => trips.data?.find((t) => t.id === bookingId), [trips.data, bookingId]);

  if (trips.isLoading || !trip) {
    return (
      <Screen>
        <AppHeader title="Trip" />
        {trips.isLoading ? (
          <ActivityIndicator color={colors.forest} style={{ marginTop: 48 }} />
        ) : (
          <Text style={styles.empty}>This trip is no longer available.</Text>
        )}
      </Screen>
    );
  }

  const done = trip.status === "DELIVERED";
  const cancelled = trip.status === "CANCELLED";
  const stepIndex = tripStepIndex(trip.status);
  const next = TRIP_STEPS[stepIndex + 1];
  const needsProof = next?.status === "DELIVERED";

  const step = async () => {
    if (needsProof && receivedBy.trim().length < 2) {
      setError("Enter who received the crop at the warehouse.");
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await advance.mutateAsync({
        id: trip.id,
        receivedBy: needsProof ? receivedBy.trim() : undefined,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t update this trip.");
    } finally {
      setWorking(false);
    }
  };

  const confirmCancel = () => {
    Alert.alert("Cancel this trip?", "The buyer will be told and the order goes back to the truck list.", [
      { text: "Keep trip", style: "cancel" },
      {
        text: "Cancel trip",
        style: "destructive",
        onPress: async () => {
          try {
            await cancel.mutateAsync({ id: trip.id, reason: "Driver cancelled" });
            navigation.goBack();
          } catch (err) {
            Alert.alert("Couldn’t cancel", err instanceof ApiError ? err.message : "Try again.");
          }
        },
      },
    ]);
  };

  const phone = trip.order?.buyer?.phone;

  return (
    <Screen
      footer={
        done || cancelled ? (
          <OutlineButton label="Back to trips" onPress={() => navigation.goBack()} />
        ) : (
          <>
            <PrimaryButton
              label={next?.action ?? "Update"}
              onPress={step}
              loading={working}
              disabled={working}
            />
            {trip.status === "ACCEPTED" ? (
              <OutlineButton label="Cancel trip" tone="danger" onPress={confirmCancel} />
            ) : null}
          </>
        )
      }
    >
      <AppHeader title={trip.code} />
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <View style={styles.statusRow}>
          <Chip
            label={BOOKING_LABEL[trip.status]}
            tone={done ? "mint" : cancelled ? "neutral" : "amber"}
          />
          <Text style={styles.fare}>{inr(trip.total)}</Text>
        </View>

        <View style={[styles.card, styles.row]}>
          <Image source={imageFor(trip.order?.crop?.imageKey)} style={styles.img} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{trip.order?.product}</Text>
            <Text style={styles.muted}>{kg(trip.order?.quantityKg ?? 0)}</Text>
            <Text style={styles.muted}>Pickup {trip.order?.harvestDate}</Text>
          </View>
        </View>

        <View style={[styles.card, { padding: 16 }]}>
          <RouteStops pickup={trip.pickup} drop={trip.destination} />
          <Text style={styles.km}>{trip.distanceKm} km</Text>
        </View>

        <View style={[styles.card, styles.row]}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={20} color={colors.forest} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{trip.order?.buyer?.business ?? trip.order?.buyer?.name}</Text>
            <Text style={styles.muted}>{trip.order?.buyer?.name}</Text>
          </View>
          {phone ? (
            <OutlineButton label="Call" icon="call-outline" onPress={() => Linking.openURL(`tel:${phone}`)} />
          ) : null}
        </View>

        <Text style={styles.section}>Trip progress</Text>
        <View style={styles.card}>
          <Tracker
            steps={TRIP_STEPS.map((s, i) => ({
              title: s.title,
              meta:
                i <= stepIndex
                  ? "Done"
                  : i === stepIndex + 1
                    ? cancelled
                      ? "Cancelled"
                      : "Next"
                    : "Pending",
              state: i <= stepIndex ? "done" : i === stepIndex + 1 && !cancelled ? "current" : "pending",
            }))}
          />
        </View>

        {needsProof && !done ? (
          <>
            <Text style={styles.section}>Proof of delivery</Text>
            <Field
              label="Received by"
              value={receivedBy}
              onChangeText={setReceivedBy}
              placeholder="Warehouse manager's name"
            />
            <Text style={styles.hint}>The buyer sees this name on their delivery receipt.</Text>
          </>
        ) : null}

        {done ? (
          <View style={{ marginTop: 16 }}>
            <InfoNote>
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.forest} />
              <Text style={{ flex: 1, color: colors.forest, fontSize: 12.5 }}>
                Delivered{trip.proofReceivedBy ? ` — received by ${trip.proofReceivedBy}` : ""}.
              </Text>
            </InfoNote>
          </View>
        ) : null}

        <Text style={styles.section}>Fare</Text>
        <View style={[styles.card, { paddingHorizontal: 16 }]}>
          <Row label="Base fare" value={inr(trip.baseFare)} />
          <Divider />
          <Row label="Loading assistance" value={inr(trip.loadingFee)} />
          <Divider />
          <Row label="Goods protection" value={inr(trip.protectionFee)} />
          <Divider />
          <Row label="Total" value={inr(trip.total)} green />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 32 },
  empty: { marginTop: 48, textAlign: "center", fontSize: 13.5, color: colors.muted },
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  fare: { fontSize: 20, fontWeight: "700", color: colors.forest },
  card: { marginTop: 12, backgroundColor: colors.white, borderRadius: 16, padding: 14, ...shadow },
  row: { flexDirection: "row", gap: 12, alignItems: "center" },
  img: { width: 60, height: 60, borderRadius: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontWeight: "600", color: colors.ink },
  muted: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  km: { marginTop: 12, textAlign: "right", fontSize: 12, fontWeight: "600", color: colors.muted },
  section: { marginTop: 24, marginBottom: 4, fontSize: 13, fontWeight: "600", color: colors.forest },
  hint: { marginTop: 10, fontSize: 12, lineHeight: 17, color: colors.muted },
  error: { marginTop: 16, fontSize: 13, color: colors.danger },
});
