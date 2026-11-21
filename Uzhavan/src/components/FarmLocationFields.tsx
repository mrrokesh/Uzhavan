import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Field } from "./ui";
import { colors, shadow } from "../theme";

const STATES = [
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

const TAMIL_NADU_DISTRICTS = [
  "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore", "Dharmapuri", "Dindigul",
  "Erode", "Kallakurichi", "Kancheepuram", "Kanyakumari", "Karur", "Krishnagiri", "Madurai",
  "Mayiladuthurai", "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai",
  "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi", "Thanjavur", "Theni",
  "Thoothukudi", "Tiruchirappalli", "Tirunelveli", "Tirupathur", "Tiruppur", "Tiruvallur",
  "Tiruvannamalai", "Tiruvarur", "Vellore", "Viluppuram", "Virudhunagar",
];

export type FarmAddress = {
  state: string;
  district: string;
  taluk: string;
  village: string;
  pincode: string;
};

export function emptyFarmAddress(): FarmAddress {
  return { state: "Tamil Nadu", district: "", taluk: "", village: "", pincode: "" };
}

/** Split the saved "Attur, Salem" line back into the fields the form edits. */
export function splitFarmLocation(location: string, district: string): FarmAddress {
  const bits = location.split(",").map((part) => part.trim()).filter(Boolean);
  const pincode = bits.find((part) => /^\d{6}$/.test(part)) ?? "";
  const rest = bits.filter((part) => part !== pincode && part.toLowerCase() !== district.trim().toLowerCase());
  return {
    state: "Tamil Nadu",
    district,
    village: rest[0] ?? "",
    taluk: rest[1] ?? "",
    pincode,
  };
}

/** What the server stores: district on its own, and the village line as location. */
export function joinFarmLocation(address: FarmAddress): { district: string; location: string } {
  const district = address.district.trim();
  const location = [address.village, address.taluk, address.pincode]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
  return { district, location: location || district };
}

export function FarmLocationFields({
  value,
  onChange,
  errors,
}: {
  value: FarmAddress;
  onChange: (next: FarmAddress) => void;
  errors?: Partial<Record<keyof FarmAddress, string>>;
}) {
  const [picking, setPicking] = useState<"state" | "district" | null>(null);
  const [query, setQuery] = useState("");
  const tamilNadu = value.state === "Tamil Nadu";
  const districtOptions = TAMIL_NADU_DISTRICTS;

  const choices = useMemo(() => {
    const source = picking === "state" ? STATES : districtOptions;
    const q = query.trim().toLowerCase();
    return q ? source.filter((name) => name.toLowerCase().includes(q)) : source;
  }, [picking, query, districtOptions]);

  const open = (which: "state" | "district") => {
    setQuery("");
    setPicking(which);
  };

  const choose = (name: string) => {
    if (picking === "state") {
      onChange({
        ...value,
        state: name,
        district: name === "Tamil Nadu" ? value.district : "",
      });
    } else {
      onChange({ ...value, district: name });
    }
    setPicking(null);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Farm location</Text>
      <SelectRow label="State" value={value.state} placeholder="Choose a state" required onPress={() => open("state")} error={errors?.state} />
      {tamilNadu ? (
        <SelectRow label="District" value={value.district} placeholder="Choose a district" required onPress={() => open("district")} error={errors?.district} />
      ) : (
        <Field label="District" value={value.district} onChangeText={(district) => onChange({ ...value, district })} placeholder="District" required error={errors?.district} />
      )}
      <Field label="Taluk" value={value.taluk} onChangeText={(taluk) => onChange({ ...value, taluk })} placeholder="Natham" />
      <Field label="Village or town" value={value.village} onChangeText={(village) => onChange({ ...value, village })} placeholder="Attur" required error={errors?.village} />
      <Field
        label="Pincode"
        value={value.pincode}
        onChangeText={(pincode) => onChange({ ...value, pincode: pincode.replace(/\D/g, "").slice(0, 6) })}
        placeholder="636102"
        keyboardType="number-pad"
        error={errors?.pincode}
      />

      <Modal visible={picking !== null} animationType="slide" onRequestClose={() => setPicking(null)}>
        <SafeAreaView style={styles.full} edges={["top", "bottom"]}>
          <View style={styles.sheetHead}>
            <Pressable onPress={() => setPicking(null)} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.ink} />
            </Pressable>
            <Text style={styles.sheetTitle}>
              {picking === "state" ? `States · ${choices.length}` : `Districts · ${choices.length}`}
            </Text>
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={picking === "state" ? "Search states" : "Search all districts"}
            placeholderTextColor={colors.faint}
            style={styles.search}
            autoCorrect={false}
          />
          <FlatList
            data={choices}
            keyExtractor={(name) => name}
            keyboardShouldPersistTaps="handled"
            style={{ flex: 1 }}
            renderItem={({ item: name }) => (
              <Pressable style={styles.option} onPress={() => choose(name)}>
                <Text style={styles.optionText}>{name}</Text>
                {(picking === "state" ? value.state : value.district) === name ? (
                  <Ionicons name="checkmark" size={18} color={colors.forest} />
                ) : null}
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.empty}>No matches.</Text>}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function SelectRow({
  label,
  value,
  placeholder,
  onPress,
  required,
  error,
}: {
  label: string;
  value: string;
  placeholder: string;
  onPress: () => void;
  required?: boolean;
  error?: string;
}) {
  return (
    <View>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <Pressable style={[styles.row, error ? styles.rowError : null]} onPress={onPress} accessibilityHint={error}>
        <Text style={[styles.value, !value && { color: colors.faint }]}>{value || placeholder}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  heading: { fontSize: 15, fontWeight: "700", color: colors.ink },
  label: { fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 6 },
  required: { color: colors.danger },
  error: { marginTop: 6, fontSize: 12, lineHeight: 16, color: colors.danger },
  row: {
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow,
  },
  rowError: { borderColor: colors.danger },
  value: { flex: 1, fontSize: 15, color: colors.ink },
  full: { flex: 1, backgroundColor: colors.cream, paddingHorizontal: 16 },
  sheetHead: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 8 },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: colors.ink },
  search: {
    marginTop: 12,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    fontSize: 15,
    color: colors.ink,
  },
  option: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line },
  optionText: { flex: 1, fontSize: 15, color: colors.ink },
  empty: { paddingVertical: 20, textAlign: "center", color: colors.muted },
});
