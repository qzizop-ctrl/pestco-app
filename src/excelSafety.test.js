import { describe, it, expect } from "vitest";
import { stripFormulaGuard, neutralizeFormulas } from "./excelSafety";

describe("stripFormulaGuard (import side)", () => {
  it("removes the apostrophe the old exporter put before = + - @", () => {
    expect(stripFormulaGuard("'+201012345678")).toBe("+201012345678");
    expect(stripFormulaGuard("'=SUM(A1)")).toBe("=SUM(A1)");
    expect(stripFormulaGuard("'-follow up")).toBe("-follow up");
    expect(stripFormulaGuard("'@team")).toBe("@team");
  });

  it("leaves every other apostrophe alone", () => {
    expect(stripFormulaGuard("'hello")).toBe("'hello");
    expect(stripFormulaGuard("O'Brien")).toBe("O'Brien");
    expect(stripFormulaGuard("+201012345678")).toBe("+201012345678");
  });

  it("passes non-strings through untouched", () => {
    expect(stripFormulaGuard(42)).toBe(42);
    expect(stripFormulaGuard(null)).toBeNull();
    expect(stripFormulaGuard(undefined)).toBeUndefined();
    const d = new Date("2026-01-01");
    expect(stripFormulaGuard(d)).toBe(d);
  });
});

describe("neutralizeFormulas (export side)", () => {
  it("keeps text exactly as typed and forces it to a plain string cell", () => {
    const ws = {
      "!ref": "A1:A2",
      A1: { t: "s", v: "Phone" },
      A2: { t: "s", v: "+201012345678" },
    };
    neutralizeFormulas(ws);
    expect(ws.A2.v).toBe("+201012345678"); // no leading apostrophe
    expect(ws.A2.t).toBe("s");
  });

  it("drops any formula attached to a string cell", () => {
    const ws = { A1: { t: "s", v: "=HYPERLINK(\"http://evil\")", f: "HYPERLINK(1)" } };
    neutralizeFormulas(ws);
    expect(ws.A1.f).toBeUndefined();
    expect(ws.A1.t).toBe("s");
    expect(ws.A1.v).toBe("=HYPERLINK(\"http://evil\")");
  });

  it("does not touch numbers or worksheet metadata", () => {
    const ws = { "!ref": "A1:A1", A1: { t: "n", v: 5 } };
    neutralizeFormulas(ws);
    expect(ws["!ref"]).toBe("A1:A1");
    expect(ws.A1).toEqual({ t: "n", v: 5 });
  });

  it("tolerates a missing worksheet", () => {
    expect(neutralizeFormulas(null)).toBeNull();
  });
});
