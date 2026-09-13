// ============================================================================
// Shared constants, i18n strings, and pure helper functions.
// Extracted so App.jsx and Dashboard.jsx can both use the same source of
// truth for colors, labels, and data-shape helpers without duplicating them.
// ============================================================================

export const PRIMARY = "#0F2E5E";
export const PRIMARY_MID = "#2A5FA8";
export const BG = "var(--bg)";
export const SURFACE = "var(--surface)";
export const SURFACE_SUBTLE = "var(--surface-subtle)";
export const CARD_BG = "var(--surface)";
export const TEXT = "var(--text)";
export const MUTED = "var(--muted)";
export const DANGER = "#B3401F";
export const GOLD = "#C08A3E";
export const GOLD_SOFT = "#F3E6D0";
export const LINE = "var(--line)";

export const THEME_VARS = {
  light: { "--bg": "#E4E0D5", "--surface": "#FFFFFF", "--surface-subtle": "#F8F6F0", "--text": "#1B241F", "--muted": "#6B7168", "--line": "#E7E2D6" },
  dark: { "--bg": "#0F1720", "--surface": "#182430", "--surface-subtle": "#1F2E3B", "--text": "#ECEAE2", "--muted": "#93A0AC", "--line": "#2C3B48" },
};

export const STALE_OFFER_DAYS = 30;
export const STALE_ACTIVITY_DAYS = 90;

export const STATUS_COLORS = {
  overdue: "#C4443A",
  today: "#DB9A2C",
  upcoming: "#2E6B8F",
  none: "#9AA39B",
};

