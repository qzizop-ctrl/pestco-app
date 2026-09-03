                            <button
                              onClick={() => deleteOffer(active, offer)}
                              className="btn-press flex items-center gap-1 text-xs font-bold mt-2"
                              style={{ color: DANGER }}
                            >
                              <Trash2 size={13} /> {t.deleteOfferBtn || "حذف العرض"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {canEdit && (
                <div style={{ background: SURFACE_SUBTLE, borderRadius: 12, padding: 10, marginTop: 8 }}>
                  <p className="text-xs font-bold mb-2">{t.addOfferTitle || "إضافة عرض سعر"}</p>
                  <div className="flex flex-col gap-2">
                    <input
                      placeholder={t.offerNamePlaceholder || "اسم العرض"}
                      value={newOffer.name}
                      onChange={(e) => setNewOffer({ ...newOffer, name: e.target.value })}
                    />
                    <div className="flex gap-2">
                      <input
                        placeholder={t.offerAmountPlaceholder || "المبلغ"}
                        type="number"
                        value={newOffer.amount}
                        onChange={(e) => setNewOffer({ ...newOffer, amount: e.target.value })}
                      />
                      <select
                        value={newOffer.currency}
                        onChange={(e) => setNewOffer({ ...newOffer, currency: e.target.value })}
                        style={{ width: 100 }}
                      >
                        <option value="EGP">EGP</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </div>
                    <button
                      onClick={() => addOffer(active)}
                      className="btn-press font-bold text-xs"
                      style={{ background: PRIMARY, color: "#fff", borderRadius: 8, padding: "8px 0" }}
                    >
                      {t.addOfferBtn || "إضافة العرض"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Activity Log */}
            <div style={{ borderTop: `0.5px solid ${LINE}`, marginTop: 12, paddingTop: 12 }}>
              <span className="flex items-center gap-2 text-sm font-bold mb-3"><StickyNote size={15} /> {t.activityLogLabel || "سجل النشاطات"}</span>
              
              {canEdit && (
                <div className="flex gap-2 mb-3">
                  <input
                    placeholder={t.addNotePlaceholder || "إضافة ملاحظة جديدة..."}
                    value={newActivityText}
                    onChange={(e) => setNewActivityText(e.target.value)}
                  />
                  <button
                    onClick={submitActivity}
                    className="btn-press font-bold text-xs px-4"
                    style={{ background: PRIMARY, color: "#fff", borderRadius: 10, flexShrink: 0 }}
                  >
                    {t.addBtn || "إضافة"}
                  </button>
                </div>
              )}

              <div className="flex flex-col gap-2">
                {activityLog.map((act) => (
                  <div key={act.id || act.at} className="flex items-start justify-between text-xs p-2 rounded-lg" style={{ background: SURFACE_SUBTLE }}>
                    <div>
                      <p className="font-bold" style={{ margin: 0, color: TEXT }}>{act.text}</p>
                      <span style={{ color: MUTED, fontSize: 10 }}>{fmtActivityDate(act.at, t.locale)}</span>
                    </div>
                    {canEdit && (
                      <button onClick={() => deleteActivity(act)} style={{ color: DANGER }} className="btn-press">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {canEdit && (
              <div className="flex items-center gap-2 mt-4 pt-3" style={{ borderTop: `0.5px solid ${LINE}` }}>
                <button
                  onClick={() => openEdit(active)}
                  className="btn-press flex-1 font-bold text-xs py-2 flex items-center justify-center gap-1"
                  style={{ background: SURFACE_SUBTLE, border: `1px solid ${LINE}`, borderRadius: 10, color: TEXT }}
                >
                  <Pencil size={14} /> {t.edit}
                </button>
                <button
                  onClick={() => deleteVisit(active.id)}
                  className="btn-press font-bold text-xs py-2 px-3 flex items-center justify-center gap-1"
                  style={{ background: "rgba(196,68,58,.1)", color: DANGER, borderRadius: 10 }}
                >
                  <Trash2 size={14} /> {t.delete}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Suppliers Screen */}
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
              placeholder={t.searchSuppliersPlaceholder || "بحث في الموردين..."}
              style={{ [t.dir === "rtl" ? "paddingRight" : "paddingLeft"]: 34, borderRadius: 14 }}
            />
          </div>

          {!suppliersLoaded && <p className="text-sm text-center py-8" style={{ color: MUTED }}>{t.loading}</p>}

          {suppliersLoaded && filteredSuppliers.length === 0 && (
            <div className="text-center py-16">
              <Truck size={40} color="#C7C4B6" className="mx-auto mb-2" />
              <p className="font-bold" style={{ color: TEXT }}>{t.noSuppliers || "لا يوجد موردين"}</p>
            </div>
          )}

          {filteredSuppliers.map((s) => (
            <div key={s.id} className="p-3 mb-2 rounded-xl" style={{ background: SURFACE, border: `1px solid ${LINE}` }}>
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">{s.name}</span>
                {canEdit && (
                  <button onClick={() => openEditSupplier(s)} className="btn-press" style={{ color: PRIMARY_MID }}>
                    <Pencil size={14} />
                  </button>
                )}
              </div>
              {s.category && <span className="text-xs font-bold block mt-1" style={{ color: GOLD }}>{s.category}</span>}
              {s.phone && <p className="text-xs mt-1" style={{ color: MUTED }}>{s.phone}</p>}
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

      {/* Supplier Form Screen */}
      {screen === "supplier-form" && canEdit && (
        <div className="px-4 pt-4 pb-10 flex flex-col gap-4">
          <div>
            <label>{t.supplierNameLabel || "اسم المورد *"}</label>
            <input
              value={supplierForm.name}
              onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
            />
            {supplierErrors.name && <p className="text-xs mt-1" style={{ color: DANGER }}>{supplierErrors.name}</p>}
          </div>
          <div>
            <label>{t.supplierCategoryLabel || "التصنيف / المجال"}</label>
            <input
              value={supplierForm.category}
              onChange={(e) => setSupplierForm({ ...supplierForm, category: e.target.value })}
            />
          </div>
          <div>
            <label>{t.phoneLabel}</label>
            <input
              type="tel"
              value={supplierForm.phone}
              onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
            />
          </div>
          <div>
            <label>{t.notesLabel}</label>
            <textarea
              rows={4}
              value={supplierForm.notes}
              onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })}
            />
          </div>
          <button
            onClick={saveSupplierForm}
            className="btn-press font-bold"
            style={{ background: PRIMARY, color: "#fff", borderRadius: 14, padding: "12px 0", marginTop: 8 }}
          >
            {t.save}
          </button>
          {activeSupplierId && (
            <button
              onClick={() => deleteSupplier(activeSupplierId)}
              className="btn-press font-bold text-xs"
              style={{ color: DANGER }}
            >
              {t.deleteSupplierBtn || "حذف المورد"}
            </button>
          )}
        </div>
      )}

      {/* Settings Screen */}
      {screen === "settings" && (
        <div className="px-4 pt-4 pb-24 flex flex-col gap-4">
          <div style={{ background: SURFACE, borderRadius: 14, border: `1px solid ${LINE}`, padding: 12 }}>
            <p className="font-bold text-sm mb-2">{t.dataManagement || "إدارة البيانات"}</p>
            {canEdit && (
              <div className="flex flex-col gap-2">
                <button
                  onClick={exportAllToExcel}
                  className="btn-press font-bold text-xs py-2 px-3 flex items-center justify-center gap-2 rounded-lg"
                  style={{ background: SURFACE_SUBTLE, border: `1px solid ${LINE}`, color: TEXT }}
                >
                  <Download size={14} /> {t.exportAll || "تصدير جميع العملاء (Excel)"}
                </button>
                <button
                  onClick={exportFilteredToExcel}
                  className="btn-press font-bold text-xs py-2 px-3 flex items-center justify-center gap-2 rounded-lg"
                  style={{ background: SURFACE_SUBTLE, border: `1px solid ${LINE}`, color: TEXT }}
                >
                  <Download size={14} /> {t.exportFiltered || "تصدير القائمة المفلترة (Excel)"}
                </button>
                <button
                  onClick={triggerImportPicker}
                  disabled={importing}
                  className="btn-press font-bold text-xs py-2 px-3 flex items-center justify-center gap-2 rounded-lg"
                  style={{ background: SURFACE_SUBTLE, border: `1px solid ${LINE}`, color: TEXT }}
                >
                  <Upload size={14} /> {importing ? (t.importing || "جاري الاستيراد...") : (t.importExcel || "استيراد من ملف Excel")}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls"
                  style={{ display: "none" }}
                  onChange={handleImportFile}
                />
              </div>
            )}
          </div>

          {availableOwners.length > 1 && (
            <div style={{ background: SURFACE, borderRadius: 14, border: `1px solid ${LINE}`, padding: 12 }}>
              <p className="font-bold text-sm mb-2">{t.switchWorkspace || "تبديل بيئة العمل"}</p>
              <div className="flex flex-col gap-1">
                {availableOwners.map((item) => (
                  <button
                    key={item.uid}
                    onClick={() => switchOwnerWorkspace(item.uid)}
                    className="btn-press p-2 text-xs font-bold rounded-lg text-right flex items-center justify-between"
                    style={{
                      background: ownerUid === item.uid ? PRIMARY_MID : SURFACE_SUBTLE,
                      color: ownerUid === item.uid ? "#fff" : TEXT,
                    }}
                  >
                    <span>{item.uid === user.uid ? (t.myWorkspace || "مساحة عملي الخاصة") : item.uid}</span>
                    <span className="text-xs font-normal">({item.role})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {isOwnerAccount && (
            <div style={{ background: SURFACE, borderRadius: 14, border: `1px solid ${LINE}`, padding: 12 }}>
              <p className="font-bold text-sm mb-2">{t.teamManagement || "إدارة الفريق الصلاحيات"}</p>
              <div className="flex gap-2 mb-3">
                <input
                  type="email"
                  placeholder={t.memberEmailPlaceholder || "البريد الإلكتروني للفيصل"}
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                />
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value)}
                  style={{ width: 100 }}
                >
                  <option value="editor">{t.roleEditor || "محرر"}</option>
                  <option value="viewer">{t.roleViewer || "مشاهد"}</option>
                </select>
                <button
                  onClick={() => {
                    grantAccess(newMemberEmail, newMemberRole);
                    setNewMemberEmail("");
                  }}
                  className="btn-press font-bold text-xs px-3 rounded-lg"
                  style={{ background: PRIMARY, color: "#fff" }}
                >
                  {t.addBtn || "إضافة"}
                </button>
              </div>

              <div className="flex flex-col gap-1">
                {Object.entries(members).map(([mEmail, mRole]) => (
                  <div key={mEmail} className="flex items-center justify-between p-2 rounded-lg text-xs" style={{ background: SURFACE_SUBTLE }}>
                    <span>{mEmail} ({mRole})</span>
                    <button onClick={() => revokeAccess(mEmail)} style={{ color: DANGER }} className="btn-press">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Undo Delete Toast */}
      {pendingDelete && (
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{
            position: "fixed",
            bottom: 70,
            left: 16,
            right: 16,
            background: "#2C2C2E",
            color: "#fff",
            borderRadius: 12,
            zIndex: 30,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          <span className="text-xs font-bold">
            {t.deletedCustomerToast ? t.deletedCustomerToast(pendingDelete.companyName) : `تم حذف ${pendingDelete.companyName}`}
          </span>
          <button
            onClick={undoDelete}
            className="btn-press text-xs font-bold px-3 py-1 rounded-md"
            style={{ background: GOLD, color: "#fff" }}
          >
            {t.undo || "تراجع"}
          </button>
        </div>
      )}

      <BottomNav screen={screen} setScreen={setScreen} t={t} />
    </div>
  );
}
