import { useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../components/Chrome";
import { Logo } from "../../components/Logo";
import { Chip, Field, OutlineButton, PrimaryButton } from "../../components/ui";
import { useDriverSummary, useSetAvailability, useUpdateTruck } from "../../api/hooks";
import { useAuth } from "../../context/AuthContext";
import { imageFor } from "../../lib/images";
import { ApiError } from "../../lib/api";
import { inr } from "../../lib/format";
import { colors, shadow } from "../../theme";

export function DriverAccount() {
  const { user, signOut } = useAuth();
  const summary = useDriverSummary();
  const availability = useSetAvailability();
  const updateTruck = useUpdateTruck();

  const driver = summary.data?.driver;
  const truck = summary.data?.truck;

  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState("");
  const [eta, setEta] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const startEdit = () => {
    setPrice(String(truck?.price ?? ""));
    setEta(String(truck?.etaMin ?? ""));
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    setWorking(true);
    setError(null);
    try {
      await updateTruck.mutateAsync({ price: Number(price), etaMin: Number(eta) });
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t save.");
    } finally {
      setWorking(false);
    }
  };

  if (summary.isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.forest} style={{ marginTop: 64 }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <Logo compact />

        <View style={[styles.card, styles.row, { marginTop: 12 }]}>
          <Image source={imageFor(driver?.photoKey ?? user?.avatarKey)} style={styles.av} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{driver?.name ?? user?.name}</Text>
            <Text style={styles.muted}>
              ★ {driver?.rating.toFixed(1)} · {driver?.trips} trips
            </Text>
          </View>
          {driver?.verified ? <Chip label="Verified" tone="mint" /> : null}
        </View>

        <View style={[styles.card, styles.row]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.body}>Accepting trips</Text>
            <Text style={styles.muted}>Buyers only see your truck while you’re online.</Text>
          </View>
          <Switch
            value={driver?.online ?? false}
            onValueChange={(v) => availability.mutate(v)}
            trackColor={{ true: colors.forest, false: colors.line }}
            thumbColor={colors.white}
          />
        </View>

        <Text style={styles.section}>My truck</Text>
        {truck ? (
          <View style={[styles.card, { padding: 0, overflow: "hidden" }]}>
            <Image source={imageFor(truck.photoKey)} style={styles.truckImg} />
            <View style={{ padding: 14, gap: 4 }}>
              <Text style={styles.title}>{truck.name}</Text>
              <Text style={styles.muted}>
                {truck.body} · {truck.capacityTons} ton · {truck.plate}
              </Text>
              {!editing ? (
                <>
                  <Text style={styles.green}>Base fare {inr(truck.price)} · ETA {truck.etaMin} min</Text>
                  <View style={{ marginTop: 12, flexDirection: "row" }}>
                    <OutlineButton label="Edit fare" icon="pencil-outline" onPress={startEdit} />
                  </View>
                </>
              ) : (
                <View style={{ marginTop: 10, gap: 12 }}>
                  <Field label="Base fare (₹)" value={price} onChangeText={setPrice} keyboardType="number-pad" />
                  <Field label="Typical ETA (minutes)" value={eta} onChangeText={setEta} keyboardType="number-pad" />
                  {error ? <Text style={styles.error}>{error}</Text> : null}
                  <PrimaryButton label="Save" onPress={save} loading={working} disabled={working} />
                  <OutlineButton label="Cancel" onPress={() => setEditing(false)} />
                </View>
              )}
            </View>
          </View>
        ) : (
          <Text style={styles.muted}>No truck registered on this account.</Text>
        )}

        <View style={[styles.card, { padding: 0, overflow: "hidden", marginTop: 12 }]}>
          <InfoRow icon="call-outline" title={user?.phone ?? "—"} sub="Your number" />
          <InfoRow icon="mail-outline" title={user?.email ?? "—"} sub="Sign-in email" last />
        </View>

        <View style={styles.stats}>
          <Stat n={String(summary.data?.completedTrips ?? 0)} l="Trips done" />
          <Stat n={inr(summary.data?.earnings ?? 0)} l="Earned" />
        </View>

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

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <View style={[styles.card, { flex: 1, alignItems: "center", marginBottom: 0 }]}>
      <Text style={styles.statN}>{n}</Text>
      <Text style={styles.muted}>{l}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 32 },
  card: { marginBottom: 12, backgroundColor: colors.white, borderRadius: 16, padding: 14, ...shadow },
  row: { flexDirection: "row", gap: 12, alignItems: "center" },
  av: { width: 56, height: 56, borderRadius: 28 },
  truckImg: { width: "100%", height: 130 },
  title: { fontSize: 16, fontWeight: "600", color: colors.ink },
  body: { fontSize: 13.5, fontWeight: "500", color: colors.ink },
  muted: { fontSize: 12, color: colors.muted, marginTop: 2 },
  green: { marginTop: 4, fontSize: 13, fontWeight: "600", color: colors.forest },
  section: { marginTop: 8, marginBottom: 10, fontSize: 13, fontWeight: "600", color: colors.forest },
  stats: { flexDirection: "row", gap: 8, marginTop: 4 },
  statN: { fontSize: 19, fontWeight: "700", color: colors.forest },
  info: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  infoBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  error: { fontSize: 13, color: colors.danger },
  foot: { marginTop: 24, textAlign: "center", fontSize: 12, color: colors.faint },
});
