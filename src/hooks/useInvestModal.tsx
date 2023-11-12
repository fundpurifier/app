import { PortfolioWithSlices } from "@/types"
import { create } from "zustand"

interface OpenParams {
  portfolio: PortfolioWithSlices
  intent: "buy" | "sell" | "rebalance"
}

interface Store {
  isOpen: boolean
  intent: "buy" | "sell" | "rebalance"
  portfolio: PortfolioWithSlices | null
  busy: boolean
  amount: number
  isLiquidation: boolean
  confetti: boolean
  step: number

  open: (params: OpenParams) => void
  close: () => void
  setAmount: (amount: number) => void
  setIsLiquidation: (isLiquidation: boolean) => void
  setBusy: (busy: boolean) => void
  setConfetti: () => void
  forward: () => void
}

export const useInvestModal = create<Store>((set) => ({
  isOpen: false,
  intent: "buy",
  portfolio: null,
  busy: false,
  amount: 0,
  isLiquidation: false,
  confetti: false,
  step: 0,

  open: ({ portfolio, intent }: OpenParams) =>
    set({
      step: intent === "rebalance" ? 1 : 0,
      isOpen: true,
      portfolio,
      intent,
    }),
  close: () => set({ isOpen: false }),
  setAmount: (amount) => set({ amount }),
  setIsLiquidation: (isLiquidation) => set({ isLiquidation }),
  setBusy: (busy) => set({ busy }),
  setConfetti: () => set({ confetti: false }),
  forward: () => set((state) => ({ step: state.step + 1 })),
}))
