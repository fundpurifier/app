import { CorporateAction } from "@/models/corporateActions";
import Big from "big.js";
import { Order, Position } from "./types";
import { prisma } from "@/initializers/prisma";
import { CASH } from "./constants";
import { PortfolioSlice } from "@prisma/client";
import Alpaca from "@/lib/brokers/alpaca";
import _ from "lodash";
import { PortfolioWithSlices } from "@/types";

interface PortfolioPosition {
  qty: Big;
  costBasis: Big;
  avgCostPerShare: Big /* for remaining shares (assuming avg lot matching method) */;
  realizedPnl: Big /* again, (assuming avg lot matching method) */;
}

interface Portfolio {
  [symbol: string]: PortfolioPosition;
}

const EMPTY_POSITION: PortfolioPosition = {
  qty: Big(0),
  costBasis: Big(0),
  avgCostPerShare: Big(0),
  realizedPnl: Big(0),
};

const isDevEnvironment = process.env.NODE_ENV === 'development'

export async function getPositionsBulk(
  portfolios: PortfolioWithSlices[],
  alpacaToken: string
) {
  /**
   * Retrieve positions across a group of portfolios, requesting the order history
   * only once for efficiency.
   */
  const alpaca = new Alpaca(alpacaToken, isDevEnvironment);
  const allOrders = await alpaca.getClosedOrders();

  const results: [Position[], number][] = [];

  for (const { slices } of portfolios) {
    const sliceIds = slices.map((slice) => slice.id);
    const orders = allOrders.filter((o) => sliceIds.includes(o.sliceId));

    if (!orders.length) {
      results.push([[], 0]);
      continue;
    }

    const result = await playbackOrdersAndActions(orders);
    results.push(result);
  }

  return results;
}

export async function getPositions(
  slices: Pick<PortfolioSlice, "id">[],
  alpacaToken: string
): Promise<[Position[], number]> {
  /**
   * Fetches all the orders for a given portfolio, and returns the portfolio's positions by
   * playing them all back.
   */
  const sliceIds = slices.map((slice) => slice.id);

  // Get latest closed orders
  const alpaca = new Alpaca(alpacaToken, isDevEnvironment);
  const allOrders = await alpaca.getClosedOrders();
  const orders = allOrders.filter((order) => sliceIds.includes(order.sliceId));

  if (!orders.length) return [[], 0];

  // Playback orders to find positions
  return await playbackOrdersAndActions(orders);
}

export async function playbackOrdersAndActions(
  orders: Order[]
): Promise<[Position[], number]> {
  /**
   * Playback orders and corporate actions to calculate the portfolio's constituents
   * and positions at the end of the period. If you'd like to get the portfolio
   * at a specific date(s), use [playbackOrdersAndActionsAt].
   */
  const iterator = playbackOrdersAndActionsAt(orders);
  let result = await iterator.next();

  while (!result.done) {
    const [positions, dividend, date] = result.value; // intermediate values
    result = await iterator.next();
  }

  const returnValue = result.value; // final value
  return returnValue;
}

export async function* playbackOrdersAndActionsAt(
  orders: Order[],
  emitAt: Date[] = []
) {
  /**
   * Playback orders and corporate actions to calculate the portfolio's constituents
   * and positions at the end of the period. If [emitAt] is set, we yield a portfolio
   * snapshot for every date in [emitAt].
   */
  if (orders.length == 0) throw "Must provide at least one order";

  let portfolio: Portfolio = {
    [CASH]: { ...EMPTY_POSITION },
  };

  // Retrieve relevant corporate actions for the symbols in the orders
  let symbols = new Set(orders.map((o) => o.symbol));
  const earliestOrderDate = new Date(
    Math.min(...orders.map((o) => o.orderCreatedAt.getTime()))
  );
  const initialCorporateActions = await getCorporateActions(
    Array.from(symbols),
    earliestOrderDate
  );
  const orderActions = orders.map(
    (order) =>
    ({
      ...order,
      action: "order",
      date: order.orderCreatedAt,
    } as Action)
  );
  const emitActions = emitAt.map(
    (date) =>
    ({
      action: "emit",
      date,
    } as Action)
  );

  let allActions: Action[] = [
    ...orderActions,
    ...initialCorporateActions,
    ...emitActions,
  ];
  allActions.sort(byDate);

  const newSymbols: string[] = [];

  while (allActions.length) {
    const action = allActions.shift()!;
    if (isEmit(action))
      yield [toArray(portfolio), +portfolio[CASH].qty, action.date] as [
        Position[],
        number,
        Date
      ];
    if (isOrder(action)) processOrder(action, portfolio);
    if (isCorporateAction(action) && action.date <= new Date()) {
      processCorporateAction(action, portfolio);

      // Retrieve additional actions if we've got a new symbol
      if (["merger", "spinoff", "symbol_change"].includes(action.type)) {
        const newSymbol = (action.details as any).newSymbol; // defined for all these types
        if (!newSymbol) continue;
        if (newSymbols.includes(newSymbol)) continue; // already processed

        const newActions = await getCorporateActions([newSymbol], action.date);
        allActions = mergeAndSortActions(allActions, newActions);
        newSymbols.push(newSymbol);
      }
    }
  }

  return [toArray(portfolio), +portfolio[CASH].qty] as [Position[], number];
}

