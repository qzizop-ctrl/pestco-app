import { useEffect, useState } from "react";

// The supplier-list search/filter UI state — same pattern as
// useCustomerFilters, kept as its own hook (rather than merged into that
// one) because customers and suppliers are separate lists with separate
// filter sets, and App.jsx already treats them as two distinct blocks.
export function useSupplierFilters() {
  const [supplierQuery, setSupplierQuery] = useState("");
  // Same pattern as the customer search: the input stays bound to
  // supplierQuery directly for instant typing feedback, while filtering
  // reads the debounced value 250ms after the user stops typing.
  const [debouncedSupplierQuery, setDebouncedSupplierQuery] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSupplierQuery(supplierQuery), 250);
    return () => clearTimeout(id);
  }, [supplierQuery]);
  const [supplierTagFilter, setSupplierTagFilter] = useState("all");
  const [supplierCategoryFilter, setSupplierCategoryFilter] = useState("all");

  return {
    supplierQuery, setSupplierQuery, debouncedSupplierQuery,
    supplierTagFilter, setSupplierTagFilter,
    supplierCategoryFilter, setSupplierCategoryFilter,
  };
}
