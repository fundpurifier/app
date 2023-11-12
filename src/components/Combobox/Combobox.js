import React from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid";
import { Combobox } from "@headlessui/react";

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function ({
  selected,
  values,
  onKeyPress,
  onChange,
  ...delegated
}) {
  const [query, setQuery] = React.useState("");

  function handleKeyPress(e) {
    setQuery(e.target.value);
    onKeyPress(e.target.value);
  }

  return (
    <Combobox as="div" value={selected} onChange={onChange} {...delegated}>
      <div className="relative mt-1 z-20">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <MagnifyingGlassIcon
            className="h-5 w-5 text-slate-500 group-focus:text-emerald-400"
            aria-hidden="true"
          />
        </div>
        <Combobox.Input
          className="pr-10 shadow-sm focus:ring-emerald-500 sm:text-sm w-full pl-10 px-4 rounded-md py-2 bg-amald-900 border-2 border-amald-300 text-slate-600 placeholder:text-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-0"
          onClick={(e) => e.target.select()}
          onChange={handleKeyPress}
          displayValue={(entry) => entry?.name}
          placeholder="Search for any fund..."
        />
        <Combobox.Button className="absolute inset-y-0 right-0 flex items-center rounded-r-md px-2 focus:outline-none">
          <ChevronUpDownIcon
            className="h-5 w-5 text-gray-400"
            aria-hidden="true"
          />
        </Combobox.Button>

        {values.length > 0 && (
          <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
            {values.map((entry, index) => (
              <Combobox.Option
                key={index}
                value={entry}
                className={({ active }) =>
                  classNames(
                    "relative cursor-default select-none py-2 pl-3 pr-9",
                    active ? "bg-emerald-600 text-white" : "text-gray-900"
                  )
                }
              >
                {({ active, selected }) => (
                  <div className="flex items-center">
                    <div className="bg-slate-100 text-slate-600 code text-xs font-medium mr-2  py-0.5 rounded w-14 text-center">
                      {entry.symbol}
                    </div>
                    <span
                      className={classNames(
                        "block truncate flex-1 text-sm",
                        selected && "font-semibold"
                      )}
                    >
                      {entry.name}
                    </span>

                    {selected && (
                      <span
                        className={classNames(
                          "absolute inset-y-0 right-0 flex items-center pr-4",
                          active ? "text-white" : "text-amald-600"
                        )}
                      >
                        <CheckIcon className="h-5 w-5" aria-hidden="true" />
                      </span>
                    )}
                  </div>
                )}
              </Combobox.Option>
            ))}
          </Combobox.Options>
        )}
      </div>
    </Combobox>
  );
}
