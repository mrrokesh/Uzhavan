import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { AppHeader, Screen } from "../../components/Chrome";
import { Field, PrimaryButton } from "../../components/ui";
import { DateField } from "../../components/DateField";
import { FarmLocationFields, joinFarmLocation, splitFarmLocation, type FarmAddress } from "../../components/FarmLocationFields";
import { useFarmerCrops, useFarmerSummary, useSaveCrop, useUpdateFarm, type CropInput } from "../../api/hooks";
import { IMAGES } from "../../lib/images";
import { API_BASE_URL, ApiError, api } from "../../lib/api";
import type { FarmerStackParamList } from "../../navigation/types";
import { useI18n } from "../../i18n";
import { colors, shadow } from "../../theme";
import { FormScroll } from "../../components/keyboard";

/** Photo keys a farmer can pick from — these map to bundled app assets. */
const PICKS = ["pomegranate", "turmeric", "orange", "farm", "orchard", "grove"] as const;

const METHODS = ["Natural farming", "Organic", "Conventional", "Integrated (IPM)"];
const GRADES = ["Grade A", "Grade B", "Grade C"];

function Choice({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={choiceStyles.wrap}>
      {options.map((o) => (
        <Pressable key={o} onPress={() => onChange(o)} style={[choiceStyles.chip, value === o && choiceStyles.on]}>
          <Text style={[choiceStyles.text, value === o && { color: colors.forest }]}>{o}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const choiceStyles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, height: 40, borderRadius: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, justifyContent: "center" },
  on: { backgroundColor: colors.mint, borderColor: colors.forest },
  text: { fontSize: 13, fontWeight: "600", color: colors.muted },
});

type OwnPhoto ={ uri: string; data?: string; mimeType?: string };

function savedPhoto(crop: { id: string; photoUpdatedAt?: string | null }): OwnPhoto {
  return {
    uri: `${API_BASE_URL}/api/crops/${crop.id}/photo?v=${encodeURIComponent(crop.photoUpdatedAt ?? "")}`,
  };
}

export function CropForm() {
  const { t } = useI18n();
  const navigation = useNavigation();
  const { cropId, prefill } = useRoute<RouteProp<FarmerStackParamList, "CropForm">>().params ?? {};
  const [savedId, setSavedId] = useState<string | undefined>(cropId);
  const crops = useFarmerCrops();
  const save = useSaveCrop();

  const existing = useMemo(
    () => (cropId ? crops.data?.find((c) => c.id === cropId) : undefined),
    [crops.data, cropId],
  );

  const [title, setTitle] = useState(existing?.title ?? prefill?.title ?? "");
  const [category, setCategory] = useState(existing?.category ?? prefill?.category ?? "");
  const [grade, setGrade] = useState(existing?.grade ?? "Grade A");
  const [status, setStatus] = useState<"upcoming" | "ready">(existing?.status ?? "upcoming");
  const [expectedKg, setExpectedKg] = useState(String(existing?.expectedKg ?? ""));
  const [minOrderKg, setMinOrderKg] = useState(String(existing?.minOrderKg ?? ""));
  const [pricePerKg, setPricePerKg] = useState(String(existing?.pricePerKg ?? prefill?.pricePerKg ?? ""));
  const [harvestDate, setHarvestDate] = useState(existing?.harvestDate ?? "");
  const [about, setAbout] = useState(existing?.about ?? "");
  const [imageKey, setImageKey] = useState(existing?.imageKey ?? "farm");
  const [ownPhoto, setOwnPhoto] = useState<OwnPhoto | null>(
    existing?.hasCustomPhoto ? savedPhoto(existing) : null,
  );
  const [usingOwn, setUsingOwn] = useState(Boolean(existing?.hasCustomPhoto));
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [working, setWorking] = useState(false);
  const [step, setStep] = useState(0);
  const [group, setGroup] = useState("Fruits");
  const [variety, setVariety] = useState("");
  const [method, setMethod] = useState("Natural farming");
  const [area, setArea] = useState("");
  const [accurate, setAccurate] = useState(false);
  const summary = useFarmerSummary();
  const updateFarm = useUpdateFarm();
  const [address, setAddress] = useState<FarmAddress>(() =>
    splitFarmLocation(summary.data?.farm.location ?? "", summary.data?.farm.district ?? ""),
  );
  const [addressReady, setAddressReady] = useState(Boolean(summary.data?.farm));

  useEffect(() => {
    const farm = summary.data?.farm;
    if (!farm || addressReady) return;
    setAddress(splitFarmLocation(farm.location, farm.district));
    setAddressReady(true);
  }, [summary.data?.farm, addressReady]);

  // Editing: wait for the listing to load before showing a blank form.
  if (cropId && crops.isLoading) {
    return (
      <Screen>
        <AppHeader title="Edit listing" />
        <ActivityIndicator color={colors.forest} style={{ marginTop: 48 }} />
      </Screen>
    );
  }

  const wholeKg = (value: string) => /^\d+$/.test(value.trim()) && Number(value) > 0;

  const clearFields = (...keys: string[]) => {
    setFieldErrors((current) => {
      const next = { ...current };
      for (const key of keys) delete next[key];
      return next;
    });
  };

  const cropProblems = () => {
    const next: Record<string, string> = {};
    if (title.trim().length < 2) next.title = "Enter the crop name.";
    if (!group) next.group = "Choose a category.";
    if (area.trim() && !(Number(area) > 0)) next.area = "Enter the farm area in acres.";
    if (!address.state.trim()) next.state = "Choose a state.";
    if (!address.district.trim()) next.district = "Choose a district.";
    if (!address.village.trim()) next.village = "Enter the village or town.";
    if (address.pincode && address.pincode.length !== 6) next.pincode = "Pincode must be 6 digits.";
    return next;
  };

  const harvestProblems = () => {
    const next: Record<string, string> = {};
    if (!harvestDate.trim()) next.harvestDate = "Select the harvest date.";
    if (!wholeKg(expectedKg)) next.expectedKg = "Enter the quantity in whole kilograms.";
    if (!wholeKg(minOrderKg)) next.minOrderKg = "Enter the minimum order in whole kilograms.";
    else if (wholeKg(expectedKg) && Number(minOrderKg) > Number(expectedKg)) {
      next.minOrderKg = "Minimum order can’t be more than the expected quantity.";
    }
    if (!wholeKg(pricePerKg)) next.pricePerKg = "Enter the price per kg in rupees.";
    return next;
  };

  const detailProblems = () => {
    const next: Record<string, string> = {};
    if (about.trim().length < 10) next.about = "Describe the crop in a sentence or two.";
    return next;
  };

  const submit = async (publish: boolean) => {
    const problems = { ...cropProblems(), ...harvestProblems(), ...detailProblems() };
    if (publish && !accurate) problems.accurate = "Confirm the crop details before publishing.";
    setFieldErrors(problems);
    if (Object.keys(problems).length > 0) {
      if (problems.title || problems.group || problems.area || problems.state || problems.district || problems.village || problems.pincode) {
        setStep(0);
      } else if (problems.harvestDate || problems.expectedKg || problems.minOrderKg || problems.pricePerKg) {
        setStep(1);
      } else {
        setStep(2);
      }
      return;
    }

    const expected = Number(expectedKg);
    const minOrder = Number(minOrderKg);
    const price = Number(pricePerKg);

    const publishedTitle =
      variety.trim() && !title.toLowerCase().includes(variety.trim().toLowerCase())
        ? `${variety.trim()} ${title.trim()}`
        : title.trim();
    const publishedCategory = category.trim() || `${group} · ${title.trim()}`;
    const publishedAbout = [
      about.trim(),
      method ? `Farming method: ${method}.` : "",
      area.trim() ? `Farm area: ${area.trim()} acres.` : "",
    ]
      .filter(Boolean)
      .join(" ");
    const input: CropInput = {
      title: publishedTitle,
      category: publishedCategory,
      grade: grade.trim() || "Grade A",
      status,
      expectedKg: expected,
      minOrderKg: minOrder,
      pricePerKg: price,
      harvestDate: harvestDate.trim(),
      about: publishedAbout,
      hasVideo: false,
      imageKey,
      galleryKeys: [imageKey],
      listed: publish,
    };

    const place = joinFarmLocation(address);

    setWorking(true);
    setError(null);
    try {
      if (place.district && place.location) {
        await updateFarm.mutateAsync({ district: place.district, location: place.location });
      }
      const saved = await save.mutateAsync({ id: savedId, input });
      setSavedId(saved.id);
      if (usingOwn && ownPhoto?.data) {
        await api(`/farmer/crops/${saved.id}/photo`, {
          method: "PUT",
          body: { data: ownPhoto.data, mimeType: ownPhoto.mimeType ?? "image/jpeg" },
        });
      } else if (!usingOwn && existing?.hasCustomPhoto) {
        await api(`/farmer/crops/${saved.id}/photo`, { method: "DELETE" });
      }
      navigation.goBack();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t save. Check your connection.");
    } finally {
      setWorking(false);
    }
  };

  const pickPhoto = async (camera: boolean) => {
    const perm = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        camera ? "Camera access needed" : "Photo access needed",
        "Allow access so you can add a picture of your crop.",
      );
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.5, base64: true };
    const result = camera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.assets?.[0];
    const data = asset?.base64;
    const uri = asset?.uri;
    if (result.canceled || !data || !uri) return;
    const bytes = Math.ceil((data.length * 3) / 4);
    if (bytes > 2_000_000) {
      Alert.alert("Photo too large", "Please pick a smaller picture — under 2 MB.");
      return;
    }
    setOwnPhoto({ uri, data, mimeType: asset.mimeType ?? "image/jpeg" });
    setUsingOwn(true);
    setError(null);
  };

  const addPhoto = () => {
    Alert.alert("Farm photo", "Add a picture of this crop", [
      { text: "Take photo", onPress: () => void pickPhoto(true) },
      { text: "Choose from gallery", onPress: () => void pickPhoto(false) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const groups = [
    { name: "Fruits", icon: "nutrition-outline" as const },
    { name: "Vegetables", icon: "basket-outline" as const },
    { name: "Spices", icon: "flame-outline" as const },
    { name: "Grains", icon: "grid-outline" as const },
  ];
  const stepTitle = [t("crop.add"), t("crop.harvest"), t("crop.publish")][step];
  const goNext = () => {
    const problems = step === 0 ? cropProblems() : harvestProblems();
    setFieldErrors(problems);
    if (Object.keys(problems).length > 0) return;
    setError(null);
    setCategory(`${group} · ${title.trim()}`);
    setStep((n) => Math.min(2, n + 1));
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }}>
      <Screen
        footer={
          step < 2 ? (
            <PrimaryButton label={t("crop.continue")} onPress={goNext} />
          ) : (
            <View style={{ gap: 8 }}>
              <PrimaryButton
                label={cropId ? t("crop.save") : t("crop.publishButton")}
                onPress={() => void submit(true)}
                loading={working}
                disabled={working}
              />
              <Pressable
                onPress={() => {
                  void submit(false);
                }}
                disabled={working}
              >
                <Text style={styles.draft}>{t("crop.draft")}</Text>
              </Pressable>
            </View>
          )
        }
      >
        <AppHeader title={stepTitle} />
        <FormScroll contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          <Text style={styles.stepMeta}>Step {step + 1} of 3</Text>
          <View style={styles.progress}>
            {[0, 1, 2].map((n) => (
              <View key={n} style={[styles.progressBit, n <= step && styles.progressOn]} />
            ))}
          </View>

          {step === 0 ? (
            <View style={styles.form}>
              <Text style={styles.h1}>{t("crop.what")}</Text>
              <Text style={styles.requiredNote}>{t("crop.required")}</Text>
              <Field
                label={t("crop.name")}
                value={title}
                onChangeText={(value) => {
                  setTitle(value);
                  if (value.trim().length >= 2) clearFields("title");
                }}
                placeholder="Pomegranate"
                required
                error={fieldErrors.title}
              />
              <View>
                <Text style={styles.label}>{t("crop.category")} <Text style={styles.star}>*</Text></Text>
                <View style={styles.chips}>
                  {groups.map((g) => (
                    <Pressable
                      key={g.name}
                      onPress={() => {
                        setGroup(g.name);
                        clearFields("group");
                      }}
                      style={[styles.chip, group === g.name && styles.chipOn, fieldErrors.group ? styles.chipError : null]}
                    >
                      <Ionicons name={g.icon} size={16} color={group === g.name ? colors.forest : colors.muted} />
                      <Text style={[styles.chipText, group === g.name && { color: colors.forest }]}>{g.name}</Text>
                    </Pressable>
                  ))}
                </View>
                {fieldErrors.group ? <Text style={styles.fieldError}>{fieldErrors.group}</Text> : null}
              </View>
              <Field label={t("crop.variety")} value={variety} onChangeText={setVariety} placeholder="Bhagwa" />
              <Text style={styles.label}>{t("crop.method")}</Text>
              <Choice options={METHODS} value={method} onChange={setMethod} />
              <Field
                label={t("crop.area")}
                value={area}
                onChangeText={(value) => {
                  const next = value.replace(/[^0-9.]/g, "");
                  setArea(next);
                  if (!next || Number(next) > 0) clearFields("area");
                }}
                placeholder="3"
                keyboardType="decimal-pad"
                error={fieldErrors.area}
              />
              <FarmLocationFields
                value={address}
                errors={{
                  state: fieldErrors.state,
                  district: fieldErrors.district,
                  village: fieldErrors.village,
                  pincode: fieldErrors.pincode,
                }}
                onChange={(next) => {
                  setAddress(next);
                  clearFields(
                    ...(next.state.trim() ? ["state"] : []),
                    ...(next.district.trim() ? ["district"] : []),
                    ...(next.village.trim() ? ["village"] : []),
                    ...(!next.pincode || next.pincode.length === 6 ? ["pincode"] : []),
                  );
                }}
              />
            </View>
          ) : null}

          {step === 1 ? (
            <View style={styles.form}>
              <Text style={styles.requiredNote}>{t("crop.required")}</Text>
              <DateField
                label={t("crop.date")}
                value={harvestDate}
                onChange={(value) => {
                  setHarvestDate(value);
                  clearFields("harvestDate");
                }}
                required
                error={fieldErrors.harvestDate}
              />
              <Text style={styles.label}>{t("crop.grade")}</Text>
              <Choice options={GRADES} value={grade} onChange={setGrade} />
              <Field
                label={t("crop.qty")}
                value={expectedKg}
                onChangeText={(value) => {
                  setExpectedKg(value.replace(/\D/g, ""));
                  clearFields("expectedKg", "minOrderKg");
                }}
                placeholder="8500"
                keyboardType="number-pad"
                required
                error={fieldErrors.expectedKg}
              />
              <Field
                label={t("crop.min")}
                value={minOrderKg}
                onChangeText={(value) => {
                  setMinOrderKg(value.replace(/\D/g, ""));
                  clearFields("minOrderKg");
                }}
                placeholder="500"
                keyboardType="number-pad"
                required
                error={fieldErrors.minOrderKg}
              />
              <View style={styles.priceCard}>
                <Field
                  label={t("crop.price")}
                  value={pricePerKg}
                  onChangeText={(value) => {
                    setPricePerKg(value.replace(/\D/g, ""));
                    clearFields("pricePerKg");
                  }}
                  placeholder="95"
                  keyboardType="number-pad"
                  required
                  error={fieldErrors.pricePerKg}
                />
                <Text style={styles.hint}>{t("crop.priceHint")}</Text>
              </View>
              <Text style={styles.label}>{t("crop.availability")}</Text>
              {(
                [
                  { v: "upcoming" as const, l: t("crop.pre"), s: t("crop.preSub") },
                  { v: "ready" as const, l: t("crop.ready"), s: t("crop.readySub") },
                ]
              ).map((o) => (
                <Pressable key={o.v} onPress={() => setStatus(o.v)} style={styles.radioRow}>
                  <View style={[styles.radio, status === o.v && styles.radioOn]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.toggleTitle}>{o.l}</Text>
                    <Text style={styles.hint}>{o.s}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}

          {step === 2 ? (
            <View>
              <Text style={styles.section}>{t("crop.media")}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                <Pressable onPress={addPhoto} style={styles.addPhoto} accessibilityLabel="Add farm photo">
                  <Ionicons name="add" size={22} color={colors.forest} />
                  <Text style={styles.addPhotoLabel}>{t("crop.addMedia")}</Text>
                </Pressable>
                {ownPhoto ? (
                  <Pressable onPress={() => setUsingOwn(true)}>
                    <Image source={{ uri: ownPhoto.uri }} style={[styles.pick, usingOwn && styles.pickOn]} />
                  </Pressable>
                ) : null}
                {PICKS.map((k) => (
                  <Pressable key={k} onPress={() => { setImageKey(k); setUsingOwn(false); }}>
                    <Image source={IMAGES[k]} style={[styles.pick, !usingOwn && imageKey === k && styles.pickOn]} />
                  </Pressable>
                ))}
              </ScrollView>
              <View style={[styles.form, { marginTop: 16 }]}>
                <Field
                  label={t("crop.description")}
                  value={about}
                  onChangeText={(value) => {
                    setAbout(value);
                    if (value.trim().length >= 10) clearFields("about");
                  }}
                  placeholder="How it was grown, quality, expected harvest…"
                  multiline
                  required
                  error={fieldErrors.about}
                />
              </View>
              <Pressable
                style={styles.toggleRow}
                onPress={() => {
                  setAccurate((value) => !value);
                  clearFields("accurate");
                }}
              >
                <View style={[styles.box, accurate && styles.boxOn, fieldErrors.accurate ? styles.boxError : null]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>{t("crop.confirm")} <Text style={styles.star}>*</Text></Text>
                  {fieldErrors.accurate ? <Text style={styles.fieldError}>{fieldErrors.accurate}</Text> : null}
                </View>
              </Pressable>
            </View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </FormScroll>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 32 },
  section: { marginTop: 22, marginBottom: 10, fontSize: 13, fontWeight: "600", color: colors.forest },
  form: { gap: 14 },
  label: { fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 6 },
  pick: { width: 84, height: 84, borderRadius: 14, borderWidth: 3, borderColor: "transparent" },
  pickOn: { borderColor: colors.forest },
  addPhoto: {
    width: 84,
    height: 84,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.forest,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  addPhotoLabel: { fontSize: 12, fontWeight: "600", color: colors.forest },
  segment: { flexDirection: "row", gap: 8 },
  segmentItem: { flex: 1, height: 46, borderRadius: 12, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", ...shadow },
  segmentOn: { backgroundColor: colors.forest },
  segmentText: { fontSize: 13, fontWeight: "600", color: colors.ink },
  hint: { fontSize: 12, lineHeight: 17, color: colors.muted },
  toggleRow: { marginTop: 22, flexDirection: "row", gap: 12, alignItems: "flex-start" },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: "#D5D8D6", marginTop: 1 },
  boxOn: { backgroundColor: colors.forest, borderColor: colors.forest },
  toggleTitle: { fontSize: 14, fontWeight: "600", color: colors.ink },
  error: { marginTop: 16, fontSize: 13, color: colors.danger },
  fieldError: { marginTop: 6, fontSize: 12, lineHeight: 16, color: colors.danger },
  requiredNote: { fontSize: 12, color: colors.muted, marginTop: -2 },
  star: { color: colors.danger },
  chipError: { borderColor: colors.danger },
  boxError: { borderColor: colors.danger },
  stepMeta: { marginTop: 8, fontSize: 12, fontWeight: "600", color: colors.muted },
  progress: { flexDirection: "row", gap: 6, marginTop: 8, marginBottom: 16 },
  progressBit: { flex: 1, height: 4, borderRadius: 4, backgroundColor: colors.line },
  progressOn: { backgroundColor: colors.forest },
  h1: { fontSize: 22, fontWeight: "700", color: colors.ink, marginBottom: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 40, borderRadius: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  chipOn: { backgroundColor: colors.mint, borderColor: colors.forest },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.muted },
  location: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.white, borderRadius: 14, padding: 14, ...shadow },
  priceCard: { backgroundColor: "#E7F3EA", borderRadius: 16, padding: 12 },
  radioRow: { flexDirection: "row", gap: 12, alignItems: "flex-start", backgroundColor: colors.white, borderRadius: 14, padding: 14, ...shadow },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#D5D8D6", marginTop: 2 },
  radioOn: { borderColor: colors.forest, backgroundColor: colors.forest },
  draft: { textAlign: "center", color: colors.forest, fontWeight: "700", fontSize: 15, paddingVertical: 8 },
});
