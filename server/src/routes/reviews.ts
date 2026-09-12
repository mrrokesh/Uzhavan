import type { ReviewSubject } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { currentUser } from "../session.js";
import { asyncHandler, HttpError } from "../http.js";

export const reviewsRouter = Router();

/**
 * Reputation, earned on completed trades only.
 *
 * Every review hangs off an order. An unattached review is one anybody can
 * write about anybody, which is how a ratings system stops meaning anything —
 * here you can only rate a counterparty you actually traded with, once, after
 * the crop arrived.
 *
 * Three directions, because all three parties take a risk:
 *
 *   buyer  → farm     was the crop what was described?
 *   buyer  → driver   did it arrive, on time, intact?
 *   farmer → buyer    did they take the load and pay for it?
 *
 * That last one matters more than it looks. A marketplace that only lets
 * customers rate suppliers gives suppliers no way to warn each other about a
 * buyer who cancels on arrival.
 */

/** A rating is only meaningful once there are a few. */
const ENOUGH = 3;

const body = z.object({
  subject: z.enum(["FARM", "DRIVER", "BUYER"]),
  stars: z.coerce.number().int().min(1, "Pick 1 to 5 stars").max(5, "Pick 1 to 5 stars"),
  comment: z.string().trim().max(500).optional(),
});

/** Recompute one subject's average from its reviews. Never incremental. */
async function recompute(subject: ReviewSubject, subjectId: string): Promise<void> {
  const stats = await prisma.review.aggregate({
    where: { subject, subjectId },
    _avg: { stars: true },
    _count: true,
  });
  const rating = Math.round((stats._avg.stars ?? 5) * 10) / 10;
  const ratingCount = stats._count;

  if (subject === "FARM") {
    await prisma.farm.update({ where: { id: subjectId }, data: { rating, ratingCount } });
  } else if (subject === "DRIVER") {
    await prisma.driver.update({ where: { id: subjectId }, data: { rating, ratingCount } });
  } else {
    await prisma.user.update({
      where: { id: subjectId },
      data: { buyerRating: rating, buyerRatingCount: ratingCount },
    });
  }
}

/**
 * Who this person may rate on this order, and who they already have.
 *
 * Driving the UI from the server keeps one definition of "reviewable" — a
 * client deciding for itself would drift the moment a rule changed.
 */
reviewsRouter.get(
  "/orders/:orderId/reviews",
  asyncHandler(async (req, res) => {
    const user = await currentUser(req);
    const order = await prisma.order.findUnique({
      where: { id: String(req.params.orderId) },
      include: {
        crop: { include: { farm: { select: { id: true, name: true, ownerId: true } } } },
        booking: { include: { driver: { select: { id: true, name: true } } } },
        buyer: { select: { id: true, name: true, business: true } },
        reviews: true,
      },
    });
    if (!order) throw new HttpError(404, "Order not found");

    const isBuyer = order.buyerId === user.id;
    const isFarmer = order.crop.farm.ownerId === user.id;
    if (!isBuyer && !isFarmer) throw new HttpError(404, "Order not found");

    const delivered = order.status === "DELIVERED";
    const mine = order.reviews.filter((r) => r.authorId === user.id);
    const done = (s: ReviewSubject) => mine.find((r) => r.subject === s) ?? null;

    const can: { subject: ReviewSubject; id: string; name: string; existing: unknown }[] = [];
    if (delivered && isBuyer) {
      can.push({
        subject: "FARM",
        id: order.crop.farm.id,
        name: order.crop.farm.name,
        existing: done("FARM"),
      });
      if (order.booking?.driver) {
        can.push({
          subject: "DRIVER",
          id: order.booking.driver.id,
          name: order.booking.driver.name,
          existing: done("DRIVER"),
        });
      }
    }
    if (delivered && isFarmer) {
      can.push({
        subject: "BUYER",
        id: order.buyer.id,
        name: order.buyer.business ?? order.buyer.name,
        existing: done("BUYER"),
      });
    }

    res.json({
      orderCode: order.code,
      delivered,
      /// False before delivery — nobody can judge a crop that hasn't arrived.
      canReview: can.length > 0,
      subjects: can,
    });
  }),
);

