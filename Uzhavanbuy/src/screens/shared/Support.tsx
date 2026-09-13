import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppHeader, Screen } from "../../components/Chrome";
import { Chip, Field, InfoNote, PrimaryButton } from "../../components/ui";
import { useAppConfig, useRaiseTicket, useReplyToTicket, useTicket, useTickets } from "../../api/hooks";
import { useAuth } from "../../context/AuthContext";
import { APP_KIND, APP_VERSION } from "../../lib/appInfo";
import { ApiError } from "../../lib/api";
import { TICKET_LABEL, type TicketCategory, type TicketStatus } from "../../api/types";
import { colors, shadow } from "../../theme";

const TONE: Record<TicketStatus, "amber" | "mint" | "neutral"> = {
  OPEN: "amber",
  ASSIGNED: "amber",
  IN_PROGRESS: "amber",
  WAITING_ON_USER: "mint",
  RESOLVED: "mint",
  CLOSED: "neutral",
};

function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

// ── Help hub ────────────────────────────────────────────────────

export function Help() {
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const config = useAppConfig(APP_KIND, APP_VERSION);
  const tickets = useTickets();

  const support = config.data?.support;
  const open = (tickets.data ?? []).filter(
    (t) => t.status !== "RESOLVED" && t.status !== "CLOSED",
  );

  const dial = (number: string) => Linking.openURL(`tel:${number.replace(/\s/g, "")}`);
  const mail = (address: string) => Linking.openURL(`mailto:${address}`);
  const whatsapp = (number: string) =>
    Linking.openURL(`https://wa.me/${number.replace(/[^0-9]/g, "")}`);

  return (
    <Screen>
      <AppHeader title="Help & support" />
      <ScrollView contentContainerStyle={styles.pad}>
        <Text style={styles.lead}>
          Something wrong with an order, a payment or a delivery? Raise it here and our team picks it
          up — usually the same day.
        </Text>

        <Pressable style={styles.cta} onPress={() => navigation.navigate("NewTicket")}>
          <View style={styles.ctaIcon}>
            <Ionicons name="create-outline" size={20} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.ctaTitle}>Raise a new issue</Text>
            <Text style={styles.ctaSub}>Tell us what happened and we’ll take it from there</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.white} />
        </Pressable>

        {open.length > 0 ? (
          <>
            <Text style={styles.section}>Your open issues</Text>
            {open.map((t) => (
              <Pressable
                key={t.id}
                style={styles.card}
                onPress={() => navigation.navigate("TicketDetail", { code: t.code })}
              >
                <View style={styles.between}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {t.subject}
                  </Text>
                  <Chip label={TICKET_LABEL[t.status]} tone={TONE[t.status]} />
                </View>
                <Text style={styles.faint}>
                  {t.code} · {ago(t.updatedAt)}
                </Text>
              </Pressable>
            ))}
          </>
        ) : null}

        <Pressable style={styles.linkRow} onPress={() => navigation.navigate("MyTickets")}>
          <Ionicons name="albums-outline" size={18} color={colors.forest} />
          <Text style={styles.linkText}>See all my issues</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.faint} />
        </Pressable>

        <Text style={styles.section}>Talk to us</Text>
        {config.isLoading ? (
          <ActivityIndicator color={colors.forest} style={{ marginTop: 12 }} />
        ) : (
          <View style={styles.contactCard}>
            {support?.phone ? (
              <Pressable style={styles.contactRow} onPress={() => dial(support.phone)}>
                <Ionicons name="call-outline" size={18} color={colors.forest} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactValue}>{support.phone}</Text>
                  <Text style={styles.hint}>Call support</Text>
                </View>
              </Pressable>
            ) : null}
            {support?.whatsapp ? (
              <Pressable style={styles.contactRow} onPress={() => whatsapp(support.whatsapp!)}>
                <Ionicons name="logo-whatsapp" size={18} color={colors.forest} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactValue}>{support.whatsapp}</Text>
                  <Text style={styles.hint}>Message on WhatsApp</Text>
                </View>
              </Pressable>
            ) : null}
            {support?.email ? (
              <Pressable style={[styles.contactRow, styles.last]} onPress={() => mail(support.email)}>
                <Ionicons name="mail-outline" size={18} color={colors.forest} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactValue}>{support.email}</Text>
                  <Text style={styles.hint}>{support.hours ?? "Email support"}</Text>
                </View>
              </Pressable>
            ) : null}
          </View>
        )}

        <Text style={styles.version}>Uzhavan v{APP_VERSION}</Text>
      </ScrollView>
    </Screen>
  );
}

