"use client"

import React from "react"
import { execute } from "./actions"
import { useInvestModal } from "@/hooks/useInvestModal"
import assert from "assert"
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "../ui/button"
import { n } from "@/helpers"

export default function () {
  const modal = useInvestModal()
  const { portfolio, amount, busy, intent, setBusy, isLiquidation, close } =
    modal
  assert(portfolio, "Portfolio is required")

  React.useEffect(() => {
    setBusy(true)
    execute(portfolio.id, amount, isLiquidation).then((marketStatus) => {
      setBusy(false)
    })
  }, [])

  if (busy) return <div className="py-16">Submitting orders&hellip;</div>

  return (
    <>
      <DialogHeader>
        <DialogTitle>Orders submitted</DialogTitle>
        <DialogDescription>
          Your orders {intent === "rebalance" ? "" : `for ${n(amount)}`} have
          been submitted. If the market is open, they should be executed within
          a minute or two. Check the "Activity Log" for details.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button onClick={modal.close}>Done</Button>
      </DialogFooter>
    </>
  )
}
