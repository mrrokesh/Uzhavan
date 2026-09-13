import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/auth.js";

/**
 * Set one account's password from the command line.
 *
 * Exists because the seed can't do it. Its upsert only touches `role` on an
 * account that already exists — re-seeding a live database must not silently
 * reset somebody's password — so ADMIN_PASSWORD has no effect once the admin
 * is there. And a password can't be set with a plain SQL UPDATE either: hashes
 * here are peppered with PASSWORD_PEPPER before bcrypt, so anything written by
 * hand simply won't verify.
 *
 *   npm run set-password -- admin@uzhavan.app 'a long passphrase'
 *
 * Reads DATABASE_URL and PASSWORD_PEPPER from the environment, so point it at
 * production by exporting the production DATABASE_URL first.
 */
const prisma = new PrismaClient();

async function main() {
  const [email, password] = process.argv.slice(2);

  if (!email || !password) {
    console.error("Usage: npm run set-password -- <email> '<new password>'");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Use at least 8 characters.");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    console.error(`No account with the email ${email}`);
    process.exit(1);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(password),
      // Any lockout from failed attempts is now meaningless.
      failedLogins: 0,
      lockedUntil: null,
    },
  });

  console.log(`Password set for ${user.email} (${user.role}).`);
  console.log("Nothing about it is printed here or written to a log.");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
