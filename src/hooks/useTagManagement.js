import { useCallback, useState } from "react";
import { doc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";

// Firestore caps a single batch at 500 writes. A tag realistically never
// touches anywhere near that many customers, but this chunks defensively
// so the feature doesn't quietly break if it ever does.
const BATCH_CHUNK_SIZE = 400;

// Renames a tag across every customer that carries it, in one confirmed
// action — typing an *existing* tag as the new name merges the two, since
// the per-visit tags array is de-duplicated on write either way. This is
// the only way to fix a typo'd tag ("VIP" vs "vip" vs "في اي بي") without
// opening each customer one by one.
export function useTagManagement({ ownerUid, visits, canEdit, requireOnline, confirmAction, reportSaveError, t }) {
  const [tagBusy, setTagBusy] = useState(false);

  const renameTag = useCallback(
    (oldTag, newTagRaw) => {
      if (!canEdit || !ownerUid) return;
      const newTag = (newTagRaw || "").trim();
      if (!newTag || newTag === oldTag) return;
      if (!requireOnline()) return;

      const affected = visits.filter((v) => (v.tags || []).includes(oldTag));
      if (affected.length === 0) return;

      confirmAction(t.tagRenameConfirm(oldTag, newTag, affected.length), async () => {
        setTagBusy(true);
        try {
          for (let i = 0; i < affected.length; i += BATCH_CHUNK_SIZE) {
            const batch = writeBatch(db);
            affected.slice(i, i + BATCH_CHUNK_SIZE).forEach((v) => {
              const nextTags = Array.from(
                new Set((v.tags || []).map((tag) => (tag === oldTag ? newTag : tag)))
              );
              batch.update(doc(db, "users", ownerUid, "visits", v.id), { tags: nextTags });
            });
            // eslint-disable-next-line no-await-in-loop
            await batch.commit();
          }
        } catch (e) {
          reportSaveError(e);
        } finally {
          setTagBusy(false);
        }
      });
    },
    [ownerUid, visits, canEdit, requireOnline, confirmAction, reportSaveError, t]
  );

  return { renameTag, tagBusy };
}
