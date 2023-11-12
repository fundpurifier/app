import { Prisma } from "@prisma/client";

const portfolioWithSlices = Prisma.validator<Prisma.PortfolioArgs>()({
  include: { slices: true },
});
export type PortfolioWithSlices = Prisma.PortfolioGetPayload<
  typeof portfolioWithSlices
>;

const portfolioSliceWithListedAsset =
  Prisma.validator<Prisma.PortfolioSliceArgs>()({
    include: { listedAsset: true },
  });
export type PortfolioSliceWithListedAsset = Prisma.PortfolioSliceGetPayload<
  typeof portfolioSliceWithListedAsset
>;

const portfolioWithSlicesAndListedAssets =
  Prisma.validator<Prisma.PortfolioArgs>()({
    include: {
      slices: {
        include: {
          listedAsset: true,
        },
      },
    },
  });
export type PortfolioWithSlicesAndListedAssets = Prisma.PortfolioGetPayload<
  typeof portfolioWithSlicesAndListedAssets
>;

const userWithWhitelistAndBlacklist = Prisma.validator<Prisma.UserArgs>()({
  include: { whitelist: true, blacklist: true },
});
export type UserWithWhitelistAndBlacklist = Prisma.UserGetPayload<
  typeof userWithWhitelistAndBlacklist
>;

const actionLogWithActionOrders = Prisma.validator<Prisma.ActionLogArgs>()({
  include: { ActionOrder: true },
});
export type ActionLogWithActionOrders = Prisma.ActionLogGetPayload<
  typeof actionLogWithActionOrders
>;