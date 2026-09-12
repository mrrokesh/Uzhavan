import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { api } from "./api";
import { APP_KIND } from "./appInfo";

/**
 * Registering this install for notifications.
 *
 * Everything here fails soft. A farmer who declines the permission, or is on a
 * simulator, or has no network, must still get a working app — the bell inside
 * the app carries the same announcements either way, so a push is an extra
 * rather than the only route.
 */

/** Foreground behaviour: show the banner rather than swallowing it silently. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let registered: string | null = null;

/** Android needs a channel before anything will make a sound. */
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
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
