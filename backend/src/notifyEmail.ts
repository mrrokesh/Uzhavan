import { env } from "./env.js";
import { HttpError } from "./http.js";

/**
 * Email one-time codes via Rokesh Notify.
 *
 * The service generates the code and stores it. This server only asks for a
 * send, then asks whether the digits the person typed match. The code itself
 * never lands in our database or our logs.
 */

type VerifyResult = { valid: boolean; reason?: string; attemptsRemaining?: number };

async function notify(path: string, body: Record<string, string>): Promise<Response> {
  if (!env.notifyApiKey) {
    throw new HttpError(503, "Email verification is not set up on the server.");
  }
  return fetch(`${env.notifyBaseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.notifyApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function sendSignupCode(email: string): Promise<{ expiresAt: string | null }> {
  const res = await notify("/v1/otp/send", {
    to: email,
    purpose: "signup",
    app_name: env.notifyAppName,
    from: env.notifyFrom,
  });
  if (!res.ok) {
    throw new HttpError(502, "Couldn’t send the verification email. Try again in a moment.");
  }
  const data = (await res.json()) as { expires_at?: string };
  return { expiresAt: data.expires_at ?? null };
}

export async function confirmSignupCode(email: string, code: string): Promise<VerifyResult> {
  const res = await notify("/v1/otp/verify", {
    to: email,
    purpose: "signup",
    code,
  });
  if (!res.ok) {
    throw new HttpError(502, "Couldn’t check that code. Try again.");
  }
  const data = (await res.json()) as {
    valid?: boolean;
    reason?: string;
    attempts_remaining?: number;
  };
  return {
    valid: Boolean(data.valid),
    reason: data.reason,
    attemptsRemaining: data.attempts_remaining,
  };
}
