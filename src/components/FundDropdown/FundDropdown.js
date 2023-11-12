"use client";

import React from "react";
import Combobox from "@/components/Combobox";
import elasticlunr from "elasticlunr";
import { getAllFunds } from "./actions";

function FundDropdown({ onChange, ...delegated }) {
  const [selected, setSelected] = React.useState(null);
  const [funds, setFunds] = React.useState([]);
  const [filteredFunds, setFilteredFunds] = React.useState([]);
  const [index, setIndex] = React.useState(null);

  React.useEffect(() => {
    if (!funds.length) return;

    // Update the index
    const newIndex = elasticlunr(function () {
      this.addField("name");
      this.addField("symbol");
      this.setRef("isin");
    });
    funds.forEach((fund) => newIndex.addDoc(fund));
    setIndex(newIndex);
  }, [funds]);

  React.useEffect(() => {
    getAllFunds().then((funds) => setFunds(funds));
  }, []);

  const handleChange = React.useCallback(function (value) {
    setSelected(value);
    onChange(value);
  }, []);

  function handleKeyPress(query) {
    if (!index) return;

    const filtered =
      query === ""
        ? funds
        : index
          .search(query)
          .map(({ ref }) => funds.find((f) => f.isin === ref));
    setFilteredFunds(filtered.slice(0, 25));
  }

  return (
    <Combobox
      {...delegated}
      values={filteredFunds}
      selected={selected}
      onKeyPress={handleKeyPress}
      onChange={handleChange}
    />
  );
}

export default FundDropdown;
