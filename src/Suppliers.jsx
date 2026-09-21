// ============================================================================
// Suppliers screens — the list and the form used to both live in this one
// file. They're now split into ./suppliers/SuppliersListScreen.jsx and
// ./suppliers/SupplierFormScreen.jsx (each was a large, self-contained
// screen in its own right). This file stays only so AppScreens.jsx's
// existing import keeps working unchanged.
// ============================================================================
export { SuppliersListScreen } from "./suppliers/SuppliersListScreen";
export { SupplierFormScreen } from "./suppliers/SupplierFormScreen";
