"use client";

import React from "react";
import Loading from "@/components/Loading";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import Confetti from "@/components/FullScreenConfetti"
import { useInvestModal } from "@/hooks/useInvestModal";

import SetAmountStep from "./SetAmountStep";
import PreviewStep from "./PreviewStep";
import SummaryStep from "./SummaryStep";

const Steps = [SetAmountStep, PreviewStep, SummaryStep];

function InvestFundModal() {
  const modal = useInvestModal();
  const StepComponent = Steps[modal.step];

  return (
    <>
      {modal.confetti && (
        <div className="z-[101] absolute inset-0 pointer-events-none">
          <Confetti />
        </div>
      )}

      <Dialog open={modal.isOpen} onOpenChange={modal.close}>
        <DialogContent className="md:max-w-md overflow-y-scroll max-h-screen">
          <div className="relative inset-0">
            <Loading show={modal.busy} />
            <StepComponent />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default InvestFundModal;
