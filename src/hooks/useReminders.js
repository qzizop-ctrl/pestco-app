import { useEffect, useMemo } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { beep } from "../sound";
import { requestNotificationPermission } from "../notifications";

// Requests notification permission on mount, then polls every 15s for any
// visit whose call reminder time has passed and fires a beep + browser
// notification for it (marking it notified so it doesn't fire again).
export function useReminders({ visits, user, ownerUid, canEdit, t }) {
  useEffect(() => {
    try {
      if (window.Notification && Notification.permission === "default") {
        Notification.requestPermission();
      }
    } catch {
      // Requesting notification permission may be unsupported or blocked — safe to ignore.
    }
    requestNotificationPermission();
  }, []);

  // Reminder checks only need to look at visits that actually have a
  // pending call reminder — most customers won't at any given moment.
  // Precomputing this list means the interval below scans a small subset
  // instead of the entire customer list on every tick.
  const pendingReminders = useMemo(
    () => visits.filter((v) => v.callDateTime && !v.notified),
    [visits]
  );

  useEffect(() => {
    if (!user || !ownerUid) return;
    const id = setInterval(() => {
      const now = Date.now();
      pendingReminders.forEach((v) => {
        if (new Date(v.callDateTime).getTime() <= now) {
          beep();
          try {
            if (window.Notification && Notification.permission === "granted") {
              new Notification(`${t.reminderTitle} ${v.companyName}`, {
                body: t.reminderBody(v.contactName),
              });
            }
          } catch {
            // Showing the notification may fail (e.g. permission revoked) — safe to ignore.
          }
          if (canEdit) {
            updateDoc(doc(db, "users", ownerUid, "visits", v.id), { notified: true }).catch(() => {});
          }
        }
      });
    }, 15000);
    return () => clearInterval(id);
  }, [pendingReminders, t, user, ownerUid, canEdit]);

  return { pendingReminders };
}
