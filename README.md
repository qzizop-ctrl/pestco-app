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

## إيقاف النسخ القديمة عن الشغل (Force Update)
أي جهاز فاتح التطبيق بيقارن رقم النسخة بتاعته (`package.json` وقت الـ build، عن طريق `vite.config.js`) بمستند `config/appVersion` في Firestore. لو نسختك أقدم من `minVersion` المكتوبة هناك، التطبيق بيوقف بشاشة "محتاج تحديث" قبل حتى شاشة تسجيل الدخول — حتى لو المستخدم داخل بجلسة قديمة مفتوحة من زمان.

**الاستخدام:**
1. افتح Firebase Console → Firestore → أنشئ (أو عدّل) مستند بالمسار `config/appVersion` يدويًا. الحقول:
   - `minVersion` (string, إجباري) — مثلاً `"1.2.0"`. أي نسخة أقل منها تتوقف فورًا.
   - `updateUrl` (string, اختياري) — اللينك العام/الافتراضي (بيستخدم لو مفيش لينك مخصص للمنصة، وهو أصلاً كل اللي محتاجه بناء الويب).
   - `updateUrlAndroid` (string, اختياري) — لينك مخصص لأندرويد (رابط الـ APK). لو مش موجود، بيرجع لـ `updateUrl`.
   - `updateUrlWindows` (string, اختياري) — لينك مخصص لويندوز (رابط الـ .exe). لو مش موجود، بيرجع لـ `updateUrl`.
   التطبيق بيعرف لوحده هو شغال على أندرويد ولا ويندوز ولا ويب، وبيختار اللينك المناسب تلقائيًا — مفيش حاجة تتغيّر في الكود لو عندك القيمتين المخصصتين ولا لو عندك بس `updateUrl` العام.
2. لما تعمل نسخة جديدة، زوّد رقم `"version"` في `package.json` الأول، وبعدين ابني (`npm run build` / `android:sync` / `electron:build`) — نفس الرقم بيتحط في نسخة الويب والأندرويد والإلكترون مع بعض.
3. المستند ده **مينفعش يتعدل من التطبيق نفسه** (`firestore.rules` بترفض أي write عليه من أي حساب، حتى الأدمن) — لازم دايمًا من الـ Firebase Console أو Admin SDK. ده مقصود: التطبيق مفيهوش مفهوم "سوبر أدمن" على كل الشركات مع بعض، فمفيش دور آمن يتاح له الصلاحية دي من جوه التطبيق.
4. لو المستند مش موجود أصلاً، أو مفيهوش `minVersion`، مفيش حجب بيحصل — الميزة دي اختيارية لحد ما تفعّلها بنفسك.

## استضافة الـ APK على رابط ثابت (Firebase Hosting)
عشان `updateUrl` في القسم اللي فات يفضل لينك واحد ثابت (متغيرش كل نسخة)، فيه موقع Firebase Hosting صغير منفصل تمامًا عن التطبيق نفسه — كل شغله إنه يقدّم ملف الـ APK من مسار ثابت: `hosting-download/pest-latest.apk` (المجلد ده معرّف في `firebase.json` تحت `hosting`). الملف نفسه **مش متحط في git** (`.gitignore`) — بيتحط في مكانه وقت الـ deploy بس.

**أول مرة (إعداد لمرة واحدة):**
1. من نفس مشروع Firebase بتاعك، Firebase Hosting بيتفعّل تلقائيًا مع أول `firebase deploy --only hosting` — مفيش خطوة يدوية منفصلة لازم تعملها في الـ Console.
2. حط `updateUrl` في مستند `config/appVersion` (القسم اللي فات) على:
   `https://<project-id>.web.app/pest-latest.apk`
   (استبدل `<project-id>` برقم مشروعك الفعلي من Firebase Console).

**النشر يدويًا من جهازك:**
```bash
npm run android:sync          # لو محتاج تبني APK جديد
npm run apk:publish           # ينسخ الـ APK لمكانه وينشره على Hosting
```
(أو الخطوتين لوحدهم: `npm run apk:stage` بعدين `npm run firebase:deploy-hosting`)

