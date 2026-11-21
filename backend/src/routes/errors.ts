import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { asyncHandler } from "../http.js";
import { LIMITS, callerIp, enforce } from "../ratelimit.js";
import { currentUser } from "../session.js";

export const errorsRouter = Router();

const body = z.object({
  app: z.enum(["BUYER", "PARTNER"]),
  platform: z.enum(["ANDROID", "IOS"]),
  message: z.string().trim().min(1).max(500),
  path: z.string().trim().max(200).optional(),
  status: z.number().int().min(0).max(599).optional(),
});

/** The phone apps report a failed request here. No login required. */
errorsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    enforce(req, "client-error", LIMITS.clientError, callerIp(req));
    const report = body.parse(req.body);
    const user = await currentUser(req).catch(() => null);
    await prisma.clientReport.create({
      data: {
        app: report.app,
        platform: report.platform,
        message: report.message,
        path: report.path,
        status: report.status,
        userId: user?.id,
      },
    });
    res.status(202).json({ saved: true });
  }),
);