export const STRINGS = {
  ar: {
    dir: "rtl",
    locale: "ar-EG",
    appTitle: "Pest.Co — CRM",
    titleEdit: "تعديل العميل",
    titleNew: "عميل جديد",
    titleDetail: "تفاصيل العميل",
    titleDashboard: "Dashboard",
    back: "رجوع",
    langToggle: "English",
    dueCalls: (n) => `عندك ${n} متابعة مستحقة`,
    searchPlaceholder: "ابحث بالشركة أو المسؤول أو الرقم أو الملاحظات أو التاريخ",
    loading: "جارِ التحميل...",
    noVisits: "لا توجد زيارات بعد",
    noVisitsHint: 'اضغط على "عميل جديد" لإضافة أول عميل',
    newVisit: "عميل جديد",
    noCompanyName: "بدون اسم شركة",
    noContactName: "بدون اسم",
    companyLabel: "اسم الشركة *",
    companyPlaceholder: "مثال: شركة النور للصناعات",
    companyError: "اكتب اسم الشركة",
    contactLabel: "اسم الشخص المسؤول *",
    contactPlaceholder: "مثال: أحمد محمد",
    contactError: "اكتب اسم الشخص المسؤول",
    roleLabel: "الجهة / المسمى الوظيفي",
    phoneLabel: "رقم الهاتف",
    phonePlaceholder: "01xxxxxxxxx",
    emailLabel: "البريد الإلكتروني",
    emailPlaceholder: "name@company.com",
    formSectionBasic: "بيانات أساسية",
    formSectionClassification: "التصنيف",
    formSectionContact: "التواصل",
    formSectionSchedule: "الجدولة",
    formSectionNotes: "ملاحظات",
    visitDateLabel: "تاريخ الزيارة",
    visitDateHint: "اسيبه فاضي لو لسه ما حصلتش الزيارة، وحددّه بس لما تكون فعلاً زرت العميل.",
    noVisitYet: "لسه ما حصلتش زيارة",
    dateAddedRow: "تاريخ إضافة العميل",

    // Missing-data filter
    missingDataFilter: "بيانات ناقصة",
    noVisitsYetFilter: "بدون زيارات",
    dateAddedFilterLabel: "تاريخ إضافة العميل",
    dateAddedAllOption: "كل الفترات",
    missingPhoneBadge: "بدون رقم",
    missingEmailBadge: "بدون إيميل",

    // Duplicate detection
    duplicatesTitle: "عملاء محتمل تكرارهم",
    duplicatesHint: "عملاء بنفس رقم الهاتف أو اسم شركة متشابه جدًا",
    noDuplicatesFound: "مفيش أي تكرار محتمل حاليًا",
    duplicatesBtn: "فحص التكرارات",
    samePhoneReason: "نفس رقم الهاتف",
    similarNameReason: "اسم شركة متشابه",

    // Stale / inactive customer indicator
    staleBadge: "متوقف النشاط",
    staleHint: (days) => `مفيش أي نشاط من ${days} يوم`,

    // Pin / favorite
    pinBtn: "تفضيل",
    unpinBtn: "إلغاء التفضيل",
    pinnedLabel: "مثبّت",
    callDateLabel: "موعد المتابعة القادم (اختياري)",
    callDateHint: "في نسخة الأندرويد: التطبيق هيبعتلك تنبيه حقيقي في المعاد ده حتى لو التطبيق مقفول. في نسخة المتصفح: لازم التطبيق يكون شغال.",
    notesLabel: "ملاحظات الزيارة",
    notesPlaceholder: "تفاصيل الزيارة، المطلوب متابعته، إلخ",
    save: "حفظ العميل",
    saving: "جاري الحفظ...",
    phoneRow: "رقم الهاتف",
    emailRow: "البريد الإلكتروني",
    visitDateRow: "تاريخ الزيارة",
    callDueLabel: "موعد المتابعة:",
    callDone: "تم الاتصال ✓",
    notesRow: "ملاحظات",
    edit: "تعديل",
    delete: "حذف",
    roles: {
      purchasing: "مسؤول المشتريات",
      it: "تقنية المعلومات",
      technical: "المكتب الفني",
      other: "أخرى",
    },
    sectorLabel: "القطاع *",
    sectorPlaceholder: "اختر القطاع",
    sectorError: "اختر قطاع العميل",
    sectorAll: "الكل",
    sectors: {
      construction: "قطاع المقاولات",
      education: "قطاع التعليم",
      consultants: "قطاع الاستشاريين",
      private: "شركات خاصة",
    },
    signOut: "تسجيل الخروج",
    reminderTitle: "تذكير متابعة:",
    reminderBody: (contact) => `موعد متابعة ${contact} حان الآن`,
    settingsTitle: "الإعدادات",
    manageAccess: "إدارة المشاركة",
    membersTitle: "الأشخاص الذين لديهم صلاحية الوصول",
    addMemberEmail: "البريد الإلكتروني",
    addMemberRole: "الصلاحية",
    roleEditor: "يشوف ويعدل",
    roleViewer: "يشوف فقط",
    addMemberBtn: "إضافة",
    noMembers: "لا يوجد أشخاص مضافين بعد",
    pendingSignupsTitle: "حسابات جديدة محتاجة مراجعة",
    pendingSignupsHint: "دي كل الحسابات اللي اتعملت على التطبيق ولسه معندهاش صلاحية. امنحها الدور المناسب أو تجاهلها.",
    noPendingSignups: "لا يوجد حسابات جديدة محتاجة مراجعة حاليًا",
    grantEditorBtn: "امنح صلاحية محرر",
    grantViewerBtn: "امنح صلاحية مشاهد",
    dismissSignupConfirm: "تجاهل الحساب ده من القائمة من غير ما تديله أي صلاحية؟",
    removeConfirm: "هل تريد إلغاء صلاحية هذا الشخص؟",
    statusOverdue: "متأخرة",
    statusToday: "اليوم",
    statusUpcoming: "قادمة",
    statusNone: "بدون تذكير",
    whatsapp: "واتساب",
    excelTitle: "استيراد / تصدير إكسيل",
    exportBtn: "تصدير كل الزيارات (إكسيل)",
    importBtn: "استيراد من ملف إكسيل",
    importHint: "الملف لازم يكون بنفس أعمدة ملف التصدير (اسم الشركة، الشخص المسؤول، إلخ). الصفوف هتتضاف كزيارات جديدة.",
    importSuccess: (n) => `تم استيراد ${n} زيارة بنجاح`,
    importError: "حصل خطأ أثناء قراءة الملف، تأكد من صيغة الملف",
    importing: "جارِ الاستيراد...",
    duplicatePhoneWarning: (company) => `رقم الهاتف ده مسجل بالفعل عند "${company}". هل تريد الإضافة برضو؟`,
    pipelineLabel: "مرحلة المشروع",
    pipelineAll: "كل المراحل",
    stages: {
      survey: "معاينة",
      quote: "عرض سعر",
      install: "تركيب",
      maintenance: "صيانة",
    },
    stageNone: "بدون مرحلة",
    tagsLabel: "الوسوم (Tags)",
    tagsPlaceholder: "افصل بينهم بفاصلة، مثال: VIP, يحتاج عرض سعر",
    tagsAll: "كل الوسوم",
    noTags: "بدون وسوم",
    activityLabel: "سجل النشاط",
    addActivityPlaceholder: "أضف ملاحظة أو نشاط جديد...",
    addActivityBtn: "إضافة",
    noActivity: "لا يوجد نشاط مسجل بعد",
    activityCreated: "تم إنشاء العميل",
    activityStageChanged: (stage) => `تم تغيير مرحلة المشروع إلى: ${stage}`,
    activityStageCleared: "تم إلغاء مرحلة المشروع",
    activityCallSet: (date) => `تم تحديد موعد متابعة: ${date}`,
    activityCallDone: "تم الاتصال ✓",
    offlineBanner: "غير متصل بالإنترنت - لازم يكون فيه نت عشان تقدر تحفظ أي تعديل",
    requireOnlineMsg: "لازم يكون فيه اتصال بالإنترنت عشان تقدر تحفظ",
    deleteActivityConfirm: "هل تريد حذف هذا النشاط؟",
    totalCustomersLabel: "إجمالي العملاء",
    // Used only on the Dashboard's customer list, which is filtered by the
    // selected year/month/sector — kept separate from totalCustomersLabel
    // (the true, unfiltered count shown on the customer list screen) so
    // renaming one never mislabels the other.
    dashPeriodCustomersLabel: "عملاء الفترة المختارة",
    dashNewCustomersLabel: "عملاء جداد",
    // Dynamic label for the "customers added" card: the wording changes
    // with the selected filter so it never implies a "new vs previous
    // period" comparison when it's actually a cumulative count for
    // whatever range (a whole year, or one month) is currently selected.
    dashCustomersAddedLabel: (rangeLabel) => `عملاء تم إضافتهم: ${rangeLabel}`,

    // Dark mode
    darkModeToggle: "الوضع الليلي",
    lightModeToggle: "الوضع النهاري",

    // Undo delete
    deletedUndoMsg: (name) => `تم حذف ${name}`,
    undoBtn: "تراجع",

    // Phone warning
    phoneMissingWarning: "العميل ده متسجلش له رقم تليفون. هل تريد الحفظ برضو؟",

    // Export
    exportAllBtn: "تصدير كل العملاء (إكسيل)",
    exportFilteredBtn: (n) => `تصدير النتائج المفلترة حاليًا (${n})`,

    // Export/import tabs (customers vs suppliers) in Settings
    exportTabCustomers: "العملاء",
    exportTabSuppliers: "الموردين",
    exportSuppliersAllBtn: "تصدير كل الموردين (إكسيل)",
    exportSuppliersFilteredBtn: (n) => `تصدير الموردين المفلترين حاليًا (${n})`,
    importSuppliersBtn: "استيراد موردين من ملف إكسيل",
    importingSuppliers: "جارِ استيراد الموردين...",
    importSuppliersHint: "الملف لازم يكون بنفس أعمدة ملف تصدير الموردين (اسم المورد، نوع البضاعة، إلخ). الصفوف هتتضاف كموردين جدد.",
    importSuppliersSuccess: (n) => `تم استيراد ${n} مورد بنجاح`,
    importSuppliersError: "حصل خطأ أثناء قراءة الملف، تأكد من صيغة الملف",

    // Member invite hint
    memberInviteHint: "لو الشخص ده لسه معملش حساب على التطبيق بنفس الإيميل ده، الصلاحية هتتفعل تلقائيًا أول ما يعمل تسجيل.",

    // Visit history / logging a new visit
    visitCountLabel: (n) => `عدد الزيارات: ${n}`,
    logVisitBtn: "تسجيل زيارة اليوم",
    activityVisitLogged: (date) => `تم تسجيل زيارة جديدة بتاريخ: ${date}`,

    // Stale offers follow-up
    staleOffersBanner: (n) => `عندك ${n} أوفر "قيد المتابعة" من غير رد من أكتر من ${STALE_OFFER_DAYS} يوم`,

    // Offer rejection reason
    offerRejectionReasonLabel: "سبب الرفض (اختياري)",
    offerRejectionReasonPrompt: "اكتب سبب رفض الأوفر (اختياري):",
    rejectionModalTitle: "سبب الرفض",
    rejectionModalPlaceholder: "اكتب السبب هنا (اختياري)...",
    rejectionModalConfirm: "تأكيد الرفض",
    rejectionModalCancel: "إلغاء",
    confirmModalConfirm: "تأكيد",
    confirmModalCancel: "إلغاء",
    confirmModalOk: "حسنًا",
    rejectionReasonRow: "سبب الرفض:",
    changeStatusLabel: "تغيير حالة الأوفر:",

    // Bottom navigation
    navDashboard: "Dashboard",
    navCustomers: "العملاء",
    navSuppliers: "الموردين",
    navSettings: "الإعدادات",

    // Suppliers
    suppliersTitle: "الموردين",
    titleNewSupplier: "مورد جديد",
    titleEditSupplier: "تعديل المورد",
    supplierNameLabel: "اسم المورد *",
    supplierNamePlaceholder: "مثال: شركة الفا للتوريدات",
    supplierNameError: "اكتب اسم المورد",
    supplierContactLabel: "الشخص المسؤول",
    supplierContactPlaceholder: "مثال: محمد علي",
    supplierCategoryLabel: "نوع البضاعة / الخدمة",
    supplierCategoryPlaceholder: "مثال: ماركة باير",
    supplierCategoryAll: "كل الأنواع",
    saveSupplier: "حفظ مورد",
    supplierNotesLabel: "ملاحظات",
    newSupplierBtn: "مورد جديد",
    noSuppliers: "لا يوجد موردين بعد",
    noSuppliersHint: 'اضغط على "مورد جديد" لإضافة أول مورد',
    noSupplierName: "بدون اسم مورد",
    deleteSupplierConfirm: "هل أنت متأكد من حذف هذا المورد؟",
    searchSuppliersPlaceholder: "ابحث بالاسم أو الرقم أو نوع البضاعة",

    // Supplier tags (product names supplied)
    supplierTagsLabel: "المنتجات (Tags)",
    supplierTagsPlaceholder: "افصل بينهم بفاصلة، مثال: كاميرات، كابلات، أجهزة إنذار",
    supplierTagsAll: "كل المنتجات",
    noSupplierTags: "بدون منتجات مسجلة",

    // Offers
    offersLabel: "الأوفرات",
    offerNameLabel: "اسم الأوفر",
    offerNamePlaceholder: "مثال: عرض توريد كاميرات",
    offerNumberLabel: "رقم الأوفر (اختياري)",
    offerAmountLabel: "المبلغ",
    offerDateLabel: "تاريخ الأوفر",
    offerStatusLabel: "الحالة",
    addOfferBtn: "إضافة أوفر",
    noOffers: "لا يوجد أوفرات مسجلة بعد",
    deleteOfferConfirm: "هل تريد حذف هذا الأوفر؟",
    offerStatuses: {
      pending: "قيد المتابعة",
      purchased: "تم الشراء",
      rejected: "مرفوض",
      installed: "تم التركيب",
    },

    // Offer suppliers (many-to-many link between an offer and suppliers)
    offerSuppliersBtn: "اختيار الموردين",
    offerSuppliersSheetTitle: "اختيار الموردين",
    offerSuppliersDone: "تم",
    offerSuppliersNone: "بدون مورد محدد",
    offerSuppliersLabel: "الموردين",
    offerSuppliersCount: (n) => (n === 1 ? "مورد واحد" : `موردين (${n})`),
    noSuppliersToPick: "لسه معندكش موردين مسجلين",
    pickSupplierSearchPlaceholder: "ابحث عن مورد بالاسم",
    noSupplierSearchResults: "مفيش مورد بالاسم ده",
    activityOfferAdded: (name) => `تم إضافة أوفر جديد: ${name}`,
    activityOfferStatus: (name, status) => `تم تغيير حالة الأوفر "${name}" إلى: ${status}`,

    // Dashboard
    dashYear: "السنة",
    dashPeriodLabel: "الفترة",
    dashPeriodCurrentMonth: "الشهر الحالي",
    dashPeriodLast3: "آخر 3 شهور",
    dashPeriodLast6: "آخر 6 شهور",
    dashPeriodWholeYear: "كل السنة",
    dashPeriodCustom: "تحديد يدوي",
    dashPeriodCustomSingle: "شهر واحد",
    dashPeriodCustomRange: "فترة",
    dashPeriodChoose: "اختر الفترة",
    dashPeriodApply: "تطبيق",
    dashPeriodTo: "إلى",
    dashSector: "القطاع",
    dashAllSectors: "كل القطاعات",
    dashCardVisits: "إجمالي الزيارات",
    dashCardOffersCount: "عدد الأوفرات",
    dashCardOffersValue: "إجمالي قيمة الأوفرات",
    dashOffersConverted: "اتحول لبيع",
    dashVisitsPerformance: "أداء الزيارات",
    dashOffersSection: "الأوفرات",
    dashOffersTotalLabel: "عدد الأوفرات",
    dashOffersTotalValueLabel: "إجمالي قيمة الأوفرات",
    dashPipeline: "مسار المبيعات (Pipeline)",
    dashSalesPerformance: "أداء المبيعات",
    dashAvgDealSize: "متوسط قيمة الصفقة",
    dashWinRate: "نسبة الفوز",
    dashWinRateSample: (n) => `من ${n} صفقة محسومة`,
    dashOffersValueTrend: "اتجاه قيمة الأوفرات (EG)",
    dashOffersValueTrendUSD: "اتجاه قيمة الأوفرات ($)",
    dashPointsSuffix: "نقطة",
    dashNoOffersYet: "لا توجد أوفرات كافية للحساب",
    dashCompareToggle: "مقارنة بالشهر السابق",
    dashNoComparisonData: "لا توجد بيانات للمقارنة",
    dashNoVisitsInPeriod: "لا توجد زيارات خلال هذه الفترة",
    dashOfferFilterAll: "الكل",
    dashLastVisit: "آخر زيارة:",
    dashCurrency: "EG",
    currencies: { EGP: "EG", USD: "$" },
    currencyLabel: "العملة",
    months: [
      "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
      "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
    ],

    // Location / maps (GPS at time of logging a visit)
    openInMaps: "افتح آخر موقع على الخريطة",
    lastVisitLocationLabel: "موقع آخر زيارة",
    locationDeniedHint: "تم تسجيل الزيارة، لكن الموقع لم يتم تحديده (الإذن غير مفعّل أو الجهاز لا يدعمه)",
    visitLocationPin: "الموقع",

    // Alerts center (collapsible banner group on the customer list)
    alertsCenterTitle: "التنبيهات",
    noAlertsHint: "لا توجد تنبيهات حاليًا",

    // Filter bottom sheet
    filtersBtn: "فلاتر",
    filtersTitle: "الفلاتر",
    otherFiltersLabel: "فلاتر أخرى",
    applyFiltersBtn: "تطبيق",
    clearFiltersBtn: "مسح الكل",

    // Pending edits notification (owner-only "last_change" review queue)
    pendingEditsBtn: "تعديلات",
    pendingEditsTitle: "تعديلات بانتظار المراجعة",
    pendingEditsEmpty: "لا توجد تعديلات بانتظار المراجعة",
    pendingEditsBy: (name, date) => `بواسطة ${name} • ${date}`,
    pendingDeleteLabel: "حذف",

    // Delete-approval banner in CustomerDetail (owner-only)
    deletePendingTitle: "طلب حذف عميل (خاص بك)",
    deletePendingBy: (name) => `قام المستخدم ${name} بحذف هذا العميل. هل تريد اعتماد الحذف نهائيًا أم استرجاع العميل؟`,
    confirmDeleteFinalBtn: "اعتماد الحذف نهائيًا",
    restoreCustomerBtn: "استرجاع العميل",
    deleteApprovedMsg: "تم حذف العميل نهائيًا.",
    deleteRestoredMsg: "تم استرجاع العميل بنجاح.",

    // PDF report export
    dashExportPdfBtn: "تصدير تقرير PDF",
    dashPdfGenerating: "جارِ تجهيز التقرير...",
    dashPdfReportTitle: "تقرير الأداء",
    dashPdfGeneratedAt: (date) => `تاريخ إصدار التقرير: ${date}`,
    dashPdfPeriod: (label) => `الفترة: ${label}`,
    dashPdfSectorLine: (sector) => `القطاع: ${sector}`,
    dashPdfSummarySection: "ملخص الأداء",
    dashPdfPipelineSection: "توزيع مسار المبيعات",
    dashPdfOffersListSection: "تفاصيل الأوفرات",
    dashPdfCustomersSection: "العملاء المُضافون خلال الفترة",
    dashPdfNoOffers: "لا توجد أوفرات في هذه الفترة",
    dashPdfNoCustomers: "لا يوجد عملاء جدد في هذه الفترة",
    dashPdfFooterNote: "تم إصدار هذا التقرير تلقائيًا من تطبيق Pest.Co",
    dashPdfError: "حصل خطأ أثناء إنشاء ملف PDF",
    dashPdfShareTitle: "حفظ أو مشاركة التقرير",
    dashPdfColCompany: "الشركة",
    dashPdfColOffer: "الأوفر",
    dashPdfColAmount: "القيمة",
    dashPdfColStatus: "الحالة",
    dashPdfColDate: "التاريخ",
    dashPdfColSector: "القطاع",
    dashPdfColStage: "المرحلة",
  },
  en: {
    dir: "ltr",
    locale: "en-US",
    appTitle: "Pest.Co — CRM",
    titleEdit: "Edit Customer",
    titleNew: "New Customer",
    titleDetail: "Customer Details",
    titleDashboard: "Dashboard",
    back: "Back",
    langToggle: "عربي",
    dueCalls: (n) => `You have ${n} follow-up${n === 1 ? "" : "s"} due`,
    searchPlaceholder: "Search by company, contact, phone, notes or date",
    loading: "Loading...",
    noVisits: "No visits yet",
    noVisitsHint: 'Tap "New Customer" to add your first client',
    newVisit: "New Customer",
    noCompanyName: "No company name",
    noContactName: "No name",
    companyLabel: "Company Name *",
    companyPlaceholder: "e.g. Al Nour Industries",
    companyError: "Enter the company name",
    contactLabel: "Contact Person *",
    contactPlaceholder: "e.g. Ahmed Mohamed",
    contactError: "Enter the contact person's name",
    roleLabel: "Department / Job Title",
    phoneLabel: "Phone Number",
    phonePlaceholder: "01xxxxxxxxx",
    emailLabel: "Email",
    emailPlaceholder: "name@company.com",
    formSectionBasic: "Basic info",
    formSectionClassification: "Classification",
    formSectionContact: "Contact",
    formSectionSchedule: "Scheduling",
    formSectionNotes: "Notes",
    visitDateLabel: "Visit Date",
    visitDateHint: "Leave this empty if the visit hasn't happened yet — only set it once you've actually visited the customer.",
    noVisitYet: "No visit yet",
    dateAddedRow: "Date Added",

    // Missing-data filter
    missingDataFilter: "Missing Data",
    noVisitsYetFilter: "No Visits Yet",
    dateAddedFilterLabel: "Date Customer Added",
    dateAddedAllOption: "All time",
    missingPhoneBadge: "No phone",
    missingEmailBadge: "No email",

    // Duplicate detection
    duplicatesTitle: "Possible Duplicate Customers",
    duplicatesHint: "Customers sharing a phone number or a very similar company name",
    noDuplicatesFound: "No possible duplicates right now",
    duplicatesBtn: "Check Duplicates",
    samePhoneReason: "Same phone number",
    similarNameReason: "Similar company name",

    // Stale / inactive customer indicator
    staleBadge: "Needs review",
    staleHint: (days) => `No activity in ${days} days`,

    // Pin / favorite
    pinBtn: "Pin",
    unpinBtn: "Unpin",
    pinnedLabel: "Pinned",
    callDateLabel: "Next Follow-up Date (optional)",
    callDateHint: "On the Android app: you'll get a real alert at this time even if the app is closed. On the web version: the app needs to be open.",
    notesLabel: "Visit Notes",
    notesPlaceholder: "Visit details, follow-ups needed, etc.",
    save: "Save Customer",
    saving: "Saving...",
    phoneRow: "Phone Number",
    emailRow: "Email",
    visitDateRow: "Visit Date",
    callDueLabel: "Follow-up due:",
    callDone: "Called ✓",
    notesRow: "Notes",
    edit: "Edit",
    delete: "Delete",
    roles: {
      purchasing: "Purchasing Manager",
      it: "IT",
      technical: "Technical Office",
      other: "Other",
    },
    sectorLabel: "Sector *",
    sectorPlaceholder: "Select sector",
    sectorError: "Select the customer's sector",
    sectorAll: "All",
    sectors: {
      construction: "Construction Sector",
      education: "Education",
      consultants: "Consultants",
      private: "Private Companies",
    },
    signOut: "Sign Out",
    reminderTitle: "Follow-up reminder:",
    reminderBody: (contact) => `It's time to follow up with ${contact}`,
    settingsTitle: "Settings",
    manageAccess: "Manage Access",
    membersTitle: "People with access",
    addMemberEmail: "Email",
    addMemberRole: "Role",
    roleEditor: "Can view & edit",
    roleViewer: "View only",
    addMemberBtn: "Add",
    noMembers: "No one added yet",
    pendingSignupsTitle: "New accounts pending review",
    pendingSignupsHint: "Everyone who has signed up in the app but doesn't have access yet. Grant the right role, or dismiss them.",
    noPendingSignups: "No new accounts pending review right now",
    grantEditorBtn: "Grant editor access",
    grantViewerBtn: "Grant viewer access",
    dismissSignupConfirm: "Dismiss this account from the list without granting any access?",
    removeConfirm: "Remove this person's access?",
    statusOverdue: "Overdue",
    statusToday: "Today",
    statusUpcoming: "Upcoming",
    statusNone: "No call set",
    whatsapp: "WhatsApp",
    excelTitle: "Excel Import / Export",
    exportBtn: "Export all visits (Excel)",
    importBtn: "Import from Excel file",
    importHint: "The file must use the same columns as the exported file (Company Name, Contact Person, etc). Rows will be added as new visits.",
    importSuccess: (n) => `Successfully imported ${n} visit${n === 1 ? "" : "s"}`,
    importError: "Something went wrong reading the file, please check the file format",
    importing: "Importing...",
    duplicatePhoneWarning: (company) => `This phone number is already saved for "${company}". Add anyway?`,
    pipelineLabel: "Project Stage",
    pipelineAll: "All Stages",
    stages: {
      survey: "Survey",
      quote: "Quote",
      install: "Installation",
      maintenance: "Maintenance",
    },
    stageNone: "No stage",
    tagsLabel: "Tags",
    tagsPlaceholder: "Comma separated, e.g. VIP, Needs quote",
    tagsAll: "All Tags",
    noTags: "No tags",
    activityLabel: "Activity Log",
    addActivityPlaceholder: "Add a note or new activity...",
    addActivityBtn: "Add",
    noActivity: "No activity logged yet",
    activityCreated: "Customer created",
    activityStageChanged: (stage) => `Project stage changed to: ${stage}`,
    activityStageCleared: "Project stage cleared",
    activityCallSet: (date) => `Follow-up scheduled: ${date}`,
    activityCallDone: "Called ✓",
    offlineBanner: "You're offline - you need a connection to save any changes",
    requireOnlineMsg: "You need an internet connection to save changes",
    deleteActivityConfirm: "Delete this activity entry?",
    totalCustomersLabel: "Total Customers",
    dashPeriodCustomersLabel: "Customers in Selected Period",
    dashNewCustomersLabel: "New Customers",
    dashCustomersAddedLabel: (rangeLabel) => `Customers Added: ${rangeLabel}`,

    // Dark mode
    darkModeToggle: "Dark Mode",
    lightModeToggle: "Light Mode",

    // Undo delete
    deletedUndoMsg: (name) => `Deleted ${name}`,
    undoBtn: "Undo",

    // Phone warning
    phoneMissingWarning: "This customer has no phone number saved. Save anyway?",

    // Export
    exportAllBtn: "Export all customers (Excel)",
    exportFilteredBtn: (n) => `Export current filtered results (${n})`,

    // Export/import tabs (customers vs suppliers) in Settings
    exportTabCustomers: "Customers",
    exportTabSuppliers: "Suppliers",
    exportSuppliersAllBtn: "Export all suppliers (Excel)",
    exportSuppliersFilteredBtn: (n) => `Export current filtered suppliers (${n})`,
    importSuppliersBtn: "Import suppliers from Excel file",
    importingSuppliers: "Importing suppliers...",
    importSuppliersHint: "The file must use the same columns as the exported suppliers file (Supplier Name, Goods/Service Type, etc). Rows will be added as new suppliers.",
    importSuppliersSuccess: (n) => `Successfully imported ${n} supplier${n === 1 ? "" : "s"}`,
    importSuppliersError: "Something went wrong reading the file, please check the file format",

    // Member invite hint
    memberInviteHint: "If this person hasn't signed up with this email yet, their access will activate automatically as soon as they do.",

    // Visit history / logging a new visit
    visitCountLabel: (n) => `Visits: ${n}`,
    logVisitBtn: "Log a visit today",
    activityVisitLogged: (date) => `New visit logged: ${date}`,

    // Stale offers follow-up
    staleOffersBanner: (n) => `You have ${n} offer${n === 1 ? "" : "s"} "in progress" with no update for over ${STALE_OFFER_DAYS} days`,

    // Offer rejection reason
    offerRejectionReasonLabel: "Rejection reason (optional)",
    offerRejectionReasonPrompt: "Enter the reason the offer was rejected (optional):",
    rejectionModalTitle: "Rejection Reason",
    rejectionModalPlaceholder: "Type the reason here (optional)...",
    rejectionModalConfirm: "Confirm Rejection",
    rejectionModalCancel: "Cancel",
    confirmModalConfirm: "Confirm",
    confirmModalCancel: "Cancel",
    confirmModalOk: "OK",
    rejectionReasonRow: "Rejection reason:",
    changeStatusLabel: "Change offer status:",

    // Bottom navigation
    navDashboard: "Dashboard",
    navCustomers: "Customers",
    navSuppliers: "Suppliers",
    navSettings: "Settings",

    // Suppliers
    suppliersTitle: "Suppliers",
    titleNewSupplier: "New Supplier",
    titleEditSupplier: "Edit Supplier",
    supplierNameLabel: "Supplier Name *",
    supplierNamePlaceholder: "e.g. Alpha Supplies Co.",
    supplierNameError: "Enter the supplier name",
    supplierContactLabel: "Contact Person",
    supplierContactPlaceholder: "e.g. Mohamed Ali",
    saveSupplier: "Save Supplier",
    supplierCategoryLabel: "Goods / Service Type",
    supplierCategoryPlaceholder: "e.g. Bayer",
    supplierCategoryAll: "All Types",
    supplierNotesLabel: "Notes",
    newSupplierBtn: "New Supplier",
    noSuppliers: "No suppliers yet",
    noSuppliersHint: 'Tap "New Supplier" to add your first one',
    noSupplierName: "No supplier name",
    deleteSupplierConfirm: "Are you sure you want to delete this supplier?",
    searchSuppliersPlaceholder: "Search by name, phone, or goods type",

    // Supplier tags (product names supplied)
    supplierTagsLabel: "Products (Tags)",
    supplierTagsPlaceholder: "Comma separated, e.g. Cameras, Cabling, Alarm systems",
    supplierTagsAll: "All Products",
    noSupplierTags: "No products recorded",

    // Offers
    offersLabel: "Offers",
    offerNameLabel: "Offer Name",
    offerNamePlaceholder: "e.g. Camera supply offer",
    offerNumberLabel: "Offer Number (optional)",
    offerAmountLabel: "Amount",
    offerDateLabel: "Offer Date",
    offerStatusLabel: "Status",
    addOfferBtn: "Add Offer",
    noOffers: "No offers recorded yet",
    deleteOfferConfirm: "Delete this offer?",
    offerStatuses: {
      pending: "In progress",
      purchased: "Purchased",
      rejected: "Rejected",
      installed: "Installed",
    },

    // Offer suppliers (many-to-many link between an offer and suppliers)
    offerSuppliersBtn: "Select suppliers",
    offerSuppliersSheetTitle: "Select suppliers",
    offerSuppliersDone: "Done",
    offerSuppliersNone: "No supplier selected",
    offerSuppliersLabel: "Suppliers",
    offerSuppliersCount: (n) => (n === 1 ? "1 supplier" : `${n} suppliers`),
    noSuppliersToPick: "No suppliers added yet",
    pickSupplierSearchPlaceholder: "Search suppliers by name",
    noSupplierSearchResults: "No supplier matches that name",
    activityOfferAdded: (name) => `New offer added: ${name}`,
    activityOfferStatus: (name, status) => `Offer "${name}" status changed to: ${status}`,

    // Dashboard
    dashYear: "Year",
    dashPeriodLabel: "Period",
    dashPeriodCurrentMonth: "Current Month",
    dashPeriodLast3: "Last 3 Months",
    dashPeriodLast6: "Last 6 Months",
    dashPeriodWholeYear: "Whole Year",
    dashPeriodCustom: "Custom",
    dashPeriodCustomSingle: "Single Month",
    dashPeriodCustomRange: "Range",
    dashPeriodChoose: "Choose Period",
    dashPeriodApply: "Apply",
    dashPeriodTo: "to",
    dashSector: "Sector",
    dashAllSectors: "All Sectors",
    dashCardVisits: "Total Visits",
    dashCardOffersCount: "Offers",
    dashCardOffersValue: "Total Offers Value",
    dashOffersConverted: "Converted",
    dashVisitsPerformance: "Visits Performance",
    dashOffersSection: "Offers",
    dashOffersTotalLabel: "Offers",
    dashOffersTotalValueLabel: "Total Offers Value",
    dashPipeline: "Sales Pipeline",
    dashSalesPerformance: "Sales Performance",
    dashAvgDealSize: "Average Deal Size",
    dashWinRate: "Win Rate",
    dashWinRateSample: (n) => `of ${n} decided deals`,
    dashOffersValueTrend: "Offers Value Trend (EG)",
    dashOffersValueTrendUSD: "Offers Value Trend ($)",
    dashPointsSuffix: "pts",
    dashNoOffersYet: "Not enough offers to calculate",
    dashCompareToggle: "Compare to previous month",
    dashNoComparisonData: "No comparison data available",
    dashNoVisitsInPeriod: "No visits during this period",
    dashOfferFilterAll: "All",
    dashLastVisit: "Last visit:",
    dashCurrency: "EG",
    currencies: { EGP: "EG", USD: "$" },
    currencyLabel: "Currency",
    months: [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ],

    // Location / maps (GPS at time of logging a visit)
    openInMaps: "Open last location on map",
    lastVisitLocationLabel: "Last visit location",
    locationDeniedHint: "Visit logged, but location wasn't captured (permission denied or unsupported device)",
    visitLocationPin: "Location",

    // Alerts center (collapsible banner group on the customer list)
    alertsCenterTitle: "Alerts",
    noAlertsHint: "No alerts right now",

    // Filter bottom sheet
    filtersBtn: "Filters",
    filtersTitle: "Filters",
    otherFiltersLabel: "Other filters",
    applyFiltersBtn: "Apply",
    clearFiltersBtn: "Clear all",

    // Pending edits notification (owner-only "last_change" review queue)
    pendingEditsBtn: "Edits",
    pendingEditsTitle: "Edits awaiting review",
    pendingEditsEmpty: "No edits awaiting review",
    pendingEditsBy: (name, date) => `by ${name} • ${date}`,
    pendingDeleteLabel: "Delete",

    // Delete-approval banner in CustomerDetail (owner-only)
    deletePendingTitle: "Customer deletion request (yours to review)",
    deletePendingBy: (name) => `${name} deleted this customer. Approve the deletion permanently, or restore the customer?`,
    confirmDeleteFinalBtn: "Confirm deletion",
    restoreCustomerBtn: "Restore customer",
    deleteApprovedMsg: "Customer permanently deleted.",
    deleteRestoredMsg: "Customer restored successfully.",

    // PDF report export
    dashExportPdfBtn: "Export PDF Report",
    dashPdfGenerating: "Preparing report...",
    dashPdfReportTitle: "Performance Report",
    dashPdfGeneratedAt: (date) => `Generated on: ${date}`,
    dashPdfPeriod: (label) => `Period: ${label}`,
    dashPdfSectorLine: (sector) => `Sector: ${sector}`,
    dashPdfSummarySection: "Performance Summary",
    dashPdfPipelineSection: "Sales Pipeline Breakdown",
    dashPdfOffersListSection: "Offers Detail",
    dashPdfCustomersSection: "Customers Added in Period",
    dashPdfNoOffers: "No offers in this period",
    dashPdfNoCustomers: "No new customers in this period",
    dashPdfFooterNote: "This report was generated automatically by the Pest.Co app",
    dashPdfError: "An error occurred while generating the PDF",
    dashPdfShareTitle: "Save or share report",
    dashPdfColCompany: "Company",
    dashPdfColOffer: "Offer",
    dashPdfColAmount: "Amount",
    dashPdfColStatus: "Status",
    dashPdfColDate: "Date",
    dashPdfColSector: "Sector",
    dashPdfColStage: "Stage",
  },
};

