# تحديث المكتبات الأمنية (Electron / electron-builder / jsPDF) + سياسة Dependabot

- `electron` من 31 إلى 44 (31 خرجت من الدعم الأمني؛ الدعم بيغطي آخر 3 إصدارات بس). `electron.js` ما احتاجش تعديل.
  - **تنبيه:** من Electron 44 اتشالت نسخ 32-بت (ia32) على ويندوز، ويحتاج ويندوز 10 أو أحدث. نسخة الـ installer كانت أصلًا بتتبني 64-بت على `windows-latest`.
- `electron-builder` من 24 إلى 26، بدون أي تغيير في إعدادات `build` في `package.json`.
- `jspdf` من 2.5.2 إلى 4.2.1 أو أحدث (ثغرات اتصلحت في 4.0 و4.1 و4.2 و4.2.1). الدوال اللي التطبيق بيستخدمها (`addImage` / `addPage` / `setPage` / `output` / `save`) ما اتغيّرتش في `pdfReport.js`.
- `.github/dependabot.yml`: السياسة القديمة كانت بتمنع أي تحديث غير الـ patch فالتحديثات الأمنية الكبيرة عمرها ما كانت هتيجي. دلوقتي الـ minor/patch في PR أسبوعي واحد، وكل major في PR لوحده، وElectron وأدواته في مجموعة مستقلة. `lucide-react` فقط فضل مقفول على minor/major لأنه 0.x وكسر البناء قبل كده.
- **لازم بعد الاستلام:** `package-lock.json` لسه بيشاور على الإصدارات القديمة، فـ `npm ci` هيفشل لحد ما تشغّل `npm install` محليًا وتعمل commit للـ lock (أو workflow «Sync package-lock.json»)، وبعدين `npm run lint && npm test && npm run electron:build` وجرّب تصدير PDF يدويًا.
- **لسه مأجّل عمدًا:** Capacitor 6 ← 8 (محتاج ترحيل أندرويد الأصلي بـ `npx cap migrate`) وVite 5 ← أحدث (محتاج رفع Vitest معاه).

---

# تدقيق العروض + إصدار أندرويد + تنظيف

## العروض في الـ audit log
- إضافة عرض / تغيير حالته / حذفه بقى بيتسجّل في `auditLog` (الإضافة في نفس الـ batch، والتغيير والحذف في نفس الـ transaction) بالقيمة قبل وبعد: الاسم والرقم والمبلغ والعملة والحالة وسبب الرفض (`describeOfferForAudit`). بيظهر في شاشة الـ audit تحت حقل «العروض».
- من غير أي تعديل في `firestore.rules` (بنستخدم `entityType: "customer"` و`action: "update"`)، فمفيش حاجة تتنشر.
- **حد معروف:** التسجيل من الكلاينت، والقواعد لسه مش بتجبره. محرر بيكلّم الـ SDK مباشرة يقدر يعدّل العروض من غير سجل. الإلزام الحقيقي محتاج Cloud Function (trigger على `visits`)، وده مش متعمل. ومفيش موافقة من المالك على تغيير العروض (بس تتبّع).
- اختبارات: `useOfferActions.test.js` (الـ audit في نفس الـ batch/transaction، وعدم تسجيله لو العرض اتشال قبل كده) و`describeOfferForAudit`.

## أندرويد: الإصدار والتوقيع
- `versionCode`/`versionName` بقوا بييجوا من الـ tag عبر `ANDROID_VERSION_CODE`/`ANDROID_VERSION_NAME` (كانوا ثابتين `1` / `"1.0"`). كمان `package.json` بيتختم بالإصدار قبل بناء الويب (علشان Sentry).
- النشر من غير keystore بيفشل بدري برسالة واضحة بدل ما يطلّع ملف مش قابل للتثبيت.
- خطوة «Locate APK»: بتلاقي الـ APK مهما كان اسمه (`app-release.apk` أو `app-release-unsigned.apk`) وتفشل لو ماطلعش، ورفع الـ artifact والـ Release بقوا `if-no-files-found: error` / `fail_on_unmatched_files` (قبل كده كانوا بيعدّوا خضر من غير ملف).

