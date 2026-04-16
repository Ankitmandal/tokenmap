import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

let prisma: InstanceType<typeof PrismaClient>;

declare global {
  var __db__: InstanceType<typeof PrismaClient> | undefined;
}

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");

  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

if (process.env.NODE_ENV === "production") {
  prisma = createClient();
} else {
  if (!global.__db__) {
    global.__db__ = createClient();
  }
  prisma = global.__db__;
}

export { prisma };
