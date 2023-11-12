import React from "react";
import clsx from "clsx";
import { Loader2 } from "lucide-react"

function Loading({ show = true, message = "Loading..." }) {
  /**
   * The parent element should have "position: relative;" for this to work.
   */
  return (
    <div
      className={clsx(
        "absolute w-full h-full bg-white/90 grid place-items-center text-slate-500 z-50 duration-75",
        show ? "opacity-100" : "pointer-events-none opacity-0"
      )}
    >
      <div className="flex flex-col items-center justify-center text-center gap-y-2">
        <Loader2 className="h-6 w-6 animate-spin" />
        <div>{message}</div>
      </div>
    </div>
  );
}

export default Loading;
