import Big from "big.js"

const MIN_ORDER_SIZE = Big(1)
const sum = (arr: Big[]) => arr.reduce((acc, cur) => acc.add(cur), Big(0))
const max = (max: Big, val: Big) => (val.gt(max) ? val : max)
const min = (min: Big, val: Big) => (val.lt(min) ? val : min)

export const calculateOrderAmounts = (
  weights: Big[],
  values: Big[],
  amount: Big
): Big[] => {
  /**
   * Calculates the order amounts for an array of assets by allocating the given
   * amount to each asset according to its weight, with the goal of rebalancing
   * the portfolio to the target weights.
   *
   * Accepts negative [amount], which will result in sell orders.
   */

  // Calculate initial order amounts
  let orderAmounts = rebalance(weights, values, amount)

  if (amount.lt(0)) return orderAmounts // no MIN_ORDER_SIZE when selling
  if (amount.eq(0)) {
    // Rebalancing; drop BUY orders below MIN_ORDER_SIZE
    return orderAmounts.map((oa) =>
      oa.gt(0) && oa.lt(MIN_ORDER_SIZE) ? Big(0) : oa
    )
  }

  // Handle MIN_ORDER_SIZE for buy orders
  // When buying, we want to make sure we invest *up to* the target amount
  // [rebalance] doesn't do this today, because it doesn't know anything about
  // the minimum order size that we have in place. These orders need to be
  // filtered out, and replaced with a new set of orders that meet or exceed the
  // minimum order size.
  //
  // To do this, we follow a simple rule: try to invest in *as many
  // constituents* as possible, while respecting the min investment amount

  // Create a priority array based on order amounts
  const priority = orderAmounts.map((_, i) => i)
  priority.sort((a, b) => orderAmounts[b].cmp(orderAmounts[a]))

  // Function to calculate sum of order amounts up to a given index
  const sumUpToIndex = (maxIndex: number) =>
    sum(priority.filter((_, i) => i <= maxIndex).map((v) => orderAmounts[v]))

  // Function to find the priority of an order
  const orderPriority = (i: number) => priority.findIndex((pri) => pri === i)

  // Iterate over each order
  for (let i = 0; i < priority.length; i++) {
    const orderAmount = orderAmounts[priority[i]]

    // If the first order is too small, allocate the entire amount to it
    // What about subsequent orders? See scaling logic below
    if (i == 0 && orderAmount.lt(MIN_ORDER_SIZE)) {
      orderAmounts = orderAmounts.map((oa) => Big(0))
      orderAmounts[priority[0]] = amount
      break
    } else if (orderAmount.eq(0)) {
      // If order amount is 0, break the loop as all remaining orders are also zeros
      break
    }

    // Calculate scaled sum
    const scaleFactor = MIN_ORDER_SIZE.div(orderAmount)
    const scaledSum = scaleFactor.mul(sumUpToIndex(i))

    if (scaledSum.gt(amount)) {
      // We can't include all slices of the portfolio *and* still respect the
      // minimum order size; we'll scale up the ones we can to precisely
      // match the minium order amount -- and zero the others

      if (i > 0) {
        // The last index we saw represents the maximum number of constituents
        // we can take. Let's use that, and scale the slices so we invest the
        // full [amount]
        const preciseScaleFactor = Big(amount).div(sumUpToIndex(i - 1))
        // only keep order of higher priority (larger orders) than the current order
        orderAmounts = orderAmounts.map((val, j) =>
          orderPriority(j) < i ? val.mul(preciseScaleFactor) : Big(0)
        )
      } else {
        // Allocate the total amount to the first slice
        orderAmounts = orderAmounts.map((val, j) => (j === 0 ? amount : Big(0)))
      }

      break
    }
  }

  // TODO: Guard against selling more than the present value of any slice
  return orderAmounts
}

// Only exported for tests
export const rebalance = (weights: Big[], values: Big[], amount: Big) => {
  /**
   * This method takes a group of weights and a target percentage and
   * returns the amount of each asset that should be bought in order to
   * bring the portfolio as close as possible to the target percentage.
   *
   * We sequentially bring the most underweight assets to their target
   * allocations first, before advancing to the next most underweight asset.
   *
   * @param weights - the targetPcs of each asset
   * @param values - the current dollar value of the assets
   * @param amount - The amount to rebalance the portfolio by
   * @returns A list of order amounts to execute to rebalance the portfolio.
   */
  if (weights.length !== values.length) {
    throw new Error("Weights and values arrays must have the same length")
  }

  const isRebalance = amount.eq(Big(0))
  const isBuying = amount.gt(Big(0))

  const total = sum(values).add(amount)
  const diff = (i: number) => weights[i].div(100).mul(total).sub(values[i])

  if (isRebalance) {
    // Return all diffs without overthinking it :)
    return weights.map((_, i) => diff(i))
  }

  // Sort by drift from ideal weight
  const diffs = weights.map(
    (_, i) =>
      isBuying
        ? max(Big(0), diff(i)) // filter SELLs when buying
        : min(diff(i), Big(0)) // filter BUYs when selling
  )
  const priority = diffs
    .map((_, i) => i)
    .sort((a, b) => diffs[b].abs().cmp(diffs[a].abs()))

  // Sequentially bring each slice to the target weight
  let orders = Array.from<Big>({ length: weights.length }).fill(Big(0))
  let remainder = amount
  for (const i of priority) {
    const diff = diffs[i]
    const orderAmount = isBuying ? min(remainder, diff) : max(remainder, diff)

    orders[i] = orderAmount
    remainder = remainder.sub(orderAmount)
  }

  return orders
}
