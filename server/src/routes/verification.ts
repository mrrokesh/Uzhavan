import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { blindIndex, encrypt, tryDecrypt } from "../crypto.js";
import { encryptBuffer, decryptBuffer } from "../crypto.js";
import { env } from "../env.js";
import { currentUser } from "../session.js";
import { requirePermission } from "../permissions.js";
import { audit } from "../audit.js";
import { asyncHandler, HttpError } from "../http.js";
import {
  isPlausibleFarmerCard,
  isValidGSTIN,
  isValidPAN,
  isValidUdyam,
  last4,
  normalise,
} from "../validators/india.js";

export const verificationRouter = Router();

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;

/** What the app shows on the "get verified" screen. */
verificationRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = await currentUser(req);
    const documents = await prisma.kycDocument.findMany({
      where: { ownerId: user.id },
      select: { id: true, type: true, filename: true, mimeType: true, sizeBytes: true, uploadedAt: true },
      orderBy: { uploadedAt: "desc" },
    });

    res.json({
      status: user.verification,
      submittedAt: user.verificationSubmittedAt,
      reviewedAt: user.verificationReviewedAt,
      rejectionReason: user.rejectionReason,
      idLast4: user.idLast4,
      hasGstin: !!user.gstinEnc,
      hasUdyam: !!user.udyamEnc,
      hasFarmerCard: !!user.farmerCardEnc,
      documents,
      // Tell the client exactly what this role must provide.
      required:
        user.role === "FARMER"
          ? { identifier: "farmerCard", documents: ["FARMER_CARD", "LAND_RECORD"] }
          : { identifier: "gstinOrUdyam", documents: ["GST_CERTIFICATE", "MSME_CERTIFICATE"] },
    });
  }),
);

const submitBody = z
  .object({
    gstin: z.string().trim().optional(),
    udyam: z.string().trim().optional(),
    pan: z.string().trim().optional(),
    farmerCard: z.string().trim().optional(),
    documents: z
      .array(
        z.object({
          type: z.enum([
            "FARMER_CARD",
            "LAND_RECORD",
            "GST_CERTIFICATE",
            "MSME_CERTIFICATE",
            "PAN_CARD",
            "OTHER",
          ]),
          filename: z.string().trim().min(1).max(200),
          mimeType: z.enum(ALLOWED_MIME),
          /** base64 of the raw file. */
          data: z.string().min(1),
        }),
      )
      .min(1, "Attach at least one document")
      .max(4, "Attach at most 4 documents"),
  })
  .strict();

/**
 * Submit for verification. Identifiers are encrypted before they touch the
 * database; documents are encrypted individually. Re-submitting after a
 * rejection replaces the previous documents.
 */
verificationRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const user = await currentUser(req);
    if (user.role !== "FARMER" && user.role !== "BUYER") {
      throw new HttpError(403, "Only farmers and buyers need verification");
    }
    if (user.verification === "VERIFIED") {
      throw new HttpError(409, "This account is already verified");
    }
    if (user.verification === "PENDING") {
      throw new HttpError(409, "Your documents are already under review");
    }

    const body = submitBody.parse(req.body);

    // --- Validate the identifier for this role -------------------------
    const data: Prisma.UserUncheckedUpdateInput = {};
    let shown: string;

    if (user.role === "FARMER") {
      if (!body.farmerCard) throw new HttpError(400, "Enter your farmer card number");
      const value = normalise(body.farmerCard);
      if (!isPlausibleFarmerCard(value)) {
        throw new HttpError(400, "That doesn't look like a farmer card number");
      }
      data.farmerCardEnc = encrypt(value);
      data.farmerCardIndex = blindIndex(value);
      shown = last4(value);
    } else {
      if (!body.gstin && !body.udyam) {
        throw new HttpError(400, "Enter your GSTIN or Udyam (MSME) number");
      }
      if (body.gstin) {
        const value = normalise(body.gstin);
        if (!isValidGSTIN(value)) {
          throw new HttpError(400, "That GSTIN isn't valid — check the 15 characters");
        }
        data.gstinEnc = encrypt(value);
        data.gstinIndex = blindIndex(value);
        shown = last4(value);
      } else {
        const value = normalise(body.udyam!);
        if (!isValidUdyam(value)) {
          throw new HttpError(400, "Udyam numbers look like UDYAM-TN-01-0012345");
        }
        data.udyamEnc = encrypt(value);
        data.udyamIndex = blindIndex(value);
        shown = last4(value);
      }
    }

    if (body.pan) {
      const value = normalise(body.pan);
      if (!isValidPAN(value)) throw new HttpError(400, "That PAN isn't valid");
      data.panEnc = encrypt(value);
    }

    // --- Decode and check the documents --------------------------------
    const prepared = body.documents.map((doc) => {
      const raw = Buffer.from(doc.data, "base64");
      if (raw.length === 0) throw new HttpError(400, `${doc.filename} is empty`);
      if (raw.length > env.maxUploadBytes) {
        throw new HttpError(
          400,
          `${doc.filename} is larger than ${Math.round(env.maxUploadBytes / 1024 / 1024)} MB`,
        );
      }
      return {
        type: doc.type,
        filename: doc.filename,
        mimeType: doc.mimeType,
        sizeBytes: raw.length,
        data: new Uint8Array(encryptBuffer(raw)),
        checksum: crypto.createHash("sha256").update(raw).digest("hex"),
      };
    });

    try {
      const updated = await prisma.$transaction(async (tx) => {
        await tx.kycDocument.deleteMany({ where: { ownerId: user.id } });
        await tx.kycDocument.createMany({
          data: prepared.map((d) => ({ ...d, ownerId: user.id })),
        });
        return tx.user.update({
          where: { id: user.id },
          data: {
            ...data,
            idLast4: shown,
            verification: "PENDING",
            verificationSubmittedAt: new Date(),
            rejectionReason: null,
            verificationReviewedAt: null,
            verificationReviewedById: null,
          },
        });
      });

      res.status(201).json({
        status: updated.verification,
        submittedAt: updated.verificationSubmittedAt,
        idLast4: updated.idLast4,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new HttpError(409, "That number is already registered to another account");
      }
      throw err;
    }
  }),
);

