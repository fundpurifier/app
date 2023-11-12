![Fund Purifier Cover](https://fundpurifier.com/static/github-cover.png)

<div align="center"><strong>Fund Purifier</strong></div>
<div align="center">Invest in halal versions of popular US funds.<br />Built-in Shariah-compliance monitoring, smart rebalancing and more..</div>
<br />
<div align="center">
<a href="https://fundpurifier.com">Website</a> 
<span> · </span>
<a href="https://github.com/fundpurifier/app">GitHub</a> 
<span> · </span>
<a href="https://x.com/FundPurifier">𝕏 (Twitter)</a>
</div>

## Introduction

Investing in the stock market as a Muslim is hard, because it's not always obvious what's halal and what isn't. It gets even trickier when it comes to investing in funds, because there's no way to exclude non-halal stocks from a fund with hundreds of stocks.

**Until now.**

## Why

We built the Fund Purifier to automatically filter any US-listed mutual fund or ETF for you.

Just choose a fund, and we automatically filter it for compliant stocks.

On top of that, we also support:

🔍 **Tracking fund changes** so your filtered fund reflects additions/removals in the original fund

🗑️ **Automatic removal** when a stock turns haram (and re-added if it turns halal)

⚖️ **Smart rebalancing** so any funds invested/withdrawn help you come closer to the target weights

... and more!

It's also **100% Free**! You can use it today by signing up at [https://fundpurifier.com](fundpurifier.com).

Oh, and one more thing. It's **completely open-source** 💥

## Development

#### Install dependencies

```sh
git clone https://github.com/fundpurifier/app.git
npm install
```

#### Register for 3rd Party Services

The Fund Purifier relies on some 3rd party services. You'll need to sign up for these in order to run the app locally:

1. [Alpaca Developer App](https://alpaca.markets/docs/oauth/registration/) for executing trades (powers the "Sign in with Alpaca" functionality)
2. [Clerk](https://clerk.com) for authentication
3. [Resend](https://resend.com) for email notifications

You'll need to sign up to these services and populate your local `.env` file with the following keys:

```env
ALPACA_CLIENT_ID=
ALPACA_CLIENT_SECRET=
CLERK_SECRET_KEY=
RESEND_KEY=
```

#### Production

To run the Fund Purifier **in production**, you'll need to register for additional 3rd party services:

- [Musaffa B2B](https://api.musaffa.com/#b2b-api-v3-0) for retrieving Shariah compliance data via API
- [Finnhub B2B](https://finnhub.io/pricing-startups-and-enterprise) for retrieving fund holdings, ISIN data, logos, exchange symbols and realtime quotes
- [Financial Modeling Prep](https://site.financialmodelingprep.com/pricing-plans) for bulk retrieval of realtime quotes
- [EOD Historical Data](https://eodhd.com/pricing) for bulk retrieval of historical end-of-day quotes

Once done, populate your local `.env` file with the following keys:

```env
ALPACA_CLIENT_ID=
ALPACA_CLIENT_SECRET=
FINNHUB_FREE_KEY=
FINNHUB_API_KEY=
MUSAFFA_CLIENT_ID=
MUSAFFA_SECRET_KEY=
EOD_HISTORICAL_DATA_API_KEY=
FINANCIAL_MODELING_PREP_KEY=
```

**Note:** These are **paid services**. The total cost is around $20k/year.

**IMPORTANT:** You do not need to sign up to these services to run the Fund Purifier locally. **We provide mocked responses in development** instead.

## Tech Stack

The Fund Purifier is built using the latest tech. Here's a run-down of what our stack looks like:

- NextJS 14, with `app` directory
- React (Frontend / Server Components)
- SQLite
- Typescript
- BullMQ
- Redis

## Overview

Let's cover the main parts of the project `src/` directory:

- `app/`: all the routes used in the client application
- `components/`: reusable components used throughout the application
- `hooks/`: mainly used for global state management
- `lib/`: includes interfaces for 3rd party libraries and services
- `models/`: includes zod schemas for verifying data from 3rd parties
- `services/`: any sufficiently complex code taken outside controllers
- `workers/`: any long-running code that runs in the background

## Authors

- Yazin Alirhayim ([@yazinsai](https://x.com/yazinsai))
- Omar Zeineddine ([@oz](https://x.com/oz))

## License

AGPL 3.0 License
