'use client';

import React from "react";
import { exchangeCodeForToken } from "./actions";
import { useSearchParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";

export default function Page() {
  const [token, setToken] = React.useState<string | null>(null);
  const params = useSearchParams();
  const code = params.get('code')!;

  React.useEffect(() => {
    exchangeCodeForToken(code).then(t => setToken(t));
  }, []);

  return (
    <div className="grid place-items-center w-full h-screen bg-yellow-400">
      <Card className="mx-4 max-w-md">
        <CardHeader>
          <CardTitle>
            {token ? 'Alpaca connected 🎉' : 'Please wait...'}
          </CardTitle>
        </CardHeader>
        {token && <CardFooter className="justify-between space-x-2">
          <a className="bg-black text-white focus:ring-2 ring-black ring-offset-2 font-medium px-4 py-1.5 rounded-md whitespace-nowrap" href='/'>
            Continue to Dashboard &rarr;
          </a>
        </CardFooter>}
      </Card>
    </div>
  )
}