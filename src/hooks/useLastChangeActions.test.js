import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// The owner's review steps (approve / rollback / confirm delete / restore) run
// inside a Firestore transaction that re-reads the record and compares its
// stored last_change with the one the owner was looking at. Firestore is
// mocked: runTransaction hands the callback a fake `tx` over a fake snapshot,
// so each test decides what is "currently stored" and checks what was written.
const mocks = vi.hoisted(() => ({
  runTransaction: vi.fn(),
  deleteField: vi.fn(() => "DELETE_FIELD"),
  reportException: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  runTransaction: mocks.runTransaction,
  deleteField: mocks.deleteField,
}));
vi.mock("../sentry", () => ({ reportException: mocks.reportException }));

import { useLastChangeActions } from "./useLastChangeActions";

const t = {
  workspaceResolveError: "no workspace",
  approveSuccessMsg: "approved",
  approveErrorMsg: (m) => `approve error: ${m}`,
  rollbackSuccessMsg: "rolled back",
  rollbackErrorMsg: (m) => `rollback error: ${m}`,
  deleteFinalErrorMsg: (m) => `delete error: ${m}`,
  restoreErrorMsg: (m) => `restore error: ${m}`,
  reviewStaleMsg: "changed meanwhile",
  reviewNothingPendingMsg: "nothing pending",
};

const docRef = { firestore: { __db: true }, path: "users/o/visits/v1" };

const shown = {
  updatedBy: "sara@x.test",
  updatedById: "u1",
  updatedAt: "2026-10-01T10:00:00.000Z",
  changes: { notes: { old_value: "old", new_value: "new" } },
};

let tx;
let stored; // the document as currently stored (null = missing)

function setup(overrides = {}) {
  const props = {
    getDocRef: () => docRef,
    isOwnerAccount: true,
    lastChange: shown,
    t,
    showAlert: vi.fn(),
    onAudit: vi.fn(),
    onFinally: vi.fn(),
    onDeleteSuccess: vi.fn(),
    deleteSuccessMsg: "deleted",
    restoreSuccessMsg: "restored",
    ...overrides,
  };
  const hook = renderHook(() => useLastChangeActions(props));
  return { ...hook, props };
}

const run = (result, name) => act(async () => { await result.current[name](); });

beforeEach(() => {
  vi.clearAllMocks();
  stored = { notes: "new", last_change: shown, visitHistory: [] };
  tx = {
    get: vi.fn(async () => ({ exists: () => stored !== null, data: () => stored })),
    update: vi.fn(),
    delete: vi.fn(),
  };
  mocks.runTransaction.mockImplementation(async (_db, fn) => fn(tx));
});

describe("approve", () => {
  it("clears last_change inside a transaction when the stored change is the one shown", async () => {
    const { result, props } = setup();
    await run(result, "handleApprove");
    expect(mocks.runTransaction).toHaveBeenCalledWith(docRef.firestore, expect.any(Function));
    expect(tx.update).toHaveBeenCalledWith(docRef, { last_change: "DELETE_FIELD" });
    expect(props.showAlert).toHaveBeenCalledWith("approved");
    expect(props.onAudit).toHaveBeenCalledWith("approve");
  });

  it("writes NOTHING when an editor saved another change after the owner opened the record", async () => {
    stored = { ...stored, last_change: { ...shown, updatedById: "u2", changes: { notes: { old_value: "old", new_value: "newer" } } } };
    const { result, props } = setup();
    await run(result, "handleApprove");
    expect(tx.update).not.toHaveBeenCalled();
    expect(props.showAlert).toHaveBeenCalledWith("changed meanwhile");
    expect(props.onAudit).not.toHaveBeenCalled();
    expect(mocks.reportException).not.toHaveBeenCalled();
  });

  it("stays on the record after a conflict (onFinally is not called) so the owner sees the new change", async () => {
    stored = { ...stored, last_change: { ...shown, updatedAt: "2026-10-01T10:05:00.000Z" } };
    const { result, props } = setup();
    await run(result, "handleApprove");
    expect(props.onFinally).not.toHaveBeenCalled();
  });

  it("says so when somebody already reviewed it (no pending change any more)", async () => {
    stored = { notes: "new" };
    const { result, props } = setup();
    await run(result, "handleApprove");
    expect(tx.update).not.toHaveBeenCalled();
    expect(props.showAlert).toHaveBeenCalledWith("nothing pending");
  });

  it("copes with the record having been removed", async () => {
    stored = null;
    const { result, props } = setup();
    await run(result, "handleApprove");
    expect(props.showAlert).toHaveBeenCalledWith("nothing pending");
  });

  it("calls onFinally after a normal success", async () => {
    const { result, props } = setup();
    await run(result, "handleApprove");
    expect(props.onFinally).toHaveBeenCalledTimes(1);
  });

  it("reports a real failure and shows the error message", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.runTransaction.mockRejectedValueOnce(new Error("offline"));
    const { result, props } = setup();
    await run(result, "handleApprove");
    expect(props.showAlert).toHaveBeenCalledWith("approve error: offline");
    expect(mocks.reportException).toHaveBeenCalledTimes(1);
    expect(props.onAudit).not.toHaveBeenCalled();
    expect(props.onFinally).toHaveBeenCalledTimes(1);
    errSpy.mockRestore();
  });

  it("does nothing at all for a non-owner", async () => {
    const { result } = setup({ isOwnerAccount: false });
    await run(result, "handleApprove");
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });

  it("tells the user when the record can't be resolved", async () => {
    const { result, props } = setup({ getDocRef: () => null });
    await run(result, "handleApprove");
    expect(props.showAlert).toHaveBeenCalledWith("no workspace");
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });
});

