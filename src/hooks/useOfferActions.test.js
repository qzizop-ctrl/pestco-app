import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { STRINGS } from "../i18n";

// Firestore is mocked. `tx` stands in for a transaction: get() returns the
// "server copy" of the visit (set per test), update() records what would be
// written back. That lets these tests check the property the hook exists to
// guarantee: a change to ONE offer is applied to the latest server copy of
// the offers array, never to a stale local snapshot.
const mocks = vi.hoisted(() => {
  const tx = { get: vi.fn(), update: vi.fn() };
  return {
    tx,
    updateDoc: vi.fn(() => Promise.resolve()),
    doc: vi.fn((...args) => ({ path: args.slice(1).join("/") })),
    arrayUnion: vi.fn((...items) => ({ __arrayUnion: items })),
    runTransaction: vi.fn(async (_db, fn) => fn(tx)),
  };
});

vi.mock("firebase/firestore", () => ({
  doc: mocks.doc,
  updateDoc: mocks.updateDoc,
  arrayUnion: mocks.arrayUnion,
  runTransaction: mocks.runTransaction,
}));
vi.mock("../firebase", () => ({ db: {} }));

import { useOfferActions } from "./useOfferActions";

const t = STRINGS.en;
const visit = { id: "v1", companyName: "Acme" };

const serverCopy = (offers) => ({ exists: () => true, data: () => ({ offers }) });

function makeProps(overrides = {}) {
  return {
    ownerUid: "owner1",
    user: { uid: "u1", displayName: "Sara", email: "sara@example.com" },
    canEdit: true,
    requireOnline: vi.fn(() => true),
    confirmAction: vi.fn((_message, onConfirm) => onConfirm()),
    setRejectionPrompt: vi.fn(),
    appendActivity: vi.fn(() => Promise.resolve()),
    reportSaveError: vi.fn(),
    t,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tx.get.mockResolvedValue(serverCopy([]));
});

// Fills the new-offer form through the hook's own setter.
function fillNewOffer(result, fields) {
  act(() => {
    result.current.setNewOffer({ ...result.current.newOffer, ...fields });
  });
}

describe("useOfferActions — addOffer", () => {
  it("appends the offer with arrayUnion, logs activity, and resets the form", async () => {
    const props = makeProps();
    const { result } = renderHook(() => useOfferActions(props));
    fillNewOffer(result, { name: "Spray contract", amount: "2500", currency: "USD" });

    await act(async () => {
      await result.current.addOffer(visit);
    });

    expect(mocks.updateDoc).toHaveBeenCalledTimes(1);
    const [ref, payload] = mocks.updateDoc.mock.calls[0];
    expect(ref.path).toBe("users/owner1/visits/v1");
    const saved = payload.offers.__arrayUnion[0];
    expect(saved).toMatchObject({ name: "Spray contract", amount: 2500, currency: "USD", status: "pending" });
    expect(props.appendActivity).toHaveBeenCalledWith(
      "v1",
      expect.objectContaining({ type: "offer", text: t.activityOfferAdded("Spray contract") })
    );
    expect(result.current.newOffer.name).toBe("");
  });

  it("does nothing when the offer has no name", async () => {
    const props = makeProps();
    const { result } = renderHook(() => useOfferActions(props));
    fillNewOffer(result, { name: "   " });

    await act(async () => {
      await result.current.addOffer(visit);
    });

    expect(mocks.updateDoc).not.toHaveBeenCalled();
    expect(props.appendActivity).not.toHaveBeenCalled();
  });

  it("asks for a rejection reason first, and saves it with the offer once confirmed", async () => {
    const props = makeProps();
    const { result } = renderHook(() => useOfferActions(props));
    fillNewOffer(result, { name: "Lost deal", status: "rejected" });

    await act(async () => {
      await result.current.addOffer(visit);
    });

    // Nothing is written until the person picks a reason.
    expect(props.setRejectionPrompt).toHaveBeenCalledTimes(1);
    expect(mocks.updateDoc).not.toHaveBeenCalled();

    const prompt = props.setRejectionPrompt.mock.calls[0][0];
    await act(async () => {
      await prompt.onConfirm({ reasonId: "price", label: "Price too high" });
    });

    const saved = mocks.updateDoc.mock.calls[0][1].offers.__arrayUnion[0];
    expect(saved.status).toBe("rejected");
    expect(saved.rejectionReason).toBe("Price too high");
    expect(saved.rejectionReasonId).toBe("price");
    expect(saved.rejectedBy).toBe("Sara");
    expect(saved.rejectedById).toBe("u1");
  });

  it("reports the error instead of logging activity when the write fails", async () => {
    mocks.updateDoc.mockRejectedValueOnce(new Error("permission-denied"));
    const props = makeProps();
    const { result } = renderHook(() => useOfferActions(props));
    fillNewOffer(result, { name: "Offer" });

    await act(async () => {
      await result.current.addOffer(visit);
    });

    expect(props.reportSaveError).toHaveBeenCalledTimes(1);
    expect(props.appendActivity).not.toHaveBeenCalled();
  });
});