**النشر تلقائيًا من CI:**
`.github/workflows/build-apk.yml` بقى بينشر الـ APK على Hosting تلقائيًا مع كل build على branch `main`، بالإضافة لعمله GitHub Release زي ما كان بيعمل من قبل. محتاج تضيف سيكريتين في إعدادات الريبو (Settings → Secrets and variables → Actions):
- `FIREBASE_SERVICE_ACCOUNT` — مفتاح Service Account بصيغة JSON (Firebase Console → Project settings → Service accounts → Generate new private key)، حطه كله زي ما هو.
- `FIREBASE_PROJECT_ID` — رقم مشروع الـ Firebase.

**ملحوظة مهمة:** نشر APK جديد على Hosting لوحده **مش بيوقف حد** — لازم بعدها تحدّث `config/appVersion.minVersion` يدويًا في الـ Console (القسم اللي فات) عشان النسخ الأقدم تتوقف فعليًا. الاتنين خطوتين منفصلتين عمدًا.

## إصلاح التحديث التلقائي على ويندوز (electron-updater)
نسخة ويندوز فيها آلية تحديث تلقائي جاهزة في `electron.js` (بتفحص GitHub Releases وتحمّل وتسأل المستخدم يعيد التشغيل)، بس كانت مش شغالة فعليًا: `.github/workflows/build-windows.yml` كان بيبني الـ.exe بـ `--publish never`، يعني ملف `latest.yml` (اللي `electron-updater` بيقرأه عشان يعرف لو فيه تحديث) مكانش بيتنشر أصلاً — أي نسخة مركّبة كانت بتفحص وتفشل بصمت (خطأ في الـ console بس، مفيش حاجة تظهر للمستخدم).

اتصلح بتغيير بسيط: `--publish always` + `GH_TOKEN` (نفس التوكن الافتراضي بتاع الـ Actions، مفيش سيكريت جديد لازم تضيفه). دلوقتي `electron-builder` بينشر Release لوحده (تاج `v<رقم النسخة من package.json>`) ومعاه `latest.yml` صح.

**ملحوظة:** خطوة `Create GitHub Release with Windows App` (اللي كانت موجودة من قبل) لسه شغالة زي ما هي — بتعمل Release تاني منفصل بتاج مختلف (`win-v1.0.<رقم الـ run>`). ده تكرار غير ضار (مفيش تعارض)، بس ممكن تفكر تشيله لاحقًا بما إن Release بتاع electron-builder بقى بيغطي نفس الغرض.

**والنتيجة:** بعد أول نسخة تتبني بالإعداد الجديد، مستخدمي ويندوز هيتحدثوا لوحدهم تلقائيًا — شاشة "محتاج تحديث" (`config/appVersion`) هتفضل موجودة كخط دفاع أخير بس لجهاز فوّت التحديث التلقائي لسبب ما (قافل شهور مثلاً).

## استرجاع scripts/patch-android-storage.cjs الناقص
الملف ده كان متسجّل في `package.json` (`android:patch`, `android:sync`, `android:setup`) لكن مش موجود فعليًا في المشروع — بينما CI (`build-apk.yml`) كان شغال عادي لأنه كان بيعمل نفس الباتش يدويًا جوه ملف الـ workflow نفسه (نسخة تانية موازية من نفس المنطق).

اتعمل دلوقتي:
- استرجاع `scripts/patch-android-storage.cjs` بنفس منطق التعديل اللي كان جوه `build-apk.yml` حرفيًا (اتقارن سطر بسطر بعد تنفيذه فعليًا على مشروع Android وهمي — مطابق 100%)، مع تحسين واحد: الاسكريبت بقى idempotent (تقدر تشغّله أكتر من مرة على نفس المشروع من غير ما يكرر نفس الأسطر في الـ manifest).
- تعديل `build-apk.yml` عشان يستخدم `npm run android:patch` بدل ما يكرر نفس الكود — بقى فيه نسخة واحدة بس من المنطق ده (مصدر واحد للحقيقة) بدل نسختين ممكن يفترقوا مع الوقت.

لو فيه فرق بين اللي رجعته وأصل الملف القديم عندك (لو كان بيعمل حاجة زيادة مش موجودة في نسخة الـ CI)، يستاهل تتأكد بمقارنة `git log --all --full-history -- scripts/patch-android-storage.cjs` لو لسه متاح عندك.
