import finnhub from "@/lib/finnhub";
import { chunk } from 'lodash'; // lodash's chunk function
import fs from 'fs';
import path from 'path';
import ProgressBar from 'progress';

interface FundProfile {
  profile: {
    totalNav: number;
  }
  symbol: string
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function getTopMutualFunds() {
  const allFunds = await finnhub.getMutualFunds();
  const funds = allFunds
    .filter((fund) => fund.isin.startsWith("US")) // only US-listed funds
    .filter((fund) => fund.symbol.length <= 6); // skip the weird long ones no one cares about

  const rateLimitPerSecond = 30; // Number of requests per second
  const interval = 1000; // Interval in ms

  const fundChunks = chunk(funds, rateLimitPerSecond); // Split the funds into chunks of 30

  const results: Array<[string, number]> = [];
  const bar = new ProgressBar(':bar :percent :etas', { total: fundChunks.length });

  for (const [i, fundChunk] of fundChunks.entries()) {
    const promises = fundChunk.map(async ({ symbol }) => {
      try {
        // Make the API call
        const response = await fetch(`https://finnhub.io/api/v1/mutual-fund/profile?symbol=${symbol}&token=${process.env.FINNHUB_API_KEY}`);
        const data: FundProfile = await response.json();

        // Push the result to the array
        results.push([data.symbol, data.profile.totalNav]);
      } catch (error) {
        // Log any errors for this symbol
        console.error(`Error retrieving data for symbol ${symbol}:`, error);
      }
    });

    // Run the promises in parallel
    await Promise.all(promises);
    bar.tick();

    // Save the results to a JSON file every 25 chunks
    if ((i + 1) % 25 === 0) {
      fs.writeFileSync(path.join(__dirname, `mfs.json`), JSON.stringify(results));
    }

    // Wait to respect the rate limit
    await sleep(interval);
  }

  // Sort the results by total NAV, and take the top 100
  const sorted = results.sort((a, b) => b[1] - a[1]).slice(0, 100);
  return sorted.map(([symbol]) => symbol);
}

(async () => {
  const topMutualFunds = await getTopMutualFunds();
  console.log(topMutualFunds);
})();