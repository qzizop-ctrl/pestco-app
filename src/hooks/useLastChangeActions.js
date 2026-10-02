import { useState } from "react";
import { runTransaction, deleteField } from "firebase/firestore";
import { computeRollbackFields, sameLastChange } from "../lastChange";
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

// Thrown inside a review transaction when the record is no longer in the state
// the owner was looking at. kind: "stale" (an editor saved another change
// meanwhile) | "nothing" (no pending change any more — already reviewed).
class ReviewConflictError extends Error {
  constructor(kind) {
    super(`review conflict: ${kind}`);
    this.name = "ReviewConflictError";
    this.kind = kind;
  }
}

// Runs ONE owner review step atomically. The owner decides on the pending
// change they SEE on screen (`expected`); between that moment and the write an
// editor may have saved another edit. A plain updateDoc() would then approve
// (or roll back) a change the owner never looked at, and a rollback would
// overwrite the newer edit with stale values. Inside the transaction the
// stored last_change is re-read and compared; any difference aborts the whole
// step with nothing written. Transactions also retry automatically if the
// document changes while they run.
//
// write(tx, data, current): queues the actual writes; `data` is the freshly
// read document, `current` its stored last_change (== expected).
async function runReviewStep(docRef, expected, write) {
  await runTransaction(docRef.firestore, async (tx) => {
    const snap = await tx.get(docRef);
    if (!snap.exists()) throw new ReviewConflictError("nothing");
    const data = snap.data();
    const current = data.last_change;
    if (!current) throw new ReviewConflictError("nothing");
    if (!sameLastChange(current, expected)) throw new ReviewConflictError("stale");
    write(tx, data, current);
  });
}

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
    let skipFinally = false;
    try {
      skipFinally = (await action(docRef)) === "conflict";
    } finally {
      setLoadingAction(false);
      // After a conflict the owner must stay on the record: the live snapshot
      // is about to show the newer pending change they still have to review.
      if (!skipFinally) onFinally && onFinally();
    }
  };

  // Shared catch-handler: a review conflict is an expected outcome (tell the
  // owner, report nothing); anything else is a real failure.
  const handleStepError = (err, context, errorMsg) => {
    if (err instanceof ReviewConflictError) {
      showAlert(err.kind === "stale" ? t.reviewStaleMsg : t.reviewNothingPendingMsg);
      return "conflict";
    }
    console.error(`${context}:`, err);
    reportException(err, { context });
    showAlert(errorMsg(err.message));
    return undefined;
  };

  const handleApprove = () =>
    run(async (docRef) => {
      if (!isOwnerAccount || !lastChange) return;
      try {
        await runReviewStep(docRef, lastChange, (tx) => {
          tx.update(docRef, { last_change: deleteField() });
        });
        showAlert(t.approveSuccessMsg);
        onAudit && onAudit("approve");
      } catch (err) {
        return handleStepError(err, "last_change approve failed", t.approveErrorMsg);
      }
    });

  const handleRollback = () =>
    run(async (docRef) => {
      if (!isOwnerAccount || !lastChange) return;
      try {
        await runReviewStep(docRef, lastChange, (tx, data, current) => {
          const rollbackPayload = computeRollbackFields(current);
          // A reviewed visit-date edit also added a visit-history entry:
          // remove exactly that entry (matched by id on the freshly read
          // array, so nothing logged since is touched).
          const addedIds = Array.isArray(current.addedVisitEntryIds) ? current.addedVisitEntryIds : [];
          if (addedIds.length > 0 && Array.isArray(data.visitHistory)) {
            rollbackPayload.visitHistory = data.visitHistory.filter((e) => !(e && addedIds.includes(e.id)));
          }
          rollbackPayload.last_change = deleteField();
          tx.update(docRef, rollbackPayload);
        });
        showAlert(t.rollbackSuccessMsg);
        onAudit && onAudit("rollback");
      } catch (err) {
        return handleStepError(err, "last_change rollback failed", t.rollbackErrorMsg);
      }
    });

  const handleConfirmDelete = () =>
    run(async (docRef) => {
      if (!isOwnerAccount || !lastChange) return;
      try {
        await runReviewStep(docRef, lastChange, (tx) => {
          tx.delete(docRef);
        });
        if (deleteSuccessMsg) showAlert(deleteSuccessMsg);
        // Was onAudit("approve") — a permanent delete confirmation was being
        // logged in the audit trail as an "approve", indistinguishable from
        // handleApprove()'s own entry above. "delete" is one of the actions
        // buildAuditEntry() (auditLog.js) documents and expects.
        onAudit && onAudit("delete");
        onDeleteSuccess && onDeleteSuccess();
      } catch (err) {
        return handleStepError(err, "last_change confirm-delete failed", t.deleteFinalErrorMsg);
      }
    });

  const handleRestoreDeleted = () =>
    run(async (docRef) => {
      if (!isOwnerAccount || !lastChange) return;
      try {
        await runReviewStep(docRef, lastChange, (tx) => {
          tx.update(docRef, { deleted: deleteField(), last_change: deleteField() });
        });
        if (restoreSuccessMsg) showAlert(restoreSuccessMsg);
        onAudit && onAudit("restore");
      } catch (err) {
        return handleStepError(err, "last_change restore failed", t.restoreErrorMsg);
      }
    });

  return { loadingAction, handleApprove, handleRollback, handleConfirmDelete, handleRestoreDeleted };
}
