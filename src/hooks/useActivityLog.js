import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "../firebase";
import { buildActivity } from "../helpers";

// A visit's activity timeline is written to from several places (customer
// CRUD, offers, and the activity feed itself), so `appendActivity` is kept
// as a small standalone helper — not owned by this hook — that only needs
// ownerUid. Everything else here (deleteActivity/submitActivity) is
// specific to the *currently open* customer (`active`), which is why those
// stay inside this hook.
export function makeAppendActivity(ownerUid, reportSaveError) {
  return async function appendActivity(visitId, activity) {
    if (!ownerUid) return;
    try {
      await updateDoc(doc(db, "users", ownerUid, "visits", visitId), {
        activityLog: arrayUnion(activity),
      });
    } catch (e) {
      reportSaveError(e);
    }
  };
}

// `newActivityText` is owned by App.jsx (not this hook) — it's part of the
// same "reset when a different customer's detail screen is opened" group
// as useOfferActions' newOffer, and keeping it there avoids a circular
// dependency: useCustomerRecords.openDetail needs to reset it, but it also
// needs `active`, which depends on the activeId useCustomerRecords itself
// owns.
export function useActivityLog({ ownerUid, active, canEdit, requireOnline, confirmAction, appendActivity, reportSaveError, t, newActivityText, setNewActivityText }) {
  // Removes one entry from the currently open visit's activity timeline (with confirmation).
  const deleteActivity = (entry) => {
    if (!canEdit || !active || !ownerUid) return;
    if (!requireOnline()) return;
    confirmAction(t.deleteActivityConfirm, async () => {
      try {
        await updateDoc(doc(db, "users", ownerUid, "visits", active.id), {
          activityLog: arrayRemove(entry),
        });
      } catch (e) {
        reportSaveError(e);
      }
    }, { danger: true });
  };

  const submitActivity = async () => {
    if (!canEdit || !active) return;
    if (!requireOnline()) return;
    const text = newActivityText.trim();
    if (!text) return;
    await appendActivity(active.id, buildActivity("note", text));
    setNewActivityText("");
  };

  return { deleteActivity, submitActivity };
}
