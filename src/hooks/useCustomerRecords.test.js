import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { STRINGS } from "../i18n";
import { emptyForm } from "../domain";
import { todayLocalISO } from "../helpers";

// Firestore, the native reminder module and the audit helper are mocked, so
// these tests pin down WHAT the hook decides to write (which document, which
// fields, in one batch with its audit entry) and WHEN it refuses to write
// (viewer, offline, invalid form, declined confirmation) — not Firebase.
const mocks = vi.hoisted(() => {
  const batch = { set: vi.fn(), update: vi.fn(), commit: vi.fn(() => Promise.resolve()) };
  return {
    batch,
    writeBatch: vi.fn(() => batch),
    updateDoc: vi.fn(() => Promise.resolve()),
    collection: vi.fn((_db, ...segs) => ({ __collection: segs.join("/") })),
    // doc(db, "users", uid, "visits", id) -> that document;
    // doc(collectionRef) -> a brand-new document with a generated id.
    doc: vi.fn((first, ...segs) =>
      first && first.__collection !== undefined
        ? { id: "new-visit-id", path: `${first.__collection}/new-visit-id` }
        : { id: segs[segs.length - 1], path: segs.join("/") }
    ),
    serverTimestamp: vi.fn(() => "SERVER_TS"),
    arrayUnion: vi.fn((...items) => ({ __arrayUnion: items })),
    scheduleCallReminder: vi.fn(() => Promise.resolve()),
    cancelCallReminder: vi.fn(() => Promise.resolve()),
    queueAudit: vi.fn(),
  };
});

vi.mock("firebase/firestore", () => ({
  collection: mocks.collection,
  doc: mocks.doc,
  updateDoc: mocks.updateDoc,
  writeBatch: mocks.writeBatch,
  serverTimestamp: mocks.serverTimestamp,
  arrayUnion: mocks.arrayUnion,
}));
vi.mock("../firebase", () => ({ db: {} }));
vi.mock("../notifications", () => ({
  scheduleCallReminder: mocks.scheduleCallReminder,
  cancelCallReminder: mocks.cancelCallReminder,
}));
vi.mock("./useAuditLog", () => ({ queueAudit: mocks.queueAudit }));

import { useCustomerRecords } from "./useCustomerRecords";

const t = STRINGS.en;

const existing = {
  id: "v1",
  companyName: "Acme",
  contactName: "Ali",
  sector: "private",
  role: "purchasing",
  stage: "quote",
  tags: ["vip"],
  phone: "01012345678",
  email: "",
  visitDate: "2026-06-01",
  notes: "old note",
  callDateTime: "",
  notified: false,
  isPinned: false,
};

function makeProps(overrides = {}) {
  return {
    ownerUid: "owner1",
    user: { uid: "u1", displayName: "Sara", email: "sara@example.com" },
    visits: [],
    canEdit: true,
    requireOnline: vi.fn(() => true),
    // Auto-accepts every confirmation unless a test swaps in vi.fn().
    confirmAction: vi.fn((_message, onConfirm) => onConfirm()),
    reportSaveError: vi.fn(),
    appendActivity: vi.fn(() => Promise.resolve()),
    t,
    lang: "en",
    setScreen: vi.fn(),
    resetDetailPanels: vi.fn(),
    setIsSaving: vi.fn(),
    activeId: null,
    setActiveId: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateDoc.mockImplementation(() => Promise.resolve());
  mocks.batch.commit.mockImplementation(() => Promise.resolve());
});

// Fill the new-customer form and press save.
function fillNew(result, fields) {
  act(() => {
    result.current.setForm({
      ...emptyForm,
      companyName: "Acme",
      contactName: "Ali",
      sector: "private",
      phone: "01012345678",
      visitDate: "2026-06-15",
      ...fields,
    });
  });
}

