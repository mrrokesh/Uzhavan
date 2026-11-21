import { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, shadow } from "../theme";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatIso(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Reads back what formatDate wrote ("18 Sep 2026"); anything else is "not set". */
export function parseDate(text: string): Date | null {
  const m = /^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$/.exec(text.trim());
  if (!m) return null;
  const month = MONTHS.findIndex((x) => x.toLowerCase() === m[2].toLowerCase());
  if (month < 0) return null;
  const d = new Date(Number(m[3]), month, Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseIso(text: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/** Tap to open the phone's date picker. Stores "18 Sep 2026", or yyyy-mm-dd when storage is iso. */
export function DateField({
  label,
  value,
  onChange,
  minToday = true,
  storage = "text",
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  minToday?: boolean;
  storage?: "text" | "iso";
}) {
  const [open, setOpen] = useState(false);
  const selected = storage === "iso" ? parseIso(value) : parseDate(value);
  const [draft, setDraft] = useState<Date>(selected ?? startOfToday());

  const show = () => {
    setDraft(selected ?? startOfToday());
    setOpen(true);
  };

  const commit = (date: Date) => {
    onChange(storage === "iso" ? formatIso(date) : formatDate(date));
  };

  const onAndroid = (event: DateTimePickerEvent, date?: Date) => {
    setOpen(false);
    if (event.type === "set" && date) commit(date);
  };

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.row} onPress={show} accessibilityLabel={label}>
        <Ionicons name="calendar-outline" size={18} color={colors.muted} />
        <Text style={[styles.value, !value && { color: colors.faint }]}>
          {selected ? formatDate(selected) : "Select a date"}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>

      {open && Platform.OS === "android" ? (
        <DateTimePicker
          value={draft}
          mode="date"
          display="calendar"
          minimumDate={minToday ? startOfToday() : undefined}
          onChange={onAndroid}
        />
      ) : null}

      {Platform.OS === "ios" ? (
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
            <SafeAreaView edges={["bottom"]} style={styles.sheet}>
              <Pressable onPress={() => undefined}>
                <View style={styles.head}>
                  <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                    <Text style={styles.cancel}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      commit(draft);
                      setOpen(false);
                    }}
                    hitSlop={8}
                  >
                    <Text style={styles.done}>Done</Text>
                  </Pressable>
                </View>
                <DateTimePicker
                  value={draft}
                  mode="date"
                  display="inline"
                  minimumDate={minToday ? startOfToday() : undefined}
                  onChange={(_event, date) => {
                    if (date) setDraft(date);
                  }}
                  themeVariant="light"
                />
              </Pressable>
            </SafeAreaView>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 6 },
  row: {
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    ...shadow,
  },
  value: { flex: 1, fontSize: 15, color: colors.ink },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.cream, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  cancel: { fontSize: 16, color: colors.muted },
  done: { fontSize: 16, fontWeight: "700", color: colors.forest },
});
