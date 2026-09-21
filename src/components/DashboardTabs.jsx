import { PRIMARY, MUTED, LINE, SURFACE } from "../theme";

// ---------------------------------------------------------------------------
// Extracted from Dashboard.jsx as part of splitting it into smaller files.
// The overview/sales/customers section switcher — the rest of the
// Dashboard below the filter bar is split into three panes instead of one
// long stack, so a manager sees one focused group at a time.
// ---------------------------------------------------------------------------
export default function DashboardTabs({ t, activeTab, setActiveTab, setSalesTabVisited }) {
  return (
    <div
      className="flex items-center gap-1 mb-4"
      style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 12, padding: 3 }}
    >
      {[
        { key: "overview", label: t.dashTabOverview },
        { key: "sales", label: t.dashTabSales },
        { key: "customers", label: t.dashTabCustomers },
      ].map((tab) => (
        <button
          key={tab.key}
          onClick={() => {
            setActiveTab(tab.key);
            if (tab.key === "sales") setSalesTabVisited(true);
          }}
          className="btn-press flex-1 font-bold text-xs"
          style={{
            borderRadius: 9,
            padding: "8px 0",
            background: activeTab === tab.key ? PRIMARY : "transparent",
            color: activeTab === tab.key ? "#fff" : MUTED,
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
