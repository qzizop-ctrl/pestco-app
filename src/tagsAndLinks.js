// ============================================================================
// Tag parsing/collection for suppliers, and the plain WhatsApp link builder.
// Split out of the old helpers.js.
// ============================================================================

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

// Plain wa.me link, used as the <a href> so the button stays a real,
// right-clickable/shareable link. On Android the actual click is instead
// routed through openWhatsApp() in src/nativeWhatsApp.js, which opens
// WhatsApp Business directly via a native Android Intent — a WebView has no
// way to target one specific app from a link string alone (an "intent://"
// URL looks like it should work, but Capacitor's WebView doesn't parse that
// special Chrome-only syntax, so it silently does nothing).
export function buildWhatsAppLink(phone) {
  const digits = (phone || "").replace(/[^0-9]/g, "");
  return `https://wa.me/${digits}`;
}
