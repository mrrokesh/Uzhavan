import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppHeader, Screen } from "../components/Chrome";
import { SuccessMark } from "../components/Logo";
import { Chip, Divider, InfoNote, OutlineButton, PrimaryButton, Row } from "../components/ui";
import { CropSummary, RouteStops, Tracker } from "../components/Widgets";
import { useApp } from "../context/AppContext";
import { getCrop, IMAGES, pomegranateOrder } from "../data/seed";
import { inr, kg } from "../lib/format";
import type { RootStackParamList } from "../navigation/types";
import { colors, shadow } from "../theme";

export function RequestUpdate() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { quantity } = useApp();
  const crop = getCrop("bhagwa");
  const value = quantity * crop.pricePerKg;

  return (
    <Screen footer={<PrimaryButton label="Review & confirm" onPress={() => navigation.navigate("ConfirmPurchase")} />}>
      <AppHeader title="Request update" />
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={styles.accept}>
          <View style={styles.check}>
            <Ionicons name="checkmark" size={16} color={colors.forest} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.acceptTitle}>Farmer accepted your request</Text>
            <Text style={styles.acceptSub}>
              {crop.farmName} accepted your request for {kg(quantity)}.
            </Text>
          </View>
        </View>
        <View style={{ marginTop: 12 }}>
          <CropSummary crop={crop} />
        </View>
        <View style={styles.list}>
          <Row label="Accepted quantity" value={kg(quantity)} strong />
          <Divider />
          <Row label="Final price" value={`${inr(crop.pricePerKg)}/kg`} strong />
          <Divider />
          <Row label="Order value" value={inr(value)} green />
          <Divider />
          <Row label="Pickup from" value={crop.harvestDate} />
        </View>
        <View style={{ marginTop: 12 }}>
          <InfoNote tone="amber">
            <Ionicons name="time-outline" size={16} color={colors.amberText} />
            <Text style={{ flex: 1, color: colors.amberText, fontSize: 12.5 }}>Confirm by 6:00 PM today to reserve this quantity.</Text>
          </InfoNote>
        </View>
        <View style={{ marginTop: 20 }}>
          <Tracker
            steps={[
              { title: "Request sent", meta: "10:42 AM", state: "done" },
              { title: "Farmer accepted", meta: "02:18 PM", state: "done" },
              { title: "Buyer confirmation — Current", meta: "Current", state: "current" },
              { title: "Transport selection", meta: "Pending", state: "pending" },
            ]}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

export function ConfirmPurchase() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { quantity, setQuantityConfirmed } = useApp();
  const crop = getCrop("bhagwa");
  const [ok, setOk] = useState(true);
  const [declined, setDeclined] = useState(false);
  const value = quantity * crop.pricePerKg;

  return (
    <Screen
      footer={
        <>
          <PrimaryButton
            label="Confirm quantity"
            disabled={!ok}
            onPress={() => {
              setQuantityConfirmed(true);
              navigation.navigate("QuantityConfirmed");
            }}
          />
          <OutlineButton label="Decline offer" tone="danger" onPress={() => setDeclined(true)} />
        </>
      }
    >
      <AppHeader title="Confirm purchase" />
      <ScrollView contentContainerStyle={styles.pad}>
        <CropSummary crop={crop} extra={<Text style={styles.muted}>{crop.location}</Text>} />
        <View style={styles.list}>
          <Row label="Accepted quantity" value={kg(quantity)} strong />
          <Divider />
          <Row label="Final price" value={`${inr(crop.pricePerKg)}/kg`} strong />
          <Divider />
          <Row label="Order value" value={inr(value)} green />
          <Divider />
          <Row label="Expected harvest / pickup" value={crop.harvestDate} />
          <Divider />
          <Row label="Farm location" value={crop.location} />
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
            <Text style={{ flex: 1, color: colors.forest, fontSize: 12.5 }}>Transport will be selected next. Payment instructions will appear in My Orders.</Text>
          </InfoNote>
        </View>
        {declined ? <Text style={styles.danger}>Offer declined. The reserved quantity is released.</Text> : null}
      </ScrollView>
    </Screen>
  );
}

