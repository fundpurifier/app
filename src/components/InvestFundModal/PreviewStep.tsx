"use client"

import React from "react"
import { PositionSliceWithNotionalOrder, PositionSliceWithOrderDetails } from "@/services/portfolio/order"
import { n, q } from "@/helpers"
import { previewInvestment } from "./actions"

import {
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useInvestModal } from "@/hooks/useInvestModal"
import assert from "assert"

export default function () {
  const modal = useInvestModal()
  const { portfolio, amount, setBusy, close, forward, intent, isLiquidation } =
    modal
  assert(portfolio, "Portfolio is required")
  const [orders, setOrders] = React.useState<PositionSliceWithOrderDetails[]>(
    []
  )

  React.useEffect(() => {
    setBusy(true)
    previewInvestment(portfolio.id, amount, isLiquidation).then((preview) => {
      setOrders(preview)
      setBusy(false)
    })
  }, [])

  const totalBuy = (orders as PositionSliceWithNotionalOrder[]).reduce(
    (sum, order) => (order.notional > 0 ? sum + order.notional : sum),
    0
  )
  const totalSell = (orders as PositionSliceWithNotionalOrder[]).reduce(
    (sum, order) => (order.notional < 0 ? sum + Math.abs(order.notional) : sum),
    0
  )

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {intent === "rebalance" ? (
            <>Rebalance {portfolio.title}</>
          ) : (
            <>
              {intent === "buy" ? "Buy" : "Sell"}{' '}
              <span className="text-primary">{n(Math.abs(amount))}</span> of{' '}
              {portfolio.title}
            </>
          )}
        </DialogTitle>
        <DialogDescription>
          {intent === "rebalance"
            ? `This rebalance will result in buying assets worth ${n(
              totalBuy
            )} and selling assets worth ${n(totalSell)}.`
            : ""}{" "}
          Please review these orders carefully.
        </DialogDescription>
      </DialogHeader>
      <ScrollArea className="h-64 my-4">
        <ul role="list" className="divide-y divide-gray-100">
          {orders.map(({ listedAsset, sharePrice, ...p }, i) =>
            p.orderType === "notional" ? (
              <li
                key={i}
                className="relative flex justify-between py-5 gap-x-6 hover:bg-gray-50 sm:px-2"
              >
                <div className="flex gap-x-4">
                  {/* <img
                className="flex-none w-12 h-12 rounded-full bg-gray-50"
                src={`https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/IQ.svg`}
                alt=""
              /> */}
                  <div className="flex-auto min-w-0">
                    <p className="text-sm font-semibold leading-6 text-gray-900">
                      {listedAsset.name}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-gray-500 truncate">
                      {p.notional > 0 ? "Buy" : "Sell"} {listedAsset.symbol}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <p className="text-sm leading-6 text-gray-900">
                    {n(p.notional)}
                  </p>

                  <p className="mt-1 text-xs leading-5 text-right text-gray-500">
                    {q(p.notional / sharePrice)} sh @ {n(sharePrice)}/sh
                  </p>
                </div>
              </li>
            ) : (
              <li
                key={i}
                className="relative flex justify-between py-5 gap-x-6 hover:bg-gray-50 sm:px-6 lg:px-8"
              >
                <div className="flex gap-x-4">
                  {/* <img
              className="flex-none w-12 h-12 rounded-full bg-gray-50"
              src={`https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/IQ.svg`}
              alt=""
            /> */}
                  <div className="flex-auto min-w-0">
                    <p className="text-sm font-semibold leading-6 text-gray-900">
                      {listedAsset.name}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-gray-500 truncate">
                      {p.qty > 0 ? "Buy" : "Sell"} {listedAsset.symbol}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <p className="text-sm leading-6 text-gray-900">
                    ~{n(p.qty * sharePrice)}
                  </p>

                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    {q(p.qty / sharePrice)} shares @ {n(sharePrice)}
                  </p>
                </div>
              </li>
            )
          )}
        </ul>
      </ScrollArea>
      <DialogFooter>
        <Button type="button" onClick={close} variant={"ghost"}>
          Cancel
        </Button>
        <Button type="button" onClick={forward}>
          Submit {orders.length} order{orders.length > 1 ? "s" : ""} &rarr;
        </Button>
      </DialogFooter>
    </>
  )
}
