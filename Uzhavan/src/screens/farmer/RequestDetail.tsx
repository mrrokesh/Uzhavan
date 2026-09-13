import { useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { AppHeader, Screen } from "../../components/Chrome";
import { Chip, Divider, Field, InfoNote, OutlineButton, PrimaryButton, Row } from "../../components/ui";
import { useFarmerRequests, useRespondToRequest } from "../../api/hooks";
import { imageFor } from "../../lib/images";
import { ApiError } from "../../lib/api";
import { inr, kg } from "../../lib/format";
import { REQUEST_LABEL } from "../../api/types";
import type { FarmerStackParamList } from "../../navigation/types";
import { colors, shadow } from "../../theme";

export function FarmerRequestDetail() {
  const navigation = useNavigation();
  const { requestId } = useRoute<RouteProp<FarmerStackParamList, "FarmerRequestDetail">>().params;
  const requests = useFarmerRequests();
  const respond = useRespondToRequest();

  const request = useMemo(
    () => requests.data?.find((r) => r.id === requestId),
    [requests.data, requestId],
  );

  const [price, setPrice] = useState("");
  const [reason, setReason] = useState("");
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  if (requests.isLoading || !request) {
    return (
      <Screen>
        <AppHeader title="Request" />
        {requests.isLoading ? (
          <ActivityIndicator color={colors.forest} style={{ marginTop: 48 }} />
        ) : (
          <Text style={styles.empty}>This request is no longer available.</Text>
        )}
      </Screen>
    );
  }

  const crop = request.crop;
  const listPrice = crop?.pricePerKg ?? 0;
  const finalPrice = Number(price) || listPrice;
  const pending = request.status === "PENDING";

  const act = async (action: "accept" | "decline") => {
    setWorking(true);
    setError(null);
    try {
      await respond.mutateAsync({
        id: request.id,
        action,
        finalPricePerKg: action === "accept" ? finalPrice : undefined,
        reason: action === "decline" ? reason.trim() || undefined : undefined,
      });
      navigation.goBack();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t send your response.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <Screen
      footer={
        pending ? (
          declining ? (
            <>
              <PrimaryButton label="Send decline" onPress={() => act("decline")} loading={working} disabled={working} />
              <OutlineButton label="Back" onPress={() => setDeclining(false)} />
            </>
          ) : (
            <>
              <PrimaryButton
                label={`Accept at ${inr(finalPrice)}/kg · ${inr(finalPrice * request.quantityKg)}`}
                onPress={() => act("accept")}
                loading={working}
                disabled={working}
              />
              <OutlineButton label="Decline request" tone="danger" onPress={() => setDeclining(true)} />
            </>
          )
        ) : undefined
      }
    >
      <AppHeader title="Buyer request" />
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        {!pending ? (
          <View style={{ marginBottom: 12 }}>
            <Chip label={REQUEST_LABEL[request.status]} tone={request.status === "CONFIRMED" ? "mint" : "neutral"} />
          </View>
        ) : null}

        <View style={styles.cropCard}>
          <Image source={imageFor(crop?.imageKey)} style={styles.cropImg} />
          <View style={{ flex: 1 }}>
            <Text style={styles.cropTitle}>{crop?.title}</Text>
            <Text style={styles.muted}>
              {inr(listPrice)}/kg listed · {crop?.grade}
            </Text>
            <Text style={styles.muted}>
              {kg(Math.max(0, (crop?.expectedKg ?? 0) - (crop?.reservedKg ?? 0)))} still unreserved
            </Text>
          </View>
        </View>

        <View style={styles.buyer}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={20} color={colors.forest} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.buyerName}>{request.buyer?.business ?? request.buyer?.name}</Text>
            <Text style={styles.muted}>
              {request.buyer?.name} · {request.buyer?.district}
            </Text>
          </View>
          <Text style={styles.phone}>{request.buyer?.phone}</Text>
        </View>

        <View style={styles.list}>
          <Row label="Request ID" value={request.code} strong />
          <Divider />
          <Row label="Requested quantity" value={kg(request.quantityKg)} strong />
          <Divider />
          <Row label="At your listed price" value={inr(request.estimatedValue)} />
          {request.finalPricePerKg ? (
            <>
              <Divider />
              <Row label="You accepted at" value={`${inr(request.finalPricePerKg)}/kg`} green />
            </>
          ) : null}
        </View>

        {pending && !declining ? (
          <>
            <Text style={styles.section}>Set your final price</Text>
            <Field
              label="Price per kg (₹)"
              value={price}
              onChangeText={setPrice}
              placeholder={String(listPrice)}
              keyboardType="number-pad"
            />
            <Text style={styles.hint}>
              Leave blank to accept at your listed {inr(listPrice)}/kg. The buyer sees this as the final
              price and confirms before the order is created.
            </Text>
            <View style={styles.previewCard}>
              <Text style={styles.muted}>Buyer will pay</Text>
              <Text style={styles.big}>{inr(finalPrice * request.quantityKg)}</Text>
              <Text style={styles.muted}>
                {kg(request.quantityKg)} × {inr(finalPrice)}/kg
              </Text>
            </View>
          </>
        ) : null}

        {pending && declining ? (
          <>
            <Text style={styles.section}>Why are you declining?</Text>
            <Field
              label="Reason (optional)"
              value={reason}
              onChangeText={setReason}
              placeholder="Quantity already committed elsewhere"
            />
            <Text style={styles.hint}>The buyer sees this, so they know whether to ask again later.</Text>
          </>
        ) : null}

        {request.status === "FARMER_ACCEPTED" ? (
          <View style={{ marginTop: 16 }}>
            <InfoNote tone="amber">
              <Ionicons name="time-outline" size={16} color={colors.amberText} />
              <Text style={{ flex: 1, color: colors.amberText, fontSize: 12.5 }}>
                Waiting for the buyer to confirm. The quantity isn’t reserved until they do.
              </Text>
            </InfoNote>
          </View>
        ) : null}

        {request.status === "CONFIRMED" ? (
          <View style={{ marginTop: 16 }}>
            <InfoNote>
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.forest} />
              <Text style={{ flex: 1, color: colors.forest, fontSize: 12.5 }}>
                Confirmed — {kg(request.quantityKg)} is reserved from this listing.
              </Text>
            </InfoNote>
          </View>
        ) : null}

        {request.declineReason ? <Text style={styles.hint}>Reason given: {request.declineReason}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 32 },
  empty: { marginTop: 48, textAlign: "center", fontSize: 13.5, color: colors.muted },
  cropCard: { flexDirection: "row", gap: 12, backgroundColor: colors.white, borderRadius: 16, padding: 12, ...shadow },
  cropImg: { width: 64, height: 64, borderRadius: 12 },
  cropTitle: { fontSize: 16, fontWeight: "600", color: colors.ink },
  muted: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  buyer: { marginTop: 12, flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: colors.white, borderRadius: 16, padding: 12, ...shadow },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
  buyerName: { fontSize: 14.5, fontWeight: "600", color: colors.ink },
  phone: { fontSize: 12, fontWeight: "600", color: colors.forest },
  list: { marginTop: 12, backgroundColor: colors.white, borderRadius: 16, paddingHorizontal: 16, ...shadow },
  section: { marginTop: 24, marginBottom: 10, fontSize: 13, fontWeight: "600", color: colors.forest },
  hint: { marginTop: 10, fontSize: 12, lineHeight: 17, color: colors.muted },
  previewCard: { marginTop: 16, backgroundColor: colors.mint, borderRadius: 16, padding: 16 },
  big: { marginTop: 4, fontSize: 26, fontWeight: "700", color: colors.forest },
  error: { marginTop: 16, fontSize: 13, color: colors.danger },
});
