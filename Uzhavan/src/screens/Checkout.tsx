import { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppHeader, Screen } from "../components/Chrome";
import { Divider, InfoNote, OutlineButton, PrimaryButton, Row } from "../components/ui";
import { useConfirmPayment, useOrder, useStartPayment } from "../api/hooks";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";
import { inr, kg } from "../lib/format";
import type { RootStackParamList } from "../navigation/types";
import { colors } from "../theme";

/**
 * Razorpay's own checkout, in a WebView.
 *
 * Their React Native SDK is a native module, which means it can't run in Expo
 * Go — and their hosted checkout is the same code path either way, so this is
 * no less real a payment. The page below is the whole integration: it holds no
 * secret, only the public key id and an order id the server created, and the
 * server re-verifies the signature before believing a word of it.
 */

type Result =
  | { kind: "success"; paymentId: string; orderId: string; signature: string }
  | { kind: "cancelled" }
  | { kind: "failed"; message: string };

function checkoutHtml(input: {
  keyId: string;
  orderId: string;
  amountPaise: number;
  name: string;
  email: string;
  phone: string;
  description: string;
}): string {
  const post = (payload: unknown) =>
    `window.ReactNativeWebView.postMessage(JSON.stringify(${JSON.stringify(payload)}))`;

  return `<!doctype html>
<html>
  <head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body style="margin:0;background:#FAF6F0">
    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
    <script>
      var send = function (payload) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      };
      try {
        var rzp = new Razorpay({
          key: ${JSON.stringify(input.keyId)},
          order_id: ${JSON.stringify(input.orderId)},
          amount: ${input.amountPaise},
          currency: "INR",
          name: "Uzhavan",
          description: ${JSON.stringify(input.description)},
          prefill: {
            name: ${JSON.stringify(input.name)},
            email: ${JSON.stringify(input.email)},
            contact: ${JSON.stringify(input.phone)}
          },
          theme: { color: "#1B5E3B" },
          modal: {
            ondismiss: function () { send({ kind: "cancelled" }); }
          },
          handler: function (r) {
            send({
              kind: "success",
              paymentId: r.razorpay_payment_id,
              orderId: r.razorpay_order_id,
              signature: r.razorpay_signature
            });
          }
        });
        rzp.on("payment.failed", function (e) {
          send({ kind: "failed", message: (e && e.error && e.error.description) || "Payment failed" });
        });
        rzp.open();
      } catch (e) {
        ${post({ kind: "failed", message: "Couldn't open checkout" })};
      }
    </script>
  </body>
</html>`;
}

export function Checkout() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { orderId } = useRoute<RouteProp<RootStackParamList, "Checkout">>().params;
  const { user } = useAuth();

  const order = useOrder(orderId);
  const start = useStartPayment();
  const confirm = useConfirmPayment();

  const [html, setHtml] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const o = order.data;

  const description = useMemo(
    () => (o ? `${kg(o.quantityKg)} ${o.product}` : "Crop order"),
    [o],
  );

  const begin = async () => {
    setWorking(true);
    setError(null);
    try {
      const started = await start.mutateAsync({ purpose: "CROP_ORDER", referenceId: orderId });
      setHtml(
        checkoutHtml({
          keyId: started.keyId,
          orderId: started.orderId,
          amountPaise: started.amountPaise,
          name: user?.business ?? user?.name ?? "",
          email: user?.email ?? "",
          phone: user?.phone ?? "",
          description,
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t start the payment.");
    } finally {
      setWorking(false);
    }
  };

  const onMessage = async (event: WebViewMessageEvent) => {
    let result: Result;
    try {
      result = JSON.parse(event.nativeEvent.data) as Result;
    } catch {
      return;
    }

    setHtml(null);

    if (result.kind === "cancelled") {
      setError("Payment cancelled. Nothing has been charged.");
      return;
    }
    if (result.kind === "failed") {
      setError(result.message);
      return;
    }

    // Never trust the WebView. The server recomputes the signature before it
    // marks anything paid; this call just tells it to look.
    setWorking(true);
    try {
      await confirm.mutateAsync({
        razorpayOrderId: result.orderId,
        razorpayPaymentId: result.paymentId,
        signature: result.signature,
      });
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "We couldn’t confirm that payment. Don’t pay again — contact support with your order code.",
      );
    } finally {
      setWorking(false);
    }
  };

  if (html) {
    return (
      <Screen>
        <AppHeader title="Payment" />
        <WebView
          source={{ html, baseUrl: "https://checkout.razorpay.com" }}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          onMessage={onMessage}
          startInLoadingState
          renderLoading={() => (
            <ActivityIndicator color={colors.forest} style={{ marginTop: 48 }} />
          )}
          style={{ backgroundColor: colors.cream }}
        />
      </Screen>
    );
  }

  if (done) {
    return (
      <Screen
        footer={
          <PrimaryButton
            label={o?.transport === "PRIVATE" ? "Done" : "Book a truck"}
            onPress={() =>
              o?.transport === "PRIVATE"
                ? navigation.navigate("Tabs")
                : navigation.replace("BookTruckOrder", { orderId })
            }
          />
        }
      >
        <AppHeader title="Paid" />
        <View style={styles.centre}>
          <View style={styles.tick}>
            <Ionicons name="checkmark" size={34} color={colors.forest} />
          </View>
          <Text style={styles.h1}>Payment received</Text>
          <Text style={styles.sub}>
            {inr(o?.totalPayable ?? 0)} is held safely until your crop is delivered. The farmer is
            paid from it as the load moves.
          </Text>
          <Text style={styles.code}>{o?.code}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <>
          <PrimaryButton
            label={o ? `Pay ${inr(o.totalPayable || o.value)}` : "Pay"}
            onPress={begin}
            loading={working}
            disabled={working || !o}
          />
          <OutlineButton label="Not now" onPress={() => navigation.goBack()} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </>
      }
    >
      <AppHeader title="Pay for this order" />
      {order.isLoading || !o ? (
        <ActivityIndicator color={colors.forest} style={{ marginTop: 48 }} />
      ) : (
        <View style={styles.pad}>
          <View style={styles.list}>
            <Row label="Order" value={o.code} strong />
            <Divider />
            <Row label="Crop" value={`${kg(o.quantityKg)} ${o.product}`} />
            <Divider />
            <Row label="Goes to the farmer" value={inr(o.value)} />
            <Divider />
            <Row label={`Platform fee (${(o.feeBps ?? 0) / 100}%)`} value={inr(o.platformFee ?? 0)} />
            <Divider />
            <Row label="You pay" value={inr(o.totalPayable || o.value)} green strong />
          </View>

          <View style={{ marginTop: 16 }}>
            <InfoNote>
              <Ionicons name="lock-closed-outline" size={16} color={colors.forest} />
              <Text style={{ flex: 1, color: colors.forest, fontSize: 12.5 }}>
                Your money is held by the payment gateway, not by us, and the farmer is only paid as
                the load moves. If the crop never arrives, it comes back to you.
              </Text>
            </InfoNote>
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingTop: 4 },
  list: { backgroundColor: colors.white, borderRadius: 16, paddingHorizontal: 16 },
  centre: { alignItems: "center", paddingTop: 56, paddingHorizontal: 24 },
  tick: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  h1: { marginTop: 18, fontSize: 22, fontWeight: "700", color: colors.ink },
  sub: {
    marginTop: 10,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.muted,
    textAlign: "center",
    maxWidth: 300,
  },
  code: { marginTop: 14, fontSize: 12, color: colors.faint },
  error: { marginTop: 12, fontSize: 13, color: colors.danger, textAlign: "center" },
});
