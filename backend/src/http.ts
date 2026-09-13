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

  // Postgres itself under pressure rather than a bug in the query. 53200 is
  // "out of shared memory" (lock table exhausted — max_locks_per_transaction on
  // a shared host), 53300 too many connections, 53400 too many locks. These are
  // transient by nature, so return a retryable 503 rather than a 500 that tells
  // the client to give up on a request that would succeed a second later.
  const pgCode: string | undefined =
    err instanceof Prisma.PrismaClientUnknownRequestError
      ? (/code: "(\d{5})"/.exec(String(err.message))?.[1] ?? undefined)
      : undefined;
  if (pgCode && ["53200", "53300", "53400"].includes(pgCode)) {
    console.error(`Postgres out of resources (${pgCode})`);
    return res
      .status(503)
      .json({ error: "The server is busy right now. Try that again in a moment." });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return res.status(409).json({ error: "That record already exists" });
    if (err.code === "P2025") return res.status(404).json({ error: "Not found" });
  }

  console.error(err);
  return res.status(500).json({ error: "Something went wrong on our side. Please try again." });
}
