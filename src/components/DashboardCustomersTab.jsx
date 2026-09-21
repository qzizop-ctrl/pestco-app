import { PRIMARY, MUTED, LINE, SURFACE } from "../theme";
import OffersListSection from "./OffersListSection";
import CustomersAddedSection from "./CustomersAddedSection";

// ---------------------------------------------------------------------------
// Extracted from Dashboard.jsx as part of splitting it into smaller files.
// The "customers" tab's content: the offers/customers sub-toggle plus
// whichever of the two lists is active. `customersSubTab` itself still
// lives in DashboardContext (see contexts/DashboardContext.jsx) — only the
// toggle's markup and the two list sections move here.
// ---------------------------------------------------------------------------
export default function DashboardCustomersTab({
  t, customersSubTab, setCustomersSubTab,
  offersList, offerStatusFilter, setOfferStatusFilter, offersListValueTotals,
  visits, onOpenCustomer, exchangeRate, unifyCurrency,
  customersAddedLabel, periodCustomersList,
}) {
  return (
    <>
      {/* Second-level toggle — this tab used to show the offers list
          and the customers-added list stacked one after another,
          which meant a lot of scrolling once either list had more
          than a handful of rows. */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setCustomersSubTab("offers")}
          className="btn-press font-bold text-xs"
          style={{
            flex: 1,
            borderRadius: 10,
            padding: "7px 0",
            border: `1.4px solid ${customersSubTab === "offers" ? PRIMARY : LINE}`,
            background: customersSubTab === "offers" ? PRIMARY : SURFACE,
            color: customersSubTab === "offers" ? "#fff" : MUTED,
          }}
        >
          {t.dashOffersSection}
        </button>
        <button
          onClick={() => setCustomersSubTab("customers")}
          className="btn-press font-bold text-xs"
          style={{
            flex: 1,
            borderRadius: 10,
            padding: "7px 0",
            border: `1.4px solid ${customersSubTab === "customers" ? PRIMARY : LINE}`,
            background: customersSubTab === "customers" ? PRIMARY : SURFACE,
            color: customersSubTab === "customers" ? "#fff" : MUTED,
          }}
        >
          {t.navCustomers}
        </button>
      </div>

      {customersSubTab === "offers" && (
        <OffersListSection
          t={t}
          offersList={offersList}
          offerStatusFilter={offerStatusFilter}
          setOfferStatusFilter={setOfferStatusFilter}
          offersListValueTotals={offersListValueTotals}
          visits={visits}
          onOpenCustomer={onOpenCustomer}
          exchangeRate={exchangeRate}
          unifyCurrency={unifyCurrency}
        />
      )}

      {customersSubTab === "customers" && (
        <CustomersAddedSection
          t={t}
          customersAddedLabel={customersAddedLabel}
          periodCustomersList={periodCustomersList}
          onOpenCustomer={onOpenCustomer}
        />
      )}
    </>
  );
}
