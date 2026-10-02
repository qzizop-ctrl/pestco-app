import { useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { collection, getDocs, orderBy, limit, query } from "firebase/firestore";
import { db } from "../firebase";
import { todayLocalISO } from "../dateUtils";
import { buildBackup, backupFileName, utf8ToBase64 } from "../backupJson";
import { reportException } from "../sentry";

// Most recent audit entries included in a backup (bounds read cost and file
// size; the file says when it was cut — see auditLogTruncated).
const AUDIT_LOG_BACKUP_LIMIT = 5000;

// Full (lossless) JSON backup of the workspace, owner only: every customer and
// supplier document exactly as stored — offers, activity log, visit history,
// pending last_change, soft-deleted records — plus the audit trail. Excel
// export (useExcelExport) stays for people-readable sheets; this is the one to
// restore from. Saved the same way the Excel files are: straight to Downloads
// on Android, a normal download on web / Windows.
//
// `ready`: both collections have really loaded (never back up a list that is
// still empty because the cache has not synced — see useLiveData).
export function useJsonBackup({ ownerUid, user, isOwnerAccount, ready, visits, suppliers, t, notify }) {
  // Builds and saves the file. Throws on failure (callers decide how to tell
  // the user — the weekly prompt and the manual button word it differently).
  const saveFullBackup = useCallback(async () => {
    if (!isOwnerAccount || !ownerUid) return;

    // The audit trail is a subcollection (not in `visits` / `suppliers`), so
    // it is read here. A failure must not block saving everything else.
    let auditLog = null;
    let auditLogError = null;
    let auditLogTruncated = false;
    try {
      const snap = await getDocs(
        query(collection(db, "users", ownerUid, "auditLog"), orderBy("at", "desc"), limit(AUDIT_LOG_BACKUP_LIMIT))
      );
      auditLog = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      auditLogTruncated = snap.size >= AUDIT_LOG_BACKUP_LIMIT;
    } catch (e) {
      auditLogError = e.code || e.message || "unknown";
      reportException(e, { context: "Backup: audit log read failed" });
    }

    const backup = buildBackup({
      ownerUid,
      exportedBy: user?.email || null,
      visits,
      suppliers,
      auditLog,
      auditLogError,
      auditLogTruncated,
    });
    const json = JSON.stringify(backup, null, 2);
    const fileName = backupFileName(todayLocalISO());

    if (Capacitor.isNativePlatform()) {
      const { saveFileNative } = await import("../nativeFileSave");
      await saveFileNative(fileName, utf8ToBase64(json), "application/json");
    } else {
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoked a bit later: some browsers cancel the download otherwise.
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
  }, [isOwnerAccount, ownerUid, user, visits, suppliers]);

  // The Settings button.
  const exportFullBackupJson = useCallback(async () => {
    if (!isOwnerAccount) return;
    if (!ready) {
      notify(t.fullBackupNotReady);
      return;
    }
    try {
      await saveFullBackup();
      notify(t.fullBackupDone);
    } catch (e) {
      console.error("Full JSON backup failed:", e);
      reportException(e, { context: "Full JSON backup failed" });
      notify(t.fullBackupFailed);
    }
  }, [isOwnerAccount, ready, saveFullBackup, notify, t]);

  return { saveFullBackup, exportFullBackupJson };
}