describe("useCustomerRecords — creating a customer", () => {
  it("writes the record and its audit entry in ONE batch, then logs the creation", async () => {
    const props = makeProps();
    const { result } = renderHook(() => useCustomerRecords(props));
    fillNew(result, {});

    act(() => {
      result.current.saveForm();
    });
    await waitFor(() => expect(props.setScreen).toHaveBeenCalledWith("list"));

    expect(mocks.batch.commit).toHaveBeenCalledTimes(1);
    const [ref, data] = mocks.batch.set.mock.calls[0];
    expect(ref.id).toBe("new-visit-id");
    expect(data).toMatchObject({
      companyName: "Acme",
      contactName: "Ali",
      sector: "private",
      phone: "01012345678",
      activityLog: [],
      offers: [],
      createdAt: "SERVER_TS",
    });
    expect(data.last_change.updatedById).toBe("u1");
    expect(data.visitHistory).toHaveLength(1);
    // form-only fields must not leak into the stored document
    expect(data).not.toHaveProperty("id");
    expect(data).not.toHaveProperty("tagsInput");

    expect(mocks.queueAudit).toHaveBeenCalledWith(
      mocks.batch,
      "owner1",
      expect.objectContaining({ entityType: "customer", entityId: "new-visit-id", entityName: "Acme", action: "create" })
    );
    expect(props.appendActivity).toHaveBeenCalledWith(
      "new-visit-id",
      expect.objectContaining({ type: "created", text: t.activityCreated })
    );
    expect(props.setIsSaving).toHaveBeenCalledWith(true);
    expect(props.setIsSaving).toHaveBeenLastCalledWith(false);
  });

  it("schedules a native reminder when a call time is set, otherwise cancels any", async () => {
    const props = makeProps();
    const { result } = renderHook(() => useCustomerRecords(props));
    fillNew(result, { callDateTime: "2026-06-20T10:00" });

    act(() => {
      result.current.saveForm();
    });
    await waitFor(() => expect(props.setScreen).toHaveBeenCalledWith("list"));

    expect(mocks.scheduleCallReminder).toHaveBeenCalledWith(
      "new-visit-id",
      "2026-06-20T10:00",
      `${t.reminderTitle} Acme`,
      t.reminderBody("Ali")
    );
    expect(mocks.cancelCallReminder).not.toHaveBeenCalled();
  });

  it("doesn't write anything and flags the fields when required data is missing", () => {
    const props = makeProps();
    const { result } = renderHook(() => useCustomerRecords(props));

    act(() => {
      result.current.saveForm(); // untouched empty form
    });

    expect(result.current.errors.companyName).toBe(t.companyError);
    expect(mocks.writeBatch).not.toHaveBeenCalled();
    expect(props.confirmAction).not.toHaveBeenCalled();
  });

  it("warns before saving a customer with no phone, and saves nothing if declined", () => {
    const props = makeProps({ confirmAction: vi.fn() }); // never accepts
    const { result } = renderHook(() => useCustomerRecords(props));
    fillNew(result, { phone: "" });

    act(() => {
      result.current.saveForm();
    });

    expect(props.confirmAction).toHaveBeenCalledWith(t.phoneMissingWarning, expect.any(Function));
    expect(mocks.writeBatch).not.toHaveBeenCalled();
  });
});

describe("useCustomerRecords — duplicate phone check", () => {
  const other = { id: "other", companyName: "Other Co", phone: "+20 10 1234 5678" };

  it("warns when another customer has the same number (any +20/0 formatting) and waits for a yes", async () => {
    const props = makeProps({ visits: [other], confirmAction: vi.fn() });
    const { result } = renderHook(() => useCustomerRecords(props));
    fillNew(result, {});

    act(() => {
      result.current.saveForm();
    });
    expect(props.confirmAction).toHaveBeenCalledWith(t.duplicatePhoneWarning("Other Co"), expect.any(Function));
    expect(mocks.batch.commit).not.toHaveBeenCalled();

    // Accepting the warning proceeds with the save.
    const proceed = props.confirmAction.mock.calls[0][1];
    await act(async () => {
      await proceed();
    });
    expect(mocks.batch.commit).toHaveBeenCalledTimes(1);
  });

  it("ignores soft-deleted customers when checking for duplicates", async () => {
    const props = makeProps({ visits: [{ ...other, deleted: true }], confirmAction: vi.fn() });
    const { result } = renderHook(() => useCustomerRecords(props));
    fillNew(result, {});

    act(() => {
      result.current.saveForm();
    });
    await waitFor(() => expect(mocks.batch.commit).toHaveBeenCalledTimes(1));
    expect(props.confirmAction).not.toHaveBeenCalled();
  });
});