// ── All my tickets ──────────────────────────────────────────────

export function MyTickets() {
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const tickets = useTickets();
  const rows = tickets.data ?? [];

  return (
    <Screen>
      <AppHeader title="My issues" />
      <ScrollView contentContainerStyle={styles.pad}>
        {tickets.isLoading ? (
          <ActivityIndicator color={colors.forest} style={{ marginTop: 40 }} />
        ) : rows.length === 0 ? (
          <Text style={styles.empty}>
            You haven’t raised anything yet. If something goes wrong with an order, tell us here.
          </Text>
        ) : (
          rows.map((t) => (
            <Pressable
              key={t.id}
              style={styles.card}
              onPress={() => navigation.navigate("TicketDetail", { code: t.code })}
            >
              <View style={styles.between}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {t.subject}
                </Text>
                <Chip label={TICKET_LABEL[t.status]} tone={TONE[t.status]} />
              </View>
              <Text style={styles.faint}>
                {t.code} · {ago(t.updatedAt)}
                {t.assignedTo ? ` · ${t.assignedTo.name}` : ""}
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

// ── Raise a ticket ──────────────────────────────────────────────

const CATEGORIES: { key: TicketCategory; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "ORDER", label: "An order", icon: "cube-outline" },
  { key: "PAYMENT", label: "Payment", icon: "cash-outline" },
  { key: "DELIVERY", label: "Delivery", icon: "car-outline" },
  { key: "VERIFICATION", label: "Verification", icon: "shield-checkmark-outline" },
  { key: "ACCOUNT", label: "My account", icon: "person-outline" },
  { key: "APP_ISSUE", label: "App problem", icon: "bug-outline" },
  { key: "OTHER", label: "Something else", icon: "ellipsis-horizontal" },
];

export function NewTicket() {
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const raise = useRaiseTicket();
  const [category, setCategory] = useState<TicketCategory | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [orderCode, setOrderCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const send = async () => {
    if (!category) return setError("Pick what this is about");
    if (subject.trim().length < 5) return setError("Give it a short title");
    if (message.trim().length < 10) return setError("Tell us a bit more so we can help");

    setWorking(true);
    setError(null);
    try {
      const t = await raise.mutateAsync({
        category,
        subject: subject.trim(),
        message: message.trim(),
        orderCode: orderCode.trim() || undefined,
      });
      navigation.replace("TicketDetail", { code: t.code });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t send. Check your connection.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen
        footer={<PrimaryButton label="Send to support" onPress={send} loading={working} disabled={working} />}
      >
        <AppHeader title="Raise an issue" />
        <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          <Text style={styles.section}>What’s this about?</Text>
          <View style={styles.chips}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c.key}
                onPress={() => setCategory(c.key)}
                style={[styles.catChip, category === c.key && styles.catChipOn]}
              >
                <Ionicons
                  name={c.icon}
                  size={15}
                  color={category === c.key ? colors.white : colors.forest}
                />
                <Text style={[styles.catText, category === c.key && { color: colors.white }]}>
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={{ marginTop: 22 }}>
            <Field
              label="Short title"
              value={subject}
              onChangeText={setSubject}
              placeholder="Driver hasn't arrived at the farm"
            />
          </View>

          <View style={{ marginTop: 14 }}>
            <Field
              label="What happened?"
              value={message}
              onChangeText={setMessage}
              placeholder="Give us the details — dates, names, anything that helps."
              multiline
            />
          </View>

          <View style={{ marginTop: 14 }}>
            <Field
              label="Order number (optional)"
              value={orderCode}
              onChangeText={setOrderCode}
              placeholder="UZH-ORD-4K2PX"
              autoCapitalize="characters"
            />
          </View>

          <View style={{ marginTop: 16 }}>
            <InfoNote>
              <Ionicons name="time-outline" size={16} color={colors.forest} />
              <Text style={{ flex: 1, color: colors.forest, fontSize: 12.5 }}>
                Someone is assigned as soon as you send this. If they haven’t replied within a day,
                it’s escalated automatically.
              </Text>
            </InfoNote>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}

// ── Ticket thread ───────────────────────────────────────────────

export function TicketDetail() {
  const { code } = useRoute<RouteProp<{ p: { code: string } }, "p">>().params;
  const { user } = useAuth();
  const thread = useTicket(code);
  const reply = useReplyToTicket(code);
  const [text, setText] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = thread.data;

  const send = async () => {
    if (!text.trim()) return;
    setWorking(true);
    setError(null);
    try {
      await reply.mutateAsync(text.trim());
      setText("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t send.");
    } finally {
      setWorking(false);
    }
  };

  if (!t) {
    return (
      <Screen>
        <AppHeader title={code} />
        <ActivityIndicator color={colors.forest} style={{ marginTop: 48 }} />
      </Screen>
    );
  }

  const closed = t.status === "CLOSED";

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen
        footer={
          closed ? undefined : (
            <View style={styles.replyRow}>
              <View style={{ flex: 1 }}>
                <Field
                  label=""
                  value={text}
                  onChangeText={setText}
                  placeholder="Write a reply…"
                  multiline
                />
              </View>
              <Pressable
                style={[styles.send, (!text.trim() || working) && { opacity: 0.4 }]}
                disabled={!text.trim() || working}
                onPress={send}
              >
                {working ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Ionicons name="send" size={17} color={colors.white} />
                )}
              </Pressable>
            </View>
          )
        }
      >
        <AppHeader title={t.code} />
        <ScrollView contentContainerStyle={styles.pad}>
          <Text style={styles.threadSubject}>{t.subject}</Text>
          <View style={[styles.row, { marginTop: 8 }]}>
            <Chip label={TICKET_LABEL[t.status]} tone={TONE[t.status]} />
            {t.assignedTo ? <Text style={styles.faint}>with {t.assignedTo.name}</Text> : null}
          </View>

          <View style={{ marginTop: 20, gap: 10 }}>
            {t.messages.map((m) => {
              const mine = m.author.id === user?.id;
              return (
                <View key={m.id} style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                  <Text style={styles.author}>
                    {mine ? "You" : m.author.name} · {ago(m.createdAt)}
                  </Text>
                  <Text style={styles.body}>{m.body}</Text>
                </View>
              );
            })}
          </View>

          {t.status === "RESOLVED" ? (
            <View style={{ marginTop: 18 }}>
              <InfoNote>
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.forest} />
                <Text style={{ flex: 1, color: colors.forest, fontSize: 12.5 }}>
                  Marked resolved. Reply below if it’s still a problem.
                </Text>
              </InfoNote>
            </View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 32 },
  lead: { fontSize: 13.5, lineHeight: 20, color: colors.muted },
  section: { marginTop: 24, marginBottom: 10, fontSize: 13, fontWeight: "600", color: colors.forest },
  hint: { fontSize: 12, color: colors.muted, marginTop: 1 },
  faint: { marginTop: 4, fontSize: 12, color: colors.faint },
  empty: { marginTop: 40, textAlign: "center", fontSize: 13.5, lineHeight: 20, color: colors.muted },
  error: { marginTop: 16, fontSize: 13, color: colors.danger },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },

  cta: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.forest,
    borderRadius: 16,
    padding: 15,
  },
  ctaIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#ffffff2e",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaTitle: { fontSize: 15, fontWeight: "600", color: colors.white },
  ctaSub: { marginTop: 2, fontSize: 12, color: "#ffffffcc" },

  card: { marginTop: 10, backgroundColor: colors.white, borderRadius: 14, padding: 13, ...shadow },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.ink },

  linkRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },
  linkText: { flex: 1, fontSize: 13.5, fontWeight: "600", color: colors.forest },

  contactCard: { backgroundColor: colors.white, borderRadius: 16, overflow: "hidden", ...shadow },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  last: { borderBottomWidth: 0 },
  contactValue: { fontSize: 14, fontWeight: "600", color: colors.ink },
  version: { marginTop: 26, textAlign: "center", fontSize: 11.5, color: colors.faint },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  catChipOn: { backgroundColor: colors.forest, borderColor: colors.forest },
  catText: { fontSize: 13, fontWeight: "500", color: colors.ink },

  threadSubject: { fontSize: 17, fontWeight: "600", color: colors.ink, lineHeight: 23 },
  bubble: { maxWidth: "88%", borderRadius: 14, paddingHorizontal: 13, paddingVertical: 10 },
  mine: { alignSelf: "flex-end", backgroundColor: colors.mint },
  theirs: { alignSelf: "flex-start", backgroundColor: colors.white, ...shadow },
  author: { fontSize: 11, fontWeight: "700", color: colors.muted, marginBottom: 3 },
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
