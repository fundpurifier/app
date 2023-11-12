import { SignUp } from "@clerk/nextjs";

export const metadata = {
  title: "Sign up | Fund Purifier",
  description: "Sign up to Fund Purifier.",
};

export default function Page() {
  return <SignUp />;
}
