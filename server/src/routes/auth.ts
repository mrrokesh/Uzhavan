import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { hashPassword, needsRehash, signToken, verifyPassword } from "../auth.js";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { currentUser, publicUser } from "../session.js";
import { asyncHandler, HttpError } from "../http.js";
import { resolveDistrict } from "../data/districts.js";

export const authRouter = Router();

const loginBody = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(1),
});

const base = {
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().trim().min(2, "Enter your name"),
  phone: z.string().trim().min(8, "Enter a phone number"),
};

const registerBody = z.discriminatedUnion("role", [
  z.object({
    ...base,
    role: z.literal("BUYER"),
    business: z.string().trim().min(2, "Enter your business name"),
    district: z.string().trim().min(2, "Enter your district"),
    warehouse: z.string().trim().optional(),
    market: z.string().trim().optional(),
  }),
  z.object({
    ...base,
    role: z.literal("FARMER"),
    farmName: z.string().trim().min(2, "Enter your farm name"),
    district: z.string().trim().min(2, "Enter your district"),
    location: z.string().trim().min(2, "Enter your village / town"),
  }),
  z.object({
    ...base,
    role: z.literal("DRIVER"),
    truckName: z.string().trim().min(2, "Enter your vehicle model"),
    plate: z.string().trim().min(4, "Enter your number plate"),
    capacityTons: z.coerce.number().positive("Enter the load capacity"),
    body: z.enum(["Open body", "Closed body"]).default("Open body"),
    price: z.coerce.number().int().positive("Enter your base fare"),
  }),
]);

async function issue(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return { token: signToken(user.id), user: publicUser(user) };
}

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const body = registerBody.parse(req.body);
    const passwordHash = await hashPassword(body.password);

    try {
      const user = await prisma.$transaction(async (tx) => {
        if (body.role === "BUYER") {
          return tx.user.create({
            data: {
              email: body.email,
              passwordHash,
              role: "BUYER",
              name: body.name,
              phone: body.phone,
              avatarKey: "buyer",
              business: body.business,
              district: body.district,
              districtKey: resolveDistrict(body.district)?.name ?? null,
              warehouse: body.warehouse?.trim() || `${body.district} Warehouse`,
              warehouseAddress: `${body.district}, Tamil Nadu`,
              market: body.market?.trim() || "Koyambedu Market, Chennai",
            },
          });
        }

        if (body.role === "FARMER") {
          const created = await tx.user.create({
            data: {
              email: body.email,
              passwordHash,
              role: "FARMER",
              name: body.name,
              phone: body.phone,
              avatarKey: "arul",
              district: body.district,
              districtKey: resolveDistrict(body.district)?.name ?? null,
            },
          });
          await tx.farm.create({
            data: {
              ownerId: created.id,
              name: body.farmName,
              ownerName: body.name,
              district: body.district,
              districtKey: resolveDistrict(body.district)?.name ?? null,
              location: `${body.location}, ${body.district}`,
              avatarKey: "arul",
            },
          });
          return created;
        }

        const created = await tx.user.create({
          data: {
            email: body.email,
            passwordHash,
            role: "DRIVER",
            name: body.name,
            phone: body.phone,
            avatarKey: "selvam",
          },
        });
        const driver = await tx.driver.create({
          data: { userId: created.id, name: body.name, photoKey: "selvam" },
        });
        const capacityKg = Math.round(body.capacityTons * 1000);
        await tx.truck.create({
          data: {
            driverId: driver.id,
            name: body.truckName,
            meta: `${body.body} · ${body.capacityTons} ton`,
            capacityTons: body.capacityTons,
            capacityKg,
            price: body.price,
            body: body.body,
            plate: body.plate.toUpperCase(),
            photoKey: capacityKg <= 2000 ? "miniTruck" : capacityKg >= 5000 ? "lcv" : "truck",
          },
        });
        return created;
      });

      res.status(201).json(await issue(user.id));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new HttpError(409, "An account with this email already exists");
      }
      throw err;
    }
  }),
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = loginBody.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });

    // Same error either way, so this can't be used to discover which emails
    // are registered.
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new HttpError(401, "Email or password is incorrect");
    }

    if (user.status === "BLOCKED") {
      throw new HttpError(
        403,
        user.statusReason
          ? `Your account is blocked: ${user.statusReason}. Contact ${env.supportEmail} to appeal.`
          : `Your account is blocked. Contact ${env.supportEmail} to appeal.`,
      );
    }
    if (user.status === "SUSPENDED") {
      throw new HttpError(
        403,
        user.statusReason
          ? `Your account is temporarily suspended: ${user.statusReason}.`
          : "Your account is temporarily suspended. Contact support.",
      );
    }

    // Transparently upgrade hashes made with an older pepper or a lower cost
    // factor, so raising BCRYPT_ROUNDS migrates everyone without a reset.
    if (needsRehash(user.passwordHash)) {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(password) },
      });
    }

    res.json({ token: signToken(user.id), user: publicUser(user) });
  }),
);

authRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const user = await currentUser(req);
    res.json({ user: publicUser(user) });
  }),
);
