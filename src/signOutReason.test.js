import { describe, it, expect, beforeEach } from "vitest";
import { rememberSignOutReason, consumeSignOutReason } from "./signOutReason";

beforeEach(() => sessionStorage.clear());

describe("signOutReason", () => {
  it("returns false when nothing was remembered", () => {
    expect(consumeSignOutReason()).toBe(false);
  });

  it("round-trips `true` and string reasons, and forgets them once read", () => {
    rememberSignOutReason(true);
    expect(consumeSignOutReason()).toBe(true);
    expect(consumeSignOutReason()).toBe(false);

    rememberSignOutReason("unverified");
    expect(consumeSignOutReason()).toBe("unverified");
    expect(consumeSignOutReason()).toBe(false);
  });

  it("ignores an empty reason (a plain manual sign-out shows no message)", () => {
    rememberSignOutReason(undefined);
    rememberSignOutReason(false);
    expect(consumeSignOutReason()).toBe(false);
  });
});
