import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

/** A person-icon placeholder, used wherever a profile photo would go. */
export function Avatar({ size = 44 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.white,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name="person-outline" size={Math.round(size * 0.46)} color={colors.ink} />
    </View>
  );
}
