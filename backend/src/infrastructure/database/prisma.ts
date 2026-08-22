import { PrismaClient } from "@prisma/client";
import { config } from "../../config";

// Single shared Prisma client instance for the whole API process.
export const prisma = new PrismaClient({
  log: config.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});
