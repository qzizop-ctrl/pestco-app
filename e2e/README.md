# اختبارات end-to-end (Playwright)

بتشغّل **نسخة الـ production الحقيقية** من التطبيق في متصفح Chromium، مقابل **Firebase emulators محلية**
(Auth + Firestore بقواعد `src/firestore.rules` الحقيقية). مفيش أي اتصال بمشروع Firebase الفعلي.

## اللي بتغطيه

| الملف | بيتأكد من |
| --- | --- |
| `auth.spec.mjs` | شاشة الدخول، رفض الباسورد الغلط، تسجيل حساب جديد ← تأكيد الإيميل ← انتظار موافقة الأدمن (وإن الطلب وصل لقائمة الطلبات المعلّقة) |
| `customers.spec.mjs` | الأدمن بيضيف عميل وبيفضل موجود بعد إعادة التحميل ويسجّل خروج؛ المحرر (editor) بيضيف عميل بالقواعد الحقيقية والمالك بيشوفه |
| `exports.spec.mjs` | تصدير تقرير الداشبورد PDF وتصدير العملاء Excel (بيتأكد إن الملف اتنزّل فعلًا وإنه PDF/xlsx حقيقي) — دول أكتر مسارين بيتكسروا لو اتغيّر الـ bundler أو الـ CSP |
| `csp.spec.mjs` | الصفحة المبنية فيها CSP صارم، والمتصفح فعلًا بيمنع سكريبت inline محقون |

كل اختبار (ما عدا `csp.spec`) بيفشل لو المتصفح سجّل **أي مخالفة CSP** أثناءه — ده اللي بيثبت إن السياسة
في `scripts/buildCsp.mjs` مبتكسرش مسار حقيقي.

## التشغيل محليًا

محتاج Java (للـ Firestore emulator) وNode 22.12 أو أحدث. الأدوات دي مش في `package.json` عن قصد
(نفس منطق `tests/rules`)، وبتتثبت بنفس الإصدارات المستخدمة في `.github/workflows/e2e.yml`:

```bash
npm install --no-save --ignore-scripts @playwright/test@1.60.0 firebase-tools@13.35.1
npx playwright install chromium
npm run test:e2e
```

لو فشل اختبار: `npx playwright show-report` أو `npx playwright show-trace test-results/<اسم>/trace.zip`.

## ملاحظات

- الاختبارات بتمسح وتعيد تعبئة الـ emulators قبل كل اختبار، فبتشتغل واحد ورا التاني (`workers: 1`).
- المحددات مبنية على نوع الـ input وبنية الفورم و`data-testid` (على 5 أزرار)، مش على نصوص عربي/إنجليزي،
  عشان تفضل شغالة مهما اتبدلت اللغة.
- اللي مش مغطى هنا: نسخة Electron نفسها ونسخة أندرويد (دول محتاجين اختبار يدوي على الجهاز).
