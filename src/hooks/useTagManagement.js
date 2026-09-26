import { useCallback, useState } from "react";
import { doc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";

// Firestore caps a single batch at 500 writes. A tag realistically never
// touches anywhere near that many customers/suppliers, but this chunks
// defensively so the feature doesn't quietly break if it ever does.
const BATCH_CHUNK_SIZE = 400;

async function batchRenameTag(collectionName, ownerUid, records, oldTag, newTag) {
  const affected = records.filter((r) => (r.tags || []).includes(oldTag));
  if (affected.length === 0) return 0;

  for (let i = 0; i < affected.length; i += BATCH_CHUNK_SIZE) {
    const batch = writeBatch(db);
    affected.slice(i, i + BATCH_CHUNK_SIZE).forEach((r) => {
      const nextTags = Array.from(new Set((r.tags || []).map((tag) => (tag === oldTag ? newTag : tag))));
      batch.update(doc(db, "users", ownerUid, collectionName, r.id), { tags: nextTags });
    });
    await batch.commit();
  }
  return affected.length;
}

// Renames a tag across every customer (and, separately, every supplier)
// that carries it, in one confirmed action — typing an *existing* tag as
// the new name merges the two, since the tags array is de-duplicated on
// write either way. This is the only way to fix a typo'd tag ("VIP" vs
// "vip" vs "في اي بي") without opening each record one by one. Customers
// and suppliers are entirely separate tag spaces (different collections,
// different tags fields), so renaming one never touches the other —
// hence two independent functions/busy flags rather than one shared pair.
export function useTagManagement({
  ownerUid, visits, suppliers, canEdit, requireOnline, confirmAction, reportSaveError, t,
}) {
  const [tagBusy, setTagBusy] = useState(false);
  const [supplierTagBusy, setSupplierTagBusy] = useState(false);

  const renameTag = useCallback(
    (oldTag, newTagRaw) => {
      if (!canEdit || !ownerUid) return;
      const newTag = (newTagRaw || "").trim();
      if (!newTag || newTag === oldTag) return;
      if (!requireOnline()) return;

      const affectedCount = visits.filter((v) => (v.tags || []).includes(oldTag)).length;
      if (affectedCount === 0) return;

      confirmAction(t.tagRenameConfirm(oldTag, newTag, affectedCount, "customer"), async () => {
        setTagBusy(true);
        try {
          await batchRenameTag("visits", ownerUid, visits, oldTag, newTag);
        } catch (e) {
          reportSaveError(e);
        } finally {
          setTagBusy(false);
        }
      });
    },
    [ownerUid, visits, canEdit, requireOnline, confirmAction, reportSaveError, t]
  );

  const renameSupplierTag = useCallback(
    (oldTag, newTagRaw) => {
      if (!canEdit || !ownerUid) return;
      const newTag = (newTagRaw || "").trim();
      if (!newTag || newTag === oldTag) return;
      if (!requireOnline()) return;

      const affectedCount = suppliers.filter((s) => (s.tags || []).includes(oldTag)).length;
      if (affectedCount === 0) return;

      confirmAction(t.tagRenameConfirm(oldTag, newTag, affectedCount, "supplier"), async () => {
        setSupplierTagBusy(true);
        try {
          await batchRenameTag("suppliers", ownerUid, suppliers, oldTag, newTag);
        } catch (e) {
          reportSaveError(e);
        } finally {
          setSupplierTagBusy(false);
        }
      });
    },
    [ownerUid, suppliers, canEdit, requireOnline, confirmAction, reportSaveError, t]
  );

  return { renameTag, tagBusy, renameSupplierTag, supplierTagBusy };
}
