'use server';

import OAuth from "@/services/alpaca-oauth";
import { prisma } from "@/initializers/prisma";
import { getPrimaryEmail } from "@/helpers.server";
import { generateId, requireEnv } from "@/helpers";
import { currentUser } from "@clerk/nextjs";

export async function exchangeCodeForToken(code: string) {
  // Get logged-in user details
  const user = (await currentUser())!;
  const email = await getPrimaryEmail(user);

  // Exchange code for token
  const oauth = new OAuth(requireEnv('ALPACA_CLIENT_ID'))
  const token = await oauth.processOAuthResponse(code)

  // Save to DB
  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: `${user.firstName} ${user.lastName}`,
      id: generateId('usr'),
      alpacaToken: token,
    },
    update: {
      alpacaToken: token,
    },
  })

  return token;
}