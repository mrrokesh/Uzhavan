import { PrismaClient, type User } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Every authenticated request starts by loading the signed-in user, and the
 * database is a network hop away. Rows are kept for a few seconds; any write
 * to the User table empties the cache, so a suspension, a KYC decision or a
 * profile edit shows up on the very next request from this process. The TTL
 * only bounds the rare case of a write that reaches User through another model.
 */
const USER_TTL_MS = 15_000;
const userCache = new Map<string, { user: User; at: number }>();

export function getCachedUser(id: string): User | undefined {
  const hit = userCache.get(id);
  if (!hit) return undefined;
  if (Date.now() - hit.at > USER_TTL_MS) {
    userCache.delete(id);
    return undefined;
  }
  return hit.user;
}

export function cacheUser(user: User) {
  if (userCache.size > 5000) userCache.clear();
  userCache.set(user.id, { user, at: Date.now() });
}

const WRITES = new Set(["create", "createMany", "update", "updateMany", "upsert", "delete", "deleteMany"]);

function create() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["warn", "error"],
  }).$extends({
    query: {
      user: {
        async $allOperations({ operation, args, query }) {
          const result = await query(args);
          if (WRITES.has(operation)) userCache.clear();
          return result;
        },
      },
    },
  });
}

// The extension only adds a hook; to callers it is still a PrismaClient.
export const prisma = globalForPrisma.prisma ?? (create() as unknown as PrismaClient);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
