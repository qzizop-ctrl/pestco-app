import { useState } from "react";
import { updateDoc, deleteDoc, deleteField } from "firebase/firestore";
import { computeRollbackFields } from "../lastChange";

// ============================================================================
// Shared "owner review" actions for a pending last_change on either a
// customer (visits/{id}) or a supplier (suppliers/{id}) document: approve
// (clear the pending edit), rollback (restore the old values and clear it),
// confirm a pending delete (permanently remove the doc), or restore a
// soft-deleted record.
//
// Previously this exact logic (including the rollback field-merging) was
// duplicated between CustomerDetail.jsx and Suppliers.jsx — the customer
// side called the shared, unit-tested computeRollbackFields() from
// lastChange.js, while the supplier side had its own hand-rolled copy of
// the same merge, so a future fix to the rollback rules could easily be
// applied to one and forgotten on the other. Both now go through here.
//
// getDocRef: () => DocumentReference | null — resolves the Firestore doc for
//   the active record; returning null (e.g. no ownerUid yet) surfaces
//   t.workspaceResolveError instead of throwing.
// isOwnerAccount: only the workspace owner (or reviewer) may run these.
// lastChange: the record's current `last_change` field, if any.
// onFinally: optional, called after every action (success or failure) —
//   e.g. navigating back to a list screen.
// onDeleteSuccess: optional, called only once a permanent delete succeeds.
// deleteSuccessMsg / restoreSuccessMsg: entity-specific confirmation text
//   ("Customer permanently deleted." vs "Supplier permanently deleted."),
//   since that wording differs between customers and suppliers.
// ============================================================================
export function useLastChangeActions({
  getDocRef, isOwnerAccount, lastChange, t, onFinally, onDeleteSuccess,
  deleteSuccessMsg, restoreSuccessMsg,
}) {
  const [loadingAction, setLoadingAction] = useState(false);

  const run = async (action) => {
    const docRef = getDocRef();
    if (!docRef) {
      alert(t.workspaceResolveError);
      return;
    }
    setLoadingAction(true);
    try {
      await action(docRef);
    } finally {
      setLoadingAction(false);
      onFinally && onFinally();
    }
  };

  const handleApprove = () =>
    run(async (docRef) => {
      if (!isOwnerAccount) return;
      try {
        await updateDoc(docRef, { last_change: deleteField() });
        alert(t.approveSuccessMsg);
      } catch (err) {
        console.error("last_change approve failed:", err);
        alert(t.approveErrorMsg(err.message));
      }
    });

  const handleRollback = () =>
    run(async (docRef) => {
      if (!isOwnerAccount || !lastChange) return;
      try {
        const rollbackPayload = computeRollbackFields(lastChange);
        rollbackPayload.last_change = deleteField();
        await updateDoc(docRef, rollbackPayload);
        alert(t.rollbackSuccessMsg);
      } catch (err) {
        console.error("last_change rollback failed:", err);
        alert(t.rollbackErrorMsg(err.message));
      }
    });

  const handleConfirmDelete = () =>
    run(async (docRef) => {
      if (!isOwnerAccount) return;
      try {
        await deleteDoc(docRef);
        if (deleteSuccessMsg) alert(deleteSuccessMsg);
        onDeleteSuccess && onDeleteSuccess();
      } catch (err) {
        console.error("last_change confirm-delete failed:", err);
        alert(t.deleteFinalErrorMsg(err.message));
      }
    });

  const handleRestoreDeleted = () =>
    run(async (docRef) => {
      if (!isOwnerAccount) return;
      try {
        await updateDoc(docRef, { deleted: deleteField(), last_change: deleteField() });
        if (restoreSuccessMsg) alert(restoreSuccessMsg);
      } catch (err) {
        console.error("last_change restore failed:", err);
        alert(t.restoreErrorMsg(err.message));
      }
    });

  return { loadingAction, handleApprove, handleRollback, handleConfirmDelete, handleRestoreDeleted };
}
