import { useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen } from "../components/Chrome";
import { Chip, PrimaryButton } from "../components/ui";
import { useCrop, useMe, useStartConversation, useToggleSaved } from "../api/hooks";
import { ApiError } from "../lib/api";
import { inr, kg } from "../lib/format";
import type { RootStackParamList } from "../navigation/types";
import { colors, shadow } from "../theme";

export function CropDetail() {
  const { id } = useRoute<RouteProp<RootStackParamList, "CropDetail">>().params;
  const cropQuery = useCrop(id);
  const crop = cropQuery.data;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const me = useMe();
  const toggleSaved = useToggleSaved();
  const startConversation = useStartConversation();
  const [slide, setSlide] = useState(0);
  const [more, setMore] = useState(false);

  if (!crop) {
    return (
      <Screen>
        <View style={styles.loading}>
          {cropQuery.isError ? (
            <Text style={styles.muted}>Couldn’t load this crop.</Text>
          ) : (
            <ActivityIndicator color={colors.forest} />
          )}
        </View>
      </Screen>
    );
  }

  const saved = me.data?.saved ?? [];
  const isSaved = saved.includes(crop.id);
  const hero = crop.gallery[slide] ?? crop.image;
  const soldOut = crop.availableKg < crop.minOrderKg;

  return (
    <Screen
      footer={
        <>
          <View style={styles.priceRow}>
            <View>
              <Text style={styles.muted}>Estimated</Text>
              <Text style={styles.price}>{inr(crop.pricePerKg)}/kg</Text>
            </View>
            <Text style={styles.note}>Final price confirmed by farmer ⓘ</Text>
          </View>
          <PrimaryButton
            label={soldOut ? "Fully reserved" : "Select quantity"}
            disabled={soldOut}
            onPress={() => navigation.navigate("SelectQuantity", { id: crop.id })}
          />
        </>
      }
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={hero} style={styles.heroImg} />
          <Pressable style={[styles.fab, { left: 16 }]} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          <View style={styles.fabs}>
            <Pressable style={styles.fab} onPress={() => toggleSaved.mutate({ cropId: crop.id, on: !isSaved })}>
              <Ionicons
                name={isSaved ? "heart" : "heart-outline"}
                size={18}
                color={isSaved ? colors.danger : colors.ink}
              />
            </Pressable>
            <Pressable style={styles.fab}>
              <Ionicons name="share-outline" size={18} color={colors.ink} />
            </Pressable>
            <Pressable style={styles.fab} onPress={() => navigation.navigate("Tabs")}>
              <Ionicons name="cart-outline" size={18} color={colors.ink} />
            </Pressable>
          </View>
          {crop.hasVideo ? (
            <View style={styles.play}>
              <Ionicons name="play" size={22} color={colors.ink} />
            </View>
          ) : null}
          <View style={styles.dots}>
            {crop.gallery.map((_, i) => (
              <Pressable key={i} onPress={() => setSlide(i)} style={[styles.dot, i === slide && styles.dotOn]} />
            ))}
          </View>
          <View style={styles.gallery}>
            <Text style={styles.galleryText}>🖼 Gallery · {crop.gallery.length}</Text>
          </View>
        </View>

        <View style={styles.pad}>
          <View style={{ flexDirection: "row" }}>
            <Chip
              label={`🕒 ${crop.statusLabel}`}
              tone={crop.status === "ready" ? "mint" : "amber"}
            />
          </View>
          <Text style={styles.title}>{crop.title}</Text>
          <Text style={styles.muted}>
            {kg(crop.expectedKg)} expected · {crop.grade}
          </Text>

          <View style={styles.availRow}>
            <View style={styles.availBarBg}>
              <View
                style={[
                  styles.availBar,
                  { width: `${Math.min(100, Math.round((crop.availableKg / crop.expectedKg) * 100))}%` },
                ]}
              />
            </View>
            <Text style={styles.availText}>{kg(crop.availableKg)} still available</Text>
          </View>

          <Pressable
            style={styles.farmer}
            onPress={() => navigation.navigate("FarmerProfile", { farmId: crop.farmId, cropId: crop.id })}
          >
            <Image source={crop.avatar} style={styles.av} />
            <View style={{ flex: 1 }}>
              <Text style={styles.farm}>
                {crop.farmName} <Text style={{ color: colors.blueTick }}>✓</Text>
              </Text>
              <Text style={styles.muted}>
                {crop.ownerName} · ★ {crop.rating.toFixed(1)}
              </Text>
              <Text style={styles.muted}>{crop.district}</Text>
            </View>
            <Text style={styles.link}>View farmer ›</Text>
          </Pressable>

          <Pressable
            style={styles.messageRow}
            disabled={startConversation.isPending}
            onPress={async () => {
              try {
                const convo = await startConversation.mutateAsync({ farmId: crop.farmId, cropId: crop.id });
                navigation.navigate("ChatThread", { conversationId: convo.id, name: crop.farmName });
              } catch (err) {
                Alert.alert("Couldn’t open chat", err instanceof ApiError ? err.message : "Try again.");
              }
            }}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.forest} />
            <Text style={styles.messageText}>Message farmer</Text>
          </Pressable>

          <View style={styles.thumbs}>
            {crop.gallery.slice(0, 3).map((src, i) => (
              <Pressable key={i} onPress={() => setSlide(i)} style={{ flex: 1 }}>
                <Image source={src} style={styles.thumb} />
              </Pressable>
            ))}
          </View>

          <View style={styles.specs}>
            <Spec label="Farm location" value={crop.location} icon="location-outline" />
            <Spec label="Category" value={crop.category} icon="leaf-outline" />
            <Spec label="Expected harvest" value={crop.harvestDate} icon="calendar-outline" />
            <Spec label="Minimum order" value={kg(crop.minOrderKg)} icon="bag-outline" />
          </View>

          <Text style={styles.aboutTitle}>About this crop</Text>
          <Text style={styles.about} numberOfLines={more ? undefined : 3}>
            {crop.about}
          </Text>
          <Pressable onPress={() => setMore((v) => !v)}>
            <Text style={styles.link}>{more ? "See less" : "See more"}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Spec({ label, value, icon }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.spec}>
      <View style={styles.specIcon}>
        <Ionicons name={icon} size={16} color={colors.forest} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.specLabel}>{label}</Text>
        <Text style={styles.specValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: { height: 320 },
  heroImg: { width: "100%", height: "100%" },
  fab: {
    position: "absolute",
    top: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  fabs: { position: "absolute", top: 16, right: 16, flexDirection: "row", gap: 8 },
  play: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -28,
    marginTop: -28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fffffff2",
    alignItems: "center",
    justifyContent: "center",
  },
  dots: { position: "absolute", bottom: 12, alignSelf: "center", left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#ffffff80" },
  dotOn: { width: 16, backgroundColor: colors.white },
  gallery: { position: "absolute", right: 12, bottom: 12, backgroundColor: "#0000008c", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  galleryText: { color: colors.white, fontSize: 11 },
  pad: { padding: 16, paddingBottom: 24 },
  title: { marginTop: 8, fontSize: 22, fontWeight: "600", color: colors.ink },
  muted: { fontSize: 13, color: colors.muted },
  availRow: { marginTop: 12, gap: 6 },
  availBarBg: { height: 6, borderRadius: 99, backgroundColor: colors.line, overflow: "hidden" },
  availBar: { height: "100%", backgroundColor: colors.forest },
  availText: { fontSize: 12, color: colors.forest, fontWeight: "500" },
  farmer: { marginTop: 16, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.white, borderRadius: 16, padding: 12, ...shadow },
  av: { width: 48, height: 48, borderRadius: 24 },
  messageRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.mint,
    borderRadius: 12,
    paddingVertical: 11,
  },
  messageText: { fontSize: 13, fontWeight: "600", color: colors.forest },
  farm: { fontSize: 14, fontWeight: "600" },
  link: { fontSize: 12, fontWeight: "600", color: colors.forest },
  thumbs: { marginTop: 12, flexDirection: "row", gap: 8 },
  thumb: { width: "100%", height: 80, borderRadius: 12 },
  specs: { marginTop: 16, backgroundColor: colors.white, borderRadius: 16, padding: 14, gap: 12, ...shadow },
  spec: { flexDirection: "row", alignItems: "center", gap: 12 },
  specIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
  specLabel: { fontSize: 11, color: colors.muted },
  specValue: { fontSize: 13, fontWeight: "500", color: colors.ink },
  aboutTitle: { marginTop: 20, fontSize: 15, fontWeight: "600" },
  about: { marginTop: 6, fontSize: 13.5, lineHeight: 20, color: colors.muted },
  priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 },
  price: { fontSize: 24, fontWeight: "700", color: colors.ink },
  note: { fontSize: 11, color: colors.muted, maxWidth: 140, textAlign: "right" },
});
