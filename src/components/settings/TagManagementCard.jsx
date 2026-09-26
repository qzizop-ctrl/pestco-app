import { useState } from "react";
import { Search } from "lucide-react";
import { TEXT, MUTED, GOLD, LINE, SURFACE, SURFACE_SUBTLE } from "../../theme";
import TagRow from "./TagRow";

export default function TagManagementCard({
  t,
  allTags,
  tagCounts,
  renameTag,
  tagBusy,
  allSupplierTags,
  supplierTagCounts,
  renameSupplierTag,
  supplierTagBusy,
}) {
  const [editingTag, setEditingTag] = useState(null);
  const [tagDraft, setTagDraft] = useState("");
  const [tagTab, setTagTab] = useState("customers");
  const [tagSearch, setTagSearch] = useState("");

  return (
    <div style={{ background: SURFACE, borderRadius: 16, border: `1px solid ${LINE}`, padding: 16, marginBottom: 16 }}>
      <p className="font-bold text-base mb-1" style={{ color: TEXT }}>{t.tagManagementTitle}</p>
      <p className="text-xs mb-3" style={{ color: MUTED }}>{t.tagManagementHint}</p>

      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => { setTagTab("customers"); setEditingTag(null); setTagDraft(""); setTagSearch(""); }}
          className="text-xs font-bold px-3 py-1.5 rounded-lg"
          style={{
            background: tagTab === "customers" ? GOLD : SURFACE_SUBTLE,
            color: tagTab === "customers" ? "#fff" : MUTED,
            border: `1px solid ${tagTab === "customers" ? GOLD : LINE}`,
          }}
        >
          {t.tagTabCustomers}
        </button>
        <button
          onClick={() => { setTagTab("suppliers"); setEditingTag(null); setTagDraft(""); setTagSearch(""); }}
          className="text-xs font-bold px-3 py-1.5 rounded-lg"
          style={{
            background: tagTab === "suppliers" ? GOLD : SURFACE_SUBTLE,
            color: tagTab === "suppliers" ? "#fff" : MUTED,
            border: `1px solid ${tagTab === "suppliers" ? GOLD : LINE}`,
          }}
        >
          {t.tagTabSuppliers}
        </button>
      </div>

      {(() => {
        const activeTags = tagTab === "customers" ? allTags : allSupplierTags;
        const activeCounts = tagTab === "customers" ? tagCounts : supplierTagCounts;
        const activeBusy = tagTab === "customers" ? tagBusy : supplierTagBusy;
        const activeRename = tagTab === "customers" ? renameTag : renameSupplierTag;
        const q = tagSearch.trim().toLowerCase();
        const visibleTags = q ? activeTags.filter((tag) => tag.toLowerCase().includes(q)) : activeTags;

        if (activeTags.length === 0) {
          return <p className="text-xs" style={{ color: MUTED }}>{t.tagsEmpty}</p>;
        }

        return (
          <>
            {/* Only worth the extra row once the list is long enough
                that scrolling to find a tag is actually annoying —
                same threshold as the supplier picker sheet. */}
            {activeTags.length > 6 && (
              <div className="relative mb-3">
                <Search
                  size={15}
                  color={MUTED}
                  style={{ position: "absolute", [t.dir === "rtl" ? "right" : "left"]: 12, top: "50%", transform: "translateY(-50%)" }}
                />
                <input
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                  placeholder={t.tagSearchPlaceholder}
                  style={{ [t.dir === "rtl" ? "paddingRight" : "paddingLeft"]: 32, borderRadius: 10, width: "100%" }}
                />
              </div>
            )}

            {visibleTags.length === 0 ? (
              <p className="text-xs text-center py-2" style={{ color: MUTED }}>{t.noTagSearchResults}</p>
            ) : (
              <div className="flex flex-col gap-2" style={{ maxHeight: 320, overflowY: "auto" }}>
                {visibleTags.map((tag) => (
                  <TagRow
                    key={tag}
                    tag={tag}
                    count={activeCounts[tag]}
                    isEditing={editingTag === tag}
                    draft={tagDraft}
                    onDraftChange={setTagDraft}
                    onStartEdit={() => { setEditingTag(tag); setTagDraft(tag); }}
                    onSave={() => {
                      activeRename(tag, tagDraft);
                      setEditingTag(null);
                      setTagDraft("");
                    }}
                    onCancel={() => { setEditingTag(null); setTagDraft(""); }}
                    busy={activeBusy}
                    t={t}
                  />
                ))}
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}
