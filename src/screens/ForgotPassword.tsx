import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { AppHeader, Screen } from "../components/Chrome";
import { Field, InfoNote, OutlineButton, PrimaryButton } from "../components/ui";
import { useForgotPassword, useResetPassword } from "../api/hooks";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";
import { colors } from "../theme";

/**
 * Two steps on one screen: ask for a code, then use it.
 *
 * A code rather than a link, because it arrives over SMS as readily as email
 * and needs no deep-link plumbing — and a farmer with one phone can read it
 * and type it without leaving the app.
 *
 * The server answers identically whether or not the account exists, so this
 * screen moves to step two either way. Saying "no such account" here would
 * hand anyone a way to test which emails are registered.
 */
export function ForgotPassword() {
  const navigation = useNavigation();
  const { signIn } = useAuth();
  const forgot = useForgotPassword();
  const reset = useResetPassword();

  const [step, setStep] = useState<"ask" | "code">("ask");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const ask = async () => {
    if (!email.trim()) {
      setError("Enter the email you signed up with");
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await forgot.mutateAsync(email.trim().toLowerCase());
      setStep("code");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t reach the server.");
    } finally {
      setWorking(false);
    }
  };

  const submit = async () => {
    if (code.trim().length !== 6) {
      setError("The code is six digits");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters");
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await reset.mutateAsync({
        email: email.trim().toLowerCase(),
        code: code.trim(),
        password,
      });
      // Straight in, rather than making someone type the password they just set.
      await signIn(email.trim().toLowerCase(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t reset your password.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen
        footer={
          step === "ask" ? (
            <>
              <PrimaryButton label="Send me a code" onPress={ask} loading={working} disabled={working} />
              <OutlineButton label="Back to sign in" onPress={() => navigation.goBack()} />
            </>
          ) : (
            <>
              <PrimaryButton
                label="Set new password"
                onPress={submit}
                loading={working}
                disabled={working}
              />
              <OutlineButton label="Use a different email" onPress={() => setStep("ask")} />
            </>
          )
        }
      >
        <AppHeader title="Forgot password" />
        <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          {step === "ask" ? (
            <>
              <Text style={styles.h1}>Can’t get in?</Text>
              <Text style={styles.lead}>
                Tell us the email you signed up with and we’ll send a six-digit code — to your email
                and your phone, so whichever you have to hand will do.
              </Text>
              <View style={{ marginTop: 20 }}>
                <Field
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@business.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.h1}>Check your messages</Text>
              <Text style={styles.lead}>
                If an account exists for {email.trim().toLowerCase()}, a six-digit code is on its
                way. It expires in 15 minutes.
              </Text>

              <View style={{ marginTop: 20 }}>
                <Field
                  label="Six-digit code"
                  value={code}
                  onChangeText={(v) => setCode(v.replace(/[^0-9]/g, "").slice(0, 6))}
                  placeholder="000000"
                  keyboardType="number-pad"
                />
              </View>
              <View style={{ marginTop: 14 }}>
                <Field
                  label="New password"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 8 characters"
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <Pressable onPress={ask} style={styles.resend} disabled={working}>
                <Text style={styles.resendText}>Didn’t get it? Send another code</Text>
              </Pressable>

              <View style={{ marginTop: 18 }}>
                <InfoNote>
                  <Ionicons name="shield-checkmark-outline" size={16} color={colors.forest} />
                  <Text style={{ flex: 1, color: colors.forest, fontSize: 12.5 }}>
                    After five wrong tries the code stops working and you’ll need a new one.
                  </Text>
                </InfoNote>
              </View>
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 32 },
  h1: { marginTop: 8, fontSize: 24, fontWeight: "700", color: colors.ink },
  lead: { marginTop: 8, fontSize: 13.5, lineHeight: 20, color: colors.muted },
  resend: { marginTop: 18, alignItems: "center" },
  resendText: { fontSize: 13, fontWeight: "600", color: colors.forest },
  error: { marginTop: 16, fontSize: 13, color: colors.danger },
});
