import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { PrimaryButton } from "../components/ui";
import { useI18n, type Language } from "../i18n";
import { colors } from "../theme";

const OPTIONS: { id: Language; title: string; sub: string }[] = [
  { id: "ta", title: "தமிழ்", sub: "Tamil" },
  { id: "en", title: "English", sub: "ஆங்கிலம்" },
];

export function LanguagePick() {
  const { setLanguage } = useI18n();
  const [picked, setPicked] = useState<Language>("ta");
  const [saving, setSaving] = useState(false);

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>மொழியைத் தேர்ந்தெடுக்கவும்</Text>
      <Text style={styles.lead}>Choose your language. This is asked once, when the app is first opened.</Text>
      <View style={styles.list}>
        {OPTIONS.map((option) => {
          const on = picked === option.id;
          return (
            <Pressable key={option.id} onPress={() => setPicked(option.id)} style={[styles.row, on && styles.rowOn]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{option.title}</Text>
                <Text style={styles.rowSub}>{option.sub}</Text>
              </View>
              <Ionicons name={on ? "checkmark-circle" : "ellipse-outline"} size={22} color={on ? colors.forest : colors.faint} />
            </Pressable>
          );
        })}
      </View>
      <PrimaryButton
        label={picked === "ta" ? "தொடரவும்" : "Continue"}
        loading={saving}
        onPress={() => {
          setSaving(true);
          void setLanguage(picked).finally(() => setSaving(false));
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream, paddingHorizontal: 20, paddingTop: 28 },
  title: { fontSize: 28, fontWeight: "800", color: colors.ink },
  lead: { marginTop: 8, fontSize: 14, lineHeight: 20, color: colors.muted },
  list: { marginTop: 28, gap: 10, flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
  },
  rowOn: { borderColor: colors.forest },
  rowTitle: { fontSize: 18, fontWeight: "700", color: colors.ink },
  rowSub: { marginTop: 2, fontSize: 13, color: colors.muted },
});
