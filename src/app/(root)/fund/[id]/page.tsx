import PageClient from './page.client';

import FundChart from "@/components/FundChart";
import FilteredHoldings from "./FilteredHoldings";
import ActivityLog from "./ActivityLog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getActionLog, getPortfolio } from "./actions";

export const metadata = {
  title: "Fund Details | Amal Invest",
}

export default async function FundDetailsPage({ params }: { params: { id: string } }) {
  const portfolioId = params.id;

  // Fetch data
  const portfolio = await getPortfolio(portfolioId);
  const actionLog = await getActionLog(portfolio.id);
  const isRecurring = portfolio.RecurringBuy.length > 0;

  return (
    <PageClient portfolio={portfolio} fund={portfolio.fund}>
      <div className="grid grid-cols-1 gap-4 mt-4">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">
              {portfolio.fund.name}
              {isRecurring && (
                <Popover>
                  <PopoverTrigger asChild>
                    <RefreshCw className="inline-block ml-2" />
                  </PopoverTrigger>
                  <PopoverContent>
                    This portfolio has an active recurring buy. Manage it by clicking ︙ &rarr; "Recurring Buy"
                  </PopoverContent>
                </Popover>
              )}
            </CardTitle>
            <CardDescription>
              Performance of your filtered fund over the past month
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FundChart portfolio={portfolio} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Filtered Holdings</CardTitle>
            <CardDescription>
              These are the holdings that make up your fund
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FilteredHoldings portfolioId={portfolio.id} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Activity Log</CardTitle>
            <CardDescription>
              A log of all the activity that has happened in your fund
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityLog portfolioId={portfolio.id} fallback={actionLog} />
          </CardContent>
        </Card>
      </div>
    </PageClient>
  );
}
