'use server';
import 'server-only'

import { currentUser } from "@clerk/nextjs";
import { prisma } from "./initializers/prisma";
import { redirect } from "next/navigation";
import { User } from "@prisma/client";
import { User as ClerkUser } from '@clerk/nextjs/dist/types/server';
import { headers } from 'next/headers'

export const getPrimaryEmail = async (user: ClerkUser) => {
  const primaryEmailAddressId = user.primaryEmailAddressId!;
  const email = user.emailAddresses.find(email => email.id === primaryEmailAddressId)!.emailAddress;

  return email;
}

export const getSignedInUser = async (
  options?: Omit<Parameters<typeof prisma.user.findUnique>[0], "where">
) => {
  const userSession = await currentUser();
  if (!userSession) {
    throw "No user session found";
  }

  const email = await getPrimaryEmail(userSession);
  const user = await prisma.user.findFirst({ where: { email, isActive: true }, ...options });

  if (!user) {
    console.error(`No registered user with email '${email}'`);
    return redirect("/sign-in");
  }

  return user;
};

export const portfolioGuard = async (user: User, portfolioId: string) => {
  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
  });
  if (!portfolio) throw new Error("No such portfolio");

  if (portfolio.userId !== user.id) {
    throw new Error("You don't have access to this portfolio");
  }

  return portfolio;
};
