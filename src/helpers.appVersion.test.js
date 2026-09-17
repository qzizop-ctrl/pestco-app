import { describe, it, expect } from "vitest";
import { compareVersions } from "./helpers";

// Backs useAppVersionGate.js's decision to block an old build — a wrong
// answer here either locks everyone out (false positive) or never gates a
// build that should have been retired (false negative), so it's worth
// pinning the comparison logic directly.

describe("compareVersions", () => {
  it("treats equal versions as equal", () => {
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
  });

  it("compares the major part first", () => {
    expect(compareVersions("2.0.0", "1.9.9")).toBe(1);
    expect(compareVersions("1.9.9", "2.0.0")).toBe(-1);
  });

  it("does not compare parts as strings (1.10.0 > 1.9.0)", () => {
    expect(compareVersions("1.10.0", "1.9.0")).toBe(1);
    expect(compareVersions("1.9.0", "1.10.0")).toBe(-1);
  });

  it("treats a missing part as 0", () => {
    expect(compareVersions("1.2", "1.2.0")).toBe(0);
    expect(compareVersions("1.2.1", "1.2")).toBe(1);
    expect(compareVersions("1.2", "1.2.1")).toBe(-1);
  });

  it("treats a non-numeric or empty input as all-zero", () => {
    expect(compareVersions("", "0.0.1")).toBe(-1);
    expect(compareVersions(undefined, "0.0.0")).toBe(0);
  });
});
