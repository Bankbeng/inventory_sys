import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL must be configured");
}

const databaseConnection = new URL(databaseUrl);
const databaseName = decodeURIComponent(databaseConnection.pathname.slice(1));
if (!databaseConnection.hostname || !databaseConnection.username || !databaseName) {
  throw new Error("DATABASE_URL must include a host, username, and database name");
}

const adapter = new PrismaMariaDb({
  host: databaseConnection.hostname,
  port: databaseConnection.port ? Number(databaseConnection.port) : 3306,
  user: decodeURIComponent(databaseConnection.username),
  password: decodeURIComponent(databaseConnection.password),
  database: databaseName,
  ssl: { rejectUnauthorized: true },
});

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
