import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, inMemoryPersistence } from "firebase/auth";
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

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// نسخة الويندوز (Electron) بتستخدم نفس البروفايل/التخزين بين كل تشغيلة
// وبعدها، فتسجيل الدخول كان بيفضل محفوظ ويدخل على طول من غير ما يطلب
// إيميل وباسورد تاني. هنا بنجبر التطبيق إنه ميتفكرش تسجيل الدخول خالص
// لما يشتغل جوه Electron، فكل مرة تتفتح بتطلب تسجيل دخول من جديد.
// نسخة المتصفح والموبايل مبتتأثرش وفاضلة تفتكر تسجيل الدخول زي العادة.
//
// The Windows (Electron) build reuses the same on-disk profile between
// launches, so a previous login was staying remembered and skipping the
// email/password screen entirely. Force no persistence at all when running
// inside Electron so it always asks to sign in again. The browser and
// mobile builds are untouched and keep remembering the session as before.
const isElectron = typeof navigator !== "undefined" && /electron/i.test(navigator.userAgent || "");
if (isElectron) {
  setPersistence(auth, inMemoryPersistence).catch(() => {});
}
