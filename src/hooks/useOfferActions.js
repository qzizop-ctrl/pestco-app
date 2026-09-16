import { useState } from "react";
import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "../firebase";
import { buildActivity, buildOffer } from "../helpers";

const emptyNewOffer = () => ({
  name: "", offerNumber: "", amount: "", currency: "EGP",
  offerDate: new Date().toISOString().slice(0, 10), status: "pending",
  supplierIds: [], supplierNames: [],
});

// Offers CRUD — stored as an array field on the customer document, same
// pattern as activityLog, so a customer's offers always stay attached to
// their own record. Split out of App.jsx; `appendActivity` is passed in
// (from useActivityLog) rather than duplicated here.
export function useOfferActions({ ownerUid, canEdit, requireOnline, confirmAction, setRejectionPrompt, appendActivity, reportSaveError, t }) {
  const [newOffer, setNewOffer] = useState(emptyNewOffer());
  // Drives the "select suppliers" bottom sheet on the new-offer form.
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);
  const [expandedOfferId, setExpandedOfferId] = useState(null);

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
        initialReason: "",
        onConfirm: (reason) => saveOffer({ ...newOffer, rejectionReason: reason }),
      });
      return;
    }
    await saveOffer(newOffer);
  };

  const updateOfferStatus = async (visit, offer, newStatus) => {
    if (!canEdit || !visit || !ownerUid) return;
    if (!requireOnline()) return;
    if (newStatus === offer.status) return;

    const saveStatus = async (rejectionReason) => {
      const updated = (visit.offers || []).map((o) =>
        o.id === offer.id ? { ...o, status: newStatus, rejectionReason: newStatus === "rejected" ? rejectionReason : "" } : o
      );
      try {
        await updateDoc(doc(db, "users", ownerUid, "visits", visit.id), { offers: updated });
        await appendActivity(visit.id, buildActivity("offer", t.activityOfferStatus(offer.name, t.offerStatuses[newStatus] || newStatus)));
      } catch (e) {
        reportSaveError(e);
      }
    };

    if (newStatus === "rejected") {
      setRejectionPrompt({
        initialReason: offer.rejectionReason || "",
        onConfirm: (reason) => saveStatus(reason),
      });
      return;
    }
    await saveStatus("");
  };

  const deleteOffer = (visit, offer) => {
    if (!canEdit || !visit || !ownerUid) return;
    if (!requireOnline()) return;
    confirmAction(t.deleteOfferConfirm, async () => {
      try {
        await updateDoc(doc(db, "users", ownerUid, "visits", visit.id), {
          offers: arrayRemove(offer),
        });
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