describe("useCustomerRecords — editing a customer", () => {
  it("sends only the fields that changed since the form was opened", async () => {
    const props = makeProps({ visits: [existing] });
    const { result } = renderHook(() => useCustomerRecords(props));

    act(() => {
      result.current.openEdit(existing);
    });
    act(() => {
      result.current.setForm({ ...result.current.form, notes: "new note" });
    });
    act(() => {
      result.current.saveForm();
    });
    await waitFor(() => expect(props.setScreen).toHaveBeenCalledWith("list"));

    expect(mocks.batch.set).not.toHaveBeenCalled(); // an update, not a create
    const [ref, payload] = mocks.batch.update.mock.calls[0];
    expect(ref.path).toBe("users/owner1/visits/v1");
    expect(payload.notes).toBe("new note");
    // untouched fields (which someone else may have changed meanwhile) are NOT written back
    expect(payload).not.toHaveProperty("companyName");
    expect(payload).not.toHaveProperty("stage");
    expect(payload).not.toHaveProperty("phone");
    expect(payload).not.toHaveProperty("visitHistory");
    expect(payload.last_change.updatedById).toBe("u1");
    expect(payload.last_change.changes.notes).toEqual({ old_value: "old note", new_value: "new note" });

    expect(mocks.queueAudit).toHaveBeenCalledWith(
      mocks.batch,
      "owner1",
      expect.objectContaining({ action: "update", entityId: "v1" })
    );
  });

  it("logs a timeline entry when the stage changes", async () => {
    const props = makeProps({ visits: [existing] });
    const { result } = renderHook(() => useCustomerRecords(props));

    act(() => {
      result.current.openEdit(existing);
    });
    act(() => {
      result.current.setForm({ ...result.current.form, stage: "install" });
    });
    act(() => {
      result.current.saveForm();
    });
    await waitFor(() => expect(props.setScreen).toHaveBeenCalledWith("list"));

    expect(mocks.batch.update.mock.calls[0][1].stage).toBe("install");
    expect(props.appendActivity).toHaveBeenCalledWith(
      "v1",
      expect.objectContaining({ type: "stage", text: t.activityStageChanged(t.stages.install) })
    );
  });

  it("re-arms the reminder when the call time changes", async () => {
    const props = makeProps({ visits: [{ ...existing, callDateTime: "2026-06-10T09:00", notified: true }] });
    const { result } = renderHook(() => useCustomerRecords(props));

    act(() => {
      result.current.openEdit(props.visits[0]);
    });
    act(() => {
      result.current.setForm({ ...result.current.form, callDateTime: "2026-06-25T09:00" });
    });
    act(() => {
      result.current.saveForm();
    });
    await waitFor(() => expect(props.setScreen).toHaveBeenCalledWith("list"));

    const payload = mocks.batch.update.mock.calls[0][1];
    expect(payload.callDateTime).toBe("2026-06-25T09:00");
    expect(payload.notified).toBe(false);
    expect(mocks.scheduleCallReminder).toHaveBeenCalledWith(
      "v1",
      "2026-06-25T09:00",
      `${t.reminderTitle} Acme`,
      t.reminderBody("Ali")
    );
  });
});

