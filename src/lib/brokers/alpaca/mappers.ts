import { RawOrder } from "@master-chief/alpaca/@types/entities";
import type { ClosedOrder, ListedAsset } from "@prisma/client";
import { AssetResponse } from "./types";
import { getSliceId } from "@/helpers";

export function alpacaOrderToDb(order: RawOrder) {
  return {
    id: order.id,
    symbol: order.symbol,
    side: order.side,
    filledQty: Number(order.filled_qty),
    filledAvgPrice: Number(order.filled_avg_price),
    type: order.type,
    status: order.status,
    sliceId: getSliceId(order.client_order_id),
    raw: JSON.stringify(order),
    orderSubmittedAt: new Date(order.submitted_at),
    orderCreatedAt: new Date(order.created_at),
  } as ClosedOrder;
}

// export function dbOrderToAlpaca(order: ClosedOrder) {
//   return {
//     id: order.id,
//     status: order.status,
//     side: order.side,
//     symbol: order.symbol,
//     filled_qty: order.filledQty.toString(),
//     created_at: order.createdAt.toISOString(),
//   } as RawOrder;
// }

type AlpacaAssetWithISIN = AssetResponse[0] & { isin: string };

export function alpacaAssetToDb(
  asset: AlpacaAssetWithISIN
): Pick<ListedAsset, "id" | "isin" | "symbol" | "name" | "isActive"> {
  return {
    id: asset.id,
    isin: asset.isin,
    symbol: asset.symbol,
    name: asset.name,
    isActive: asset.status === "active",
  };
}
