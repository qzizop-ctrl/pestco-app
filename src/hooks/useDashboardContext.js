import { useContext } from "react";
import { DashboardContext } from "../contexts/DashboardContext";

export function useDashboardContext() {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error("useDashboardContext must be used inside a DashboardProvider");
  }
  return ctx;
}
