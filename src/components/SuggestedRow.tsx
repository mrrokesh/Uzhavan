import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSuggestions } from "../api/hooks";
import { imageFor } from "../lib/images";
import { inr } from "../lib/format";
import { colors, shadow } from "../theme";

/**
 * "Picked for you" — a horizontal strip above the main feed.
 *
 * Every card shows *why* it was picked. That isn't decoration: a buyer who
 * can't tell why they're being shown something has no way to judge whether to
 * trust it, and no way to tell us we've got them wrong.
 *
 * Renders nothing at all when there's nothing worth suggesting. An empty
 * carousel is worse than no carousel.
 */
export function SuggestedRow({ onOpen }: { onOpen: (cropId: string) => void }) {
  const suggestions = useSuggestions();

  const rows = suggestions.data?.crops ?? [];
  if (suggestions.isLoading || rows.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title}>
          {suggestions.data?.personalised ? "Picked for you" : "Worth a look"}
        </Text>
        {!suggestions.data?.personalised ? (
          <Text style={styles.hint}>Nearby farms</Text>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {rows.map((c) => (
          <Pressable key={c.id} style={styles.card} onPress={() => onOpen(c.id)}>
            <Image source={imageFor(c.imageKey)} style={styles.img} />
            <View style={styles.body}>
              <Text style={styles.cropTitle} numberOfLines={1}>
                {c.title}
              </Text>
              <Text style={styles.price}>{inr(c.pricePerKg)}/kg</Text>
              <View style={styles.reasonRow}>
                <Ionicons name="sparkles-outline" size={11} color={colors.forest} />
                <Text style={styles.reason} numberOfLines={2}>
                  {c.reason}
                </Text>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 18 },
  head: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  title: { fontSize: 15, fontWeight: "700", color: colors.ink },
  hint: { fontSize: 11.5, color: colors.faint },
  strip: { gap: 12, paddingRight: 4 },
  card: {
    width: 156,
    backgroundColor: colors.white,
    borderRadius: 14,
    overflow: "hidden",
    ...shadow,
  },
  img: { width: "100%", height: 90 },
  body: { padding: 10 },
  cropTitle: { fontSize: 13.5, fontWeight: "600", color: colors.ink },
  price: { marginTop: 3, fontSize: 13, fontWeight: "700", color: colors.forest },
  reasonRow: { marginTop: 7, flexDirection: "row", gap: 5, alignItems: "flex-start" },
  reason: { flex: 1, fontSize: 10.5, lineHeight: 14, color: colors.muted },
});
