import { Loader2 } from "lucide-react";

export default function Loading() {
  return <div className="pad grid place-items-center">
    <div className="flex flex-col items-center space-y-2">
      <Loader2 size="2rem" className="animate-spin" />
      <span>Loading filtered fund data&hellip;</span>
    </div>
  </div>;
}
