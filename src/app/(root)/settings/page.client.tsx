'use client';

import React from "react";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Switch } from "@/components/ui/switch"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useFormState, useFieldArray } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge"
import { getAllStocks, updateSettings } from "./actions";
import type { User } from "@prisma/client";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import elasticlunr from "elasticlunr";
import { CommandLoading } from "cmdk";
import { X } from "lucide-react";
import { StockMini, StockMiniSchema } from "./types";

const FormSchema = z.object({
    extendedHours: z.boolean().default(false),
    whitelist: z.array(StockMiniSchema).default([]),
    blacklist: z.array(StockMiniSchema).default([]),
})

export default function Page({ user, initialWhitelist, initialBlacklist }: { user: User, initialWhitelist: StockMini[], initialBlacklist: StockMini[] }) {
    const { toast } = useToast();
    const [showStockDialog, setShowStockDialog] = React.useState(false)
    const [selectedTab, setSelectedTab] = React.useState<string>("whitelist")

    const form = useForm<z.infer<typeof FormSchema>>({
        resolver: zodResolver(FormSchema),
        values: {
            extendedHours: false,
            whitelist: initialWhitelist,
            blacklist: initialBlacklist,
        },
    })
    const { isDirty } = useFormState({ control: form.control });

    const { fields: whitelistFields, append: appendToWhitelist, remove: removeFromWhitelist } = useFieldArray({
        control: form.control,
        name: "whitelist",
    });

    const { fields: blacklistFields, append: appendToBlacklist, remove: removeFromBlacklist } = useFieldArray({
        control: form.control,
        name: "blacklist",
    });

    function handleStockSelect(stock: StockMini) {
        if (selectedTab === "whitelist") {
            if (!form.getValues('whitelist').some(item => item.id === stock.id)) {
                appendToWhitelist(stock);
            }
        } else {
            if (!form.getValues('blacklist').some(item => item.id === stock.id)) {
                appendToBlacklist(stock);
            }
        }

        // Close the dialog
        setShowStockDialog(false);
    }

    function handleRemove(index: number) {
        if (selectedTab === "whitelist") {
            removeFromWhitelist(index);
        } else {
            removeFromBlacklist(index);
        }
    }


    async function onFormSubmit(data: z.infer<typeof FormSchema>) {
        const updatedData = {
            ...data,
            whitelist: data.whitelist.map(stock => stock.id),
            blacklist: data.blacklist.map(stock => stock.id),
        };

        await updateSettings(updatedData);

        toast({
            title: "Settings saved",
            description: "Your settings have been successfully saved.",
        });
    }

    return (
        <>
            <StockDialog show={showStockDialog} onClose={() => setShowStockDialog(false)} onSelect={handleStockSelect} />

            <header className="pad">
                <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
                <p className="text-muted-foreground">
                    Manage your account settings.
                </p>
            </header>
            <main className="pad">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onFormSubmit)} className="w-full space-y-6 max-w-2xl">
                        <div>
                            <div className="space-y-6 mt-6">
                                <FormField
                                    control={form.control}
                                    name="extendedHours"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                            <div className="space-y-0.5">
                                                <FormLabel className="text-base">
                                                    Extended hours trading <Badge variant="secondary">Soon</Badge>
                                                </FormLabel>
                                                <FormDescription>
                                                    Enable portfolio trading during extended hours (pre-market and after-hours).
                                                </FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                    disabled
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
                            <TabsList>
                                <TabsTrigger value="whitelist">Whitelist</TabsTrigger>
                                <TabsTrigger value="blacklist">Blacklist</TabsTrigger>
                            </TabsList>
                            <TabsContent value="whitelist">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>My Whitelist 🏳️</CardTitle>

                                        <CardDescription>Stocks in the list below will <strong>never be filtered</strong> from any fund.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="grid gap-4">
                                        <StockList values={form.watch('whitelist').map(stock => stock.symbol)} onRemove={handleRemove} />
                                    </CardContent>
                                    <CardFooter>
                                        <Button type="button" variant="secondary" onClick={(e) => setShowStockDialog(true)}>Add stock</Button>
                                    </CardFooter>
                                </Card>
                            </TabsContent>
                            <TabsContent value="blacklist">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>My Blacklist 🏴‍☠️</CardTitle>
                                        <CardDescription>Stocks in the list below will <strong>never be purchased</strong> in any fund.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="grid gap-4">
                                        <StockList variant="destructive" values={form.watch('blacklist').map(stock => stock.symbol)} onRemove={handleRemove} />
                                    </CardContent>
                                    <CardFooter>
                                        <Button type="button" variant="secondary" onClick={(e) => setShowStockDialog(true)}>Add stock</Button>
                                    </CardFooter>
                                </Card>
                            </TabsContent>
                        </Tabs>

                        <Button type="submit" disabled={!isDirty}>Save changes</Button>
                    </form>
                </Form>
            </main>
        </>
    );
}