describe("useCustomerRecords — deleting (soft delete with undo window)", () => {
  beforeEach(() => {
    // Only setTimeout/Date are faked, so React's own scheduling keeps working.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const flushPromises = async () => {
    await act(async () => {
      for (let i = 0; i < 5; i += 1) await Promise.resolve();
    });
  };

  it("hides the customer immediately but only flags it deleted after the 5s undo window", async () => {
    const props = makeProps({ visits: [existing] });
    const { result } = renderHook(() => useCustomerRecords(props));

    act(() => {
      result.current.deleteVisit("v1");
    });
    expect(result.current.pendingDelete).toMatchObject({ id: "v1", companyName: "Acme" });
    expect(props.setScreen).toHaveBeenCalledWith("list");

    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(mocks.batch.commit).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    await flushPromises();

    expect(mocks.batch.commit).toHaveBeenCalledTimes(1);
    const [ref, payload] = mocks.batch.update.mock.calls[0];
    expect(ref.path).toBe("users/owner1/visits/v1");
    expect(payload.deleted).toBe(true);
    expect(payload.last_change).toMatchObject({ type: "delete", updatedById: "u1" });
    expect(mocks.queueAudit).toHaveBeenCalledWith(
      mocks.batch,
      "owner1",
      expect.objectContaining({ action: "delete", entityId: "v1", entityName: "Acme" })
    );
    expect(mocks.cancelCallReminder).toHaveBeenCalledWith("v1");
    expect(result.current.pendingDelete).toBeNull();
  });

  it("undo inside the window means nothing is ever written", async () => {
    const props = makeProps({ visits: [existing] });
    const { result } = renderHook(() => useCustomerRecords(props));

    act(() => {
      result.current.deleteVisit("v1");
    });
    act(() => {
      result.current.undoDelete();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    await flushPromises();

    expect(mocks.batch.commit).not.toHaveBeenCalled();
    expect(result.current.pendingDelete).toBeNull();
  });

  it("commits a pending delete immediately if the app is hidden inside the window", async () => {
    const props = makeProps({ visits: [existing] });
    const { result } = renderHook(() => useCustomerRecords(props));

    act(() => {
      result.current.deleteVisit("v1");
    });
    expect(mocks.batch.commit).not.toHaveBeenCalled();

    await act(async () => {
      window.dispatchEvent(new Event("pagehide"));
    });
    await flushPromises();

    expect(mocks.batch.commit).toHaveBeenCalledTimes(1);
    expect(mocks.batch.update.mock.calls[0][1].deleted).toBe(true);
  });

  it("does nothing if the confirmation is declined", () => {
    const props = makeProps({ visits: [existing], confirmAction: vi.fn() });
    const { result } = renderHook(() => useCustomerRecords(props));

    act(() => {
      result.current.deleteVisit("v1");
    });
    expect(result.current.pendingDelete).toBeNull();
    expect(props.setScreen).not.toHaveBeenCalled();
  });
});

describe("useCustomerRecords — quick actions", () => {
  it("togglePin flips the pin in both directions", async () => {
    const props = makeProps();
    const { result } = renderHook(() => useCustomerRecords(props));

    await act(async () => {
      await result.current.togglePin({ id: "v1", isPinned: false });
      await result.current.togglePin({ id: "v1", isPinned: true });
    });

    expect(mocks.updateDoc.mock.calls[0][0].path).toBe("users/owner1/visits/v1");
    expect(mocks.updateDoc.mock.calls[0][1]).toEqual({ isPinned: true });
    expect(mocks.updateDoc.mock.calls[1][1]).toEqual({ isPinned: false });
  });

  it("changeStage sets a new stage, and tapping the current stage clears it", async () => {
    const props = makeProps();
    const { result } = renderHook(() => useCustomerRecords(props));

    await act(async () => {
      await result.current.changeStage({ id: "v1", stage: "quote" }, "install");
      await result.current.changeStage({ id: "v1", stage: "quote" }, "quote");
    });

    expect(mocks.updateDoc.mock.calls[0][1]).toEqual({ stage: "install" });
    expect(mocks.updateDoc.mock.calls[1][1]).toEqual({ stage: "" });
    expect(props.appendActivity).toHaveBeenNthCalledWith(
      1, "v1", expect.objectContaining({ type: "stage", text: t.activityStageChanged(t.stages.install) })
    );
    expect(props.appendActivity).toHaveBeenNthCalledWith(
      2, "v1", expect.objectContaining({ type: "stage", text: t.activityStageCleared })
    );
  });

  it("logVisitToday records today's date and a visit-history entry", async () => {
    const props = makeProps();
    const { result } = renderHook(() => useCustomerRecords(props));

    await act(async () => {
      await result.current.logVisitToday({ id: "v1" });
    });

    const payload = mocks.updateDoc.mock.calls[0][1];
    expect(payload.visitDate).toBe(todayLocalISO());
    expect(payload.visitHistory.__arrayUnion[0]).toMatchObject({ date: todayLocalISO() });
  });

  it("clearCallReminder clears the time, cancels the native reminder and logs the call", async () => {
    const props = makeProps();
    const { result } = renderHook(() => useCustomerRecords(props));

    await act(async () => {
      await result.current.clearCallReminder({ id: "v1" });
    });

    expect(mocks.updateDoc.mock.calls[0][1]).toEqual({ callDateTime: "", notified: false });
    expect(mocks.cancelCallReminder).toHaveBeenCalledWith("v1");
    expect(props.appendActivity).toHaveBeenCalledWith(
      "v1", expect.objectContaining({ type: "call", text: t.activityCallDone })
    );
  });

  it("clearCallReminder leaves the native reminder alone if the write failed", async () => {
    mocks.updateDoc.mockRejectedValueOnce(new Error("permission-denied"));
    const props = makeProps();
    const { result } = renderHook(() => useCustomerRecords(props));

    await act(async () => {
      await result.current.clearCallReminder({ id: "v1" });
    });

    expect(props.reportSaveError).toHaveBeenCalledTimes(1);
    expect(mocks.cancelCallReminder).not.toHaveBeenCalled();
    expect(props.appendActivity).not.toHaveBeenCalled();
  });
});

describe("useCustomerRecords — permissions and connectivity", () => {
  it("a viewer (canEdit: false) can't write anything", async () => {
    const props = makeProps({ canEdit: false, visits: [existing] });
    const { result } = renderHook(() => useCustomerRecords(props));

    act(() => {
      result.current.openNew();
      result.current.openEdit(existing);
    });
    fillNew(result, {});
    await act(async () => {
      result.current.saveForm();
      result.current.deleteVisit("v1");
      await result.current.togglePin(existing);
      await result.current.changeStage(existing, "install");
      await result.current.logVisitToday(existing);
      await result.current.clearCallReminder(existing);
    });

    expect(props.setScreen).not.toHaveBeenCalled();
    expect(props.confirmAction).not.toHaveBeenCalled();
    expect(mocks.writeBatch).not.toHaveBeenCalled();
    expect(mocks.updateDoc).not.toHaveBeenCalled();
  });

  it("nothing is written while offline", async () => {
    const props = makeProps({ requireOnline: vi.fn(() => false), visits: [existing] });
    const { result } = renderHook(() => useCustomerRecords(props));
    fillNew(result, {});

    await act(async () => {
      result.current.saveForm();
      result.current.deleteVisit("v1");
      await result.current.togglePin(existing);
      await result.current.changeStage(existing, "install");
      await result.current.logVisitToday(existing);
      await result.current.clearCallReminder(existing);
    });

    expect(mocks.writeBatch).not.toHaveBeenCalled();
    expect(mocks.updateDoc).not.toHaveBeenCalled();
    expect(props.confirmAction).not.toHaveBeenCalled();
  });
});
