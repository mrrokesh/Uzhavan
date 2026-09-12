import { useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppHeader, Screen } from "../components/Chrome";
import { SuccessMark } from "../components/Logo";
import { Chip, Divider, InfoNote, OutlineButton, PrimaryButton, Row } from "../components/ui";
import { RouteStops } from "../components/Widgets";
import { useConfirmRequest, useOrder, useRequest, useRequestAction, useSetTransport } from "../api/hooks";
import { imageFor } from "../lib/images";
import { ApiError } from "../lib/api";
import { inr, kg } from "../lib/format";
import type { RootStackParamList } from "../navigation/types";
import { colors, shadow } from "../theme";

/** Buyer reviews the farmer's final price and confirms — this creates the order. */
export function ConfirmPurchase() {
  const { requestId } = useRoute<RouteProp<RootStackParamList, "ConfirmPurchase">>().params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const request = useRequest(requestId).data;
  const confirm = useConfirmRequest();
  const decline = useRequestAction();

  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  if (!request) {
    return (
      <Screen>
        <AppHeader title="Confirm purchase" />
        <ActivityIndicator color={colors.forest} style={{ marginTop: 48 }} />
      </Screen>
    );
  }

  const crop = request.crop;
  const price = request.finalPricePerKg ?? crop?.pricePerKg ?? 0;
  const value = price * request.quantityKg;

  const submit = async () => {
    setWorking(true);
    setError(null);
    try {
      const order = await confirm.mutateAsync(request.id);
      navigation.replace("QuantityConfirmed", { orderId: order.id });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t confirm this order.");
    } finally {
      setWorking(false);
    }
  };

  const declineOffer = async () => {
    setWorking(true);
    try {
      await decline.mutateAsync({ id: request.id, action: "decline" });
      navigation.navigate("Tabs");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t decline.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <Screen
      footer={
        <>
          <PrimaryButton
            label="Confirm quantity"
            disabled={!ok || working}
            loading={working}
            onPress={submit}
          />
          <OutlineButton label="Decline offer" tone="danger" onPress={declineOffer} />
          {error ? <Text style={styles.danger}>{error}</Text> : null}
        </>
      }
    >
      <AppHeader title="Confirm purchase" />
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={styles.summary}>
          <Image source={imageFor(crop?.imageKey)} style={styles.sumImg} />
          <View style={{ flex: 1 }}>
            <Text style={styles.sumTitle}>{crop?.title}</Text>
            <Text style={styles.farm}>{crop?.farm.name} ✓</Text>
            <Text style={styles.muted}>{crop?.farm.location}</Text>
          </View>
        </View>

        <View style={styles.list}>
          <Row label="Accepted quantity" value={kg(request.quantityKg)} strong />
          <Divider />
          <Row label="Final price" value={`${inr(price)}/kg`} strong />
          <Divider />
          <Row label="Order value" value={inr(value)} green />
          <Divider />
          <Row label="Expected harvest / pickup" value={crop?.harvestDate ?? "—"} />
          <Divider />
          <Row label="Farm location" value={crop?.farm.location ?? "—"} />
        </View>

        <Pressable onPress={() => setOk((v) => !v)} style={styles.checkRow}>
          <View style={[styles.box, ok && styles.boxOn]}>
            {ok ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
          </View>
          <Text style={styles.confirm}>I confirm the quantity and final price.</Text>
        </Pressable>

        <View style={{ marginTop: 16 }}>
          <InfoNote>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.forest} />
            <Text style={{ flex: 1, color: colors.forest, fontSize: 12.5 }}>
              Confirming reserves {kg(request.quantityKg)} from this listing. Transport is chosen next.
            </Text>
          </InfoNote>
        </View>
      </ScrollView>
    </Screen>
  );
}

export function QuantityConfirmed() {
  const { orderId } = useRoute<RouteProp<RootStackParamList, "QuantityConfirmed">>().params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const order = useOrder(orderId).data;
  const setTransport = useSetTransport();
  const [transport, setLocalTransport] = useState<"BOOK" | "PRIVATE">("BOOK");
  const [working, setWorking] = useState(false);

  const go = async () => {
    setWorking(true);
    try {
      await setTransport.mutateAsync({ id: orderId, transport });
      if (transport === "BOOK") navigation.replace("BookTruckOrder", { orderId });
      else navigation.navigate("Tabs");
    } finally {
      setWorking(false);
    }
  };

  return (
    <Screen footer={<PrimaryButton label="Continue" onPress={go} loading={working} disabled={working} />}>
      <ScrollView contentContainerStyle={[styles.pad, { alignItems: "center", paddingTop: 24 }]}>
        <SuccessMark />
        <Text style={styles.h1}>Quantity confirmed!</Text>
        <Text style={styles.sub}>
          {kg(order?.quantityKg ?? 0)} of {order?.product} is reserved for you.
        </Text>

        <View style={[styles.list, { width: "100%" }]}>
          <Row label="Order ID" value={order?.code ?? "—"} strong />
          <Divider />
          <Row label="Order value" value={inr(order?.value ?? 0)} green />
          <Divider />
          <Row label="Pickup from" value={order?.harvestDate ?? "—"} />
          <Divider />
          <Row label="Farm" value={order?.pickup ?? "—"} />
        </View>

        <Text style={styles.section}>How will you transport the crop?</Text>
        <Radio
          selected={transport === "BOOK"}
          onPress={() => setLocalTransport("BOOK")}
          title="Book a truck"
          rec
          sub="Find verified local trucks near the farm."
        />
        <Radio
          selected={transport === "PRIVATE"}
          onPress={() => setLocalTransport("PRIVATE")}
          title="Use a private truck"
          sub="Arrange your own vehicle for pickup."
        />
        <Text style={styles.mutedCenter}>ⓘ You can change this later from My Orders.</Text>
      </ScrollView>
    </Screen>
  );
}

export function BookTruckOrder() {
  const { orderId } = useRoute<RouteProp<RootStackParamList, "BookTruckOrder">>().params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const order = useOrder(orderId).data;
  const setTransport = useSetTransport();

  if (!order) {
    return (
      <Screen>
        <AppHeader title="Book a truck" />
        <ActivityIndicator color={colors.forest} style={{ marginTop: 48 }} />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <>
          <PrimaryButton
            label="Find nearby trucks"
            onPress={() => navigation.navigate("PickupDelivery", { orderId })}
          />
          <Pressable
            onPress={async () => {
              await setTransport.mutateAsync({ id: orderId, transport: "PRIVATE" });
              navigation.navigate("Tabs");
            }}
          >
            <Text style={styles.textLink}>I'll use a private truck</Text>
          </Pressable>
        </>
      }
    >
      <AppHeader title="Book a truck" />
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={styles.orderChip}>
          <Text style={styles.orderChipText}>
            🚚 For order {order.code} · {order.product}
          </Text>
        </View>

        <View style={[styles.list, { padding: 16 }]}>
          <RouteStops pickup={order.pickup} drop={order.destination} />
        </View>

        <View style={styles.list}>
          <Row label="Crop load" value={kg(order.quantityKg)} strong />
          <Divider />
          <Row label="Pickup date" value={order.harvestDate} />
          <Divider />
          <Row label="Order value" value={inr(order.value)} />
        </View>

        <View style={styles.suggest}>
          <Image source={imageFor(order.crop?.imageKey)} style={styles.suggestImg} />
          <View style={{ padding: 12 }}>
            <Text style={styles.muted}>YOUR LOAD</Text>
            <Text style={styles.farm}>
              {order.product} · {kg(order.quantityKg)}
            </Text>
          </View>
          <View style={styles.suggestCheck}>
            <Ionicons name="checkmark" size={13} color={colors.white} />
          </View>
        </View>

        <View style={{ marginTop: 12 }}>
          <InfoNote>
            <Ionicons name="information-circle-outline" size={16} color={colors.forest} />
            <Text style={{ flex: 1, color: colors.forest, fontSize: 12.5 }}>
              We only show trucks that can carry {kg(order.quantityKg)} and whose driver is online.
            </Text>
          </InfoNote>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Radio({
  selected,
  onPress,
  title,
  sub,
  rec,
}: {
  selected: boolean;
  onPress: () => void;
  title: string;
  sub: string;
  rec?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.radio, selected && styles.radioOn]}>
      <Text style={{ fontSize: 22 }}>{rec ? "🚚" : "🚛"}</Text>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={styles.farm}>{title}</Text>
          {rec ? <Chip label="Recommended" tone="amber" /> : null}
        </View>
        <Text style={styles.muted}>{sub}</Text>
      </View>
      <View style={[styles.radioDot, selected && { backgroundColor: colors.forest, borderColor: colors.forest }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 24 },
  summary: { flexDirection: "row", gap: 12, backgroundColor: colors.white, borderRadius: 16, padding: 12, ...shadow },
  sumImg: { width: 64, height: 64, borderRadius: 12 },
  sumTitle: { fontSize: 16, fontWeight: "600", color: colors.ink },
  list: { marginTop: 12, backgroundColor: colors.white, borderRadius: 16, paddingHorizontal: 16, ...shadow },
  muted: { fontSize: 12, color: colors.muted },
  checkRow: { marginTop: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  box: { width: 20, height: 20, borderRadius: 5, borderWidth: 1, borderColor: "#cfc8bc", alignItems: "center", justifyContent: "center" },
  boxOn: { backgroundColor: colors.forest, borderColor: colors.forest },
  confirm: { fontSize: 13.5, fontWeight: "500", flex: 1 },
  danger: { marginTop: 12, textAlign: "center", color: colors.danger, fontSize: 12 },
  h1: { marginTop: 12, fontSize: 22, fontWeight: "600" },
  sub: { marginTop: 6, fontSize: 13.5, color: colors.muted, textAlign: "center", maxWidth: 280 },
  section: { marginTop: 20, alignSelf: "flex-start", fontSize: 15, fontWeight: "600" },
  radio: { marginTop: 8, width: "100%", flexDirection: "row", gap: 12, backgroundColor: colors.white, borderRadius: 16, padding: 14, borderWidth: 2, borderColor: "transparent", ...shadow },
  radioOn: { borderColor: colors.forest },
  radioDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: "#cfc8bc", marginTop: 4 },
  mutedCenter: { marginTop: 12, fontSize: 12, color: colors.muted },
  farm: { fontSize: 14, fontWeight: "600", color: colors.ink },
  textLink: { textAlign: "center", paddingVertical: 8, fontSize: 14, fontWeight: "600", color: colors.forest },
  orderChip: { backgroundColor: colors.mint, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, alignSelf: "flex-start" },
  orderChipText: { fontSize: 12, fontWeight: "600", color: colors.forest },
  suggest: { marginTop: 12, borderRadius: 16, overflow: "hidden", borderWidth: 2, borderColor: colors.forest, backgroundColor: colors.white },
  suggestImg: { width: "100%", height: 128 },
  suggestCheck: { position: "absolute", right: 12, top: 12, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.forest, alignItems: "center", justifyContent: "center" },
});
