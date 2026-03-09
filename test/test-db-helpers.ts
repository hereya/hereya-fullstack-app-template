import { randomBytes } from "node:crypto";
import pg from "pg";
import { PrismaClient } from "~/generated/prisma/client/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function generateDatabaseUrl() {
  const randomDbName = `db_${randomBytes(8).toString("hex")}`;
  const dbUrl = `${process.env.POSTGRES_ROOT_URL}/${randomDbName}`;
  const pgClient = new pg.Client({
    connectionString: process.env.POSTGRES_URL,
  });
  await pgClient.connect();
  await pgClient.query(`CREATE DATABASE ${randomDbName}`);
  await pgClient.end();
  return dbUrl;
}

async function dropDatabase(url: string) {
  const pgClient = new pg.Client({
    connectionString: process.env.POSTGRES_URL,
  });
  await pgClient.connect();
  const dbName = url.split("/").pop();
  await pgClient.query(`
    SELECT pg_terminate_backend(pg_stat_activity.pid)
    FROM pg_stat_activity
    WHERE pg_stat_activity.datname = '${dbName}'
    AND pid <> pg_backend_pid()
  `);
  await pgClient.query(`DROP DATABASE ${dbName}`);
  await pgClient.end();
}

async function migrateDatabase(url: string) {
  const { execSync } = await import("node:child_process");
  execSync(`npx prisma migrate deploy`, {
    env: {
      ...process.env,
      POSTGRES_URL: url,
    },
  });
}

export async function prepareTestDatabase() {
  const dbUrl = await generateDatabaseUrl();
  await migrateDatabase(dbUrl);
  const adapter = new PrismaPg({ connectionString: dbUrl });
  const db = new PrismaClient({ adapter });
  return {
    db,
    cleanup: async () => {
      await db.$disconnect();
      await dropDatabase(dbUrl);
    },
  };
}