export const ROLE_IDS = ["purchasing", "it", "technical", "other"];
export const ROLE_COLORS = {
  purchasing: "#B9832A",
  it: "#2C6E8C",
  technical: "#0F5132",
  other: "#6B7168",
};
export const roleColor = (id) => ROLE_COLORS[id] || ROLE_COLORS.other;

export const SECTOR_IDS = ["construction", "education", "consultants", "private"];
export const SECTOR_COLORS = {
  construction: "#8C5A2C",
  education: "#2C6E8C",
  consultants: "#3D8C6C",
  private: "#6B4C8C",
};
export const sectorColor = (id) => SECTOR_COLORS[id] || SECTOR_COLORS.private;

export const STAGE_IDS = ["survey", "quote", "install", "maintenance"];
export const STAGE_COLORS = {
  survey: "#6B7168",
  quote: "#B9832A",
  install: "#0F6E56",
  maintenance: "#534AB7",
};
export const stageColor = (id) => STAGE_COLORS[id] || STAGE_COLORS.survey;

export const OFFER_STATUS_IDS = ["pending", "purchased", "rejected", "installed"];
export const CURRENCY_IDS = ["EGP", "USD"];
export const OFFER_STATUS_COLORS = {
  pending: "#DB9A2C",
  purchased: "#2F9E58",
  rejected: "#C4443A",
  installed: "#2E6B8F",
};
export const offerStatusColor = (id) => OFFER_STATUS_COLORS[id] || OFFER_STATUS_COLORS.pending;

