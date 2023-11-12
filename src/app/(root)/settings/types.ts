import { ListedAsset } from "@prisma/client";
import { z } from "zod";

export type StockMini = Pick<ListedAsset, "id" | "symbol" | "name">;

export const StockMiniSchema = z.object({
    id: z.string(),
    symbol: z.string(),
    name: z.string(),
})