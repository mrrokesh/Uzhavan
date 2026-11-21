import { useEffect, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Chip, PrimaryButton } from "./ui";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme";

/** Same state list as the farm address form. */
export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

/** All 38 Tamil Nadu districts. Kept here so a short API reply cannot hide any. */
export const TAMIL_NADU_DISTRICTS = [
  "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore", "Dharmapuri", "Dindigul",
  "Erode", "Kallakurichi", "Kancheepuram", "Kanyakumari", "Karur", "Krishnagiri", "Madurai",
  "Mayiladuthurai", "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai",
  "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi", "Thanjavur", "Theni",
  "Thoothukudi", "Tiruchirappalli", "Tirunelveli", "Tirupathur", "Tiruppur", "Tiruvallur",
  "Tiruvannamalai", "Tiruvarur", "Vellore", "Viluppuram", "Virudhunagar",
];

export const RADIUS_OPTIONS: { label: string; km?: number }[] = [
  { label: "This district", km: 10 },
  { label: "50 km", km: 50 },
  { label: "100 km", km: 100 },
  { label: "200 km", km: 200 },
  { label: "Anywhere", km: undefined },
];

function NamePicker({
  visible,
  title,
  options,
  selected,
  placeholder,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: string[];
  selected?: string;
  placeholder: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const rows = q ? options.filter((d) => d.toLowerCase().includes(q)) : options;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} onShow={() => setQuery("")}>
      <SafeAreaView style={styles.page} edges={["top", "bottom"]}>
        <View style={styles.head}>
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
            <Ionicons name="close" size={22} color={colors.ink} />
          </Pressable>
          <Text style={styles.title}>{title}</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.search}>
          <Ionicons name="search" size={16} color={colors.faint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={placeholder}
            placeholderTextColor={colors.faint}
            style={styles.input}
            autoCorrect={false}
          />
        </View>
        <FlatList
          data={rows}
          keyExtractor={(item) => item}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const on = item === selected;
            return (
              <Pressable
                style={styles.row}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
              >
                <Text style={[styles.rowText, on && styles.rowOn]}>{item}</Text>
                {on ? <Ionicons name="checkmark" size={18} color={colors.forest} /> : null}
              </Pressable>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>Nothing matches “{query.trim()}”.</Text>}
        />
      </SafeAreaView>
    </Modal>
  );
}

export function StatePicker({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected?: string;
  onSelect: (state: string) => void;
  onClose: () => void;
}) {
  return (
    <NamePicker
      visible={visible}
      title="State"
      options={INDIAN_STATES}
      selected={selected}
      placeholder="Search states"
      onSelect={onSelect}
      onClose={onClose}
    />
  );
}

export function DistrictPicker({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected?: string;
  onSelect: (district: string) => void;
  onClose: () => void;
}) {
  return (
    <NamePicker
      visible={visible}
      title="District"
      options={TAMIL_NADU_DISTRICTS}
      selected={selected}
      placeholder="Search all 38 districts"
      onSelect={onSelect}
      onClose={onClose}
    />
  );
}

export type ShopPlace = { state: string; district: string; radiusKm?: number };

/** Where the buyer is shopping from. Tamil Nadu uses the district radius search. */
export function BuyerLocation({
  visible,
  place,
  onApply,
  onClose,
}: {
  visible: boolean;
  place: ShopPlace;
  onApply: (next: ShopPlace) => void;
  onClose: () => void;
}) {
  const [stateName, setStateName] = useState(place.state || "Tamil Nadu");
  const [district, setDistrict] = useState(place.district);
  const [radius, setRadius] = useState<number | undefined>(place.radiusKm ?? 100);
  const [picking, setPicking] = useState<"state" | "district" | null>(null);
  const inTamilNadu = stateName === "Tamil Nadu";

  useEffect(() => {
    if (!visible) return;
    setStateName(place.state || "Tamil Nadu");
    setDistrict(place.district);
    setRadius(place.radiusKm ?? 100);
    setPicking(null);
  }, [visible, place.state, place.district, place.radiusKm]);

  return (
    <>
    <Modal visible={visible && picking === null} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.page} edges={["top", "bottom"]}>
        <View style={styles.head}>
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
            <Ionicons name="close" size={22} color={colors.ink} />
          </Pressable>
          <Text style={styles.title}>Shop near</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.form}>
          <Text style={styles.label}>State</Text>
          <Pressable style={styles.pick} onPress={() => setPicking("state")}>
            <Text style={styles.pickText}>{stateName}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.faint} />
          </Pressable>

          <Text style={styles.label}>District</Text>
          {inTamilNadu ? (
            <Pressable style={styles.pick} onPress={() => setPicking("district")}>
              <Text style={[styles.pickText, !district && { color: colors.faint }]}>
                {district || "Choose a district"}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.faint} />
            </Pressable>
          ) : (
            <TextInput
              value={district}
              onChangeText={setDistrict}
              placeholder="City or district"
              placeholderTextColor={colors.faint}
              style={styles.typed}
            />
          )}

          {inTamilNadu ? (
            <>
              <Text style={styles.label}>Distance</Text>
              <View style={styles.radii}>
                {RADIUS_OPTIONS.map((r) => (
                  <Chip key={r.label} label={r.label} active={radius === r.km} onPress={() => setRadius(r.km)} />
                ))}
              </View>
              <Text style={styles.note}>Farms are matched by district distance inside Tamil Nadu.</Text>
            </>
          ) : (
            <Text style={styles.note}>
              Listings today are from Tamil Nadu farms. Other states will show here once farms there are listed.
            </Text>
          )}
        </View>
        <View style={{ flex: 1 }} />
        <View style={styles.footer}>
          <PrimaryButton
            label={district.trim() ? `Show crops near ${district.trim()}` : "Choose a district"}
            disabled={!district.trim()}
            onPress={() => {
              const nextDistrict = district.trim();
              if (!nextDistrict) return;
              onApply({
                state: stateName,
                district: nextDistrict,
                radiusKm: inTamilNadu ? radius : undefined,
              });
              onClose();
            }}
          />
        </View>
      </SafeAreaView>
    </Modal>
    <NamePicker
      visible={visible && picking === "state"}
      title="State"
      options={INDIAN_STATES}
      selected={stateName}
      placeholder="Search states"
      onSelect={(value) => {
        setStateName(value);
        if (value !== stateName) setDistrict("");
      }}
      onClose={() => setPicking(null)}
    />
    <NamePicker
      visible={visible && picking === "district"}
      title="District"
      options={TAMIL_NADU_DISTRICTS}
      selected={district}
      placeholder="Search all 38 districts"
      onSelect={setDistrict}
      onClose={() => setPicking(null)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.cream },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { fontSize: 16, fontWeight: "700", color: colors.ink },
  search: {
    marginHorizontal: 16,
    marginBottom: 8,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: { flex: 1, fontSize: 15, color: colors.ink },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowText: { fontSize: 16, color: colors.ink },
  rowOn: { fontWeight: "700", color: colors.forest },
  empty: { marginTop: 24, textAlign: "center", color: colors.muted, fontSize: 14 },
  radii: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  form: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  label: { marginTop: 10, fontSize: 12, fontWeight: "600", color: colors.muted },
  pick: {
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickText: { fontSize: 15, fontWeight: "600", color: colors.ink },
  typed: {
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.ink,
  },
  note: { marginTop: 8, fontSize: 13, lineHeight: 18, color: colors.muted },
});
