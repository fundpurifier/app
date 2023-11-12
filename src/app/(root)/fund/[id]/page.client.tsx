"use client"

import React from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import {
  Trash,
  Settings,
  Banknote,
  Scale,
  MoreVertical,
  Plus,
  RefreshCw,
} from "lucide-react"
import { deleteFund, getPortfolio } from "./actions"
import { useInvestModal } from "@/hooks/useInvestModal"
import { useFundSettingsModal } from "@/hooks/useFundSettingsModal"
import { useRecurringInvestmentModal } from "@/hooks/useRecurringInvestmentModal"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import InvestFundModal from "@/components/InvestFundModal"
import EditSettingsModal from "./EditSettingsModal"
import RecurringInvestmentModal from "./RecurringInvestmentModal"
import { PortfolioWithSlices } from "@/types"
import { Fund } from "@prisma/client"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import useSWR, { SWRConfig } from "swr"
import { PORTFOLIO, params } from "@/swr"

interface Props {
  portfolio: Awaited<ReturnType<typeof fetcher>>
  fund: Fund
  children: React.ReactNode
}

const fetcher = async (url: string) => {
  const { portfolioId } = params(url)
  if (!portfolioId) throw new Error("PortfolioId not found in URL")

  console.log("Fetching portfolio", portfolioId)
  return getPortfolio(portfolioId)
}

export default function Page({ portfolio: fallback, fund, children }: Props) {
  const { data, error } = useSWR(PORTFOLIO(fallback.id), fetcher)
  type Data = Awaited<ReturnType<typeof fetcher>>
  const portfolio: Data = data || fallback

  const isMigrated = portfolio.fundIsin === "MIGRATED"
  const investModal = useInvestModal()
  const settingsModal = useFundSettingsModal()
  const recurringInvestmentModal = useRecurringInvestmentModal()
  const router = useRouter()
  const { toast } = useToast()

  const fundSettings = {
    trackChanges: portfolio.trackChanges,
    // rebalanceOnChange: portfolio.rebalanceOnChange,
    allowDoubtful: portfolio.allowDoubtful,
    allowUnrated: portfolio.allowUnrated,
    reinvestOnSell: portfolio.reinvestOnSell,
    onNonCompliance: portfolio.onNonCompliance as "sell" | "wait" | "notify",
  }

  async function confirmDeleteFund() {
    if (confirm("Are you sure you want to delete this fund?")) {
      const success = await deleteFund(portfolio.id)
      if (!success) {
        alert("The portfolio must be empty before you can delete it.")
        return
      }

      // Redirect
      router.push("/")
      toast({
        title: `${fund.name} deleted`,
        description: `Your filtered fund has been deleted.`,
      })
    }
  }

  return (
    <>
      <div className="pad">
        <div className="flex flex-row items-center justify-between space-x-2 md:justify-end">
          {isMigrated ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <span tabIndex={0}>
                    <Button
                      onClick={() =>
                        investModal.open({ portfolio, intent: "buy" })
                      }
                      disabled
                      style={{ pointerEvents: "none" }}
                    >
                      Invest in Filtered {fund.symbol}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="w-64">
                  <p>
                    Migrated Positions can <strong>only be sold</strong>. You
                    cannot invest more into migrated positions.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <Button
              onClick={() => investModal.open({ portfolio, intent: "buy" })}
            >
              Invest in Filtered {fund.symbol}
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger className="outline outline-muted p-2.5 rounded-sm focus:outline-foreground">
              <MoreVertical className="w-4 h-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={settingsModal.open}
                disabled={isMigrated}
              >
                <Settings className="w-4 h-4 mr-2" />
                <span>Fund settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => investModal.open({ portfolio, intent: "sell" })}
              >
                <Banknote className="w-4 h-4 mr-2" />
                <span>Withdraw</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  investModal.open({ portfolio, intent: "rebalance" })
                }
              >
                <Scale className="w-4 h-4 mr-2" />
                <span>Rebalance</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={recurringInvestmentModal.open}
                disabled={isMigrated}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                <span>Recurring buy</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={confirmDeleteFund}>
                <Trash className="w-4 h-4 mr-2" />
                <span>Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {children}
      </div>

      <InvestFundModal />
      <EditSettingsModal
        portfolioId={portfolio.id}
        symbol={fund.symbol}
        defaultValues={fundSettings}
      />
      <RecurringInvestmentModal
        portfolioId={portfolio.id}
        symbol={fund.symbol}
      />
    </>
  )
}
