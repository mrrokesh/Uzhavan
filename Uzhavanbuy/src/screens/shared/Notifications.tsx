import { useEffect } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppHeader, Screen } from "../../components/Chrome";
import { Chip } from "../../components/ui";
import { useMarkAllNotificationsRead, useNotifications, useUnreadAnnouncements } from "../../api/hooks";
import { colors, shadow } from "../../theme";
import type { AppNotification, NotificationKind } from "../../api/types";
import type { SharedScreens } from "../../navigation/types";

const ICON: Record<NotificationKind, keyof typeof Ionicons.glyphMap> = {
  REQUEST_ACCEPTED: "checkmark-circle-outline",
  REQUEST_DECLINED: "close-circle-outline",
  ORDER_CONFIRMED: "receipt-outline",
  DRIVER_ACCEPTED: "car-outline",
  DELIVERED: "cube-outline",
};

function when(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function Notifications() {
  const navigation = useNavigation<NativeStackNavigationProp<SharedScreens>>();
  const list = useNotifications();
  const markAll = useMarkAllNotificationsRead();
  const announcementsUnread = useUnreadAnnouncements().data?.count ?? 0;

  const rows = list.data ?? [];
  const unread = rows.filter((n) => !n.readAt).length;

  // Opening the list is the read receipt, same as Announcements — fire once
  // per load, and only when there's something to mark.
  useEffect(() => {
    if (unread > 0 && !markAll.isPending) markAll.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.dataUpdatedAt]);

  return (
    <Screen>
      <AppHeader title="Notifications" />
      <ScrollView contentContainerStyle={styles.pad}>
        <Pressable style={styles.link} onPress={() => navigation.navigate("Announcements")}>
          <Ionicons name="megaphone-outline" size={16} color={colors.forest} />
          <Text style={styles.linkText}>Announcements from Uzhavan</Text>
          {announcementsUnread > 0 ? <Chip label={String(announcementsUnread)} tone="amber" /> : null}
          <Ionicons name="chevron-forward" size={16} color={colors.faint} />
        </Pressable>

        {list.isLoading ? <ActivityIndicator color={colors.forest} style={{ marginTop: 40 }} /> : null}

        {!list.isLoading && rows.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons name="notifications-outline" size={28} color={colors.forest} />
            </View>
            <Text style={styles.emptyTitle}>Nothing yet</Text>
            <Text style={styles.empty}>
              A request accepted, an order confirmed, a delivery landing — your own activity shows up
              here.
            </Text>
          </View>
        ) : null}

        {rows.map((n) => (
          <Card key={n.id} item={n} />
        ))}
      </ScrollView>
    </Screen>
  );
}

function Card({ item }: { item: AppNotification }) {
  return (
    <View style={[styles.card, !item.readAt && styles.cardUnread]}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <Ionicons name={ICON[item.kind]} size={17} color={colors.forest} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.body}>{item.body}</Text>
          <Text style={styles.faint}>{when(item.createdAt)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 32 },
  link: {
    marginTop: 4,
    marginBottom: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
  },
  linkText: { flex: 1, fontSize: 13.5, fontWeight: "600", color: colors.forest },
  card: {
    marginTop: 10,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    ...shadow,
  },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: colors.forest },
  head: { flexDirection: "row", gap: 12 },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 15, fontWeight: "600", color: colors.ink },
  body: { marginTop: 4, fontSize: 13.5, lineHeight: 20, color: colors.muted },
  faint: { marginTop: 8, fontSize: 11.5, color: colors.faint },
  emptyWrap: { alignItems: "center", paddingTop: 56 },
  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { marginTop: 14, fontSize: 17, fontWeight: "600", color: colors.ink },
  empty: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.muted,
    maxWidth: 290,
  },
});