// Matches an imported Excel cell value (Arabic or English label, or raw id) to a sector id
export function findSectorId(value) {
  const v = (value || "").toString().trim();
  if (SECTOR_IDS.includes(v)) return v;
  for (const langKey of Object.keys(STRINGS)) {
    const map = STRINGS[langKey].sectors;
    const found = Object.entries(map).find(([, label]) => label === v);
    if (found) return found[0];
  }
  return "private";
}

// Matches an imported Excel cell value (Arabic or English label, or raw id) to a role id
export function findRoleId(value) {
  const v = (value || "").toString().trim();
  if (ROLE_IDS.includes(v)) return v;
  for (const langKey of Object.keys(STRINGS)) {
    const map = STRINGS[langKey].roles;
    const found = Object.entries(map).find(([, label]) => label === v);
    if (found) return found[0];
  }
  return "other";
}

// Matches an imported Excel cell value (Arabic or English label, or raw id) to a pipeline stage id
export function findStageId(value) {
  const v = (value || "").toString().trim();
  if (STAGE_IDS.includes(v)) return v;
  for (const langKey of Object.keys(STRINGS)) {
    const map = STRINGS[langKey].stages;
    const found = Object.entries(map).find(([, label]) => label === v);
    if (found) return found[0];
  }
  return "survey";
}

