import { useState } from "react";
import { updateDoc, deleteDoc, deleteField } from "firebase/firestore";
import { computeRollbackFields } from "../lastChange";
import { reportException } from "../sentry";

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
// onAudit (optional): (action) => void — called after a successful
// approve/rollback/confirmDelete/restore so the caller can write a
// matching entry to the unified Audit Log (see useAuditLog.js). Kept as a
// single callback rather than importing logAudit here directly, since this
// hook is deliberately entity-agnostic (customer vs supplier) and has no
// entityType/entityName/ownerUid of its own — the caller (CustomerDetail.jsx
// / SupplierFormScreen) already has all of that.
//
// showAlert: the app's in-app alert modal (see useDialogState.js /
// ConfirmModal.jsx) — NOT window.alert(). window.alert()/confirm() hang the
// Android WebView (see ConfirmModal.jsx's own comment on this), which is
// exactly why that modal was built; this hook previously called the native
// alert() directly on every branch below, defeating that fix for every
// approve/rollback/delete/restore flow. Required (not optional) so a call
// site can't silently fall back to the native dialog by omitting it.
export function useLastChangeActions({
  getDocRef, isOwnerAccount, lastChange, t, onFinally, onDeleteSuccess,
  deleteSuccessMsg, restoreSuccessMsg, onAudit, showAlert,
}) {
  const [loadingAction, setLoadingAction] = useState(false);

  const run = async (action) => {
    const docRef = getDocRef();
    if (!docRef) {
      showAlert(t.workspaceResolveError);
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
        showAlert(t.approveSuccessMsg);
        onAudit && onAudit("approve");
      } catch (err) {
        console.error("last_change approve failed:", err);
        reportException(err, { context: "last_change approve failed" });
        showAlert(t.approveErrorMsg(err.message));
      }
    });

  const handleRollback = () =>
    run(async (docRef) => {
      if (!isOwnerAccount || !lastChange) return;
      try {
        const rollbackPayload = computeRollbackFields(lastChange);
        rollbackPayload.last_change = deleteField();
        await updateDoc(docRef, rollbackPayload);
        showAlert(t.rollbackSuccessMsg);
        onAudit && onAudit("rollback");
      } catch (err) {
        console.error("last_change rollback failed:", err);
        reportException(err, { context: "last_change rollback failed" });
        showAlert(t.rollbackErrorMsg(err.message));
      }
    });

  const handleConfirmDelete = () =>
    run(async (docRef) => {
      if (!isOwnerAccount) return;
      try {
        await deleteDoc(docRef);
        if (deleteSuccessMsg) showAlert(deleteSuccessMsg);
        // Was onAudit("approve") — a permanent delete confirmation was being
        // logged in the audit trail as an "approve", indistinguishable from
        // handleApprove()'s own entry above. "delete" is one of the actions
        // buildAuditEntry() (auditLog.js) documents and expects.
        onAudit && onAudit("delete");
        onDeleteSuccess && onDeleteSuccess();
      } catch (err) {
        console.error("last_change confirm-delete failed:", err);
        reportException(err, { context: "last_change confirm-delete failed" });
        showAlert(t.deleteFinalErrorMsg(err.message));
      }
    });

  const handleRestoreDeleted = () =>
    run(async (docRef) => {
      if (!isOwnerAccount) return;
      try {
        await updateDoc(docRef, { deleted: deleteField(), last_change: deleteField() });
        if (restoreSuccessMsg) showAlert(restoreSuccessMsg);
        onAudit && onAudit("restore");
      } catch (err) {
        console.error("last_change restore failed:", err);
        reportException(err, { context: "last_change restore failed" });
        showAlert(t.restoreErrorMsg(err.message));
      }
    });

  return { loadingAction, handleApprove, handleRollback, handleConfirmDelete, handleRestoreDeleted };
}
