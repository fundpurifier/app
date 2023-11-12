import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
import finnhub from "@/lib/finnhub"
import Alpaca from "@/lib/brokers/alpaca"
import _ from "lodash"
import musaffa from "@/lib/musaffa"
import { toShariahStatus } from "@/lib/musaffa/mappers"

(async () => {
  await seedFunds()
  await seedListedAssets()
})()

async function seedFunds() {
  try {
    const etfs = await finnhub.getETFs()
    const mutualFunds = await finnhub.getMutualFunds()

    const allFunds = [
      ...etfs.map((fund) => ({ ...fund, type: "etf" })),
      ...mutualFunds.map((fund) => ({ ...fund, type: "mutual_fund" })),
    ]

    for (const fund of allFunds) {
      await prisma.fund.create({
        data: {
          isin: fund.isin,
          name: fund.name,
          type: fund.type,
          symbol: fund.symbol,
        },
      })
    }
    console.log("Data has been seeded successfully.")
  } catch (error) {
    console.error("Error seeding data:", error)
  }
}

async function seedListedAssets() {
  try {
    const alpaca = new Alpaca("", true)
    const assets = await alpaca.getAssets()

    // Find ISIN for each asset
    const allSymbols = await finnhub.getAllUSSymbols()
    const isin = _.mapValues(_.keyBy(allSymbols, "symbol"), "isin")

    // Assign the ISIN
    const assetsWithIsin = assets
      .filter((asset) => isin[asset.symbol])
      .map((asset) => ({
        ...asset,
        isin: isin[asset.symbol],
      }))

    // Generate some shariah data
    const shariah = await musaffa.getStockReportBatch(assetsWithIsin.map(a => a.symbol))

    // Save to DB
    await prisma.$transaction(
      assetsWithIsin.map((asset, i) =>
        prisma.listedAsset.create({
          data: {
            id: asset.id,
            isin: asset.isin,
            symbol: asset.symbol,
            name: asset.name,
            shariahStatus: toShariahStatus(shariah[i].shariahComplianceStatus),
            shariahDetailsCurrent: JSON.stringify(shariah[i]),
            isActive: true,
            isStock: true,
          },
        })
      )
    )

    console.log("Listed assets table filled successfully.")
  } catch (error) {
    console.error("Error filling listed assets table:", error)
  }
}