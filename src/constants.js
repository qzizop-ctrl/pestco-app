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
    appTitle: "Pest.Co — بيانات العملاء",
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
    visitDateLabel: "تاريخ الزيارة",
    visitDateHint: "اسيبه فاضي لو لسه ما حصلتش الزيارة، وحددّه بس لما تكون فعلاً زرت العميل.",
    noVisitYet: "لسه ما حصلتش زيارة",
    dateAddedRow: "تاريخ إضافة العميل",

    // Missing-data filter
    missingDataFilter: "بيانات ناقصة",
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
    staleBadge: "محتاج مراجعة",
    staleHint: (days) => `مفيش أي نشاط من ${days} يوم`,

    // Today's customers
    todaysCustomersTitle: "عملاء اليوم",
    noTodaysCustomers: "مفيش عملاء مجدولين النهاردة",

    // Pin / favorite
    pinBtn: "تثبيت",
    unpinBtn: "إلغاء التثبيت",
    pinnedLabel: "مثبّت",
    callDateLabel: "موعد المتابعة القادم (اختياري)",
    callDateHint: "في نسخة الأندرويد: التطبيق هيبعتلك تنبيه حقيقي في المعاد ده حتى لو التطبيق مقفول. في نسخة المتصفح: لازم التطبيق يكون شغال.",
    notesLabel: "ملاحظات الزيارة",
    notesPlaceholder: "تفاصيل الزيارة، المطلوب متابعته، إلخ",
    save: "حفظ العميل",
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
    sectorLabel: "القطاع",
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
    removeConfirm: "هل تريد إلغاء صلاحية هذا الشخص؟",
    statusOverdue: "متأخرة",
    statusToday: "اليوم",
    statusUpcoming: "قادمة",
    statusNone: "بدون موعد",
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
    dashNewCustomersLabel: "عملاء جداد",

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
    supplierCategoryLabel: "نوع البضاعة / الخدمة",
    supplierCategoryPlaceholder: "مثال: كاميرات مراقبة، كابلات، أجهزة إنذار",
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
    activityOfferAdded: (name) => `تم إضافة أوفر جديد: ${name}`,
    activityOfferStatus: (name, status) => `تم تغيير حالة الأوفر "${name}" إلى: ${status}`,

    // Dashboard
    dashYear: "السنة",
    dashMonth: "الشهر",
    dashAllMonths: "كل الشهور",
    dashSector: "القطاع",
    dashAllSectors: "كل القطاعات",
    dashCardVisits: "إجمالي الزيارات",
    dashCardOffersCount: "عدد الأوفرات",
    dashCardOffersValue: "إجمالي قيمة الأوفرات",
    dashVisitsPerformance: "أداء الزيارات",
    dashOffersSection: "الأوفرات",
    dashOffersTotalLabel: "عدد الأوفرات",
    dashOffersTotalValueLabel: "إجمالي قيمة الأوفرات",
    dashPipeline: "مسار المبيعات (Pipeline)",
    dashSalesPerformance: "أداء المبيعات",
    dashCompareToggle: "مقارنة بالشهر السابق",
    dashNoComparisonData: "لا توجد بيانات للمقارنة",
    dashNoVisitsInPeriod: "لا توجد زيارات خلال هذه الفترة",
    dashOfferFilterAll: "الكل",
    dashLastVisit: "آخر زيارة:",
    dashCurrency: "جنيه",
    currencies: { EGP: "جنيه", USD: "دولار" },
    currencyLabel: "العملة",
    months: [
      "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
      "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
    ],
  },
  en: {
    dir: "ltr",
    locale: "en-US",
    appTitle: "Pest.Co — Client Data",
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
    visitDateLabel: "Visit Date",
    visitDateHint: "Leave this empty if the visit hasn't happened yet — only set it once you've actually visited the customer.",
    noVisitYet: "No visit yet",
    dateAddedRow: "Date Added",

    // Missing-data filter
    missingDataFilter: "Missing Data",
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

    // Today's customers
    todaysCustomersTitle: "Today's Customers",
    noTodaysCustomers: "No customers scheduled today",

    // Pin / favorite
    pinBtn: "Pin",
    unpinBtn: "Unpin",
    pinnedLabel: "Pinned",
    callDateLabel: "Next Follow-up Date (optional)",
    callDateHint: "On the Android app: you'll get a real alert at this time even if the app is closed. On the web version: the app needs to be open.",
    notesLabel: "Visit Notes",
    notesPlaceholder: "Visit details, follow-ups needed, etc.",
    save: "Save Customer",
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
    sectorLabel: "Sector",
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
    dashNewCustomersLabel: "New Customers",

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
    saveSupplier: "Save Supplier",
    supplierCategoryLabel: "Goods / Service Type",
    supplierCategoryPlaceholder: "e.g. CCTV cameras, cabling, alarm systems",
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
    activityOfferAdded: (name) => `New offer added: ${name}`,
    activityOfferStatus: (name, status) => `Offer "${name}" status changed to: ${status}`,

    // Dashboard
    dashYear: "Year",
    dashMonth: "Month",
    dashAllMonths: "All Months",
    dashSector: "Sector",
    dashAllSectors: "All Sectors",
    dashCardVisits: "Total Visits",
    dashCardOffersCount: "Offers",
    dashCardOffersValue: "Total Offers Value",
    dashVisitsPerformance: "Visits Performance",
    dashOffersSection: "Offers",
    dashOffersTotalLabel: "Offers",
    dashOffersTotalValueLabel: "Total Offers Value",
    dashPipeline: "Sales Pipeline",
    dashSalesPerformance: "Sales Performance",
    dashCompareToggle: "Compare to previous month",
    dashNoComparisonData: "No comparison data available",
    dashNoVisitsInPeriod: "No visits during this period",
    dashOfferFilterAll: "All",
    dashLastVisit: "Last visit:",
    dashCurrency: "EGP",
    currencies: { EGP: "EGP", USD: "USD" },
    currencyLabel: "Currency",
    months: [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ],
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
export function buildVisitEntry(date) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: date || new Date().toISOString().slice(0, 10),
    at: new Date().toISOString(),
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
export function buildOffer({ name, offerNumber, amount, offerDate, status, currency }) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name || "",
    offerNumber: offerNumber || "",
    amount: Number(amount) || 0,
    currency: CURRENCY_IDS.includes(currency) ? currency : "EGP",
    offerDate: offerDate || "",
    status: status || "pending",
    rejectionReason: "",
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
// with a zero total; returns "" if everything is zero.
export function fmtOffersTotals(totals, t) {
  return CURRENCY_IDS
    .filter((id) => totals[id])
    .map((id) => `${fmtMoney(totals[id], t.locale)} ${t.currencies[id]}`)
    .join(" + ");
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
    return d.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
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
    return d.toLocaleString(locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return "";
  }
}

export function fmtActivityDate(dt, locale) {
  try {
    const d = new Date(dt);
    return d.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return dt;
  }
}

export function fmtMoney(n, locale) {
  try {
    return Number(n || 0).toLocaleString(locale);
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
  sector: "construction",
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
  phone: "",
  category: "",
  tagsInput: "",
  notes: "",
};
