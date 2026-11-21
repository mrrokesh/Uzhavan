import { useState } from "react";
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
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { CommonActions, useNavigation } from "@react-navigation/native";
import { AppHeader, Screen } from "../../components/Chrome";
import { DateField } from "../../components/DateField";
import { Chip, Field, InfoNote, OutlineButton, PrimaryButton } from "../../components/ui";
import { useSubmitVerification, useVerification } from "../../api/hooks";
import { useAuth } from "../../context/AuthContext";
import { ApiError } from "../../lib/api";
import type { DocumentType, UploadDoc } from "../../api/types";
import { colors, shadow } from "../../theme";
import { FormScroll } from "../../components/keyboard";

/** Roughly the server's 5 MB cap, allowing for base64 inflation. */
const MAX_BYTES = 5 * 1024 * 1024;

type Picked = UploadDoc & { uri: string };

const LABELS: Partial<Record<DocumentType, string>> = {
  FARMER_CARD: "Farmer card",
  LAND_RECORD: "Land record (patta / chitta)",
  GST_CERTIFICATE: "GST certificate",
  MSME_CERTIFICATE: "Udyam / MSME certificate",
  PAN_CARD: "PAN card",
  DRIVING_LICENCE: "Driving licence",
  VEHICLE_RC: "Vehicle RC book",
  VEHICLE_INSURANCE: "Insurance certificate",
  VEHICLE_PERMIT: "Goods carriage permit",
};

