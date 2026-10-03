// ============================================================================
// Phone-number helpers shared by the WhatsApp buttons and the duplicate-phone
// detection. Free of React / Firebase so it is easy to unit-test.
//
// Two problems this fixes:
//  1. Numbers are typed the way people write them locally ("01012345678"),
//     but wa.me needs the full international form ("201012345678"). Without
//     the country code the link points at a number that does not exist.
//  2. Arabic keyboards type Arabic-Indic digits ("٠١٠١٢٣٤٥٦٧٨"). A plain
//     /\D/ strip treats them as non-digits and wipes the whole number, so the
//     WhatsApp button did nothing and duplicate detection never matched.
// ============================================================================

// Country code assumed for numbers written in local format (leading 0).
export const DEFAULT_COUNTRY_CODE = "20"; // Egypt

// Arabic-Indic (U+0660–0669) and Eastern/Persian (U+06F0–06F9) digits -> 0-9.
export function toAsciiDigits(value) {
  return String(value ?? "").replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (ch) => {
    const code = ch.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

// Digits only, after converting Arabic-Indic digits.
export function digitsOnly(value) {
  return toAsciiDigits(value).replace(/\D/g, "");
}

// The number in the international form wa.me expects (digits only, country
// code first, no "+" / "00" / leading 0). Returns "" when there is no number.
//   "+20 101 234 5678" -> "201012345678"   (already international)
//   "0020 101 234 5678" -> "201012345678"  ("00" is the international prefix)
//   "01012345678"       -> "201012345678"  (local format: leading 0 -> 20)
//   "1012345678"        -> "201012345678"  (mobile typed without the 0)
//   "٠١٠١٢٣٤٥٦٧٨"       -> "201012345678" (same as the ASCII form)
//   "+20 (0) 101 234 5678" -> "201012345678" (the optional "(0)" is dropped)
// Any other international number typed without a "+" is passed through.
export function toWhatsAppDigits(phone, countryCode = DEFAULT_COUNTRY_CODE) {
  const ascii = toAsciiDigits(phone).trim();
  let d = ascii.replace(/\D/g, "");
  if (!d) return "";

  const hasPlus = ascii.startsWith("+");
  if (d.startsWith("00")) return stripTrunkZero(d.slice(2), countryCode);
  if (hasPlus) return stripTrunkZero(d, countryCode);
  if (d.startsWith("0")) return countryCode + d.slice(1);
  if (d.startsWith(countryCode) && d.length >= 11) return stripTrunkZero(d, countryCode);
  // Egyptian mobile numbers are 10 digits starting with 1 once the 0 is gone.
  if (countryCode === "20" && d.length === 10 && d.startsWith("1")) return countryCode + d;
  return d;
}

// "+20 (0) 10..." is written by some people with the local 0 kept after the
// country code; it must not be part of the number.
function stripTrunkZero(d, countryCode) {
  if (d.startsWith(countryCode + "0") && d.length === countryCode.length + 11) {
    return countryCode + d.slice(countryCode.length + 1);
  }
  return d;
}

// Normalizes a phone number to its core digits, ignoring +2 / 0020 / leading 0
// variations (used to compare two numbers, never to dial one).
export function corePhoneDigits(phone) {
  let d = digitsOnly(phone);
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("20") && d.length > 10) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  return d;
}
