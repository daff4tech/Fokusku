import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  MessageCircle,
  CheckCircle2,
  Wallet,
  Tag,
  Save,
  UserRound,
  Building2,
  Clock,
  Send,
  Ban,
  ThumbsUp,
  XCircle,
  Copy,
  Sparkles,
  ListPlus,
  MapPin,
} from 'lucide-react';
import { DocumentPreview } from './DocumentPreview.jsx';
import { PdfButtons } from './PdfActions.jsx';
import { MoneyInput, QtyInput, StatusBadge } from './ui.jsx';
import { Modal, ConfirmDialog } from './Modal.jsx';
import {
  DOC_TYPE_META,
  STATUS,
  calculateTotals,
  effectiveStatus,
  paidAmount,
  balanceDue,
  paymentProgress,
  createEmptyItem,
  lineTotal,
  uid,
} from '../utils/documents.js';
import { formatCurrency } from '../utils/currency.js';
import { addDaysISO, formatDate, todayISO } from '../utils/dates.js';
import { CURRENCIES } from '../utils/currency.js';
import { terbilang } from '../utils/terbilang.js';

const UNITS = ['pcs', 'box', 'porsi', 'pax', 'paket', 'set', 'unit', 'jam', 'hari', 'bulan', 'trip', 'orang', 'lusin', 'kg'];

const STATUS_ACTIONS = {
  invoice: [
    { status: STATUS.DRAFT, label: 'Draf', icon: Save },
    { status: STATUS.SENT, label: 'Tandai terkirim', icon: Send },
    { status: STATUS.PAID, label: 'Tandai lunas', icon: CheckCircle2 },
  ],
  quote: [
    { status: STATUS.DRAFT, label: 'Draf', icon: Save },
    { status: STATUS.SENT, label: 'Tandai terkirim', icon: Send },
    { status: STATUS.ACCEPTED, label: 'Disetujui', icon: ThumbsUp },
    { status: STATUS.DECLINED, label: 'Ditolak', icon: XCircle },
  ],
};

