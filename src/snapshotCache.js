// ============================================================================
// Turns a Firestore QuerySnapshot into the array of `{ id, ...data }` objects
// the app keeps in state — reusing the SAME object for every document that did
// not change since the previous snapshot.
//
// useLiveData used to rebuild every object on every snapshot
// (`snap.docs.map((d) => ({ id: d.id, ...d.data() }))`). With the whole
// collection in memory that meant one edited customer produced N brand-new
// objects, so every React.memo'd row, every useMemo keyed on a visit, and the
// Dashboard's aggregates saw "everything changed" and recomputed. Keeping
// unchanged objects referentially stable means only the touched record
// re-renders. It also cuts allocation/GC churn on the phone at large sizes.
//
// `cache` is a Map owned by the caller (one per listener), so it is discarded
// naturally when the workspace changes.
// ============================================================================
export function applySnapshot(cache, snap) {
  snap.docChanges().forEach((change) => {
    if (change.type === "removed") {
      cache.delete(change.doc.id);
    } else {
      cache.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
    }
  });

  // Order (and membership) always comes from snap.docs. The fallback below
  // covers a document the change list somehow didn't mention, so the result
  // can never be missing a record the snapshot actually contains.
  const items = snap.docs.map((d) => {
    let item = cache.get(d.id);
    if (!item) {
      item = { id: d.id, ...d.data() };
      cache.set(d.id, item);
    }
    return item;
  });

  // Drop anything the snapshot no longer contains (defensive — normally the
  // "removed" changes above already did this).
  if (cache.size !== items.length) {
    const live = new Set(items.map((i) => i.id));
    for (const id of cache.keys()) if (!live.has(id)) cache.delete(id);
  }
  return items;
}
