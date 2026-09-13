import { Platform } from "react-native";

const KEY = "uzhavan.token";

let memoryToken: string | null = null;

async function persistGet(): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return globalThis.localStorage?.getItem(KEY) ?? null;
    } catch {
      return null;
    }
  }
  const SecureStore = await import("expo-secure-store");
  return SecureStore.getItemAsync(KEY);
}

async function persistSet(token: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      globalThis.localStorage?.setItem(KEY, token);
    } catch {
      /* ignore quota / private mode */
    }
    return;
  }
  const SecureStore = await import("expo-secure-store");
  await SecureStore.setItemAsync(KEY, token);
}

async function persistClear(): Promise<void> {
  if (Platform.OS === "web") {
    try {
      globalThis.localStorage?.removeItem(KEY);
    } catch {
      /* ignore */
    }
    return;
  }
  const SecureStore = await import("expo-secure-store");
  await SecureStore.deleteItemAsync(KEY);
}

export function getToken(): string | null {
  return memoryToken;
}

export async function loadToken(): Promise<string | null> {
  memoryToken = await persistGet();
  return memoryToken;
}

export async function saveToken(token: string): Promise<void> {
  memoryToken = token;
  await persistSet(token);
}

export async function clearToken(): Promise<void> {
  memoryToken = null;
  await persistClear();
}
