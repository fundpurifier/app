import React from "react";
import { Switch } from "@headlessui/react";
import clsx from "clsx";

export default function ({
  label,
  description,
  onChange,
  initialValue = false,
}) {
  const [enabled, setEnabled] = React.useState(initialValue);

  React.useEffect(() => {
    onChange(enabled);
  }, [enabled]);

  return (
    <Switch.Group as="div" className="flex items-center justify-between">
      <span className="flex flex-grow flex-col">
        <Switch.Label
          as="span"
          className="font-medium leading-6 text-slate-700"
          passive
        >
          {label}
        </Switch.Label>
        <Switch.Description
          as="span"
          className="text-slate-500 text-sm mt-1.5 mr-1"
        >
          {description}
        </Switch.Description>
      </span>
      <Switch
        checked={enabled}
        onChange={setEnabled}
        className={clsx(
          enabled ? "bg-indigo-600" : "bg-gray-200",
          "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
        )}
      >
        <span
          aria-hidden="true"
          className={clsx(
            enabled ? "translate-x-5" : "translate-x-0",
            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
          )}
        />
      </Switch>
    </Switch.Group>
  );
}