// Splits a comma separated Excel cell into a clean tag array.
// Shared by both customer tags and supplier product tags.
export function parseTagsCell(value) {
  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Collects the sorted, de-duplicated set of tags across a list of suppliers
// (their `tags` array), for populating the supplier "filter by product" list.
export function collectSupplierTags(suppliers) {
  const set = new Set();
  (suppliers || []).forEach((s) => (s.tags || []).forEach((t) => t && set.add(t)));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

// Distinct, non-empty category values already entered across suppliers
// (e.g. "مبيدات", "معدات") — used to build the category filter chips on the
// suppliers list. Free-text like tags, not a fixed enum, so it only ever
// shows categories someone has actually typed in.
export function collectSupplierCategories(suppliers) {
  const set = new Set();
  (suppliers || []).forEach((s) => s.category && set.add(s.category.trim()));
  return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
}

// Parses a visitDate/offerDate value that might be stored as ISO (yyyy-mm-dd,
// from the date input) or as raw text like "d-m-yyyy" / "dd-mm-yyyy" (from
// older Excel imports), returning a real Date object so sorting/date-range
// filtering is correct regardless of which format is stored.
export function parseVisitDate(str) {
  if (!str) return null;
  const s = String(str).trim();
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return isNaN(d) ? null : d;
  }
  const dmy = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    return isNaN(d) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

// Normalizes any supported date format back to ISO yyyy-mm-dd, the format
// the <input type="date"> control expects.
export function toISODate(str) {
  const d = parseVisitDate(str);
  if (!d) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Normalizes an Excel cell (Date object or string) into a yyyy-mm-dd date string
export function normalizeExcelDate(val) {
  if (!val) return "";
  if (val instanceof Date) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${val.getFullYear()}-${pad(val.getMonth() + 1)}-${pad(val.getDate())}`;
  }
  return toISODate(val) || String(val).trim();
}

// Normalizes an Excel cell (Date object or string) into a yyyy-mm-ddThh:mm datetime-local string
export function normalizeExcelDateTime(val) {
  if (!val) return "";
  if (val instanceof Date) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${val.getFullYear()}-${pad(val.getMonth() + 1)}-${pad(val.getDate())}T${pad(val.getHours())}:${pad(val.getMinutes())}`;
  }
  return String(val).trim();
}

// Builds a unique activity-log entry for a visit's timeline
export function buildActivity(type, text) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    text,
    at: new Date().toISOString(),
  };
}

