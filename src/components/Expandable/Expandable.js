"use client";

import React from "react";
import { ChevronUpDownIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

function ExpandableTable({ children, message, enabled = true, className = '' }) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    enabled ? (
      <div
        className={clsx(
          "relative overflow-clip transition-all duration-300",
          expanded ? "max-h-full" : "max-h-96",
          className
        )}
      >
        <div className={clsx(expanded ? "pb-12" : "")}>{children}</div>
        <button
          className="text-center absolute inset-x-0 bottom-0 w-full bg-gradient-to-b from-white/50 to-white flex flex-row items-center justify-center py-4 text-slate-600 cursor-pointer rounded-md"
          onClick={() => setExpanded(!expanded)}
        >
          <ChevronUpDownIcon className="h-6 w-6 text-slate-500 " />
          <div>{expanded ? "Click to collapse" : message}</div>
        </button>
      </div>
    ) : <div className={className}>{children}</div>
  );
}

export default ExpandableTable;
