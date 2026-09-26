// ============================================================================
// Excel export/import safety helpers.
//
// Background: the export used to guard against "formula injection" by
// prefixing any text that starts with = + - @ (or a tab/CR) with a straight
// quote. That protection belongs to CSV, where every cell is re-parsed as
// typed input when the file is opened. In an .xlsx written by SheetJS, a JS
// string becomes a *string cell* — Excel never evaluates it as a formula —
// and the quote is stored literally, so it shows up on screen. The visible
// casualty was the phone column: Egyptian numbers written as "+20…" came out
// as "'+20…". And because the import didn't strip it, an export → import
// round trip saved "'+20…" as the customer's phone.
//
// What this module does instead:
//   - neutralizeFormulas(): guarantees every string cell in a worksheet is a
//     plain string cell with no formula attached (the actual protection), and
//     leaves the visible text untouched.
//   - stripFormulaGuard(): on import, removes the leading quote the OLD
//     exporter added, so files exported by earlier versions load cleanly.
// ============================================================================

const FORMULA_LEADERS = /^'(?=[=+\-@\t\r])/;

// Removes the leading apostrophe that earlier versions of the exporter put in
// front of text starting with = + - @ tab CR. Anything else — including a
// legitimate apostrophe elsewhere, or before a normal character — is
// returned unchanged. Non-strings pass through.
export function stripFormulaGuard(value) {
  if (typeof value !== "string") return value;
  return value.replace(FORMULA_LEADERS, "");
}

// Forces every string cell of a SheetJS worksheet to be a plain string cell
// (t: "s") with no formula (f). Mutates and returns the worksheet. Keys that
// start with "!" (!ref, !cols, !merges…) are worksheet metadata, not cells.
export function neutralizeFormulas(ws) {
  if (!ws) return ws;
  for (const addr of Object.keys(ws)) {
    if (addr[0] === "!") continue;
    const cell = ws[addr];
    if (cell && typeof cell.v === "string") {
      cell.t = "s";
      delete cell.f;
    }
  }
  return ws;
}
