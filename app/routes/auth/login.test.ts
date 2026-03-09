import { prepareTestDatabase } from "test/test-db-helpers";
import type { PrismaClient } from "~/generated/prisma/client/client";

describe("login", () => {
  let db: PrismaClient;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    ({ db, cleanup } = await prepareTestDatabase());
  });

  afterAll(async () => {
    await cleanup();
  });

  it("creates a login code", async () => {
    const loginCode = await db.loginCode.create({
      data: { code: "123456", email: "test@example.com" },
    });

    expect(loginCode.code).toBe("123456");
    expect(loginCode.email).toBe("test@example.com");
  });

  it("creates a user as admin when first user", async () => {
    const user = await db.user.create({
      data: { email: "admin@example.com", isAdmin: true },
    });

    expect(user.isAdmin).toBe(true);
    expect(user.isActive).toBe(true);
  });
});
