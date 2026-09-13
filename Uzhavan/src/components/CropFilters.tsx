import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Chip, OutlineButton, PrimaryButton } from "./ui";
import { useDistricts } from "../api/hooks";
import type { CropFilters as Filters } from "../api/types";
import { colors, shadow } from "../theme";

const RADII = [50, 100, 200, 400] as const;

const SORTS: { key: NonNullable<Filters["sort"]>; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "distance", label: "Nearest" },
  { key: "priceLow", label: "Price: low" },
  { key: "priceHigh", label: "Price: high" },
];

const PRICE_BANDS: { label: string; min?: number; max?: number }[] = [
  { label: "Any price" },
  { label: "Under ₹50", max: 49 },
  { label: "₹50 – ₹100", min: 50, max: 100 },
  { label: "₹100 – ₹200", min: 100, max: 200 },
  { label: "Over ₹200", min: 201 },
];

export function countActive(f: Filters): number {
  let n = 0;
  if (f.district) n += 1;
  if (f.radiusKm) n += 1;
  if (f.verifiedOnly) n += 1;
  if (f.minPrice !== undefined || f.maxPrice !== undefined) n += 1;
  if (f.sort && f.sort !== "newest") n += 1;
  return n;
}

/** The bar above the feed: shows what's applied and opens the sheet. */
export function FilterBar({
  filters,
  origin,
  onOpen,
  onClear,
}: {
  filters: Filters;
  origin: string | null;
  onOpen: () => void;
  onClear: () => void;
}) {
  const active = countActive(filters);
  return (
    <View style={styles.bar}>
      <Pressable style={[styles.barBtn, active > 0 && styles.barBtnOn]} onPress={onOpen}>
        <Ionicons
          name="options-outline"
          size={16}
          color={active > 0 ? colors.white : colors.ink}
        />
        <Text style={[styles.barText, active > 0 && { color: colors.white }]}>
          Filters{active > 0 ? ` · ${active}` : ""}
        </Text>
      </Pressable>

      {filters.radiusKm && origin ? (
        <Chip label={`📍 ${filters.radiusKm} km of ${origin}`} tone="mint" />
      ) : origin ? (
        <Chip label={`📍 ${origin}`} tone="mint" />
      ) : null}

      {filters.verifiedOnly ? <Chip label="✓ Verified only" tone="mint" /> : null}

      {active > 0 ? (
        <Pressable onPress={onClear} hitSlop={8}>
          <Text style={styles.clear}>Clear</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function FilterSheet({
  visible,
  filters,
  onApply,
  onClose,
}: {
  visible: boolean;
  filters: Filters;
  onApply: (f: Filters) => void;
  onClose: () => void;
}) {
  const districts = useDistricts();
  const [draft, setDraft] = useState<Filters>(filters);

  // Re-seed the draft each time the sheet opens.
  const open = () => setDraft(filters);

  const band = PRICE_BANDS.findIndex(
    (b) => b.min === draft.minPrice && b.max === draft.maxPrice,
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onShow={open}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHead}>
            <Text style={styles.h2}>Filters</Text>
            <Pressable onPress={() => setDraft({})} hitSlop={8}>
              <Text style={styles.clear}>Reset</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>
            <Text style={styles.section}>Distance from</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowWrap}>
              <Chip
                label="My district"
                active={!draft.district}
                onPress={() => setDraft({ ...draft, district: undefined })}
              />
              {(districts.data ?? []).map((d) => (
                <Chip
                  key={d}
                  label={d}
                  active={draft.district === d}
                  onPress={() => setDraft({ ...draft, district: d })}
                />
              ))}
            </ScrollView>

            <Text style={styles.section}>Within</Text>
            <View style={styles.wrap}>
              <Chip
                label="Anywhere"
                active={!draft.radiusKm}
                onPress={() => setDraft({ ...draft, radiusKm: undefined })}
              />
              {RADII.map((r) => (
                <Chip
                  key={r}
                  label={`${r} km`}
                  active={draft.radiusKm === r}
                  onPress={() => setDraft({ ...draft, radiusKm: r })}
                />
              ))}
            </View>

            <Text style={styles.section}>Price per kg</Text>
            <View style={styles.wrap}>
              {PRICE_BANDS.map((b, i) => (
                <Chip
                  key={b.label}
                  label={b.label}
                  active={band === i}
                  onPress={() => setDraft({ ...draft, minPrice: b.min, maxPrice: b.max })}
                />
              ))}
            </View>

            <Text style={styles.section}>Sort by</Text>
            <View style={styles.wrap}>
              {SORTS.map((s) => (
                <Chip
                  key={s.key}
                  label={s.label}
                  active={(draft.sort ?? "newest") === s.key}
                  onPress={() => setDraft({ ...draft, sort: s.key })}
                />
              ))}
            </View>

            <Pressable
              style={styles.toggle}
              onPress={() => setDraft({ ...draft, verifiedOnly: !draft.verifiedOnly })}
            >
              <View style={[styles.box, draft.verifiedOnly && styles.boxOn]}>
                {draft.verifiedOnly ? (
                  <Ionicons name="checkmark" size={14} color={colors.white} />
                ) : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleTitle}>Verified farms only</Text>
                <Text style={styles.hint}>
                  Farms whose documents our team has checked. Fewer results, less risk.
                </Text>
              </View>
            </Pressable>
          </ScrollView>

          <View style={styles.footer}>
            <View style={{ flex: 1 }}>
              <OutlineButton label="Cancel" onPress={onClose} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label="Show results"
                onPress={() => {
                  onApply(draft);
                  onClose();
                }}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bar: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  barBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow,
  },
  barBtnOn: { backgroundColor: colors.forest, borderColor: colors.forest },
  barText: { fontSize: 12.5, fontWeight: "600", color: colors.ink },
  clear: { fontSize: 12.5, fontWeight: "600", color: colors.forest },

  backdrop: { flex: 1, backgroundColor: "#0000006b", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.cream,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    maxHeight: "86%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#d7d0c4",
    marginBottom: 12,
  },
  sheetHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  h2: { fontSize: 18, fontWeight: "700", color: colors.ink },
  section: { marginTop: 20, marginBottom: 9, fontSize: 13, fontWeight: "600", color: colors.forest },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  rowWrap: { flexDirection: "row", gap: 8, paddingRight: 16 },
  toggle: { marginTop: 22, flexDirection: "row", gap: 12, alignItems: "flex-start" },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#cfc8bc",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  boxOn: { backgroundColor: colors.forest, borderColor: colors.forest },
  toggleTitle: { fontSize: 14, fontWeight: "600", color: colors.ink },
  hint: { marginTop: 3, fontSize: 12, lineHeight: 17, color: colors.muted },
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
});
