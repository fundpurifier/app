import { z } from "zod";

// See https://alpaca.markets/docs/api-references/market-data-api/stock-pricing-data/historical/#query-parameters-9
export type Timeframe =
  | `${number}Min`
  | `${number}Hour`
  | `${number}Day`
  | `${number}Week`
  | `${number}Month`;

export interface GetMultiBarsParams {
  symbols: string[];
  timeframe: Timeframe;
  start?: string;
  end?: string;
  limit?: number;
  adjustment?: "raw" | "split" | "dividend" | "all";
}

export const OrderResponseSchema = z.object({
  id: z.string().uuid(),
  client_order_id: z.string(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
  submitted_at: z.string().nullable(),
  filled_at: z.string().nullable(),
  expired_at: z.string().nullable(),
  canceled_at: z.string().nullable(),
  failed_at: z.string().nullable(),
  replaced_at: z.string().nullable(),
  replaced_by: z.string().uuid().nullable(),
  replaces: z.string().uuid().nullable(),
  asset_id: z.string().uuid(),
  symbol: z.string(),
  asset_class: z.enum(["us_equity", "us_crypto"]),
  notional: z.string().nullable(),
  qty: z.string().nullable(),
  filled_qty: z.string(),
  filled_avg_price: z.string().nullable(),
  order_class: z.enum(["simple", "bracket", "oco", "oto", ""]),
  type: z.enum(["market", "limit", "stop", "stop_limit", "trailing_stop"]),
  side: z.enum(["buy", "sell"]),
  time_in_force: z.string(),
  limit_price: z.string().nullable(),
  stop_price: z.string().nullable(),
  status: z.enum([
    "new",
    "accepted",
    "held",
    "partially_filled",
    "filled",
    "done_for_day",
    "canceled",
    "expired",
    "replaced",
    "pending_cancel",
    "pending_replace",
    "pending_new",
    "accepted_for_bidding",
    "stopped",
    "rejected",
    "suspended",
    "calculated",
  ]),
  extended_hours: z.boolean(),
  legs: z.any(),
  trail_percent: z.string().nullable(),
  trail_price: z.string().nullable(),
  hwm: z.string().nullable(),
});

export type OrderResponse = z.infer<typeof OrderResponseSchema>;

export const OPEN_ORDER_STATES = [
  "new",
  "accepted",
  "held",
  "partially_filled",
  "pending_cancel",
  "pending_replace",
  "accepted_for_bidding",
  "pending_new",
  "stopped",
  "suspended",
  "calculated"
]

export const CLOSED_ORDER_STATES = [
  "filled",
  "canceled",
  "expired",
  "rejected",
  "done_for_day"
]

export const AnnouncementResponseSchema = z.array(
  z.object({
    id: z.string(),
    corporate_action_id: z.string(),
    ca_type: z.string(),
    ca_sub_type: z.string(),
    initiating_symbol: z.string(),
    initiating_original_cusip: z.string(),
    target_symbol: z.string().optional(),
    target_original_cusip: z.string().optional(),
    declaration_date: z.string().nullish(),
    effective_date: z.string().nullable(),
    ex_date: z.string().optional(),
    record_date: z.string().nullable(),
    payable_date: z.string().optional(),
    cash: z.string(),
    old_rate: z.string(),
    new_rate: z.string(),
  })
);

export type AnnouncementResponse = z.infer<typeof AnnouncementResponseSchema>;

export const AssetResponseSchema = z.array(
  z.object({
    id: z.string(),
    class: z.enum(["us_equity", "crypto"]),
    exchange: z.string(),
    symbol: z.string(),
    name: z.string(),
    status: z.enum(["active", "inactive"]),
    tradable: z.boolean(),
    marginable: z.boolean(),
    shortable: z.boolean(),
    easy_to_borrow: z.boolean(),
    fractionable: z.boolean(),
  })
);

export type AssetResponse = z.infer<typeof AssetResponseSchema>;
