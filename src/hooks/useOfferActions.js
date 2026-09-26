import { useState } from "react";
import { doc, updateDoc, arrayUnion, runTransaction } from "firebase/firestore";
import { db } from "../firebase";
import { buildActivity } from "../activityHelpers";
import { todayLocalISO } from "../dateUtils";
import { buildOffer } from "../offerHelpers";

const emptyNewOffer = () => ({
  name: "", offerNumber: "", amount: "", currency: "EGP",
  offerDate: todayLocalISO(), status: "pending",
  supplierIds: [], supplierNames: [],
});

// Offers CRUD — stored as an array field on the customer document, same
// pattern as activityLog, so a customer's offers always stay attached to
// their own record. Split out of App.jsx; `appendActivity` is passed in
// (from useActivityLog) rather than duplicated here.
export function useOfferActions({ ownerUid, user, canEdit, requireOnline, confirmAction, setRejectionPrompt, appendActivity, reportSaveError, t }) {
  const [newOffer, setNewOffer] = useState(emptyNewOffer());
  // Drives the "select suppliers" bottom sheet on the new-offer form.
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);
  const [expandedOfferId, setExpandedOfferId] = useState(null);

  // Builds the extra rejection fields stamped onto an offer at the
  // moment it's rejected — reasonId feeds the Dashboard's rejection-
  // reasons report (grouped by id, not free text), rejectedBy/rejectedById
  // let that report compare reps, and rejectedAt is what the report's
  // date-range filter (the Dashboard's existing period picker) checks
  // instead of offerDate, since an offer can be rejected well after it
  // was first created.
  // Read-modify-write of a visit's offers array inside a transaction, so a
  // change to ONE offer is applied to the latest server copy. Writing back
  // an array built from the (possibly stale) local snapshot would erase an
  // offer another user added, or a status change they made, in the meantime.
  // arrayUnion (used when adding) is already safe; this covers edit/remove.
  const mutateOffers = (visitId, mutate) =>
    runTransaction(db, async (tx) => {
      const ref = doc(db, "users", ownerUid, "visits", visitId);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("visit-not-found");
      const current = Array.isArray(snap.data().offers) ? snap.data().offers : [];
      tx.update(ref, { offers: mutate(current) });
    });

  const rejectionFields = ({ reasonId, label }) => ({
    rejectionReason: label,
    rejectionReasonId: reasonId,
    rejectedBy: user?.displayName || user?.email || t.unknownUser,
    rejectedById: user?.uid || null,
    rejectedAt: new Date().toISOString(),
  });

  const resetNewOffer = () => {
    setNewOffer(emptyNewOffer());
    setExpandedOfferId(null);
  };

  const toggleOfferSupplier = (supplier) => {
    setNewOffer((prev) => {
      const supplierIds = prev.supplierIds || [];
      const supplierNames = prev.supplierNames || [];
      const isSelected = supplierIds.includes(supplier.id);
      return {
        ...prev,
        supplierIds: isSelected
          ? supplierIds.filter((id) => id !== supplier.id)
          : [...supplierIds, supplier.id],
        supplierNames: isSelected
          ? supplierNames.filter((n) => n !== supplier.name)
          : [...supplierNames, supplier.name],
      };
    });
  };

  const addOffer = async (visit) => {
    if (!canEdit || !visit || !ownerUid) return;
    if (!requireOnline()) return;
    if (!newOffer.name.trim()) return;

    const saveOffer = async (offerToSave) => {
      const offer = buildOffer(offerToSave);
      try {
        await updateDoc(doc(db, "users", ownerUid, "visits", visit.id), {
          offers: arrayUnion(offer),
        });
        await appendActivity(visit.id, buildActivity("offer", t.activityOfferAdded(offer.name)));
        setNewOffer(emptyNewOffer());
      } catch (e) {
        reportSaveError(e);
      }
    };

    if (newOffer.status === "rejected") {
      setRejectionPrompt({
        initialReasonId: "",
        initialReasonText: "",
        onConfirm: (picked) => saveOffer({ ...newOffer, ...rejectionFields(picked) }),
      });
      return;
    }
    await saveOffer(newOffer);
  };

  const updateOfferStatus = async (visit, offer, newStatus) => {
    if (!canEdit || !visit || !ownerUid) return;
    if (!requireOnline()) return;
    if (newStatus === offer.status) return;

    const saveStatus = async (extraFields) => {
      const patch = {
        status: newStatus,
        ...(newStatus === "rejected"
          ? extraFields
          : { rejectionReason: "", rejectionReasonId: "", rejectedBy: "", rejectedById: null, rejectedAt: "" }),
      };
      try {
        await mutateOffers(visit.id, (current) =>
          current.map((o) => (o.id === offer.id ? { ...o, ...patch } : o))
        );
        await appendActivity(visit.id, buildActivity("offer", t.activityOfferStatus(offer.name, t.offerStatuses[newStatus] || newStatus)));
      } catch (e) {
        reportSaveError(e);
      }
    };

    if (newStatus === "rejected") {
      // Legacy offers (rejected before this feature existed) only have
      // free-text rejectionReason and no reasonId — re-opening the modal
      // on one of those pre-fills the "other" text field with that old
      // text instead of losing it, but still requires picking a reasonId
      // (defaults to "other" in the modal) going forward.
      setRejectionPrompt({
        initialReasonId: offer.rejectionReasonId || (offer.rejectionReason ? "other" : ""),
        initialReasonText: !offer.rejectionReasonId || offer.rejectionReasonId === "other" ? (offer.rejectionReason || "") : "",
        onConfirm: (picked) => saveStatus(rejectionFields(picked)),
      });
      return;
    }
    await saveStatus({});
  };

  const deleteOffer = (visit, offer) => {
    if (!canEdit || !visit || !ownerUid) return;
    if (!requireOnline()) return;
    confirmAction(t.deleteOfferConfirm, async () => {
      try {
        await mutateOffers(visit.id, (current) => current.filter((o) => o.id !== offer.id));
      } catch (e) {
        reportSaveError(e);
      }
    }, { danger: true });
  };

  return {
    newOffer, setNewOffer, resetNewOffer,
    supplierPickerOpen, setSupplierPickerOpen, toggleOfferSupplier,
    expandedOfferId, setExpandedOfferId,
    addOffer, updateOfferStatus, deleteOffer,
  };
}
