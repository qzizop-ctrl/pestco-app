# Pest.Co — تطبيق زيارات العملاء

تطبيق React لتسجيل زيارات العملاء ومتابعة مواعيد الاتصال بهم، بتسجيل دخول بالبريد الإلكتروني وحفظ سحابي عبر Firebase — يعني بياناتك بتتزامن من أي جهاز تدخل بيه بنفس الحساب.

## خطوات إعداد Firebase (لازمة قبل أول تشغيل)

1. روح على [console.firebase.google.com](https://console.firebase.google.com) واعمل مشروع جديد (مجاني).
2. من القائمة الجانبية: **Build > Authentication** → تبويب **Sign-in method** → فعّل **Email/Password**.
3. من القائمة الجانبية: **Build > Firestore Database** → **Create database** → اختار وضع **Production mode** (أو أي وضع، هنستخدم القواعد بتاعتنا بعدين).
4. من **Project settings** (أيقونة الترس) → في تبويب **General** انزل لقسم **Your apps** → اضغط أيقونة `</>` (Web) واعمل تسجيل تطبيق ويب جديد.
5. هيديك كائن `firebaseConfig` فيه القيم (`apiKey`, `authDomain`, `projectId`, ...) — انسخهم.
6. انسخ ملف `.env.example` وسمّي النسخة `.env` (في نفس المكان)، واملأ القيم اللي نسختها من Firebase جوه المتغيرات المناسبة.
7. من **Firestore Database > Rules**، انسخ محتوى ملف `firestore.rules` الموجود في المشروع وحطه هناك واعمل **Publish** — ده بيمنع أي حد غير صاحب الحساب إنه يشوف بياناته.

> ملف `.env` متجاهل من Git (موجود في `.gitignore`) عشان مفاتيحك متترفعش على GitHub بالغلط.

بعد الخطوات دي، أي حد يعمل حساب بايميله جوه التطبيق هيكون عنده بياناته الخاصة بيه بس، متزامنة من أي جهاز.

## التشغيل محليًا

```bash
npm install
npm run dev
```

ثم افتح الرابط اللي هيظهر في التيرمنال (عادة `http://localhost:5173`).

## البناء للنشر

```bash
npm run build
```

هينتج مجلد `dist` جاهز للرفع على أي استضافة (Vercel, Netlify, Firebase Hosting...).

## هيكل المشروع

```
pestco-app/
├── index.html
├── package.json
├── vite.config.js
├── capacitor.config.ts       # إعدادات تطبيق الأندرويد
├── tailwind.config.js
├── postcss.config.js
├── firestore.rules           # قواعد حماية بيانات Firestore
├── .env.example               # نموذج لمتغيرات Firebase (انسخه لـ .env واملأه)
├── .gitignore
├── .github/workflows/
│   └── build-apk.yml          # يبني الـ APK تلقائيًا عبر GitHub Actions
└── src/
    ├── main.jsx                # نقطة الدخول
    ├── index.css               # تنسيقات Tailwind
    ├── firebase.js              # يقرأ إعدادات Firebase من متغيرات البيئة
    ├── notifications.js         # تنبيهات محلية حقيقية (تشتغل والتطبيق مقفول)
    ├── AuthScreen.jsx           # شاشة تسجيل الدخول / إنشاء حساب / استرجاع كلمة السر
    └── App.jsx                  # التطبيق كامل (الشاشات + منطق البيانات)
```

## طريقة تخزين البيانات

كل زيارة عميل بتتخزن كـ document في:
```
users/{uid}/visits/{visitId}
```
حيث `{uid}` هو معرّف المستخدم اللي عمل تسجيل الدخول. التطبيق بيسمع لتغييرات Firestore لحظيًا (`onSnapshot`)، فأي تعديل بيظهر فورًا في كل الأجهزة المسجل دخول فيها بنفس الحساب.

## تحويل التطبيق لـ APK أندرويد (مع تنبيهات حقيقية)

الجزء ده بيستخدم [Capacitor](https://capacitorjs.com) عشان يلف تطبيق الويب في تطبيق أندرويد حقيقي، من غير إعادة كتابة أي كود. Firebase (تسجيل الدخول + قاعدة البيانات) هيفضل شغال بنفس الطريقة بالظبط جوه التطبيق، من غير أي إعداد إضافي.

فيه طريقتين لبناء الـ APK: **عن طريق GitHub** (من غير ما تثبت أي حاجة على جهازك) أو **محليًا** (لو معاك Android Studio).

### الطريقة الأولى: بناء الـ APK تلقائيًا عبر GitHub Actions (الأسهل)

المشروع فيه ملف جاهز `.github/workflows/build-apk.yml` بيخلي GitHub نفسه يبني الـ APK ليك على سيرفراته — من غير ما تحتاج Android Studio أو حتى جهاز قوي.

1. اعمل مستودع (repository) جديد على GitHub وارفعله المشروع:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/USERNAME/REPO.git
   git push -u origin main
   ```
2. جوه المستودع على GitHub: **Settings > Secrets and variables > Actions** → دوس **New repository secret** وضيف كل واحد من دول (بالقيم اللي أخدتها من Firebase Console):
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
3. روح تبويب **Actions** فوق في المستودع → هتلاقي workflow اسمه **Build Android APK** بدأ يشتغل تلقائي بعد الـ push (أو دوس **Run workflow** لو عايز تشغّله يدوي).
4. لما يخلص (بياخد كذا دقيقة)، افتح الـ run وانزل لقسم **Artifacts** تحت — هتلاقي `pestco-app-debug-apk` تقدر تنزّله كملف zip فيه الـ APK جواه.

**تلميحة**: لو عايز رابط تحميل مباشر تقدر تشاركه بسهولة (بدل ما تدخل Actions كل مرة)، اعمل tag وادفعه:
```bash
git tag v1.0.0
git push origin v1.0.0
```
ده هيخلي الـ workflow يعمل **GitHub Release** تلقائي ويرفق الـ APK فيه كملف تحميل مباشر من صفحة الـ Releases بتاعة المستودع.

### الطريقة الثانية: بناء محلي عبر Android Studio

### المتطلبات على جهازك (مرة واحدة)

1. [Node.js](https://nodejs.org) (نسخة 18 أو أحدث)
2. [Android Studio](https://developer.android.com/studio) — وبعد تثبيته افتحه مرة واحدة وسيبه ينزّل الـ Android SDK بتاعه (بيطلب منك تلقائي أول مرة)
3. Java JDK 17 (بييجي مع Android Studio عادةً، مفيش حاجة إضافية غالبًا)

### الخطوات

```bash
# 1) في مجلد المشروع، نزّل كل المكتبات (شامل Capacitor)
npm install

# 2) اظبط ملف .env بالقيم بتاعتك (لو لسه مظبطهوش، شوف قسم "إعداد Firebase" فوق)

# 3) اعمل بناء لملفات الويب
npm run build

# 4) أضف منصة أندرويد للمشروع (مرة واحدة بس)
npx cap add android

# 5) زامن ملفات الويب المبنية مع مشروع الأندرويد
npx cap sync android

# 6) افتح المشروع في Android Studio
npx cap open android
```

بعد ما Android Studio يفتح ويخلص "Gradle sync" (ممكن ياخد كذا دقيقة أول مرة):

- عشان تجرب التطبيق فورًا: وصّل موبايل أندرويد بالـ USB (وفعّل عليه "USB debugging") أو شغّل محاكي (Emulator) من جوه Android Studio، وبعدين دوس زرار **Run ▶**.
- عشان تطلع ملف APK تقدر تشاركه: من القايمة العلوية **Build > Build Bundle(s) / APK(s) > Build APK(s)**. لما يخلص هيظهرلك إشعار فيه لينك "locate" يوديك لمكان الملف (`android/app/build/outputs/apk/debug/app-debug.apk`).

> الـ APK ده "نسخة تجريبية (debug)" مناسبة للتجربة والمشاركة الداخلية. لو عايز تنشره على Google Play لاحقًا، محتاج تعمل "نسخة موقّعة (signed release)" — دي خطوة إضافية لما تيجي فعلاً تنشر، قولّي وقتها وأوريك خطواتها.

### كل ما تعدّل كود React

بعد أي تعديل في `src/`، لازم تكرر خطوتين (5) و(6) عشان التغيير يوصل لتطبيق الأندرويد:
```bash
npm run build
npx cap sync android
```
أو ببساطة: `npm run android:sync` (سكريبت مختصر مضاف في `package.json`).

## التنبيهات — إيه اللي بيشتغل فين

- **في تطبيق الأندرويد (APK)**: التطبيق بيجدول تنبيه حقيقي على مستوى النظام (`@capacitor/local-notifications`) وقت ما تحفظ موعد الاتصال — وده هيشتغل ويطلعلك إشعار حتى لو قفلت التطبيق تمامًا، لأنه نظام أندرويد نفسه اللي بيتابعه مش كود جافاسكريبت.
- **في نسخة المتصفح** (لو فتحت رابط التطبيق من كروم عادي مثلاً): برضو بيبعتلك صوت وإشعار متصفح، لكن ده لازم التاب يكون مفتوح فعليًا — قيود المتصفحات مش حاجة نقدر نتحكم فيها.

أول مرة تفتح التطبيق على الموبايل هيطلب منك إذن الإشعارات — لازم توافق عشان التنبيهات تشتغل (على أندرويد 13 فأعلى الإذن ده مطلوب صراحة).

