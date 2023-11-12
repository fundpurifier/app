import { SignIn } from "@clerk/nextjs";

export const metadata = {
  title: "Sign in | Fund Purifier",
  description: "Sign in to your Fund Purifier account.",
};

export default function Page() {
  return <SignIn />;
}
