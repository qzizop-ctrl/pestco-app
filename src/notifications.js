import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { reportException } from "./sentry";

/* ---------------------------------------------------------------
   تنبيهات محلية حقيقية (تعمل حتى لو التطبيق مقفول) — تعمل بس
   لما التطبيق شغال كتطبيق Android حقيقي عبر Capacitor، مش في المتصفح.
   Real local notifications (fire even when the app is closed) —
   only active when running as a real Android app via Capacitor,
   not in a plain browser tab.
------------------------------------------------------------------ */

// ---------------------------------------------------------------
// Capacitor's LocalNotifications plugin needs a 32-bit integer id, not
// the string id Firestore actually gives a visit — idToNumber() used to
// bridge that with a plain hash (mod 2^31). That has a real collision
// problem: it's a pseudo-random mapping from an effectively unbounded id
// space into ~2^31 slots, and by the birthday paradox that's already a
// 50% collision chance at around 46,000 visits ever created (not even
// concurrently — the same instance handed out over the app's lifetime,
// since ids are never reused). When two different visitIds hash to the
// same integer, scheduling a reminder for one silently overwrites (or a
// later cancel wipes out) the other's pending reminder — no error, no
// log, nothing to notice until the wrong reminder fires or one silently
// never does.
//
// No hash function actually fixes this — the collision rate comes from
// squeezing a huge id space into 2^31 slots, not from which hash is
// used. The real fix is to stop deriving the id from the visitId's
// content at all: hand out a strictly increasing counter the first time
// each visitId is ever scheduled, and persist that assignment
// (localStorage, same pattern as useAutoBackup.js's weekly-prompt
// timestamp) so the same visitId always maps to the same id again later
// — cancelCallReminder needs that to find the right notification — and
// two different visitIds can now never collide, by construction, not by
// probability.
//
// Trade-off, accepted deliberately: the id map only ever grows (entries
// for deleted visits are never pruned), but each entry is a few bytes,
// and idForVisit() (see below) is only ever reached from
// scheduleCallReminder() — i.e. only for visits that actually got a call
// reminder date at least once, a small subset of all visits — so even
// years of real usage stays a trivial amount of localStorage. See
// useLiveData.js's own note on this app's expected scale.
const ID_MAP_KEY = "pestco_notification_id_map"; // { [visitId]: number }
const NEXT_ID_KEY = "pestco_notification_next_id";

function readIdMap() {
  try {
    return JSON.parse(localStorage.getItem(ID_MAP_KEY)) || {};
  } catch {
    // localStorage unavailable/corrupt — start from an empty map. Worst
    // case this session hands out ids that collide with ones from a
    // previous session's map we can no longer read, which is strictly
    // no worse than the old hash-based behavior and self-heals once
    // localStorage is available again.
    return {};
  }
}

function readNextId(map) {
  try {
    const stored = Number(localStorage.getItem(NEXT_ID_KEY));
    if (Number.isFinite(stored) && stored > 0) return stored;
  } catch {
    // fall through to the map-derived fallback below
  }
  // No usable counter (first run, or localStorage lost it) — resume
  // above the highest id already handed out, so we never reissue one.
  const used = Object.values(map);
  return (used.length ? Math.max(...used) : 0) + 1;
}

// Returns the stable integer notification id for this visitId, assigning
// (and persisting) a new one the first time this visitId is seen.
function idForVisit(visitId) {
  const map = readIdMap();
  if (map[visitId]) return map[visitId];

  const next = readNextId(map);
  map[visitId] = next;
  try {
    localStorage.setItem(ID_MAP_KEY, JSON.stringify(map));
    localStorage.setItem(NEXT_ID_KEY, String(next + 1));
  } catch {
    // localStorage unavailable — the id still works for this call, it
    // just won't be remembered for a later cancelCallReminder() after a
    // reload. Same "best effort" spirit as useAutoBackup.js.
  }
  return next;
}

// Looks up an id WITHOUT assigning one. cancelCallReminder() below is
// called on every save that has no call date and on every delete — i.e.
// for most visits, which never had a reminder scheduled in the first
// place — so it must never call idForVisit() (which always mints and
// persists a new entry on a miss): that would fill the map with an
// entry for nearly every visit ever saved, not just the ones that
// actually had a pending native notification to cancel.
function peekIdForVisit(visitId) {
  return readIdMap()[visitId] || null;
}

const isNative = () => Capacitor.isNativePlatform();

export async function requestNotificationPermission() {
  if (!isNative()) return;
  try {
    await LocalNotifications.requestPermissions();
  } catch (err) {
    // الجهاز رفض الإذن أو غير مدعوم — لسه بنسجله عشان نقدر نميّز ده من أي
    // فشل تاني غريب في الـ logs.
    // Permission denied or unsupported — still logged so it's distinguishable
    // in Sentry from an unexpected native failure, even though there's
    // nothing actionable to do about it here.
    console.warn("Notification permission request failed:", err);
    reportException(err, { context: "Notification permission request failed" });
  }
}

export async function scheduleCallReminder(visitId, callDateTime, title, body) {
  if (!isNative() || !callDateTime) return;
  const when = new Date(callDateTime);
  if (isNaN(when.getTime()) || when.getTime() <= Date.now()) return;
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: idForVisit(visitId),
          title,
          body,
          schedule: { at: when, allowWhileIdle: true },
        },
      ],
    });
  } catch (err) {
    // كانت متجاهلة تمامًا — لو الجدولة فشلت، المستخدم مكانش هيلاقي أي أثر
    // في أي مكان يوضح ليه التذكير ماجاش. لسه بنكمل عادي (مفيش داعي نوقف
    // الاستيراد/الحفظ بسبب تذكير فشل)، بس بقى بيتسجل.
    // Was silently ignored — if scheduling failed, nothing anywhere told
    // the user (or us, in Sentry) why the reminder never showed up. Still
    // non-fatal (a failed reminder shouldn't block the save/import that
    // triggered it), but now at least logged.
    console.warn("scheduleCallReminder failed:", visitId, err);
    reportException(err, { context: "scheduleCallReminder failed", visitId });
  }
}

export async function cancelCallReminder(visitId) {
  if (!isNative()) return;
  // No id was ever assigned to this visit (it never had a reminder
  // scheduled) — nothing to cancel, and must not call idForVisit() here
  // (see peekIdForVisit's comment above).
  const id = peekIdForVisit(visitId);
  if (!id) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id }] });
  } catch (err) {
    console.warn("cancelCallReminder failed:", visitId, err);
    reportException(err, { context: "cancelCallReminder failed", visitId });
  }
}
