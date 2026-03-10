import { prepareTestDatabase } from "test/test-db-helpers";
import { createTestUser } from "test/user-helpers";
import type { PrismaClient } from "~/generated/prisma/client/client";
import { randomUUID } from "crypto";

async function createTestPasskey(
  db: PrismaClient,
  userId: string,
  name: string,
  credentialId?: string
) {
  const id = randomUUID();
  const cId = credentialId ?? randomUUID();
  await db.$executeRawUnsafe(
    `INSERT INTO "Passkey" (id, "userId", name, "credentialId", "credentialPublicKey", counter, transports, "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
    id,
    userId,
    name,
    cId,
    Buffer.from([1, 2, 3]),
    0,
    ["internal"]
  );
  return { id, name, credentialId: cId };
}

describe("profile - passkey management", () => {
  let db: PrismaClient;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    ({ db, cleanup } = await prepareTestDatabase());
  });

  afterAll(async () => {
    await cleanup();
  });

  describe("list passkeys", () => {
    it("returns passkeys for a user ordered by creation date", async () => {
      const user = await createTestUser(db, "list@example.com");
      await createTestPasskey(db, user.id, "Work Laptop");
      await createTestPasskey(db, user.id, "Phone");

      const passkeys = await db.passkey.findMany({
        where: { userId: user.id },
        select: { id: true, name: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      });

      expect(passkeys).toHaveLength(2);
      expect(passkeys[0].name).toBe("Work Laptop");
      expect(passkeys[1].name).toBe("Phone");
    });
  });

  describe("rename passkey", () => {
    it("updates the passkey name", async () => {
      const user = await createTestUser(db, "rename@example.com");
      const passkey = await createTestPasskey(db, user.id, "Old Name");

      const result = await db.passkey.updateMany({
        where: { id: passkey.id, userId: user.id },
        data: { name: "New Name" },
      });
      expect(result.count).toBe(1);

      const updated = await db.passkey.findFirst({
        where: { id: passkey.id },
        select: { name: true },
      });
      expect(updated?.name).toBe("New Name");
    });

    it("does not allow renaming another user's passkey", async () => {
      const userA = await createTestUser(db, "ownerA@example.com");
      const userB = await createTestUser(db, "ownerB@example.com");
      const passkey = await createTestPasskey(db, userA.id, "A's key");

      const result = await db.passkey.updateMany({
        where: { id: passkey.id, userId: userB.id },
        data: { name: "Stolen" },
      });
      expect(result.count).toBe(0);

      const unchanged = await db.passkey.findFirst({
        where: { id: passkey.id },
        select: { name: true },
      });
      expect(unchanged?.name).toBe("A's key");
    });
  });

  describe("delete passkey", () => {
    it("deletes a passkey", async () => {
      const user = await createTestUser(db, "delete@example.com");
      const passkey = await createTestPasskey(db, user.id, "To Delete");

      const result = await db.passkey.deleteMany({
        where: { id: passkey.id, userId: user.id },
      });
      expect(result.count).toBe(1);

      const deleted = await db.passkey.findFirst({
        where: { id: passkey.id },
        select: { id: true },
      });
      expect(deleted).toBeNull();
    });

    it("does not allow deleting another user's passkey", async () => {
      const userA = await createTestUser(db, "deleteOwnerA@example.com");
      const userB = await createTestUser(db, "deleteOwnerB@example.com");
      const passkey = await createTestPasskey(db, userA.id, "A's key");

      const result = await db.passkey.deleteMany({
        where: { id: passkey.id, userId: userB.id },
      });
      expect(result.count).toBe(0);

      const stillExists = await db.passkey.findFirst({
        where: { id: passkey.id },
        select: { id: true },
      });
      expect(stillExists).not.toBeNull();
    });
  });

  describe("default passkey naming", () => {
    it("generates sequential default names", async () => {
      const user = await createTestUser(db, "sequential@example.com");

      const count1 = await db.passkey.count({ where: { userId: user.id } });
      await createTestPasskey(db, user.id, `Passkey ${count1 + 1}`);

      const count2 = await db.passkey.count({ where: { userId: user.id } });
      await createTestPasskey(db, user.id, `Passkey ${count2 + 1}`);

      const passkeys = await db.passkey.findMany({
        where: { userId: user.id },
        select: { name: true },
        orderBy: { createdAt: "asc" },
      });

      expect(passkeys[0].name).toBe("Passkey 1");
      expect(passkeys[1].name).toBe("Passkey 2");
    });
  });
});
