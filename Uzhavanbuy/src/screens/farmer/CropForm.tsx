import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { AppHeader, Screen } from "../../components/Chrome";
import { Field, PrimaryButton } from "../../components/ui";
import { useFarmerCrops, useSaveCrop, type CropInput } from "../../api/hooks";
import { IMAGES } from "../../lib/images";
import { ApiError } from "../../lib/api";
import type { FarmerStackParamList } from "../../navigation/types";
import { colors, shadow } from "../../theme";

/** Photo keys a farmer can pick from — these map to bundled app assets. */
const PICKS = ["pomegranate", "turmeric", "orange", "farm", "orchard", "grove"] as const;

export function CropForm() {
  const navigation = useNavigation();
  const { cropId } = useRoute<RouteProp<FarmerStackParamList, "CropForm">>().params ?? {};
  const crops = useFarmerCrops();
  const save = useSaveCrop();

  const existing = useMemo(
    () => (cropId ? crops.data?.find((c) => c.id === cropId) : undefined),
    [crops.data, cropId],
  );

  const [title, setTitle] = useState(existing?.title ?? "");
  const [category, setCategory] = useState(existing?.category ?? "");
  const [grade, setGrade] = useState(existing?.grade ?? "Grade A");
  const [status, setStatus] = useState<"upcoming" | "ready">(existing?.status ?? "upcoming");
  const [expectedKg, setExpectedKg] = useState(String(existing?.expectedKg ?? ""));
  const [minOrderKg, setMinOrderKg] = useState(String(existing?.minOrderKg ?? ""));
  const [pricePerKg, setPricePerKg] = useState(String(existing?.pricePerKg ?? ""));
  const [harvestDate, setHarvestDate] = useState(existing?.harvestDate ?? "");
  const [about, setAbout] = useState(existing?.about ?? "");
  const [imageKey, setImageKey] = useState(existing?.imageKey ?? "farm");
  const [listed, setListed] = useState(existing?.listed ?? true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  // Editing: wait for the listing to load before showing a blank form.
  if (cropId && crops.isLoading) {
    return (
      <Screen>
        <AppHeader title="Edit listing" />
        <ActivityIndicator color={colors.forest} style={{ marginTop: 48 }} />
      </Screen>
    );
  }

  const submit = async () => {
    const expected = Number(expectedKg);
    const minOrder = Number(minOrderKg);
    const price = Number(pricePerKg);

    if (!title.trim() || !category.trim() || !harvestDate.trim() || about.trim().length < 10) {
      setError("Fill in the crop name, category, harvest date, and a short description.");
      return;
    }
    if (!expected || !minOrder || !price) {
      setError("Quantity, minimum order and price all need a number.");
      return;
    }
    if (minOrder > expected) {
      setError("Minimum order can’t be more than the expected quantity.");
      return;
    }

    const input: CropInput = {
      title: title.trim(),
      category: category.trim(),
      grade: grade.trim() || "Grade A",
      status,
      expectedKg: expected,
      minOrderKg: minOrder,
      pricePerKg: price,
      harvestDate: harvestDate.trim(),
      about: about.trim(),
      hasVideo: false,
      imageKey,
      galleryKeys: [imageKey],
      listed,
    };

    setWorking(true);
    setError(null);
    try {
      await save.mutateAsync({ id: cropId, input });
      navigation.goBack();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t save. Check your connection.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen
        footer={
          <PrimaryButton
            label={cropId ? "Save changes" : "List this crop"}
            onPress={submit}
            loading={working}
            disabled={working}
          />
        }
      >
        <AppHeader title={cropId ? "Edit listing" : "New listing"} />
        <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          <Text style={styles.section}>Photo</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {PICKS.map((k) => (
              <Pressable key={k} onPress={() => setImageKey(k)}>
                <Image
                  source={IMAGES[k]}
                  style={[styles.pick, imageKey === k && { borderColor: colors.forest, borderWidth: 3 }]}
                />
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.section}>The crop</Text>
          <View style={styles.form}>
            <Field label="Crop name" value={title} onChangeText={setTitle} placeholder="Bhagwa Pomegranates" />
            <Field label="Category" value={category} onChangeText={setCategory} placeholder="Fruits · Pomegranate" />
            <Field label="Grade" value={grade} onChangeText={setGrade} placeholder="Grade A" />

            <View>
              <Text style={styles.label}>Availability</Text>
              <View style={styles.segment}>
                {(
                  [
                    { v: "ready" as const, l: "Ready now" },
                    { v: "upcoming" as const, l: "Upcoming harvest" },
                  ]
                ).map((o) => (
                  <Pressable
                    key={o.v}
                    onPress={() => setStatus(o.v)}
                    style={[styles.segmentItem, status === o.v && styles.segmentOn]}
                  >
                    <Text style={[styles.segmentText, status === o.v && { color: colors.white }]}>{o.l}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Field label="Harvest / pickup date" value={harvestDate} onChangeText={setHarvestDate} placeholder="18 Sep 2026" />
          </View>

          <Text style={styles.section}>Quantity & price</Text>
          <View style={styles.form}>
            <Field label="Expected quantity (kg)" value={expectedKg} onChangeText={setExpectedKg} placeholder="8500" keyboardType="number-pad" />
            <Field label="Minimum order (kg)" value={minOrderKg} onChangeText={setMinOrderKg} placeholder="500" keyboardType="number-pad" />
            <Field label="Your price (₹ per kg)" value={pricePerKg} onChangeText={setPricePerKg} placeholder="95" keyboardType="number-pad" />
            <Text style={styles.hint}>
              Buyers see this as an estimate. You set the final price when you accept a request.
            </Text>
          </View>

          <Text style={styles.section}>Description</Text>
          <View style={styles.form}>
            <Field
              label="About this crop"
              value={about}
              onChangeText={setAbout}
              placeholder="How it was grown, quality, what it suits…"
            />
          </View>

          <Pressable style={styles.toggleRow} onPress={() => setListed((v) => !v)}>
            <View style={[styles.box, listed && styles.boxOn]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Show this listing to buyers</Text>
              <Text style={styles.hint}>Turn off to hide it without losing the listing.</Text>
            </View>
          </Pressable>

          {existing && existing.reservedKg > 0 ? (
            <Text style={styles.hint}>
              {existing.reservedKg.toLocaleString("en-IN")} kg is already reserved by buyers — expected
              quantity can’t go below that.
            </Text>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
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
  segment: { flexDirection: "row", gap: 8 },
  segmentItem: { flex: 1, height: 46, borderRadius: 12, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", ...shadow },
  segmentOn: { backgroundColor: colors.forest },
  segmentText: { fontSize: 13, fontWeight: "600", color: colors.ink },
  hint: { fontSize: 12, lineHeight: 17, color: colors.muted },
  toggleRow: { marginTop: 22, flexDirection: "row", gap: 12, alignItems: "flex-start" },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: "#cfc8bc", marginTop: 1 },
  boxOn: { backgroundColor: colors.forest, borderColor: colors.forest },
  toggleTitle: { fontSize: 14, fontWeight: "600", color: colors.ink },
  error: { marginTop: 16, fontSize: 13, color: colors.danger },
});
