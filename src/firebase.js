import { initializeApp } from "firebase/app";
import { getAuth, initializeAuth, inMemoryPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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

export const db = getFirestore(app);
