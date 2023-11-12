import { ClosedOrder } from "@prisma/client";

export type Position = {
  symbol: string;
  qty: number;
  costBasis: number; // Cost basis for the entire remaining position (NOT per share)
  avgCostPerShare: number /* for remaining shares (assuming avg lot matching method) */;
  realizedPnl: number /* again, (assuming avg lot matching method) */;
};

export type PositionWithMarketValue = Position & {
  sharePrice: number;
  marketValue: number;
  unrealizedPnl: number;
};

export type Order = Pick<
  ClosedOrder,
  | "status"
  | "side"
  | "symbol"
  | "filledQty"
  | "filledAvgPrice"
  | "orderCreatedAt"
>;
