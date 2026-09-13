import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppHeader, Screen } from "../../components/Chrome";
import { Field } from "../../components/ui";
import { useAskAssistant } from "../../api/hooks";
import { ApiError } from "../../lib/api";
import { colors, shadow } from "../../theme";

const SUGGESTIONS = ["What crops are available?", "Who's available for delivery?", "What's my payment status?"];

type Turn = { question: string; text: string; error?: boolean };

/**
 * Answers from the app's own live data — not a chat with a person. Voice and a
 * model layered on top come later; for now every answer is one of a fixed set
 * of intents matched against what's actually in the database.
 */
export function Assistant() {
  const ask = useAskAssistant();
  const [text, setText] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [working, setWorking] = useState(false);

  const submit = async (question: string) => {
    const q = question.trim();
    if (!q) return;
    setWorking(true);
    setText("");
    try {
      const answer = await ask.mutateAsync(q);
      setTurns((prev) => [...prev, { question: q, text: answer.text }]);
    } catch (err) {
      setTurns((prev) => [
        ...prev,
        { question: q, text: err instanceof ApiError ? err.message : "Couldn't reach the assistant.", error: true },
      ]);
    } finally {
      setWorking(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen
        footer={
          <View style={styles.replyRow}>
            <View style={{ flex: 1 }}>
              <Field
                label=""
                value={text}
                onChangeText={setText}
                placeholder="Ask about crops, delivery, payments…"
              />
            </View>
            <Pressable
              style={[styles.send, (!text.trim() || working) && { opacity: 0.4 }]}
              disabled={!text.trim() || working}
              onPress={() => submit(text)}
            >
              {working ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Ionicons name="send" size={17} color={colors.white} />
              )}
            </Pressable>
          </View>
        }
      >
        <AppHeader title="Ask Uzhavan" />
        <ScrollView contentContainerStyle={styles.pad}>
          {turns.length === 0 ? (
            <>
              <Text style={styles.lead}>
                Ask what crops are listed, who's online to deliver, or where a payment stands. Answers come
                straight from your account — nothing is made up.
              </Text>
              <View style={{ marginTop: 16, gap: 8 }}>
                {SUGGESTIONS.map((s) => (
                  <Pressable key={s} style={styles.suggestion} onPress={() => submit(s)}>
                    <Ionicons name="sparkles-outline" size={15} color={colors.forest} />
                    <Text style={styles.suggestionText}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <View style={{ gap: 10 }}>
              {turns.map((t, i) => (
                <View key={i} style={{ gap: 6 }}>
                  <View style={[styles.bubble, styles.mine]}>
                    <Text style={styles.body}>{t.question}</Text>
                  </View>
                  <View style={[styles.bubble, styles.theirs, t.error && styles.errorBubble]}>
                    <Text style={styles.body}>{t.text}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 32 },
  lead: { fontSize: 13.5, lineHeight: 20, color: colors.muted },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
    ...shadow,
  },
  suggestionText: { fontSize: 13, fontWeight: "500", color: colors.ink },
  bubble: { maxWidth: "88%", borderRadius: 14, paddingHorizontal: 13, paddingVertical: 10 },
  mine: { alignSelf: "flex-end", backgroundColor: colors.mint },
  theirs: { alignSelf: "flex-start", backgroundColor: colors.white, ...shadow },
  errorBubble: { backgroundColor: "#fdecec" },
  body: { fontSize: 13.5, lineHeight: 19, color: colors.ink },
  replyRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  send: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.forest,
    alignItems: "center",
    justifyContent: "center",
  },
});
