# توقيع نسخة ويندوز (Code Signing)

## المشكلة

أي installer مش موقّع بيظهر لليوزر بتحذير **Windows SmartScreen** ("Windows protected your PC" / ناشر غير معروف).
ده مبيتصلحش بالكود: لازم الـ installer يتوقّع بشهادة من جهة معتمدة، والـ workflow جاهز لده
(`.github/workflows/build-windows.yml` ← خطوة **Configure code signing**). اللي ناقص هو **الحساب والشهادة نفسهم**،
وده بيحتاج هويتك أو هوية شركتك، فمقدرش حد يعمله بالنيابة عنك.

> التوقيع بيخلّي اسم الناشر يظهر بدل "غير معروف"، وبيخلّي التحديث التلقائي يتأكد إن التحديث جاي من نفس الناشر.
> لكن SmartScreen بيبني "سمعة" للملف مع عدد التحميلات، فمتوقع يفضل يظهر تحذير خفيف في الأول مع الشهادات
> العادية (OV) حتى لو الـ installer موقّع (electron-builder نفسه بيقول إن ده طبيعي). التوقيع بيقلّل المشكلة، مش بيضمن اختفاءها فورًا.

## الطريقة الموصى بيها: Azure Trusted Signing

شهادات توقيع الكود الجديدة (OV/EV) من 2023 بتتخزّن على أجهزة/USB tokens، فملف `.pfx` قابل للتحميل على CI بقى صعب
تلاقيه. خدمة Microsoft دي بتوقّع عن بُعد من غير ملف شهادة. (اسم الخدمة ممكن يظهر في بوابة Azure كـ
Trusted Signing أو Artifact Signing — اتبع الـ quickstart الرسمي من Microsoft، وراجع هناك شروط الأهلية والسعر
لأن دول بيتغيروا ومش مضمونين من عندي.)

1. **Azure**: اعمل Trusted Signing account، وخلّص التحقق من الهوية (Identity validation)، واعمل Certificate profile.
2. **App registration**: اعمل Service principal في Microsoft Entra ID، وادّيه صلاحية توقيع على الـ Certificate profile
   (دور من نوع *Certificate Profile Signer*)، واعمل له Client secret.
3. في GitHub: **Settings ← Secrets and variables ← Actions ← New repository secret**، وضيف السبعة دول:

| Secret | القيمة |
| --- | --- |
| `AZURE_TENANT_ID` | Directory (tenant) ID بتاع الـ app registration |
| `AZURE_CLIENT_ID` | Application (client) ID |
| `AZURE_CLIENT_SECRET` | الـ client secret |
| `AZURE_SIGN_ENDPOINT` | الـ endpoint بتاع منطقة الحساب، مثلًا `https://weu.codesigning.azure.net` (لازم يطابق المنطقة اللي اتعمل فيها الحساب) |
| `AZURE_SIGN_ACCOUNT` | اسم الـ Trusted Signing account |
| `AZURE_SIGN_PROFILE` | اسم الـ Certificate profile |
| `AZURE_SIGN_PUBLISHER` | اسم الناشر **بالظبط** زي ما هو في الشهادة |

لازم السبعة كلهم يبقوا موجودين؛ لو ناقص واحد الـ workflow بيتجاهل Azure ويكمّل بالمسار التالي.

## البديل: ملف `.pfx`

لو عندك شهادة بملف `.pfx`: حوّله base64 وحطه في `WIN_CSC_LINK`، وكلمة السر في `WIN_CSC_KEY_PASSWORD`
(نفس الإعداد اللي كان موجود قبل كده).

## التأكد إنه اشتغل

- الـ workflow بيطبع تحذير أصفر "Unsigned installer" لو مفيش أي أسرار.
- بعد البناء فيه خطوة **Verify installer signature** بتفشّل الـ job لو التوقيع اتظبط ومطلعش صالح.
  (في الإصدارات المنشورة electron-builder بيكون نشر الملف قبلها، فالخطوة دي إنذار، مش بوابة — راجعها قبل ما تعلن الإصدار.)
- يدويًا: كليك يمين على الـ installer ← Properties ← **Digital Signatures**.
