import { fetchUser } from "./actions";
import LayoutClient from "./layout.client";
import Alpaca from "./alpaca.client";
import { requireEnv } from "@/helpers";

export const metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await fetchUser();

  return (
    <div className="overflow-x-hidden h-full">
      {!user && <Alpaca clientId={requireEnv('ALPACA_CLIENT_ID')}>{children}</Alpaca>}
      {user && <LayoutClient>{children}</LayoutClient>}
    </div>
  );
}