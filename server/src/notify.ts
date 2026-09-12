import nodemailer, { type Transporter } from "nodemailer";
import { env } from "./env.js";

/**
 * Getting a message to a person.
 *
 * Two channels, each with a driver chosen by environment. The default for both
 * is "log", which prints rather than sends — so the whole flow runs on a laptop
 * with no accounts anywhere, and a missing credential shows up as a visible log
 * line instead of a message that silently never arrives.
 *
 * Delivery never throws into a request. Someone resetting a password should not
 * see a 500 because an SMTP host is slow; the caller decides what to tell them,
 * and failures are logged for whoever is on call.
 */

export type Channel = "email" | "sms";

export type Delivery = {
  channel: Channel;
  to: string;
  ok: boolean;
  detail?: string;
};

let transporter: Transporter | null = null;

function smtp(): Transporter {
  if (!transporter) transporter = nodemailer.createTransport(env.smtpUrl);
  return transporter;
}

export async function sendEmail(to: string, subject: string, body: string): Promise<Delivery> {
  if (!to) return { channel: "email", to, ok: false, detail: "no address" };

  if (env.emailDriver === "log") {
    console.log(`\n[email → ${to}] ${subject}\n${body}\n`);
    return { channel: "email", to, ok: true, detail: "logged" };
  }

  try {
    await smtp().sendMail({ from: env.emailFrom, to, subject, text: body });
    return { channel: "email", to, ok: true };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "send failed";
    console.error(`[email → ${to}] failed:`, detail);
    return { channel: "email", to, ok: false, detail };
  }
}

/** Indian mobile numbers, as MSG91 wants them: 91 followed by ten digits. */
function msisdn(phone: string): string | null {
  const digits = phone.replace(/[^0-9]/g, "");
  const ten = digits.slice(-10);
  return /^[6-9][0-9]{9}$/.test(ten) ? `91${ten}` : null;
}

export async function sendSms(to: string, body: string): Promise<Delivery> {
  const number = msisdn(to);
  if (!number) return { channel: "sms", to, ok: false, detail: "not a mobile number" };

  if (env.smsDriver === "log") {
    console.log(`\n[sms → ${number}] ${body}\n`);
    return { channel: "sms", to: number, ok: true, detail: "logged" };
  }

  try {
    const res = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey: env.msg91Key },
      body: JSON.stringify({
        sender: env.msg91SenderId,
        short_url: "0",
        mobiles: number,
        message: body,
      }),
    });
    if (!res.ok) throw new Error(`MSG91 responded ${res.status}`);
    return { channel: "sms", to: number, ok: true };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "send failed";
    console.error(`[sms → ${number}] failed:`, detail);
    return { channel: "sms", to: number, ok: false, detail };
  }
}

/**
 * Both channels, because we don't know which one a farmer actually reads. One
 * arriving is a success — a wrong email address shouldn't stop the SMS.
 */
export async function notify(
  target: { email?: string | null; phone?: string | null },
  subject: string,
  body: string,
): Promise<{ delivered: boolean; attempts: Delivery[] }> {
  const attempts: Delivery[] = [];
  if (target.email) attempts.push(await sendEmail(target.email, subject, body));
  if (target.phone) attempts.push(await sendSms(target.phone, body));
  return { delivered: attempts.some((a) => a.ok), attempts };
}
