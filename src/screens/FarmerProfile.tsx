import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppHeader, Screen } from "../components/Chrome";
import { Chip } from "../components/ui";
import { useCrop, useFarmCrops } from "../api/hooks";
import { inr, kg } from "../lib/format";
import type { RootStackParamList } from "../navigation/types";
import { colors, shadow } from "../theme";

/** The "View farmer ›" destination — farm details plus their other listings. */
export function FarmerProfile() {
  const { farmId, cropId } = useRoute<RouteProp<RootStackParamList, "FarmerProfile">>().params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const source = useCrop(cropId);
  const crops = useFarmCrops(farmId);

  const farm = source.data;
  const listings = crops.data ?? [];

  if (!farm) {
    return (
      <Screen>
        <AppHeader title="Farmer" />
        <ActivityIndicator color={colors.forest} style={{ marginTop: 48 }} />
      </Screen>
    );
  }

  const totalListed = listings.reduce((sum, c) => sum + c.expectedKg, 0);

  return (
    <Screen>
      <AppHeader title={farm.farmName} />
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={styles.header}>
          <Image source={farm.avatar} style={styles.av} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>
              {farm.farmName} <Text style={{ color: colors.blueTick }}>✓</Text>
            </Text>
            <Text style={styles.muted}>{farm.ownerName}</Text>
            <Text style={styles.muted}>{farm.location}</Text>
          </View>
        </View>

        <View style={styles.stats}>
          <Stat n={`★ ${farm.rating.toFixed(1)}`} l="Rating" />
          <Stat n={String(listings.length)} l="Listings" />
          <Stat n={kg(totalListed)} l="Expected" />
        </View>

        <View style={styles.trust}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.forest} />
          <Text style={styles.trustText}>
            Verified farm. Prices are set by the farmer and confirmed before any payment.
          </Text>
        </View>

        <Text style={styles.section}>Listings from this farm</Text>
        {crops.isLoading ? <ActivityIndicator color={colors.forest} style={{ marginTop: 16 }} /> : null}
        {!crops.isLoading && listings.length === 0 ? (
          <Text style={styles.muted}>No other listings right now.</Text>
        ) : null}

        {listings.map((c) => (
          <Pressable
            key={c.id}
            style={[styles.card, c.id === cropId && styles.cardOn]}
            onPress={() => navigation.navigate("CropDetail", { id: c.id })}
          >
            <Image source={c.image} style={styles.img} />
            <View style={{ flex: 1 }}>
              <View style={styles.between}>
                <Text style={styles.title}>{c.title}</Text>
                <Chip
                  label={c.status === "ready" ? "Ready now" : "Upcoming"}
                  tone={c.status === "ready" ? "mint" : "amber"}
                />
              </View>
              <Text style={styles.muted}>
                {kg(c.availableKg)} available · {c.grade}
              </Text>
              <Text style={styles.green}>{inr(c.pricePerKg)}/kg</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.faint} />
          </Pressable>
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
  header: { flexDirection: "row", gap: 14, alignItems: "center", backgroundColor: colors.white, borderRadius: 16, padding: 14, ...shadow },
  av: { width: 64, height: 64, borderRadius: 32 },
  name: { fontSize: 17, fontWeight: "700", color: colors.ink },
  muted: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  tiny: { fontSize: 11.5, color: colors.muted },
  stats: { marginTop: 12, flexDirection: "row", gap: 8 },
  stat: { flex: 1, backgroundColor: colors.white, borderRadius: 16, padding: 12, alignItems: "center", ...shadow },
  statN: { fontSize: 16, fontWeight: "700", color: colors.forest },
  trust: { marginTop: 12, flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: colors.mint, borderRadius: 14, padding: 14 },
  trustText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: colors.forest },
  section: { marginTop: 24, marginBottom: 4, fontSize: 15, fontWeight: "600", color: colors.ink },
  card: { marginTop: 10, flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: colors.white, borderRadius: 16, padding: 12, borderWidth: 2, borderColor: "transparent", ...shadow },
  cardOn: { borderColor: colors.forest },
  img: { width: 60, height: 60, borderRadius: 12 },
  title: { fontSize: 15, fontWeight: "600", color: colors.ink, flexShrink: 1 },
  green: { marginTop: 4, fontSize: 13.5, fontWeight: "700", color: colors.forest },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
});
