"use server";

import { getSignedInUser } from "@/helpers.server";
import { prisma } from "@/initializers/prisma";
import { refreshUser } from "@/services/fund/refresh";
import connection from "@/workers/connection";
import { Queues } from "@/workers/queues";
import { Queue } from "bullmq";

export async function getAllStocks() {
    return await prisma.listedAsset.findMany({
        where: {
            isStock: true,
        },
        select: {
            id: true,
            symbol: true,
            name: true,
        },
        orderBy: {
            // TODO: Sort by marketCap
            symbol: "asc"
        }
    });
}

export async function updateSettings({ whitelist, blacklist }: { whitelist: string[], blacklist: string[] }) {
    const user = await getSignedInUser();

    // Update settings
    await prisma.user.update({
        where: { id: user.id },
        data: {
            whitelist: { set: whitelist.map(id => ({ id })) },
            blacklist: { set: blacklist.map(id => ({ id })) }
        },
    });

    // Changes to the white/blacklists trigger a re-evaluation of all holdings
    await refreshUser(user.id, 'user-settings-change');
}