export function Verification() {
  const navigation = useNavigation();
  const { user, justSignedUp, clearSignup } = useAuth();
  const state = useVerification();
  const submit = useSubmitVerification();

  const isFarmer = user?.role === "FARMER";
  const isDriver = user?.role === "DRIVER";
  const [idNumber, setIdNumber] = useState("");
  const [pan, setPan] = useState("");
  const [rcNumber, setRcNumber] = useState("");
  const [insuranceExpiry, setInsuranceExpiry] = useState("");
  const [permitExpiry, setPermitExpiry] = useState("");
  const [docs, setDocs] = useState<Picked[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [step, setStep] = useState(0);

  if (state.isLoading) {
    return (
      <Screen>
        <AppHeader title="Verification" />
        <ActivityIndicator color={colors.forest} style={{ marginTop: 48 }} />
      </Screen>
    );
  }

  const s = state.data;

  const pick = async (type: DocumentType, camera: boolean) => {
    const perm = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        camera ? "Camera access needed" : "Photo access needed",
        "Allow access so you can attach a photo of your document.",
      );
      return;
    }

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      quality: 0.7,
      base64: true,
      allowsEditing: false,
    };
    const result = camera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets[0]?.base64) return;

    const asset = result.assets[0];
    const bytes = Math.ceil((asset.base64!.length * 3) / 4);
    if (bytes > MAX_BYTES) {
      Alert.alert("Photo too large", "Please pick a smaller image — under 5 MB.");
      return;
    }

    setDocs((prev) => [
      ...prev.filter((d) => d.type !== type),
      {
        type,
        filename: asset.fileName ?? `${type.toLowerCase()}.jpg`,
        mimeType: asset.mimeType ?? "image/jpeg",
        data: asset.base64!,
        uri: asset.uri,
      },
    ]);
    setError(null);
  };

  const attach = (type: DocumentType) =>
    Alert.alert(LABELS[type] ?? "Document", "Add a photo of this document", [
      { text: "Take photo", onPress: () => void pick(type, true) },
      { text: "Choose from gallery", onPress: () => void pick(type, false) },
      { text: "Cancel", style: "cancel" },
    ]);

  const send = async () => {
    if (!idNumber.trim()) {
      setError(
        isFarmer
          ? "Enter your farmer card number"
          : isDriver
            ? "Enter your driving licence number"
            : "Enter your GSTIN or Udyam number",
      );
      return;
    }
    if (isFarmer && (!docs.some((d) => d.type === "FARMER_CARD") || !docs.some((d) => d.type === "LAND_RECORD"))) {
      setError("Add both the farmer card and the land record.");
      return;
    }
    if (
      isDriver &&
      ["DRIVING_LICENCE", "VEHICLE_RC", "VEHICLE_INSURANCE", "VEHICLE_PERMIT"].some(
        (type) => !docs.some((d) => d.type === type),
      )
    ) {
      setError("Add the driving licence, RC, insurance and permit.");
      return;
    }
    if (docs.length === 0) {
      setError("Attach at least one document");
      return;
    }

    const value = idNumber.trim().toUpperCase();
    const body: Parameters<typeof submit.mutateAsync>[0] = {
      documents: docs.map(({ type, filename, mimeType, data }) => ({
        type,
        filename,
        mimeType,
        data,
      })),
      ...(pan.trim() ? { pan: pan.trim() } : {}),
    };
    if (isFarmer) {
      body.farmerCard = value;
    } else if (isDriver) {
      body.licence = value;
      if (rcNumber.trim()) body.rcNumber = rcNumber.trim().toUpperCase();
      if (insuranceExpiry.trim()) body.insuranceExpiry = insuranceExpiry.trim();
      if (permitExpiry.trim()) body.permitExpiry = permitExpiry.trim();
    } else if (value.startsWith("UDYAM")) {
      body.udyam = value;
    } else {
      body.gstin = value;
    }

    setWorking(true);
    setError(null);
    try {
      await submit.mutateAsync(body);
      setDocs([]);
      setIdNumber("");
      setPan("");
      setRcNumber("");
      setInsuranceExpiry("");
      setPermitExpiry("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t submit. Check your connection.");
    } finally {
      setWorking(false);
    }
  };

  const finish = () => {
    clearSignup();
    if (justSignedUp) {
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: user?.role === "DRIVER" ? "DriverTabs" : "FarmerTabs" }],
        }),
      );
      return;
    }
    if (navigation.canGoBack()) navigation.goBack();
  };

  const nextFarmerStep = () => {
    if (step === 0 && !/^[A-Z0-9/-]{6,30}$/.test(idNumber.trim().toUpperCase())) {
      setFieldError("Enter the farmer card number, for example TN/DGL/2019/004521.");
      return;
    }
    if (step === 1 && !docs.some((d) => d.type === "FARMER_CARD")) {
      setFieldError("Add a photo of the farmer card.");
      return;
    }
    if (step === 2 && !docs.some((d) => d.type === "LAND_RECORD")) {
      setFieldError("Add a photo of the land record.");
      return;
    }
    setFieldError(null);
    setStep((n) => Math.min(3, n + 1));
  };

  // ── Already settled ──────────────────────────────────────────
  if (s?.status === "VERIFIED") {
    return (
      <Screen>
        <AppHeader title="Verification" />
        <ScrollView contentContainerStyle={[styles.pad, { alignItems: "center", paddingTop: 40 }]}>
          <View style={styles.tick}>
            <Ionicons name="shield-checkmark" size={34} color={colors.forest} />
          </View>
          <Text style={styles.h1}>You’re verified</Text>
          <Text style={styles.sub}>
            {isFarmer
              ? "Buyers can see that your farm is verified. It helps them trust your listings."
              : isDriver
                ? "Your licence and papers are on file. Verified drivers get offered jobs first."
                : "Farmers can see that your business is verified, which makes them more likely to accept."}
          </Text>
          {s.idLast4 ? (
            <Text style={styles.faint}>
              {isFarmer ? "Farmer card" : isDriver ? "Licence" : "Registered number"} ending{" "}
              {s.idLast4}
            </Text>
          ) : null}
        </ScrollView>
      </Screen>
    );
  }

  if (s?.status === "PENDING") {
    return (
      <Screen>
        <AppHeader title="Verification" />
        <ScrollView contentContainerStyle={[styles.pad, { alignItems: "center", paddingTop: 40 }]}>
          <View style={[styles.tick, { backgroundColor: colors.amberBg }]}>
            <Ionicons name="hourglass-outline" size={32} color={colors.amberText} />
          </View>
          <Text style={styles.h1}>Under review</Text>
          <Text style={styles.sub}>
            Our team is checking your documents. This usually takes a working day — we’ll update this
            screen as soon as it’s done.
          </Text>
          <View style={{ marginTop: 14 }}>
            <Chip label={`${s.documents.length} document${s.documents.length === 1 ? "" : "s"} submitted`} tone="amber" />
          </View>
          <View style={{ marginTop: 20, width: "100%" }}>
            <PrimaryButton label={justSignedUp ? (isDriver ? "Continue" : "Continue to my farm") : "Done"} onPress={finish} />
          </View>
        </ScrollView>
      </Screen>
    );
  }

  if (isFarmer) {
    const card = docs.find((d) => d.type === "FARMER_CARD");
    const land = docs.find((d) => d.type === "LAND_RECORD");
    const titles = ["Farmer card", "Card photo", "Land record", "Confirm"];
    return (
      <KeyboardAvoidingView style={{ flex: 1 }}>
        <Screen
          footer={
            step < 3 ? (
              <PrimaryButton label="Continue" onPress={nextFarmerStep} />
            ) : (
              <PrimaryButton label="Submit documents" onPress={() => void send()} loading={working} disabled={working} />
            )
          }
        >
          <AppHeader title={justSignedUp ? "Verify your farm" : "Get verified"} />
          <FormScroll contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
            <Text style={styles.stepMeta}>Step {step + 1} of 4 · {titles[step]}</Text>
            <View style={styles.progress}>
              {[0, 1, 2, 3].map((n) => (
                <View key={n} style={[styles.progressBit, n <= step && styles.progressOn]} />
              ))}
            </View>
            {s?.status === "REJECTED" ? (
              <InfoNote tone="amber">
                <Ionicons name="alert-circle-outline" size={16} color={colors.amberText} />
                <Text style={{ flex: 1, color: colors.amberText, fontSize: 12.5 }}>
                  {s.rejectionReason ?? "Your last submission was rejected. Send the documents again."}
                </Text>
              </InfoNote>
            ) : (
              <Text style={styles.lead}>
                Buyers only see a verified tick after these documents are checked. The number and photos stay encrypted.
              </Text>
            )}

            {step === 0 ? (
              <View style={{ marginTop: 18 }}>
                <Field
                  label="Farmer card number"
                  value={idNumber}
                  onChangeText={(value) => {
                    setIdNumber(value);
                    setFieldError(null);
                  }}
                  placeholder="TN/DGL/2019/004521"
                  autoCapitalize="characters"
                  required
                  error={fieldError ?? undefined}
                />
              </View>
            ) : null}

            {step === 1 ? (
              <DocSlot
                title="Farmer card"
                picked={card}
                error={fieldError}
                onPress={() => {
                  setFieldError(null);
                  attach("FARMER_CARD");
                }}
              />
            ) : null}

            {step === 2 ? (
              <DocSlot
                title="Land record (patta / chitta)"
                picked={land}
                error={fieldError}
                onPress={() => {
                  setFieldError(null);
                  attach("LAND_RECORD");
                }}
              />
            ) : null}

            {step === 3 ? (
              <View style={{ marginTop: 18, gap: 10 }}>
                <Text style={styles.docTitle}>Farmer card · {idNumber.trim().toUpperCase()}</Text>
                <Text style={styles.hint}>{card ? "Card photo added" : "Card photo missing"}</Text>
                <Text style={styles.hint}>{land ? "Land record added" : "Land record missing"}</Text>
                {error ? <Text style={styles.error}>{error}</Text> : null}
              </View>
            ) : null}

            {justSignedUp && step === 0 ? (
              <Pressable onPress={finish} style={{ marginTop: 22 }}>
                <Text style={styles.later}>I’ll do this later</Text>
              </Pressable>
            ) : null}
          </FormScroll>
        </Screen>
      </KeyboardAvoidingView>
    );
  }

  if (isDriver) {
    const licence = docs.find((d) => d.type === "DRIVING_LICENCE");
    const rc = docs.find((d) => d.type === "VEHICLE_RC");
    const insurance = docs.find((d) => d.type === "VEHICLE_INSURANCE");
    const permit = docs.find((d) => d.type === "VEHICLE_PERMIT");
    const titles = ["Licence number", "Licence photo", "RC book", "Insurance and permit", "Confirm"];
    const nextDriverStep = () => {
      const licenceOk = /^[A-Z]{2}[0-9]{9,14}$/.test(idNumber.trim().toUpperCase().replace(/[\s-]/g, ""));
      if (step === 0 && !licenceOk) {
        setFieldError("Enter the licence number, for example TN37 20190001234.");
        return;
      }
      if (step === 1 && !licence) {
        setFieldError("Add a photo of the driving licence.");
        return;
      }
      if (step === 2 && (!rcNumber.trim() || !rc)) {
        setFieldError("Enter the RC number and add a photo of the book.");
        return;
      }
      if (step === 3 && (!insurance || !permit || !insuranceExpiry || !permitExpiry)) {
        setFieldError("Add both photos and both expiry dates.");
        return;
      }
      setFieldError(null);
      setStep((n) => Math.min(4, n + 1));
    };
    return (
      <KeyboardAvoidingView style={{ flex: 1 }}>
        <Screen
          footer={
            step < 4 ? (
              <PrimaryButton label="Continue" onPress={nextDriverStep} />
            ) : (
              <PrimaryButton label="Submit documents" onPress={() => void send()} loading={working} disabled={working} />
            )
          }
        >
          <AppHeader title={justSignedUp ? "Driver papers" : "Get verified"} />
          <FormScroll contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
            <Text style={styles.stepMeta}>Step {step + 1} of 5 · {titles[step]}</Text>
            <View style={styles.progress}>
              {[0, 1, 2, 3, 4].map((n) => (
                <View key={n} style={[styles.progressBit, n <= step && styles.progressOn]} />
              ))}
            </View>
            <Text style={styles.lead}>
              You can set a fare now. Trips open up after these papers are approved. Photos stay encrypted.
            </Text>
            {step === 0 ? (
              <View style={{ marginTop: 18 }}>
                <Field
                  label="Driving licence number"
                  value={idNumber}
                  onChangeText={(value) => {
                    setIdNumber(value);
                    setFieldError(null);
                  }}
                  placeholder="TN37 20190001234"
                  autoCapitalize="characters"
                  required
                  error={fieldError ?? undefined}
                />
              </View>
            ) : null}
            {step === 1 ? (
              <DocSlot
                title="Driving licence"
                picked={licence}
                error={fieldError}
                onPress={() => {
                  setFieldError(null);
                  attach("DRIVING_LICENCE");
                }}
              />
            ) : null}
            {step === 2 ? (
              <View style={{ marginTop: 18, gap: 14 }}>
                <Field
                  label="RC number"
                  value={rcNumber}
                  onChangeText={(value) => {
                    setRcNumber(value);
                    setFieldError(null);
                  }}
                  autoCapitalize="characters"
                  required
                  error={fieldError ?? undefined}
                />
                <DocSlot
                  title="RC book"
                  picked={rc}
                  error={null}
                  onPress={() => {
                    setFieldError(null);
                    attach("VEHICLE_RC");
                  }}
                />
              </View>
            ) : null}
            {step === 3 ? (
              <View style={{ marginTop: 18, gap: 14 }}>
                <DateField label="Insurance expiry" value={insuranceExpiry} onChange={setInsuranceExpiry} storage="iso" />
                <DocSlot title="Insurance certificate" picked={insurance} error={null} onPress={() => attach("VEHICLE_INSURANCE")} />
                <DateField label="Permit expiry" value={permitExpiry} onChange={setPermitExpiry} storage="iso" />
                <DocSlot
                  title="Goods carriage permit"
                  picked={permit}
                  error={fieldError}
                  onPress={() => {
                    setFieldError(null);
                    attach("VEHICLE_PERMIT");
                  }}
                />
              </View>
            ) : null}
            {step === 4 ? (
              <View style={{ marginTop: 18, gap: 8 }}>
                <Text style={styles.docTitle}>Licence · {idNumber.trim().toUpperCase()}</Text>
                <Text style={styles.hint}>{licence ? "Licence photo added" : "Licence photo missing"}</Text>
                <Text style={styles.hint}>{rc ? `RC ${rcNumber.trim().toUpperCase()} added` : "RC missing"}</Text>
                <Text style={styles.hint}>{insurance ? `Insurance expires ${insuranceExpiry}` : "Insurance missing"}</Text>
                <Text style={styles.hint}>{permit ? `Permit expires ${permitExpiry}` : "Permit missing"}</Text>
                {error ? <Text style={styles.error}>{error}</Text> : null}
              </View>
            ) : null}
          </FormScroll>
        </Screen>
      </KeyboardAvoidingView>
    );
  }

  // ── Submit / resubmit ────────────────────────────────────────
  const required: DocumentType[] = s?.required.documents ?? [];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }}>
      <Screen
        footer={
          <PrimaryButton
            label={s?.status === "REJECTED" ? "Submit again" : "Submit for verification"}
            onPress={send}
            loading={working}
            disabled={working}
          />
        }
      >
        <AppHeader title="Get verified" />
        <FormScroll contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          {s?.status === "REJECTED" ? (
            <View style={{ marginBottom: 16 }}>
              <InfoNote tone="amber">
                <Ionicons name="alert-circle-outline" size={16} color={colors.amberText} />
                <Text style={{ flex: 1, color: colors.amberText, fontSize: 12.5 }}>
                  {s.rejectionReason ?? "Your last submission was rejected."}
                </Text>
              </InfoNote>
            </View>
          ) : null}

          <Text style={styles.lead}>
            {isFarmer
              ? "Verified farms sell more. Buyers see a badge on your listings once we’ve checked your details."
              : isDriver
                ? "Verified drivers get offered jobs first. We check your licence and the truck’s papers before you carry goods."
                : "Verified buyers get accepted faster. Farmers can see that your business is registered."}
          </Text>

          <Text style={styles.section}>
            {isFarmer
              ? "Your farmer card"
              : isDriver
                ? "Your licence"
                : "Your business registration"}
          </Text>
          <Field
            label={
              isFarmer
                ? "Farmer card number"
                : isDriver
                  ? "Driving licence number"
                  : "GSTIN or Udyam number"
            }
            value={idNumber}
            onChangeText={setIdNumber}
            placeholder={
              isFarmer ? "TN/DGL/2019/004521" : isDriver ? "TN3720190001234" : "27AAPFU0939F1ZV"
            }
            autoCapitalize="characters"
          />

          {isDriver ? (
            <>
              <Text style={styles.section}>Your vehicle</Text>
              <Field
                label="RC number (optional)"
                value={rcNumber}
                onChangeText={setRcNumber}
                placeholder="TN30AB4821"
                autoCapitalize="characters"
              />
              <View style={{ marginTop: 14 }}>
                <DateField
                  label="Insurance valid until (optional)"
                  value={insuranceExpiry}
                  onChange={setInsuranceExpiry}
                  storage="iso"
                  minToday={false}
                />
              </View>
              <View style={{ marginTop: 14 }}>
                <DateField
                  label="Permit valid until (optional)"
                  value={permitExpiry}
                  onChange={setPermitExpiry}
                  storage="iso"
                  minToday={false}
                />
              </View>
              <Text style={styles.hint}>
                We use these dates to warn you before cover lapses — an expired insurance or permit
                means the truck can’t legally carry goods.
              </Text>
            </>
          ) : null}

          {!isFarmer && !isDriver ? (
            <View style={{ marginTop: 14 }}>
              <Field
                label="PAN (optional)"
                value={pan}
                onChangeText={setPan}
                placeholder="AABCU9603R"
                autoCapitalize="characters"
              />
            </View>
          ) : null}
          <Text style={styles.hint}>
            We check this against your document. It’s stored encrypted and never shown to other users
            — they only see that you’re verified.
          </Text>

          <Text style={styles.section}>Documents</Text>
          {required.map((type) => {
            const picked = docs.find((d) => d.type === type);
            return (
              <Pressable key={type} style={styles.docRow} onPress={() => attach(type)}>
                {picked ? (
                  <Image source={{ uri: picked.uri }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmpty]}>
                    <Ionicons name="camera-outline" size={22} color={colors.faint} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.docTitle}>{LABELS[type] ?? type}</Text>
                  <Text style={styles.hint}>
                    {picked ? "Tap to replace" : "Tap to take a photo or choose one"}
                  </Text>
                </View>
                {picked ? (
                  <Ionicons name="checkmark-circle" size={22} color={colors.forest} />
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={colors.faint} />
                )}
              </Pressable>
            );
          })}

          <View style={{ marginTop: 16 }}>
            <InfoNote>
              <Ionicons name="lock-closed-outline" size={16} color={colors.forest} />
              <Text style={{ flex: 1, color: colors.forest, fontSize: 12.5 }}>
                Your documents are encrypted before they’re stored, and only our verification team can
                open them.
              </Text>
            </InfoNote>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </FormScroll>
      </Screen>
    </KeyboardAvoidingView>
  );
}

