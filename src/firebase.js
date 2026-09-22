import { initializeApp } from "firebase/app";
import { getAuth, initializeAuth, inMemoryPersistence } from "firebase/auth";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  persistentSingleTabManager, memoryLocalCache, getFirestore,
} from "firebase/firestore";
import { Capacitor } from "@capacitor/core";

/* ---------------------------------------------------------------
   إعدادات Firebase — بتتقرأ من متغيرات البيئة (Environment Variables)
   عشان متحطش المفاتيح مباشرة في الكود ومتترفعش على GitHub بالغلط.

   للتشغيل محليًا: انسخ .env.example لملف اسمه .env واملأ القيم فيه.
   على GitHub Actions: القيم بتيجي من الـ Secrets المضبوطة في إعدادات
   المستودع (شرح كامل في README.md).

   Firebase config — read from environment variables so the keys
   never get hardcoded into the source or accidentally pushed to
   GitHub.

   Local dev: copy .env.example to .env and fill in the values.
   GitHub Actions: values come from repo Secrets (see README.md).
------------------------------------------------------------------ */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// نسخة الويندوز (Electron) بتستخدم نفس البروفايل/التخزين بين كل تشغيلة
// وبعدها، فتسجيل الدخول كان بيفضل محفوظ ويدخل على طول من غير ما يطلب
// إيميل وباسورد تاني. الحل القديم كان بيستخدم getAuth() ثم setPersistence()
// بعده — بس getAuth() بيبدأ فورًا يدور على جلسة محفوظة قبل ما سطر
// setPersistence يتنفذ (لأنه Async)، فكان أحيانًا يلحق يرجّع الجلسة القديمة
// ويفتح على البيانات قبل ما الإصلاح يمنعه. هنا بنستخدم initializeAuth() من
// الأول ونحدد نوع التخزين وهو بيتبني، عشان Electron ميدورش على أي جلسة
// محفوظة خالص من البداية، وكل مرة تتفتح بتطلب تسجيل دخول من جديد فعليًا.
// نسخة المتصفح والموبايل مبتتأثرش وفاضلة تفتكر تسجيل الدخول زي العادة.
//
// The Windows (Electron) build reuses the same on-disk profile between
// launches, so a previous login was staying remembered and skipping the
// email/password screen entirely. The old fix called getAuth() then
// setPersistence() afterward — but getAuth() immediately starts restoring
// any persisted session, and since setPersistence() is async, that restore
// could finish first and let the old session through before the fix took
// effect. Using initializeAuth() with the persistence set up front means
// Electron never reads a stored session in the first place, so it reliably
// asks to sign in again on every launch. The browser and mobile builds are
// untouched and keep remembering the session as before.
const isElectron = typeof navigator !== "undefined" && /electron/i.test(navigator.userAgent || "");
export const auth = isElectron
  ? initializeAuth(app, { persistence: inMemoryPersistence })
  : getAuth(app);

// ---------------------------------------------------------------
// Firestore local cache (IndexedDB persistence).
// ---------------------------------------------------------------
// useLiveData.js loads every visit/supplier document on every app open —
// deliberately, since search/filters/reminders/Dashboard all need the
// complete set (see the long comment there for why real query pagination
// isn't a safe drop-in fix). What IS safe to fix without touching any of
// that: on a RETURN visit to the app, there's no reason to re-download the
// entire collection over the network again if nothing changed since last
// time. persistentLocalCache() stores the last-synced snapshot in IndexedDB,
// so onSnapshot below can resolve near-instantly from that local copy first
// and then just sync whatever actually changed on the server — same
// complete, correct dataset, far less network time and mobile data usage on
// every open after the first.
//
// This does NOT fix the very first-ever load on a brand new device/browser
// profile — that still has to pull the whole collection from the network
// once, same as before. It also doesn't reduce how much data the app holds
// in memory at once. Both of those are the bigger, riskier redesign flagged
// in useLiveData.js and are intentionally still out of scope here.
//
// Electron is deliberately excluded: it already avoids persisting the LOGIN
// SESSION on purpose (see initializeAuth above — a Windows PC is treated as
// a possibly-shared machine, so every launch asks to sign in again). Adding
// a persistent on-disk cache of actual customer data would undermine that
// same intent — the data would sit readable on disk even for someone who
// never signs in. So Electron keeps the default in-memory-only cache
// (cleared on every restart, exactly like today) and only the browser/PWA
// and Android builds — which already keep the user signed in between
// visits — get the faster/cheaper local cache.
//
// persistentLocalCache() can fail (Safari private browsing, a browser with
// IndexedDB disabled, some in-app WebViews). If it does, this falls back to
// the plain in-memory client so the app still works — just back to
// re-fetching everything over the network each time, the previous behavior.
// Android (Capacitor) runs the whole app in a single WebView — there is
// never more than one "tab" — so persistentMultipleTabManager()'s cross-tab
// lock in IndexedDB buys nothing there and creates a real failure mode: if
// Android kills the app process uncleanly (swipe-away, low memory, OS
// backgrounding) instead of letting it shut down, the lock record can be
// left stale. On the next launch Firestore waits to acquire a lock that
// never gets released, so onSnapshot() in useLiveData.js never fires its
// success OR error callback — the UI hangs on its loading skeletons forever
// (visible as "0" counts that never resolve), and the only fix is clearing
// app storage to wipe the stale lock out of IndexedDB. Using
// persistentSingleTabManager() on native Android sidesteps that lock
// entirely. Desktop browser/PWA use keeps the multi-tab manager, since a
// person really can have the app open in more than one browser tab there.
const isNativeAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

function createFirestore() {
  if (isElectron) {
    return initializeFirestore(app, { localCache: memoryLocalCache() });
  }
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: isNativeAndroid ? persistentSingleTabManager() : persistentMultipleTabManager(),
      }),
    });
  } catch (e) {
    console.warn("Firestore persistent cache unavailable, falling back to in-memory cache:", e);
    return getFirestore(app);
  }
}

export const db = createFirestore();
