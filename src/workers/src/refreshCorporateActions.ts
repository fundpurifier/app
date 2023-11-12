import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
dayjs.extend(duration);

import { batchifyPeriod } from "@/helpers";

import fmp from "@/lib/fmp";
import { prisma } from "@/initializers/prisma";
import Alpaca from "@/lib/brokers/alpaca";
import { AnnouncementResponse } from "@/lib/brokers/alpaca/types";
import {
  CorporateAction,
  DividendAction,
  MergerAction,
  SpinoffAction,
  SplitAction,
} from "@/models/corporateActions";
import hash from "object-hash";
import uuid from "uuid-by-string";
import _ from "lodash";

import { Queues } from "../queues";
import { MetricsTime, Worker } from "bullmq";
import connection from "../connection";
import { getToken } from "./helpers/db";

// Alpaca Corporate Actions data is made available starting in April 2020
const FIRST_AVAILABLE_DATE = "2020-04-01";

export default new Worker<void, void>(
  Queues.refreshCorporateActions,
  async (job) => {
    const tmpToken = await getToken();
    const lastSync = await getLastSyncDate();
    const today = new Date().toISOString().split("T")[0];
    const maxWindow = dayjs.duration(60, "days").asMilliseconds();

    // Get symbol changes from FinancialModelingPrep
    const symbolChanges = await getSymbolChanges(lastSync);
    const BATCH_SIZE = 250;

    for (const batch of _.chunk(symbolChanges, BATCH_SIZE)) {
      const prismaBatch = batch.map((change) => {
        const id = uuid(hash(change));
        const data = {
          type: "symbol_change",
          date: new Date(change.date),
          symbol: change.oldSymbol,
          details: JSON.stringify({
            newSymbol: change.newSymbol,
          }),
        };

        return prisma.corporateAction.upsert({
          where: { id },
          update: data,
          create: {
            id,
            ...data,
          },
        });
      });

      await prisma.$transaction(prismaBatch);
    }

    // Retrieve Corporate Actions from Alpaca
    const alpaca = new Alpaca(tmpToken, false);

    for (const [start, end] of batchifyPeriod(lastSync, today, maxWindow)) {
      const actions = await alpaca.getAnnouncements(start, end);
      const insertRecords: CorporateAction[] = [];

      for (const action of actions) {
        // Patch fix, if necessary
        if (action.id in CORPORATE_ACTION_FIXES) {
          Object.assign(action, CORPORATE_ACTION_FIXES[action.id]);
        }

        const parsed = await parseAction(action);
        if (!parsed) continue;

        insertRecords.push(parsed);
      }

      fixAlpacaQuirk(insertRecords); // mutates insertRecords

      await prisma.$transaction(
        insertRecords.map((record) => {
          const dbRecord = {
            ...record,
            details: JSON.stringify(record.details),
          };

          return prisma.corporateAction.upsert({
            where: { id: record.id },
            update: dbRecord,
            create: dbRecord,
          });
        })
      );
    }

    // Don't forget to update the last sync date
    await updateLastSyncDate();
  },
  {
    connection,
    autorun: false,
    metrics: { maxDataPoints: MetricsTime.TWO_WEEKS },
  }
);

async function getLastSyncDate() {
  // Query prisma for the last CorporateAction date, fallback to FIRST_AVAILABLE_DATE
  const lastSyncDate = await prisma.appSetting.findFirst({
    where: {
      key: "lastCorporateActionSyncDate",
    },
  });

  if (lastSyncDate) {
    return new Date(lastSyncDate.value).toISOString().split("T")[0];
  }

  return FIRST_AVAILABLE_DATE;
}

async function updateLastSyncDate() {
  await prisma.appSetting.upsert({
    where: {
      key: "lastCorporateActionSyncDate",
    },
    update: {
      value: new Date().toISOString(),
    },
    create: {
      key: "lastCorporateActionSyncDate",
      value: new Date().toISOString(),
    },
  });
}

const fixAlpacaQuirk = (records: CorporateAction[]) => {
  /**
   * Removes dividend entries added on the day of a split, where "cash" is
   * equivalent to "newRate". I don't know why Alpaca does this, but it is
   * incorrect and causes issues with the way we calculate portfolio history.
   */
  records
    .filter((record) => record.type == "split")
    .map((record) => SplitAction.parse(record))
    .forEach(async (split) => {
      const buggyEntry = records.find(
        (action) =>
          action.symbol == split.symbol &&
          action.type == "dividend" &&
          action.date == split.date &&
          action.details.cash == split.details.newRate
      );

      if (buggyEntry) {
        records.splice(records.indexOf(buggyEntry), 1);
      }
    });
};

const parseAction = async (action: AnnouncementResponse[0]) => {
  switch (action.ca_type) {
    case "dividend":
      return parseDividend(action);
    case "split":
      return parseSplit(action);
    case "merger":
      return parseMerger(action);
    case "spinoff":
      return parseSpinoff(action);
  }
};

