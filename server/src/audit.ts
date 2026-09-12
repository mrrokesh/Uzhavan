import type { Prisma } from "@prisma/client";
import { prisma } from "./db.js";

/**
 * Record a privileged action. Never throws — an audit failure must not take
 * down the operation it was describing, but it should be loud in the log.
 */
export async function audit(entry: {
  actorId: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  summary: string;
  metadata?: Prisma.InputJsonValue;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId ?? null,
        summary: entry.summary,
        metadata: entry.metadata,
      },
    });
  } catch (err) {
    console.error("Audit write failed:", entry.action, err);
  }
}
