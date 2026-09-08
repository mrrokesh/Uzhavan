import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Logo } from "../components/Logo";
import { Screen } from "../components/Chrome";
import { Chip } from "../components/ui";
import { FeedCard } from "../components/Widgets";
import { useApp } from "../context/AppContext";
import { crops } from "../data/seed";
import type { RootStackParamList } from "../navigation/types";
import { colors, shadow } from "../theme";

const filters = [
  { id: "for-you" as const, label: "For you" },
  { id: "ready" as const, label: "Ready now" },
  { id: "upcoming" as const, label: "Upcoming" },
  { id: "following" as const, label: "Following" },
];

export function HomeFeed() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { filter, setFilter, saved, toggleSaved, following, farmerAccepted } = useApp();
  const [q, setQ] = useState("");
  const visible = crops.filter((c) => {
    if (filter === "ready") return c.status === "ready";
    if (filter === "upcoming") return c.status === "upcoming";
    if (filter === "following") return following.includes(c.id);
    return true;
  });

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.pad} showsVerticalScrollIndicator={false}>
        <View style={styles.top}>
          <Logo />
          <View style={styles.topRight}>
            <View style={styles.loc}>
              <Text style={styles.locText}>📍 Tamil Nadu ▾</Text>
            </View>
            <View style={styles.bell}>
              <Ionicons name="notifications-outline" size={18} color={colors.ink} />
              {farmerAccepted ? <View style={styles.dot} /> : null}
            </View>
          </View>
        </View>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.faint} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search crops or districts" placeholderTextColor={colors.faint} style={styles.input} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }} contentContainerStyle={{ gap: 8 }}>
          {filters.map((f) => (
            <Chip key={f.id} label={f.label} active={filter === f.id} onPress={() => setFilter(f.id)} />
          ))}
        </ScrollView>
        <View style={{ marginTop: 16, gap: 12 }}>
          {visible.map((crop) => (
            <FeedCard
              key={crop.id}
              crop={crop}
              saved={saved.includes(crop.id)}
              onOpen={() => navigation.navigate("CropDetail", { id: crop.id })}
              onSave={() => toggleSaved(crop.id)}
            />
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 24 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  topRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  loc: { backgroundColor: colors.white, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, ...shadow },
  locText: { fontSize: 12, fontWeight: "500", color: colors.ink },
  bell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: { position: "absolute", top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  search: {
    marginTop: 16,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    ...shadow,
  },
  input: { flex: 1, fontSize: 14, color: colors.ink },
});

