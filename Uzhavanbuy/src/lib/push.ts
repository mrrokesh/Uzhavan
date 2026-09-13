import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Device from "expo-device";
import type * as NotificationsModule from "expo-notifications";
import { api } from "./api";
import { APP_KIND } from "./appInfo";

/**
 * Registering this install for notifications.
 *
 * Everything here fails soft. A farmer who declines the permission, or is on a
 * simulator, or has no network, must still get a working app — the bell inside
 * the app carries the same announcements either way, so a push is an extra
 * rather than the only route.
 *
 * Remote push was dropped from Expo Go (SDK 53+), and expo-notifications throws
 * the moment it's *imported* there, before any of our code runs — a plain
 * `import` at the top of this file crashes on load regardless of guards further
 * down. `isExpoGo` decides whether to `require` the module at all, so Expo Go
 * never touches it and only a real dev/production build registers for push.
 */
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const Notifications: typeof NotificationsModule | null = isExpoGo
  ? null
  : (require("expo-notifications") as typeof NotificationsModule);

/** Foreground behaviour: show the banner rather than swallowing it silently. */
if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

let registered: string | null = null;

/** Android needs a channel before anything will make a sound. */
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== "android" || !Notifications) return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Uzhavan",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#1B5E3B",
  });
}

/**
 * Ask, then tell the server. Returns the token so it can be handed back on
 * sign-out, or null when we couldn't get one — which is not an error.
 */
export async function registerForPush(): Promise<string | null> {
  // A simulator has no push service, and asking there just throws.
  if (!Device.isDevice) return null;
  // Expo Go (SDK 53+) has no remote push support at all — asking throws.
  if (!Notifications) return null;

  try {
    await ensureChannel();

    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted && existing.canAskAgain) {
      granted = (await Notifications.requestPermissionsAsync()).granted;
    }
    if (!granted) return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    if (!token) return null;

    await api("/me/push-token", {
      method: "PUT",
      body: {
        token,
        platform: Platform.OS === "ios" ? "IOS" : "ANDROID",
        app: APP_KIND,
      },
    });

    registered = token;
    return token;
  } catch (err) {
    // Worth a line in the log, never worth a dialog.
    console.warn("[push] registration skipped:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Stop notifications for this install.
 *
 * Called on sign-out: the next person to use this phone must not receive the
 * previous account's announcements.
 */
export async function unregisterPush(): Promise<void> {
  if (!registered) return;
  try {
    await api(`/me/push-token/${encodeURIComponent(registered)}`, { method: "DELETE" });
  } catch {
    // Signing out must not fail because the network did.
  } finally {
    registered = null;
  }
}
