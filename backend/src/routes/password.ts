import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { hashPassword } from "../auth.js";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { notify } from "../notify.js";
import { audit } from "../audit.js";
import { asyncHandler, HttpError } from "../http.js";
import { LIMITS, enforce } from "../ratelimit.js";

export const passwordRouter = Router();

/**
 * Getting back into an account.
 *
 * A six-digit code rather than a magic link: it arrives over SMS as readily as
 * email, needs no deep-link plumbing, and a farmer can read it off one phone
 * and type it into the same one. Six digits is only safe because guessing is
 * strictly bounded — short expiry, five attempts, then the code is dead.
 *
 * Only a hash of the code is stored. Anyone who reads this table learns
 * nothing they can use.
 */

const MAX_ATTEMPTS = 5;

/** Cryptographically random, and always six digits — no accidental "007123". */
function makeCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

const hashCode = (code: string) => crypto.createHash("sha256").update(code).digest("hex");

const forgotBody = z.object({
  email: z.string().trim().toLowerCase().email("Enter the email you signed up with"),
});

/**
 * Always answers the same way.
 *
 * Saying "no such account" would turn this into a tool for discovering which
 * of a list of emails are registered — and on a marketplace that's a list of
 * who your competitors' suppliers are.
 */
passwordRouter.post(
  "/forgot",
  asyncHandler(async (req, res) => {
    // Each of these costs an SMS and an email. Limited per address, and again
    // per target account so one mailbox can't be flooded from many addresses.
    enforce(req, "forgot", LIMITS.forgot);
    const { email } = forgotBody.parse(req.body);
    enforce(req, "forgot-target", LIMITS.forgotTarget, email);
    const generic = {
      sent: true,
      message: "If that account exists, a code is on its way. It expires in 15 minutes.",
    };

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.json(generic);

    // A blocked account must not be recoverable — that's the point of blocking.
    if (user.status === "BLOCKED") return res.json(generic);

    // One live code at a time. A second request replaces the first rather than
    // leaving two valid ways in.
    await prisma.passwordReset.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const code = makeCode();
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        codeHash: hashCode(code),
        expiresAt: new Date(Date.now() + env.resetCodeMinutes * 60 * 1000),
        sentTo: user.email,
      },
    });

    await notify(
      { email: user.email, phone: user.phone },
      "Your Uzhavan reset code",
      `${code} is your Uzhavan password reset code. It expires in ${env.resetCodeMinutes} minutes. ` +
        `If you didn't ask for this, ignore this message — nothing has changed.`,
    );

    res.json(generic);
  }),
);

const resetBody = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z.string().trim().regex(/^[0-9]{6}$/, "The code is six digits"),
  password: z.string().min(8, "Use at least 8 characters"),
});

passwordRouter.post(
  "/reset",
  asyncHandler(async (req, res) => {
    enforce(req, "reset", LIMITS.resetAttempt);
    const { email, code, password } = resetBody.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    // Same wording whether the account, the code or the expiry is the problem.
    const refuse = () => {
      throw new HttpError(400, "That code is wrong or has expired. Ask for a new one.");
    };
    if (!user || user.status === "BLOCKED") refuse();

    const reset = await prisma.passwordReset.findFirst({
      where: { userId: user!.id, usedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!reset) refuse();

    if (reset!.expiresAt < new Date()) refuse();

    if (reset!.attempts >= MAX_ATTEMPTS) {
      throw new HttpError(429, "Too many wrong codes. Ask for a new one.");
    }

    const given = Buffer.from(hashCode(code));
    const stored = Buffer.from(reset!.codeHash);
    const matches = given.length === stored.length && crypto.timingSafeEqual(given, stored);

    if (!matches) {
      await prisma.passwordReset.update({
        where: { id: reset!.id },
        data: { attempts: { increment: 1 } },
      });
      refuse();
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user!.id },
        data: { passwordHash: await hashPassword(password) },
      }),
      prisma.passwordReset.update({
        where: { id: reset!.id },
        data: { usedAt: new Date() },
      }),
    ]);

    // Worth a permanent record: a password change is how an account takeover
    // looks from the inside.
    await audit({
      actorId: user!.id,
      action: "PASSWORD_RESET",
      targetType: "User",
      targetId: user!.id,
      summary: `${user!.name} reset their password with a code`,
    });

    await notify(
      { email: user!.email, phone: user!.phone },
      "Your Uzhavan password changed",
      "Your Uzhavan password was just changed. If that wasn't you, contact support immediately.",
    );

    res.json({ reset: true });
  }),
);