function DocSlot({
  title,
  picked,
  error,
  onPress,
}: {
  title: string;
  picked?: Picked;
  error: string | null;
  onPress: () => void;
}) {
  return (
    <View style={{ marginTop: 18 }}>
      <Pressable style={[styles.docRow, error ? { borderWidth: 1, borderColor: colors.danger } : null]} onPress={onPress}>
        {picked ? (
          <Image source={{ uri: picked.uri }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty]}>
            <Ionicons name="camera-outline" size={22} color={colors.faint} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.docTitle}>{title}</Text>
          <Text style={styles.hint}>{picked ? "Tap to replace" : "Take a photo or choose one"}</Text>
        </View>
        <Ionicons name={picked ? "checkmark-circle" : "chevron-forward"} size={20} color={picked ? colors.forest : colors.faint} />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 32 },
  lead: { fontSize: 13.5, lineHeight: 20, color: colors.muted },
  section: { marginTop: 24, marginBottom: 10, fontSize: 13, fontWeight: "600", color: colors.forest },
  hint: { marginTop: 6, fontSize: 12, lineHeight: 17, color: colors.muted },
  docRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 12,
    ...shadow,
  },
  thumb: { width: 56, height: 56, borderRadius: 10 },
  thumbEmpty: {
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderStyle: "dashed",
  },
  docTitle: { fontSize: 14, fontWeight: "600", color: colors.ink },
  tick: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  h1: { marginTop: 16, fontSize: 22, fontWeight: "600" },
  sub: { marginTop: 8, fontSize: 13.5, lineHeight: 20, color: colors.muted, textAlign: "center", maxWidth: 300 },
  faint: { marginTop: 12, fontSize: 12, color: colors.faint },
  error: { marginTop: 16, fontSize: 13, color: colors.danger },
  stepMeta: { marginTop: 8, fontSize: 12, fontWeight: "600", color: colors.muted },
  progress: { flexDirection: "row", gap: 6, marginTop: 8, marginBottom: 8 },
  progressBit: { flex: 1, height: 4, borderRadius: 4, backgroundColor: colors.line },
  progressOn: { backgroundColor: colors.forest },
  later: { textAlign: "center", color: colors.muted, fontWeight: "600", fontSize: 14 },
});
