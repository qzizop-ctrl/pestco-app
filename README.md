# تعديلات ربط الموردين بالعروض

## الملفات
- `src/constants.js` — معدّل: `buildOffer` بقى بياخد `supplierIds`/`supplierNames` (arrays)، وأضفنا نصوص جديدة (ar/en) لعناصر الواجهة.
- `src/App.jsx` — معدّل: `newOffer` بقى فيه `supplierIds`/`supplierNames`، فيه state جديد `supplierPickerOpen` ودالة `toggleOfferSupplier`، وبعت `suppliers` والـ props الجديدة لـ `CustomerDetailScreen`.
- `src/components/CustomerDetail.jsx` — معدّل: زرار "اختيار الموردين" بدل السلكت، وسطر ملخص مضغوط على كارت العرض ("موردين (2)")، والـ chips بتظهر بس لما الكارت يتفتح.
- `src/components/SupplierPickerSheet.jsx` — ملف جديد: الـ bottom sheet لاختيار أكتر من مورد، بنفس شكل `FilterSheet.jsx` الموجود عندك.

## طريقة التركيب
انسخ الملفات دي فوق نفس الأماكن بالظبط في مشروعك (استبدال) داخل مجلد `src/`، وبعدين:
```bash
npm run build
npx cap sync android   # لو بتحدّث نسخة الأندرويد
```

## ملحوظة
العروض القديمة اللي اتحفظت قبل التعديل ده مفيهاش `supplierIds`/`supplierNames` — التطبيق هيتعامل معاها عادي (الكود بيتحقق `offer.supplierNames && offer.supplierNames.length > 0` قبل ما يعرض أي حاجة خاصة بالموردين)، فمفيش داعي لأي migration يدوي.

## تحديث: بحث داخل شيت اختيار الموردين
لو عدد الموردين أكتر من 6، بيظهر تلقائي مربع بحث بالاسم فوق الليستة، والموردين اللي اخترتهم قبل كده بيفضلوا مثبّتين فوق حتى وانت بتدور على حد تاني.

## رفع قواعد Firestore (firestore.rules)
المصدر الوحيد لقواعد الأمان دلوقتي هو `src/firestore.rules` — ده اللي بيحدده `firebase.json` في جذر المشروع، ومفيش نسخة تانية موازية عشان محدش يعدّل بالغلط في نسخة قديمة وترفع فعليًا.

أول مرة بس على أي جهاز جديد:
```bash
npm install -g firebase-tools   # لو مش متثبتة
firebase login
firebase use --add              # اختار مشروع Firebase بتاعك من القايمة
```

وبعد كده، في أي وقت عدّلت في `src/firestore.rules`:
```bash
npm run firebase:deploy-rules
```
