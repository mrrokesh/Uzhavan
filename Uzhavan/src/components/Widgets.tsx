import type { ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Crop } from "../api/types";
import { kg } from "../lib/format";
import { colors, shadow } from "../theme";
import { Chip } from "./ui";

export function FeedCard({
  crop,
  saved,
  onOpen,
  onSave,
}: {
  crop: Crop;
  saved?: boolean;
  onOpen: () => void;
  onSave: () => void;
}) {
  return (
    <View style={styles.card}>
      <Pressable onPress={onOpen}>
        <View style={styles.farmer}>
          <Image source={crop.avatar} style={styles.avatar} />
          <Text style={styles.farmName}>
            {crop.farmName} <Text style={{ color: colors.blueTick }}>✓</Text>
            <Text style={styles.muted}> · {crop.district}</Text>
          </Text>
        </View>
        <View style={styles.body}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headline}>{crop.headline}</Text>
            <View style={{ marginTop: 8 }}>
              <Chip label={crop.statusLabel} tone={crop.status === "ready" ? "mint" : "amber"} />
            </View>
            <Text style={styles.meta}>
              {kg(crop.expectedKg)} expected · {crop.grade}
            </Text>
          </View>
          <View style={styles.thumbWrap}>
            <Image source={crop.image} style={styles.thumb} />
            {crop.hasVideo ? (
              <View style={styles.play}>
                <Ionicons name="play" size={14} color={colors.ink} />
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
      <View style={styles.actions}>
        <Pressable onPress={onSave}>
          <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={20} color={saved ? colors.forest : colors.muted} />
        </Pressable>
        <Ionicons name="ellipsis-horizontal" size={20} color={colors.muted} />
      </View>
    </View>
  );
}

export function CropSummary({ crop, extra }: { crop: Crop; extra?: ReactNode }) {
  return (
    <View style={styles.summary}>
      <Image source={crop.image} style={styles.sumImg} />
      <View style={{ flex: 1 }}>
        <Text style={styles.sumTitle}>{crop.title}</Text>
        <Text style={styles.farmName}>
          {crop.farmName} <Text style={{ color: colors.blueTick }}>✓</Text>
        </Text>
        <Text style={styles.muted}>{crop.district}</Text>
        {extra}
      </View>
    </View>
  );
}

export function Stepper({
  value,
  onDec,
  onInc,
}: {
  value: number;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable onPress={onDec} style={styles.stepMinus}>
        <Text style={styles.stepGlyph}>−</Text>
      </Pressable>
      <Text style={styles.stepValue}>{new Intl.NumberFormat("en-IN").format(value)} kg</Text>
      <Pressable onPress={onInc} style={styles.stepPlus}>
        <Text style={[styles.stepGlyph, { color: colors.white }]}>+</Text>
      </Pressable>
    </View>
  );
}

export function Tracker({
  steps,
}: {
  steps: { title: string; meta: string; state: "done" | "current" | "pending" }[];
}) {
  return (
    <View>
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        return (
          <View key={step.title} style={styles.stepRow}>
            <View style={styles.rail}>
              {step.state === "done" ? (
                <View style={styles.dotDone}>
                  <Ionicons name="checkmark" size={12} color={colors.white} />
                </View>
              ) : step.state === "current" ? (
                <View style={styles.dotCurrent}>
                  <View style={styles.dotInner} />
                </View>
              ) : (
                <View style={styles.dotPending} />
              )}
              {last ? null : <View style={[styles.line, step.state === "done" && { backgroundColor: colors.forest }]} />}
            </View>
            <View style={{ paddingBottom: last ? 0 : 16, flex: 1 }}>
              <Text style={[styles.stepTitle, step.state === "pending" && { color: colors.faint }]}>{step.title}</Text>
              <Text
                style={{
                  fontSize: 12,
                  color: step.state === "current" ? colors.amberText : step.state === "done" ? colors.muted : colors.faint,
                }}
              >
                {step.meta}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function RouteStops({ pickup, drop }: { pickup: string; drop: string }) {
  return (
    <View style={{ paddingLeft: 20 }}>
      <View style={styles.dash} />
      <View style={{ paddingBottom: 20 }}>
        <View style={[styles.pin, { backgroundColor: colors.forest }]} />
        <Text style={styles.stopLabel}>PICKUP</Text>
        <Text style={styles.stopValue}>{pickup}</Text>
      </View>
      <View>
        <View style={[styles.pin, { backgroundColor: colors.amberText }]} />
        <Text style={styles.stopLabel}>DESTINATION</Text>
        <Text style={styles.stopValue}>{drop}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 14, ...shadow },
  farmer: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatar: { width: 28, height: 28, borderRadius: 14 },
  farmName: { fontSize: 13, fontWeight: "500", color: colors.ink },
  muted: { color: colors.muted, fontWeight: "400" },
  body: { marginTop: 10, flexDirection: "row", gap: 12 },
  headline: { fontSize: 16, fontWeight: "600", color: colors.ink, lineHeight: 22 },
  meta: { marginTop: 8, fontSize: 12.5, color: colors.muted },
  thumbWrap: { width: 92, height: 92 },
  thumb: { width: 92, height: 92, borderRadius: 14 },
  play: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00000033",
    borderRadius: 14,
  },
  actions: { marginTop: 8, flexDirection: "row", gap: 14 },
  summary: { flexDirection: "row", gap: 12, backgroundColor: colors.white, borderRadius: 16, padding: 12, ...shadow },
  sumImg: { width: 64, height: 64, borderRadius: 12 },
  sumTitle: { fontSize: 16, fontWeight: "600", color: colors.ink },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 20 },
  stepMinus: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  stepPlus: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.forest,
    alignItems: "center",
    justifyContent: "center",
  },
  stepGlyph: { fontSize: 24, color: colors.forest, fontWeight: "500" },
  stepValue: { minWidth: 130, textAlign: "center", fontSize: 28, fontWeight: "700", color: colors.ink },
  stepRow: { flexDirection: "row", gap: 12 },
  rail: { alignItems: "center", width: 24 },
  dotDone: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.forest,
    alignItems: "center",
    justifyContent: "center",
  },
  dotCurrent: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.amberBg,
    alignItems: "center",
    justifyContent: "center",
  },
  dotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.amberText },
  dotPending: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: "#d8d3cb", backgroundColor: colors.white },
  line: { width: 1, flex: 1, minHeight: 22, backgroundColor: "#e4dfd6", marginVertical: 4 },
  stepTitle: { fontSize: 14, fontWeight: "600", color: colors.ink },
  dash: { position: "absolute", left: 7, top: 8, bottom: 8, borderLeftWidth: 2, borderStyle: "dashed", borderColor: "#1B5E3B66" },
  pin: { position: "absolute", left: -20, top: 6, width: 14, height: 14, borderRadius: 7 },
  stopLabel: { fontSize: 11, fontWeight: "500", color: colors.muted, letterSpacing: 0.4 },
  stopValue: { fontSize: 14, fontWeight: "600", color: colors.ink },
});
