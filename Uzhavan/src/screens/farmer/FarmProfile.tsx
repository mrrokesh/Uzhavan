import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { AppHeader, Screen } from "../../components/Chrome";
import { FormScroll } from "../../components/keyboard";
import { FarmLocationFields, joinFarmLocation, splitFarmLocation, type FarmAddress } from "../../components/FarmLocationFields";
import { Field, PrimaryButton } from "../../components/ui";
import { useFarmerCrops, useFarmerSummary, useUpdateFarm } from "../../api/hooks";
import { useAuth } from "../../context/AuthContext";
import { FarmerAvatar } from "../../components/FarmerAvatar";
import { imageFor } from "../../lib/images";
import { ApiError } from "../../lib/api";
import { colors, shadow } from "../../theme";

export function FarmProfile() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const summary = useFarmerSummary();
  const crops = useFarmerCrops();
  const save = useUpdateFarm();
  const farm = summary.data?.farm;
  const [name, setName] = useState(farm?.name ?? "");
  const [address, setAddress] = useState<FarmAddress>(() => splitFarmLocation(farm?.location ?? "", farm?.district ?? ""));
  const [hydrated, setHydrated] = useState(Boolean(farm));
  const [method, setMethod] = useState("Natural farming");
  const [area, setArea] = useState("");
  const [visible, setVisible] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cropsLabel = (crops.data ?? []).map((c) => c.title).slice(0, 2).join(", ");
  const place = joinFarmLocation(address);

  useEffect(() => {
    if (!farm || hydrated) return;
    setName(farm.name);
    setAddress(splitFarmLocation(farm.location, farm.district));
    setHydrated(true);
  }, [farm, hydrated]);

  const onSave = async () => {
    setError(null);
    if (!address.district.trim() || !address.village.trim()) {
      setError("Choose a district and enter the village or town.");
      return;
    }
    if (address.pincode && address.pincode.length !== 6) {
      setError("Pincode needs 6 digits.");
      return;
    }
    try {
      await save.mutateAsync({
        name: name.trim(),
        district: place.district,
        location: place.location,
      });
      navigation.goBack();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t save the farm profile.");
    }
  };

  return (
    <Screen
      footer={<PrimaryButton label="Save changes" onPress={onSave} loading={save.isPending} disabled={save.isPending} />}
    >
      <AppHeader title="Edit farm profile" />
      <FormScroll contentContainerStyle={styles.pad}>
        <View style={styles.coverWrap}>
          <Image source={imageFor("farm")} style={styles.cover} />
          <View style={styles.avatarWrap}>
            <FarmerAvatar farm={farm} size={64} editable />
          </View>
        </View>

        <View style={styles.form}>
          <Field label="Farmer name" value={user?.name ?? ""} editable={false} />
          <Field label="Farm name" value={name} onChangeText={setName} placeholder="Arul Farms" />
          <Field label="Mobile number" value={user?.phone ?? ""} editable={false} />
          <Field label="Farm area" value={area} onChangeText={setArea} placeholder="3 acres" />
          <Field label="Primary crops" value={cropsLabel} editable={false} />
          <Field label="Farming method" value={method} onChangeText={setMethod} placeholder="Natural farming" />
        </View>

        <View style={styles.location}>
          <Ionicons name="location" size={16} color={colors.forest} />
          <View style={{ flex: 1 }}>
            <Text style={styles.locTitle}>{place.location || "Farm location"}</Text>
            <Text style={styles.locSub}>
              {[address.district, address.state].filter(Boolean).join(", ") || "State and district"}
            </Text>
          </View>
        </View>
        <FarmLocationFields value={address} onChange={setAddress} />

        <View style={styles.toggle}>
          <Text style={styles.toggleText}>Show my verified profile to buyers</Text>
          <Switch value={visible} onValueChange={setVisible} trackColor={{ true: colors.forest }} />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable onPress={() => navigation.goBack()} />
      </FormScroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 24 },
  coverWrap: { height: 150, marginTop: 8 },
  cover: { width: "100%", height: 120, borderRadius: 16 },
  avatarWrap: { position: "absolute", left: 16, bottom: 0 },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: colors.white },
  cam: { position: "absolute", right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.forest, alignItems: "center", justifyContent: "center" },
  form: { gap: 12, marginTop: 16 },
  location: { marginTop: 14, flexDirection: "row", gap: 8, backgroundColor: colors.mint, borderRadius: 14, padding: 14, ...shadow },
  locTitle: { fontSize: 14, fontWeight: "700", color: colors.ink },
  locSub: { marginTop: 2, fontSize: 12, color: colors.forest },
  toggle: { marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  toggleText: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.ink, marginRight: 12 },
  error: { marginTop: 10, color: colors.danger, fontSize: 13 },
});
