import { PrismaClient } from "@prisma/client";
export const prisma = new PrismaClient();
prisma.$queryRaw`PRAGMA journal_mode = WAL;`;
