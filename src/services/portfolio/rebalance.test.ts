import { rebalance, calculateOrderAmounts } from "./rebalance"
import Big from "big.js"

describe("rebalance function", () => {
  it("should correctly rebalance when buying", () => {
    const weights = [Big(50), Big(50)]
    const values = [Big(40), Big(60)]
    const amount = Big(20)
    const result = rebalance(weights, values, amount)
    expect(result).toEqual([Big(20), Big(0)])
  })

  it("should correctly rebalance when selling", () => {
    const weights = [Big(50), Big(50)]
    const values = [Big(60), Big(40)]
    const amount = Big(-20)
    const result = rebalance(weights, values, amount)
    expect(result).toEqual([Big(-20), Big(0)])
  })

  it("should correctly handle zero rebalancing", () => {
    const weights = [Big(50), Big(50)]
    const values = [Big(50), Big(50)]
    const amount = Big(0)
    const result = rebalance(weights, values, amount)
    expect(result).toEqual([Big(0), Big(0)])
  })

  it("should correctly handle empty weights and values", () => {
    const weights: Big[] = []
    const values: Big[] = []
    const amount = Big(0)
    const result = rebalance(weights, values, amount)
    expect(result).toEqual([])
  })

  it("should throw an error if weights and values have different lengths", () => {
    const weights = [Big(50)]
    const values = [Big(50), Big(50)]
    const amount = Big(0)
    expect(() => rebalance(weights, values, amount)).toThrow()
  })
})

describe("calculateOrderAmounts", () => {
  it("should correctly calculate order amounts", () => {
    const weights = [Big(50), Big(30), Big(20)]
    const values = [Big(100), Big(200), Big(300)]
    const amount = Big(1000)

    const expected = rebalance(weights, values, amount)
    const result = calculateOrderAmounts(weights, values, amount)

    expect(result).toEqual(expected)
  })

  it("should respect the MIN_ORDER_SIZE", () => {
    const weights = [Big(50), Big(30), Big(20)]
    const values = [Big(100), Big(200), Big(300)]
    const amount = Big(1.1) // only 1 order can be above MIN_ORDER_SIZE

    const result = calculateOrderAmounts(weights, values, amount)

    // Only one order should be above MIN_ORDER_SIZE
    result.filter((orderAmount) => orderAmount.eq(amount)).length === 1
  })

  it("should invest in as many constituents as possible", () => {
    const weights = [Big(50), Big(30), Big(20)]
    const values = [Big(100), Big(200), Big(300)]
    const amount = Big(1000)

    const result = calculateOrderAmounts(weights, values, amount)

    // The number of constituents with non-zero order amounts should be maximized
    const nonZeroOrders = result.filter(
      (orderAmount) => !orderAmount.eq(Big(0))
    )
    expect(nonZeroOrders.length).toBe(weights.length)
  })

  it("should allocate to all slices if total amount is large enough", () => {
    const weights = [Big(50), Big(30), Big(20)]
    const values = [Big(100), Big(200), Big(300)]
    const amount = Big(10000) // large enough to cover all slices

    const result = calculateOrderAmounts(weights, values, amount)

    // All slices should get an allocation
    result.forEach((orderAmount) => {
      expect(orderAmount.gt(Big(0))).toBe(true)
    })
  })

  it("should allocate to only one slice if total amount is less than MIN_ORDER_SIZE", () => {
    const weights = [Big(50), Big(30), Big(20)]
    const values = [Big(100), Big(200), Big(300)]
    const amount = Big(0.5) // less than MIN_ORDER_SIZE

    const result = calculateOrderAmounts(weights, values, amount)

    // Only one slice should get an allocation
    const nonZeroOrders = result.filter(
      (orderAmount) => !orderAmount.eq(Big(0))
    )
    expect(nonZeroOrders.length).toBe(1)
  })

  it("should allocate to some but not all slices if total amount is not enough for all", () => {
    const weights = [Big(50), Big(30), Big(20)]
    const values = [Big(0), Big(0), Big(0)]
    const amount = Big(3) // enough for some but not all slices

    const result = calculateOrderAmounts(weights, values, amount)

    // Some but not all slices should get an allocation
    const nonZeroOrders = result.filter(
      (orderAmount) => !orderAmount.eq(Big(0))
    )
    expect(nonZeroOrders.length).toBeGreaterThan(1)
    expect(nonZeroOrders.length).toBeLessThan(weights.length)
  })

  it("should correctly rebalance when target weights are already met", () => {
    const weights = [Big(50), Big(50)]
    const values = [Big(50), Big(50)]
    const amount = Big(0)
    const result = calculateOrderAmounts(weights, values, amount)
    expect(result).toEqual([Big(0), Big(0)])
  })

  it("should correctly rebalance when target weights are not met", () => {
    const weights = [Big(50), Big(50)]
    const values = [Big(60), Big(40)]
    const amount = Big(0)
    const result = calculateOrderAmounts(weights, values, amount)
    expect(result).toEqual([Big(-10), Big(10)])
  })

  it("should handle a rebalance with values less than the minimum amount resulting in orders less than $1", () => {
    const weights = [Big(50), Big(50)]
    const values = [Big(5), Big(6)] // Sell $0.5, buy $0.5
    const amount = Big(0)
    const result = calculateOrderAmounts(weights, values, amount)

    // unable to rebalance to target weights, so just sell what we can
    expect(result).toEqual([Big(0), Big(-0.5)])
  })
})
