import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
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