## تنظيف
- `MainActivity`: كاش الـ WebView بيتمسح **بس بعد تحديث التطبيق** (بدل كل تشغيل) ومن غير `LOAD_NO_CACHE`، فالخط والموارد الخارجية بتتخزّن عادي.
- `file_paths.xml`: اتشال `external-path` (كان بيعرّض التخزين الخارجي كله ومحدش بيستخدمه)؛ فاضل مسار الكاش اللي بتتشارك منه الملفات.
- تعليقات قديمة اتصلّحت (واتساب بلجن مكتوب إنه بيتولّد من الـ workflow، إشارات PWA المحذوفة، رسالة «Bootstrap» في الـ workflow).
- `tests/rules/README.md` كان نسخة قديمة من الـ README الرئيسي؛ اتكتب من جديد بشرح اختبارات القواعد.

---

# أداء: تقليل تكلفة إعادة الحساب مع كل snapshot

- قياس أولًا: على 5000 عميل تجريبي إعادة حساب القوايم المشتقة كانت ~130ms (Node)، أكبرها الفرز (~60ms) ثم العملاء الراكدين وكشف الـ duplicates.
- `visitSort.js` (جديد): فرز القايمة بمفاتيح بتتحسب مرة لكل سجل بدل تحليل التواريخ لكل مقارنة. نفس الترتيب بالظبط (مثبّت باختبار مقارنة مع المقارن القديم على بيانات عشوائية).
- `customerDuplicates.js`: كاش لكل سجل (WeakMap) لتاريخ آخر نشاط ولمفاتيح الـ duplicates؛ السجل المتغيّر object جديد فمفيش كاش قديم.
- إصلاح جانبي: اسم شركة زي `constructor` أو `__proto__` كان ممكن يكسر كشف الـ duplicates.
- اختبارات جديدة: `visitSort.test.js`, `customerDuplicates.cache.test.js`.
- مش متغيّر: التطبيق لسه بيقرا كل العملاء والموردين من Firestore.

---

# عزل الأدمنز عن workspaces بعض + اختبارات الصلاحيات

- `firestore.rules`: `canRead` / `canWrite` / `canClearLastChange` مبقوش بيشملوا `isReviewer()`. الأدمن بيقرا ويكتب في workspace هو مالكها أو اتمنحله فيها دور بس، والموافقة والحذف النهائي للمالك فقط. `access/{ownerUid}` و`auditLog` (قراءة) بقوا للمالك بس.
- الكلاينت اتوافق مع القواعد: شاشة الـ audit log ورابطها للمالك فقط.
- اختبارات قواعد جديدة (`admins are isolated...`) واختبارات وحدة جديدة لـ `useAccessResolution` و`useWorkspace`.
- README: اتصلّح سطر `config/admins` (كان قديم، القواعد أصلًا بتمنع القراءة لغير الأدمن).

---

# تنضيف: أندرويد وويندوز فقط

- مجلد `android/` بقى مرفوع في الريبو (اتولّد مرة واحدة)، واتمسح `scripts/patch-android-storage.cjs` وأوامر `android:add/patch/setup` و`bootstrap-android.yml`. `build-apk.yml` بيبني من المجلد المرفوع.
- اتشال الويب/PWA: `public/sw.js` و`manifest.webmanifest` و`registerServiceWorker.js` وروابطهم في `index.html`. `vite build` فاضل لأنه بيغذّي أندرويد وويندوز.
- Firestore cache: `persistentSingleTabManager` لكل المنصات (مفيش تبويبات متعددة).
- اختبارات جديدة لـ `useAccessManagement` (منح/سحب الصلاحيات، تبديل الداشبورد، مراجعة التسجيلات، إدارة الأدمن): 30 اختبار بتتأكد إن الـ hook بيرفض غير المالك/المراجع وإن تعديل عضو ما بيمسحش إعدادات غيره.

---

# مراجعة الأمان ودورة الموافقة

## قواعد Firestore (`src/firestore.rules`)
- دورة المراجعة (`last_change`) بقت مفروضة من القواعد مش من الواجهة بس: المحرر يقدر يعمل "إجراءات سريعة" (تثبيت، مرحلة، تذكير، نشاط، عروض) أو تعديل بمراجعة (بيرفع `last_change` باسمه)، ومينفعش يعدّل `companyName`/`notes`/`deleted`... من غير `last_change`.
- إنشاء عميل/مورد من محرر لازم يكون معاه `last_change`، وبمفاتيح معروفة فقط (مفيش حقول غريبة ولا `createdAt` مزوّر).
- `auditLog`: مفاتيح محددة فقط (`hasOnly`) و`entityId` نص بحد أقصى 128.
- الأدمن/المالك مش مقيّدين (استيراد، إعادة تسمية تاج، تراجع).

