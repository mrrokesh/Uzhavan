import type { ReactNode } from "react";
import type { ImageSourcePropType } from "react-native";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Logo } from "../components/Logo";
import { Screen } from "../components/Chrome";
import { Chip } from "../components/ui";
import { useApp } from "../context/AppContext";
import { buyer, getCrop, IMAGES, turmericOrder } from "../data/seed";
import { inr, kg } from "../lib/format";
import type { RootStackParamList } from "../navigation/types";
import { colors, shadow } from "../theme";

export function MyOrders() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { requestSent, farmerAccepted, quantityConfirmed, delivered, quantity, requestId, orderId } = useApp();
  const crop = getCrop("bhagwa");

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={styles.head}>
          <Text style={styles.h1}>My Orders</Text>
          <Ionicons name="notifications-outline" size={18} color={colors.ink} />
        </View>
        {requestSent && !quantityConfirmed ? (
          <OrderCard
            image={crop.image}
            title={crop.title}
            meta={`${kg(quantity)} · ${crop.farmName}`}
            id={requestId}
            chip={<Chip label={farmerAccepted ? "Farmer accepted" : "Awaiting farmer"} tone={farmerAccepted ? "mint" : "amber"} />}
            value={`Est. ${inr(quantity * crop.pricePerKg)}`}
            onPress={() => navigation.navigate(farmerAccepted ? "RequestUpdate" : "RequestDetails")}
          />
        ) : null}
        {quantityConfirmed ? (
          <OrderCard
            image={crop.image}
            title={crop.title}
            meta={`${kg(quantity)} · ${crop.farmName}`}
            id={orderId}
            chip={<Chip label="Quantity reserved" tone="mint" />}
            value={inr(quantity * crop.pricePerKg)}
            onPress={() => navigation.navigate("BookTruckOrder")}
          />
        ) : null}
        <OrderCard
          image={IMAGES.turmeric}
          title="Turmeric"
          meta={`${kg(turmericOrder.qtyKg)} · ${turmericOrder.farmName}`}
          id={turmericOrder.id}
          chip={<Chip label={delivered ? "Delivered" : "Ready for pickup"} tone="mint" />}
          value={inr(turmericOrder.value)}
          onPress={() => navigation.navigate(delivered ? "DeliveryCompleted" : "ChooseOrder")}
        />
        {!requestSent ? (
          <Text style={styles.empty}>Request a crop from Home. Price stays estimated until the farmer confirms.</Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function OrderCard({
  image,
  title,
  meta,
  id,
  chip,
  value,
  onPress,
}: {
  image: ImageSourcePropType;
  title: string;
  meta: string;
  id: string;
  chip: ReactNode;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <Image source={image} style={styles.img} />
        <View style={{ flex: 1 }}>
          <View style={styles.between}>
            <Text style={styles.title}>{title}</Text>
            {chip}
          </View>
          <Text style={styles.muted}>{meta}</Text>
          <Text style={styles.faint}>{id}</Text>
        </View>
      </View>
      <View style={[styles.between, { marginTop: 8 }]}>
        <Text style={styles.green}>{value}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.faint} />
      </View>
    </Pressable>
  );
}

export function Profile() {
  const { following, saved } = useApp();
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.pad}>
        <Logo compact />
        <View style={[styles.card, styles.row, { marginTop: 12 }]}>
          <Image source={buyer.avatar} style={styles.av} />
          <View>
            <Text style={styles.title}>{buyer.name}</Text>
            <Text style={styles.muted}>
              {buyer.business} · {buyer.role}
            </Text>
            <Text style={styles.muted}>{buyer.district}, Tamil Nadu</Text>
          </View>
        </View>
        <View style={[styles.card, { padding: 0, overflow: "hidden" }]}>
          <InfoRow icon="business-outline" title={buyer.warehouse} sub={buyer.warehouseAddress} />
          <InfoRow icon="location-outline" title="Also buys for" sub={buyer.market} />
          <InfoRow icon="call-outline" title={buyer.phone} sub="WhatsApp available" />
          <InfoRow icon="language-outline" title="Language" sub="English · தமிழ் ready" last />
        </View>
        <View style={styles.stats}>
          <Stat n={String(following.length)} l="Following" />
          <Stat n={String(saved.length)} l="Saved crops" />
        </View>
        <Text style={styles.foot}>Uzhavan · Direct from Tamil Nadu farms</Text>
      </ScrollView>
    </Screen>
  );
}

function InfoRow({ icon, title, sub, last }: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string; last?: boolean }) {
  return (
    <View style={[styles.info, !last && styles.infoBorder]}>
      <Ionicons name={icon} size={16} color={colors.forest} />
      <View>
        <Text style={styles.body}>{title}</Text>
        <Text style={styles.muted}>{sub}</Text>
      </View>
    </View>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <View style={[styles.card, { flex: 1, alignItems: "center" }]}>
      <Text style={styles.statN}>{n}</Text>
      <Text style={styles.muted}>{l}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 32 },
  head: { height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  h1: { fontSize: 17, fontWeight: "600" },
  card: { marginBottom: 12, backgroundColor: colors.white, borderRadius: 16, padding: 14, ...shadow },
  row: { flexDirection: "row", gap: 12, alignItems: "center" },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  img: { width: 56, height: 56, borderRadius: 12 },
  av: { width: 56, height: 56, borderRadius: 28 },
  title: { fontSize: 15, fontWeight: "600", color: colors.ink },
  body: { fontSize: 13.5, fontWeight: "500" },
  muted: { fontSize: 12, color: colors.muted },
  faint: { fontSize: 11, color: colors.faint },
  green: { fontSize: 13, fontWeight: "600", color: colors.forest },
  empty: { marginTop: 24, textAlign: "center", fontSize: 13, color: colors.muted },
  info: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  infoBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  stats: { flexDirection: "row", gap: 8 },
  statN: { fontSize: 20, fontWeight: "700", color: colors.forest },
  foot: { marginTop: 24, textAlign: "center", fontSize: 12, color: colors.faint },
});
