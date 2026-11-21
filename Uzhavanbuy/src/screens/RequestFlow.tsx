import { useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppHeader, Screen } from "../components/Chrome";
import { SuccessMark } from "../components/Logo";
import { Chip, Divider, InfoNote, OutlineButton, PrimaryButton, Row } from "../components/ui";
import { CropSummary, Stepper, Tracker } from "../components/Widgets";
import { useCrop, useCreateRequest, useRequest, useRequestAction, useUpdateRequest } from "../api/hooks";
import { REQUEST_LABEL } from "../api/types";
import { cropImage, imageFor } from "../lib/images";
import { ApiError } from "../lib/api";
import { inr, kg, pct } from "../lib/format";
import type { RootStackParamList } from "../navigation/types";
import { colors, shadow } from "../theme";

export function SelectQuantity() {
  const { id, editingRequestId } = useRoute<RouteProp<RootStackParamList, "SelectQuantity">>().params;
  const crop = useCrop(id).data;
  // Only fetched when editing, so the field can start at what was already
  // requested rather than snapping back to the minimum order.
  const editing = useRequest(editingRequestId);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [quantity, setQuantity] = useState<number | null>(null);

  if (!crop || (editingRequestId && editing.isLoading)) {
    return (
      <Screen>
        <AppHeader title={editingRequestId ? "Edit quantity" : "Select quantity"} />
        <ActivityIndicator color={colors.forest} style={{ marginTop: 48 }} />
      </Screen>
    );
  }

  // Editing a request doesn't reserve anything until it's confirmed, so the
  // crop's own free stock is the honest ceiling — same rule the server checks.
  const editCeiling = editingRequestId ? crop.availableKg + (editing.data?.quantityKg ?? 0) : crop.availableKg;
  const qty =
    quantity ?? (editingRequestId ? (editing.data?.quantityKg ?? crop.minOrderKg) : Math.min(crop.minOrderKg, crop.availableKg));
  const share = pct(qty, crop.expectedKg || editCeiling);
  const value = qty * crop.pricePerKg;
  const presets = [crop.minOrderKg, crop.minOrderKg * 2, crop.minOrderKg * 4].filter(
    (p) => p <= editCeiling,
  );

  return (
    <Screen
      footer={
        <PrimaryButton
          label={editingRequestId ? "Review change" : "Review request"}
          onPress={() =>
            navigation.navigate("ReviewRequest", { id: crop.id, quantityKg: qty, editingRequestId })
          }
        />
      }
    >
      <AppHeader title={editingRequestId ? "Edit quantity" : "Select quantity"} />
      <ScrollView contentContainerStyle={styles.pad}>
        <CropSummary crop={crop} />
        <Text style={styles.section}>Availability</Text>
        <View style={styles.availLine}>
          <Ionicons name="cube-outline" size={16} color={colors.muted} />
          <Text style={styles.muted}>{kg(crop.expectedKg)} expected</Text>
        </View>
        <View style={styles.availLine}>
          <Ionicons name="bag-handle-outline" size={16} color={colors.muted} />
          <Text style={styles.muted}>Minimum order {kg(crop.minOrderKg)}</Text>
        </View>

        <View style={{ marginTop: 22 }}>
          <Text style={styles.section}>Select quantity</Text>
          <Stepper
            value={qty}
            onDec={() => setQuantity(Math.max(crop.minOrderKg, qty - 100))}
            onInc={() => setQuantity(Math.min(editCeiling, qty + 100))}
          />
          <View style={styles.picks}>
            {presets.map((p) => (
              <Chip key={p} label={kg(p)} active={qty === p} onPress={() => setQuantity(p)} />
            ))}
          </View>
          <View style={styles.barBg}>
            <View style={[styles.bar, { width: `${share}%` }]} />
          </View>
          <Text style={styles.centerMuted}>{share}% of available quantity</Text>
        </View>

        <View style={styles.valueCard}>
          <Text style={styles.muted}>Estimated value</Text>
          <Text style={styles.bigMoney}>{inr(value)}</Text>
          <Text style={styles.muted}>{inr(crop.pricePerKg)}/kg</Text>
          <View style={styles.infoLine}>
            <Ionicons name="information-circle-outline" size={14} color={colors.muted} />
            <Text style={styles.muted}>Final price confirmed by farmer.</Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

export function ReviewRequest() {
  const { id, quantityKg, editingRequestId } =
    useRoute<RouteProp<RootStackParamList, "ReviewRequest">>().params;
  const crop = useCrop(id).data;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const create = useCreateRequest();
  const update = useUpdateRequest();
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (!crop) {
    return (
      <Screen>
        <AppHeader title="Review request" />
        <ActivityIndicator color={colors.forest} style={{ marginTop: 48 }} />
      </Screen>
    );
  }

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      if (editingRequestId) {
        await update.mutateAsync({ id: editingRequestId, quantityKg });
        navigation.replace("RequestDetails", { requestId: editingRequestId });
      } else {
        const request = await create.mutateAsync({ cropId: crop.id, quantityKg });
        navigation.replace("RequestSent", { requestId: request.id });
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : editingRequestId
            ? "Couldn’t save the change."
            : "Couldn’t send your request.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen
      footer={
        <>
          <PrimaryButton
            label={editingRequestId ? "Save new quantity" : "Send request to farmer"}
            onPress={send}
            loading={sending}
            disabled={sending}
          />
          {error ? <Text style={styles.danger}>{error}</Text> : null}
        </>
      }
    >
      <AppHeader title={editingRequestId ? "Confirm change" : "Review request"} />
      <ScrollView contentContainerStyle={styles.pad}>
        <CropSummary crop={crop} />
        <View style={styles.list}>
          <Row label="Requested quantity" value={kg(quantityKg)} strong />
          <Divider />
          <Row label="Estimated value" value={inr(quantityKg * crop.pricePerKg)} strong />
          <Divider />
          <Row label="Expected harvest" value={crop.harvestDate} />
          <Divider />
          <Row label="Pickup" value={crop.location} />
        </View>
        <Hint icon="bus-outline" title="Book a truck after the farmer accepts." />
        <Hint icon="shield-checkmark-outline" title="No payment will be collected now." />
      </ScrollView>
    </Screen>
  );
}

export function RequestSent() {
  const { requestId } = useRoute<RouteProp<RootStackParamList, "RequestSent">>().params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const request = useRequest(requestId).data;

  return (
    <Screen
      footer={
        <>
          <PrimaryButton label="Track request" onPress={() => navigation.replace("RequestDetails", { requestId })} />
          <Pressable onPress={() => navigation.navigate("Tabs")}>
            <Text style={styles.textLink}>Back to Home</Text>
          </Pressable>
        </>
      }
    >
      <ScrollView contentContainerStyle={[styles.pad, { alignItems: "center", paddingTop: 32 }]}>
        <SuccessMark />
        <Text style={styles.h1}>Request sent!</Text>
        <Text style={styles.sub}>
          Your request for {kg(request?.quantityKg ?? 0)} has been sent to {request?.crop?.farm.name}.
        </Text>
        <View style={{ marginTop: 16 }}>
          <Chip label="Awaiting farmer confirmation" tone="amber" />
        </View>
        <View style={[styles.list, { width: "100%", marginTop: 20 }]}>
          <Row label="Request ID" value={request?.code ?? "—"} strong />
          <Divider />
          <Row label="Product" value={request?.crop?.title ?? "—"} />
          <Divider />
          <Row label="Requested quantity" value={kg(request?.quantityKg ?? 0)} />
          <Divider />
          <Row label="Estimated value" value={inr(request?.estimatedValue ?? 0)} />
          <Divider />
          <Row label="Expected harvest" value={request?.crop?.harvestDate ?? "—"} />
        </View>
        <View style={{ width: "100%", marginTop: 16 }}>
          <InfoNote>
            <Ionicons name="time-outline" size={16} color={colors.forest} />
            <Text style={{ flex: 1, color: colors.forest, fontSize: 12.5 }}>
              {request?.crop?.farm.name ?? "The farm"} usually responds within 6 hours.
            </Text>
          </InfoNote>
        </View>
      </ScrollView>
    </Screen>
  );
}

/**
 * The buyer's live view of one request. It polls, so the moment the real farmer
 * accepts or declines in their own app, this screen changes.
 */
export function RequestDetails() {
  const { requestId } = useRoute<RouteProp<RootStackParamList, "RequestDetails">>().params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const query = useRequest(requestId, true);
  const action = useRequestAction();
  const [working, setWorking] = useState(false);

  const request = query.data;

  if (!request) {
    return (
      <Screen>
        <AppHeader title="Request details" />
        <ActivityIndicator color={colors.forest} style={{ marginTop: 48 }} />
      </Screen>
    );
  }

  const crop = request.crop;
  const accepted = request.status === "FARMER_ACCEPTED";
  const pending = request.status === "PENDING";
  const closed = ["FARMER_DECLINED", "BUYER_DECLINED", "CANCELLED"].includes(request.status);
  const finalPrice = request.finalPricePerKg ?? crop?.pricePerKg ?? 0;

  const cancel = async () => {
    setWorking(true);
    try {
      await action.mutateAsync({ id: request.id, action: "cancel" });
    } finally {
      setWorking(false);
    }
  };

  return (
    <Screen
      footer={
        accepted ? (
          <PrimaryButton
            label="Review & confirm"
            onPress={() => navigation.navigate("ConfirmPurchase", { requestId: request.id })}
          />
        ) : request.status === "CONFIRMED" && request.order ? (
          <PrimaryButton
            label="Book a truck"
            onPress={() => navigation.navigate("BookTruckOrder", { orderId: request.order!.id })}
          />
        ) : undefined
      }
    >
      <AppHeader title={accepted ? "Request update" : "Request details"} />
      <ScrollView contentContainerStyle={styles.pad}>
        {pending ? (
          <View style={styles.bannerAmber}>
            <Ionicons name="time-outline" size={18} color={colors.amberText} />
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerAmberTitle}>Awaiting farmer confirmation</Text>
              <Text style={styles.bannerAmberSub}>
                The farmer is reviewing your requested quantity and final price.
              </Text>
            </View>
          </View>
        ) : null}

        {accepted ? (
          <View style={styles.accept}>
            <View style={styles.check}>
              <Ionicons name="checkmark" size={16} color={colors.forest} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.acceptTitle}>Farmer accepted your request</Text>
              <Text style={styles.acceptSub}>
                {crop?.farm.name} accepted your request for {kg(request.quantityKg)}.
              </Text>
            </View>
          </View>
        ) : null}

        {request.status === "FARMER_DECLINED" ? (
          <InfoNote tone="amber">
            <Ionicons name="close-circle-outline" size={16} color={colors.amberText} />
            <Text style={{ flex: 1, color: colors.amberText, fontSize: 12.5 }}>
              {crop?.farm.name} declined this request
              {request.declineReason ? ` — ${request.declineReason}` : "."}
            </Text>
          </InfoNote>
        ) : null}

        {closed && request.status !== "FARMER_DECLINED" ? (
          <View style={{ flexDirection: "row" }}>
            <Chip label={REQUEST_LABEL[request.status]} />
          </View>
        ) : null}

        {accepted ? (
          <View style={styles.list}>
            <Text style={styles.blockTitle}>Accepted offer summary</Text>
            <Row label="Accepted quantity" value={kg(request.quantityKg)} strong />
            <Divider />
            <Row label="Final price" value={`${inr(finalPrice)}/kg`} strong />
            <Divider />
            <Row label="Order value" value={inr(finalPrice * request.quantityKg)} strong />
            <Divider />
            <Row label="Pickup from" value={crop?.harvestDate ?? "—"} />
          </View>
        ) : null}

        {accepted ? (
          <View style={[styles.bannerAmber, { marginTop: 12 }]}>
            <Ionicons name="time-outline" size={16} color={colors.amberText} />
            <Text style={styles.bannerAmberSub}>Confirm to reserve this quantity.</Text>
          </View>
        ) : null}

        <View style={{ marginTop: 20 }}>
          <Tracker
            steps={
              accepted
                ? [
                    { title: "1. Request sent", meta: clock(request.createdAt) || request.code, state: "done" },
                    { title: "2. Farmer accepted", meta: clock(request.respondedAt) || "Accepted", state: "done" },
                    { title: "3. Buyer confirmation", meta: "Current", state: "current" },
                    { title: "4. Transport selection", meta: "Pending", state: "pending" },
                  ]
                : [
                    { title: "1. Request sent", meta: clock(request.createdAt) || "Sent", state: "done" },
                    {
                      title: "2. Farmer reviewing",
                      meta: pending ? "In progress" : closed ? "Closed" : "Responded",
                      state: pending ? "current" : closed ? "pending" : "done",
                    },
                    {
                      title: "3. Quantity reserved",
                      meta: request.status === "CONFIRMED" ? "Reserved" : "Pending",
                      state: request.status === "CONFIRMED" ? "done" : "pending",
                    },
                    {
                      title: "4. Payment pending",
                      meta: request.order ? "Choose a truck" : "Pending",
                      state: request.order ? "current" : "pending",
                    },
                  ]
            }
          />
        </View>

        <View style={styles.mini}>
          <Image source={crop ? cropImage(crop) : imageFor(undefined)} style={styles.miniImg} />
          <View style={{ flex: 1 }}>
            <Text style={styles.farm}>{crop?.title}</Text>
            <Text style={styles.muted}>{kg(request.quantityKg)}</Text>
            <Text style={styles.faint}>{accepted ? "Accepted quantity" : "Requested quantity"}</Text>
          </View>
          <View>
            <Text style={styles.green}>{inr(finalPrice * request.quantityKg)}</Text>
            <Text style={styles.muted}>{accepted || request.status === "CONFIRMED" ? "Order value" : "Estimated"}</Text>
          </View>
        </View>

        <View style={styles.mini}>
          <Image source={imageFor(crop?.farm.avatarKey)} style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.farm}>
              {crop?.farm.name} <Text style={{ color: colors.blueTick }}>✓</Text>
            </Text>
            <Text style={styles.muted}>{crop?.farm.ownerName}</Text>
            <Text style={styles.muted}>{crop?.farm.district}</Text>
          </View>
          {crop ? (
            <Pressable
              style={styles.viewFarmer}
              onPress={() => navigation.navigate("FarmerProfile", { farmId: crop.farmId, cropId: crop.id })}
            >
              <Text style={styles.link}>View farmer</Text>
            </Pressable>
          ) : null}
        </View>

        {pending ? (
          <>
            <InfoNote>
              <Ionicons name="information-circle-outline" size={16} color={colors.forest} />
              <Text style={{ flex: 1, color: colors.forest, fontSize: 12.5 }}>
                We’ll notify you when the farmer confirms the quantity and final price.
              </Text>
            </InfoNote>
            <View style={styles.two}>
              <OutlineButton
                label="Edit request"
                icon="pencil-outline"
                onPress={() =>
                  crop &&
                  navigation.navigate("SelectQuantity", { id: crop.id, editingRequestId: request.id })
                }
              />
              <OutlineButton
                label={working ? "Cancelling…" : "Cancel request"}
                icon="trash-outline"
                tone="danger"
                onPress={cancel}
              />
            </View>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Hint({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View style={styles.hint}>
      <Ionicons name={icon} size={18} color={colors.forest} />
      <Text style={styles.hintText}>{title}</Text>
    </View>
  );
}

function clock(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 24 },
  section: { marginTop: 18, marginBottom: 8, fontSize: 13, fontWeight: "700", color: colors.ink },
  availLine: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  infoLine: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 4 },
  muted: { fontSize: 13, color: colors.muted },
  picks: { marginTop: 16, flexDirection: "row", justifyContent: "center", gap: 8 },
  barBg: { marginTop: 20, height: 6, borderRadius: 99, backgroundColor: colors.line, overflow: "hidden" },
  bar: { height: "100%", backgroundColor: colors.forest },
  centerMuted: { marginTop: 6, textAlign: "center", fontSize: 12, color: colors.muted },
  valueCard: { marginTop: 20, backgroundColor: colors.white, borderRadius: 16, padding: 16, ...shadow },
  bigMoney: { marginTop: 4, fontSize: 28, fontWeight: "700", color: colors.forest },
  list: { marginTop: 12, backgroundColor: colors.white, borderRadius: 16, paddingHorizontal: 16, ...shadow },
  hint: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.mint, borderRadius: 14, padding: 14 },
  hintText: { flex: 1, fontSize: 13.5, fontWeight: "600", color: colors.forest },
  farm: { fontSize: 13, fontWeight: "600", color: colors.ink },
  h1: { marginTop: 16, fontSize: 22, fontWeight: "600" },
  sub: { marginTop: 6, fontSize: 13.5, color: colors.muted, textAlign: "center", maxWidth: 280 },
  textLink: { textAlign: "center", paddingVertical: 8, fontSize: 14, fontWeight: "600", color: colors.forest },
  mini: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.white, borderRadius: 16, padding: 12, ...shadow },
  miniImg: { width: 56, height: 56, borderRadius: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  faint: { fontSize: 11, color: colors.faint },
  viewFarmer: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  blockTitle: { paddingTop: 12, fontSize: 13, fontWeight: "700", color: colors.ink },
  bannerAmber: { flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: colors.amberBg, borderRadius: 14, padding: 14 },
  bannerAmberTitle: { fontSize: 14, fontWeight: "700", color: "#8A4B08" },
  bannerAmberSub: { marginTop: 2, fontSize: 12.5, color: "#8A4B08", flex: 1 },
  green: { fontSize: 14, fontWeight: "700", color: colors.forest },
  link: { fontSize: 12, fontWeight: "600", color: colors.forest },
  two: { marginTop: 16, flexDirection: "row", gap: 8 },
  danger: { marginTop: 8, textAlign: "center", fontSize: 12, color: colors.danger },
  accept: { flexDirection: "row", gap: 12, backgroundColor: colors.mint, borderRadius: 16, padding: 14 },
  check: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  acceptTitle: { fontSize: 15, fontWeight: "600", color: colors.forest },
  acceptSub: { marginTop: 2, fontSize: 12.5, color: colors.muted },
});
