                            <button
                              onClick={() => deleteOffer(active, offer)}
                              className="btn-press flex items-center gap-1 text-xs font-bold"
                              style={{ color: DANGER, marginTop: 10 }}
                            >
                              <Trash2 size={13} /> {t.deleteOfferBtn}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* إضافة عرض جديد */}
              {canEdit && (
                <div style={{ background: SURFACE_SUBTLE, borderRadius: 12, padding: 10, marginTop: 10 }}>
                  <p className="text-xs font-bold mb-2" style={{ color: TEXT }}>{t.addOfferTitle}</p>
                  <div className="flex flex-col gap-2">
                    <input
                      placeholder={t.offerNamePlaceholder}
                      value={newOffer.name}
                      onChange={(e) => setNewOffer({ ...newOffer, name: e.target.value })}
                    />
                    <div className="flex gap-2">
                      <input
                        placeholder={t.offerNumberPlaceholder}
                        value={newOffer.offerNumber}
                        onChange={(e) => setNewOffer({ ...newOffer, offerNumber: e.target.value })}
                        style={{ flex: 1 }}
                      />
                      <input
                        type="date"
                        value={newOffer.offerDate}
                        onChange={(e) => setNewOffer({ ...newOffer, offerDate: e.target.value })}
                        style={{ flex: 1 }}
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder={t.offerAmountPlaceholder}
                        value={newOffer.amount}
                        onChange={(e) => setNewOffer({ ...newOffer, amount: e.target.value })}
                        style={{ flex: 2 }}
                      />
                      <select
                        value={newOffer.currency}
                        onChange={(e) => setNewOffer({ ...newOffer, currency: e.target.value })}
                        style={{ flex: 1 }}
                      >
                        {CURRENCY_IDS.map((c) => (
                          <option key={c} value={c}>{t.currencies[c] || c}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => addOffer(active)}
                      className="btn-press font-bold text-xs"
                      style={{ background: PRIMARY_MID, color: "#fff", borderRadius: 10, padding: "8px 0", marginTop: 4 }}
                    >
                      {t.addOfferBtn}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* سجل النشاطات / Activity Log */}
            <div style={{ borderTop: `0.5px solid ${LINE}`, marginTop: 12, paddingTop: 12 }}>
              <span className="flex items-center gap-2 text-sm font-bold mb-3"><Workflow size={15} /> {t.activityLogLabel}</span>
              
              {canEdit && (
                <div className="flex gap-2 mb-3">
                  <input
                    placeholder={t.newActivityPlaceholder}
                    value={newActivityText}
                    onChange={(e) => setNewActivityText(e.target.value)}
                  />
                  <button
                    onClick={submitActivity}
                    className="btn-press font-bold text-xs"
                    style={{ background: PRIMARY_MID, color: "#fff", borderRadius: 10, padding: "0 16px", flexShrink: 0 }}
                  >
                    {t.addNoteBtn}
                  </button>
                </div>
              )}

              {activityLog.length === 0 ? (
                <p className="text-sm text-center py-2" style={{ color: MUTED }}>{t.noActivities}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {activityLog.map((entry, idx) => {
                    const color = ACTIVITY_COLORS[entry.type] || MUTED;
                    return (
                      <div
                        key={entry.id || idx}
                        className="flex items-start justify-between gap-2"
                        style={{ background: SURFACE_SUBTLE, borderRadius: 10, padding: "8px 12px" }}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                            <span className="text-xs font-bold" style={{ color: TEXT }}>{entry.text}</span>
                          </div>
                          <span className="text-xs" style={{ color: MUTED, display: "block", marginTop: 2 }}>
                            {fmtActivityDate(entry.at, t.locale)}
                          </span>
                        </div>
                        {canEdit && (
                          <button
                            onClick={() => deleteActivity(entry)}
                            className="btn-press"
                            style={{ color: MUTED }}
                            aria-label={t.deleteActivityBtn}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* إجراءات التعديل والحذف */}
            {canEdit && (
              <div className="flex items-center gap-2 mt-4 pt-3" style={{ borderTop: `0.5px solid ${LINE}` }}>
                <button
                  onClick={() => openEdit(active)}
                  className="btn-press flex-1 flex items-center justify-center gap-1 font-bold text-sm"
                  style={{ background: SURFACE_SUBTLE, color: TEXT, borderRadius: 12, padding: "10px 0", border: `1px solid ${LINE}` }}
                >
                  <Pencil size={15} /> {t.editBtn}
                </button>
                <button
                  onClick={() => deleteVisit(active.id)}
                  className="btn-press flex-1 flex items-center justify-center gap-1 font-bold text-sm"
                  style={{ background: "rgba(196,68,58,.1)", color: DANGER, borderRadius: 12, padding: "10px 0" }}
                >
                  <Trash2 size={15} /> {t.deleteBtn}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- شاشة الموردين / Suppliers Screen ---- */}
      {screen === "suppliers" && (
        <div className="px-4 pt-4 pb-24">
          <div className="relative mb-4">
            <Search
              size={16}
              color={MUTED}
              style={{ position: "absolute", [t.dir === "rtl" ? "right" : "left"]: 12, top: "50%", transform: "translateY(-50%)" }}
            />
            <input
              value={supplierQuery}
              onChange={(e) => setSupplierQuery(e.target.value)}
              placeholder={t.searchSuppliersPlaceholder}
              style={{ [t.dir === "rtl" ? "paddingRight" : "paddingLeft"]: 34, borderRadius: 14 }}
            />
          </div>

          {!suppliersLoaded && <p className="text-sm text-center py-8" style={{ color: MUTED }}>{t.loading}</p>}

          {suppliersLoaded && filteredSuppliers.length === 0 && (
            <div className="text-center py-16">
              <Truck size={40} color="#C7C4B6" className="mx-auto mb-2" />
              <p className="font-bold" style={{ color: TEXT }}>{t.noSuppliers}</p>
            </div>
          )}

          {filteredSuppliers.map((s) => (
            <div
              key={s.id}
              style={{
                background: SURFACE,
                borderRadius: 16,
                border: `1px solid ${LINE}`,
                padding: 14,
                marginBottom: 12,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-base" style={{ color: TEXT }}>{s.name}</span>
                {s.category && (
                  <span className="text-xs font-bold" style={{ background: GOLD_SOFT, color: "#7A5420", borderRadius: 999, padding: "3px 9px" }}>
                    {s.category}
                  </span>
                )}
              </div>

              {s.notes && <p className="text-xs mb-3" style={{ color: MUTED }}>{s.notes}</p>}

              <div className="flex items-center justify-between pt-2" style={{ borderTop: `1px dashed ${LINE}` }}>
                <div className="flex items-center gap-2">
                  {s.phone && (
                    <a
                      href={`tel:${s.phone}`}
                      className="btn-press flex items-center justify-center"
                      style={{ width: 32, height: 32, borderRadius: 10, background: "#E5F1EA", color: "#2F9E58" }}
                    >
                      <Phone size={14} />
                    </a>
                  )}
                  {s.phone && (
                    <a
                      href={`https://wa.me/${s.phone.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-press flex items-center justify-center"
                      style={{ width: 32, height: 32, borderRadius: 10, background: "#E4F5EA", color: "#25A245" }}
                    >
                      <MessageCircle size={14} />
                    </a>
                  )}
                </div>

                {canEdit && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEditSupplier(s)} className="btn-press p-1" style={{ color: MUTED }}>
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => deleteSupplier(s.id)} className="btn-press p-1" style={{ color: DANGER }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {canEdit && (
            <button
              onClick={openNewSupplier}
              className="btn-press flex items-center justify-center"
              style={{
                position: "fixed",
                bottom: 84,
                left: 20,
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: GOLD,
                color: "#fff",
                border: "none",
                boxShadow: "0 10px 20px rgba(192,138,62,.4)",
                zIndex: 20,
              }}
            >
              <Plus size={26} />
            </button>
          )}
        </div>
      )}

      {/* ---- نموذج إضافة/تعديل مورد / Supplier Form ---- */}
      {screen === "supplier-form" && canEdit && (
        <div className="px-4 pt-4 pb-10 flex flex-col gap-4">
          <div>
            <label>{t.supplierNameLabel}</label>
            <input
              value={supplierForm.name}
              onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
              placeholder={t.supplierNamePlaceholder}
            />
            {supplierErrors.name && <p className="text-xs mt-1" style={{ color: DANGER }}>{supplierErrors.name}</p>}
          </div>

          <div>
            <label>{t.supplierCategoryLabel}</label>
            <input
              value={supplierForm.category}
              onChange={(e) => setSupplierForm({ ...supplierForm, category: e.target.value })}
              placeholder={t.supplierCategoryPlaceholder}
            />
          </div>

          <div>
            <label>{t.phoneLabel}</label>
            <input
              type="tel"
              value={supplierForm.phone}
              onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
              placeholder={t.phonePlaceholder}
            />
          </div>

          <div>
            <label>{t.notesLabel}</label>
            <textarea
              rows={4}
              value={supplierForm.notes}
              onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })}
              placeholder={t.notesPlaceholder}
            />
          </div>

          <button
            onClick={saveSupplierForm}
            className="btn-press font-bold"
            style={{ background: PRIMARY, color: "#fff", borderRadius: 14, padding: "12px 0", marginTop: 8 }}
          >
            {t.save}
          </button>
        </div>
      )}

      {/* ---- شاشة الإعدادات / Settings Screen ---- */}
      {screen === "settings" && (
        <div className="px-4 pt-4 pb-24 flex flex-col gap-4">
          {/* تبديل مكان العمل / Workspace switcher */}
          {availableOwners.length > 1 && (
            <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 14, padding: 14 }}>
              <label>{t.workspaceLabel}</label>
              <select value={ownerUid || ""} onChange={(e) => switchOwnerWorkspace(e.target.value)}>
                {availableOwners.map((o) => (
                  <option key={o.uid} value={o.uid}>
                    {o.uid === user.uid ? t.myWorkspace : `${t.sharedWorkspace} (${o.role})`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* إدارة فريق العمل / Team Management */}
          {isOwnerAccount && (
            <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 14, padding: 14 }}>
              <span className="font-bold text-sm flex items-center gap-2 mb-3"><UsersIcon size={16} /> {t.teamManagementTitle}</span>
              <div className="flex gap-2 mb-3">
                <input
                  type="email"
                  placeholder={t.memberEmailPlaceholder}
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  style={{ flex: 2 }}
                />
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value)}
                  style={{ flex: 1 }}
                >
                  <option value="editor">{t.roleEditor}</option>
                  <option value="viewer">{t.roleViewer}</option>
                </select>
              </div>
              <button
                onClick={async () => {
                  await grantAccess(newMemberEmail, newMemberRole);
                  setNewMemberEmail("");
                }}
                className="btn-press w-full font-bold text-xs"
                style={{ background: PRIMARY, color: "#fff", borderRadius: 10, padding: "10px 0" }}
              >
                {t.addMemberBtn}
              </button>

              <div className="flex flex-col gap-2 mt-4 pt-3" style={{ borderTop: `1px dashed ${LINE}` }}>
                {Object.entries(members).map(([email, role]) => (
                  <div key={email} className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold" style={{ margin: 0, color: TEXT }}>{email}</p>
                      <p className="text-xs" style={{ margin: 0, color: MUTED }}>{t.roles[role] || role}</p>
                    </div>
                    <button
                      onClick={() => revokeAccess(email)}
                      className="btn-press"
                      style={{ color: DANGER }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* استيراد وتصدير البيانات / Import & Export */}
          {canEdit && (
            <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 14, padding: 14 }}>
              <span className="font-bold text-sm flex items-center gap-2 mb-3"><FileText size={16} /> {t.dataManagementTitle}</span>
              <div className="flex flex-col gap-2">
                <button
                  onClick={exportAllToExcel}
                  className="btn-press flex items-center justify-center gap-2 font-bold text-xs"
                  style={{ background: SURFACE_SUBTLE, color: TEXT, border: `1px solid ${LINE}`, borderRadius: 10, padding: "10px 0" }}
                >
                  <Download size={14} /> {t.exportAllBtn}
                </button>
                <button
                  onClick={exportFilteredToExcel}
                  className="btn-press flex items-center justify-center gap-2 font-bold text-xs"
                  style={{ background: SURFACE_SUBTLE, color: TEXT, border: `1px solid ${LINE}`, borderRadius: 10, padding: "10px 0" }}
                >
                  <Download size={14} /> {t.exportFilteredBtn}
                </button>
                <button
                  onClick={triggerImportPicker}
                  disabled={importing}
                  className="btn-press flex items-center justify-center gap-2 font-bold text-xs"
                  style={{ background: GOLD_SOFT, color: "#7A5420", borderRadius: 10, padding: "10px 0" }}
                >
                  <Upload size={14} /> {importing ? t.importingText : t.importExcelBtn}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleImportFile}
                  style={{ display: "none" }}
                />
              </div>
            </div>
          )}

          {/* فحص البيانات المكررة / Duplicates */}
          {duplicateGroups.length > 0 && (
            <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 14, padding: 14 }}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm flex items-center gap-2"><Copy size={16} color={STATUS_COLORS.today} /> {t.duplicatesTitle} ({duplicateGroups.length})</span>
                <button
                  onClick={() => setShowDuplicates((s) => !s)}
                  className="btn-press text-xs font-bold"
                  style={{ color: PRIMARY_MID }}
                >
                  {showDuplicates ? t.hideBtn : t.showBtn}
                </button>
              </div>

              {showDuplicates && (
                <div className="flex flex-col gap-3 mt-3 pt-2" style={{ borderTop: `1px dashed ${LINE}` }}>
                  {duplicateGroups.map((group, idx) => (
                    <div key={idx} style={{ background: SURFACE_SUBTLE, borderRadius: 10, padding: 8 }}>
                      <p className="text-xs font-bold mb-1" style={{ color: DANGER }}>{group.reason}</p>
                      {group.items.map((v) => (
                        <button
                          key={v.id}
                          onClick={() => openDetail(v)}
                          className={`btn-press w-full text-xs py-1 ${t.dir === "rtl" ? "text-right" : "text-left"}`}
                          style={{ color: TEXT, display: "block" }}
                        >
                          • {v.companyName} ({v.phone || t.noPhone})
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* شريط الإشعارات عند الحذف المؤقت / Undo Delete Banner */}
      {pendingDelete && (
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{
            position: "fixed",
            bottom: 64,
            left: 16,
            right: 16,
            background: "#222",
            color: "#fff",
            borderRadius: 12,
            boxShadow: "0 10px 25px rgba(0,0,0,.3)",
            zIndex: 30,
          }}
        >
          <span className="text-xs font-bold">{t.deletedCustomerMsg(pendingDelete.companyName)}</span>
          <button onClick={undoDelete} className="btn-press text-xs font-extrabold" style={{ color: GOLD }}>
            {t.undoBtn}
          </button>
        </div>
      )}

      {/* شريط التنقل السفلي / Bottom Navigation */}
      <BottomNav screen={screen} setScreen={setScreen} t={t} />
    </div>
  );
}
