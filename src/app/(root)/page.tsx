import React from "react";
import { getChartData, getPageData } from "./actions";
import PageClient from "./page.client";

export const dynamic = "force-dynamic"; // avoid pre-rendering errors

export const metadata = {
  title: "Home | Amal Invest",
}

export default async function Home() {
  const data = await getPageData();

  return <PageClient fallback={data} />;
}