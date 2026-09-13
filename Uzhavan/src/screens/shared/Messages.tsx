import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppHeader, Screen } from "../../components/Chrome";
import { Field } from "../../components/ui";
import { useConversations, useMarkConversationRead, useMessages, useSendMessage } from "../../api/hooks";
import { useAuth } from "../../context/AuthContext";
import { imageFor } from "../../lib/images";
import type { SharedScreens } from "../../navigation/types";
import { colors, shadow } from "../../theme";

function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

// ── Conversation list ───────────────────────────────────────────

export function Messages() {
  const navigation = useNavigation<NativeStackNavigationProp<SharedScreens>>();
  const conversations = useConversations();
  const rows = conversations.data ?? [];

  return (
    <Screen>
      <AppHeader title="Messages" />
      <ScrollView contentContainerStyle={styles.pad}>
        {conversations.isLoading ? (
          <ActivityIndicator color={colors.forest} style={{ marginTop: 40 }} />
        ) : rows.length === 0 ? (
          <Text style={styles.empty}>
            No conversations yet. Open a crop and message the farmer to start one.
          </Text>
        ) : (
          rows.map((c) => (
            <Pressable
              key={c.id}
              style={styles.card}
              onPress={() => navigation.navigate("ChatThread", { conversationId: c.id, name: c.with.name })}
            >
              <View style={styles.row}>
                <View>
                  <Image source={imageFor(c.with.avatarKey)} style={styles.av} />
                  {c.unread ? <View style={styles.dot} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.between}>
                    <Text style={[styles.name, c.unread && styles.unreadName]} numberOfLines={1}>
                      {c.with.name}
                    </Text>
                    <Text style={styles.faint}>{ago(c.lastMessageAt)}</Text>
                  </View>
                  {c.crop ? (
                    <Text style={styles.cropLine} numberOfLines={1}>
                      {c.crop.title}
                    </Text>
                  ) : null}
                  <Text
                    style={[styles.preview, c.unread && styles.unreadPreview]}
                    numberOfLines={1}
                  >
                    {c.lastMessageBody ?? "Say hello"}
                  </Text>
                </View>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

// ── Thread ──────────────────────────────────────────────────────

export function ChatThread() {
  const { conversationId, name } = useRoute<RouteProp<SharedScreens, "ChatThread">>().params;
  const { user } = useAuth();
  const messages = useMessages(conversationId);
  const send = useSendMessage(conversationId);
  const markRead = useMarkConversationRead(conversationId);
  const [text, setText] = useState("");
  const [working, setWorking] = useState(false);

  const markReadMutate = markRead.mutate;
  useFocusEffect(
    useCallback(() => {
      markReadMutate();
    }, [markReadMutate]),
  );

  const submit = async () => {
    const body = text.trim();
    if (!body) return;
    setWorking(true);
    setText("");
    try {
      await send.mutateAsync(body);
    } finally {
      setWorking(false);
    }
  };

  const rows = messages.data ?? [];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen
        footer={
          <View style={styles.replyRow}>
            <View style={{ flex: 1 }}>
              <Field label="" value={text} onChangeText={setText} placeholder="Message…" multiline />
            </View>
            <Pressable
              style={[styles.send, (!text.trim() || working) && { opacity: 0.4 }]}
              disabled={!text.trim() || working}
              onPress={submit}
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
        <AppHeader title={name} />
        <ScrollView contentContainerStyle={styles.pad}>
          {messages.isLoading ? (
            <ActivityIndicator color={colors.forest} style={{ marginTop: 40 }} />
          ) : rows.length === 0 ? (
            <Text style={styles.empty}>Nothing here yet — say hello.</Text>
          ) : (
            <View style={{ gap: 10 }}>
              {rows.map((m) => {
                const mine = m.senderId === user?.id;
                return (
                  <View key={m.id} style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                    <Text style={styles.body}>{m.body}</Text>
                    <Text style={styles.time}>{ago(m.createdAt)}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 32 },
  empty: { marginTop: 40, textAlign: "center", fontSize: 13.5, lineHeight: 20, color: colors.muted },
  row: { flexDirection: "row", gap: 12, alignItems: "center" },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  faint: { fontSize: 11, color: colors.faint },

  card: { marginTop: 10, backgroundColor: colors.white, borderRadius: 14, padding: 13, ...shadow },
  av: { width: 48, height: 48, borderRadius: 24 },
  dot: {
    position: "absolute",
    right: -1,
    top: -1,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.forest,
    borderWidth: 2,
    borderColor: colors.white,
  },
  name: { fontSize: 14, fontWeight: "600", color: colors.ink, flexShrink: 1 },
  unreadName: { fontWeight: "700" },
  cropLine: { marginTop: 1, fontSize: 11.5, color: colors.forest },
  preview: { marginTop: 2, fontSize: 12.5, color: colors.muted },
  unreadPreview: { color: colors.ink, fontWeight: "500" },

  bubble: { maxWidth: "88%", borderRadius: 14, paddingHorizontal: 13, paddingVertical: 10 },
  mine: { alignSelf: "flex-end", backgroundColor: colors.mint },
  theirs: { alignSelf: "flex-start", backgroundColor: colors.white, ...shadow },
  body: { fontSize: 13.5, lineHeight: 19, color: colors.ink },
  time: { marginTop: 3, fontSize: 10.5, color: colors.faint },

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
