import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen } from "../../components/Chrome";
import { Chip } from "../../components/ui";
import { useFarmerRequests } from "../../api/hooks";
import { imageFor } from "../../lib/images";
import { inr, kg } from "../../lib/format";
import { REQUEST_LABEL, type RequestStatus } from "../../api/types";
import type { FarmerStackParamList } from "../../navigation/types";
import { colors, shadow } from "../../theme";

const TONE: Record<RequestStatus, "amber" | "mint" | "neutral"> = {
  PENDING: "amber",
  FARMER_ACCEPTED: "mint",
  CONFIRMED: "mint",
  FARMER_DECLINED: "neutral",
  BUYER_DECLINED: "neutral",
  CANCELLED: "neutral",
};

export function FarmerRequests() {
  const navigation = useNavigation<NativeStackNavigationProp<FarmerStackParamList>>();
  const requests = useFarmerRequests();

  const rows = requests.data ?? [];
  const open = rows.filter((r) => r.status === "PENDING");
  const rest = rows.filter((r) => r.status !== "PENDING");

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={styles.head}>
          <Text style={styles.h1}>Buyer requests</Text>
          {open.length > 0 ? <Chip label={`${open.length} waiting`} tone="amber" /> : null}
        </View>

        {requests.isLoading ? <ActivityIndicator color={colors.forest} style={{ marginTop: 32 }} /> : null}
        {!requests.isLoading && rows.length === 0 ? (
          <Text style={styles.empty}>
            No requests yet. When a buyer asks for a quantity, it lands here for you to price.
          </Text>
        ) : null}

        {open.length > 0 ? <Text style={styles.section}>Needs your response</Text> : null}
        {open.map((r) => (
          <Pressable
            key={r.id}
            style={[styles.card, styles.cardOpen]}
            onPress={() => navigation.navigate("FarmerRequestDetail", { requestId: r.id })}
          >
            <Image source={imageFor(r.crop?.imageKey)} style={styles.img} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{r.crop?.title}</Text>
              <Text style={styles.muted}>
                {r.buyer?.business ?? r.buyer?.name} · {r.buyer?.district}
              </Text>
              <Text style={styles.qty}>{kg(r.quantityKg)}</Text>
              <Text style={styles.muted}>Est. {inr(r.estimatedValue)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.faint} />
          </Pressable>
        ))}

        {rest.length > 0 ? <Text style={styles.section}>Earlier</Text> : null}
        {rest.map((r) => (
          <Pressable
            key={r.id}
            style={styles.card}
            onPress={() => navigation.navigate("FarmerRequestDetail", { requestId: r.id })}
          >
            <Image source={imageFor(r.crop?.imageKey)} style={styles.img} />
            <View style={{ flex: 1 }}>
              <View style={styles.between}>
                <Text style={styles.title}>{r.crop?.title}</Text>
                <Chip label={REQUEST_LABEL[r.status]} tone={TONE[r.status]} />
              </View>
              <Text style={styles.muted}>
                {kg(r.quantityKg)} · {r.buyer?.business ?? r.buyer?.name}
              </Text>
              <Text style={styles.faint}>{r.code}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 32 },
  head: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  h1: { fontSize: 20, fontWeight: "700", color: colors.ink },
  section: { marginTop: 20, marginBottom: 4, fontSize: 13, fontWeight: "600", color: colors.forest },
  empty: { marginTop: 32, textAlign: "center", fontSize: 13.5, lineHeight: 20, color: colors.muted },
  card: { marginTop: 10, flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: colors.white, borderRadius: 16, padding: 12, ...shadow },
  cardOpen: { borderWidth: 2, borderColor: colors.amberText },
  img: { width: 60, height: 60, borderRadius: 12 },
  title: { fontSize: 15, fontWeight: "600", color: colors.ink, flexShrink: 1 },
  muted: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  faint: { fontSize: 11, color: colors.faint, marginTop: 2 },
  qty: { marginTop: 4, fontSize: 15, fontWeight: "700", color: colors.forest },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
});
