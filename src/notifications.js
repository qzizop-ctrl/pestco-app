import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

/* ---------------------------------------------------------------
   تنبيهات محلية حقيقية (تعمل حتى لو التطبيق مقفول) — تعمل بس
   لما التطبيق شغال كتطبيق Android حقيقي عبر Capacitor، مش في المتصفح.
   Real local notifications (fire even when the app is closed) —
   only active when running as a real Android app via Capacitor,
   not in a plain browser tab.
------------------------------------------------------------------ */

// يحول أي id نصي (زي معرف Firestore) لرقم صحيح موجب يصلح كمعرف إشعار
// Convert a string id (like a Firestore doc id) into a stable positive integer
function idToNumber(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 1;
}

export const isNative = () => Capacitor.isNativePlatform();

export async function requestNotificationPermission() {
  if (!isNative()) return;
  try {
    await LocalNotifications.requestPermissions();
  } catch (e) {
    /* الجهاز رفض الإذن أو غير مدعوم / permission denied or unsupported */
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
          id: idToNumber(visitId),
          title,
          body,
          schedule: { at: when, allowWhileIdle: true },
        },
      ],
    });
  } catch (e) {
    /* تجاهل خطأ الجدولة / ignore scheduling error */
  }
}

export async function cancelCallReminder(visitId) {
  if (!isNative()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: idToNumber(visitId) }] });
  } catch (e) {
    /* تجاهل خطأ الإلغاء / ignore cancel error */
  }
}
