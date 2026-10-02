# اختبارات قواعد أمان Firestore

اختبارات لملف `src/firestore.rules` بتشتغل على **Firestore Emulator** (مش على المشروع الحي).
كل اختبار بيوضّح *ليه* الطلب لازم ينجح أو يفشل، والاختبارات المكتوب عليها `regression`
بتثبّت ثغرات كانت موجودة قبل كده في القواعد.

> الملف ده كان نسخة قديمة من الـ README الرئيسي بالغلط — اتستبدل بشرح الاختبارات الفعلي.

## الملفات
| الملف | الوظيفة |
|---|---|
| `firestore.rules.test.mjs` | كل اختبارات القواعد (الإيميل المؤكَّد، الأدوار، دورة المراجعة `last_change`، `access_by_email`، الـ audit log، قائمة الأدمنز، عزل الأدمنز) |
| `../../vitest.rules.config.mjs` | إعداد Vitest مستقل (بيئة node، الملفات بالتتابع لأن في emulator واحد) |
| `../../firebase.json` | بيحدد ملف القواعد وبورت الـ emulator (8080) |

## التشغيل
محتاج **Java** (نفس نسخة الـ CI: 21) و Node 22. الأدوات دي مش في `package.json` عن قصد
(عشان بناء التطبيق ما يسحبهاش)، فبتتثبّت بدون حفظ:

```bash
npm ci
npm install --no-save @firebase/rules-unit-testing@5.0.1 firebase-tools@13.35.1   # مرة واحدة
npm run test:rules
```

`npm run test:rules` بيشغّل الـ emulator ويجري الاختبارات وبعدين يقفله.
مش جزء من `npm test` العادي.

## في الـ CI
`.github/workflows/test-rules.yml` بيشغّلها تلقائيًا عند أي تغيير في `src/firestore.rules` أو
`tests/rules/**` أو `firebase.json`، وكمان من تبويب Actions (Run workflow).

## لما تعدّل القواعد
1. عدّل `src/firestore.rules` (هي المصدر الوحيد، ومفيش نسخة موازية).
2. ضيف اختبار يوضّح السلوك الجديد، واكتب فيه سبب الرفض/القبول.
3. شغّل `npm run test:rules`.
4. انشرها فعليًا: `npm run firebase:deploy-rules` — وجودها في الكود لا يعني إنها مطبّقة على المشروع الحي.

## ملاحظة عن تسجيل تعديلات العروض في الـ audit
كتابة سجل الـ audit لتعديلات العروض (إضافة / تغيير حالة / حذف) بتستخدم `entityType: "customer"`
و`action: "update"` مع حقل `changes.offers` — يعني **من غير أي تعديل في القواعد** ومن غير إعادة نشرها.
