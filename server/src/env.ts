import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

/** A hex secret of an exact byte length — fail loudly at boot, not at first use. */
function secret(name: string, bytes: number): Buffer {
  const value = required(name);
  if (!/^[0-9a-fA-F]+$/.test(value) || value.length !== bytes * 2) {
    throw new Error(
      `${name} must be ${bytes * 2} hex characters (${bytes} bytes). ` +
        `Generate one with: node -e "console.log(require('crypto').randomBytes(${bytes}).toString('hex'))"`,
    );
  }
  return Buffer.from(value, "hex");
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a number`);
  return n;
}

const bcryptRounds = int("BCRYPT_ROUNDS", 12);
if (bcryptRounds < 10 || bcryptRounds > 15) {
  throw new Error("BCRYPT_ROUNDS must be between 10 and 15 (12 recommended)");
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
  port: int("PORT", 4000),
  isProduction: process.env.NODE_ENV === "production",
  corsOrigin: process.env.CORS_ORIGIN ?? "*",

  bcryptRounds,
  passwordPepper: secret("PASSWORD_PEPPER", 32),
  passwordPepperVersion: int("PASSWORD_PEPPER_VERSION", 1),

  encryptionKey: secret("ENCRYPTION_KEY", 32),

  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "30d",

  maxUploadBytes: int("MAX_UPLOAD_MB", 5) * 1024 * 1024,

  supportEmail: process.env.SUPPORT_EMAIL ?? "support@uzhavan.app",
  supportPhone: process.env.SUPPORT_PHONE ?? "",
  ticketEscalationHours: int("TICKET_ESCALATION_HOURS", 24),

  /**
   * Delivery. Both default to "log", which prints the message instead of
   * sending it — so the whole flow works on a laptop with no accounts, and a
   * missing credential can never silently become a message nobody receives.
   */
  emailDriver: (process.env.EMAIL_DRIVER ?? "log") as "log" | "smtp",
  smtpUrl: process.env.SMTP_URL ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "Uzhavan <no-reply@uzhavan.app>",

  smsDriver: (process.env.SMS_DRIVER ?? "log") as "log" | "msg91",
  msg91Key: process.env.MSG91_AUTH_KEY ?? "",
  msg91SenderId: process.env.MSG91_SENDER_ID ?? "UZHAVN",

  /** Minutes a password-reset code stays valid. Short on purpose. */
  resetCodeMinutes: int("RESET_CODE_MINUTES", 15),
};

// A wide-open CORS policy is fine in dev and dangerous in production.
if (env.isProduction && env.corsOrigin === "*") {
  throw new Error("CORS_ORIGIN must be set to explicit origins in production");
}

// Fail at boot rather than at the moment someone is locked out of their
// account and the reset code goes to a log file nobody reads.
if (env.emailDriver === "smtp" && !env.smtpUrl) {
  throw new Error("EMAIL_DRIVER=smtp needs SMTP_URL");
}
if (env.smsDriver === "msg91" && !env.msg91Key) {
  throw new Error("SMS_DRIVER=msg91 needs MSG91_AUTH_KEY");
}
if (env.isProduction && env.emailDriver === "log" && env.smsDriver === "log") {
  throw new Error(
    "Set EMAIL_DRIVER or SMS_DRIVER in production — with both on 'log', password resets go nowhere",
  );
}
