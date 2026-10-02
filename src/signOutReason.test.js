import { describe, it, expect, beforeEach } from "vitest";
import { rememberSignOutReason, consumeSignOutReason } from "./signOutReason";

beforeEach(() => sessionStorage.clear());

describe("signOutReason", () => {
  it("returns an empty string when nothing was remembered", () => {
    expect(consumeSignOutReason()).toBe("");
  });

  it("round-trips `true` (as \"no-access\") and string reasons, and forgets them once read", () => {
    rememberSignOutReason(true);
    expect(consumeSignOutReason()).toBe("no-access");
    expect(consumeSignOutReason()).toBe("");

    rememberSignOutReason("unverified");
    expect(consumeSignOutReason()).toBe("unverified");
    expect(consumeSignOutReason()).toBe("");
  });

  it("ignores an empty reason (a plain manual sign-out shows no message)", () => {
    rememberSignOutReason(undefined);
    rememberSignOutReason(false);
    expect(consumeSignOutReason()).toBe("");
  });
});
