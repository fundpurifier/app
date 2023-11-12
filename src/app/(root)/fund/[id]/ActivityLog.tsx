"use client"

import useSWR, { SWRConfig } from "swr"

import { n, p, q } from "@/helpers"
import {
  FundChangeActionDetails,
  LiquidationActionDetails,
  RebalanceActionDetails,
  RecurringBuyCreatedActionDetails,
  TradeActionDetails,
  humanReadableFundSetting,
} from "@/models/actionLog"
import {
  Trash,
  Sparkles,
  CircleDollarSign,
  MonitorPause,
  Settings,
  Scale,
} from "lucide-react"
import React from "react"
import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"
dayjs.extend(relativeTime)
import { ACTIVITY_LOG_KEY, params } from "@/swr"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { RefreshCw, RefreshCwOff } from "lucide-react"
import { getActionLog } from "./actions"
import { ActionLogWithActionOrders } from "@/types"
import { CLOSED_ORDER_STATES } from "@/lib/brokers/alpaca/types"
import { ActionOrder } from "@prisma/client"

const fetcher = async (url: string) => {
  const { portfolioId } = params(url)
  if (!portfolioId) throw new Error("PortfolioId not found in URL")

  return getActionLog(portfolioId)
}

export default function ActivityLog({ portfolioId, fallback }: any) {
  const { data, error } = useSWR(ACTIVITY_LOG_KEY(portfolioId), fetcher)
  type Data = Awaited<ReturnType<typeof getActionLog>>

  const actionLog: Data = data || fallback

  return (
    <SWRConfig value={{ fallback }}>
      <div className="flex flex-col gap-y-8">
        {actionLog.map((action) => (
          <ActionComponent key={action.id} action={action} />
        ))}
      </div>
    </SWRConfig>
  )
}

