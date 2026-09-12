import { Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

/** Wrap an async route handler so rejected promises reach the error middleware. */
export function asyncHandler<T extends Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as T, res, next)).catch(next);
  };
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: "Not found" });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
    // Surface the first field message — the client shows it verbatim.
    const first = err.issues[0]?.message;
    return res
      .status(400)
      .json({ error: first ?? "Please check the details you entered", issues: err.issues });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }

  // The database lives on a remote host, so a dropped connection or timeout is
  // a normal transient failure — say so plainly instead of "internal error".
  if (
    err instanceof Prisma.PrismaClientInitializationError ||
    (err instanceof Prisma.PrismaClientKnownRequestError &&
      ["P1001", "P1002", "P1008", "P1017"].includes(err.code))
  ) {
    console.error("Database unreachable:", err.message);
    return res
      .status(503)
      .json({ error: "Can’t reach the server right now. Check your connection and try again." });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return res.status(409).json({ error: "That record already exists" });
    if (err.code === "P2025") return res.status(404).json({ error: "Not found" });
  }

  console.error(err);
  return res.status(500).json({ error: "Something went wrong on our side. Please try again." });
}
