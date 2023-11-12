'use client';

import { usePathname, useSearchParams } from "next/navigation";
import OAuth from "@/services/alpaca-oauth";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { SignOutButton } from "@clerk/nextjs";
import ClientOnly from "@/components/ClientOnly";
import React from "react";

export default function Alpaca({ clientId, children }: { clientId: string, children: React.ReactNode }) {
  // Check if search params includes 'code'
  const pathname = usePathname();
  const params = useSearchParams();
  const returningFromAlpaca = pathname == '/oauth' && params.has('code');

  return (
    <ClientOnly>
      {returningFromAlpaca ? children : <LinkAlpacaAccount clientId={clientId} />}
    </ClientOnly>
  )
}

function LinkAlpacaAccount({ clientId }: { clientId: string }) {
  const oauth = new OAuth(clientId);
  const url = oauth.requestAuthorizationUrl();

  return (
    <div className="grid place-items-center w-full h-screen bg-yellow-400">
      <Card className="mx-4 max-w-md">
        <CardHeader>
          <CardTitle>Sign in with Alpaca</CardTitle>
        </CardHeader>
        <CardContent>
          <p>You need a brokerage account with Alpaca in order to use Amal Invest.</p>
          <p className="mt-3">It's <span className="font-bold">free</span> to register and trade.</p>
        </CardContent>
        <CardFooter className="justify-between space-x-2">
          <SignOutButton />
          <a className="bg-black text-white focus:ring-2 ring-black ring-offset-2 font-medium px-4 py-1.5 rounded-md whitespace-nowrap" href={url}>
            Connect to Alpaca &rarr;
          </a>
        </CardFooter>
      </Card>
    </div>
  )
}