"use server";

import { prisma } from "@/initializers/prisma";

export async function getAllFunds() {
  // This endpoint doesn't require protection

  const funds = await prisma.fund.findMany();
  return funds;
}
