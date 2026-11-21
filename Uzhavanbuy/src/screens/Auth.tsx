import { useState } from "react";
import { useRef } from "react";
import {
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppHeader, Screen } from "../components/Chrome";
import { Field, OutlineButton, PrimaryButton } from "../components/ui";
import { useAuth, type RegisterInput } from "../context/AuthContext";
import { ApiError, api } from "../lib/api";
import { IMAGES } from "../lib/images";
import { APP_NAME, APP_ROLES, IS_BUYER_APP, OTHER_APP_NAME } from "../lib/appInfo";
import type { AuthStackParamList } from "../navigation/types";
import type { Role } from "../api/types";
import { colors, shadow } from "../theme";
import { FormScroll, revealInput } from "../components/keyboard";
import { DistrictPicker, StatePicker } from "../components/LocationSheet";
import { savePlace } from "../lib/place";

function errorMessage(err: unknown) {
  if (err instanceof ApiError) return err.message;
  return "Couldn’t reach the server. Check that the API is running.";
}

const ALL_ROLES: { role: Role; icon: keyof typeof Ionicons.glyphMap; title: string; sub: string }[] = [
  { role: "BUYER", icon: "storefront-outline", title: "I buy crops", sub: "Wholesale buyer or trader" },
  { role: "FARMER", icon: "basket-outline", title: "I sell crops", sub: "Farmer listing a harvest" },
  { role: "DRIVER", icon: "car-outline", title: "I drive a truck", sub: "Move crops farm to warehouse" },
];

/** Only the roles this build serves. Uzhavan Buy offers one, so it skips the picker. */
const ROLES = ALL_ROLES.filter((r) => APP_ROLES.includes(r.role));

function LoginInput({
  icon,
  label,
  secure,
  inputRef,
  ...input
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  secure?: boolean;
  inputRef?: React.Ref<TextInput>;
} & Pick<
  TextInputProps,
  "value" | "onChangeText" | "placeholder" | "keyboardType" | "autoComplete" | "textContentType" | "returnKeyType" | "onSubmitEditing"
>) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secure);
  const innerRef = useRef<TextInput>(null);
  return (
    <View>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={[styles.inputBox, focused && styles.inputBoxFocused]}>
        <Ionicons name={icon} size={19} color={focused ? colors.forest : colors.faint} />
        <TextInput
          {...input}
          ref={(node) => {
            innerRef.current = node;
            if (typeof inputRef === "function") inputRef(node);
            else if (inputRef) inputRef.current = node;
          }}
          secureTextEntry={secure ? hidden : false}
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor={colors.faint}
          onFocus={() => {
            setFocused(true);
            setTimeout(() => revealInput(innerRef.current), 220);
          }}
          onBlur={() => setFocused(false)}
          style={styles.inputText}
        />
        {secure ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} accessibilityLabel={hidden ? "Show password" : "Hide password"}>
            <Ionicons name={hidden ? "eye-outline" : "eye-off-outline"} size={20} color={colors.faint} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const TRUST: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: "basket-outline", text: "Direct from farms" },
  { icon: "shield-checkmark-outline", text: "Verified farmers" },
  { icon: "cash-outline", text: "Fair prices" },
];

