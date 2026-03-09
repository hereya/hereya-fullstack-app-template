import type { PrismaClient } from "~/generated/prisma/client/client";

export async function createTestUser(
  db: PrismaClient,
  email: string = "test@example.com",
  opts: { isAdmin?: boolean; isActive?: boolean } = {}
) {
  return db.user.create({
    data: {
      email,
      isAdmin: opts.isAdmin ?? false,
      isActive: opts.isActive ?? true,
    },
  });
}
