import { useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen } from "../../components/Chrome";
import { useFarmerRequests, useStartConversation } from "../../api/hooks";
import { cropImage } from "../../lib/images";
import { inr, kg } from "../../lib/format";
import type { ApiRequest } from "../../api/types";
import type { FarmerStackParamList } from "../../navigation/types";
import { colors, shadow } from "../../theme";

const TABS = ["New", "Accepted", "Completed"] as const;

function when(iso: string) {
  const then = new Date(iso).getTime();
  const mins = Math.max(1, Math.round((Date.now() - then) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  return "Yesterday";
}

export function FarmerRequests() {
  const navigation = useNavigation<NativeStackNavigationProp<FarmerStackParamList>>();
  const requests = useFarmerRequests();
  const start = useStartConversation();
  const [tab, setTab] = useState<(typeof TABS)[number]>("New");
  const rows = requests.data ?? [];
  const shown = rows.filter((r) => {
    if (tab === "New") return r.status === "PENDING";
    if (tab === "Accepted") return r.status === "FARMER_ACCEPTED" || r.status === "CONFIRMED";
    return r.status === "FARMER_DECLINED" || r.status === "BUYER_DECLINED" || r.status === "CANCELLED";
  });

  const message = async (request: ApiRequest) => {
    if (!request.buyer) return;
    const thread = await start.mutateAsync({ buyerId: request.buyer.id });
    navigation.navigate("ChatThread", {
      conversationId: thread.id,
      name: request.buyer.business ?? request.buyer.name,
    });
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={styles.top}>
          <Text style={styles.h1}>Requests</Text>
          <Pressable onPress={() => navigation.navigate("Notifications")}>
            <Ionicons name="notifications-outline" size={22} color={colors.ink} />
          </Pressable>
        </View>

        <View style={styles.segment}>
          {TABS.map((name) => (
            <Pressable key={name} onPress={() => setTab(name)} style={[styles.seg, tab === name && styles.segOn]}>
              <Text style={[styles.segText, tab === name && styles.segTextOn]}>{name}</Text>
            </Pressable>
          ))}
        </View>

        {tab === "New" && shown.length > 0 ? (
          <View style={styles.countChip}>
            <Text style={styles.countText}>{shown.length} new buyer {shown.length === 1 ? "request" : "requests"}</Text>
          </View>
        ) : null}

        {requests.isLoading ? <ActivityIndicator color={colors.forest} style={{ marginTop: 24 }} /> : null}
        {!requests.isLoading && shown.length === 0 ? (
          <Text style={styles.empty}>Nothing in {tab.toLowerCase()} right now.</Text>
        ) : null}

        {shown.map((r) => (
          <View key={r.id} style={styles.card}>
            <View style={styles.row}>
              <View style={styles.leaf}>
                <Ionicons name="person-outline" size={16} color={colors.forest} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.buyer}>
                  {r.buyer?.business ?? r.buyer?.name ?? "Buyer"}{" "}
                  <Text style={{ color: colors.blueTick }}>✓</Text>
                </Text>
                <Text style={styles.muted}>Verified wholesale buyer</Text>
              </View>
              {r.crop ? <Image source={cropImage(r.crop)} style={styles.thumb} /> : null}
            </View>
            <Text style={styles.qty}>Requests {kg(r.quantityKg)}</Text>
            <Text style={styles.crop}>{r.crop?.title}</Text>
            {tab === "Accepted" ? (
              <Text style={styles.note}>
                {r.status === "CONFIRMED" ? "Buyer confirmed the quantity." : "Awaiting buyer confirmation"}
              </Text>
            ) : null}
            <View style={styles.meta}>
              <Text style={styles.muted}>Estimated{"\n"}<Text style={styles.strong}>{inr(r.estimatedValue)}</Text></Text>
              <Text style={styles.muted}>Pickup{"\n"}<Text style={styles.strong}>{r.crop?.harvestDate ?? "—"}</Text></Text>
              <Text style={styles.faint}>{when(r.createdAt)}</Text>
            </View>
            <View style={styles.actions}>
              <Pressable
                style={styles.review}
                onPress={() => navigation.navigate("FarmerRequestDetail", { requestId: r.id })}
              >
                <Text style={styles.reviewText}>{tab === "New" ? "Review request" : "Track request"}</Text>
              </Pressable>
              <Pressable style={styles.msg} onPress={() => void message(r)}>
                <Ionicons name="chatbubble-outline" size={15} color={colors.forest} />
                <Text style={styles.msgText}>Message</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 28 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  h1: { fontSize: 26, fontWeight: "800", color: colors.ink },
  segment: { flexDirection: "row", backgroundColor: "#E6E8E7", borderRadius: 14, padding: 4, marginTop: 14 },
  seg: { flex: 1, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  segOn: { backgroundColor: colors.forest },
  segText: { fontSize: 13, fontWeight: "700", color: colors.muted },
  segTextOn: { color: colors.white },
  countChip: { alignSelf: "flex-start", marginTop: 12, backgroundColor: colors.mint, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  countText: { color: colors.forest, fontSize: 12, fontWeight: "700" },
  empty: { marginTop: 28, textAlign: "center", color: colors.muted },
  card: { marginTop: 12, backgroundColor: colors.white, borderRadius: 18, padding: 14, ...shadow },
  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  leaf: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
  buyer: { fontSize: 15, fontWeight: "700", color: colors.ink },
  muted: { fontSize: 12, color: colors.muted, marginTop: 2 },
  thumb: { width: 52, height: 52, borderRadius: 10 },
  qty: { marginTop: 12, fontSize: 18, fontWeight: "800", color: colors.ink },
  crop: { marginTop: 2, fontSize: 13.5, color: colors.muted },
  note: { marginTop: 6, fontSize: 12.5, color: colors.forest, fontWeight: "600" },
  meta: { marginTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  strong: { color: colors.ink, fontWeight: "700", fontSize: 13 },
  faint: { fontSize: 11, color: colors.faint },
  actions: { marginTop: 12, flexDirection: "row", gap: 8 },
  review: { flex: 1, height: 42, borderRadius: 12, backgroundColor: colors.forest, alignItems: "center", justifyContent: "center" },
  reviewText: { color: colors.white, fontWeight: "700" },
  msg: { height: 42, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", gap: 6 },
  msgText: { color: colors.forest, fontWeight: "700" },
});
