import { useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen } from "../../components/Chrome";
import { Logo } from "../../components/Logo";
import { Chip } from "../../components/ui";
import { RouteStops } from "../../components/Widgets";
import { useAdvanceTrip, useDriverJobs, useDriverSummary, useSetAvailability } from "../../api/hooks";
import { imageFor } from "../../lib/images";
import { ApiError } from "../../lib/api";
import { inr, kg } from "../../lib/format";
import type { DriverStackParamList } from "../../navigation/types";
import { colors, shadow } from "../../theme";

export function DriverJobs() {
  const navigation = useNavigation<NativeStackNavigationProp<DriverStackParamList>>();
  const summary = useDriverSummary();
  const jobs = useDriverJobs();
  const availability = useSetAvailability();
  const advance = useAdvanceTrip();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const online = summary.data?.driver.online ?? false;
  const rows = jobs.data ?? [];

  const accept = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      await advance.mutateAsync({ id });
      navigation.navigate("TripDetail", { bookingId: id });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t accept this trip.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={styles.top}>
          <Logo />
          <View style={styles.onlineRow}>
            <Text style={[styles.onlineText, { color: online ? colors.forest : colors.muted }]}>
              {online ? "Online" : "Offline"}
            </Text>
            <Switch
              value={online}
              onValueChange={(v) => availability.mutate(v)}
              trackColor={{ true: colors.forest, false: colors.line }}
              thumbColor={colors.white}
            />
          </View>
        </View>

        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>Available trips</Text>
            <Text style={styles.muted}>
              {summary.data?.truck
                ? `${summary.data.truck.name} · ${summary.data.truck.plate}`
                : "No truck registered"}
            </Text>
          </View>
          <Text style={{ fontSize: 40 }}>🚚</Text>
        </View>

        <View style={styles.stats}>
          <Stat n={String(summary.data?.activeTrips ?? 0)} l="Active" />
          <Stat n={String(summary.data?.completedTrips ?? 0)} l="Completed" />
          <Stat n={inr(summary.data?.earnings ?? 0)} l="Earned" />
        </View>

        {!online ? (
          <View style={styles.offline}>
            <Ionicons name="moon-outline" size={18} color={colors.amberText} />
            <Text style={styles.offlineText}>
              You’re offline — buyers can’t book your truck. Flip the switch to start getting trips.
            </Text>
          </View>
        ) : null}

        {jobs.isLoading ? <ActivityIndicator color={colors.forest} style={{ marginTop: 32 }} /> : null}
        {!jobs.isLoading && rows.length === 0 && online ? (
          <Text style={styles.empty}>
            No trips waiting right now. You’ll see a job here as soon as a buyer books your truck.
          </Text>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {rows.map((b) => (
          <View key={b.id} style={styles.card}>
            <View style={styles.cardTop}>
              <Image source={imageFor(b.order?.crop?.imageKey)} style={styles.img} />
              <View style={{ flex: 1 }}>
                <View style={styles.between}>
                  <Text style={styles.title}>{b.order?.product}</Text>
                  <Chip label="New" tone="amber" />
                </View>
                <Text style={styles.muted}>{kg(b.order?.quantityKg ?? 0)}</Text>
                <Text style={styles.fare}>{inr(b.total)}</Text>
              </View>
            </View>

            <View style={styles.routeBox}>
              <RouteStops pickup={b.pickup} drop={b.destination} />
            </View>

            <View style={styles.between}>
              <Text style={styles.tiny}>{b.distanceKm} km · {b.code}</Text>
              <Pressable
                style={[styles.accept, busy === b.id && { opacity: 0.5 }]}
                disabled={busy === b.id}
                onPress={() => accept(b.id)}
              >
                {busy === b.id ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.acceptText}>Accept trip</Text>
                )}
              </Pressable>
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
      <Text style={styles.tiny}>{l}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 32 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  onlineRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  onlineText: { fontSize: 12.5, fontWeight: "600" },
  hero: { marginTop: 16, flexDirection: "row", alignItems: "center" },
  h1: { fontSize: 22, fontWeight: "700", color: colors.ink },
  muted: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  tiny: { fontSize: 11.5, color: colors.muted },
  stats: { marginTop: 16, flexDirection: "row", gap: 8 },
  stat: { flex: 1, backgroundColor: colors.white, borderRadius: 16, padding: 12, alignItems: "center", ...shadow },
  statN: { fontSize: 17, fontWeight: "700", color: colors.forest },
  offline: { marginTop: 16, flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: colors.amberBg, borderRadius: 14, padding: 14 },
  offlineText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: colors.amberText },
  empty: { marginTop: 32, textAlign: "center", fontSize: 13.5, lineHeight: 20, color: colors.muted },
  error: { marginTop: 16, fontSize: 13, color: colors.danger, textAlign: "center" },
  card: { marginTop: 14, backgroundColor: colors.white, borderRadius: 16, padding: 14, gap: 12, ...shadow },
  cardTop: { flexDirection: "row", gap: 12 },
  img: { width: 60, height: 60, borderRadius: 12 },
  title: { fontSize: 15.5, fontWeight: "600", color: colors.ink },
  fare: { marginTop: 4, fontSize: 17, fontWeight: "700", color: colors.forest },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  routeBox: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, paddingVertical: 14 },
  accept: { backgroundColor: colors.forest, borderRadius: 10, paddingHorizontal: 18, height: 40, alignItems: "center", justifyContent: "center", minWidth: 120 },
  acceptText: { color: colors.white, fontSize: 13.5, fontWeight: "600" },
});
