"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import Loading from "@/components/Loading";
import ChooseFundStep from "./ChooseFundStep";
import FundSettingsStep from "./FundSettingsStep";
import FundCreatedStep from "./FundCreatedStep";
import Confetti from "@/components/FullScreenConfetti";
import { useAddFundModal } from "@/hooks/useAddFundModal";

const Steps = [ChooseFundStep, FundSettingsStep, FundCreatedStep];

function AddFundModal() {
  const modal = useAddFundModal();
  const StepComponent = Steps[modal.step];

  return (
    <>
      {modal.isOpen && modal.step === 2 && (
        <Confetti />
      )}

      <Dialog open={modal.isOpen} onOpenChange={modal.close}>
        <DialogContent className="sm:max-w-[425px]">
          <div className="relative">
            <Loading show={modal.busy} />
            <StepComponent />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default AddFundModal;
