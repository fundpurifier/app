import { getSignedInUser } from "@/helpers.server";
import PageClient from "./page.client";
import { StockMiniSchema } from "./types";

export const metadata = {
  title: "Settings | Amal Invest",
}

export default async function Page() {
    const user = await getSignedInUser({
        include: {
            whitelist: true,
            blacklist: true,
        }
    }) as any;

    const whitelist = user.whitelist.map(StockMiniSchema.parse)
    const blacklist = user.blacklist.map(StockMiniSchema.parse)

    return (
        <PageClient user={user} initialBlacklist={blacklist} initialWhitelist={whitelist} />
    )
}