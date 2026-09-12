import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen } from "../../components/Chrome";
import { Chip } from "../../components/ui";
import { useDriverTrips } from "../../api/hooks";
import { BOOKING_LABEL, type ApiBooking } from "../../api/types";
import { imageFor } from "../../lib/images";
import { inr, kg } from "../../lib/format";
import type { DriverStackParamList } from "../../navigation/types";
import { colors, shadow } from "../../theme";

export function DriverTrips() {
  const navigation = useNavigation<NativeStackNavigationProp<DriverStackParamList>>();
  const trips = useDriverTrips();

  const rows = trips.data ?? [];
  const active = rows.filter((t) => t.status !== "DELIVERED" && t.status !== "CANCELLED");
  const past = rows.filter((t) => t.status === "DELIVERED" || t.status === "CANCELLED");

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={styles.head}>
          <Text style={styles.h1}>My trips</Text>
        </View>

        {trips.isLoading ? <ActivityIndicator color={colors.forest} style={{ marginTop: 32 }} /> : null}
        {!trips.isLoading && rows.length === 0 ? (
          <Text style={styles.empty}>No trips yet. Accept a job and it shows up here.</Text>
        ) : null}

        {active.length > 0 ? <Text style={styles.section}>In progress</Text> : null}
        {active.map((t) => (
          <Card key={t.id} trip={t} onPress={() => navigation.navigate("TripDetail", { bookingId: t.id })} highlight />
        ))}

        {past.length > 0 ? <Text style={styles.section}>Completed</Text> : null}
        {past.map((t) => (
          <Card key={t.id} trip={t} onPress={() => navigation.navigate("TripDetail", { bookingId: t.id })} />
        ))}
      </ScrollView>
    </Screen>
  );
}

function Card({
  trip,
  onPress,
  highlight,
}: {
  trip: ApiBooking;
  onPress: () => void;
  highlight?: boolean;
}) {
  const delivered = trip.status === "DELIVERED";
  const cancelled = trip.status === "CANCELLED";
  return (
    <Pressable style={[styles.card, highlight && styles.cardOn]} onPress={onPress}>
      <Image source={imageFor(trip.order?.crop?.imageKey)} style={styles.img} />
      <View style={{ flex: 1 }}>
        <View style={styles.between}>
          <Text style={styles.title}>{trip.order?.product}</Text>
          <Chip
            label={BOOKING_LABEL[trip.status]}
            tone={delivered ? "mint" : cancelled ? "neutral" : "amber"}
          />
        </View>
        <Text style={styles.muted}>{kg(trip.order?.quantityKg ?? 0)}</Text>
        <Text style={styles.muted} numberOfLines={1}>
          {trip.pickup} → {trip.destination}
        </Text>
        <View style={[styles.between, { marginTop: 6 }]}>
          <Text style={styles.green}>{inr(trip.total)}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.faint} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 32 },
  head: { height: 48, justifyContent: "center" },
  h1: { fontSize: 20, fontWeight: "700", color: colors.ink },
  section: { marginTop: 20, marginBottom: 4, fontSize: 13, fontWeight: "600", color: colors.forest },
  empty: { marginTop: 32, textAlign: "center", fontSize: 13.5, color: colors.muted },
  card: { marginTop: 10, flexDirection: "row", gap: 12, backgroundColor: colors.white, borderRadius: 16, padding: 12, borderWidth: 2, borderColor: "transparent", ...shadow },
  cardOn: { borderColor: colors.forest },
  img: { width: 60, height: 60, borderRadius: 12 },
  title: { fontSize: 15, fontWeight: "600", color: colors.ink, flexShrink: 1 },
  muted: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  green: { fontSize: 14, fontWeight: "700", color: colors.forest },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
});
