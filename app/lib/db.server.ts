import { PrismaClient } from "~/generated/prisma/client/client";
import { PrismaPg } from "@prisma/adapter-pg";

let prisma: PrismaClient;

export function getDb(): PrismaClient {
  if (!prisma) {
    const adapter = new PrismaPg({
      connectionString: process.env.POSTGRES_URL,
    });
    prisma = new PrismaClient({ adapter });
  }
  return prisma;
}
