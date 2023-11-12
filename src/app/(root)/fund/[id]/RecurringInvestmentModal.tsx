"use client"

import * as z from "zod"
import React from "react";

import { Dialog, DialogTitle, DialogContent, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from "@/components/ui/select"
import { CalendarIcon } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form"
import { Check, ChevronsUpDown } from "lucide-react"
import ClientOnly from "@/components/ClientOnly";
import { mutate } from "swr"
import { ACTIVITY_LOG_KEY } from "@/swr";

import {
    Command,
    CommandGroup,
    CommandItem,
} from "@/components/ui/command"

import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useRecurringInvestmentModal } from "@/hooks/useRecurringInvestmentModal";
import { Input } from "@/components/ui/input";
import { RecurringBuy, cancelRecurringInvestment, createRecurringInvestment, getRecurringInvestment } from "./actions";
import { useToast } from "@/components/ui/use-toast";

export const frequencies = z.enum(['daily', 'weekly', 'monthly'])

const freqDropdown = [
    { label: "Daily (weekdays)", value: "daily" },
    { label: "Weekly", value: "weekly" },
    { label: "Monthly", value: "monthly" },
]

export const RecurringInvestmentSchema = z.object({
    startDate: z.date(),
    frequency: frequencies,
    amount: z.number().positive(),
})

export type RecurringInvestmentFormType = z.infer<typeof RecurringInvestmentSchema>;

interface RecurringInvestmentProps {
    portfolioId: string;
    symbol: string;
}

function RecurringInvestmentModal({ portfolioId, symbol }: RecurringInvestmentProps) {
    const [busy, setBusy] = React.useState(false);
    const [existing, setExisting] = React.useState<RecurringBuy | undefined>();
    const { toast } = useToast();

    const modal = useRecurringInvestmentModal();

    React.useEffect(() => {
        if (!modal.isOpen) return;

        getRecurringInvestment(portfolioId)
            .then((data) => {
                setExisting(data);
            })
            .finally(() => setBusy(false));
    }, [modal.isOpen]);

    const form = useForm<z.infer<typeof RecurringInvestmentSchema>>({
        resolver: zodResolver(RecurringInvestmentSchema),
        values: existing,
    })
    form.register('amount', { valueAsNumber: true });

    async function onFormSubmit(data: z.infer<typeof RecurringInvestmentSchema>) {
        console.log(data);

        if (!!existing) {
            await cancelRecurringInvestment(portfolioId);
            toast({
                title: "Recurring investment cancelled",
                description: `Your recurring investment in Filtered ${symbol} has been cancelled.`,
                variant: "destructive",
            })
        } else {
            await createRecurringInvestment({ portfolioId, ...data });
            toast({
                title: "Recurring investment created",
                description: `Your ${data.frequency} recurring investment in Filtered ${symbol} has been created.`,
            })
        }

        // Refresh
        mutate(ACTIVITY_LOG_KEY(portfolioId));
        modal.close();
    }

    return (
        <ClientOnly>
            <Dialog open={modal.isOpen} onOpenChange={modal.close}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Recurring Investment in {symbol}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onFormSubmit)} className="w-full my-4 space-y-6">
                            <FormField
                                control={form.control}
                                name="startDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Start date</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant={"outline"}
                                                        className={cn(
                                                            "w-[240px] pl-3 text-left font-normal",
                                                            !field.value && "text-muted-foreground"
                                                        )}
                                                        disabled={busy || !!existing}
                                                    >
                                                        {field.value ? (
                                                            format(field.value, "PPP")
                                                        ) : (
                                                            <span>Choose start date</span>
                                                        )}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={field.value}
                                                    onSelect={field.onChange}
                                                    disabled={(date) =>
                                                        date < new Date()
                                                    }
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <FormDescription>
                                            The date the first investment will be made.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="frequency"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>How often</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={busy || !!existing}>
                                            <SelectTrigger className="w-[240px]">
                                                {field.value
                                                    ? freqDropdown.find(
                                                        (freq) => freq.value === field.value
                                                    )?.label
                                                    : "Select frequency"}
                                            </SelectTrigger>
                                            <SelectContent>
                                                {freqDropdown.map((freq) => (
                                                    <SelectItem
                                                        value={freq.value}
                                                        key={freq.value}
                                                    >
                                                        {freq.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Amount</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Input type="number" {...field} lang="en" onChange={e => field.onChange(e.target.valueAsNumber)} className="w-[240px] pl-6" disabled={busy || !!existing} />
                                                <span className={cn("absolute inset-y-0 left-3 flex items-center pointer-events-none", !!existing ? "text-muted-foreground" : "")}>
                                                    $
                                                </span>
                                            </div>
                                        </FormControl>
                                        <FormDescription>
                                            The amount you'd like to invest each time.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <DialogFooter>
                                {!existing && (
                                    <>
                                        <Button type="button" onClick={modal.close} variant="ghost">Cancel</Button>
                                        <Button type="submit">Create recurring investment</Button>
                                    </>
                                )}
                                {!!existing && (
                                    <Button type="submit" variant="destructive">Cancel Recurring Buy</Button>
                                )}
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </ClientOnly>
    );
}

export default RecurringInvestmentModal;