async function getCorporateActions(symbols: string[], date: Date) {
  const actions = await prisma.corporateAction.findMany({
    where: {
      symbol: {
        in: symbols,
      },
      date: {
        gte: date,
      },
    },
  });

  return actions.map(
    (a) =>
    ({
      ...a,
      details: JSON.parse(a.details),
      action: "corporateAction",
      date: new Date(a.date),
    } as Action)
  );
}

function mergeAndSortActions(actions1: Action[], actions2: Action[]): Action[] {
  const allActions = [...actions1, ...actions2];
  allActions.sort((a, b) => a.date.getTime() - b.date.getTime());
  return allActions;
}

function processOrder(order: EnhancedOrderResponse, portfolio: Portfolio) {
  // Ignore unfilled orders
  if (!["filled", "partially_filled"].includes(order.status)) return;
  if (!order.filledQty) return;

  if (!portfolio[order.symbol]) {
    portfolio[order.symbol] = { ...EMPTY_POSITION };
  }

  applyAvgCostBasisMethod(portfolio[order.symbol], order);
}

function applyAvgCostBasisMethod(
  position: PortfolioPosition,
  order: EnhancedOrderResponse
) {
  if (order.side === "buy") {
    const orderCost = Big(order.filledQty).mul(order.filledAvgPrice);
    const orderQty = Big(order.filledQty);

    const newQty = position.qty.add(orderQty);
    const newCostBasis = position.costBasis.add(orderCost);

    // Update portfolio
    Object.assign(position, {
      qty: newQty,
      costBasis: newCostBasis,
      avgCostPerShare: newCostBasis.div(newQty),
    });
  } else if (order.side === "sell") {
    const orderQty = Big(order.filledQty);

    if (position.qty.eq(0)) {
      // This should never happen
      console.error("❌ Selling a stock we don't own", order.symbol, order.filledQty * order.filledAvgPrice)
    }

    const avgCost = position.qty.eq(0) ? Big(0) : position.costBasis.div(position.qty);
    const proceeds = Big(order.filledQty).mul(order.filledAvgPrice);
    const realizedPnl = proceeds.sub(avgCost.mul(orderQty));

    const newQty = position.qty.sub(orderQty);
    const newCostBasis = position.costBasis.sub(
      avgCost.mul(orderQty) // Important ❗️
    );

    // Update portfolio
    Object.assign(position, {
      qty: newQty,
      costBasis: newCostBasis,
      realizedPnl: position.realizedPnl.add(realizedPnl),
      avgCostPerShare: newQty.eq(0) ? 0 : newCostBasis.div(newQty),
    });
  }
}

