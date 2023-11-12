'use client';

import React from "react";
import { Dialog, DialogTitle, DialogContent, DialogDescription, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useFormState } from "react-hook-form"
import * as z from "zod"
import { useFundSettingsModal } from "@/hooks/useFundSettingsModal";
import { updateFund } from "./actions";
import { mutate } from "swr";
import { PORTFOLIO } from "@/swr";
import { useToast } from "@/components/ui/use-toast";

// Make sure to update [actionLog.ts] when you change this schema
// Also, update the AddFundModal schema
export const FormSchema = z.object({
  trackChanges: z.boolean().default(true),
  // rebalanceOnChange: z.boolean().default(false),
  allowUnrated: z.boolean().default(false),
  allowDoubtful: z.boolean().default(true),
  reinvestOnSell: z.boolean().default(true),
  onNonCompliance: z.enum(['sell', 'wait', 'notify']),
})

export type FormType = z.infer<typeof FormSchema>;

interface Props {
  portfolioId: string;
  symbol: string;
  defaultValues: z.infer<typeof FormSchema>;
}

function FundSettingsModal({ portfolioId, symbol, defaultValues }: Props) {
  const modal = useFundSettingsModal();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues,
  })
  const { isDirty } = useFormState({ control: form.control });

  async function onFormSubmit(data: z.infer<typeof FormSchema>) {
    const triggeredRefresh = await updateFund(portfolioId, data);
    mutate(PORTFOLIO(portfolioId));
    toast({
      title: "Fund settings updated",
      description: `Your fund settings have been updated. ${triggeredRefresh ? 'Now refreshing your fund holdings.' : ''}`
    })
    modal.close();
  }

  React.useEffect(() => {
    if (modal.isOpen) {
      form.reset(defaultValues);
    }
  }, [modal.isOpen])

  return (
    <Dialog open={modal.isOpen} onOpenChange={modal.close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modify Fund Settings</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)} className="w-full space-y-6">
            <div>
              {/* <h3 className="mt-6 mb-4 text-sm font-semibold uppercase">Fund Updates</h3> */}
              <div className="space-y-6 mt-6">
                <FormField
                  control={form.control}
                  name="trackChanges"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between space-x-2">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Track changes to {symbol}
                        </FormLabel>
                        <FormDescription>
                          Automatically updates your copy whenever the holdings in {symbol} change
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="reinvestOnSell"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between space-x-2">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Reinvest on sell
                        </FormLabel>
                        <FormDescription>
                          Reinvest the proceeds of a sale (due to Shariah non-compliance, or fund updates) into the remaining stocks
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {/* <FormField
                  control={form.control}
                  name="rebalanceOnChange"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Rebalance on change</FormLabel>
                        <FormDescription>
                          Buy & sell every time the fund changes. When disabled, your copy is only rebalanced using deposits and withdrawals.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                /> */}
              </div>
              <div className="relative mt-6 mb-4 flex flex-row justify-center">
                <h3 className="text-sm font-semibold uppercase text-gray-500 bg-white px-2 inline-block">Filter Settings</h3>
                <div className="absolute h-[1px] bg-gray-100 w-full top-2 z-[-1]"></div>
              </div>
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="allowDoubtful"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Buy doubtful stocks
                        </FormLabel>
                        <FormDescription>
                          Stocks where revenue from doubtful (but not prohibited) sources exceeds 5% of total revenue. e.g <code>GOOGL</code>, <code>META</code>
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="allowUnrated"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Buy unrated stocks
                        </FormLabel>
                        <FormDescription>
                          Allow stocks that have no Shariah compliance rating?
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="onNonCompliance"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel className="text-base">If a stock turns non-compliant</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1 mt-2"
                        >
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="sell" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Sell it immediately
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="wait" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Wait for next report, sell if still non-compliant
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="notify" />
                            </FormControl>
                            <FormLabel className="font-normal">Nothing</FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" onClick={modal.close} variant="ghost">Cancel</Button>
              <Button type="submit" disabled={!isDirty}>Save changes</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default FundSettingsModal;
