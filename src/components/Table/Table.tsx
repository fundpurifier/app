"use client";

import clsx from "clsx";
import React from "react";

type TableContextType = {
  inHeader: boolean;
};

const TableContext = React.createContext<TableContextType>({ inHeader: false });

const Table = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <>
    <div className="flow-root">
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full py-2 align-middle">
          <table
            className={clsx("min-w-full divide-y divide-gray-300", className)}
          >
            {children}
          </table>
        </div>
      </div>
    </div>
  </>
);

type WithChildren = {
  children: React.ReactNode;
  className?: string;
};

const Header: React.FC<WithChildren> = ({ children }) => (
  <TableContext.Provider value={{ inHeader: true }}>
    <thead>{children}</thead>
  </TableContext.Provider>
);

const Body: React.FC<WithChildren> = ({ children }) => (
  <TableContext.Provider value={{ inHeader: false }}>
    <tbody>{children}</tbody>
  </TableContext.Provider>
);

const Row: React.FC<WithChildren> = ({ children }) => <tr>{children}</tr>;

const Cell: React.FC<WithChildren> = ({ children, className }) => (
  <TableContext.Consumer>
    {({ inHeader }) =>
      inHeader ? (
        <th
          scope="col"
          className={clsx(
            "py-3.5 pl-4 pr-3 text-sm font-semibold text-gray-900 sm:pl-3 text-right",
            className
          )}
        >
          {children}
        </th>
      ) : (
        <td
          className={clsx(
            "whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right",
            className
          )}
        >
          {children}
        </td>
      )
    }
  </TableContext.Consumer>
);

export { Table, Header, Body, Row, Cell };
