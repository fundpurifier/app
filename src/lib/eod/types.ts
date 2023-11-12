import { z } from "zod";

export const BulkLastDayResponseSchema = z.array(
  z.object({
    code: z.string(),
    exchange_short_name: z.string(),
    date: z.string(),
    open: z.number(),
    high: z.number(),
    low: z.number(),
    close: z.number(),
    adjusted_close: z.number(),
    volume: z.number(),
  })
);

export type BulkLastDayResponse = z.infer<typeof BulkLastDayResponseSchema>;