function StockList({ values, onRemove, variant = 'default' }: { values: string[], onRemove: (index: number) => void, variant?: 'default' | 'destructive' }) {
    const isEmpty = values.length === 0;

    return isEmpty ? (
        <div className="text-muted-foreground">This list is empty</div>
    ) : (
        <div className="flex flex-row flex-wrap gap-x-2 gap-y-4">
            {values.map((symbol, i) => (
                <BadgeWithX variant={variant} key={symbol} onClick={() => onRemove(i)}>{symbol}</BadgeWithX>
            ))}
        </div>
    )
}


function StockDialog({ show, onClose, onSelect }: { show: boolean, onClose: () => void, onSelect: (stockId: StockMini) => void }) {
    const [busy, setBusy] = React.useState(true);
    const [stocks, setStocks] = React.useState<StockMini[]>([]);
    const [filteredStocks, setFilteredStocks] = React.useState<StockMini[]>([]);
    const [index, setIndex] = React.useState<elasticlunr.Index<StockMini> | null>(null);
    const [query, setQuery] = React.useState("")

    React.useEffect(() => {
        getAllStocks().then((stocks) => {
            setStocks(stocks);
            setBusy(false);

            // Set the lunr index
            const newIndex = elasticlunr(
                function (this: elasticlunr.Index<StockMini>) {
                    this.addField("name");
                    this.addField("symbol");
                    this.setRef("id");
                });
            stocks.forEach((stock) => newIndex.addDoc(stock));
            setIndex(newIndex);
        })
    }, []);

    function handleKeyPress(query: string) {
        setQuery(query);

        const results =
            query === ""
                ? stocks
                : index!
                    .search(query, {
                        fields: {
                            symbol: { boost: 2, bool: "AND" },
                            name: { boost: 1, bool: "AND" }
                        },
                        bool: "OR",
                        expand: true
                    })
                    .map(({ ref }) => stocks.find((s) => s.id === ref))
                    .filter(Boolean) as StockMini[];
        setFilteredStocks(results.slice(0, 25));
    }

    // Display them
    return (
        <CommandDialog open={show} onOpenChange={onClose}>
            {busy && <CommandLoading />}
            {!busy && (
                <>
                    <CommandInput placeholder="Search by ticker or name..." onValueChange={handleKeyPress} />
                    <CommandList>
                        <CommandEmpty>No results found.</CommandEmpty>
                        {filteredStocks.length > 0 && (
                            <CommandGroup heading="Search results">
                                {filteredStocks.map((stock) => (
                                    <CommandItem key={stock.id} onSelect={(_) => onSelect(stock)}>
                                        <code className="bg-slate-100 text-sm px-0.5 rounded-sm mr-2">{stock.symbol}</code>
                                        <span>{stock.name}</span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}
                    </CommandList>
                </>
            )}
        </CommandDialog>
    )
}

function BadgeWithX({ onClick, children, variant = 'default' }: { onClick: (symbol: string) => void, children: string, variant: 'default' | 'destructive' }) {
    return (
        <div className="flex flex-row gap-x-2">
            <Badge variant={variant}>
                {children}
                <X className="inline-block ml-1 w-4 h-4" onClick={() => onClick(children)} />
            </Badge>
        </div>
    )
}