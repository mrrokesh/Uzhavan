import { useEffect } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppHeader, Screen } from "../../components/Chrome";
import { Chip } from "../../components/ui";
import {
  useAnnouncements,
  useMarkAllAnnouncementsRead,
  useMarkAnnouncementRead,
} from "../../api/hooks";
import { colors, shadow } from "../../theme";
import type { Announcement } from "../../api/types";

function when(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function Announcements() {
  const list = useAnnouncements();
  const markRead = useMarkAnnouncementRead();
  const markAll = useMarkAllAnnouncementsRead();

  const rows = list.data ?? [];
  const unread = rows.filter((a) => !a.read).length;

  // Opening the list is the read receipt. Fire once per load, and only when
  // there's something to mark — not on every render.
  useEffect(() => {
    if (unread > 0 && !markAll.isPending) markAll.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.dataUpdatedAt]);

  return (
    <Screen>
      <AppHeader title="Announcements" />
      <ScrollView contentContainerStyle={styles.pad}>
        {list.isLoading ? <ActivityIndicator color={colors.forest} style={{ marginTop: 40 }} /> : null}

        {!list.isLoading && rows.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons name="megaphone-outline" size={28} color={colors.forest} />
            </View>
            <Text style={styles.emptyTitle}>Nothing yet</Text>
            <Text style={styles.empty}>
              Updates from the Uzhavan team — price notices, new features, holidays — show up here.
            </Text>
          </View>
        ) : null}

        {rows.map((a) => (
          <Card key={a.id} item={a} onPress={() => !a.read && markRead.mutate(a.id)} />
        ))}
      </ScrollView>
    </Screen>
  );
}

function Card({ item, onPress }: { item: Announcement; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.card, !item.read && styles.cardUnread]}>
      <View style={styles.head}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
          {!item.read ? <View style={styles.dot} /> : null}
          <Text style={styles.title}>{item.title}</Text>
        </View>
        {item.pinned ? <Chip label="Pinned" tone="amber" /> : null}
      </View>
      <Text style={styles.body}>{item.body}</Text>
      <Text style={styles.faint}>{when(item.publishedAt)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 32 },
  card: {
    marginTop: 10,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    ...shadow,
  },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: colors.forest },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.forest },
  title: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.ink },
  body: { marginTop: 8, fontSize: 13.5, lineHeight: 20, color: colors.muted },
  faint: { marginTop: 10, fontSize: 11.5, color: colors.faint },
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
