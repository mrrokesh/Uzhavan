import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppHeader, Screen } from "../components/Chrome";
import { Logo } from "../components/Logo";
import { MapView } from "../components/MapView";
import { Chip, InfoNote, PrimaryButton } from "../components/ui";
import { Stepper } from "../components/Widgets";
import { useApp } from "../context/AppContext";
import { cargoFor, driver, getTruck, IMAGES, trucks, turmericOrder } from "../data/seed";
import { inr, kg } from "../lib/format";
import type { RootStackParamList } from "../navigation/types";
import { colors, shadow } from "../theme";

export function BookTrackHome() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { setBookingSource } = useApp();
  const order = turmericOrder;

  return (
    <Screen
      footer={
        <PrimaryButton
          label="Book truck"
          onPress={() => {
            setBookingSource("turmeric");
            navigation.navigate("ChooseOrder");
          }}
        />
      }
    >
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={styles.top}>
          <Logo />
          <View style={styles.bell}>
            <Ionicons name="notifications-outline" size={18} color={colors.ink} />
          </View>
        </View>
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>Book a truck</Text>
            <Text style={styles.muted}>Move your purchased crops safely.</Text>
          </View>
          <Text style={{ fontSize: 48 }}>🚚</Text>
        </View>
        <View style={styles.card}>
          <Chip label="🌱 Ready for pickup" tone="mint" />
          <View style={styles.row}>
            <Image source={IMAGES.turmeric} style={styles.img64} />
            <View style={{ flex: 1 }}>
              <View style={styles.between}>
                <Text style={styles.title}>Turmeric</Text>
                <Text style={styles.muted}>{kg(order.qtyKg)}</Text>
              </View>
              <Text style={styles.body}>{order.farmer}</Text>
              <Text style={styles.muted}>{order.pickup}</Text>
              <Text style={styles.muted}>{order.harvestDate}</Text>
            </View>
          </View>
        </View>
        <Benefit icon="👨‍🌾" title="Direct from farmers" text="Crops move from farm to your warehouse — no middlemen." />
        <Benefit icon="🚚" title="Local truck network" text="Verified drivers near Attur, Salem, Dindigul and Ooty." />
        <Benefit icon="✅" title="Safe & reliable" text="Insured trucks, live tracking, and proof of delivery." />
      </ScrollView>
    </Screen>
  );
}

export function ChooseOrder() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const order = turmericOrder;

  return (
    <Screen footer={<PrimaryButton label="Find nearby trucks" onPress={() => navigation.navigate("PickupDelivery")} />}>
      <AppHeader title="Choose an order" />
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={[styles.card, { borderWidth: 2, borderColor: colors.forest }]}>
          <View style={styles.row}>
            <Image source={IMAGES.turmeric} style={styles.img64} />
            <View>
              <Text style={styles.title}>Turmeric</Text>
              <Text style={styles.muted}>{kg(order.qtyKg)}</Text>
              <Text style={styles.muted}>{order.pickup}</Text>
            </View>
          </View>
        </View>
        <Text style={[styles.muted, { marginTop: 20 }]}>Quantity to transport</Text>
        <View style={{ marginTop: 12 }}>
          <Stepper value={order.qtyKg} onDec={() => {}} onInc={() => {}} />
          <Text style={styles.full}>Full order selected</Text>
        </View>
        <View style={[styles.card, { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 20 }]}>
          <View style={styles.wh}>
            <Ionicons name="business-outline" size={18} color={colors.amberText} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.farm}>{order.destination}</Text>
            <Text style={styles.muted}>{order.destinationFull}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.faint} />
        </View>
        <View style={{ marginTop: 12 }}>
          <InfoNote>
            <Ionicons name="information-circle-outline" size={16} color={colors.forest} />
            <Text style={{ flex: 1, color: colors.forest, fontSize: 12.5 }}>You can change destination before confirming the truck.</Text>
          </InfoNote>
        </View>
      </ScrollView>
    </Screen>
  );
}

export function PickupDelivery() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { bookingSource, quantity } = useApp();
  const order = cargoFor(bookingSource, quantity);

  return (
    <Screen footer={<PrimaryButton label="Choose truck" onPress={() => navigation.navigate("NearbyTrucks")} />}>
      <AppHeader title="Pickup & delivery" />
      <View style={{ height: 280 }}>
        <MapView variant="route" pickupLabel={order.pickupShort} dropLabel={order.destination} />
      </View>
      <View style={styles.pad}>
        <Line label="Pickup" title={order.pickup} color={colors.forest} />
        <Line label="Delivery" title={order.destinationFull} color={colors.amberText} />
        <View style={styles.between}>
          <Text style={styles.muted}>Distance</Text>
          <Text style={styles.farm}>57 km</Text>
        </View>
        <View style={[styles.between, { marginTop: 8 }]}>
          <Text style={styles.muted}>Available trucks</Text>
          <Text style={[styles.farm, { color: colors.forest }]}>12 local trucks available</Text>
        </View>
      </View>
    </Screen>
  );
}

