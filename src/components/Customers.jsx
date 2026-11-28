import React, { useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  Pencil,
  Trash2,
  MessageCircle,
  Users,
  FileText,
  Building2,
  ArrowUpRight,
} from 'lucide-react';
import { EmptyState, StatusBadge } from './ui.jsx';
import { Modal, ConfirmDialog } from './Modal.jsx';
import { CustomerQuickAdd } from './DocumentEditor.jsx';
import { calculateTotals, balanceDue, effectiveStatus } from '../utils/documents.js';
import { formatCurrency } from '../utils/currency.js';
import { formatDate } from '../utils/dates.js';
import { buildWhatsAppLink, formatPhoneDisplay } from '../utils/whatsapp.js';
import { openExternal } from '../utils/download.js';

export function Customers({ customers, documents, profile, onSave, onDelete, onCreateInvoice, onOpenDoc, toast }) {
  const currency = profile.currency || 'IDR';
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [detail, setDetail] = useState(null);
  const [addOpen, setAddOpen] = useState(false);

  const enriched = useMemo(() => {
    return customers.map((customer) => {
      const docs = documents.filter(
        (d) => d.customerId === customer.id || d.customer?.name === customer.name
      );
      const invoices = docs.filter((d) => d.type === 'invoice');
      const total = invoices.reduce((s, d) => s + calculateTotals(d).total, 0);
      const outstanding = invoices
        .filter((d) => !['paid', 'draft', 'cancelled'].includes(effectiveStatus(d)))
        .reduce((s, d) => s + balanceDue(d), 0);
      const last = [...docs].sort(
        (a, b) => new Date(b.issueDate) - new Date(a.issueDate)
      )[0];
      return { ...customer, docCount: docs.length, invoiceCount: invoices.length, total, outstanding, last, docs };
    });
  }, [customers, documents]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return enriched;
    return enriched.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.email?.toLowerCase().includes(q)
    );
  }, [enriched, query]);

  const totalOutstanding = enriched.reduce((s, c) => s + c.outstanding, 0);

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="toolbar">
        <div className="search-box">
          <Search size={15} />
          <input
            className="input"
            placeholder="Cari nama, perusahaan, atau nomor…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Cari pelanggan"
          />
        </div>
        <div className="flex items-center gap-10" style={{ marginLeft: 'auto' }}>
          <span className="tiny muted">
            {customers.length} pelanggan · piutang {formatCurrency(totalOutstanding, currency)}
          </span>
          <button type="button" className="btn btn-primary" onClick={() => setAddOpen(true)}>
            <Plus size={15} /> Pelanggan baru
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Users}
            title={query ? 'Pelanggan tidak ditemukan' : 'Belum ada pelanggan'}
            description={
              query
                ? 'Coba kata kunci lain atau tambahkan pelanggan baru.'
                : 'Simpan data pelanggan agar bisa dipakai ulang saat membuat invoice berikutnya.'
            }
            action={
              <button type="button" className="btn btn-primary" onClick={() => setAddOpen(true)}>
                <Plus size={15} /> Tambah pelanggan
              </button>
            }
          />
        </div>
      ) : (
        <div className="customer-grid">
          {filtered.map((customer) => (
            <div className="card customer-card" key={customer.id}>
              <div className="customer-top">
                <div className="avatar">{(customer.name || 'P')[0].toUpperCase()}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {customer.name}
                  </div>
                  {customer.company && (
                    <div className="tiny muted flex items-center gap-6" style={{ marginTop: 1 }}>
                      <Building2 size={11} /> {customer.company}
                    </div>
                  )}
                </div>
                <div className="flex" style={{ gap: 2 }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    title="Edit"
                    onClick={() => setEditing(customer)}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    title="Hapus"
                    onClick={() => setConfirmDelete(customer)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="customer-contact">
                {customer.phone && (
                  <span>
                    <Phone size={11} /> {formatPhoneDisplay(customer.phone)}
                  </span>
                )}
                {customer.email && (
                  <span>
                    <Mail size={11} /> {customer.email}
                  </span>
                )}
                {customer.address && (
                  <span>
                    <MapPin size={11} /> {customer.address}
                  </span>
                )}
              </div>

              <div className="customer-stats">
                <div>
                  <b>{formatCurrency(customer.total, currency)}</b>
                  Total {customer.invoiceCount} invoice
                </div>
                <div>
                  <b style={{ color: customer.outstanding > 0 ? 'var(--warning)' : 'var(--success)' }}>
                    {formatCurrency(customer.outstanding, currency)}
                  </b>
                  Piutang
                </div>
              </div>

              <div className="flex gap-6 wrap">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => onCreateInvoice(customer)}
                >
                  <FileText size={13} /> Invoice
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setDetail(customer)}
                >
                  Riwayat <ArrowUpRight size={13} />
                </button>
                {customer.phone && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon btn-sm"
                    title="Chat WhatsApp"
                    onClick={() =>
                      openExternal(
                        buildWhatsAppLink(
                          customer.phone,
                          `Halo Kak ${(customer.name || '').split(' ')[0]}, dari ${profile.businessName}.`
                        )
                      )
                    }
                  >
                    <MessageCircle size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <CustomerQuickAdd
        open={addOpen || Boolean(editing)}
        initial={editing}
        onClose={() => {
          setAddOpen(false);
          setEditing(null);
        }}
        onSubmit={(customer) => {
          onSave(customer);
          setAddOpen(false);
          setEditing(null);
          toast?.(editing ? 'Pelanggan diperbarui' : 'Pelanggan ditambahkan', 'success');
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          onDelete(confirmDelete);
          toast?.('Pelanggan dihapus', 'success');
        }}
        title="Hapus pelanggan?"
        message={`${confirmDelete?.name || ''} akan dihapus. Dokumen yang sudah ada tidak terpengaruh.`}
        confirmLabel="Hapus"
        danger
      />

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.name}
        description={detail?.company || 'Riwayat dokumen pelanggan'}
        size="lg"
        footer={
          <button type="button" className="btn btn-primary" onClick={() => { onCreateInvoice(detail); setDetail(null); }}>
            <FileText size={15} /> Buat invoice baru
          </button>
        }
      >
        <div className="flex gap-14 wrap">
          <div>
            <div className="tiny muted">Total ditagihkan</div>
            <strong style={{ fontSize: 16 }}>{formatCurrency(detail?.total || 0, currency)}</strong>
          </div>
          <div>
            <div className="tiny muted">Piutang</div>
            <strong style={{ fontSize: 16, color: 'var(--warning)' }}>
              {formatCurrency(detail?.outstanding || 0, currency)}
            </strong>
          </div>
          <div>
            <div className="tiny muted">Dokumen</div>
            <strong style={{ fontSize: 16 }}>{detail?.docCount || 0}</strong>
          </div>
        </div>
        {detail?.docs?.length ? (
          <div className="table-wrap" style={{ border: '1px solid var(--border)', borderRadius: 12 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Dokumen</th>
                  <th>Tanggal</th>
                  <th>Status</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {detail.docs
                  .slice()
                  .sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate))
                  .map((doc) => (
                    <tr key={doc.id} onClick={() => { onOpenDoc(doc); setDetail(null); }}>
                      <td>
                        <div className="strong">{doc.number}</div>
                        <div className="tiny muted">{doc.type === 'quote' ? 'Penawaran' : 'Invoice'}</div>
                      </td>
                      <td className="tiny">{formatDate(doc.issueDate)}</td>
                      <td>
                        <StatusBadge status={effectiveStatus(doc)} />
                      </td>
                      <td className="num strong">{formatCurrency(calculateTotals(doc).total, currency)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="small muted">Belum ada dokumen untuk pelanggan ini.</p>
        )}
      </Modal>
    </div>
  );
}
