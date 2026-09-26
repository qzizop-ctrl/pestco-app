import { describe, it, expect } from "vitest";
import { applySnapshot } from "./snapshotCache";

// Minimal stand-in for a Firestore QuerySnapshot: `docs` is the full ordered
// result, `changes` is what docChanges() reports relative to the last one.
function snap(docs, changes) {
  const mkDoc = ({ id, ...data }) => ({ id, data: () => data });
  return {
    docs: docs.map(mkDoc),
    docChanges: () => changes.map(([type, d]) => ({ type, doc: mkDoc(d) })),
  };
}

describe("applySnapshot", () => {
  it("builds { id, ...data } objects for the first snapshot", () => {
    const cache = new Map();
    const a = { id: "a", companyName: "Acme" };
    const b = { id: "b", companyName: "Beta" };
    const items = applySnapshot(cache, snap([a, b], [["added", a], ["added", b]]));
    expect(items).toEqual([a, b]);
  });

  it("keeps the same object for documents that did not change", () => {
    const cache = new Map();
    const a = { id: "a", companyName: "Acme" };
    const b = { id: "b", companyName: "Beta" };
    const first = applySnapshot(cache, snap([a, b], [["added", a], ["added", b]]));

    const b2 = { id: "b", companyName: "Beta 2" };
    const second = applySnapshot(cache, snap([a, b2], [["modified", b2]]));

    expect(second[0]).toBe(first[0]); // untouched -> identical reference
    expect(second[1]).not.toBe(first[1]); // edited -> new object
    expect(second[1].companyName).toBe("Beta 2");
  });

  it("removes deleted documents", () => {
    const cache = new Map();
    const a = { id: "a", n: 1 };
    const b = { id: "b", n: 2 };
    applySnapshot(cache, snap([a, b], [["added", a], ["added", b]]));
    const items = applySnapshot(cache, snap([a], [["removed", b]]));
    expect(items.map((i) => i.id)).toEqual(["a"]);
    expect(cache.has("b")).toBe(false);
  });

  it("adds new documents without touching existing ones", () => {
    const cache = new Map();
    const a = { id: "a", n: 1 };
    const first = applySnapshot(cache, snap([a], [["added", a]]));
    const c = { id: "c", n: 3 };
    const second = applySnapshot(cache, snap([a, c], [["added", c]]));
    expect(second).toHaveLength(2);
    expect(second[0]).toBe(first[0]);
  });

  it("follows the snapshot's order, not insertion order", () => {
    const cache = new Map();
    const a = { id: "a" };
    const b = { id: "b" };
    applySnapshot(cache, snap([a, b], [["added", a], ["added", b]]));
    const items = applySnapshot(cache, snap([b, a], []));
    expect(items.map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("still returns a document the change list forgot to mention", () => {
    const cache = new Map();
    const a = { id: "a", n: 1 };
    const items = applySnapshot(cache, snap([a], []));
    expect(items).toEqual([a]);
  });

  it("starts fresh with a new cache (workspace switch)", () => {
    const a = { id: "a", n: 1 };
    const one = applySnapshot(new Map(), snap([a], [["added", a]]));
    const two = applySnapshot(new Map(), snap([a], [["added", a]]));
    expect(two[0]).not.toBe(one[0]);
    expect(two[0]).toEqual(one[0]);
  });
});