const parseDividend = (action: AnnouncementResponse[0]) => {
  if (!action.ex_date) return; // some entries are broken in Alpaca
  if (!action.initiating_symbol && !action.target_symbol) return;

  switch (action.ca_sub_type) {
    case "cash":
      return DividendAction.parse({
        id: action.id,
        type: "dividend",
        symbol: action.initiating_symbol,
        date: new Date(action.ex_date),
        isin: cusipToIsin(action.target_original_cusip),
        details: {
          subtype: action.ca_sub_type,
          cash: action.cash,
          shares: 1, // multiplier of 1, to keep as is
        },
      });
    case "stock":
      return DividendAction.parse({
        id: action.id,
        type: "dividend",
        symbol: action.target_symbol,
        date: new Date(action.ex_date),
        isin: cusipToIsin(action.target_original_cusip),
        details: {
          subtype: action.ca_sub_type,
          cash: 0,
          shares: action.new_rate,
        },
      });
    default:
      throw new Error(`Unknown dividend subtype: ${action.ca_sub_type}`);
  }
};

const parseSplit = (action: AnnouncementResponse[0]) => {
  if (!action.ex_date) return; // entries missing symbols can't be mapped
  if (!action.initiating_symbol && !action.target_symbol) return;

  switch (action.ca_sub_type) {
    case "reverse_split":
    case "unit_split":
    case "stock_split":
    case "recapitalization":
      return SplitAction.parse({
        id: action.id,
        type: "split",
        symbol: action.initiating_symbol || action.target_symbol,
        date: new Date(action.ex_date),
        isin: cusipToIsin(
          action.initiating_original_cusip || action.target_original_cusip
        ),
        details: {
          subtype: action.ca_sub_type,
          newRate: action.new_rate,
          oldRate: action.old_rate,
        },
      });

    default:
      throw new Error(`Unknown split subtype: ${action.ca_sub_type}`);
  }
};

const parseMerger = (action: AnnouncementResponse[0]) => {
  if (action.ca_sub_type == "merger_update") return; // ignore updates
  if (!action.target_symbol) return; // they acquired a private company, boohoo
  if (!action.effective_date) return; // without a date, we can't do anything..

  return MergerAction.parse({
    id: action.id,
    type: "merger",
    symbol: action.target_symbol,
    date: new Date(action.effective_date),
    isin: cusipToIsin(action.target_original_cusip),
    details: {
      subtype: action.ca_sub_type,
      newSymbol: action.initiating_symbol, // if empty, then purchased by private buyer
      cash: action.cash, // cash per share that shareholders will receive
      shares: action.new_rate, // number of shares of 'newSymbol' shareholders will receive
    },
  });
};

const parseSpinoff = (action: AnnouncementResponse[0]) => {
  if (!action.initiating_symbol || !action.target_symbol) return; // Only interested in public companies spinning off other public companies
  const date = action.ex_date || action.effective_date || action.record_date;
  if (!date) return; // without a date, we can't do anything..

  return SpinoffAction.parse({
    id: action.id,
    type: "spinoff",
    symbol: action.initiating_symbol,
    date: new Date(date),
    isin: cusipToIsin(action.target_original_cusip),
    details: {
      newSymbol: action.target_symbol,
      cash: action.cash, // cash per share that shareholders will receive
      shares: action.new_rate, // number of shares of 'newSymbol' shareholders will receive
    },
  });
};

function computeCheckDigit(isin: string): number {
  // Step 1: Convert alphabetic letters to their numeric equivalents
  let numericIsin = "";
  for (let i = 0; i < isin.length; i++) {
    const char = isin[i];
    if (char.match(/[A-Za-z]/)) {
      const numericValue = char.toUpperCase().charCodeAt(0) - 55;
      numericIsin += numericValue.toString();
    } else {
      numericIsin += char;
    }
  }

  // Step 2: Multiply every other digit by 2
  const multipliedDigits: number[] = [];
  for (let i = 0; i < numericIsin.length; i++) {
    const digit = Number(numericIsin[i]);
    if (i % 2 === 0) {
      multipliedDigits.push(digit * 2);
    } else {
      multipliedDigits.push(digit);
    }
  }

  // Step 3: Calculate the sum of all the digits
  const sumDigits = multipliedDigits.reduce((sum, digit) => {
    return sum + Math.floor(digit / 10) + (digit % 10);
  }, 0);

  // Step 4: Find the smallest number ending with zero that is greater than or equal to the sum
  let value = sumDigits;
  while (value % 10 !== 0) {
    value += 1;
  }

  // Step 5: Calculate the check digit
  const checkDigit = value - sumDigits;

  return checkDigit;
}

function cusipToIsin(cusip?: string): string {
  if (!cusip?.length) return "";

  let isinWithoutCheckDigit = "US" + cusip;
  let checkDigit = computeCheckDigit(isinWithoutCheckDigit);
  return isinWithoutCheckDigit + checkDigit;
}

async function getSymbolChanges(since: string) {
  const allSymbolChanges = await fmp.getSymbolChanges();
  return allSymbolChanges.filter((sc) => sc.date >= since);
}

// Fix some broken corporate action entries from Alpaca
const CORPORATE_ACTION_FIXES: Record<
  string,
  Partial<AnnouncementResponse[0]>
> = {
  "da4f65e1-f462-4549-90af-55716ed4804a": {
    initiating_symbol: "STR", // was ""
  },
  "0308f52d-7a54-4efc-8fe3-ba211e000270": {
    cash: "380", // was "0"
  },
  "56c49db4-d142-4a52-b2c7-ac7416c457a2": {
    initiating_symbol: "LH", // was ""
    target_symbol: "FTRE", // was "LH"
  },
  "d052413d-f0e8-521c-9fc6-884123cea50b": {
    target_symbol: "FI", // was ""
  },
};
