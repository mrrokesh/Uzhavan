import { useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen } from "../../components/Chrome";
import { Chip } from "../../components/ui";
import { useDeleteCrop, useFarmerCrops } from "../../api/hooks";
import { ApiError } from "../../lib/api";
import { inr, kg, pct } from "../../lib/format";
import type { FarmerStackParamList } from "../../navigation/types";
import { colors, shadow } from "../../theme";

export function Listings() {
  const navigation = useNavigation<NativeStackNavigationProp<FarmerStackParamList>>();
  const crops = useFarmerCrops();
  const remove = useDeleteCrop();
  const [busy, setBusy] = useState<string | null>(null);

  const confirmDelete = (id: string, title: string) => {
    Alert.alert("Remove listing", `Remove “${title}” from the marketplace?`, [
      { text: "Keep", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setBusy(id);
          try {
            const res = await remove.mutateAsync(id);
            if (res.unlisted) {
              Alert.alert("Unlisted", "This crop has sold quantity, so it was hidden instead of deleted.");
            }
          } catch (err) {
            Alert.alert("Couldn’t remove", err instanceof ApiError ? err.message : "Try again.");
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  const rows = crops.data ?? [];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={styles.head}>
          <Text style={styles.h1}>My listings</Text>
          <Pressable onPress={() => navigation.navigate("CropForm", {})} hitSlop={8}>
            <Ionicons name="add-circle" size={28} color={colors.forest} />
          </Pressable>
        </View>

        {crops.isLoading ? <ActivityIndicator color={colors.forest} style={{ marginTop: 32 }} /> : null}
        {crops.isError ? <Text style={styles.empty}>Couldn’t load your listings.</Text> : null}
        {!crops.isLoading && rows.length === 0 ? (
          <Text style={styles.empty}>
            You haven’t listed anything yet. Tap + to put a crop in front of wholesale buyers.
          </Text>
        ) : null}

        {rows.map((c) => {
          const sold = pct(c.reservedKg, c.expectedKg);
          return (
            <View key={c.id} style={styles.card}>
              <Pressable
                style={styles.row}
                onPress={() => navigation.navigate("CropForm", { cropId: c.id })}
              >
                <Image source={c.image} style={styles.img} />
                <View style={{ flex: 1 }}>
                  <View style={styles.between}>
                    <Text style={styles.title}>{c.title}</Text>
                    {c.listed ? (
                      <Chip label={c.status === "ready" ? "Ready now" : "Upcoming"} tone={c.status === "ready" ? "mint" : "amber"} />
                    ) : (
                      <Chip label="Unlisted" />
                    )}
                  </View>
                  <Text style={styles.muted}>
                    {inr(c.pricePerKg)}/kg · {c.grade}
                  </Text>
                  <Text style={styles.muted}>
                    {kg(c.availableKg)} of {kg(c.expectedKg)} still available
                  </Text>
                </View>
              </Pressable>

              <View style={styles.barBg}>
                <View style={[styles.bar, { width: `${sold}%` }]} />
              </View>
              <View style={styles.between}>
                <Text style={styles.tiny}>
                  {sold}% reserved · {c.requestCount} {c.requestCount === 1 ? "request" : "requests"}
                </Text>
                <View style={styles.actions}>
                  <Pressable onPress={() => navigation.navigate("CropForm", { cropId: c.id })} hitSlop={8}>
                    <Ionicons name="pencil-outline" size={18} color={colors.forest} />
                  </Pressable>
                  <Pressable onPress={() => confirmDelete(c.id, c.title)} hitSlop={8} disabled={busy === c.id}>
                    {busy === c.id ? (
                      <ActivityIndicator size="small" color={colors.danger} />
                    ) : (
                      <Ionicons name="trash-outline" size={18} color={colors.danger} />
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 32 },
  head: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  h1: { fontSize: 20, fontWeight: "700", color: colors.ink },
  empty: { marginTop: 32, fontSize: 13.5, lineHeight: 20, color: colors.muted, textAlign: "center" },
  card: { marginTop: 12, backgroundColor: colors.white, borderRadius: 16, padding: 12, gap: 10, ...shadow },
  row: { flexDirection: "row", gap: 12 },
  img: { width: 64, height: 64, borderRadius: 12 },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  title: { fontSize: 15, fontWeight: "600", color: colors.ink, flexShrink: 1 },
  muted: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  tiny: { fontSize: 11.5, color: colors.muted },
  barBg: { height: 6, borderRadius: 99, backgroundColor: colors.line, overflow: "hidden" },
  bar: { height: "100%", backgroundColor: colors.forest },
  actions: { flexDirection: "row", gap: 16, alignItems: "center" },
});
