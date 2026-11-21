import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen } from "../../components/Chrome";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications, useUnreadAnnouncements } from "../../api/hooks";
import { useI18n } from "../../i18n";
import { colors } from "../../theme";
import type { AppNotification, NotificationKind } from "../../api/types";
import type { SharedScreens } from "../../navigation/types";

const ICON: Record<NotificationKind, keyof typeof Ionicons.glyphMap> = {
  REQUEST_ACCEPTED: "checkmark",
  REQUEST_DECLINED: "close",
  ORDER_CONFIRMED: "receipt",
  DRIVER_ACCEPTED: "car",
  DELIVERED: "cube",
};

function when(iso: string, nowLabel: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return nowLabel;
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function Notifications() {
  const { t } = useI18n();
  const navigation = useNavigation<NativeStackNavigationProp<SharedScreens>>();
  const list = useNotifications();
  const markOne = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const announcementsUnread = useUnreadAnnouncements().data?.count ?? 0;
  const rows = list.data ?? [];
  const unread = rows.filter((n) => !n.readAt).length;

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.h1}>{t("notes.title")}</Text>
        {unread > 0 ? (
          <Pressable onPress={() => markAll.mutate()} hitSlop={8}>
            <Text style={styles.mark}>{t("notes.markAll")}</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView>
        <Pressable style={styles.announce} onPress={() => navigation.navigate("Announcements")}>
          <View style={[styles.avatar, { backgroundColor: colors.mint }]}>
            <Ionicons name="megaphone" size={18} color={colors.forest} />
          </View>
          <Text style={styles.announceText}>{t("notes.announcements")}</Text>
          {announcementsUnread > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{announcementsUnread}</Text>
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={16} color={colors.faint} />
          )}
        </Pressable>

        {list.isLoading ? <ActivityIndicator color={colors.forest} style={{ marginTop: 40 }} /> : null}

        {!list.isLoading && rows.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>{t("notes.emptyTitle")}</Text>
            <Text style={styles.empty}>{t("notes.empty")}</Text>
          </View>
        ) : null}

        {rows.map((item) => (
          <Pressable
            key={item.id}
            style={styles.row}
            onPress={() => {
              if (!item.readAt) markOne.mutate(item.id);
            }}
          >
            <View style={styles.avatar}>
              <Ionicons name={ICON[item.kind]} size={18} color={colors.white} />
            </View>
            <View style={styles.body}>
              <View style={styles.top}>
                <Text style={[styles.title, !item.readAt && styles.titleUnread]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[styles.time, !item.readAt && { color: colors.forest }]}>{when(item.createdAt, t("notes.now"))}</Text>
              </View>
              <Text style={styles.preview} numberOfLines={1}>
                {item.body}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  h1: { fontSize: 28, fontWeight: "800", color: colors.ink },
  mark: { fontSize: 13, fontWeight: "700", color: colors.forest },
  announce: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  announceText: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.ink },
  row: { flexDirection: "row", alignItems: "center", paddingLeft: 16, gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.forest,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    gap: 2,
  },
  top: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flex: 1, fontSize: 16, color: colors.ink },
  titleUnread: { fontWeight: "700" },
  time: { fontSize: 12, color: colors.faint },
  preview: { fontSize: 14, color: colors.muted },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.forest,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: "700" },
  emptyWrap: { alignItems: "center", paddingTop: 64, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: colors.ink },
  empty: { marginTop: 8, textAlign: "center", fontSize: 14, lineHeight: 20, color: colors.muted },
});
