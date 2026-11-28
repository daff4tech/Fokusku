import React, { useMemo, useState } from 'react';
import {
  Search,
  FilePlus2,
  FileSignature,
  FileText,
  MessageCircle,
  Download,
  Copy,
  Trash2,
  MoreVertical,
  ReceiptText,
  ArrowUpDown,
} from 'lucide-react';
import { StatusBadge, TypePill, EmptyState } from './ui.jsx';
import { calculateTotals, paidAmount, balanceDue, effectiveStatus, DOC_TYPE_META } from '../utils/documents.js';
import { formatDate } from '../utils/dates.js';
import { formatCurrency } from '../utils/currency.js';

const FILTERS = {
  all: { label: 'Semua' },
  draft: { label: 'Draf' },
  sent: { label: 'Terkirim' },
  partial: { label: 'Sebagian' },
  paid: { label: 'Lunas' },
  overdue: { label: 'Jatuh tempo' },
  accepted: { label: 'Disetujui' },
  declined: { label: 'Ditolak' },
};

const SORTS = {
  newest: 'Terbaru',
  due: 'Jatuh tempo',
  amount: 'Nominal terbesar',
  customer: 'Nama pelanggan',
};

export function DocumentList({
  type,
  documents,
  profile,
  onOpen,
  onNew,
  onWhatsApp,
  onDuplicate,
  onDelete,
  onDownload,
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [menuOpen, setMenuOpen] = useState(null);
  const currency = profile.currency || 'IDR';
  const meta = DOC_TYPE_META[type];

  const scoped = useMemo(() => documents.filter((d) => d.type === type), [documents, type]);

  const counts = useMemo(() => {
    const base = { all: scoped.length };
    scoped.forEach((doc) => {
      const status = effectiveStatus(doc);
      base[status] = (base[status] || 0) + 1;
    });
    return base;
  }, [scoped]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = scoped.filter((doc) => {
      const status = effectiveStatus(doc);
      if (filter !== 'all' && status !== filter) return false;
      if (!q) return true;
      return (
        doc.number?.toLowerCase().includes(q) ||
        doc.customer?.name?.toLowerCase().includes(q) ||
        doc.customer?.company?.toLowerCase().includes(q) ||
        (doc.items || []).some((i) => i.name?.toLowerCase().includes(q))
      );
    });

    list = [...list].sort((a, b) => {
      if (sort === 'amount') return calculateTotals(b).total - calculateTotals(a).total;
      if (sort === 'customer') return (a.customer?.name || '').localeCompare(b.customer?.name || '');
      if (sort === 'due') {
        const av = a.dueDate || a.validUntil || '';
        const bv = b.dueDate || b.validUntil || '';
        return av.localeCompare(bv);
      }
      return new Date(b.updatedAt || b.issueDate) - new Date(a.updatedAt || a.issueDate);
    });
    return list;
  }, [scoped, query, filter, sort]);

  const availableFilters = useMemo(() => {
    const list = ['all'];
    Object.keys(FILTERS).forEach((key) => {
      if (key === 'all') return;
      if (counts[key]) list.push(key);
    });
    return list;
  }, [counts]);

  const summary = useMemo(() => {
    let total = 0;
    let unpaid = 0;
    scoped.forEach((doc) => {
      const status = effectiveStatus(doc);
      if (status === 'cancelled') return;
      total += calculateTotals(doc).total;
      unpaid += balanceDue(doc);
    });
    return { total, unpaid };
  }, [scoped]);

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="toolbar">
        <div className="search-box">
          <Search size={15} />
          <input
            className="input"
            placeholder={`Cari nomor, pelanggan, atau item…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Cari dokumen"
          />
        </div>
        <div className="flex items-center gap-8" style={{ marginLeft: 'auto' }}>
          <div className="flex items-center gap-6 tiny muted" style={{ whiteSpace: 'nowrap' }}>
            <ArrowUpDown size={12} />
            <select
              className="input"
              style={{ padding: '7px 9px', fontSize: 12, width: 'auto' }}
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Urutkan"
            >
              {Object.entries(SORTS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onNew(type)}
            style={{ whiteSpace: 'nowrap' }}
          >
            {type === 'invoice' ? <FilePlus2 size={15} /> : <FileSignature size={15} />}
            {type === 'invoice' ? 'Invoice baru' : 'Penawaran baru'}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between wrap gap-10">
        <div className="tabs">
          {availableFilters.map((key) => (
            <button
              key={key}
              type="button"
              className={`tab${filter === key ? ' active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {FILTERS[key].label}
              <span className="tab-count">{counts[key] || 0}</span>
            </button>
          ))}
        </div>
        <div className="tiny muted" style={{ whiteSpace: 'nowrap' }}>
          Total {formatCurrency(summary.total, currency)} · Sisa{' '}
          <strong style={{ color: 'var(--text)' }}>{formatCurrency(summary.unpaid, currency)}</strong>
        </div>
      </div>

      <div className="card" style={{ overflow: 'visible' }}>
        {rows.length === 0 ? (
          <EmptyState
            icon={type === 'invoice' ? ReceiptText : FileSignature}
            title={query || filter !== 'all' ? 'Tidak ada hasil' : `Belum ada ${meta.shortLabel.toLowerCase()}`}
            description={
              query || filter !== 'all'
                ? 'Coba ubah kata kunci atau filter status.'
                : `Buat ${meta.shortLabel.toLowerCase()} pertama Anda — isi pelanggan dan item, lalu kirim sebagai PDF.`
            }
            action={
              !query && filter === 'all' ? (
                <button type="button" className="btn btn-primary" onClick={() => onNew(type)}>
                  <FilePlus2 size={15} /> Buat sekarang
                </button>
              ) : null
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Dokumen</th>
                  <th>Pelanggan</th>
                  <th>{type === 'invoice' ? 'Jatuh tempo' : 'Berlaku s/d'}</th>
                  <th>Status</th>
                  <th className="num">Total</th>
                  <th className="num" style={{ width: 132 }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((doc) => {
                  const status = effectiveStatus(doc);
                  const totals = calculateTotals(doc);
                  const paid = paidAmount(doc);
                  return (
                    <tr key={doc.id} onClick={() => onOpen(doc)}>
                      <td>
                        <div className="doc-cell">
                          <div className={`doc-icon${doc.type === 'quote' ? ' quote' : ''}`}>
                            {doc.type === 'quote' ? <FileSignature size={16} /> : <FileText size={16} />}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <strong>{doc.number || 'Tanpa nomor'}</strong>
                            <span>
                              {formatDate(doc.issueDate)} · {totals.itemCount} item
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: 13, fontWeight: 580 }}>{doc.customer?.name || '—'}</div>
                        {doc.customer?.company && (
                          <div className="tiny muted">{doc.customer.company}</div>
                        )}
                      </td>
                      <td className="tiny" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {formatDate(doc.type === 'quote' ? doc.validUntil || doc.dueDate : doc.dueDate)}
                      </td>
                      <td>
                        <StatusBadge status={status} />
                        {status === 'partial' && paid > 0 && (
                          <div className="tiny muted" style={{ marginTop: 3 }}>
                            {formatCurrency(paid, currency, { symbol: false })} terbayar
                          </div>
                        )}
                      </td>
                      <td className="num">
                        <div className="strong">{formatCurrency(totals.total, currency)}</div>
                        {status === 'partial' && (
                          <div className="tiny muted">
                            sisa {formatCurrency(balanceDue(doc), currency)}
                          </div>
                        )}
                      </td>
                      <td onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon"
                            title="Kirim WhatsApp"
                            onClick={() => onWhatsApp(doc)}
                          >
                            <MessageCircle size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon"
                            title="Unduh PDF"
                            onClick={() => onDownload(doc)}
                          >
                            <Download size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon"
                            title="Menu lainnya"
                            onClick={() => setMenuOpen(menuOpen === doc.id ? null : doc.id)}
                          >
                            <MoreVertical size={15} />
                          </button>
                        </div>
                        {menuOpen === doc.id && (
                          <>
                            <div
                              style={{ position: 'fixed', inset: 0, zIndex: 39 }}
                              onClick={() => setMenuOpen(null)}
                              role="presentation"
                            />
                            <div
                              style={{
                                position: 'absolute',
                                right: 10,
                                top: 44,
                                zIndex: 40,
                                background: 'var(--bg-elevated)',
                                border: '1px solid var(--border)',
                                borderRadius: 10,
                                boxShadow: 'var(--shadow-lg)',
                                padding: 5,
                                minWidth: 172,
                                display: 'flex',
                                flexDirection: 'column',
                              }}
                            >
                              <button
                                type="button"
                                className="nav-item"
                                style={{ fontSize: 12.5, padding: '7px 9px' }}
                                onClick={() => {
                                  onOpen(doc);
                                  setMenuOpen(null);
                                }}
                              >
                                <FileText size={14} /> Buka editor
                              </button>
                              <button
                                type="button"
                                className="nav-item"
                                style={{ fontSize: 12.5, padding: '7px 9px' }}
                                onClick={() => {
                                  onDuplicate(doc);
                                  setMenuOpen(null);
                                }}
                              >
                                <Copy size={14} /> Duplikat
                              </button>
                              <button
                                type="button"
                                className="nav-item"
                                style={{ fontSize: 12.5, padding: '7px 9px', color: 'var(--danger)' }}
                                onClick={() => {
                                  onDelete(doc);
                                  setMenuOpen(null);
                                }}
                              >
                                <Trash2 size={14} /> Hapus
                              </button>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
