import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { asyncHandler } from "../http.js";

export const appRouter = Router();

/** Numeric compare of dotted versions; missing parts count as 0. */
function compare(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number(n) || 0);
  const pb = b.split(".").map((n) => Number(n) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

const query = z.object({
  app: z.enum(["BUYER", "PARTNER"]).default("BUYER"),
  platform: z.enum(["ANDROID", "IOS"]).default("ANDROID"),
  version: z.string().trim().default("0.0.0"),
});

/**
 * Called by every app on launch. Returns the support details the user can act
 * on plus whether this build is still allowed to run.
 *
 *   force → below the minimum supported version, or a mandatory release:
 *           block the UI until they update
 *   soft  → a newer build exists: show a dismissible prompt
 *   ok    → carry on
 *
 * Deliberately unauthenticated: a force-update screen has to work before the
 * user can sign in, and a blocked user still needs the support number.
 */
appRouter.get(
  "/config",
  asyncHandler(async (req, res) => {
    const { app, platform, version } = query.parse(req.query);

    const [settings, release] = await Promise.all([
      prisma.appSetting.findMany({ where: { isPublic: true } }),
      prisma.appRelease.findUnique({ where: { app_platform: { app, platform } } }),
    ]);

    const support = Object.fromEntries(settings.map((s) => [s.key, s.value]));

    let update: {
      action: "ok" | "soft" | "force";
      latestVersion: string | null;
      minSupportedVersion: string | null;
      releaseNotes: string | null;
      storeUrl: string | null;
    } = {
      action: "ok",
      latestVersion: null,
      minSupportedVersion: null,
      releaseNotes: null,
      storeUrl: null,
    };

    if (release) {
      const belowMinimum = compare(version, release.minSupportedVersion) < 0;
      const behindLatest = compare(version, release.latestVersion) < 0;
      update = {
        action: belowMinimum || (release.mandatory && behindLatest) ? "force" : behindLatest ? "soft" : "ok",
        latestVersion: release.latestVersion,
        minSupportedVersion: release.minSupportedVersion,
        releaseNotes: release.releaseNotes,
        storeUrl: release.storeUrl,
      };
    }

    res.json({
      support: {
        email: support.support_email ?? env.supportEmail,
        phone: support.support_phone ?? env.supportPhone,
        whatsapp: support.support_whatsapp ?? null,
        hours: support.support_hours ?? null,
      },
      update,
    });
  }),
);