describe("useOfferActions — updateOfferStatus", () => {
  const mine = { id: "o1", name: "Mine", status: "pending" };
  const theirs = { id: "o2", name: "Added by a teammate meanwhile", status: "pending" };

  it("applies the change to the LATEST server copy, keeping a teammate's concurrent offer", async () => {
    // The local snapshot only knows about o1; the server already has o2 too.
    mocks.tx.get.mockResolvedValue(serverCopy([mine, theirs]));
    const props = makeProps();
    const { result } = renderHook(() => useOfferActions(props));

    await act(async () => {
      await result.current.updateOfferStatus(visit, mine, "purchased");
    });

    expect(mocks.tx.update).toHaveBeenCalledTimes(1);
    const written = mocks.tx.update.mock.calls[0][1].offers;
    expect(written.map((o) => o.id)).toEqual(["o1", "o2"]); // o2 survived
    expect(written[0].status).toBe("purchased");
    expect(written[1]).toEqual(theirs); // untouched
    expect(props.appendActivity).toHaveBeenCalledWith(
      "v1",
      expect.objectContaining({ type: "offer" })
    );
  });

  it("does nothing when the status did not change", async () => {
    const props = makeProps();
    const { result } = renderHook(() => useOfferActions(props));
    await act(async () => {
      await result.current.updateOfferStatus(visit, mine, "pending");
    });
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });

  it("asks for a reason before rejecting, then stamps who/when/why", async () => {
    mocks.tx.get.mockResolvedValue(serverCopy([mine]));
    const props = makeProps();
    const { result } = renderHook(() => useOfferActions(props));

    await act(async () => {
      await result.current.updateOfferStatus(visit, mine, "rejected");
    });
    expect(props.setRejectionPrompt).toHaveBeenCalledTimes(1);
    expect(mocks.runTransaction).not.toHaveBeenCalled();

    const prompt = props.setRejectionPrompt.mock.calls[0][0];
    await act(async () => {
      await prompt.onConfirm({ reasonId: "timing", label: "Bad timing" });
    });

    const [rejected] = mocks.tx.update.mock.calls[0][1].offers;
    expect(rejected).toMatchObject({
      status: "rejected",
      rejectionReasonId: "timing",
      rejectionReason: "Bad timing",
      rejectedBy: "Sara",
      rejectedById: "u1",
    });
    expect(typeof rejected.rejectedAt).toBe("string");
  });

  it("clears the rejection details when a rejected offer is re-opened", async () => {
    const rejectedOffer = {
      id: "o1", name: "Mine", status: "rejected",
      rejectionReason: "Price", rejectionReasonId: "price", rejectedBy: "Sara", rejectedById: "u1", rejectedAt: "x",
    };
    mocks.tx.get.mockResolvedValue(serverCopy([rejectedOffer]));
    const props = makeProps();
    const { result } = renderHook(() => useOfferActions(props));

    await act(async () => {
      await result.current.updateOfferStatus(visit, rejectedOffer, "pending");
    });

    const [reopened] = mocks.tx.update.mock.calls[0][1].offers;
    expect(reopened.status).toBe("pending");
    expect(reopened.rejectionReason).toBe("");
    expect(reopened.rejectionReasonId).toBe("");
    expect(reopened.rejectedById).toBeNull();
  });

  it("reports an error when the customer no longer exists", async () => {
    mocks.tx.get.mockResolvedValue({ exists: () => false, data: () => undefined });
    const props = makeProps();
    const { result } = renderHook(() => useOfferActions(props));

    await act(async () => {
      await result.current.updateOfferStatus(visit, mine, "purchased");
    });

    expect(props.reportSaveError).toHaveBeenCalledTimes(1);
    expect(mocks.tx.update).not.toHaveBeenCalled();
  });
});

describe("useOfferActions — deleteOffer", () => {
  it("asks for confirmation, then removes only that offer from the latest server copy", async () => {
    const a = { id: "o1", name: "A" };
    const b = { id: "o2", name: "B" };
    mocks.tx.get.mockResolvedValue(serverCopy([a, b]));
    const props = makeProps();
    const { result } = renderHook(() => useOfferActions(props));

    act(() => {
      result.current.deleteOffer(visit, a);
    });

    expect(props.confirmAction).toHaveBeenCalledWith(t.deleteOfferConfirm, expect.any(Function), { danger: true });
    await waitFor(() => expect(mocks.tx.update).toHaveBeenCalledTimes(1));
    expect(mocks.tx.update.mock.calls[0][1].offers).toEqual([b]);
  });

  it("does not delete when the confirmation is declined", () => {
    const props = makeProps({ confirmAction: vi.fn() }); // never calls the callback
    const { result } = renderHook(() => useOfferActions(props));
    act(() => {
      result.current.deleteOffer(visit, { id: "o1" });
    });
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });
});

describe("useOfferActions — permissions and connectivity", () => {
  it("a viewer (canEdit: false) can't write anything", async () => {
    const props = makeProps({ canEdit: false });
    const { result } = renderHook(() => useOfferActions(props));
    fillNewOffer(result, { name: "Offer" });

    await act(async () => {
      await result.current.addOffer(visit);
      await result.current.updateOfferStatus(visit, { id: "o1", status: "pending" }, "purchased");
      result.current.deleteOffer(visit, { id: "o1" });
    });

    expect(mocks.updateDoc).not.toHaveBeenCalled();
    expect(mocks.runTransaction).not.toHaveBeenCalled();
    expect(props.confirmAction).not.toHaveBeenCalled();
  });

  it("does not write while offline", async () => {
    const props = makeProps({ requireOnline: vi.fn(() => false) });
    const { result } = renderHook(() => useOfferActions(props));
    fillNewOffer(result, { name: "Offer" });

    await act(async () => {
      await result.current.addOffer(visit);
      await result.current.updateOfferStatus(visit, { id: "o1", status: "pending" }, "purchased");
    });

    expect(mocks.updateDoc).not.toHaveBeenCalled();
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });
});
