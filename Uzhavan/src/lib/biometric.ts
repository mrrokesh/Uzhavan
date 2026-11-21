import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

const KEY = "uzhavan.biometric";

export type BiometricChoice = "on" | "off" | null;

export async function biometricChoice(): Promise<BiometricChoice> {
  const saved = await SecureStore.getItemAsync(KEY);
  return saved === "on" || saved === "off" ? saved : null;
}

export async function setBiometricChoice(choice: "on" | "off") {
  await SecureStore.setItemAsync(KEY, choice);
}

export async function fingerprintAvailable(): Promise<boolean> {
  const hardware = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return hardware && enrolled;
}

export async function askFingerprint(prompt: string): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: prompt,
    cancelLabel: "Cancel",
    disableDeviceFallback: false,
  });
  return result.success;
}
