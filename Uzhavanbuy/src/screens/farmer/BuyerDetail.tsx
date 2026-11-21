import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppHeader, Screen } from "../../components/Chrome";
import { useStartConversation } from "../../api/hooks";
import { ApiError } from "../../lib/api";
import type { FarmerStackParamList } from "../../navigation/types";
import { colors, shadow } from "../../theme";

export function BuyerDetail() {
  const navigation = useNavigation<NativeStackNavigationProp<FarmerStackParamList>>();
  const buyer = useRoute<RouteProp<FarmerStackParamList, "BuyerDetail">>().params;
  const startChat = useStartConversation();
  const [working, setWorking] = useState(false);
  const title = buyer.business ?? buyer.name;

  const talk = async () => {
    setWorking(true);
    try {
      const convo = await startChat.mutateAsync({ buyerId: buyer.id });
      navigation.navigate("ChatThread", { conversationId: convo.id, name: title });
    } catch (err) {
      Alert.alert(
        "Couldn't open the chat",
        err instanceof ApiError ? err.message : "Check your connection and try again.",
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <Screen
      footer={
        <Pressable style={[styles.talk, working && { opacity: 0.6 }]} disabled={working} onPress={() => void talk()}>
          <Ionicons name="chatbubble-outline" size={18} color={colors.white} />
          <Text style={styles.talkText}>{working ? "Opening…" : "Talk to buyer"}</Text>
        </Pressable>
      }
    >
      <AppHeader title={title} />
      <View style={styles.pad}>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.avatar}>
              <Ionicons name="storefront-outline" size={22} color={colors.forest} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.between}>
                <Text style={styles.name}>{title}</Text>
                {buyer.verified ? (
                  <Ionicons name="shield-checkmark" size={18} color={colors.forest} />
                ) : null}
              </View>
              {buyer.business && buyer.name !== buyer.business ? (
                <Text style={styles.muted}>{buyer.name}</Text>
              ) : null}
            </View>
          </View>

          <Row icon="location-outline" label="District" value={buyer.district ?? "—"} />
          <Row icon="storefront-outline" label="Market" value={buyer.market ?? "—"} />
          <Row
            icon="navigate-outline"
            label="Distance"
            value={buyer.distanceKm != null ? `About ${buyer.distanceKm} km` : "—"}
          />
          <Row
            icon="cube-outline"
            label="Orders placed"
            value={`${buyer.orders} order${buyer.orders === 1 ? "" : "s"}`}
          />
        </View>
        <Text style={styles.note}>
          Message them about a crop they are looking for. One conversation stays open with this buyer.
        </Text>
      </View>
    </Screen>
  );
}

function Row({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.info}>
      <Ionicons name={icon} size={16} color={colors.faint} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingTop: 8 },
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 16, ...shadow },
  row: { flexDirection: "row", gap: 12, alignItems: "center" },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { flex: 1, fontSize: 18, fontWeight: "600", color: colors.ink },
  muted: { marginTop: 2, fontSize: 13, color: colors.muted },
  info: { marginTop: 14, flexDirection: "row", alignItems: "center", gap: 8 },
  infoLabel: { width: 96, fontSize: 13, color: colors.muted },
  infoValue: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.ink },
  note: { marginTop: 16, fontSize: 12.5, lineHeight: 18, color: colors.faint },
  talk: {
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.forest,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  talkText: { color: colors.white, fontSize: 15, fontWeight: "600" },
});
