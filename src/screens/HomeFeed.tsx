import { useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Logo } from "../components/Logo";
import { Screen } from "../components/Chrome";
import { Chip } from "../components/ui";
import { FeedCard } from "../components/Widgets";
import { NotificationBell } from "../components/NotificationBell";
import { useApp } from "../context/AppContext";
import { FilterBar, FilterSheet } from "../components/CropFilters";
import type { CropFilters as Filters } from "../api/types";
import { useCrops, useMe, useToggleSaved } from "../api/hooks";
import type { RootStackParamList } from "../navigation/types";
import { colors, shadow } from "../theme";

const TABS = [
  { id: "for-you" as const, label: "For you" },
  { id: "ready" as const, label: "Ready now" },
  { id: "upcoming" as const, label: "Upcoming" },
  { id: "following" as const, label: "Following" },
];

export function HomeFeed() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { filter, setFilter, search, setSearch } = useApp();

  const [filters, setFilters] = useState<Filters>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const cropsQuery = useCrops(filter, search, filters);
  const me = useMe();
  const toggleSaved = useToggleSaved();

  const saved = me.data?.saved ?? [];
  const rows = cropsQuery.data?.crops ?? [];
  const origin = cropsQuery.data?.origin ?? null;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.pad}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={cropsQuery.isFetching && !cropsQuery.isLoading}
            onRefresh={() => cropsQuery.refetch()}
            tintColor={colors.forest}
          />
        }
      >
        <View style={styles.top}>
          <Logo />
          <View style={styles.topRight}>
            <View style={styles.loc}>
              <Text style={styles.locText}>📍 {me.data?.district ?? "Tamil Nadu"} ▾</Text>
            </View>
            <NotificationBell />
          </View>
        </View>

        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.faint} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search crops or districts"
            placeholderTextColor={colors.faint}
            style={styles.input}
            returnKeyType="search"
          />
          {search ? (
            <Ionicons name="close-circle" size={18} color={colors.faint} onPress={() => setSearch("")} />
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 12 }}
          contentContainerStyle={{ gap: 8 }}
        >
          {TABS.map((f) => (
            <Chip key={f.id} label={f.label} active={filter === f.id} onPress={() => setFilter(f.id)} />
          ))}
        </ScrollView>

        <FilterBar
          filters={filters}
          origin={origin}
          onOpen={() => setSheetOpen(true)}
          onClear={() => setFilters({})}
        />

        <View style={{ marginTop: 16, gap: 12 }}>
          {cropsQuery.isLoading ? (
            <ActivityIndicator color={colors.forest} style={{ marginTop: 32 }} />
          ) : cropsQuery.isError ? (
            <Text style={styles.msg}>Couldn’t reach the marketplace. Pull down to retry.</Text>
          ) : rows.length === 0 ? (
            <Text style={styles.msg}>
              {search
                ? `Nothing matches “${search}”.`
                : filters.radiusKm
                  ? `No crops within ${filters.radiusKm} km${origin ? ` of ${origin}` : ""}. Try widening the distance.`
                  : filters.verifiedOnly
                    ? "No verified farms match yet. Turn off the verified filter to see more."
                    : filter === "following"
                      ? "You’re not following any crops yet."
                      : "No crops listed in this category yet."}
            </Text>
          ) : (
            rows.map((crop) => (
              <FeedCard
                key={crop.id}
                crop={crop}
                saved={saved.includes(crop.id)}
                onOpen={() => navigation.navigate("CropDetail", { id: crop.id })}
                onSave={() => toggleSaved.mutate({ cropId: crop.id, on: !saved.includes(crop.id) })}
              />
            ))
          )}
        </View>
      </ScrollView>

      <FilterSheet
        visible={sheetOpen}
        filters={filters}
        onApply={setFilters}
        onClose={() => setSheetOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 24 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  topRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  loc: { backgroundColor: colors.white, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, ...shadow },
  locText: { fontSize: 12, fontWeight: "500", color: colors.ink },
  search: {
    marginTop: 16,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    ...shadow,
  },
  input: { flex: 1, fontSize: 14, color: colors.ink },
  msg: { marginTop: 32, textAlign: "center", fontSize: 13, color: colors.muted },
});
