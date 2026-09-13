import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { api } from "./api";
import { APP_KIND, APP_NAME } from "./appInfo";

/**
 * Registering this install for notifications.
 *
 * `expo-notifications` is imported lazily, never at module scope. Since SDK 53
 * the module throws the moment it loads inside Expo Go — remote push was taken
 * out of the sandbox app — and a throw during import happens before any guard
 * can run, so a static import means the whole app fails to start rather than
 * quietly losing notifications. Guarding the calls is not enough; the import
 * itself has to be conditional.
 *
 * Everything else fails soft too. A farmer who declines the permission, or is
 * on a simulator, or has no network, still gets a working app: the bell inside
 * the app carries the same announcements, so a push is an extra route rather
 * than the only one.
 */

/** True in the Expo Go sandbox, as opposed to a development or store build. */
export const IS_EXPO_GO =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let registered: string | null = null;
let handlerSet = false;

type NotificationsModule = typeof import("expo-notifications");

/** Load the module, or nothing at all where it can't work. */
async function notifications(): Promise<NotificationsModule | null> {
  if (IS_EXPO_GO) return null;
  try {
    return await import("expo-notifications");
  } catch {
    return null;
  }
}

/** Show the banner rather than swallowing it while the app is open. */
async function ensureHandler(N: NotificationsModule): Promise<void> {
  if (handlerSet) return;
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  handlerSet = true;
}

/** Android needs a channel before anything will make a sound. */
async function ensureChannel(N: NotificationsModule): Promise<void> {
  if (Platform.OS !== "android") return;
  await N.setNotificationChannelAsync("default", {
    name: APP_NAME,
    importance: N.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#1B5E3B",
  });
}

/**
 * Ask, then tell the server. Returns the token so it can be handed back on
 * sign-out, or null when we couldn't get one — which is not an error.
 */
export async function registerForPush(): Promise<string | null> {
  const N = await notifications();
  if (!N) return null;

  try {
    const Device = await import("expo-device");
    // A simulator has no push service, and asking there just throws.
    if (!Device.isDevice) return null;

    await ensureHandler(N);
    await ensureChannel(N);

    const existing = await N.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted && existing.canAskAgain) {
      granted = (await N.requestPermissionsAsync()).granted;
    }
    if (!granted) return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await N.getExpoPushTokenAsync(
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

/**
 * Listen for notifications arriving and being tapped.
 *
 * Returns a teardown function. Does nothing where notifications can't work, so
 * callers don't need their own check.
 */
export async function listenForNotifications(handlers: {
  onReceived: () => void;
  onTapped: (data: Record<string, unknown>) => void;
}): Promise<() => void> {
  const N = await notifications();
  if (!N) return () => {};

  await ensureHandler(N);

  const received = N.addNotificationReceivedListener(() => handlers.onReceived());
  const tapped = N.addNotificationResponseReceivedListener((response) => {
    handlers.onTapped(
      (response.notification.request.content.data ?? {}) as Record<string, unknown>,
    );
  });

  return () => {
    received.remove();
    tapped.remove();
  };
}
