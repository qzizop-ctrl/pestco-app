import { useEffect, useMemo, useRef } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { beep } from "../sound";
import { requestNotificationPermission, syncCallReminders } from "../notifications";
import { REMINDER_POLL_MS, reminderKey, splitDueReminders } from "../reminderLogic";

// Call reminders, two layers:
//
// 1. In-app (this file's interval): while the app is open, polls every 15s
//    for visits whose reminder time has passed and fires ONE beep plus a
//    notification per fresh reminder. Which reminders count as already fired
//    is remembered per device (see reminderLogic.js) — the shared Firestore
//    `notified` flag is still written by editors so other devices calm down
//    too, but it is no longer what stops a viewer's device from repeating
//    the alert every tick. Reminders that came due long ago (app was closed
//    for days) are collapsed into a single "missed follow-ups" notice; they
//    remain visible in the Alerts Center.
//
// 2. Native (Android only): keeps local notifications, which fire even with
//    the app closed, in step with the live visit list so reminders set by a
//    teammate reach this device too (see syncCallReminders in
//    notifications.js). Web/PWA and Windows builds have no background
//    delivery — that would need push notifications from a server.
//
// `visitsLoaded` must be true only once the first snapshot has arrived: the
// native sync cancels reminders for visits that look deleted, and an empty
// not-yet-loaded list must never be read that way.
export function useReminders({ visits, user, ownerUid, canEdit, t, visitsLoaded = true }) {
  // Reminders (visit id + call time) this device has already alerted on.
  const seenRef = useRef(new Set());

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
    () => visits.filter((v) => v.callDateTime && !v.notified && !v.deleted),
    [visits]
  );

  useEffect(() => {
    if (!user || !ownerUid || !visitsLoaded) return;
    const id = setInterval(() => {
      const { fresh, missed } = splitDueReminders(pendingReminders, {
        now: Date.now(),
        seen: seenRef.current,
      });
      if (fresh.length === 0 && missed.length === 0) return;

      [...fresh, ...missed].forEach((v) => seenRef.current.add(reminderKey(v)));

      beep();
      try {
        if (window.Notification && Notification.permission === "granted") {
          fresh.forEach((v) => {
            new Notification(`${t.reminderTitle} ${v.companyName}`, {
              body: t.reminderBody(v.contactName),
            });
          });
          if (missed.length > 0) {
            new Notification(t.remindersMissedTitle, { body: t.remindersMissedBody(missed.length) });
          }
        }
      } catch {
        // Showing the notification may fail (e.g. permission revoked) — safe to ignore.
      }

      if (canEdit) {
        [...fresh, ...missed].forEach((v) => {
          updateDoc(doc(db, "users", ownerUid, "visits", v.id), { notified: true }).catch((e) => {
            console.warn("Could not mark reminder as notified:", v.id, e?.code);
          });
        });
      }
    }, REMINDER_POLL_MS);
    return () => clearInterval(id);
  }, [pendingReminders, t, user, ownerUid, canEdit, visitsLoaded]);

  useEffect(() => {
    if (!user || !ownerUid || !visitsLoaded) return;
    syncCallReminders(visits, t);
  }, [visits, t, user, ownerUid, visitsLoaded]);

  return { pendingReminders };
}