export function NearbyTrucks() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { selectedTruckId, setSelectedTruckId, bookingSource, quantity } = useApp();
  const load = cargoFor(bookingSource, quantity).qtyKg;
  const cargo = cargoFor(bookingSource, quantity);

  return (
    <Screen footer={<PrimaryButton label="Continue" onPress={() => navigation.navigate("TruckDetails")} />}>
      <AppHeader title="Nearby trucks" />
      <ScrollView>
        <View style={{ height: 200 }}>
          <MapView variant="nearby" pickupLabel={cargo.pickupShort} dropLabel={cargo.destination} />
        </View>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Trucks near the farmer</Text>
          {trucks.map((t) => {
            const small = t.capacityKg < load;
            const selected = selectedTruckId === t.id;
            return (
              <Pressable
                key={t.id}
                disabled={small}
                onPress={() => setSelectedTruckId(t.id)}
                style={[styles.truck, small && { opacity: 0.5 }, selected && !small && { borderColor: colors.forest, borderWidth: 2 }]}
              >
                <Image source={t.photo} style={styles.img56} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                    <Text style={styles.farm}>{t.name}</Text>
                    {t.recommended ? <Chip label="Recommended" tone="mint" /> : null}
                    {small ? <Chip label="Too small" /> : null}
                  </View>
                  <Text style={styles.tiny}>{t.meta}</Text>
                  <Text style={styles.muted}>
                    {t.capacityTons} ton capacity
                    {small ? ` · Not enough for ${kg(load)}` : ` · ${t.etaMin} min away`}
                  </Text>
                </View>
                {!small ? <Text style={styles.price}>{inr(t.price)}</Text> : null}
              </Pressable>
            );
          })}
          <Text style={styles.trust}>✓ All trucks are verified and insured.</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

export function TruckDetails() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { selectedTruckId, bookingSource, quantity } = useApp();
  const truck = getTruck(selectedTruckId);
  const order = cargoFor(bookingSource, quantity);

  return (
    <Screen footer={<PrimaryButton label="Review booking" onPress={() => navigation.navigate("ReviewBooking")} />}>
      <AppHeader title="Truck details" />
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={[styles.card, styles.row]}>
          <Image source={driver.photo} style={styles.av} />
          <View style={{ flex: 1 }}>
            <Text style={styles.h2}>{driver.name}</Text>
            <Text style={styles.muted}>
              ★ {driver.rating} ({driver.trips} trips)
            </Text>
          </View>
          <Chip label="Verified driver" tone="mint" />
        </View>
        <View style={[styles.card, { overflow: "hidden", padding: 0 }]}>
          <Image source={truck.photo} style={{ width: "100%", height: 140 }} />
          <View style={{ padding: 14 }}>
            <Text style={styles.title}>Mini Truck · 3.5T</Text>
            <Text style={styles.muted}>
              {truck.body} · {truck.plate} · {truck.etaMin} min away
            </Text>
          </View>
        </View>
        <View style={styles.fit}>
          <Text style={{ fontSize: 28 }}>👜</Text>
          <Text style={[styles.farm, { color: colors.forest, flex: 1 }]}>
            Perfect for {kg(order.qtyKg)} — you can load up to {kg(truck.capacityKg)}.
          </Text>
        </View>
        <Text style={[styles.title, { marginTop: 20 }]}>What’s included</Text>
        {["Loading assistance — Driver will help with loading.", "Phone support — Support during pickup & delivery.", "Goods protection — Safe transport for your crops."].map((t) => (
          <View key={t} style={styles.inc}>
            <View style={styles.incDot}>
              <Ionicons name="checkmark" size={13} color={colors.forest} />
            </View>
            <Text style={styles.body}>{t}</Text>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

function Benefit({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <View style={[styles.row, { marginTop: 16 }]}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.farm}>{title}</Text>
        <Text style={styles.muted}>{text}</Text>
      </View>
    </View>
  );
}

function Line({ label, title, color }: { label: string; title: string; color: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[styles.tiny, { color }]}>{label}</Text>
      <Text style={styles.farm}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 24 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bell: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  hero: { marginTop: 16, flexDirection: "row", alignItems: "center" },
  h1: { fontSize: 22, fontWeight: "600" },
  h2: { fontSize: 17, fontWeight: "600" },
  title: { fontSize: 16, fontWeight: "600", color: colors.ink },
  farm: { fontSize: 14, fontWeight: "600", color: colors.ink },
  body: { fontSize: 13, color: colors.ink },
  muted: { fontSize: 12.5, color: colors.muted },
  tiny: { fontSize: 11, color: colors.muted },
  card: { marginTop: 16, backgroundColor: colors.white, borderRadius: 16, padding: 14, ...shadow },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  img64: { width: 64, height: 64, borderRadius: 12 },
  img56: { width: 56, height: 56, borderRadius: 10 },
  av: { width: 56, height: 56, borderRadius: 28 },
  full: { marginTop: 8, textAlign: "center", fontSize: 12, color: colors.forest },
  wh: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.amberBg, alignItems: "center", justifyContent: "center" },
  sheet: { marginTop: -12, backgroundColor: colors.cream, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16 },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#d7d0c4", marginBottom: 12 },
  truck: { marginTop: 8, flexDirection: "row", gap: 12, backgroundColor: colors.white, borderRadius: 16, padding: 12, borderWidth: 2, borderColor: "transparent", ...shadow },
  price: { fontSize: 14, fontWeight: "700" },
  trust: { marginTop: 12, textAlign: "center", fontSize: 12, color: colors.forest },
  fit: { marginTop: 12, flexDirection: "row", gap: 12, backgroundColor: colors.mint, borderRadius: 16, padding: 14 },
  inc: { marginTop: 10, flexDirection: "row", gap: 10, alignItems: "center" },
  incDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
});