export function DocumentEditor({
  draft,
  onChange,
  onBack,
  onSave,
  onDelete,
  onDuplicate,
  onWhatsApp,
  profile,
  customers,
  onAddCustomer,
  isNew,
  toast,
  showTerbilang,
}) {
  const currency = (draft.currency || profile.currency || 'IDR');
  const meta = DOC_TYPE_META[draft.type] || DOC_TYPE_META.invoice;
  const isQuote = draft.type === 'quote';
  const totals = useMemo(() => calculateTotals(draft), [draft]);
  const paid = paidAmount(draft);
  const due = balanceDue(draft);
  const status = effectiveStatus(draft);
  const [paymentModal, setPaymentModal] = useState(false);
  const [customerModal, setCustomerModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dirty, setDirty] = useState(false);
  const savedTimer = useRef(null);

  useEffect(() => {
    setDirty(false);
  }, [draft.id]);

  const update = useCallback(
    (patch) => {
      onChange({ ...draft, ...patch });
      setDirty(true);
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setDirty(false), 1200);
    },
    [draft, onChange]
  );

  const updateCustomer = (patch) => update({ customer: { ...draft.customer, ...patch } });

  const updateItem = (id, patch) => {
    update({ items: draft.items.map((item) => (item.id === id ? { ...item, ...patch } : item)) });
  };

  const addItem = () => {
    update({ items: [...draft.items, createEmptyItem()] });
  };

  const duplicateItem = (item) => {
    const clone = { ...item, id: uid('itm') };
    const index = draft.items.findIndex((i) => i.id === item.id);
    const items = [...draft.items];
    items.splice(index + 1, 0, clone);
    update({ items });
  };

  const removeItem = (id) => {
    const items = draft.items.filter((item) => item.id !== id);
    update({ items: items.length ? items : [createEmptyItem()] });
  };

  const applyStatus = (nextStatus) => {
    const patch = { status: nextStatus };
    if (nextStatus === STATUS.PAID && !isQuote) {
      const remaining = balanceDue(draft);
      if (remaining > 0) {
        patch.status = STATUS.PAID;
        patch.payments = [
          ...(draft.payments || []),
          {
            id: uid('pay'),
            date: todayISO(),
            amount: remaining,
            method: profile.bankAccounts?.[0]?.bank ? `Transfer ${profile.bankAccounts[0].bank}` : 'Transfer',
            note: 'Pelunasan',
          },
        ];
        toast?.('Invoice ditandai lunas & pembayaran dicatat', 'success');
      }
    }
    update(patch);
  };

  const addPayment = (payment) => {
    const payments = [...(draft.payments || []), payment];
    const nextPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const patch = { payments };
    if (nextPaid >= totals.total - 0.5 && totals.total > 0) patch.status = STATUS.PAID;
    else if (nextPaid > 0) patch.status = STATUS.PARTIAL;
    update(patch);
    toast?.(`Pembayaran ${formatCurrency(payment.amount, currency)} dicatat`, 'success');
  };

  const removePayment = (id) => {
    const payments = (draft.payments || []).filter((p) => p.id !== id);
    const nextPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    let nextStatus = draft.status;
    if (nextPaid <= 0 && [STATUS.PAID, STATUS.PARTIAL].includes(draft.status)) nextStatus = STATUS.SENT;
    else if (nextPaid < totals.total - 0.5) nextStatus = nextPaid > 0 ? STATUS.PARTIAL : STATUS.SENT;
    update({ payments, status: nextStatus });
  };

  const payment = (
    <Modal
      open={paymentModal}
      onClose={() => setPaymentModal(false)}
      title="Catat pembayaran"
      description={`Sisa tagihan ${formatCurrency(due, currency)}`}
      footer={null}
    >
      <PaymentForm
        currency={currency}
        remaining={due}
        banks={profile.bankAccounts || []}
        onSubmit={(data) => {
          addPayment(data);
          setPaymentModal(false);
        }}
        onCancel={() => setPaymentModal(false)}
      />
    </Modal>
  );

  return (
    <div className="stack" style={{ gap: 14 }}>
      {/* Header editor */}
      <div className="flex items-center gap-10 wrap">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          <ArrowLeft size={15} /> Kembali
        </button>
        <div style={{ minWidth: 0 }} className="grow">
          <div className="flex items-center gap-8 wrap">
            <h2 style={{ fontSize: 17 }}>{draft.number || `(${meta.label} baru)`}</h2>
            <StatusBadge status={status} />
            {dirty && (
              <span className="tiny muted flex items-center gap-6">
                <Clock size={11} /> Menyimpan…
              </span>
            )}
          </div>
          <div className="tiny muted">
            {meta.label} · {draft.customer?.name || 'Pelanggan belum diisi'} ·{' '}
            {formatCurrency(totals.total, currency)}
          </div>
        </div>
        <div className="flex items-center gap-6 wrap">
          <button type="button" className="btn btn-wa btn-sm" onClick={() => onWhatsApp(draft)}>
            <MessageCircle size={14} /> WhatsApp
          </button>
          <PdfButtons
            doc={draft}
            profile={{ ...profile, currency }}
            options={{ showTerbilang, accent: profile.accentColor }}
            compact
            onToast={toast}
          />
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onSave(draft)}>
            <Save size={14} /> Simpan
          </button>
        </div>
      </div>

      <div className="editor-layout">
        <div className="editor-main">
          {/* Informasi dokumen */}
          <section className="card">
            <div className="card-head">
              <h3>Informasi dokumen</h3>
              <span className={`type-pill${isQuote ? ' quote' : ''}`} style={{ marginLeft: 'auto' }}>
                {meta.title}
              </span>
            </div>
            <div className="card-body stack" style={{ gap: 14 }}>
              <div className="form-grid three">
                <div className="field">
                  <label htmlFor="doc-number">Nomor {meta.shortLabel.toLowerCase()}</label>
                  <input
                    id="doc-number"
                    className="input mono"
                    value={draft.number}
                    onChange={(e) => update({ number: e.target.value })}
                    placeholder="INV/202611/001"
                  />
                </div>
                <div className="field">
                  <label htmlFor="doc-date">{isQuote ? 'Tanggal penawaran' : 'Tanggal terbit'}</label>
                  <input
                    id="doc-date"
                    type="date"
                    className="input"
                    value={draft.issueDate}
                    onChange={(e) => update({ issueDate: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="doc-due">{isQuote ? 'Berlaku sampai' : 'Jatuh tempo'}</label>
                  <input
                    id="doc-due"
                    type="date"
                    className="input"
                    value={isQuote ? draft.validUntil || '' : draft.dueDate || ''}
                    onChange={(e) =>
                      update(isQuote ? { validUntil: e.target.value } : { dueDate: e.target.value })
                    }
                  />
                  <div className="chip-row" style={{ marginTop: 2 }}>
                    {[0, 7, 14, 30].map((days) => (
                      <button
                        key={days}
                        type="button"
                        className="chip"
                        style={{ padding: '2px 7px', fontSize: 11 }}
                        onClick={() =>
                          update(
                            isQuote
                              ? { validUntil: addDaysISO(draft.issueDate, days) }
                              : { dueDate: addDaysISO(draft.issueDate, days) }
                          )
                        }
                      >
                        {days === 0 ? 'Hari ini' : `+${days} hari`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-8 wrap">
                <span className="tiny muted">Status:</span>
                {(STATUS_ACTIONS[draft.type] || STATUS_ACTIONS.invoice).map((action) => {
                  const Icon = action.icon;
                  const active =
                    action.status === STATUS.PAID ? status === STATUS.PAID : draft.status === action.status;
                  return (
                    <button
                      key={action.status}
                      type="button"
                      className={`chip${active ? ' active' : ''}`}
                      onClick={() => applyStatus(action.status)}
                    >
                      <Icon size={12} /> {action.label}
                    </button>
                  );
                })}
                {draft.type === 'invoice' && (
                  <button type="button" className="chip" onClick={() => applyStatus(STATUS.CANCELLED)}>
                    <Ban size={12} /> Batalkan
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Pelanggan */}
          <section className="card">
            <div className="card-head">
              <h3>Pelanggan</h3>
              <div className="flex items-center gap-6" style={{ marginLeft: 'auto' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCustomerModal(true)}>
                  <Plus size={13} /> Pelanggan baru
                </button>
              </div>
            </div>
            <div className="card-body stack" style={{ gap: 14 }}>
              {customers.length > 0 && (
                <div className="field">
                  <label htmlFor="cust-pick">Pilih dari daftar pelanggan</label>
                  <select
                    id="cust-pick"
                    className="select"
                    value={draft.customerId || ''}
                    onChange={(e) => {
                      const found = customers.find((c) => c.id === e.target.value);
                      if (found) {
                        update({
                          customerId: found.id,
                          customer: {
                            name: found.name || '',
                            company: found.company || '',
                            phone: found.phone || '',
                            email: found.email || '',
                            address: found.address || '',
                          },
                        });
                      } else {
                        update({ customerId: null });
                      }
                    }}
                  >
                    <option value="">— Ketik manual di bawah —</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.company ? ` — ${c.company}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-grid">
                <div className="field">
                  <label htmlFor="cust-name">Nama pelanggan</label>
                  <input
                    id="cust-name"
                    className="input"
                    value={draft.customer?.name || ''}
                    onChange={(e) => updateCustomer({ name: e.target.value })}
                    placeholder="Nama lengkap"
                  />
                </div>
                <div className="field">
                  <label htmlFor="cust-company">Perusahaan / instansi</label>
                  <input
                    id="cust-company"
                    className="input"
                    value={draft.customer?.company || ''}
                    onChange={(e) => updateCustomer({ company: e.target.value })}
                    placeholder="Opsional"
                  />
                </div>
                <div className="field">
                  <label htmlFor="cust-phone">Nomor WhatsApp</label>
                  <input
                    id="cust-phone"
                    className="input"
                    inputMode="tel"
                    value={draft.customer?.phone || ''}
                    onChange={(e) => updateCustomer({ phone: e.target.value })}
                    placeholder="0812 3456 7890"
                  />
                </div>
                <div className="field">
                  <label htmlFor="cust-email">Email</label>
                  <input
                    id="cust-email"
                    className="input"
                    type="email"
                    value={draft.customer?.email || ''}
                    onChange={(e) => updateCustomer({ email: e.target.value })}
                    placeholder="opsional@email.com"
                  />
                </div>
                <div className="field span-2">
                  <label htmlFor="cust-address">Alamat</label>
                  <input
                    id="cust-address"
                    className="input"
                    value={draft.customer?.address || ''}
                    onChange={(e) => updateCustomer({ address: e.target.value })}
                    placeholder="Alamat penagihan"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Item */}
          <section className="card">
            <div className="card-head">
              <h3>{meta.itemsHeading}</h3>
              <span className="tiny muted" style={{ marginLeft: 'auto' }}>
                {totals.itemCount} item
              </span>
            </div>
            <div className="card-body">
              <div style={{ overflowX: 'auto' }}>
                <table className="items-table">
                  <colgroup>
                    <col style={{ width: '44%' }} />
                    <col style={{ width: 74 }} />
                    <col style={{ width: 86 }} />
                    <col style={{ width: 116 }} />
                    <col style={{ width: 110 }} />
                    <col style={{ width: 40 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Deskripsi</th>
                      <th className="num">Qty</th>
                      <th>Satuan</th>
                      <th className="num">Harga</th>
                      <th className="num">Jumlah</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {draft.items.map((item, index) => (
                      <tr key={item.id}>
                        <td>
                          <input
                            className="input"
                            value={item.name}
                            onChange={(e) => updateItem(item.id, { name: e.target.value })}
                            placeholder={index === 0 ? 'Contoh: Nasi box ayam bakar' : 'Nama item'}
                            aria-label={`Nama item ${index + 1}`}
                          />
                          <input
                            className="input item-desc"
                            style={{ marginTop: 4, padding: '6px 9px', fontSize: 11.5 }}
                            value={item.description || ''}
                            onChange={(e) => updateItem(item.id, { description: e.target.value })}
                            placeholder="Keterangan (opsional)"
                            aria-label={`Keterangan item ${index + 1}`}
                          />
                        </td>
                        <td>
                          <QtyInput
                            value={item.qty}
                            ariaLabel={`Qty item ${index + 1}`}
                            onChange={(qty) => updateItem(item.id, { qty: qty === '' ? '' : qty })}
                          />
                        </td>
                        <td>
                          <input
                            className="input"
                            list="unit-list"
                            value={item.unit || ''}
                            onChange={(e) => updateItem(item.id, { unit: e.target.value })}
                            placeholder="pcs"
                            style={{ padding: '9px 8px', fontSize: 12.5 }}
                            aria-label={`Satuan item ${index + 1}`}
                          />
                        </td>
                        <td>
                          <MoneyInput
                            value={item.price}
                            currency={currency}
                            ariaLabel={`Harga item ${index + 1}`}
                            onChange={(price) => updateItem(item.id, { price })}
                          />
                        </td>
                        <td className="num">
                          <div className="line-amount">{formatCurrency(lineTotal(item), currency)}</div>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="row-remove"
                            title="Hapus item"
                            onClick={() => removeItem(item.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                          {index > 0 && (
                            <button
                              type="button"
                              className="row-remove"
                              title="Duplikat item"
                              onClick={() => duplicateItem(item)}
                              style={{ marginTop: 0 }}
                            >
                              <Copy size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <datalist id="unit-list">
                  {UNITS.map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
              </div>

              <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 8 }} onClick={addItem}>
                <ListPlus size={14} /> Tambah item
              </button>

              <div className="divider" style={{ margin: '16px 0' }} />

              {/* Diskon, pajak, biaya */}
              <div className="form-grid three">
                <div className="field">
                  <label htmlFor="discount-type">Diskon</label>
                  <div className="input-group">
                    <select
                      className="select"
                      style={{ borderRadius: '9px 0 0 9px', borderRight: 'none', width: 86 }}
                      value={draft.discount?.type || 'none'}
                      onChange={(e) =>
                        update({ discount: { ...draft.discount, type: e.target.value, value: e.target.value === 'none' ? 0 : draft.discount?.value || 0 } })
                      }
                      aria-label="Jenis diskon"
                    >
                      <option value="none">Tanpa</option>
                      <option value="percent">%</option>
                      <option value="amount">Rp</option>
                    </select>
                    {draft.discount?.type === 'percent' ? (
                      <QtyInput
                        value={draft.discount?.value ?? 0}
                        onChange={(value) => update({ discount: { ...draft.discount, value: value === '' ? 0 : value } })}
                        className="input"
                      />
                    ) : (
                      <MoneyInput
                        value={draft.discount?.value || 0}
                        currency={currency}
                        onChange={(value) => update({ discount: { ...draft.discount, value } })}
                        disabled={draft.discount?.type !== 'amount'}
                      />
                    )}
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="tax-rate">Pajak / PPN</label>
                  <div className="input-group">
                    <QtyInput
                      value={draft.tax?.rate ?? 0}
                      onChange={(rate) => update({ tax: { ...draft.tax, rate: rate === '' ? 0 : rate, enabled: true } })}
                      className="input"
                    />
                    <span className="prefix" style={{ borderLeft: 'none', borderRight: '1px solid var(--border)', borderRadius: '0 9px 9px 0' }}>
                      %
                    </span>
                  </div>
                  <label className="tiny muted flex items-center gap-6" style={{ marginTop: 2 }}>
                    <input
                      type="checkbox"
                      checked={draft.tax?.enabled !== false}
                      onChange={(e) => update({ tax: { ...draft.tax, enabled: e.target.checked } })}
                    />
                    Terapkan {draft.tax?.label || 'PPN'}
                  </label>
                </div>

                <div className="field">
                  <label htmlFor="withholding-rate">Potongan PPh 23</label>
                  <div className="input-group">
                    <QtyInput
                      value={draft.withholding?.rate ?? 0}
                      onChange={(rate) => update({ withholding: { ...draft.withholding, rate: rate === '' ? 0 : rate } })}
                      className="input"
                    />
                    <span className="prefix" style={{ borderLeft: 'none', borderRight: '1px solid var(--border)', borderRadius: '0 9px 9px 0' }}>
                      %
                    </span>
                  </div>
                  <label className="tiny muted flex items-center gap-6" style={{ marginTop: 2 }}>
                    <input
                      type="checkbox"
                      checked={!!draft.withholding?.enabled}
                      onChange={(e) => update({ withholding: { ...draft.withholding, enabled: e.target.checked } })}
                    />
                    Kurangi total (opsional)
                  </label>
                </div>
              </div>

              {/* Biaya tambahan */}
              <div style={{ marginTop: 14 }}>
                <div className="section-title" style={{ marginBottom: 8 }}>
                  <Tag size={13} /> Biaya tambahan
                </div>
                {(draft.extras || []).map((extra) => (
                  <div key={extra.id} className="flex items-center gap-6" style={{ marginBottom: 7 }}>
                    <input
                      className="input"
                      value={extra.label}
                      placeholder="Contoh: Ongkos kirim"
                      onChange={(e) =>
                        update({
                          extras: draft.extras.map((x) => (x.id === extra.id ? { ...x, label: e.target.value } : x)),
                        })
                      }
                      style={{ flex: 2 }}
                    />
                    <select
                      className="select"
                      value={extra.mode || 'add'}
                      onChange={(e) =>
                        update({
                          extras: draft.extras.map((x) => (x.id === extra.id ? { ...x, mode: e.target.value } : x)),
                        })
                      }
                      style={{ flex: '0 0 108px', padding: '9px 8px' }}
                    >
                      <option value="add">Tambah</option>
                      <option value="discount">Kurangi</option>
                    </select>
                    <div style={{ flex: 1.2 }}>
                      <MoneyInput
                        value={extra.amount}
                        currency={currency}
                        onChange={(amount) =>
                          update({
                            extras: draft.extras.map((x) => (x.id === extra.id ? { ...x, amount } : x)),
                          })
                        }
                      />
                    </div>
                    <button
                      type="button"
                      className="row-remove"
                      onClick={() => update({ extras: draft.extras.filter((x) => x.id !== extra.id) })}
                      title="Hapus biaya"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() =>
                    update({ extras: [...(draft.extras || []), { id: uid('ext'), label: '', amount: 0, mode: 'add' }] })
                  }
                >
                  <Plus size={13} /> Tambah biaya / potongan
                </button>
              </div>

              <div className="divider" style={{ margin: '16px 0' }} />
              <TotalsSummary totals={totals} currency={currency} paid={isQuote ? 0 : paid} isQuote={isQuote} meta={meta} />
            </div>
          </section>

          {/* Pembayaran */}
          {!isQuote && (
            <section className="card">
              <div className="card-head">
                <h3>Pembayaran</h3>
                <button type="button" className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setPaymentModal(true)}>
                  <Wallet size={13} /> Catat pembayaran
                </button>
              </div>
              <div className="card-body stack" style={{ gap: 12 }}>
                <div>
                  <div className="flex justify-between tiny muted" style={{ marginBottom: 6 }}>
                    <span>
                      Diterima {formatCurrency(paid, currency)} dari {formatCurrency(totals.total, currency)}
                    </span>
                    <span>{Math.round(paymentProgress(draft) * 100)}%</span>
                  </div>
                  <div className="progress">
                    <span style={{ width: `${Math.round(paymentProgress(draft) * 100)}%` }} />
                  </div>
                </div>
                {(draft.payments || []).length === 0 ? (
                  <p className="small muted">
                    Belum ada pembayaran tercatat. Klik <strong>Catat pembayaran</strong> setelah dana masuk agar status
                    invoice otomatis terupdate.
                  </p>
                ) : (
                  <div className="stack" style={{ gap: 7 }}>
                    {draft.payments.map((p) => (
                      <div key={p.id} className="payment-item">
                        <div className="grow">
                          <div style={{ fontWeight: 600 }}>{formatCurrency(p.amount, currency)}</div>
                          <small>
                            {formatDate(p.date)} · {p.method || 'Transfer'}
                            {p.note ? ` · ${p.note}` : ''}
                          </small>
                        </div>
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon"
                          onClick={() => removePayment(p.id)}
                          title="Hapus pembayaran"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {due > 0 && status !== 'draft' && !isQuote && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      if (draft.customer?.phone) onWhatsApp(draft, 'reminder');
                      else toast?.('Isi nomor WhatsApp pelanggan terlebih dahulu', 'error');
                    }}
                  >
                    <MessageCircle size={13} /> Kirim pengingat pembayaran
                  </button>
                )}
              </div>
            </section>
          )}

          {/* Catatan & syarat */}
          <section className="card">
            <div className="card-head">
              <h3>Catatan &amp; syarat</h3>
            </div>
            <div className="card-body form-grid">
              <div className="field">
                <label htmlFor="doc-notes">Catatan untuk pelanggan</label>
                <textarea
                  id="doc-notes"
                  className="textarea"
                  value={draft.notes || ''}
                  onChange={(e) => update({ notes: e.target.value })}
                  placeholder="Mis. ucapan terima kasih atau info tambahan"
                />
              </div>
              <div className="field">
                <label htmlFor="doc-terms">{isQuote ? 'Syarat & ketentuan' : 'Syarat pembayaran'}</label>
                <textarea
                  id="doc-terms"
                  className="textarea"
                  value={draft.terms || ''}
                  onChange={(e) => update({ terms: e.target.value })}
                  placeholder="Mis. DP 50%, denda keterlambatan"
                />
              </div>
              <div className="field">
                <label htmlFor="doc-sign">Label tanda tangan</label>
                <input
                  id="doc-sign"
                  className="input"
                  value={draft.signatureLabel || ''}
                  onChange={(e) => update({ signatureLabel: e.target.value })}
                  placeholder="Hormat kami,"
                />
              </div>
              <div className="field">
                <label htmlFor="doc-currency">Mata uang</label>
                <select
                  id="doc-currency"
                  className="select"
                  value={currency}
                  onChange={(e) => update({ currency: e.target.value })}
                >
                  {Object.values(CURRENCIES).map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="card-foot">
              <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={13} /> Hapus dokumen
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onDuplicate(draft)}>
                <Copy size={13} /> Duplikat
              </button>
              <div style={{ marginLeft: 'auto' }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => onSave(draft)}>
                  <Save size={13} /> Simpan perubahan
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Preview */}
        <aside className="preview-pane no-print">
          <div className="flex items-center justify-between">
            <span className="tiny muted flex items-center gap-6">
              <Sparkles size={12} /> Pratinjau langsung
            </span>
            <span className="tiny muted">A4 · PDF</span>
          </div>
          <div className="preview-frame">
            <DocumentPreview doc={draft} profile={{ ...profile, currency }} />
          </div>
          <div className="preview-actions">
            <PdfButtons
              doc={draft}
              profile={{ ...profile, currency }}
              options={{ showTerbilang, accent: profile.accentColor }}
              onToast={toast}
            />
          </div>
          <div className="flex gap-8">
            <button type="button" className="btn btn-wa grow" onClick={() => onWhatsApp(draft)}>
              <MessageCircle size={15} /> Kirim via WhatsApp
            </button>
          </div>
        </aside>
      </div>

      {payment}

      <CustomerQuickAdd
        open={customerModal}
        onClose={() => setCustomerModal(false)}
        onSubmit={(customer) => {
          onAddCustomer(customer);
          update({
            customerId: customer.id,
            customer: {
              name: customer.name,
              company: customer.company,
              phone: customer.phone,
              email: customer.email,
              address: customer.address,
            },
          });
          setCustomerModal(false);
          toast?.('Pelanggan ditambahkan', 'success');
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => onDelete(draft)}
        title="Hapus dokumen?"
        message={`Dokumen ${draft.number || ''} akan dihapus permanen dari perangkat ini. Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus"
        danger
      />
    </div>
  );
}

function TotalsSummary({ totals, currency, paid, isQuote, meta }) {
  return (
    <div className="totals">
      <div className="totals-row">
        <span>Subtotal ({totals.itemCount} item)</span>
        <span className="value">{formatCurrency(totals.itemsTotal, currency)}</span>
      </div>
      {totals.discountValue > 0 && (
        <div className="totals-row discount">
          <span>Diskon</span>
          <span className="value" style={{ color: 'var(--success)' }}>
            − {formatCurrency(totals.discountValue, currency)}
          </span>
        </div>
      )}
      {totals.extraTotal !== 0 && (
        <div className="totals-row">
          <span>Biaya tambahan</span>
          <span className="value">{formatCurrency(totals.extraTotal, currency)}</span>
        </div>
      )}
      {totals.taxValue > 0 && (
        <div className="totals-row">
          <span>Pajak</span>
          <span className="value">{formatCurrency(totals.taxValue, currency)}</span>
        </div>
      )}
      {totals.withholdingValue > 0 && (
        <div className="totals-row">
          <span>Potongan PPh</span>
          <span className="value">− {formatCurrency(totals.withholdingValue, currency)}</span>
        </div>
      )}
      {!isQuote && paid > 0 && (
        <div className="totals-row">
          <span>Sudah dibayar</span>
          <span className="value">− {formatCurrency(paid, currency)}</span>
        </div>
      )}
      <div className="totals-row grand">
        <span>{!isQuote && paid > 0 ? 'Sisa tagihan' : meta.totalLabel}</span>
        <span className="value">
          {formatCurrency(!isQuote && paid > 0 ? Math.max(0, totals.total - paid) : totals.total, currency)}
        </span>
      </div>
      <div className="totals-row muted">
        <span>Terbilang</span>
      </div>
      <div className="tiny muted" style={{ fontStyle: 'italic', textAlign: 'right', marginTop: -2 }}>
        {terbilang(totals.total, currency)}
      </div>
    </div>
  );
}

function PaymentForm({ currency, remaining, banks, onSubmit, onCancel }) {
  const [amount, setAmount] = useState(remaining || 0);
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState(banks[0] ? `Transfer ${banks[0].bank}` : 'Transfer');
  const [note, setNote] = useState('');

  return (
    <form
      className="stack"
      style={{ gap: 13 }}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ id: uid('pay'), date, amount, method, note });
      }}
    >
      <div className="field">
        <label htmlFor="pay-amount">Jumlah diterima</label>
        <MoneyInput id="pay-amount" value={amount} currency={currency} onChange={setAmount} />
        <div className="chip-row">
          <button type="button" className="chip" onClick={() => setAmount(remaining)}>
            Lunasi {formatCurrency(remaining, currency)}
          </button>
          <button type="button" className="chip" onClick={() => setAmount(Math.round((remaining / 2) * 100) / 100)}>
            50%
          </button>
          <button type="button" className="chip" onClick={() => setAmount(Math.round((remaining / 4) * 100) / 100)}>
            25%
          </button>
        </div>
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="pay-date">Tanggal</label>
          <input id="pay-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pay-method">Metode</label>
          <select id="pay-method" className="select" value={method} onChange={(e) => setMethod(e.target.value)}>
            {banks.map((b) => (
              <option key={b.id} value={`Transfer ${b.bank}`}>
                Transfer {b.bank}
              </option>
            ))}
            <option value="Tunai">Tunai</option>
            <option value="QRIS">QRIS</option>
            <option value="E-wallet">E-wallet</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="pay-note">Catatan</label>
        <input id="pay-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Mis. DP 50%, pelunasan" />
      </div>
      <div className="flex gap-8" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-outline" onClick={onCancel}>
          Batal
        </button>
        <button type="submit" className="btn btn-primary" disabled={!amount || amount <= 0}>
          <CheckCircle2 size={15} /> Simpan pembayaran
        </button>
      </div>
    </form>
  );
}

export function CustomerQuickAdd({ open, onClose, onSubmit, initial }) {
  const [form, setForm] = useState({ name: '', company: '', phone: '', email: '', address: '' });

  useEffect(() => {
    if (open) {
      setForm(initial || { name: '', company: '', phone: '', email: '', address: '' });
    }
  }, [open, initial]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit pelanggan' : 'Pelanggan baru'}
      description="Data pelanggan dipakai ulang untuk dokumen berikutnya."
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Batal
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!form.name.trim()}
            onClick={() => onSubmit({ id: initial?.id || uid('cus'), ...form })}
          >
            <Save size={15} /> Simpan
          </button>
        </>
      }
    >
      <div className="form-grid">
        <div className="field">
          <label htmlFor="qa-name">
            <UserRound size={12} /> Nama
          </label>
          <input id="qa-name" className="input" value={form.name} onChange={set('name')} autoFocus />
        </div>
        <div className="field">
          <label htmlFor="qa-company">
            <Building2 size={12} /> Perusahaan
          </label>
          <input id="qa-company" className="input" value={form.company} onChange={set('company')} />
        </div>
        <div className="field">
          <label htmlFor="qa-phone">WhatsApp</label>
          <input id="qa-phone" className="input" value={form.phone} onChange={set('phone')} inputMode="tel" />
        </div>
        <div className="field">
          <label htmlFor="qa-email">Email</label>
          <input id="qa-email" className="input" type="email" value={form.email} onChange={set('email')} />
        </div>
        <div className="field span-2">
          <label htmlFor="qa-address">
            <MapPin size={12} /> Alamat
          </label>
          <input id="qa-address" className="input" value={form.address} onChange={set('address')} />
        </div>
      </div>
    </Modal>
  );
}