// Builds a unique visit-history entry, used to track that an actual visit
// happened on a given date (as opposed to just "the current visitDate"),
// so the Dashboard can count real visit events per customer over time.
//
// `location`, when provided, is a plain { lat, lng } object captured from
// the device's GPS at the moment the visit was logged (see src/geo.js).
// It's optional and stored as `null` when unavailable (permission denied,
// unsupported device, or timed out) — older entries simply don't have this
// field at all, which every reader here already treats as "no location".
export function buildVisitEntry(date, location) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: date || new Date().toISOString().slice(0, 10),
    at: new Date().toISOString(),
    location: location || null,
  };
}

// Returns the list of visit events for a customer. Falls back to a single
// event built from visitDate for customers that predate visit-history
// tracking, so old data still counts correctly.
export function getVisitEvents(visit) {
  if (visit.visitHistory && visit.visitHistory.length) return visit.visitHistory;
  if (visit.visitDate) return [{ id: "legacy", date: visit.visitDate, at: null }];
  return [];
}

// Builds a unique offer entry for a customer's offers list
export function buildOffer({ name, offerNumber, amount, offerDate, status, currency, supplierIds, supplierNames }) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name || "",
    offerNumber: offerNumber || "",
    amount: Number(amount) || 0,
    currency: CURRENCY_IDS.includes(currency) ? currency : "EGP",
    offerDate: offerDate || "",
    status: status || "pending",
    rejectionReason: "",
    // Many-to-many link to suppliers. supplierNames is a snapshot taken at
    // save time (same pattern as everywhere else names get denormalized in
    // this app) so a later rename/delete of a supplier doesn't change what
    // an already-saved offer displays.
    supplierIds: Array.isArray(supplierIds) ? supplierIds : [],
    supplierNames: Array.isArray(supplierNames) ? supplierNames : [],
    createdAt: new Date().toISOString(),
  };
}

