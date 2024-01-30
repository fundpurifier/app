import assert from "assert";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
dayjs.extend(duration);
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);

export function numCompact(num: number, precision = 2) {
  // Formats a number in a compact way, e.g. 1.2k, 1.2m, 1.2b, 1.2t
  const map = [
    { suffix: "t", threshold: 1e12 },
    { suffix: "b", threshold: 1e9 },
    { suffix: "m", threshold: 1e6 },
    { suffix: "k", threshold: 1e3 },
    { suffix: "", threshold: 1 },
  ];

  const found = map.find((x) => Math.abs(num) >= x.threshold);
  if (found) {
    const formatted = (num / found.threshold).toFixed(precision) + found.suffix;
    return formatted;
  }

  return num;
}

export function n(value: number, showLeadingPlus = false) {
  // Format in USD using Number()
  const leadingPlus = showLeadingPlus && value > 0 ? "+" : "";
  return (
    leadingPlus +
    Number(value).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    })
  );
}

export function d(timestamp: number) {
  // Format in YYYY-MM-DD using Date()
  return new Date(timestamp * 1000).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function p(value: number, showLeadingPlus = false) {
  // Format in % using Number()
  const leadingPlus = showLeadingPlus && value > 0 ? "+" : "";
  return (
    leadingPlus +
    Number(value / 100).toLocaleString("en-US", {
      style: "percent",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function q(value: number) {
  // Format number of shares up to 3 decimal places
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

export function* batchifyPeriod(
  startDate: string,
  endDate: string,
  intervalMsec: number
) {
  let start = dayjs(startDate);
  const end = dayjs(endDate);

  while (start.isBefore(end)) {
    let nextDate = start.add(dayjs.duration(intervalMsec));
    if (nextDate.isAfter(end)) nextDate = end;
    yield [start.format("YYYY-MM-DD"), nextDate.format("YYYY-MM-DD")];
    start = nextDate;
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  const isDevEnvironment = process.env.NODE_ENV === 'development'
  if (!value && !isDevEnvironment) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export const isSimpleDate = (date: string): boolean => {
  /**
   * Returns true if the string represents a simple data of
   * the form YYYY-MM-DD
   */

  // Returns true if the string represents a simple data of YYYY-MM-DD
  const simpleDateRegex = /^\d{4}-[01]\d-[0-3]\d/;
  return simpleDateRegex.test(date);
};

export const tradingDaysInPeriod = (
  startDate: string | Date,
  endDate: string | Date
) => {
  const dateRange = [];

  for (
    let currentDate = dayjs(startDate);
    currentDate.isBefore(dayjs(endDate).add(1, "day"));
    currentDate = currentDate.add(1, "day")
  ) {
    // get the day of week. 0 is for Sunday, 6 is for Saturday
    const dayOfWeek = currentDate.day();

    if (dayOfWeek > 0 && dayOfWeek < 6) {
      // weekdays only
      dateRange.push(currentDate.utc().startOf("day").toDate());
    }
  }

  return dateRange;
};

export const generateId = (prefix: string, length: number = 16) => {
  /**
   * Generates Stripe-like IDs (e.g. 'cus_dalknsfo1ie12i0sad') based on just
   * the prefix [prefix] by appending '_' and a random string of characters.
   */
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return prefix.length > 0 ? `${prefix}_${result}` : result;
};

export const getSliceId = (clientOrderId: string) => {
  /**
   * Returns the slice ID from the client order ID.
   */
  if (!clientOrderId.startsWith("slc_") || !clientOrderId.includes("|"))
    return "";

  const sliceId = clientOrderId.split("|")[0];
  return sliceId;
};

export const clamp = (value: number, min: number, max: number): number => {
  /**
   * Clamps a value between a minimum and maximum range.
   * If the value is less than the minimum, it will be set to the minimum.
   * If the value is greater than the maximum, it will be set to the maximum.
   * Otherwise, the value will remain unchanged.
   */
  return Math.min(Math.max(value, min), max);
}

export const classByVal = (value: number, classes: string[]) => {
  assert(classes.length >= 2 && classes.length <= 3, "must have either 2 or 3 classes");

  if (value < 0) return classes[0];
  if (value > 0) return classes[1];
  if (value == 0) return classes[2] ?? ''; // optional
}

export const timeFromNow = (seconds: number) => {
  // Converts seconds into a human-readable string, e.g. 1h 2m
  const minutes = seconds / 60;
  const hours = minutes / 60;

  if (hours >= 1) {
    return `${Math.floor(hours)}h ${Math.floor(minutes % 60)}m`;
  } else if (minutes >= 1) {
    return `${Math.floor(minutes)}m`;
  } else {
    return `${Math.floor(seconds)}s`;
  }
}