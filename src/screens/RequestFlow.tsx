import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppHeader, Screen } from "../components/Chrome";
import { SuccessMark } from "../components/Logo";
import { Chip, Divider, InfoNote, OutlineButton, PrimaryButton, Row } from "../components/ui";
import { CropSummary, Stepper, Tracker } from "../components/Widgets";
import { useApp } from "../context/AppContext";
import { getCrop } from "../data/seed";
import { inr, kg, pct } from "../lib/format";
import type { RootStackParamList } from "../navigation/types";
import { colors, shadow } from "../theme";

export function SelectQuantity() {
  const { id } = useRoute<RouteProp<RootStackParamList, "SelectQuantity">>().params;
  const crop = getCrop(id);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { quantity, setQuantity } = useApp();
  const share = pct(quantity, crop.expectedKg);
  const value = quantity * crop.pricePerKg;

  return (
    <Screen footer={<PrimaryButton label="Review request" onPress={() => navigation.navigate("ReviewRequest", { id: crop.id })} />}>
      <AppHeader title="Select quantity" />
      <ScrollView contentContainerStyle={styles.pad}>
        <CropSummary crop={crop} />
        <View style={styles.avail}>
          <Text style={styles.muted}>📦 {kg(crop.expectedKg)} expected</Text>
          <Text style={styles.muted}>Minimum order {kg(crop.minOrderKg)}</Text>
        </View>
        <View style={{ marginTop: 24 }}>
          <Stepper
            value={quantity}
            onDec={() => setQuantity(Math.max(crop.minOrderKg, quantity - 100))}
            onInc={() => setQuantity(Math.min(crop.expectedKg, quantity + 100))}
          />
          <View style={styles.picks}>
            {[500, 1000, 2000].map((p) => (
              <Chip key={p} label={kg(p)} active={quantity === p} onPress={() => setQuantity(p)} />
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
          <Text style={[styles.muted, { marginTop: 4 }]}>Final price confirmed by farmer.</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

export function ReviewRequest() {
  const { id } = useRoute<RouteProp<RootStackParamList, "ReviewRequest">>().params;
  const crop = getCrop(id);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { quantity, setRequestSent } = useApp();
  const value = quantity * crop.pricePerKg;

  return (
    <Screen
      footer={
        <PrimaryButton
          label="Send request to farmer"
          onPress={() => {
            setRequestSent(true);
            navigation.navigate("RequestSent");
          }}
        />
      }
    >
      <AppHeader title="Review request" />
      <ScrollView contentContainerStyle={styles.pad}>
        <CropSummary crop={crop} />
        <View style={styles.list}>
          <Row label="Requested quantity" value={kg(quantity)} strong />
          <Divider />
          <Row label="Estimated value" value={inr(value)} strong />
          <Divider />
          <Row label="Expected harvest" value={crop.harvestDate} />
          <Divider />
          <Row label="Pickup" value={crop.location} />
        </View>
        <Hint icon="car-outline" title="Book a truck after the farmer accepts" sub="Transport is optional and chosen later." />
        <Hint icon="information-circle-outline" title="No payment will be collected now" sub="Price stays estimated until the farmer confirms." />
      </ScrollView>
    </Screen>
  );
}

export function RequestSent() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { quantity, requestId } = useApp();
  const crop = getCrop("bhagwa");

  return (
    <Screen
      footer={
        <>
          <PrimaryButton label="Track request" onPress={() => navigation.navigate("RequestDetails")} />
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
          Your request for {kg(quantity)} has been sent to {crop.farmName}.
        </Text>
        <View style={{ marginTop: 16 }}>
          <Chip label="🕒 Awaiting farmer confirmation" tone="amber" />
        </View>
        <View style={[styles.list, { width: "100%", marginTop: 20 }]}>
          <Row label="Request ID" value={requestId} strong />
          <Divider />
          <Row label="Product" value={crop.title} />
          <Divider />
          <Row label="Requested quantity" value={kg(quantity)} />
          <Divider />
          <Row label="Estimated value" value={inr(quantity * crop.pricePerKg)} />
          <Divider />
          <Row label="Expected harvest" value={crop.harvestDate} />
        </View>
        <View style={{ width: "100%", marginTop: 16 }}>
          <InfoNote>
            <Ionicons name="time-outline" size={16} color={colors.forest} />
            <Text style={{ flex: 1, color: colors.forest, fontSize: 12.5 }}>{crop.farmName} usually responds within 6 hours.</Text>
          </InfoNote>
        </View>
      </ScrollView>
    </Screen>
  );
}

export function RequestDetails() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { quantity, setFarmerAccepted, farmerAccepted } = useApp();
  const crop = getCrop("bhagwa");
  const [cancel, setCancel] = useState(false);

  return (
    <Screen>
      <AppHeader title="Request details" />
      <ScrollView contentContainerStyle={styles.pad}>
        <InfoNote tone="amber">
          <Ionicons name="time-outline" size={16} color={colors.amberText} />
          <Text style={{ flex: 1, color: colors.amberText, fontSize: 12.5 }}>
            Awaiting farmer confirmation — the farmer is reviewing your requested quantity and final price.
          </Text>
        </InfoNote>
        <View style={{ marginTop: 20 }}>
          <Tracker
            steps={[
              { title: "Request sent", meta: "10:42 AM", state: "done" },
              { title: "Farmer reviewing", meta: "In progress", state: "current" },
              { title: "Quantity reserved", meta: "Pending", state: "pending" },
              { title: "Payment pending", meta: "Pending", state: "pending" },
            ]}
          />
        </View>
        <View style={styles.mini}>
          <Image source={crop.image} style={styles.miniImg} />
          <View style={{ flex: 1 }}>
            <Text style={styles.farm}>{crop.title}</Text>
            <Text style={styles.muted}>{kg(quantity)}</Text>
          </View>
          <View>
            <Text style={styles.muted}>Estimated</Text>
            <Text style={styles.green}>{inr(quantity * crop.pricePerKg)}</Text>
          </View>
        </View>
        <View style={styles.mini}>
          <Image source={crop.avatar} style={styles.av} />
          <View style={{ flex: 1 }}>
            <Text style={styles.farm}>{crop.farmName} ✓</Text>
            <Text style={styles.muted}>{crop.district}</Text>
          </View>
          <Text style={styles.link}>View farmer ›</Text>
        </View>
        <InfoNote>
          <Ionicons name="leaf-outline" size={16} color={colors.forest} />
          <Text style={{ flex: 1, color: colors.forest, fontSize: 12.5 }}>We’ll notify you when the farmer confirms the quantity and final price.</Text>
        </InfoNote>
        {!farmerAccepted ? (
          <Pressable
            onPress={() => {
              setFarmerAccepted(true);
              navigation.navigate("RequestUpdate");
            }}
          >
            <Text style={styles.skip}>Farmer responded — view update</Text>
          </Pressable>
        ) : null}
        <View style={styles.two}>
          <OutlineButton label="Edit request" icon="pencil-outline" onPress={() => navigation.navigate("SelectQuantity", { id: crop.id })} />
          <OutlineButton label="Cancel request" icon="trash-outline" tone="danger" onPress={() => setCancel(true)} />
        </View>
        {cancel ? <Text style={styles.danger}>Request cancelled. The farmer will be notified.</Text> : null}
      </ScrollView>
    </Screen>
  );
}

function Hint({ icon, title, sub }: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string }) {
  return (
    <View style={styles.hint}>
      <View style={styles.hintIcon}>
        <Ionicons name={icon} size={16} color={colors.forest} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.farm}>{title}</Text>
        <Text style={styles.muted}>{sub}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 24 },
  avail: { marginTop: 16, flexDirection: "row", justifyContent: "space-between" },
  muted: { fontSize: 13, color: colors.muted },
  picks: { marginTop: 16, flexDirection: "row", justifyContent: "center", gap: 8 },
  barBg: { marginTop: 20, height: 6, borderRadius: 99, backgroundColor: colors.line, overflow: "hidden" },
  bar: { height: "100%", backgroundColor: colors.forest },
  centerMuted: { marginTop: 6, textAlign: "center", fontSize: 12, color: colors.muted },
  valueCard: { marginTop: 20, backgroundColor: colors.white, borderRadius: 16, padding: 16, ...shadow },
  bigMoney: { marginTop: 4, fontSize: 28, fontWeight: "700", color: colors.forest },
  list: { marginTop: 12, backgroundColor: colors.white, borderRadius: 16, paddingHorizontal: 16, ...shadow },
  hint: { marginTop: 16, flexDirection: "row", gap: 12 },
  hintIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
  farm: { fontSize: 13, fontWeight: "600", color: colors.ink },
  h1: { marginTop: 16, fontSize: 22, fontWeight: "600" },
  sub: { marginTop: 6, fontSize: 13.5, color: colors.muted, textAlign: "center", maxWidth: 280 },
  textLink: { textAlign: "center", paddingVertical: 8, fontSize: 14, fontWeight: "600", color: colors.forest },
  mini: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.white, borderRadius: 16, padding: 12, ...shadow },
  miniImg: { width: 56, height: 56, borderRadius: 12 },
  av: { width: 44, height: 44, borderRadius: 22 },
  green: { fontSize: 14, fontWeight: "700", color: colors.forest },
  link: { fontSize: 12, fontWeight: "600", color: colors.forest },
  skip: { marginTop: 12, textAlign: "center", fontSize: 12, color: colors.muted, textDecorationLine: "underline" },
  two: { marginTop: 16, flexDirection: "row", gap: 8 },
  danger: { marginTop: 8, textAlign: "center", fontSize: 12, color: colors.danger },
});