describe("rollback", () => {
  it("restores the old values and clears last_change in one transaction write", async () => {
    const { result, props } = setup();
    await run(result, "handleRollback");
    expect(tx.update).toHaveBeenCalledTimes(1);
    expect(tx.update).toHaveBeenCalledWith(docRef, { notes: "old", last_change: "DELETE_FIELD" });
    expect(props.showAlert).toHaveBeenCalledWith("rolled back");
    expect(props.onAudit).toHaveBeenCalledWith("rollback");
  });

  it("does NOT overwrite a newer edit with stale values", async () => {
    stored = { notes: "someone's newer note", last_change: { ...shown, updatedById: "u2", changes: { notes: { old_value: "new", new_value: "someone's newer note" } } } };
    const { result, props } = setup();
    await run(result, "handleRollback");
    expect(tx.update).not.toHaveBeenCalled();
    expect(props.showAlert).toHaveBeenCalledWith("changed meanwhile");
  });

  it("removes exactly the visit-history entry the edit added (matched by id), keeping the rest", async () => {
    const pending = {
      updatedBy: "sara@x.test",
      updatedById: "u1",
      updatedAt: "2026-10-01T10:00:00.000Z",
      changes: { visitDate: { old_value: "2026-06-01", new_value: "2026-06-20" } },
      addedVisitEntryIds: ["e2"],
    };
    stored = {
      visitDate: "2026-06-20",
      last_change: pending,
      visitHistory: [
        { id: "e1", date: "2026-06-01" },
        { id: "e2", date: "2026-06-20" },
        { id: "e3", date: "2026-06-25" }, // logged by someone else since
      ],
    };
    const { result } = setup({ lastChange: pending });
    await run(result, "handleRollback");
    const payload = tx.update.mock.calls[0][1];
    expect(payload.visitDate).toBe("2026-06-01");
    expect(payload.visitHistory).toEqual([
      { id: "e1", date: "2026-06-01" },
      { id: "e3", date: "2026-06-25" },
    ]);
    expect(payload.last_change).toBe("DELETE_FIELD");
    expect(payload).not.toHaveProperty("addedVisitEntryIds");
  });

  it("leaves visitHistory alone when the edit added no entry", async () => {
    const { result } = setup();
    await run(result, "handleRollback");
    expect(tx.update.mock.calls[0][1]).not.toHaveProperty("visitHistory");
  });

  it("rolls a tag edit back to the previous tag list", async () => {
    const pending = { ...shown, changes: { tags: { old_value: ["vip"], new_value: ["vip", "cctv"] } } };
    stored = { tags: ["vip", "cctv"], last_change: pending };
    const { result } = setup({ lastChange: pending });
    await run(result, "handleRollback");
    expect(tx.update).toHaveBeenCalledWith(docRef, { tags: ["vip"], last_change: "DELETE_FIELD" });
  });

  it("does nothing for a non-owner", async () => {
    const { result } = setup({ isOwnerAccount: false });
    await run(result, "handleRollback");
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });
});

describe("confirm delete / restore", () => {
  const pendingDelete = { type: "delete", updatedBy: "sara@x.test", updatedById: "u1", updatedAt: "2026-10-01T10:00:00.000Z" };

  it("permanently deletes only the pending-delete the owner saw", async () => {
    stored = { deleted: true, last_change: pendingDelete };
    const { result, props } = setup({ lastChange: pendingDelete });
    await run(result, "handleConfirmDelete");
    expect(tx.delete).toHaveBeenCalledWith(docRef);
    expect(props.showAlert).toHaveBeenCalledWith("deleted");
    expect(props.onAudit).toHaveBeenCalledWith("delete");
    expect(props.onDeleteSuccess).toHaveBeenCalledTimes(1);
  });

  it("does NOT delete when the pending delete was restored / replaced meanwhile", async () => {
    stored = { notes: "back again", last_change: { ...shown } };
    const { result, props } = setup({ lastChange: pendingDelete });
    await run(result, "handleConfirmDelete");
    expect(tx.delete).not.toHaveBeenCalled();
    expect(props.onDeleteSuccess).not.toHaveBeenCalled();
    expect(props.showAlert).toHaveBeenCalledWith("changed meanwhile");
  });

  it("restores a soft-deleted record", async () => {
    stored = { deleted: true, last_change: pendingDelete };
    const { result, props } = setup({ lastChange: pendingDelete });
    await run(result, "handleRestoreDeleted");
    expect(tx.update).toHaveBeenCalledWith(docRef, { deleted: "DELETE_FIELD", last_change: "DELETE_FIELD" });
    expect(props.showAlert).toHaveBeenCalledWith("restored");
    expect(props.onAudit).toHaveBeenCalledWith("restore");
  });
});
