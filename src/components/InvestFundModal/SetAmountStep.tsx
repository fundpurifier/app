"use client";
import React from "react";
import { getCash, getPortfolioValue } from "./actions";
import { n } from "@/helpers";

import { DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { HelpCircle } from "lucide-react";
import { useInvestModal } from "@/hooks/useInvestModal";
import assert from "assert";

export default function SetAmountStep() {
  const modal = useInvestModal();
  const { portfolio, forward, busy, setBusy, setAmount, intent, isLiquidation, setIsLiquidation } =
    modal;
  assert(portfolio, "Portfolio is required");

  const [input, setInput] = React.useState("");
  const [upperLimit, setUpperLimit] = React.useState(0);
  const [cashAvailable, setCashAvailable] = React.useState(0);
  const [valid, setValid] = React.useState(false);

  React.useEffect(() => {
    setBusy(true);

    (intent === "buy" ? getCash() : getPortfolioValue(portfolio)).then(
      (limit) => {
        if (intent === "buy") {
          setCashAvailable(limit);

          if (limit > 0) {
            limit -= 0.01; // Allow for SEC/FINRA trading fees
          }
        }

        limit = Math.floor(limit * 100) / 100; // round to 2 decimals

        setUpperLimit(limit);
        setBusy(false);
      }
    );
  }, []);

  React.useEffect(() => {
    const value = parseFloat(input)
    const isValid = !isNaN(value) && value > 0 && value <= upperLimit
    setValid(isValid);

    isValid ?
      setIsLiquidation(intent === "sell" && Math.abs(value - upperLimit) <= 0.1) :
      setIsLiquidation(false);
  }, [input]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const multiplier = intent == "buy" ? 1 : -1;
    const value = parseFloat(input);
    setAmount(multiplier * value);

    forward();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{intent == "buy" ? "Invest in" : "Withdraw from"} {portfolio.title}</DialogTitle>
        <DialogDescription>
          How much would you like to {intent == "buy" ? "invest" : "sell"}?
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit}>
        <div className="relative mt-2 rounded-md shadow-sm">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <span className="text-gray-500 sm:text-sm">$</span>
          </div>
          <input
            type="text"
            name="price"
            id="price"
            className="block w-full rounded-md border-0 py-1.5 pl-7 pr-12 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
            placeholder="0.00"
            aria-describedby="price-currency"
            value={input}
            readOnly={busy}
            onChange={(e) => setInput(e.target.value)}
          />
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            <span className="text-gray-500 sm:text-sm" id="price-currency">
              USD
            </span>
          </div>
        </div>

        <div className="flex flex-row space-x-1 justify-end items-center text-muted-foreground text-sm mt-1 mb-4">
          {intent == "buy" && (
            <>
              <div>Cash available: </div>
              <button type="button" className="font-bold underline-offset-2 underline decoration-muted-foreground decoration-dashed cursor-pointer" onClick={() => setInput(upperLimit.toString())}>{n(cashAvailable)}</button>
              {cashAvailable > 0 &&
                <Popover>
                  <PopoverTrigger>
                    <HelpCircle className="ml-1 h-4 w-4" />
                  </PopoverTrigger>
                  <PopoverContent className="text-sm text-muted-foreground">
                    <p className="mt-1">The maximum buy amount is $0.01 less than your available cash balance.</p>
                    <p className="mt-1">This buffers for SEC/FINRA trading fees, which are typically $0.01 per order.</p>
                    <p className="mt-1">By keeping $0.01 in your account, we prevent your balance from going negative after fees are applied.</p>
                  </PopoverContent>
                </Popover>
              }
            </>
          )}
          {intent == "sell" && (
            <>
              Market value: <span className="font-bold underline-offset-2 underline cursor-pointer" onClick={() => setInput(upperLimit.toString())}>{n(upperLimit)}</span>
            </>
          )}
        </div>
        {isLiquidation && <LiquidationMessage />}
        <DialogFooter>
          <Button
            type="submit"
            disabled={!valid}
          >
            Preview &rarr;
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

function LiquidationMessage() {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Heads up!</AlertTitle>
      <AlertDescription>
        This will liquidate your entire portfolio, selling everything at market price.
      </AlertDescription>
    </Alert>

  )
}