export function Login() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const passwordRef = useRef<TextInput>(null);

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
    <KeyboardAvoidingView style={styles.loginRoot} behavior="padding">
      <StatusBar style="light" />
      <FormScroll
        contentContainerStyle={{ flexGrow: 1, paddingBottom: Math.max(insets.bottom, 16) + 8 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ImageBackground source={IMAGES.farm} style={[styles.hero, { paddingTop: insets.top + 28 }]}>
          <View style={styles.heroTint} />
          <Image source={require("../../assets/icon.png")} style={styles.brandMark} />
          <Text style={styles.brandName}>{APP_NAME}</Text>
          <Text style={styles.brandTag}>
            {IS_BUYER_APP
              ? "Buy direct from Tamil Nadu farms."
              : "Sell your harvest, or haul it, across Tamil Nadu."}
          </Text>
        </ImageBackground>

        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Welcome back</Text>
          <Text style={styles.sheetSub}>Sign in to continue to your account.</Text>

          <View style={styles.loginForm}>
            <LoginInput
              icon="mail-outline"
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@business.com"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <LoginInput
              icon="lock-closed-outline"
              label="Password"
              secure
              inputRef={passwordRef}
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              autoComplete="password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
          </View>

          <Pressable onPress={() => navigation.navigate("ForgotPassword")} style={styles.forgotRight} hitSlop={8}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </Pressable>

          {error ? (
            <View style={styles.errorBox} accessibilityRole="alert">
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={{ marginTop: 20 }}>
            <PrimaryButton label="Sign in" onPress={submit} loading={working} disabled={working} />
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>New to {APP_NAME}?</Text>
            <View style={styles.dividerLine} />
          </View>

          <OutlineButton
            label="Create an account"
            onPress={() =>
              ROLES.length === 1
                ? navigation.navigate("CreateAccount", { role: ROLES[0].role })
                : navigation.navigate("ChooseRole")
            }
          />

          {IS_BUYER_APP ? (
            <View style={styles.trustRow}>
              {TRUST.map((t) => (
                <View key={t.text} style={styles.trustItem}>
                  <View style={styles.trustIcon}>
                    <Ionicons name={t.icon} size={16} color={colors.forest} />
                  </View>
                  <Text style={styles.trustText}>{t.text}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Text style={styles.otherApp}>
            {IS_BUYER_APP
              ? `Farmer or truck driver? Use the ${OTHER_APP_NAME} app instead.`
              : `Buying in bulk? Use the ${OTHER_APP_NAME} app instead.`}
          </Text>
        </View>
      </FormScroll>
    </KeyboardAvoidingView>
  );
}

export function ChooseRole() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();

  return (
    <Screen>
      <AppHeader title="Create account" />
      <ScrollView contentContainerStyle={styles.pad}>
        <Text style={styles.h1}>How will you use {APP_NAME}?</Text>
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
  const [emailCode, setEmailCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const sendCode = async () => {
    const address = email.trim().toLowerCase();
    if (!address.includes("@")) {
      setError("Enter the email address first.");
      return;
    }
    setSendingCode(true);
    setError(null);
    try {
      await api("/auth/email/otp", { method: "POST", body: { email: address } });
      setCodeSentTo(address);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 404
          ? "Email verification isn’t on the live server yet."
          : errorMessage(err),
      );
    } finally {
      setSendingCode(false);
    }
  };

  // Buyer
  const [business, setBusiness] = useState("");
  const [warehouse, setWarehouse] = useState("");
  // Buyer + farmer
  const [stateName, setStateName] = useState("Tamil Nadu");
  const [stateOpen, setStateOpen] = useState(false);
  const [district, setDistrict] = useState("");
  const [districtOpen, setDistrictOpen] = useState(false);
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
    if ((role === "BUYER" || role === "FARMER") && district.trim()) {
      await savePlace({
        state: stateName,
        district: district.trim(),
        radiusKm: stateName === "Tamil Nadu" ? 100 : undefined,
      });
    }

    const address = email.trim().toLowerCase();
    if (!/^[0-9]{6}$/.test(emailCode.trim()) || codeSentTo !== address) {
      setError("Send a code to this email, then enter the 6 digits from the message.");
      setWorking(false);
      return;
    }

    const common = {
      email: address,
      emailCode: emailCode.trim(),
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
    <KeyboardAvoidingView style={{ flex: 1 }}>
      <Screen
        footer={<PrimaryButton label="Create account" onPress={submit} loading={working} disabled={working} />}
      >
        <AppHeader title="Create account" />
        <FormScroll contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
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
                <DistrictSelect label="State" value={stateName} placeholder="Choose a state" onPress={() => setStateOpen(true)} />
                {stateName === "Tamil Nadu" ? (
                  <DistrictSelect value={district} onPress={() => setDistrictOpen(true)} />
                ) : (
                  <Field label="District" value={district} onChangeText={setDistrict} placeholder="City or district" />
                )}
                <Field label="Warehouse (optional)" value={warehouse} onChangeText={setWarehouse} placeholder="Salem Agro Warehouse" />
              </>
            ) : null}

            {role === "FARMER" ? (
              <>
                <Field label="Farm name" value={farmName} onChangeText={setFarmName} placeholder="Arul Farms" />
                <Field label="Village / town" value={location} onChangeText={setLocation} placeholder="Natham" />
                <DistrictSelect label="State" value={stateName} placeholder="Choose a state" onPress={() => setStateOpen(true)} />
                {stateName === "Tamil Nadu" ? (
                  <DistrictSelect value={district} onPress={() => setDistrictOpen(true)} />
                ) : (
                  <Field label="District" value={district} onChangeText={setDistrict} placeholder="City or district" />
                )}
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
            <Pressable onPress={() => void sendCode()} disabled={sendingCode}>
              <Text style={styles.link}>{sendingCode ? "Sending code…" : codeSentTo ? "Send a new code" : "Send verification code"}</Text>
            </Pressable>
            <Field
              label="Email code"
              value={emailCode}
              onChangeText={setEmailCode}
              placeholder="6-digit code"
              keyboardType="number-pad"
            />
            {codeSentTo ? <Text style={styles.hint}>Code sent to {codeSentTo}. It expires in 5 minutes.</Text> : null}
            <Field label="Password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" />
            <Field label="Confirm password" value={confirm} onChangeText={setConfirm} placeholder="Repeat password" secureTextEntry autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <StatePicker
            visible={stateOpen}
            selected={stateName}
            onSelect={(value) => {
              setStateName(value);
              setDistrict("");
            }}
            onClose={() => setStateOpen(false)}
          />
          <DistrictPicker
            visible={districtOpen}
            selected={district}
            onSelect={setDistrict}
            onClose={() => setDistrictOpen(false)}
          />

          <Pressable onPress={() => navigation.navigate("Login")} style={styles.switch}>
            <Text style={styles.switchText}>
              Already have an account? <Text style={styles.link}>Sign in</Text>
            </Text>
          </Pressable>
        </FormScroll>
      </Screen>
    </KeyboardAvoidingView>
  );
}

function DistrictSelect({
  value,
  onPress,
  label = "District",
  placeholder = "Choose a district",
}: {
  value: string;
  onPress: () => void;
  label?: string;
  placeholder?: string;
}) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={styles.district} onPress={onPress}>
        <Text style={[styles.districtText, !value && { color: colors.faint }]}>{value || placeholder}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.faint} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  loginRoot: { flex: 1, backgroundColor: colors.cream },
  hero: { paddingHorizontal: 24, paddingBottom: 64, alignItems: "center", overflow: "hidden" },
  heroTint: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(14, 58, 28, 0.62)" },
  brandMark: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  brandName: { marginTop: 14, fontSize: 28, fontWeight: "800", color: colors.white, letterSpacing: -0.5 },
  brandTag: { marginTop: 6, fontSize: 14.5, lineHeight: 20, color: "rgba(255,255,255,0.82)", textAlign: "center" },
  sheet: {
    flex: 1,
    marginTop: -32,
    backgroundColor: colors.cream,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 26,
  },
  sheetTitle: { fontSize: 24, fontWeight: "700", color: colors.ink, letterSpacing: -0.4 },
  sheetSub: { marginTop: 4, fontSize: 14, color: colors.muted },
  loginForm: { marginTop: 22, gap: 16 },
  inputLabel: { fontSize: 12.5, fontWeight: "600", color: colors.ink, marginBottom: 7 },
  inputBox: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  inputBoxFocused: { borderColor: colors.forest, backgroundColor: "#FFFFFF" },
  inputText: { flex: 1, fontSize: 15.5, color: colors.ink, paddingVertical: 0 },
  forgotRight: { alignSelf: "flex-end", marginTop: 12 },
  errorBox: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#FDECEC",
  },
  errorText: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.danger },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 22 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerText: { fontSize: 12.5, color: colors.faint },
  trustRow: { marginTop: 28, flexDirection: "row", justifyContent: "space-between" },
  trustItem: { flex: 1, alignItems: "center", gap: 6 },
  trustIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  trustText: { fontSize: 11.5, fontWeight: "600", color: colors.muted, textAlign: "center" },
  pad: { paddingHorizontal: 16, paddingBottom: 24 },
  h1: { marginTop: 20, fontSize: 26, fontWeight: "700", color: colors.ink, letterSpacing: -0.4 },
  lead: { marginTop: 8, fontSize: 14, lineHeight: 20, color: colors.muted },
  form: { marginTop: 14, gap: 14 },
  section: { marginTop: 24, fontSize: 13, fontWeight: "600", color: colors.forest },
  error: { marginTop: 14, fontSize: 13, color: colors.danger },
  switch: { marginTop: 20, alignItems: "center" },
  switchText: { fontSize: 14, color: colors.muted },
  link: { color: colors.forest, fontWeight: "600" },
  hint: { fontSize: 12, color: colors.muted },
  forgot: { marginTop: 16, alignItems: "center" },
  forgotText: { fontSize: 13, fontWeight: "600", color: colors.forest },
  otherApp: {
    marginTop: 28,
    textAlign: "center",
    fontSize: 12,
    lineHeight: 18,
    color: colors.faint,
  },
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
  district: {
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  districtText: { fontSize: 15, color: colors.ink },
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