function SettingsAdjustedAction({
  action,
}: {
  action: ActionLogWithActionOrders
}) {
  const details: FundChangeActionDetails = JSON.parse(action.details)
  const changedSettings = (
    Object.keys(details.before) as Array<keyof typeof details.before>
  ).filter((key) => details.before[key] !== details.after[key])

  return (
    <div className="flex flex-row w-full gap-x-3">
      <Settings className="w-6 h-6" />
      <Collapsible className="flex-1">
        <CollapsibleTrigger className="w-full">
          <div className="flex flex-row gap-x-3">
            <strong className="flex-1 text-left">Settings Changed</strong>
            <span
              className="text-slate-500"
              title={new Date(action.createdAt).toISOString()}
            >
              {dayjs(action.createdAt).fromNow()}
            </span>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul>
            {changedSettings.map((setting) => (
              <li key={setting}>
                {humanReadableFundSetting[setting]}:{" "}
                <span className="line-through">{details.before[setting]}</span>{" "}
                -&gt; {details.after[setting]}
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

function RecurringBuyCancelledAction({
  action,
}: {
  action: ActionLogWithActionOrders
}) {
  return (
    <div className="flex flex-row w-full gap-x-3">
      <RefreshCwOff className="w-6 h-6" />
      <div className="flex flex-row gap-x-3">
        <strong className="flex-1 text-left">Recurring Buy Cancelled</strong>
        <span
          className="text-slate-500"
          title={new Date(action.createdAt).toISOString()}
        >
          {dayjs(action.createdAt).fromNow()}
        </span>
      </div>
    </div>
  )
}

function RecurringBuyCreatedAction({
  action,
}: {
  action: ActionLogWithActionOrders
}) {
  const details: RecurringBuyCreatedActionDetails = JSON.parse(action.details)

  return (
    <div className="flex flex-row w-full gap-x-3">
      <RefreshCw className="w-6 h-6" />
      <Collapsible className="flex-1">
        <CollapsibleTrigger className="w-full">
          <div className="flex flex-row gap-x-3">
            <strong className="flex-1 text-left">Recurring Buy Created</strong>
            <span
              className="text-slate-500"
              title={new Date(action.createdAt).toISOString()}
            >
              {dayjs(action.createdAt).fromNow()}
            </span>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul>
            <li>Starts: {dayjs(details.startDate).format("DD MMM, YYYY")}</li>
            <li>Amount: {n(details.amount)}</li>
            <li>Frequency: {details.frequency}</li>
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

function FundCreatedAction({ action }: { action: ActionLogWithActionOrders }) {
  const details = JSON.parse(action.details)

  return (
    <div className="flex flex-row w-full gap-x-3">
      <Sparkles className="w-6 h-6" />
      <Collapsible className="flex-1">
        <CollapsibleTrigger className="w-full">
          <div className="flex flex-row justify-between gap-x-3">
            <strong>Fund Created</strong>
            <span
              className="text-slate-500"
              title={new Date(action.createdAt).toISOString()}
            >
              {dayjs(action.createdAt).fromNow()}
            </span>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul>
            <li>Symbol: {details.symbol}</li>
            <li>Track Changes: {details.trackChanges ? "✅" : "❌"}</li>
            <li>
              Rebalance On Change: {details.rebalanceOnChange ? "✅" : "❌"}
            </li>
            <li>Allow Unrated: {details.allowUnrated ? "✅" : "❌"}</li>
            <li>On Non-Compliance: {details.onNonCompliance}</li>
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

function TradeAction({ action }: { action: ActionLogWithActionOrders }) {
  const { requestedAmount, actualAmount, trades, trigger } =
    TradeActionDetails.parse(JSON.parse(action.details))

  return (
    <div className="flex flex-row gap-x-3">
      <CircleDollarSign className="w-6 h-6" />
      <Collapsible className="flex-1">
        <CollapsibleTrigger className="w-full">
          <div className="flex flex-row gap-x-3">
            <div className="flex-1 text-left">
              <strong>
                {requestedAmount > 0 ? "Invested" : "Withdrew"}{" "}
                {n(Math.abs(actualAmount))}
              </strong>{" "}
              in{" "}
              {trades.length > 1 ? `${trades.length} orders` : `a single order`}{" "}
              via{" "}
              {trigger === "manual"
                ? "user-initiated trade"
                : trigger === "recurring-buy"
                  ? "⚡️ auto-invest"
                  : "reinvest on sell"}
            </div>
            <span
              className="text-muted-foreground whitepace-nowrap"
              title={new Date(action.createdAt).toISOString()}
            >
              {dayjs(action.createdAt).fromNow()}
            </span>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="flex flex-col my-4 space-y-2">
            {trades.map((trade, i) => (
              <div key={i}>
                <code className="px-2 py-1 mr-1 rounded-md bg-slate-100 text-slate-700">
                  {trade.symbol}
                </code>
                <span className="font-bold">
                  {trade.amount > 0 ? "Buy" : "Sell"}{" "}
                  {n(Math.abs(trade.amount))}
                </span>{" "}
                from {p(trade.beforePc)} &rarr; {p(trade.afterPc)} (Target{" "}
                {p(trade.targetPc)})
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

function RebalanceAction({ action }: { action: ActionLogWithActionOrders }) {
  const { trades, trigger } =
    RebalanceActionDetails.parse(JSON.parse(action.details))

  return (
    <div className="flex flex-row gap-x-3">
      <Scale className="w-6 h-6" />
      <Collapsible className="flex-1">
        <CollapsibleTrigger className="w-full">
          <div className="flex flex-row gap-x-3">
            <div className="flex-1 text-left">
              <strong>Rebalance</strong>{" "}
              in{" "}
              {trades.length > 1 ? `${trades.length} orders` : `a single order`}{" "}
              via user-initiated request
            </div>
            <span
              className="text-muted-foreground whitepace-nowrap"
              title={new Date(action.createdAt).toISOString()}
            >
              {dayjs(action.createdAt).fromNow()}
            </span>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="flex flex-col my-4 space-y-2">
            {trades.map((trade, i) => (
              <div key={i}>
                <code className="px-2 py-1 mr-1 rounded-md bg-slate-100 text-slate-700">
                  {trade.symbol}
                </code>
                <span className="font-bold">
                  {trade.amount > 0 ? "Buy" : "Sell"}{" "}
                  {n(Math.abs(trade.amount))}
                </span>{" "}
                from {p(trade.beforePc)} &rarr; {p(trade.afterPc)} (Target{" "}
                {p(trade.targetPc)})
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

function LiquidationAction({ action }: { action: ActionLogWithActionOrders }) {
  const { reason } = LiquidationActionDetails.parse(JSON.parse(action.details))

  const raw = (o: ActionOrder) => JSON.parse(o.raw)
  const trades = action.ActionOrder.filter((o) =>
    CLOSED_ORDER_STATES.includes(raw(o).status)
  )
  const totalAmount = trades.reduce(
    (total, trade) => total + raw(trade).filledQty * raw(trade).filledAvgPrice,
    0
  )

  if (totalAmount === 0) {
    // Pending liquidation
    return (
      <div className="flex flex-row gap-x-3">
        <MonitorPause className="w-6 h-6" />
        <span className="flex-1 text-left">
          Pending liquidation at market open for{" "}
          {trades.map((trade) => raw(trade).symbol).join(", ")}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-row gap-x-3">
      <Trash className="w-6 h-6" />
      <Collapsible className="flex-1">
        <CollapsibleTrigger className="w-full">
          <div className="flex flex-row gap-x-3">
            <div className="flex-1 text-left">
              <strong>Liquidated {n(totalAmount)}</strong> in{" "}
              {trades.length > 1
                ? `${trades.length} ${reason} stocks`
                : `a single ${reason} stock`}
            </div>
            <span
              className="text-muted-foreground whitepace-nowrap"
              title={new Date(action.createdAt).toISOString()}
            >
              {dayjs(action.createdAt).fromNow()}
            </span>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="flex flex-col my-4 space-y-2">
            {trades.map((trade, i) => (
              <div key={i}>
                <code className="px-2 py-1 rounded-md bg-slate-100 text-foreground">
                  {raw(trade).symbol}
                </code>
                <span className="ml-1 font-bold text-muted-foreground">
                  Sell {n(raw(trade).filledAvgPrice * raw(trade).filledQty)}
                </span>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

function ActionComponent({ action }: { action: ActionLogWithActionOrders }) {
  switch (action.action) {
    case "trade":
      return <TradeAction action={action} />
    case "fund_created":
      return <FundCreatedAction action={action} />
    case "recurring_buy_created":
      return <RecurringBuyCreatedAction action={action} />
    case "recurring_buy_cancelled":
      return <RecurringBuyCancelledAction action={action} />
    case "liquidation":
      return <LiquidationAction action={action} />
    case "settings_adjusted":
      return <SettingsAdjustedAction action={action} />
    case "rebalance":
      return <RebalanceAction action={action} />
    default:
      return <div>Unknown action</div>
  }
}