reviewsRouter.post(
  "/orders/:orderId/reviews",
  asyncHandler(async (req, res) => {
    const user = await currentUser(req);
    const { subject, stars, comment } = body.parse(req.body);

    const order = await prisma.order.findUnique({
      where: { id: String(req.params.orderId) },
      include: {
        crop: { include: { farm: { select: { id: true, ownerId: true } } } },
        booking: { select: { driverId: true } },
      },
    });
    if (!order) throw new HttpError(404, "Order not found");

    // Judgement comes after delivery. Before that there is nothing to judge,
    // and a rating written mid-trip is leverage, not feedback.
    if (order.status !== "DELIVERED") {
      throw new HttpError(409, "You can review this once the crop has been delivered");
    }

    const isBuyer = order.buyerId === user.id;
    const isFarmer = order.crop.farm.ownerId === user.id;

    let subjectId: string;
    if (subject === "FARM") {
      if (!isBuyer) throw new HttpError(403, "Only the buyer on this order can review the farm");
      subjectId = order.crop.farm.id;
    } else if (subject === "DRIVER") {
      if (!isBuyer) throw new HttpError(403, "Only the buyer on this order can review the driver");
      if (!order.booking?.driverId) throw new HttpError(409, "No driver carried this order");
      subjectId = order.booking.driverId;
    } else {
      if (!isFarmer) throw new HttpError(403, "Only the farmer on this order can review the buyer");
      subjectId = order.buyerId;
    }

    const review = await prisma.review.upsert({
      where: { orderId_authorId_subject: { orderId: order.id, authorId: user.id, subject } },
      create: {
        orderId: order.id,
        authorId: user.id,
        subject,
        subjectId,
        stars,
        comment: comment || null,
      },
      // Editable, because a first reaction written on the day of a late
      // delivery isn't always the fair one. Still exactly one verdict.
      update: { stars, comment: comment || null },
    });

    await recompute(subject, subjectId);
    res.status(201).json(review);
  }),
);

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** Public reputation for one farm, driver or buyer. */
reviewsRouter.get(
  "/reviews/:subject/:subjectId",
  asyncHandler(async (req, res) => {
    await currentUser(req);
    const subject = String(req.params.subject).toUpperCase();
    if (!["FARM", "DRIVER", "BUYER"].includes(subject)) {
      throw new HttpError(400, "Reviews are of a farm, a driver or a buyer");
    }
    const { limit } = listQuery.parse(req.query);
    const subjectId = String(req.params.subjectId);

    const [rows, stats] = await Promise.all([
      prisma.review.findMany({
        where: { subject: subject as ReviewSubject, subjectId },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          author: { select: { name: true, business: true, district: true } },
          order: { select: { product: true } },
        },
      }),
      prisma.review.aggregate({
        where: { subject: subject as ReviewSubject, subjectId },
        _avg: { stars: true },
        _count: true,
      }),
    ]);

    const count = stats._count;
    res.json({
      // Below a handful, an average is noise dressed as a number. The app shows
      // "new to Uzhavan" rather than a confident 5.0 off one review.
      rating: count > 0 ? Math.round((stats._avg.stars ?? 0) * 10) / 10 : null,
      count,
      established: count >= ENOUGH,
      reviews: rows.map((r) => ({
        id: r.id,
        stars: r.stars,
        comment: r.comment,
        createdAt: r.createdAt,
        product: r.order.product,
        // First name and district only. A wholesale buyer's full business name
        // beside a one-star review is a grudge with an address on it.
        author: r.author.name.split(" ")[0],
        district: r.author.district,
      })),
    });
  }),
);