/**
 * Stream one document back. Only the owner or a staff reviewer may fetch it,
 * and it is decrypted on the way out — the bytes at rest are never readable.
 */
verificationRouter.get(
  "/documents/:id",
  asyncHandler(async (req, res) => {
    const user = await currentUser(req);
    const doc = await prisma.kycDocument.findUnique({ where: { id: String(req.params.id) } });
    if (!doc) throw new HttpError(404, "Document not found");

    const isOwner = doc.ownerId === user.id;
    const isReviewer = user.role === "ADMIN" || user.role === "STAFF";
    if (!isOwner && !isReviewer) throw new HttpError(404, "Document not found");

    let plain: Buffer;
    try {
      plain = decryptBuffer(Buffer.from(doc.data));
    } catch {
      throw new HttpError(500, "This document could not be decrypted");
    }

    res.setHeader("Content-Type", doc.mimeType);
    res.setHeader("Content-Length", plain.length);
    res.setHeader("Content-Disposition", `inline; filename="${doc.filename.replace(/"/g, "")}"`);
    // Documents are personal data: never let a proxy or the browser keep them.
    res.setHeader("Cache-Control", "no-store, private");
    res.send(plain);
  }),
);

// ─── Staff review ──────────────────────────────────────────────

verificationRouter.get(
  "/queue",
  asyncHandler(async (req, res) => {
    await requirePermission(req, "KYC_REVIEW");
    const status = z
      .enum(["PENDING", "VERIFIED", "REJECTED", "UNVERIFIED"])
      .default("PENDING")
      .parse(req.query.status ?? "PENDING");

    const users = await prisma.user.findMany({
      where: { verification: status, role: { in: ["FARMER", "BUYER"] } },
      orderBy: { verificationSubmittedAt: "asc" },
      include: {
        farm: { select: { name: true, district: true, location: true } },
        documents: {
          select: { id: true, type: true, filename: true, mimeType: true, sizeBytes: true },
        },
      },
    });

    res.json(
      users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        business: u.business,
        district: u.district,
        farm: u.farm,
        submittedAt: u.verificationSubmittedAt,
        idLast4: u.idLast4,
        // Reviewers need the real number to check it against the document.
        gstin: tryDecrypt(u.gstinEnc),
        udyam: tryDecrypt(u.udyamEnc),
        pan: tryDecrypt(u.panEnc),
        farmerCard: tryDecrypt(u.farmerCardEnc),
        documents: u.documents,
      })),
    );
  }),
);

const decisionBody = z.object({
  decision: z.enum(["VERIFIED", "REJECTED"]),
  reason: z.string().trim().max(300).optional(),
});

verificationRouter.post(
  "/queue/:userId",
  asyncHandler(async (req, res) => {
    const reviewer = await requirePermission(req, "KYC_REVIEW");
    const { decision, reason } = decisionBody.parse(req.body);

    const target = await prisma.user.findUnique({ where: { id: String(req.params.userId) } });
    if (!target) throw new HttpError(404, "Account not found");
    if (target.verification !== "PENDING") {
      throw new HttpError(409, "This account isn't awaiting review");
    }
    if (decision === "REJECTED" && !reason) {
      throw new HttpError(400, "Give a reason so they know what to fix");
    }

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: {
        verification: decision,
        verificationReviewedAt: new Date(),
        verificationReviewedById: reviewer.id,
        rejectionReason: decision === "REJECTED" ? reason : null,
      },
      select: { id: true, name: true, verification: true, rejectionReason: true },
    });

    await audit({
      actorId: reviewer.id,
      action: decision === "VERIFIED" ? "KYC_APPROVED" : "KYC_REJECTED",
      targetType: "User",
      targetId: target.id,
      summary:
        decision === "VERIFIED"
          ? `Verified ${target.email} (${target.role.toLowerCase()})`
          : `Rejected ${target.email} — ${reason}`,
      metadata: { role: target.role, reason: reason ?? null },
    });

    res.json(updated);
  }),
);