## المراجعة والتراجع
- `computeRollbackFields` بقت بتكتب حقول معروفة بس (`ROLLBACKABLE_FIELDS`) — `last_change` مزوّر مايقدرش يكتب `createdAt`/`offers`/`deleted`.
- التراجع مبقاش بيكتب كلمة «فارغ» جوه الحقل (كانت نص عرض بيتخزّن في `old_value`).
- `mergeLastChange`: لو محرران عدّلوا نفس السجل قبل موافقة المالك، التغييران بيتدمجوا (أقدم `old_value` + أحدث `new_value`) بدل ما التاني يمسح الأول.

## التطبيق
- فتح واتساب مبقاش بيغيّر صفحة التطبيق نفسه (`window.location.href`) — بيتفتح برّه (Electron: المتصفح الافتراضي).
- تسجيل الخروج اليدوي بيمسح كاش IndexedDB بتاع بيانات العملاء ويعمل reload (`signOutAndClearLocalData`).
- Electron: `sandbox: true`، ومنع التنقل بره التطبيق، وفتح `https:`/`mailto:`/`tel:` بس عبر `shell.openExternal`.
- أندرويد: `allowBackup="false"` وقواعد R8 لحماية الـ plugins المخصصة في نسخة release.
- رسالة خطأ الـ API key بقت بتشاور على `.env` بدل `src/firebase.js`.

---

# التذكيرات والإكسيل والاختبارات

## التذكيرات
- **viewer:** التذكير اللي حان ميعاده كان بيرن ويطلّع إشعار كل 15 ثانية بلا نهاية (لأن `notified` مبيتكتبش غير من محرر). دلوقتي كل جهاز بيفتكر اللي نبّه عليه (`reminderLogic.js`).
- التذكيرات القديمة (فاتت بأكتر من 30 دقيقة) بتتجمّع في إشعار واحد بدل إشعار وصوت لكل واحد؛ صوت واحد لكل دفعة.
- عملاء اتحذفوا مبدئيًا مبقوش يطلّعوا تذكيرات.
- **أندرويد:** الإشعارات المحلية بقت بتتزامن من قايمة العملاء الحية (`syncCallReminders`) بدل ما تتجدول على الجهاز اللي سجّل العميل بس؛ اللي اتمسح/اتنفّذ/اتغيّر ميعاده بيتلغي أو يتجدول من جديد بنفس الـ id.

## الإكسيل
- التصدير مبقاش بيحط `'` قدام النص اللي بيبدأ بـ `+ - = @`: أرقام `+20…` كانت بتطلع `'+20…` في ملف xlsx (الـ apostrophe بيتخزّن كنص ويظهر)، والحماية دي أصلًا مطلوبة في CSV مش xlsx. الحماية الفعلية دلوقتي (`excelSafety.js`): كل خلية نص بتتثبّت كنص عادي بدون formula.
- الاستيراد بيشيل الـ `'` اللي كانت بتضيفه النسخ القديمة، فملفات اتصدّرت قبل كده بتتحمّل نضيفة.

## العروض
- عرض جديد اتسجّل مباشرةً بحالة «مرفوض» كان بيضيّع سبب الرفض (`buildOffer` كان بيتجاهل الحقول دي)، فبيقع برّه تقرير أسباب الرفض. اتصلّح.

## الأداء
- `useLiveData` بيعيد استخدام نفس الـ object للمستندات اللي ما اتغيّرتش (`snapshotCache.js`) بدل إعادة بناء كل العملاء مع كل تغيير.
- تحذير المجموعة الكبيرة (≥ 2000) بقى مرة في الجلسة وبيتبعت لـ Sentry.

## أخرى
- `clearCallReminder` بقى بيرفض الكتابة لو `canEdit` false (زي باقي كتابات الملف).
- الـ workflows كلها بقت `npm ci` (الـ lock متزامن فعلًا)، وتصحيح توثيق README اللي كان لسه بيقول العكس.
- اختبارات جديدة: `useCustomerRecords`، `useOfferActions`، `useReminders`، `notifications`، `excelSafety`، `reminderLogic`، `snapshotCache`، `helpers.buildOffer`.

---

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
- الـ Release بقى بـ tag (`android-v*` / `win-v*`) أو بإدخال إصدار يدويًا، مش على كل push. إصدار ويندوز بيتاخد من الـ tag، وتم حذف الـ Release المكرر. `publish.releaseType = release`. دعم اختياري لتوقيع الكود.

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
