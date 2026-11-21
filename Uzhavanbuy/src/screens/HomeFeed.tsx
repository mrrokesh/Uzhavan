import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Logo } from "../components/Logo";
import { Screen } from "../components/Chrome";
import { Chip } from "../components/ui";
import { FeedCard } from "../components/Widgets";
import { NotificationBell } from "../components/NotificationBell";
import { SuggestedRow } from "../components/SuggestedRow";
import { useApp } from "../context/AppContext";
import { FilterBar, FilterSheet } from "../components/CropFilters";
import { BuyerLocation, type ShopPlace } from "../components/LocationSheet";
import { loadPlace, savePlace } from "../lib/place";
import type { CropFilters as Filters } from "../api/types";
import { useCategories, useCrops, useMe, useToggleSaved, useUpdateProfile } from "../api/hooks";
import { ApiError } from "../lib/api";
import type { RootStackParamList } from "../navigation/types";
import { colors, shadow } from "../theme";
import { useDebounced } from "../lib/useDebounced";

const TABS = [
  { id: "for-you" as const, label: "For you" },
  { id: "ready" as const, label: "Ready now" },
  { id: "upcoming" as const, label: "Upcoming" },
  { id: "following" as const, label: "Following" },
];

export function HomeFeed() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { filter, setFilter, search, setSearch, savedOnly, setSavedOnly } = useApp();

  const [filters, setFilters] = useState<Filters>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [locOpen, setLocOpen] = useState(false);
  const [shop, setShop] = useState<ShopPlace>({ state: "Tamil Nadu", district: "", radiusKm: 100 });
  const debouncedSearch = useDebounced(search);
  const cropsQuery = useCrops(filter, debouncedSearch, filters);
  const categoryList = useCategories();
  const me = useMe();
  const toggleSaved = useToggleSaved();
  const updateProfile = useUpdateProfile();

  const saved = me.data?.saved ?? [];
  const outsideTamilNadu = shop.state !== "Tamil Nadu";
  const rows = outsideTamilNadu
    ? []
    : (cropsQuery.data?.crops ?? []).filter((crop) => !savedOnly || saved.includes(crop.id));
  const origin = cropsQuery.data?.origin ?? null;
  const placeLabel = shop.district
    ? `${shop.district}, ${shop.state}${shop.state === "Tamil Nadu" && shop.radiusKm ? ` · ${shop.radiusKm} km` : ""}`
    : me.data?.district
      ? `${me.data.district}, Tamil Nadu`
      : "Set location";

  useEffect(() => {
    let live = true;
    void loadPlace().then((savedPlace) => {
      if (!live) return;
      const next: ShopPlace = savedPlace ?? {
        state: "Tamil Nadu",
        district: me.data?.district ?? "",
        radiusKm: 100,
      };
      if (!next.district && me.data?.district) next.district = me.data.district;
      setShop(next);
      if (next.state === "Tamil Nadu" && next.district) {
        setFilters((current) => ({ ...current, district: next.district, radiusKm: next.radiusKm }));
      }
    });
    return () => {
      live = false;
    };
  }, [me.data?.district]);
  const categories = categoryList.data ?? [];

  const applyLocation = async (next: ShopPlace) => {
    setSavedOnly(false);
    setShop(next);
    await savePlace(next);
    if (next.state === "Tamil Nadu") {
      setFilters((current) => ({ ...current, district: next.district, radiusKm: next.radiusKm }));
      try {
        await updateProfile.mutateAsync({ district: next.district });
      } catch (err) {
        Alert.alert(
          "Location updated on this screen",
          err instanceof ApiError ? err.message : "It will be saved to your account when the connection is back.",
        );
      }
    } else {
      setFilters((current) => ({ ...current, district: undefined, radiusKm: undefined }));
    }
  };

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
            <Pressable style={styles.loc} onPress={() => setLocOpen(true)} accessibilityLabel="Change location">
              <Ionicons name="location-outline" size={14} color={colors.forest} />
              <Text style={styles.locText} numberOfLines={1}>{placeLabel}</Text>
              <Ionicons name="chevron-down" size={12} color={colors.faint} />
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate("Help")}
              style={styles.bell}
              accessibilityLabel="Support"
              hitSlop={8}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.ink} />
            </Pressable>
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
            <Chip
              key={f.id}
              label={f.label}
              active={filter === f.id && !savedOnly}
              onPress={() => {
                setSavedOnly(false);
                setFilter(f.id);
              }}
            />
          ))}
          <Chip label="Saved" active={savedOnly} onPress={() => setSavedOnly(!savedOnly)} />
        </ScrollView>

        {categories.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 10 }}
            contentContainerStyle={{ gap: 8 }}
          >
            <Chip
              label="All crops"
              active={!filters.category}
              onPress={() => setFilters((current) => ({ ...current, category: undefined }))}
            />
            {categories.map((name) => (
              <Chip
                key={name}
                label={name}
                active={filters.category === name}
                onPress={() =>
                  setFilters((current) => ({
                    ...current,
                    category: current.category === name ? undefined : name,
                  }))
                }
              />
            ))}
          </ScrollView>
        ) : null}

        <FilterBar
          filters={filters}
          origin={origin}
          onOpen={() => setSheetOpen(true)}
          onClear={() => setFilters({})}
        />
        {savedOnly ? (
          <Text style={styles.scope}>Showing crops you saved.</Text>
        ) : null}

        {/* Only on the unfiltered default view. Someone who has narrowed the
            list to one district under ₹30 is answering their own question, and
            a row of our picks underneath it is noise. */}
        {filter === "for-you" && !search.trim() && Object.keys(filters).length === 0 ? (
          <SuggestedRow onOpen={(id) => navigation.navigate("CropDetail", { id })} />
        ) : null}

        <View style={{ marginTop: 16, gap: 12 }}>
          {cropsQuery.isLoading ? (
            <ActivityIndicator color={colors.forest} style={{ marginTop: 32 }} />
          ) : cropsQuery.isError ? (
            <Text style={styles.msg}>Couldn’t reach the marketplace. Pull down to retry.</Text>
          ) : rows.length === 0 ? (
            <Text style={styles.msg}>
              {outsideTamilNadu
                ? `No farms are listed in ${shop.state} yet. Crops on the market today are from Tamil Nadu.`
                : search
                ? `Nothing matches “${search}”.`
                : filters.radiusKm
                  ? `No crops within ${filters.radiusKm} km${origin ? ` of ${origin}` : ""}. Try widening the distance.`
                  : filters.verifiedOnly
                    ? "No verified farms match yet. Turn off the verified filter to see more."
                    : savedOnly
                  ? "No saved crops in this list. Save one from the feed."
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
                onFarm={() => navigation.navigate("FarmerProfile", { farmId: crop.farmId, cropId: crop.id })}
              />
            ))
          )}
          {cropsQuery.hasNextPage ? (
            <Pressable
              onPress={() => void cropsQuery.fetchNextPage()}
              disabled={cropsQuery.isFetchingNextPage}
              style={styles.more}
            >
              {cropsQuery.isFetchingNextPage ? (
                <ActivityIndicator color={colors.forest} />
              ) : (
                <Text style={styles.moreText}>Show more crops</Text>
              )}
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <FilterSheet
        visible={sheetOpen}
        filters={filters}
        onApply={setFilters}
        onClose={() => setSheetOpen(false)}
      />
      <BuyerLocation
        visible={locOpen}
        place={shop.district ? shop : { ...shop, district: me.data?.district ?? "" }}
        onApply={(next) => void applyLocation(next)}
        onClose={() => setLocOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 24 },
  top: { flexDirection: "row", alignItems: "center", gap: 8 },
  topRight: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  bell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    ...shadow,
  },
  loc: {
    flexShrink: 1,
    minWidth: 0,
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locText: { flexShrink: 1, fontSize: 12, fontWeight: "600", color: colors.ink },
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
  more: { alignItems: "center", paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.line },
  moreText: { fontSize: 14, fontWeight: "600", color: colors.forest },
  msg: { marginTop: 32, textAlign: "center", fontSize: 13, color: colors.muted },
  scope: { marginTop: 8, fontSize: 12, color: colors.muted },
});
