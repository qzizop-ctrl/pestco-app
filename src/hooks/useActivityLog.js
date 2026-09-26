import { doc, runTransaction, updateDoc, arrayRemove } from "firebase/firestore";
import { db } from "../firebase";
import { buildActivity } from "../activityHelpers";
import { ACTIVITY_LOG_CAP } from "../domain";

// A visit's activity timeline is written to from several places (customer
// CRUD, offers, and the activity feed itself), so `appendActivity` is kept
// as a small standalone helper — not owned by this hook — that only needs
// ownerUid. Everything else here (deleteActivity/submitActivity) is
// specific to the *currently open* customer (`active`), which is why those
// stay inside this hook.
//
// This runs as a transaction rather than a plain arrayUnion because
// enforcing ACTIVITY_LOG_CAP means reading the current array to trim its
// oldest entry before writing the new one — arrayUnion alone can only ever
// grow the array, it has no way to also drop something. The transaction is
// what keeps that read-then-write safe if two people add an activity entry
// for the same customer at nearly the same moment (one editor and an
// admin, say): without it, the slower write could silently overwrite the
// faster one's trim instead of building on top of it.
export function makeAppendActivity(ownerUid, reportSaveError) {
  return async function appendActivity(visitId, activity) {
    if (!ownerUid) return;
    try {
      const ref = doc(db, "users", ownerUid, "visits", visitId);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const current = Array.isArray(snap.data()?.activityLog) ? snap.data().activityLog : [];
        // Oldest first, so trimming below always drops the actual oldest
        // entries rather than whatever happened to be first in the array.
        const sorted = [...current].sort((a, b) => (a.at < b.at ? -1 : 1));
        const next = [...sorted, activity];
        const trimmed = next.length > ACTIVITY_LOG_CAP ? next.slice(next.length - ACTIVITY_LOG_CAP) : next;
        tx.update(ref, { activityLog: trimmed });
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
  // Removes one entry from the currently open visit's activity timeline
  // (with confirmation). This one stays a plain arrayRemove — deleting
  // only ever shrinks the array, so there's no trimming to coordinate and
  // no need for the transaction appendActivity above uses.
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

