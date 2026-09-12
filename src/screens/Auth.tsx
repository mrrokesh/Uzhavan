import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppHeader, Screen } from "../components/Chrome";
import { Logo } from "../components/Logo";
import { Field, PrimaryButton } from "../components/ui";
import { useAuth, type RegisterInput } from "../context/AuthContext";
import { ApiError } from "../lib/api";
import type { AuthStackParamList } from "../navigation/types";
import type { Role } from "../api/types";
import { colors, shadow } from "../theme";

function errorMessage(err: unknown) {
  if (err instanceof ApiError) return err.message;
  return "Couldn’t reach the server. Check that the API is running.";
}

const ROLES: { role: Role; icon: keyof typeof Ionicons.glyphMap; title: string; sub: string }[] = [
  { role: "BUYER", icon: "storefront-outline", title: "I buy crops", sub: "Wholesale buyer or trader" },
  { role: "FARMER", icon: "leaf-outline", title: "I sell crops", sub: "Farmer listing a harvest" },
  { role: "DRIVER", icon: "car-outline", title: "I drive a truck", sub: "Move crops farm to warehouse" },
];

export function Login() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError("Enter your email and password");
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setWorking(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen footer={<PrimaryButton label="Sign in" onPress={submit} loading={working} disabled={working} />}>
        <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          <Logo />
          <Text style={styles.h1}>Welcome back</Text>
          <Text style={styles.lead}>Buy, sell, or move crops across Tamil Nadu.</Text>

          <View style={styles.form}>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@business.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable onPress={() => navigation.navigate("ChooseRole")} style={styles.switch}>
            <Text style={styles.switchText}>
              New here? <Text style={styles.link}>Create an account</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}

export function ChooseRole() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();

  return (
    <Screen>
      <AppHeader title="Create account" />
      <ScrollView contentContainerStyle={styles.pad}>
        <Text style={styles.h1}>How will you use Uzhavan?</Text>
        <Text style={styles.lead}>Pick the one that fits. You can’t change this later.</Text>

        <View style={{ marginTop: 24, gap: 12 }}>
          {ROLES.map((r) => (
            <Pressable
              key={r.role}
              style={styles.roleCard}
              onPress={() => navigation.navigate("CreateAccount", { role: r.role })}
            >
              <View style={styles.roleIcon}>
                <Ionicons name={r.icon} size={22} color={colors.forest} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.roleTitle}>{r.title}</Text>
                <Text style={styles.roleSub}>{r.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.faint} />
            </Pressable>
          ))}
        </View>

        <Pressable onPress={() => navigation.navigate("Login")} style={styles.switch}>
          <Text style={styles.switchText}>
            Already have an account? <Text style={styles.link}>Sign in</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const TITLES: Record<Role, { h1: string; lead: string; section: string }> = {
  BUYER: {
    h1: "Join as a buyer",
    lead: "Buy directly from farms. Price stays estimated until the farmer confirms.",
    section: "Your business",
  },
  FARMER: {
    h1: "Join as a farmer",
    lead: "List your harvest and sell straight to wholesale buyers. No middlemen.",
    section: "Your farm",
  },
  DRIVER: {
    h1: "Join as a driver",
    lead: "Get paid trips moving crops from farms to warehouses near you.",
    section: "Your vehicle",
  },
};

