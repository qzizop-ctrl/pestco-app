import { useEffect, useRef } from "react";
import { reportException } from "../sentry";

const STORAGE_KEY = "pestco_last_auto_backup";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Once a week, asks the workspace owner (only — not every signed-in user)
// whether to save a full Excel backup (visits + suppliers) to this device.
// Nothing is saved unless they confirm the prompt. The last-run timestamp
// lives in localStorage, so it's per device: the owner opening the app on
// a second phone/PC gets its own independent weekly prompt there too.
//
// If they dismiss/decline, the timestamp is NOT updated, so it asks again
// next time the app opens (but at most once per app session either way,
// via askedThisSession).
//
// Deliberately does NOT touch Firestore or any shared config — this is a
// personal safety net for the owner, not a workspace-wide setting other
// members could see or be affected by.
export function useAutoBackup({ isOwnerAccount, ready, visits, suppliers, saveBackupWorkbook, confirmAction, notify, t }) {
  const askedThisSession = useRef(false);

  useEffect(() => {
    if (!isOwnerAccount || !ready || askedThisSession.current) return;

    let lastRun = 0;
    try {
      lastRun = Number(localStorage.getItem(STORAGE_KEY)) || 0;
    } catch (e) {}

    if (Date.now() - lastRun < WEEK_MS) return;

    askedThisSession.current = true;
    confirmAction(t.autoBackupPrompt, async () => {
      try {
        await saveBackupWorkbook(visits, suppliers);
        try {
          localStorage.setItem(STORAGE_KEY, String(Date.now()));
        } catch (e) {}
        notify(t.autoBackupDone);
      } catch (e) {
        console.error("Weekly auto-backup failed:", e);
        reportException(e, { context: "Weekly auto-backup failed" });
        notify(t.autoBackupFailed);
      }
    });
  }, [isOwnerAccount, ready, visits, suppliers, saveBackupWorkbook, confirmAction, notify, t]);
}
