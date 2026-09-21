# PEST — تطبيق متابعة زيارات العملاء

تطبيق لإدارة عملاء ومندوبي شركة مكافحة حشرات: تسجيل الزيارات، متابعة مراحل العميل (معاينة → عرض سعر → تركيب → صيانة)، تسجيل العروض وربطها بالموردين، وإدارة الموردين أنفسهم — مبني بـ React + Firebase، وشغّال كويب (PWA)، وأندرويد (Capacitor)، وويندوز (Electron) من نفس الكود.

## المحتويات
- [التقنيات المستخدمة](#التقنيات-المستخدمة)
- [البنية العامة للمشروع](#البنية-العامة-للمشروع)
- [التشغيل محليًا](#التشغيل-محليًا)
- [الأوامر المتاحة](#الأوامر-المتاحة-npm-run)
- [قواعد أمان Firestore](#قواعد-أمان-firestore)
- [حزمة xlsx وتثبيت سلامتها](#حزمة-xlsx-وتثبيت-سلامتها)
- [البناء والنشر](#البناء-والنشر)
- [الاختبارات](#الاختبارات)
- [سجل التعديلات](#سجل-التعديلات)
- [المساهمة](#المساهمة)
- [الترخيص](#الترخيص)

## التقنيات المستخدمة
- **الواجهة**: React 18 + Vite + Tailwind CSS
- **الباك إند**: Firebase (Auth + Firestore)
- **تعدد المنصات**: Capacitor (أندرويد)، Electron (ويندوز)، PWA (ويب)
- **تقارير/ملفات**: jsPDF وhtml2canvas (تصدير PDF)، xlsx (استيراد/تصدير إكسيل)
- **مراقبة الأعطال**: Sentry (اختياري)
- **الاختبارات**: Vitest

## البنية العامة للمشروع
```
src/
  App.jsx              نقطة التجميع الرئيسية — يستدعي الـ hooks ويوجّه الشاشات
  Dashboard.jsx         شاشة لوحة التحكم (رسوم بيانية، تحمّل lazy)
  AuthScreen.jsx        شاشة الدخول
  domain.js             الثوابت الأساسية (المراحل، القطاعات، حدود الاستيراد...)
  helpers.js             دوال منطقية (تنسيق تواريخ/فلوس، كشف تكرار العملاء...)
  firestore.rules        قواعد أمان قاعدة البيانات (المصدر الوحيد لها)
  hooks/                 كل منطق التطبيق (workspace، عملاء، موردين، عروض...) كـ hooks منفصلة
  components/            مكونات الواجهة (شاشات، قوائم، bottom sheets...)
  i18n/                  نصوص الواجهة بالعربي والإنجليزي
scripts/                 سكربتات مساعدة (تثبيت سلامة xlsx، باتش أندرويد)
```

## التشغيل محليًا
1. `npm install`
2. انسخ `.env.example` إلى `.env` واملأ بيانات مشروع Firebase الخاص بيك (من Firebase Console → Project Settings → SDK setup). حقل `VITE_SENTRY_DSN` اختياري.
3. `npm run dev`

## الأوامر المتاحة (`npm run ...`)
| الأمر | الوظيفة |
|---|---|
| `dev` | تشغيل السيرفر المحلي للتطوير |
| `build` | بناء نسخة الإنتاج (ويب) |
| `test` / `test:watch` | تشغيل الاختبارات |
| `test:coverage` | تشغيل الاختبارات + تقرير تغطية (`coverage/index.html`) |
| `lint` / `lint:fix` | فحص/إصلاح الكود بـ ESLint |
| `format` / `format:check` | تنسيق الكود بـ Prettier |
| `android:setup` | بناء + إضافة مشروع أندرويد + تشغيل الباتش + مزامنة Capacitor |
| `electron:build` | بناء نسخة ويندوز (.exe) |
| `firebase:deploy-rules` | نشر `firestore.rules` فعليًا على مشروع Firebase |
| `xlsx:pin` / `xlsx:verify` | تثبيت/التحقق من سلامة حزمة xlsx (انظر تحت) |

## قواعد أمان Firestore
المصدر الوحيد لقواعد الأمان هو `src/firestore.rules` (محدَّد في `firebase.json`) — لا توجد نسخة موازية له، تجنبًا لتعديل نسخة قديمة بالغلط وهي فعليًا مش المنشورة.

إعداد أول مرة على أي جهاز جديد:
```bash
npm install -g firebase-tools
firebase login
firebase use --add
```
وبعد أي تعديل في `src/firestore.rules`:
```bash
npm run firebase:deploy-rules
```
**تنبيه:** وجود القواعد في الكود لا يعني أنها مطبَّقة فعليًا على المشروع الحي — لازم تُنشر بالأمر أعلاه بعد كل تعديل.

## حزمة xlsx وتثبيت سلامتها
حزمة `xlsx` بتتنزّل من رابط CDN مباشر (`cdn.sheetjs.com`) بدل npm registry — الأسلوب الرسمي من SheetJS، لكنه يعني أن `package-lock.json` لا يحسب لها hash تلقائيًا كباقي الحزم.

- `npm run xlsx:pin` يحسب SHA-256 للملفات المثبَّتة فعليًا ويكتبها في `xlsx-integrity.json` (شغّلها مرة وأنت متصل بالإنترنت، ثم اعمل commit للملف).
- التحقق يحصل تلقائيًا بعد أي `npm install` (عبر `postinstall`)، وبالتالي في الـ CI كمان. لو الملفات المثبتة لا تطابق المحفوظ، يفشل الـ install بدلًا من الاستمرار بصمت.
- لو غيّرت نسخة `xlsx` في `package.json`، شغّل `npm run xlsx:pin` من جديد واعمل commit للملف المحدَّث.

## البناء والنشر
- **ويب**: `npm run build` → مجلد `dist/`
- **أندرويد**: `npm run android:setup` ثم `npm run android:open` لفتح المشروع في Android Studio. البناء التلقائي (APK) عبر GitHub Actions في `.github/workflows/build-apk.yml`.
- **ويندوز**: `npm run electron:build` → مجلد `release/`. البناء التلقائي عبر `.github/workflows/build-windows.yml`.

## الاختبارات
```bash
npm test              # تشغيل مرة واحدة
npm run test:watch
npm run test:coverage # + تقرير تغطية في coverage/index.html
```
الاختبارات الحالية تغطي: صلاحيات الأدمن (`adminPermissions.test.js`)، حسابات لوحة التحكم (`dashboardCalculations.test.js`)، استيراد الإكسيل (`helpers.excelImport.test.js`)، دوال `helpers.js` الأخرى (`helpers.test.js`)، والتراجع عن آخر تعديل (`lastChange.test.js`) — كل دول pure functions.

بالإضافة لأول اختبارات hook/component في المشروع: فلترة القوائم واكتشاف
التكرارات (`hooks/useFilteredData.test.js`، عبر `renderHook`) ومكوّن كارت
الملخص في الداشبورد (`components/SummaryCard.test.jsx`، عبر `render`/
`screen`) — الاثنين بيستخدموا `@testing-library/react`، وبيئة التشغيل
`jsdom` (مُعدّة في `vite.config.js`). راجع [`CONTRIBUTING.md`](./CONTRIBUTING.md#إضافة-اختبارات)
لو حابب تضيف اختبار مشابه.

## سجل التعديلات
تفاصيل التعديلات السابقة (ربط الموردين بالعروض، استرجاع سكربت باتش الأندرويد، إلخ) منقولة إلى [`CHANGELOG.md`](./CHANGELOG.md).

## المساهمة
راجع [`CONTRIBUTING.md`](./CONTRIBUTING.md) لسير العمل المتبع (الفروع، الـ lint/format/test قبل الـ commit، إضافة اختبارات).

## الترخيص
هذا التطبيق داخلي وخاص بشركة PEST — راجع [`LICENSE`](./LICENSE).
