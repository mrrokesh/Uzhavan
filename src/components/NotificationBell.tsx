import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useUnreadAnnouncements } from "../api/hooks";
import { colors, shadow } from "../theme";

/**
 * The bell every home screen carries. The badge count comes from the server,
 * not from what happens to be loaded, so it's right before the list is opened.
 */
export function NotificationBell() {
  const navigation = useNavigation<{ navigate: (screen: string) => void }>();
  const unread = useUnreadAnnouncements();
  const count = unread.data?.count ?? 0;

  return (
    <Pressable
      onPress={() => navigation.navigate("Announcements")}
      style={styles.bell}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `Announcements, ${count} unread` : "Announcements"}
    >
      <Ionicons name="notifications-outline" size={20} color={colors.ink} />
      {count > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 9 ? "9+" : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: colors.white, fontSize: 9.5, fontWeight: "700" },
});