// Sums a list of offers per currency, e.g. { EGP: 12000, USD: 500 }.
// Offers with no currency field (created before multi-currency support)
// are treated as EGP.
export function sumOffersByCurrency(offers) {
  const totals = {};
  CURRENCY_IDS.forEach((id) => (totals[id] = 0));
  (offers || []).forEach((o) => {
    const cur = CURRENCY_IDS.includes(o.currency) ? o.currency : "EGP";
    totals[cur] += Number(o.amount) || 0;
  });
  return totals;
}

// Formats a per-currency totals map (from sumOffersByCurrency) into a
// human-readable string, e.g. "12,000 جنيه + 500 دولار". Omits currencies
// with a zero total; returns "" if everything is zero — unless
// showAllIfEmpty is set, in which case an all-zero total renders every
// currency at 0 (e.g. "0 جنيه + 0 دولار") instead of collapsing to "".
export function fmtOffersTotals(totals, t, { showAllIfEmpty = false } = {}) {
  const nonZeroIds = CURRENCY_IDS.filter((id) => totals[id]);
  const ids = nonZeroIds.length > 0 ? nonZeroIds : (showAllIfEmpty ? CURRENCY_IDS : []);
  const joined = ids
    .map((id) => `${fmtMoney(totals[id] || 0, t.locale)} ${t.currencies[id]}`)
    .join(" + ");
  if (!joined) return joined;
  // Wrap in Unicode isolate marks (LRI ... PDI) so the amount+currency
  // sequence is treated as a single left-to-right block by the bidi
  // algorithm. Without this, joining two currency segments with " + "
  // (e.g. "0 EG + 0 $") gets visually reordered/scrambled when rendered
  // inside an RTL (Arabic) container — each segment becomes its own bidi
  // run and the runs get flipped relative to each other. Isolating the
  // whole string keeps it left-to-right and in the same order in every
  // locale.
  return `\u2066${joined}\u2069`;
}