export function CreateAccount() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { role } = useRoute<RouteProp<AuthStackParamList, "CreateAccount">>().params;
  const { signUp } = useAuth();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+91 ");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  // Buyer
  const [business, setBusiness] = useState("");
  const [warehouse, setWarehouse] = useState("");
  // Buyer + farmer
  const [district, setDistrict] = useState("");
  // Farmer
  const [farmName, setFarmName] = useState("");
  const [location, setLocation] = useState("");
  // Driver
  const [truckName, setTruckName] = useState("");
  const [plate, setPlate] = useState("");
  const [capacity, setCapacity] = useState("");
  const [price, setPrice] = useState("");
  const [truckBody, setTruckBody] = useState<"Open body" | "Closed body">("Open body");

  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const t = TITLES[role];

  const submit = async () => {
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setWorking(true);
    setError(null);

    const common = {
      email: email.trim(),
      password,
      name: name.trim(),
      phone: phone.trim(),
    };

    let input: RegisterInput;
    if (role === "BUYER") {
      input = {
        ...common,
        role: "BUYER",
        business: business.trim(),
        district: district.trim(),
        warehouse: warehouse.trim() || undefined,
      };
    } else if (role === "FARMER") {
      input = {
        ...common,
        role: "FARMER",
        farmName: farmName.trim(),
        district: district.trim(),
        location: location.trim(),
      };
    } else {
      input = {
        ...common,
        role: "DRIVER",
        truckName: truckName.trim(),
        plate: plate.trim(),
        capacityTons: Number(capacity),
        body: truckBody,
        price: Number(price),
      };
    }

    try {
      await signUp(input);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setWorking(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen
        footer={<PrimaryButton label="Create account" onPress={submit} loading={working} disabled={working} />}
      >
        <AppHeader title="Create account" />
        <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          <Text style={styles.h1}>{t.h1}</Text>
          <Text style={styles.lead}>{t.lead}</Text>

          <Text style={styles.section}>About you</Text>
          <View style={styles.form}>
            <Field label="Your name" value={name} onChangeText={setName} placeholder="Karthik Rajan" autoComplete="name" textContentType="name" />
            <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="+91 98430 11220" keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" />
          </View>

          <Text style={styles.section}>{t.section}</Text>
          <View style={styles.form}>
            {role === "BUYER" ? (
              <>
                <Field label="Business name" value={business} onChangeText={setBusiness} placeholder="Karthik Traders" textContentType="organizationName" />
                <Field label="District" value={district} onChangeText={setDistrict} placeholder="Salem" />
                <Field label="Warehouse (optional)" value={warehouse} onChangeText={setWarehouse} placeholder="Salem Agro Warehouse" />
              </>
            ) : null}

            {role === "FARMER" ? (
              <>
                <Field label="Farm name" value={farmName} onChangeText={setFarmName} placeholder="Arul Farms" />
                <Field label="Village / town" value={location} onChangeText={setLocation} placeholder="Natham" />
                <Field label="District" value={district} onChangeText={setDistrict} placeholder="Dindigul" />
              </>
            ) : null}

            {role === "DRIVER" ? (
              <>
                <Field label="Vehicle model" value={truckName} onChangeText={setTruckName} placeholder="Mini Truck 3.5T" />
                <Field label="Number plate" value={plate} onChangeText={setPlate} placeholder="TN 30 AB 4821" autoCapitalize="characters" />
                <Field label="Load capacity (tons)" value={capacity} onChangeText={setCapacity} placeholder="3.5" keyboardType="decimal-pad" />
                <Field label="Your base fare (₹)" value={price} onChangeText={setPrice} placeholder="3450" keyboardType="number-pad" />
                <View>
                  <Text style={styles.fieldLabel}>Body type</Text>
                  <View style={styles.segment}>
                    {(["Open body", "Closed body"] as const).map((b) => (
                      <Pressable
                        key={b}
                        onPress={() => setTruckBody(b)}
                        style={[styles.segmentItem, truckBody === b && styles.segmentOn]}
                      >
                        <Text style={[styles.segmentText, truckBody === b && { color: colors.white }]}>{b}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </>
            ) : null}
          </View>

          <Text style={styles.section}>Sign-in details</Text>
          <View style={styles.form}>
            <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@business.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
            <Field label="Password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" />
            <Field label="Confirm password" value={confirm} onChangeText={setConfirm} placeholder="Repeat password" secureTextEntry autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable onPress={() => navigation.navigate("Login")} style={styles.switch}>
            <Text style={styles.switchText}>
              Already have an account? <Text style={styles.link}>Sign in</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 24 },
  h1: { marginTop: 20, fontSize: 26, fontWeight: "700", color: colors.ink, letterSpacing: -0.4 },
  lead: { marginTop: 8, fontSize: 14, lineHeight: 20, color: colors.muted },
  form: { marginTop: 14, gap: 14 },
  section: { marginTop: 24, fontSize: 13, fontWeight: "600", color: colors.forest },
  error: { marginTop: 14, fontSize: 13, color: colors.danger },
  switch: { marginTop: 20, alignItems: "center" },
  switchText: { fontSize: 14, color: colors.muted },
  link: { color: colors.forest, fontWeight: "600" },
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    ...shadow,
  },
  roleIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  roleTitle: { fontSize: 15, fontWeight: "600", color: colors.ink },
  roleSub: { marginTop: 2, fontSize: 12.5, color: colors.muted },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 6 },
  segment: { flexDirection: "row", gap: 8 },
  segmentItem: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
  },
  segmentOn: { backgroundColor: colors.forest },
  segmentText: { fontSize: 13.5, fontWeight: "600", color: colors.ink },
});
