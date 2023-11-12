"use client";

import React from "react";
import FundDropdown from "@/components/FundDropdown";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAddFundModal } from "@/hooks/useAddFundModal";

interface Fund {
  symbol: string, name: string
}
const popularFunds: Fund[] = [
  { symbol: "SPY", name: "SPDR S&P 500 ETF Trust" },
  { symbol: "QQQ", name: "Invesco QQQ Trust" },
  { symbol: "VTI", name: "Vanguard Total Stock Market ETF" },
  { symbol: "ARKK", name: "ARK Innovation ETF" },
];

function ChooseFundStep() {
  const modal = useAddFundModal();

  function handleClick({ symbol }: { symbol: string }) {
    modal.setSettings({ symbol });
    modal.forward();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create Filtered Fund</DialogTitle>
        <DialogDescription>
          Search for the ETF or Mutual fund you'd like to filter below:
        </DialogDescription>
      </DialogHeader>
      <div>
        <FundDropdown className="my-4" onChange={handleClick} />

        <div className="font-medium text-slate-500 mt-10">Popular funds</div>
        <ul className="mt-4">
          {popularFunds.map((fund) => (
            <PopularFund key={fund.symbol} fund={fund} onClick={handleClick} />
          ))}
        </ul>
      </div>
    </>
  );
}

function PopularFund({ fund, onClick }: { fund: Fund, onClick: (fund: Fund) => void }) {
  return (
    <li className="mt-3">
      <button
        className="flex flex-row items-center gap-x-2 text-slate-500"
        onClick={() => onClick(fund)}
      >
        <div className="py-1 px-2 rounded-md bg-slate-100 text-xs font-semibold w-14">
          {fund.symbol}
        </div>
        <div className="flex-1 text-ellipsis whitespace-nowrap text-sm">
          {fund.name}
        </div>
      </button>
    </li>
  );
}

export default ChooseFundStep;
