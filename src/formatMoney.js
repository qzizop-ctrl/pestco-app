// ============================================================================
// Money formatting. Split out of the old helpers.js into its own file since
// it's used from almost every other module (offers, dashboard, PDF export).
// ============================================================================

// Inserts a comma every three digits, counting from the right. A plain loop
// instead of the usual /\B(?=(\d{3})+(?!\d))/g regex, which backtracks
// super-linearly on long digit strings. Anything that is not purely digits
// (e.g. exponent notation like "1e+21") is returned untouched, as before.
function groupThousands(intPart) {
  if (!/^\d+$/.test(intPart)) return intPart;
  let out = "";
  for (let i = 0; i < intPart.length; i++) {
    if (i > 0 && (intPart.length - i) % 3 === 0) out += ",";
    out += intPart[i];
  }
  return out;
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
export function fmtMoney(n, _locale) {
  try {
    let num = Number(n);
    if (!Number.isFinite(num)) num = 0;
    const negative = num < 0;
    num = Math.abs(num);
    // Match toLocaleString's default rounding (up to 3 fraction digits).
    num = Math.round(num * 1000) / 1000;
    const [intPart, decPart] = num.toString().split(".");
    const withThousands = groupThousands(intPart);
    return (negative ? "-" : "") + withThousands + (decPart ? "." + decPart : "");
  } catch {
    return String(n || 0);
  }
}
