import { createContext, useContext, useState } from "react";

// Holds Dashboard's own tab state (activeTab, customersSubTab,
// salesTabVisited) outside of the Dashboard component itself.
//
// Dashboard only renders while screen === "dashboard" (see
// AppScreens.jsx) and fully unmounts the moment a customer's detail
// screen is opened. Local useState inside Dashboard reset to its
// default every time a manager opened a customer from the Dashboard
// and came back — see the git history on Dashboard.jsx/App.jsx for the
// bug this fixed. Living in a Provider instead, mounted once around
// the whole app in App.jsx, means this state is completely decoupled
// from Dashboard's own mount lifecycle and survives that round trip
// without needing to be threaded through App.jsx and AppScreens.jsx as
// props.
const DashboardContext = createContext(null);

export function DashboardProvider({ children }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [customersSubTab, setCustomersSubTab] = useState("offers");
  const [salesTabVisited, setSalesTabVisited] = useState(false);

  const value = {
    activeTab, setActiveTab,
    customersSubTab, setCustomersSubTab,
    salesTabVisited, setSalesTabVisited,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboardContext() {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error("useDashboardContext must be used inside a DashboardProvider");
  }
  return ctx;
}
