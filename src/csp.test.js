import { describe, it, expect } from "vitest";
import { buildCsp, sentryOriginFromDsn, EMULATOR_ORIGINS } from "../scripts/buildCsp.mjs";

// Splits "a 1; b 2" into { a: "1", b: "2" } so tests can assert on one
// directive without being thrown by the order or by other directives.
function directives(csp) {
  return Object.fromEntries(
    csp.split(";").map((d) => {
      const [name, ...values] = d.trim().split(/\s+/);
      return [name, values.join(" ")];
    }),
  );
}

describe("buildCsp", () => {
  it("only lets scripts come from the app's own bundle", () => {
    const d = directives(buildCsp());
    expect(d["script-src"]).toBe("'self'");
    expect(d["default-src"]).toBe("'self'");
  });

  it("never allows inline or eval'd script anywhere", () => {
    const csp = buildCsp({ sentryDsn: "https://k@o1.ingest.sentry.io/2", useEmulator: true });
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-(inline|eval)'/);
    expect(csp).not.toMatch(/default-src[^;]*'unsafe-(inline|eval)'/);
  });

  it("closes plugin, <base> and cross-origin form-post injection routes", () => {
    const d = directives(buildCsp());
    expect(d["object-src"]).toBe("'none'");
    expect(d["base-uri"]).toBe("'self'");
    expect(d["form-action"]).toBe("'self'");
  });

  it("allows what the app genuinely needs: Firebase, the connectivity probe and Google Fonts", () => {
    const d = directives(buildCsp());
    expect(d["connect-src"]).toContain("https://*.googleapis.com");
    expect(d["connect-src"]).toContain("https://www.gstatic.com");
    expect(d["style-src"]).toContain("https://fonts.googleapis.com");
    expect(d["font-src"]).toContain("https://fonts.gstatic.com");
    expect(d["img-src"]).toContain("data:");
  });

  it("adds the Sentry origin only when a valid DSN is set", () => {
    const withDsn = directives(buildCsp({ sentryDsn: "https://abc@o456.ingest.de.sentry.io/789" }));
    expect(withDsn["connect-src"]).toContain("https://o456.ingest.de.sentry.io");
    const without = directives(buildCsp({ sentryDsn: "" }));
    expect(without["connect-src"]).not.toContain("sentry");
  });

  it("allows the local Firebase emulators only in the e2e build", () => {
    const normal = directives(buildCsp())["connect-src"];
    for (const origin of EMULATOR_ORIGINS) expect(normal).not.toContain(origin);
    const e2e = directives(buildCsp({ useEmulator: true }))["connect-src"];
    for (const origin of EMULATOR_ORIGINS) expect(e2e).toContain(origin);
  });
});

describe("sentryOriginFromDsn", () => {
  it("keeps only scheme + host (never the key or project path)", () => {
    expect(sentryOriginFromDsn("https://abc123@o456.ingest.us.sentry.io/789")).toBe(
      "https://o456.ingest.us.sentry.io",
    );
  });

  it("returns null for empty, malformed or non-http values instead of throwing", () => {
    expect(sentryOriginFromDsn("")).toBeNull();
    expect(sentryOriginFromDsn(undefined)).toBeNull();
    expect(sentryOriginFromDsn("not a dsn")).toBeNull();
    expect(sentryOriginFromDsn("ftp://k@host/1")).toBeNull();
  });
});
