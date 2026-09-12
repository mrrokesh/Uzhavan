import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLeaveReview, useReviewable } from "../api/hooks";
import { ApiError } from "../lib/api";
import { colors, shadow } from "../theme";
import type { ReviewableSubject } from "../api/types";

const WHAT: Record<string, string> = {
  FARM: "How was the crop?",
  DRIVER: "How was the delivery?",
  BUYER: "How was this buyer?",
};

/**
 * Rating a counterparty, on the screen where the trade ends.
 *
 * Asked here rather than in a notification a week later, because this is the
 * moment someone actually remembers the detail — and a rating written from
 * memory a fortnight on is worth less than one written on the loading bay.
 *
 * Renders nothing when there's nothing to rate, so it can sit unconditionally
 * on the delivery screens without a wrapper deciding for it.
 */
export function RatePrompt({ orderId }: { orderId: string }) {
  const reviewable = useReviewable(orderId);
  const subjects = reviewable.data?.subjects ?? [];

  if (!reviewable.data?.canReview || subjects.length === 0) return null;

  return (
    <View style={{ marginTop: 20, gap: 12 }}>
      {subjects.map((s) => (
        <RateCard key={s.subject} orderId={orderId} subject={s} />
      ))}
    </View>
  );
}

function RateCard({ orderId, subject }: { orderId: string; subject: ReviewableSubject }) {
  const leave = useLeaveReview(orderId);
  const [stars, setStars] = useState(subject.existing?.stars ?? 0);
  const [comment, setComment] = useState(subject.existing?.comment ?? "");
  const [open, setOpen] = useState(!subject.existing);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const submit = async () => {
    if (stars < 1) {
      setError("Tap a star first");
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await leave.mutateAsync({
        subject: subject.subject,
        stars,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      });
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t save that.");
    } finally {
      setWorking(false);
    }
  };

  // Already rated and not being edited: a quiet summary, not a form.
  if (!open) {
    return (
      <Pressable style={styles.card} onPress={() => setOpen(true)}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.done}>
              You rated {subject.name} {stars} star{stars === 1 ? "" : "s"}
            </Text>
            {comment ? <Text style={styles.quiet}>“{comment}”</Text> : null}
          </View>
          <Text style={styles.change}>Change</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{WHAT[subject.subject] ?? "How did it go?"}</Text>
      <Text style={styles.who}>{subject.name}</Text>

      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setStars(n)} hitSlop={6}>
            <Ionicons
              name={n <= stars ? "star" : "star-outline"}
              size={30}
              color={n <= stars ? colors.amberText : colors.faint}
            />
          </Pressable>
        ))}
      </View>

      <TextInput
        value={comment}
        onChangeText={setComment}
        placeholder="Anything worth saying? (optional)"
        placeholderTextColor={colors.faint}
        style={styles.input}
        multiline
        maxLength={500}
      />

      <Pressable
        style={[styles.button, working && { opacity: 0.6 }]}
        onPress={submit}
        disabled={working}
      >
        <Text style={styles.buttonText}>{working ? "Saving…" : "Submit rating"}</Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 16, ...shadow },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontSize: 15, fontWeight: "600", color: colors.ink },
  who: { marginTop: 2, fontSize: 12.5, color: colors.muted },
  stars: { marginTop: 14, flexDirection: "row", gap: 10 },
  input: {
    marginTop: 14,
    minHeight: 44,
    maxHeight: 110,
    borderRadius: 12,
    backgroundColor: colors.cream,
    paddingHorizontal: 12,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 13.5,
    color: colors.ink,
  },
  button: {
    marginTop: 14,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.forest,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: colors.white, fontSize: 14, fontWeight: "600" },
  done: { fontSize: 13.5, fontWeight: "600", color: colors.ink },
  quiet: { marginTop: 4, fontSize: 12.5, lineHeight: 18, color: colors.muted },
  change: { fontSize: 13, fontWeight: "600", color: colors.forest },
  error: { marginTop: 10, fontSize: 12.5, color: colors.danger },
});
