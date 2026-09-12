import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { AppHeader, Screen } from "../../components/Chrome";
import { Chip, Field, InfoNote, OutlineButton, PrimaryButton } from "../../components/ui";
import { useSubmitVerification, useVerification } from "../../api/hooks";
import { useAuth } from "../../context/AuthContext";
import { ApiError } from "../../lib/api";
import type { DocumentType, UploadDoc } from "../../api/types";
import { colors, shadow } from "../../theme";

/** Roughly the server's 5 MB cap, allowing for base64 inflation. */
const MAX_BYTES = 5 * 1024 * 1024;

type Picked = UploadDoc & { uri: string };

const LABELS: Partial<Record<DocumentType, string>> = {
  FARMER_CARD: "Farmer card",
  LAND_RECORD: "Land record (patta / chitta)",
  GST_CERTIFICATE: "GST certificate",
  MSME_CERTIFICATE: "Udyam / MSME certificate",
  PAN_CARD: "PAN card",
};

export function Verification() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const state = useVerification();
  const submit = useSubmitVerification();

  const isFarmer = user?.role === "FARMER";
  const [idNumber, setIdNumber] = useState("");
  const [pan, setPan] = useState("");
  const [docs, setDocs] = useState<Picked[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

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
      setError(isFarmer ? "Enter your farmer card number" : "Enter your GSTIN or Udyam number");
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
    if (isFarmer) body.farmerCard = value;
    else if (value.startsWith("UDYAM")) body.udyam = value;
    else body.gstin = value;

    setWorking(true);
    setError(null);
    try {
      await submit.mutateAsync(body);
      setDocs([]);
      setIdNumber("");
      setPan("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t submit. Check your connection.");
    } finally {
      setWorking(false);
    }
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
              : "Farmers can see that your business is verified, which makes them more likely to accept."}
          </Text>
          {s.idLast4 ? (
            <Text style={styles.faint}>
              {isFarmer ? "Farmer card" : "Registered number"} ending {s.idLast4}
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
            <OutlineButton label="Back" onPress={() => navigation.goBack()} />
          </View>
        </ScrollView>
      </Screen>
    );
  }

  // ── Submit / resubmit ────────────────────────────────────────
  const required: DocumentType[] = s?.required.documents ?? [];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
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
        <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
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
              : "Verified buyers get accepted faster. Farmers can see that your business is registered."}
          </Text>

          <Text style={styles.section}>
            {isFarmer ? "Your farmer card" : "Your business registration"}
          </Text>
          <Field
            label={isFarmer ? "Farmer card number" : "GSTIN or Udyam number"}
            value={idNumber}
            onChangeText={setIdNumber}
            placeholder={isFarmer ? "TN/DGL/2019/004521" : "27AAPFU0939F1ZV"}
            autoCapitalize="characters"
          />
          {!isFarmer ? (
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
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
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
});
