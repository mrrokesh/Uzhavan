import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppHeader, Screen } from "../../components/Chrome";
import { Chip, Field, InfoNote, PrimaryButton } from "../../components/ui";
import { useAddPayoutAccount, usePayouts } from "../../api/hooks";
import { ApiError } from "../../lib/api";
import { inr, kg } from "../../lib/format";
import { colors, shadow } from "../../theme";
import type { Payout, PayoutState } from "../../api/types";

const TONE: Record<PayoutState, "mint" | "amber" | "neutral"> = {
  PAID: "mint",
  RELEASED: "mint",
  HELD: "amber",
  FAILED: "neutral",
  CANCELLED: "neutral",
};

const LABEL: Record<PayoutState, string> = {
  PAID: "In your account",
  RELEASED: "On its way",
  HELD: "Waiting",
  FAILED: "Couldn’t send",
  CANCELLED: "Cancelled",
};

function due(p: Payout): string {
  if (p.state === "PAID") return "Paid";
  if (p.state === "RELEASED") return "Sent to your bank";
  if (p.state !== "HELD") return "";
  if (!p.releaseAfter) return "Once the driver picks up the load";
  const at = new Date(p.releaseAfter);
  if (at <= new Date()) return "Due now";
  const hours = Math.ceil((at.getTime() - Date.now()) / 3600000);
  return hours < 24 ? `In about ${hours}h` : `In about ${Math.ceil(hours / 24)} days`;
}

export function FarmerPayouts() {
  const ledger = usePayouts();
  const addAccount = useAddPayoutAccount();

  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const d = ledger.data;

  const save = async () => {
    setWorking(true);
    setError(null);
    try {
      await addAccount.mutateAsync({
        accountNumber: accountNumber.trim(),
        ifsc: ifsc.trim().toUpperCase(),
        beneficiaryName: name.trim(),
      });
      setAccountNumber("");
      setIfsc("");
      setName("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t save those details.");
    } finally {
      setWorking(false);
    }
  };

  if (ledger.isLoading) {
    return (
      <Screen>
        <AppHeader title="Your money" />
        <ActivityIndicator color={colors.forest} style={{ marginTop: 48 }} />
      </Screen>
    );
  }

  // ── No bank account yet ──────────────────────────────────────
  if (d && !d.account) {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Screen
          footer={
            <PrimaryButton
              label="Save bank details"
              onPress={save}
              loading={working}
              disabled={working || !accountNumber.trim() || !ifsc.trim() || !name.trim()}
            />
          }
        >
          <AppHeader title="Where should we pay you?" />
          <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
            <Text style={styles.lead}>
              Buyers pay Uzhavan up front. To pass your share on we need the account it should land
              in.
            </Text>

            <Text style={styles.section}>Your bank account</Text>
            <Field
              label="Account number"
              value={accountNumber}
              onChangeText={setAccountNumber}
              placeholder="00000000000"
              keyboardType="number-pad"
            />
            <View style={{ marginTop: 14 }}>
              <Field
                label="IFSC code"
                value={ifsc}
                onChangeText={setIfsc}
                placeholder="SBIN0001234"
                autoCapitalize="characters"
              />
            </View>
            <View style={{ marginTop: 14 }}>
              <Field
                label="Name on the account"
                value={name}
                onChangeText={setName}
                placeholder="As printed in your passbook"
              />
            </View>
            <Text style={styles.hint}>
              The name has to match your passbook exactly, or the bank will send the money back.
            </Text>

            <View style={{ marginTop: 16 }}>
              <InfoNote>
                <Ionicons name="lock-closed-outline" size={16} color={colors.forest} />
                <Text style={{ flex: 1, color: colors.forest, fontSize: 12.5 }}>
                  These go straight to our payment provider. Uzhavan never stores your account
                  number.
                </Text>
              </InfoNote>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>
        </Screen>
      </KeyboardAvoidingView>
    );
  }

  const rows = d?.payouts ?? [];

  return (
    <Screen>
      <AppHeader title="Your money" />
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={styles.totals}>
          <View style={styles.total}>
            <Text style={styles.totalLabel}>On the way</Text>
            <Text style={styles.totalValue}>{inr(d?.owed ?? 0)}</Text>
          </View>
          <View style={styles.total}>
            <Text style={styles.totalLabel}>Received</Text>
            <Text style={styles.totalValue}>{inr(d?.received ?? 0)}</Text>
          </View>
        </View>

        <View style={styles.policy}>
          <Ionicons name="information-circle-outline" size={16} color={colors.forest} />
          <Text style={styles.policyText}>
            {d?.policy === "SPLIT_ON_LOAD"
              ? `You get ${d.advancePercent}% as soon as the driver picks up your crop, and the rest about ${d.holdHours} hours after it's delivered.`
              : `You're paid about ${d?.holdHours ?? 48} hours after the crop is delivered.`}
          </Text>
        </View>

        {d?.account && !d.account.ready ? (
          <View style={{ marginTop: 12 }}>
            <InfoNote tone="amber">
              <Ionicons name="hourglass-outline" size={16} color={colors.amberText} />
              <Text style={{ flex: 1, color: colors.amberText, fontSize: 12.5 }}>
                Your bank account is still being checked. Money owed to you is safe and will go out
                once it's ready.
              </Text>
            </InfoNote>
          </View>
        ) : null}

        {rows.length === 0 ? (
          <Text style={styles.empty}>
            Nothing yet. When a buyer pays for one of your crops, their money appears here and moves
            to your bank as the load travels.
          </Text>
        ) : null}

        {rows.map((p) => (
          <View key={p.id} style={styles.card}>
            <View style={styles.between}>
              <Text style={styles.cardTitle}>{p.stageLabel}</Text>
              <Chip label={LABEL[p.state]} tone={TONE[p.state]} />
            </View>
            <Text style={styles.amount}>{inr(p.amount)}</Text>
            {p.order ? (
              <Text style={styles.muted}>
                {kg(p.order.quantityKg)} {p.order.product} · {p.order.code}
              </Text>
            ) : null}
            <Text style={styles.faint}>{due(p)}</Text>
            {p.failureReason ? <Text style={styles.error}>{p.failureReason}</Text> : null}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 32 },
  lead: { fontSize: 13.5, lineHeight: 20, color: colors.muted },
  section: { marginTop: 24, marginBottom: 10, fontSize: 13, fontWeight: "600", color: colors.forest },
  hint: { marginTop: 10, fontSize: 12, lineHeight: 17, color: colors.muted },
  totals: { flexDirection: "row", gap: 12 },
  total: { flex: 1, backgroundColor: colors.white, borderRadius: 16, padding: 14, ...shadow },
  totalLabel: { fontSize: 12, color: colors.muted },
  totalValue: { marginTop: 4, fontSize: 20, fontWeight: "700", color: colors.forest },
  policy: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
    backgroundColor: colors.mint,
    borderRadius: 14,
    padding: 12,
  },
  policyText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: colors.forest },
  card: { marginTop: 10, backgroundColor: colors.white, borderRadius: 16, padding: 14, ...shadow },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.ink },
  amount: { marginTop: 6, fontSize: 20, fontWeight: "700", color: colors.forest },
  muted: { marginTop: 4, fontSize: 12.5, color: colors.muted },
  faint: { marginTop: 6, fontSize: 11.5, color: colors.faint },
  empty: { marginTop: 32, textAlign: "center", fontSize: 13.5, lineHeight: 20, color: colors.muted },
  error: { marginTop: 10, fontSize: 12.5, color: colors.danger },
});
