import { Router } from "express";
import { prisma } from "../db.js";
import { asyncHandler, HttpError } from "../http.js";

export const farmsRouter = Router();

/** The farmer's own profile picture. Missing means the app shows the cartoon. */
farmsRouter.get(
  "/:id/avatar",
  asyncHandler(async (req, res) => {
    const photo = await prisma.farmAvatar.findUnique({ where: { farmId: String(req.params.id) } });
    if (!photo) throw new HttpError(404, "No photo");
    res.setHeader("Content-Type", photo.mimeType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(Buffer.from(photo.data));
  }),
);
