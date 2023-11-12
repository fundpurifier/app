"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAddFundModal } from "@/hooks/useAddFundModal";

export default function () {
  const modal = useAddFundModal();
  const router = useRouter();

  return (
    <>
      <DialogHeader>
        <DialogTitle>Filtered Fund ready 🎉</DialogTitle>
      </DialogHeader>
      <div>
        <p className="mt-3 leading-relaxed">
          Congratulations! You've finished making your very own filtered version
          of {modal.settings.symbol}.
        </p>
        <p className="mt-3 leading-relaxed">
          Now, you're ready to invest in it.
        </p>
        <div className="h-6"></div>
      </div>
      <DialogFooter>
        <Button
          onClick={() => {
            modal.close();
            router.push(`/fund/${modal.portfolioId}`)
          }}
        >
          Invest in Filtered {modal.settings.symbol} &rarr;
        </Button>
      </DialogFooter>
    </>
  );
}