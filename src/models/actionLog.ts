import { z } from "zod"

// TODO: This may fail if we add more types later; need to think about how to handle differently-shaped action details over time
const _FundSettingsSchema = z.object({
  trackChanges: z.boolean().default(true),
  allowUnrated: z.boolean().default(false),
  allowDoubtful: z.boolean().default(true),
  reinvestOnSell: z.boolean().default(true),
  onNonCompliance: z.enum(["sell", "wait", "notify"]),
})
export const humanReadableFundSetting = {
  trackChanges: "Track Changes",
  allowUnrated: "Allow Unrated",
  allowDoubtful: "Allow Doubtful",
  reinvestOnSell: "Reinvest On Sell",
  onNonCompliance: "On Non-Compliance",
}
export const FundChangeActionDetails = z.object({
  before: _FundSettingsSchema.partial(),
  after: _FundSettingsSchema.partial(),
})
export type FundChangeActionDetails = z.infer<typeof FundChangeActionDetails>

export const RecurringBuyCreatedActionDetails = z.object({
  startDate: z.date(),
  amount: z.number().positive(),
  frequency: z.enum(["daily", "weekly", "monthly"]),
})

export type RecurringBuyCreatedActionDetails = z.infer<
  typeof RecurringBuyCreatedActionDetails
>

export const TradeActionDetails = z.object({
  requestedAmount: z.number(),
  actualAmount: z.number(),
  isLiquidation: z.boolean().default(false),
  trigger: z
    .enum(["manual", "recurring-buy", "reinvest-on-sell"])
    .default("manual"),
  trades: z.array(
    z.object({
      symbol: z.string(),
      amount: z.number(),
      beforePc: z.number(),
      afterPc: z.number(),
      targetPc: z.number(),
    })
  ),
  errors: z.array(
    z.object({
      symbol: z.string(),
      qty: z.number().optional(),
      notional: z.number().optional(),
      reason: z.string(),
    })
  ),
})

export type TradeActionDetails = z.infer<typeof TradeActionDetails>

export const RebalanceActionDetails = TradeActionDetails
  .omit({ requestedAmount: true, actualAmount: true, isLiquidation: true })
  .extend({
    trigger: z.enum(["manual"]).default("manual"),
  })

export type RebalanceActionDetails = z.infer<typeof RebalanceActionDetails>

export const LiquidationActionDetails = z.object({
  reason: z.enum(["blacklisted", "non-compliant", "removed-from-fund"]),
})

export type LiquidationActionDetails = z.infer<typeof LiquidationActionDetails>
