# التعديلات (البنود 1 و2 و3 و4 و7)

انسخ محتوى هذا المجلد فوق مجلد المشروع (نفس المسارات).

## 1) التراجع الناقص
- `src/lastChange.js` — الـ tags بقت جزء من الـ diff والتراجع، و`addedVisitEntryIds` بيتحفظ مع last_change.
- `src/hooks/useCustomerRecords.js` / `useSupplierRecords.js` — تعديل الـ tags بيتسجل في last_change والـ audit، وتعديل تاريخ الزيارة بيخزّن id الـ entry اللي اتضاف في visitHistory.
- `src/hooks/useLastChangeActions.js` — التراجع بيشيل الـ entry دي من visitHistory.
- عرض الـ tags: `PendingChangeBanner.jsx` و`AuditLog.jsx` + تسمية "الوسوم" في الترجمة.

## 2) فحص التزامن
- `src/hooks/useLastChangeActions.js` — الاعتماد والتراجع وتأكيد الحذف والاسترجاع بقوا داخل `runTransaction`، بتقارن last_change المخزّن بالمعروض للمالك، ولو اختلفوا مفيش حاجة بتتكتب وبتظهر رسالة.

## 3) نسخة JSON كاملة
- `src/backupJson.js` (جديد) + `src/hooks/useJsonBackup.js` (جديد) — كل مستندات العملاء والموردين خام (العروض، سجل النشاط، visitHistory، last_change، المحذوف) + سجل المراجعة.
- زر "نسخة احتياطية كاملة (JSON)" للمالك فقط في Settings (`ImportExportCard.jsx`).
- النسخة الأسبوعية (`useAutoBackup.js`) بقت بتحفظ الـ Excel + الـ JSON.

## 4) التحميل المعلّق
- `src/hooks/useAccessResolution.js` — مهلة 15 ثانية (`accessTimedOut`) + `retryAccess`.
- `src/hooks/useLiveData.js` — لقطة فاضية من الكاش (`fromCache`) مبقتش تتحسب "تم التحميل"، ومهلة 12 ثانية + `retryLiveData`.
- `CustomerList.jsx` بيعرض "تعذّر تحميل البيانات" مع زر إعادة المحاولة.

## 7) مسح الكاش المحلي
- `src/hooks/useAccessResolution.js` — الخروج الإجباري (مفيش صلاحية / اتسحبت) بيستخدم `signOutAndClearLocalData`.
- `src/signOutReason.js` (جديد) + `src/firebase.js` — سبب الخروج بيعدّي من الـ reload عشان رسالة "الإيميل غير مسجل" تفضل تظهر.