export const ACTIVITY_COLORS = {
  created: "#0F6E56",
  stage: "#534AB7",
  call: "#2E6B8F",
  note: "#B9832A",
  offer: "#C08A3E",
  visit: "#2F9E58",
};

export function visitStatus(visit) {
  if (!visit.callDateTime) return "none";
  const call = new Date(visit.callDateTime);
  const now = new Date();
  if (call.getTime() < now.getTime()) return "overdue";
  const sameDay =
    call.getFullYear() === now.getFullYear() &&
    call.getMonth() === now.getMonth() &&
    call.getDate() === now.getDate();
  if (sameDay) return "today";
  return "upcoming";
}

export function fmtReminder(dt, locale) {
  try {
    const d = new Date(dt);
    return d.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", numberingSystem: "latn" });
  } catch (e) {
    return dt;
  }
}

// Formats a Firestore createdAt timestamp (or a plain Date/string) into a
// locale-aware "date added" display string.
// Converts a Firestore createdAt timestamp (or a plain Date/string) into a
// JS Date, or null if it's missing/invalid. Shared by fmtCreatedAt and any
// code that needs to filter/compare by creation date.
export function toJsDate(ts) {
  if (!ts) return null;
  const d = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
  return isNaN(d) ? null : d;
}

export function fmtCreatedAt(ts, locale) {
  const d = toJsDate(ts);
  if (!d) return "";
  try {
    return d.toLocaleString(locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", numberingSystem: "latn" });
  } catch (e) {
    return "";
  }
}

export function fmtActivityDate(dt, locale) {
  try {
    const d = new Date(dt);
    return d.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", numberingSystem: "latn" });
  } catch (e) {
    return dt;
  }
}

// Always renders Western (Latin) digits, even under the "ar-EG" locale,
// which would otherwise switch to Arabic-Indic numerals (٠١٢٣...) and mix
// with the plain Western digits used elsewhere in the app (e.g. raw counts
// rendered without formatting). Keeping every on-screen number in the same
// digit system avoids that inconsistency.
//
// This is done with plain string manipulation instead of
// Number.toLocaleString(), even with "en-US" forced. Some Android WebView
// builds (notably the stripped-down ICU shipped with certain Capacitor/
// Android combinations) ignore the locale argument entirely and fall back
// to the device's system language — so on an Arabic-language phone,
// toLocaleString("en-US") can still silently produce Arabic-Indic digits
// and an Arabic decimal separator. Building the string by hand (digits,
// comma, period — nothing else) sidesteps ICU/locale behavior altogether
// and guarantees the same output on every device. The `locale` param is
// kept for call-site compatibility but no longer affects the output.
export function fmtMoney(n, locale) {
  try {
    let num = Number(n);
    if (!isFinite(num)) num = 0;
    const negative = num < 0;
    num = Math.abs(num);
    // Match toLocaleString's default rounding (up to 3 fraction digits).
    num = Math.round(num * 1000) / 1000;
    const [intPart, decPart] = num.toString().split(".");
    const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (negative ? "-" : "") + withThousands + (decPart ? "." + decPart : "");
  } catch (e) {
    return String(n || 0);
  }
}

// Normalizes a phone number to its core digits, ignoring +2 / 0020 / leading 0 variations
export function corePhoneDigits(phone) {
  let d = (phone || "").replace(/[^0-9]/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("20") && d.length > 10) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  return d;
}

// Normalizes a company name for duplicate-matching (trim, lowercase, collapse spaces)
export function normalizeCompanyName(name) {
  return (name || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// Groups customers that share a phone number or a near-identical company
// name, so they can be reviewed and merged/cleaned up in one place.
export function findDuplicateGroups(visits) {
  const phoneGroups = {};
  const nameGroups = {};

  visits.forEach((v) => {
    const phone = corePhoneDigits(v.phone);
    if (phone) {
      if (!phoneGroups[phone]) phoneGroups[phone] = [];
      phoneGroups[phone].push(v);
    }
    const name = normalizeCompanyName(v.companyName);
    if (name) {
      if (!nameGroups[name]) nameGroups[name] = [];
      nameGroups[name].push(v);
    }
  });

  const groups = [];
  Object.values(phoneGroups).forEach((g) => {
    if (g.length > 1) groups.push({ reason: "phone", customers: g });
  });
  Object.values(nameGroups).forEach((g) => {
    if (g.length > 1) groups.push({ reason: "name", customers: g });
  });
  return groups;
}

// The most recent moment of any recorded activity on a customer: a visit,
// a scheduled call, a logged activity entry, or the record's creation.
export function lastActivityDate(visit) {
  const dates = [];
  const vd = parseVisitDate(visit.visitDate);
  if (vd) dates.push(vd);
  if (visit.callDateTime) {
    const cd = new Date(visit.callDateTime);
    if (!isNaN(cd)) dates.push(cd);
  }
  (visit.activityLog || []).forEach((entry) => {
    if (entry.at) {
      const d = new Date(entry.at);
      if (!isNaN(d)) dates.push(d);
    }
  });
  const created = toJsDate(visit.createdAt);
  if (created) dates.push(created);
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates.map((d) => d.getTime())));
}

// True if a customer has had no recorded activity in over `days` days
// (or never had any activity at all).
export function isStaleCustomer(visit, days) {
  const last = lastActivityDate(visit);
  if (!last) return true;
  const diffDays = (Date.now() - last.getTime()) / (1000 * 3600 * 24);
  return diffDays > days;
}

export const emptyForm = {
  id: null,
  companyName: "",
  contactName: "",
  sector: "",
  role: "purchasing",
  stage: "",
  tagsInput: "",
  phone: "",
  email: "",
  visitDate: "",
  notes: "",
  callDateTime: "",
  notified: false,
  activityLog: [],
  offers: [],
  visitHistory: [],
  isPinned: false,
};

export const emptySupplierForm = {
  id: null,
  name: "",
  contactName: "",
  phone: "",
  email: "",
  category: "",
  tagsInput: "",
  notes: "",
  isPinned: false,
};

export const OWNER_EMAIL = "qzizop@gmail.com"; // ضع إيميلك هنا بدقة