export function QuantityConfirmed() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { quantity, transport, setTransport } = useApp();
  const crop = getCrop("bhagwa");

  return (
    <Screen
      footer={
        <PrimaryButton
          label="Continue"
          onPress={() => navigation.navigate(transport === "book" ? "BookTruckOrder" : "Tabs")}
        />
      }
    >
      <ScrollView contentContainerStyle={[styles.pad, { alignItems: "center", paddingTop: 24 }]}>
        <SuccessMark />
        <Text style={styles.h1}>Quantity confirmed!</Text>
        <Text style={styles.sub}>
          {kg(quantity)} of {crop.title} is reserved for you.
        </Text>
        <View style={[styles.list, { width: "100%" }]}>
          <Row label="Order ID" value={pomegranateOrder.id} strong />
          <Divider />
          <Row label="Order value" value={inr(quantity * crop.pricePerKg)} />
          <Divider />
          <Row label="Pickup from" value={crop.harvestDate} />
          <Divider />
          <Row label="Farm" value={`${crop.farmName}, ${crop.location}`} />
        </View>
        <Text style={styles.section}>How will you transport the crop?</Text>
        <Radio selected={transport === "book"} onPress={() => setTransport("book")} title="Book a truck" rec sub="Find verified local trucks near the farm." />
        <Radio selected={transport === "private"} onPress={() => setTransport("private")} title="Use a private truck" sub="Add your own vehicle and driver details." />
        <Text style={styles.mutedCenter}>ⓘ You can change this later from My Orders.</Text>
      </ScrollView>
    </Screen>
  );
}

export function BookTruckOrder() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { quantity, setTransport, setBookingSource } = useApp();
  const crop = getCrop("bhagwa");

  return (
    <Screen
      footer={
        <>
          <PrimaryButton
            label="Find nearby trucks"
            onPress={() => {
              setBookingSource("pomegranate");
              navigation.navigate("PickupDelivery");
            }}
          />
          <Pressable
            onPress={() => {
              setTransport("private");
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
            🚚 For order {pomegranateOrder.id} · {crop.title}
          </Text>
        </View>
        <View style={[styles.list, { padding: 16 }]}>
          <RouteStops pickup={crop.location} drop="Koyambedu Market, Chennai" />
        </View>
        <View style={styles.list}>
          <Row label="Crop load" value={kg(quantity)} strong />
          <Divider />
          <Row label="Pickup date" value={crop.harvestDate} />
        </View>
        <View style={styles.suggest}>
          <Image source={IMAGES.truck} style={styles.suggestImg} />
          <View style={{ padding: 12 }}>
            <Text style={styles.muted}>SUGGESTED VEHICLE</Text>
            <Text style={styles.farm}>Mini truck · Up to 2.5 tons</Text>
          </View>
          <View style={styles.suggestCheck}>
            <Ionicons name="checkmark" size={13} color={colors.white} />
          </View>
        </View>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.muted}>📍 Distance</Text>
            <Text style={styles.statN}>57 km</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.muted}>🕒 Est. time</Text>
            <Text style={styles.statN}>1 hr 35 min</Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Radio({ selected, onPress, title, sub, rec }: { selected: boolean; onPress: () => void; title: string; sub: string; rec?: boolean }) {
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
  accept: { flexDirection: "row", gap: 12, backgroundColor: colors.mint, borderRadius: 16, padding: 14 },
  check: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  acceptTitle: { fontSize: 15, fontWeight: "600", color: colors.forest },
  acceptSub: { marginTop: 2, fontSize: 12.5, color: "#1B5E3BCC" },
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
  orderChip: { backgroundColor: colors.mint, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  orderChipText: { fontSize: 12, fontWeight: "600", color: colors.forest },
  suggest: { marginTop: 12, borderRadius: 16, overflow: "hidden", borderWidth: 2, borderColor: colors.forest, backgroundColor: colors.white },
  suggestImg: { width: "100%", height: 128 },
  suggestCheck: { position: "absolute", right: 12, top: 12, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.forest, alignItems: "center", justifyContent: "center" },
  stats: { marginTop: 12, flexDirection: "row", gap: 8 },
  stat: { flex: 1, backgroundColor: colors.white, borderRadius: 16, padding: 12, ...shadow },
  statN: { marginTop: 4, fontSize: 18, fontWeight: "700" },
});
