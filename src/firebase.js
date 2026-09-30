import { initializeApp } from "firebase/app";
import { getAuth, initializeAuth, inMemoryPersistence, signOut } from "firebase/auth";
import {
  initializeFirestore, persistentLocalCache, persistentSingleTabManager,
  memoryLocalCache, getFirestore,
  terminate, clearIndexedDbPersistence,
} from "firebase/firestore";

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
// The app only ships as an Android (Capacitor) WebView and a Windows
// (Electron) window, so there is never a second "tab". The single-tab
// manager avoids the multi-tab manager's cross-tab lock in IndexedDB, which
// Android can leave stale after an unclean process kill: Firestore then
// waits forever for a lock that is never released, onSnapshot() in
// useLiveData.js never fires, and the UI hangs on its loading skeletons
// until app storage is cleared. (Side effect for `npm run dev`: keep the
// dev server open in ONE browser tab.)

function createFirestore() {
  if (isElectron) {
    return initializeFirestore(app, { localCache: memoryLocalCache() });
  }
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentSingleTabManager(),
      }),
    });
  } catch (e) {
    console.warn("Firestore persistent cache unavailable, falling back to in-memory cache:", e);
    return getFirestore(app);
  }
}

export const db = createFirestore();

// Manual sign-out that also removes the customer data this device cached.
// persistentLocalCache() (above) keeps every customer/supplier document in
// IndexedDB so return visits are fast — but plain signOut() left all of it
// on disk, readable through the browser's dev tools on a shared computer or
// a handed-over phone. Firestore only allows clearing that cache while the
// client is terminated, and a terminated client can't be reused, so the
// page reloads afterwards (which also drops every in-memory copy). Clearing
// can legitimately fail — e.g. the app is open in a second tab — so each
// step is best-effort and the reload happens regardless; the user is
// signed out either way. The in-memory (Electron) cache needs no clearing.
export async function signOutAndClearLocalData() {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn("Sign-out failed:", e);
  }
  try {
    await terminate(db);
    await clearIndexedDbPersistence(db);
  } catch (e) {
    console.warn("Could not clear the local data cache:", e);
  }
  try {
    localStorage.removeItem("pestco_selected_owner");
  } catch {
    // localStorage may be unavailable — safe to ignore.
  }
  window.location.reload();
}
