# تعديلات الأمان والاعتمادية

## قواعد Firestore (`src/firestore.rules`)
- `hasEmail()` بقت تشترط `email_verified == true` لكل الصلاحيات (أدمن/عضو/مالك).
- المالك لازم يكون أدمن؛ أي حساب تاني ما يقدرش يكتب في `users/{uid}/...` ولا `access/{uid}`.
- `access_by_email`: الكتابة للأدمن فقط.
- حذف `visits`/`suppliers` نهائيًا للمالك/الأدمن فقط (المحرر بيعمل soft delete).
- `last_change.updatedById` لازم يساوي `request.auth.uid` عند الإنشاء والتعديل.
- اختبارات emulator جديدة في `tests/rules/` + workflow `test-rules.yml`.

## التطبيق
- **التواريخ**: `todayLocalISO()` بدل `toISOString().slice(0, 10)` (كان بيسجّل اليوم اللي فات بين 12 و3 الفجر بتوقيت مصر) — الزيارات، العروض، أسماء ملفات التصدير وPDF.
- **تعديل العميل/المورد**: بيتكتب الحقول اللي اتغيّرت بس (مقارنة بالفورم وقت فتحه) بدل الدوكيومنت كله؛ تغيير موعد المكالمة بيعيد تفعيل التذكير (`notified: false`).
- **العروض**: تعديل الحالة والحذف بـ transaction بدل استبدال المصفوفة كلها / `arrayRemove` بالكائن.
- **الـ audit log**: إنشاء/تعديل/حذف (عملاء وموردين) واستيراد الإكسيل بيكتبوا سجل التتبع في نفس الـ batch مع التعديل نفسه.
- **الحذف**: لو التطبيق اتقفل أو راح للخلفية خلال مهلة الـ 5 ثواني، الحذف بيتنفّذ فورًا بدل ما يضيع.
- **استيراد الإكسيل**: تخطي الصفوف المكررة (نفس التليفون) وإعادة تشغيل استيراد فشل في النص آمنة. حجم الـ batch بقى 200 (كل صف = كتابتين).
- تسجيل الدخول بإيميل غير مؤكَّد بيعيد إرسال رابط التأكيد.
- PWA حقيقي: `manifest.webmanifest` + `sw.js` (network-first) + تسجيله في `registerServiceWorker.js`.
- Sentry بياخد رقم الإصدار من `__APP_VERSION__` بدل استيراد `package.json` كله في الـ bundle.
- شاشة الخطأ الأولي بتستخدم `textContent` بدل `innerHTML`.

## البناء والنشر
- الـ CI بيستخدم `npm ci`. الـ Release بقى بـ tag (`android-v*` / `win-v*`) أو بإدخال إصدار يدويًا، مش على كل push. إصدار ويندوز بيتاخد من الـ tag، وتم حذف الـ Release المكرر. `publish.releaseType = release`. دعم اختياري لتوقيع الكود.

---

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

## تثبيت سلامة حزمة xlsx (xlsx-integrity.json)
حزمة `xlsx` بتتنزل من رابط CDN مباشر (`cdn.sheetjs.com`) مش من npm registry — ده هو الأسلوب الرسمي من SheetJS نفسها، لكن معناه إن ملف `package-lock.json` العادي مبيحسبش لها hash تلقائي زي باقي الحزم، فمفيش حماية لو الملف على الرابط ده اتغيّر يوماً من غير ما رقم الإصدار يتغيّر.

الحل: `scripts/pin-xlsx-integrity.cjs` و`scripts/verify-xlsx-integrity.cjs`:
- `npm run xlsx:pin` — بيحسب sha256 لملفات الحزمة المثبتة فعليًا ويكتبها في `xlsx-integrity.json`. شغّلها مرة واحدة (وأنت متصل بالنت) وبعد كده اعمل commit للملف.
- التحقق بيحصل تلقائيًا بعد أي `npm install` (عن طريق `postinstall`)، وبالتالي في الـ CI (GitHub Actions) كمان من غير أي تعديل إضافي على الـ workflows. لو الملفات المثبتة مش مطابقة للمحفوظ، الـ install بيفشل بدل ما يكمل بصمت.
- لسه معملتش `npm run xlsx:pin`؟ الفحص هيطبع تحذير بس مش هيوقف حاجة — لحد ما تعمله مرة، مفيش أساس تتقارن بيه.
- لو غيّرت نسخة `xlsx` في `package.json`، لازم تشغّل `npm run xlsx:pin` تاني وتعمل commit للملف المحدّث.

**ملحوظة**: الملف ده اتجهز في بيئة مفيهاش اتصال بالإنترنت، فمقدرش أشغّل `npm install` فعليًا هنا ولا أطلع `xlsx-integrity.json` بنفسي. لازم إنت تشغّل `npm install && npm run xlsx:pin` مرة واحدة على جهازك وترفع الملف الناتج.

## استرجاع scripts/patch-android-storage.cjs الناقص
الملف ده كان متسجّل في `package.json` (`android:patch`, `android:sync`, `android:setup`) لكن مش موجود فعليًا في المشروع — بينما CI (`build-apk.yml`) كان شغال عادي لأنه كان بيعمل نفس الباتش يدويًا جوه ملف الـ workflow نفسه (نسخة تانية موازية من نفس المنطق).

اتعمل دلوقتي:
- استرجاع `scripts/patch-android-storage.cjs` بنفس منطق التعديل اللي كان جوه `build-apk.yml` حرفيًا (اتقارن سطر بسطر بعد تنفيذه فعليًا على مشروع Android وهمي — مطابق 100%)، مع تحسين واحد: الاسكريبت بقى idempotent (تقدر تشغّله أكتر من مرة على نفس المشروع من غير ما يكرر نفس الأسطر في الـ manifest).
- تعديل `build-apk.yml` عشان يستخدم `npm run android:patch` بدل ما يكرر نفس الكود — بقى فيه نسخة واحدة بس من المنطق ده (مصدر واحد للحقيقة) بدل نسختين ممكن يفترقوا مع الوقت.

لو فيه فرق بين اللي رجعته وأصل الملف القديم عندك (لو كان بيعمل حاجة زيادة مش موجودة في نسخة الـ CI)، يستاهل تتأكد بمقارنة `git log --all --full-history -- scripts/patch-android-storage.cjs` لو لسه متاح عندك.
