import { prisma } from "@/initializers/prisma";
import { User } from "@prisma/client";

export const getActiveUserById = async (
  userId: string
): Promise<User | null> => {
  const user = prisma.user.findFirst({
    where: {
      id: userId,
      isActive: true,
      alpacaToken: {
        not: null,
      },
    },
  });

  return user;
};

export const getActiveUsers = async () => {
  return prisma.user.findMany({
    where: {
      isActive: true,
      alpacaToken: {
        not: null,
      },
    },
  });
};

export async function getToken() {
  const randomUser = await prisma.user.findFirst({
    where: {
      isActive: true,
    },
    select: {
      alpacaToken: true,
    },
  });

  if (!randomUser) throw new Error("No active users found; unable to sync using any token");
  return randomUser.alpacaToken!;
}