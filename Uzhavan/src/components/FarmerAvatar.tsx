import { useEffect, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, View } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import Svg, { Circle, Ellipse, Path } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { keys } from "../api/hooks";
import { api, API_BASE_URL, ApiError } from "../lib/api";
import { colors } from "../theme";

const FILE = `${FileSystem.documentDirectory}farm-avatar.jpg`;

export async function rememberFarmAvatar(base64: string): Promise<string> {
  await FileSystem.writeAsStringAsync(FILE, base64, { encoding: FileSystem.EncodingType.Base64 });
  return `${FILE}?t=${Date.now()}`;
}

async function rememberedFarmAvatar(): Promise<string | null> {
  const info = await FileSystem.getInfoAsync(FILE);
  return info.exists ? `${FILE}?t=${info.modificationTime ?? 0}` : null;
}

type FarmPhoto = { id: string; hasAvatar?: boolean; avatarUpdatedAt?: string | null };

/** Cartoon used until the farmer adds their own picture. */
export function CartoonFarmer({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 80 80">
      <Circle cx="40" cy="40" r="40" fill="#E7F3EA" />
      <Ellipse cx="40" cy="68" rx="26" ry="16" fill="#157A32" />
      <Circle cx="40" cy="36" r="16" fill="#F3C7A1" />
      <Path d="M22 30c2-12 34-12 36 0-6-4-30-4-36 0z" fill="#E2B15A" />
      <Ellipse cx="40" cy="24" rx="18" ry="6" fill="#C4923A" />
      <Circle cx="34" cy="36" r="1.6" fill="#17191C" />
      <Circle cx="46" cy="36" r="1.6" fill="#17191C" />
      <Path d="M35 42c2 3 8 3 10 0" stroke="#17191C" strokeWidth="1.4" fill="none" />
    </Svg>
  );
}

export function FarmerAvatar({
  farm,
  size,
  editable,
  onChanged,
}: {
  farm?: FarmPhoto | null;
  size: number;
  editable?: boolean;
  onChanged?: () => void;
}) {
  const [local, setLocal] = useState<string | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    let live = true;
    rememberedFarmAvatar().then((uri) => {
      if (live && uri) setLocal(uri);
    });
    return () => {
      live = false;
    };
  }, [farm?.avatarUpdatedAt]);

  const remote = farm?.hasAvatar
    ? `${API_BASE_URL}/api/farms/${farm.id}/avatar?v=${encodeURIComponent(farm.avatarUpdatedAt ?? "")}`
    : null;
  const uri = local ?? remote;

  const change = async (camera: boolean) => {
    const perm = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(camera ? "Camera access needed" : "Photo access needed", "Allow access to set your photo.");
      return;
    }
    const result = camera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.5, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.5, base64: true });
    const asset = result.assets?.[0];
    if (result.canceled || !asset?.base64) return;
    const saved = await rememberFarmAvatar(asset.base64);
    setLocal(saved);
    try {
      await api("/farmer/farm/avatar", {
        method: "PUT",
        body: { data: asset.base64, mimeType: asset.mimeType ?? "image/jpeg" },
      });
      await qc.invalidateQueries({ queryKey: keys.farmerSummary });
      onChanged?.();
    } catch (err) {
      if (err instanceof ApiError && err.status !== 404) {
        Alert.alert("Couldn’t save the photo", err.message);
      }
    }
  };

  const ask = () => {
    Alert.alert("Profile photo", "Add a picture of yourself", [
      { text: "Take photo", onPress: () => void change(true) },
      { text: "Choose from gallery", onPress: () => void change(false) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const face = uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden" }}>
      <CartoonFarmer size={size} />
    </View>
  );

  if (!editable) return face;
  return (
    <Pressable onPress={ask} accessibilityLabel="Change profile photo">
      {face}
      <View style={styles.cam}>
        <Ionicons name="camera" size={12} color={colors.white} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cam: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.forest,
    alignItems: "center",
    justifyContent: "center",
  },
});
