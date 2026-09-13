import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppHeader, Screen } from "../../components/Chrome";
import { Chip, InfoNote } from "../../components/ui";
import { useDemand } from "../../api/hooks";
import { inr, kg } from "../../lib/format";
import { colors, shadow } from "../../theme";

const RADII = [100, 200, 400] as const;

/**
 * What buyers around this farm are actually buying, so a farmer can decide
 * what's worth planting and listing.
 *
 * Everything here is aggregate on purpose — the server won't hand over
 * individual requests, because those are a private negotiation between one
 * buyer and one farm.
 */
export function Demand() {
  const [radiusKm, setRadiusKm] = useState<number>(200);
  const demand = useDemand(radiusKm);

  const data = demand.data;
  const trends = data?.trends ?? [];
  const buyers = data?.buyers ?? [];
  const gaps = trends.filter((t) => t.gap);

  return (
    <Screen>
      <AppHeader title="What buyers want" />
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={styles.radiusRow}>
          {RADII.map((r) => (
            <Pressable
              key={r}
              onPress={() => setRadiusKm(r)}
              style={[styles.radius, radiusKm === r && styles.radiusOn]}
            >
              <Text style={[styles.radiusText, radiusKm === r && styles.radiusTextOn]}>
                {r} km
              </Text>
            </Pressable>
          ))}
        </View>

        {data?.origin ? (
          <Text style={styles.scope}>
            Around {data.origin} · {data.districtsInRange} district
            {data.districtsInRange === 1 ? "" : "s"} in range · last 90 days
          </Text>
        ) : null}

        {demand.isLoading ? <ActivityIndicator color={colors.forest} style={{ marginTop: 40 }} /> : null}

        {!demand.isLoading && trends.length === 0 ? (
          <Text style={styles.empty}>
            No buyer requests in range yet. Widen the radius, or list a crop — buyers search by
            district and yours may not be covered.
          </Text>
        ) : null}

        {gaps.length > 0 ? (
          <View style={{ marginTop: 16 }}>
            <InfoNote tone="amber">
              <Ionicons name="bulb-outline" size={16} color={colors.amberText} />
              <Text style={{ flex: 1, color: colors.amberText, fontSize: 12.5 }}>
                Buyers near you are asking for {gaps.map((g) => g.category).join(", ")} and you
                aren’t listing {gaps.length === 1 ? "it" : "any of them"}.
              </Text>
            </InfoNote>
          </View>
        ) : null}

        {trends.length > 0 ? <Text style={styles.section}>Demand by crop</Text> : null}
        {trends.map((t) => (
          <View key={t.category} style={styles.card}>
            <View style={styles.between}>
              <Text style={styles.cardTitle}>{t.category}</Text>
              {t.gap ? <Chip label="You don’t list this" tone="amber" /> : null}
            </View>
            <Text style={styles.big}>{kg(t.totalKg)}</Text>
            <Text style={styles.muted}>
              {t.requests} request{t.requests === 1 ? "" : "s"}
              {t.avgPricePerKg ? ` · avg ${inr(t.avgPricePerKg)}/kg` : ""}
            </Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${Math.min(100, t.acceptRate)}%` }]} />
            </View>
            <Text style={styles.faint}>{t.acceptRate}% of these got accepted by a farm</Text>
          </View>
        ))}

        {buyers.length > 0 ? <Text style={styles.section}>Buyers in range</Text> : null}
        {buyers.map((b) => (
          <View key={b.id} style={[styles.card, styles.row]}>
            <View style={styles.avatar}>
              <Ionicons name="storefront-outline" size={18} color={colors.forest} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.between}>
                <Text style={styles.cardTitle}>{b.business ?? b.name}</Text>
                {b.verified ? (
                  <Ionicons name="shield-checkmark" size={16} color={colors.forest} />
                ) : null}
              </View>
              <Text style={styles.muted}>
                {b.district ?? "—"}
                {b.market ? ` · ${b.market}` : ""}
                {b.distanceKm != null ? ` · ~${b.distanceKm} km` : ""}
              </Text>
              <Text style={styles.faint}>
                {b.orders} order{b.orders === 1 ? "" : "s"} placed
              </Text>
            </View>
          </View>
        ))}

        {buyers.length > 0 ? (
          <Text style={styles.foot}>
            Buyers reach out to you. Listing a crop they want is what puts you in front of them.
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 32 },
  radiusRow: { flexDirection: "row", gap: 8 },
  radius: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  radiusOn: { backgroundColor: colors.forest, borderColor: colors.forest },
  radiusText: { fontSize: 12.5, fontWeight: "600", color: colors.muted },
  radiusTextOn: { color: colors.white },
  scope: { marginTop: 12, fontSize: 12, color: colors.faint },
  section: { marginTop: 22, marginBottom: 2, fontSize: 13, fontWeight: "600", color: colors.forest },
  card: { marginTop: 10, backgroundColor: colors.white, borderRadius: 16, padding: 14, ...shadow },
  row: { flexDirection: "row", gap: 12, alignItems: "center" },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitle: { flex: 1, fontSize: 14.5, fontWeight: "600", color: colors.ink },
  big: { marginTop: 6, fontSize: 22, fontWeight: "700", color: colors.forest },
  muted: { marginTop: 2, fontSize: 12.5, color: colors.muted },
  faint: { marginTop: 6, fontSize: 11.5, color: colors.faint },
  barTrack: {
    marginTop: 10,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.cream,
    overflow: "hidden",
  },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.forest },
  empty: { marginTop: 40, textAlign: "center", fontSize: 13.5, lineHeight: 20, color: colors.muted },
  foot: { marginTop: 20, textAlign: "center", fontSize: 12, lineHeight: 18, color: colors.faint },
});
