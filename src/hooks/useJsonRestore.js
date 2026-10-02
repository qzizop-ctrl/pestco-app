import { useCallback, useRef, useState } from "react";
import { collection, doc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { IMPORT_BATCH_SIZE } from "../domain";
import { parseBackupText, planRestore } from "../backupJson";
import { scheduleCallReminder, cancelCallReminder } from "../notifications";
import { reportException } from "../sentry";

// Restore from the full JSON backup written by useJsonBackup — owner only.
//
// Flow: pick file -> parse + validate (nothing is written yet) -> the card
// shows what is inside and asks "merge" or "replace" -> write.
//   merge:   adds records that are not in the workspace yet, touches nothing
//            that exists.
//   replace: makes the workspace match the file. Because that deletes data,
//            a backup of the CURRENT data is saved to the device first, and
//            the restore is cancelled if that backup fails.
// Records are written under their ORIGINAL ids (so a restore into a workspace
// that already has them overwrites instead of duplicating). The audit trail
// in the file is not written back: the Firestore rules only accept audit
// entries stamped with the server's clock by the person writing them.
export function useJsonRestore({
  ownerUid, isOwnerAccount, ready, visits, suppliers, saveFullBackup, requireOnline, t, notify,
}) {
  const fileInputRef = useRef(null);
  // null, or { fileName, backup, counts } while the choice card is open.
  const [pending, setPending] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [progress, setProgress] = useState(null); // { done, total }

  const trigger = useCallback(() => {
    if (!isOwnerAccount) return;
    if (!ready) {
      notify(t.fullBackupNotReady);
      return;
    }
    if (!requireOnline()) return;
    fileInputRef.current?.click();
  }, [isOwnerAccount, ready, requireOnline, notify, t]);

  const handleFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !isOwnerAccount) return;
    try {
      const parsed = parseBackupText(await file.text());
      if (!parsed.ok) {
        notify(t.restoreInvalid(parsed.reason));
        return;
      }
      const { backup } = parsed;
      setPending({
        fileName: file.name,
        backup,
        counts: { visits: backup.visits.length, suppliers: backup.suppliers.length },
        exportedAt: backup.exportedAt || null,
      });
    } catch (err) {
      console.error("Reading backup file failed:", err);
      reportException(err, { context: "Restore: reading file failed" });
      notify(t.restoreInvalid("invalid_json"));
    }
  }, [isOwnerAccount, notify, t]);

  const cancel = useCallback(() => {
    if (!restoring) setPending(null);
  }, [restoring]);

  const run = useCallback(async (mode) => {
    if (!pending || restoring || !isOwnerAccount || !ownerUid) return;
    if (!requireOnline()) return;

    const plan = planRestore(pending.backup, visits, suppliers, mode, ownerUid);
    const total = plan.visits.write.length + plan.suppliers.write.length
      + plan.visits.remove.length + plan.suppliers.remove.length;
    if (total === 0) {
      setPending(null);
      notify(t.restoreNothingToDo);
      return;
    }

    setRestoring(true);
    let done = 0;
    try {
      // Safety net before anything is deleted/overwritten.
      if (mode === "replace") {
        try {
          await saveFullBackup();
        } catch (err) {
          console.error("Pre-restore backup failed:", err);
          reportException(err, { context: "Restore: safety backup failed" });
          notify(t.restoreSafetyFailed);
          return;
        }
      }

      const visitsCol = collection(db, "users", ownerUid, "visits");
      const suppliersCol = collection(db, "users", ownerUid, "suppliers");
      // Writes first, deletes last: if something fails half way, the worst
      // case is leftover extra records — never a workspace missing data.
      const ops = [
        ...plan.visits.write.map(({ id, data }) => ({ type: "set", ref: doc(visitsCol, id), data })),
        ...plan.suppliers.write.map(({ id, data }) => ({ type: "set", ref: doc(suppliersCol, id), data })),
        ...plan.visits.remove.map((id) => ({ type: "delete", ref: doc(visitsCol, id) })),
        ...plan.suppliers.remove.map((id) => ({ type: "delete", ref: doc(suppliersCol, id) })),
      ];
      setProgress({ done: 0, total: ops.length });
      // Sequential on purpose (same reason as the Excel import): the count of
      // what is already saved stays meaningful if a later chunk fails.
      for (let i = 0; i < ops.length; i += IMPORT_BATCH_SIZE) {
        const chunk = ops.slice(i, i + IMPORT_BATCH_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((op) => (op.type === "set" ? batch.set(op.ref, op.data) : batch.delete(op.ref)));
        await batch.commit(); // NOSONAR — sequential on purpose
        done += chunk.length;
        setProgress({ done, total: ops.length });
      }

      // Call reminders live on the device, not in Firestore: re-arm the ones
      // that are still in the future, drop the ones of deleted customers.
      // Never lets a notification problem fail a restore that already worked.
      try {
        const now = Date.now();
        await Promise.all([
          ...plan.visits.write
            .filter(({ data }) => data.callDateTime && !data.notified && !data.deleted && Date.parse(data.callDateTime) > now)
            .map(({ id, data }) => scheduleCallReminder(
              id, data.callDateTime, `${t.reminderTitle} ${data.companyName}`, t.reminderBody(data.contactName)
            )),
          ...plan.visits.remove.map((id) => cancelCallReminder(id)),
        ]);
      } catch (err) {
        console.warn("Re-arming reminders after restore failed:", err);
      }

      setPending(null);
      const approved = [...plan.visits.write, ...plan.suppliers.write].filter((w) => w.droppedPending).length;
      notify(t.restoreDone(
        plan.visits.write.length + plan.suppliers.write.length,
        plan.visits.remove.length + plan.suppliers.remove.length,
        approved,
      ));
    } catch (err) {
      console.error("Restore failed:", err);
      reportException(err, { context: "JSON restore failed", ownerUid, mode, partiallyRestored: done });
      notify(done > 0 ? t.restorePartialError(done) : t.restoreFailed);
    } finally {
      setRestoring(false);
      setProgress(null);
    }
  }, [pending, restoring, isOwnerAccount, ownerUid, requireOnline, visits, suppliers, saveFullBackup, notify, t]);

  return {
    restoreFileInputRef: fileInputRef,
    triggerRestorePicker: trigger,
    handleRestoreFile: handleFile,
    restorePending: pending,
    restoring,
    restoreProgress: progress,
    cancelRestore: cancel,
    runRestore: run,
  };
}
