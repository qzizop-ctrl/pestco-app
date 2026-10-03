import { describe, it, expect } from "vitest";
import { toAsciiDigits, digitsOnly, toWhatsAppDigits, corePhoneDigits } from "./phone";
import { buildWhatsAppLink } from "./tagsAndLinks";

describe("toAsciiDigits / digitsOnly", () => {
  it("converts Arabic-Indic and Persian digits", () => {
    expect(toAsciiDigits("٠١٠١٢٣٤٥٦٧٨")).toBe("01012345678");
    expect(toAsciiDigits("۰۱۰۱۲۳۴۵۶۷۸")).toBe("01012345678");
    expect(digitsOnly("٠١٠ ١٢٣-٤٥٦٧٨")).toBe("01012345678");
  });
  it("handles empty / nullish input", () => {
    expect(digitsOnly(undefined)).toBe("");
    expect(digitsOnly(null)).toBe("");
    expect(digitsOnly("")).toBe("");
  });
});

describe("toWhatsAppDigits", () => {
  it("turns a local number (leading 0) into the international form", () => {
    expect(toWhatsAppDigits("01012345678")).toBe("201012345678");
    expect(toWhatsAppDigits("010 1234 5678")).toBe("201012345678");
  });
  it("keeps numbers that are already international", () => {
    expect(toWhatsAppDigits("+201012345678")).toBe("201012345678");
    expect(toWhatsAppDigits("+20 101 234 5678")).toBe("201012345678");
    expect(toWhatsAppDigits("201012345678")).toBe("201012345678");
    expect(toWhatsAppDigits("00201012345678")).toBe("201012345678");
  });
  it("accepts a mobile typed without its leading 0", () => {
    expect(toWhatsAppDigits("1012345678")).toBe("201012345678");
  });
  it("drops the optional (0) after the country code", () => {
    expect(toWhatsAppDigits("+20 (0) 101 234 5678")).toBe("201012345678");
  });
  it("understands Arabic-Indic digits", () => {
    expect(toWhatsAppDigits("٠١٠١٢٣٤٥٦٧٨")).toBe("201012345678");
    expect(toWhatsAppDigits("+٢٠ ١٠١ ٢٣٤ ٥٦٧٨")).toBe("201012345678");
  });
  it("leaves other countries' numbers alone when they carry a + or 00", () => {
    expect(toWhatsAppDigits("+966 50 123 4567")).toBe("966501234567");
    expect(toWhatsAppDigits("00966501234567")).toBe("966501234567");
  });
  it("returns an empty string when there is no number", () => {
    expect(toWhatsAppDigits("")).toBe("");
    expect(toWhatsAppDigits("abc")).toBe("");
    expect(toWhatsAppDigits(undefined)).toBe("");
  });
});

describe("corePhoneDigits", () => {
  it("matches the same number written differently", () => {
    const variants = ["01012345678", "+20 101 234 5678", "0020 101 234 5678", "201012345678", "٠١٠١٢٣٤٥٦٧٨"];
    variants.forEach((v) => expect(corePhoneDigits(v)).toBe("1012345678"));
  });
});

describe("buildWhatsAppLink", () => {
  it("builds a working wa.me link from a local number", () => {
    expect(buildWhatsAppLink("01012345678")).toBe("https://wa.me/201012345678");
    expect(buildWhatsAppLink("٠١٠١٢٣٤٥٦٧٨")).toBe("https://wa.me/201012345678");
  });
});