function processCorporateAction(
  action: EnhancedCorporateAction,
  portfolio: Portfolio
) {
  if (!portfolio[action.symbol]) return; // we don't own the stock

  const qtyOwned = portfolio[action.symbol].qty;
  if (qtyOwned.lte(0) && action.type !== "symbol_change") return;
  // We keep "symbol_change" because sometimes we have phantom positions with
  // -ve values

  switch (action.type) {
    case "dividend": {
      const cash = qtyOwned.mul(action.details.cash);
      const stock = qtyOwned.mul(action.details.shares - 1);

      portfolio[CASH].qty = portfolio[CASH].qty.add(cash);

      const newCostBasis = portfolio[action.symbol].costBasis; // unchanged
      const newQty = portfolio[action.symbol].qty.add(stock);

      Object.assign(portfolio[action.symbol], {
        qty: newQty,
        avgCostPerShare: newCostBasis.div(newQty),
      });
      break;
    }

    case "split": {
      const multiple = Big(action.details.newRate).div(action.details.oldRate);
      Object.assign(portfolio[action.symbol], {
        qty: portfolio[action.symbol].qty.mul(multiple),
        avgCostPerShare: portfolio[action.symbol].avgCostPerShare.div(multiple),
      });
      break;
    }

    case "merger": {
      const cash = qtyOwned.mul(action.details.cash);
      portfolio[CASH].qty = portfolio[CASH].qty.add(cash);

      // Delistings don't have newSymbol, so no new stock is added
      const { newSymbol } = action.details;
      if (newSymbol) {
        if (!portfolio[newSymbol]) portfolio[newSymbol] = { ...EMPTY_POSITION };

        const stock = qtyOwned.mul(action.details.shares);
        portfolio[newSymbol].qty = portfolio[newSymbol].qty.add(stock);
        // addKey(symbolChanges, action.symbol, newSymbol);
      }

      if (!newSymbol && action.details.cash === 0) {
        // We're not getting a new stock AND we're not getting cash?! What kind
        // of a merger is this! Ignore..
        // See "LIN" merger (Event ID: `d43b6058-d735-4feb-8341-1ee30fc9e9c7`)
      } else {
        // Remove the entry for the old stock
        delete portfolio[action.symbol];
      }

      break;
    }

    case "spinoff": {
      // Every spinoff in the past 3 years had cash = $0, just fyi
      const cash = qtyOwned.mul(action.details.cash);
      portfolio[CASH].qty = portfolio[CASH].qty.add(cash);

      const { newSymbol } = action.details;
      if (newSymbol) {
        const stock = qtyOwned.mul(action.details.shares);
        if (!portfolio[newSymbol]) portfolio[newSymbol] = { ...EMPTY_POSITION };

        // TODO: A spinoff reduces the average cost for the parent, and adds a new position for the child (overall profitability remains unchanged). This is not implemented yet.
        portfolio[newSymbol].qty = portfolio[newSymbol].qty.add(stock);
        // addKey(symbolChanges, "", event.newSymbol);
      }
      break;
    }

    case "symbol_change": {
      portfolio[action.details.newSymbol] = portfolio[action.symbol];
      delete portfolio[action.symbol];
      //   addKey(symbolChanges, event.symbol, event.newSymbol);
      break;
    }
  }
}

function byDate(a: Action, b: Action) {
  // Sorts by date
  const dateDiff = a.date.getTime() - b.date.getTime();
  if (dateDiff !== 0) return dateDiff;

  // "emit" actions should come last
  if (a.action === "emit" && b.action !== "emit") return 1;
  if (a.action !== "emit" && b.action === "emit") return -1;
  return 0;
}

function toArray(pf: Portfolio): Position[] {
  return _.map(
    _.keys(pf).filter((key) => key !== CASH),
    (key) => ({
      symbol: key,
      qty: +pf[key].qty,
      costBasis: +pf[key].costBasis,
      avgCostPerShare: +pf[key].avgCostPerShare,
      realizedPnl: +pf[key].realizedPnl,
    })
  );
}

type EnhancedOrderResponse = Order & {
  action: "order";
  date: Date;
};

type EnhancedCorporateAction = CorporateAction & {
  action: "corporateAction";
};

type EmitAction = {
  action: "emit";
  date: Date;
};

type Action = EnhancedOrderResponse | EnhancedCorporateAction | EmitAction;

function isOrder(action: Action): action is EnhancedOrderResponse {
  return action.action === "order";
}

function isCorporateAction(action: Action): action is EnhancedCorporateAction {
  return action.action === "corporateAction";
}

function isEmit(action: Action): action is EmitAction {
  return action.action === "emit";
}
