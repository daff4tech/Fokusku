import React, { useMemo } from 'react';
import {
  FilePlus2,
  FileSignature,
  Users,
  Wallet,
  AlertTriangle,
  TrendingUp,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  MessageCircle,
  ChevronRight,
  Banknote,
  ReceiptText,
} from 'lucide-react';
import { StatCard, Money, StatusBadge, TypePill, EmptyState } from './ui.jsx';
import { calculateTotals, paidAmount, balanceDue, effectiveStatus, daysToDue } from '../utils/documents.js';
import { monthLabel, toDate } from '../utils/dates.js';
import { formatCurrency } from '../utils/currency.js';

export function Dashboard({ documents, customers, profile, onNavigate, onOpenDoc, onNew, onWhatsApp }) {
  const currency = profile.currency || 'IDR';
  const now = new Date();

  const stats = useMemo(() => {
    let outstanding = 0;
    let paidTotal = 0;
    let overdue = 0;
    let overdueCount = 0;
    let draftCount = 0;
    const invoices = documents.filter((d) => d.type === 'invoice');
    const quotes = documents.filter((d) => d.type === 'quote');

    invoices.forEach((doc) => {
      const status = effectiveStatus(doc, now);
      const total = calculateTotals(doc).total;
      const due = balanceDue(doc);
      paidTotal += paidAmount(doc);
      if (status !== 'draft' && status !== 'cancelled') outstanding += due;
      if (status === 'overdue') {
        overdue += due;
        overdueCount += 1;
      }
      if (status === 'draft') draftCount += 1;
    });

    const openQuotes = quotes.filter((q) => ['sent', 'draft'].includes(effectiveStatus(q, now)));
    const acceptedQuotes = quotes.filter((q) => effectiveStatus(q, now) === 'accepted');
    const conversion = quotes.length ? acceptedQuotes.length / quotes.length : 0;

    return {
      outstanding,
      paidTotal,
      overdue,
      overdueCount,
      draftCount,
      openQuotes,
      conversion,
      invoiceCount: invoices.length,
      quoteCount: quotes.length,
      total: invoices.reduce((sum, d) => sum + calculateTotals(d).total, 0),
    };
  }, [documents, now]);

  const monthly = useMemo(() => buildMonthlySeries(documents), [documents]);

  const attention = useMemo(() => {
    const list = [];
    documents.forEach((doc) => {
      const status = effectiveStatus(doc, now);
      if (doc.type === 'invoice' && status !== 'paid' && status !== 'draft' && status !== 'cancelled') {
        const days = daysToDue(doc, now);
        if (days != null && days <= 7) list.push({ doc, status, days });
      }
      if (doc.type === 'quote' && status === 'sent') {
        const days = daysToDue({ ...doc, dueDate: doc.validUntil || doc.dueDate }, now);
        if (days != null && days <= 5) list.push({ doc, status, days });
      }
    });
    return list.sort((a, b) => a.days - b.days).slice(0, 5);
  }, [documents, now]);

  const recent = useMemo(
    () =>
      [...documents]
        .sort((a, b) => new Date(b.updatedAt || b.issueDate) - new Date(a.updatedAt || a.issueDate))
        .slice(0, 5),
    [documents]
  );

  const topCustomers = useMemo(() => {
    const map = new Map();
    documents.forEach((doc) => {
      const key = doc.customer?.name || 'Tanpa nama';
      const entry = map.get(key) || { name: key, company: doc.customer?.company, total: 0, count: 0 };
      entry.total += calculateTotals(doc).total;
      entry.count += 1;
      map.set(key, entry);
    });
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 4);
  }, [documents]);

  const maxMonthly = Math.max(1, ...monthly.map((m) => Math.max(m.invoiced, m.received)));

  return (
    <div className="stack" style={{ gap: 18 }}>
      {stats.invoiceCount === 0 && stats.quoteCount === 0 && (
        <div className="card card-body">
          <EmptyState
            icon={ReceiptText}
            title="Belum ada dokumen"
            description="Mulai dengan membuat invoice pertama atau penawaran harga untuk calon pelanggan."
            action={
              <div className="flex gap-8" style={{ marginTop: 4 }}>
                <button type="button" className="btn btn-primary" onClick={() => onNew('invoice')}>
                  <FilePlus2 size={15} /> Invoice baru
                </button>
                <button type="button" className="btn btn-outline" onClick={() => onNew('quote')}>
                  <FileSignature size={15} /> Penawaran baru
                </button>
              </div>
            }
          />
        </div>
      )}

      <div className="stat-grid">
        <StatCard
          label="Piutang berjalan"
          value={<Money value={stats.outstanding} currency={currency} compact />}
          foot={
            <>
              <Clock size={12} /> {stats.invoiceCount - stats.draftCount} invoice aktif
            </>
          }
          icon={Wallet}
          tone="warning"
        />
        <StatCard
          label="Sudah diterima"
          value={<Money value={stats.paidTotal} currency={currency} compact />}
          foot={
            <>
              <CheckCircle2 size={12} /> Akumulasi pembayaran
            </>
          }
          icon={Banknote}
          tone="success"
        />
        <StatCard
          label="Lewat jatuh tempo"
          value={<Money value={stats.overdue} currency={currency} compact />}
          foot={
            <>
              <AlertTriangle size={12} /> {stats.overdueCount} invoice perlu ditagih
            </>
          }
          icon={AlertTriangle}
          tone="danger"
        />
        <StatCard
          label="Penawaran terbuka"
          value={stats.openQuotes.length}
          foot={
            <>
              <TrendingUp size={12} /> Konversi {Math.round(stats.conversion * 100)}%
            </>
          }
          icon={FileSignature}
          tone="info"
        />
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <h3>Arus kas 6 bulan</h3>
            <div className="chart-legend" style={{ marginLeft: 'auto' }}>
              <span>
                <i style={{ background: 'var(--primary)' }} />
                Ditagihkan
              </span>
              <span>
                <i style={{ background: '#34d399' }} />
                Diterima
              </span>
            </div>
          </div>
          <div className="card-body">
            <div className="chart-wrap">
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${monthly.length}, 1fr)`,
                  gap: 10,
                  alignItems: 'end',
                  height: 190,
                }}
              >
                {monthly.map((m) => (
                  <div key={m.key} style={{ display: 'flex', flexDirection: 'column', gap: 6, height: '100%' }}>
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        gap: 4,
                      }}
                      title={`${m.label}: Ditagihkan ${formatCurrency(m.invoiced, currency)} • Diterima ${formatCurrency(m.received, currency)}`}
                    >
                      <div
                        style={{
                          width: '42%',
                          height: `${Math.max(3, (m.invoiced / maxMonthly) * 100)}%`,
                          background: 'var(--primary)',
                          borderRadius: '5px 5px 2px 2px',
                          opacity: 0.88,
                          transition: 'height .3s ease',
                        }}
                      />
                      <div
                        style={{
                          width: '42%',
                          height: `${Math.max(3, (m.received / maxMonthly) * 100)}%`,
                          background: '#34d399',
                          borderRadius: '5px 5px 2px 2px',
                          transition: 'height .3s ease',
                        }}
                      />
                    </div>
                    <div className="tiny muted" style={{ textAlign: 'center', fontSize: 10.5 }}>
                      {m.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="divider" style={{ margin: '14px 0 12px' }} />
            <div className="flex justify-between wrap" style={{ gap: 14 }}>
              <div>
                <div className="tiny muted">Total ditagihkan</div>
                <strong style={{ fontSize: 14 }}>{formatCurrency(stats.total, currency)}</strong>
              </div>
              <div>
                <div className="tiny muted">Rata-rata per invoice</div>
                <strong style={{ fontSize: 14 }}>
                  {formatCurrency(
                    stats.invoiceCount ? stats.total / stats.invoiceCount : 0,
                    currency
                  )}
                </strong>
              </div>
              <div>
                <div className="tiny muted">Tingkat konversi penawaran</div>
                <strong style={{ fontSize: 14 }}>{Math.round(stats.conversion * 100)}%</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head">
              <h3>Aksi cepat</h3>
            </div>
            <div className="card-body">
              <div className="quick-actions">
                <button type="button" className="quick-action" onClick={() => onNew('invoice')}>
                  <span className="qa-icon">
                    <FilePlus2 size={15} />
                  </span>
                  <strong>Invoice baru</strong>
                  <small>Tagih klien sekarang</small>
                </button>
                <button type="button" className="quick-action" onClick={() => onNew('quote')}>
                  <span className="qa-icon">
                    <FileSignature size={15} />
                  </span>
                  <strong>Penawaran</strong>
                  <small>Kirim harga ke calon klien</small>
                </button>
                <button type="button" className="quick-action" data-testid="qa-customers" onClick={() => onNavigate('customers')}>
                  <span className="qa-icon">
                    <Users size={15} />
                  </span>
                  <strong>Pelanggan</strong>
                  <small>{customers.length} tersimpan</small>
                </button>
                <button type="button" className="quick-action" onClick={() => onNavigate('invoices')}>
                  <span className="qa-icon">
                    <Wallet size={15} />
                  </span>
                  <strong>Tagih piutang</strong>
                  <small>{stats.overdueCount} lewat tempo</small>
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Perlu perhatian</h3>
              {attention.length > 0 && (
                <span className="badge tone-warning" style={{ marginLeft: 'auto' }}>
                  {attention.length}
                </span>
              )}
            </div>
            <div className="card-body" style={{ paddingTop: 6, paddingBottom: 6 }}>
              {attention.length === 0 ? (
                <div className="empty" style={{ padding: '22px 8px' }}>
                  <div className="empty-icon" style={{ width: 42, height: 42 }}>
                    <CheckCircle2 size={19} />
                  </div>
                  <h3 style={{ fontSize: 13 }}>Semua terkendali</h3>
                  <p style={{ fontSize: 11.5 }}>Tidak ada invoice jatuh tempo dekat ini.</p>
                </div>
              ) : (
                <div className="timeline">
                  {attention.map(({ doc, days }) => (
                    <div key={doc.id} className="timeline-item" style={{ alignItems: 'center' }}>
                      <span
                        className="timeline-dot"
                        style={{
                          background:
                            days < 0 ? 'var(--danger)' : days <= 2 ? 'var(--warning)' : 'var(--primary)',
                        }}
                      />
                      <div className="grow" style={{ minWidth: 0 }}>
                        <strong
                          style={{ cursor: 'pointer' }}
                          onClick={() => onOpenDoc(doc)}
                          title={doc.number}
                        >
                          {doc.customer?.name || 'Pelanggan'}
                          <span className="muted" style={{ fontWeight: 400 }}> · {doc.number}</span>
                        </strong>
                        <span>
                          {days < 0
                            ? `Terlambat ${Math.abs(days)} hari`
                            : days === 0
                              ? 'Jatuh tempo hari ini'
                              : `${days} hari lagi`}{' '}
                          · {formatCurrency(balanceDue(doc), currency)}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        title="Kirim WhatsApp"
                        onClick={() => onWhatsApp(doc)}
                      >
                        <MessageCircle size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2-even">
        <div className="card">
          <div className="card-head">
            <h3>Aktivitas terbaru</h3>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ marginLeft: 'auto' }}
              onClick={() => onNavigate('invoices')}
            >
              Lihat semua <ChevronRight size={13} />
            </button>
          </div>
          <div className="table-wrap" style={{ borderRadius: 0 }}>
            {recent.length === 0 ? (
              <EmptyState icon={ReceiptText} title="Belum ada dokumen" />
            ) : (
              <table className="data">
                <tbody>
                  {recent.map((doc) => {
                    const status = effectiveStatus(doc);
                    return (
                      <tr key={doc.id} onClick={() => onOpenDoc(doc)}>
                        <td style={{ paddingLeft: 18 }}>
                          <div className="flex items-center gap-8">
                            <TypePill type={doc.type} />
                            <div style={{ minWidth: 0 }}>
                              <div className="strong" style={{ fontSize: 12.5 }}>
                                {doc.customer?.name || 'Pelanggan'}
                              </div>
                              <div className="tiny muted">{doc.number}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ width: 120 }}>
                          <StatusBadge status={status} />
                        </td>
                        <td className="num strong" style={{ paddingRight: 18 }}>
                          {formatCurrency(calculateTotals(doc).total, currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Pelanggan teratas</h3>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ marginLeft: 'auto' }}
              onClick={() => onNavigate('customers')}
            >
              Kelola <ArrowUpRight size={13} />
            </button>
          </div>
          <div className="card-body" style={{ paddingTop: 8 }}>
            {topCustomers.length === 0 ? (
              <EmptyState icon={Users} title="Belum ada pelanggan" />
            ) : (
              topCustomers.map((cust, i) => (
                <div
                  key={cust.name}
                  className="flex items-center gap-10"
                  style={{ padding: '9px 0', borderBottom: i < topCustomers.length - 1 ? '1px solid var(--border)' : 'none' }}
                >
                  <div className="avatar" style={{ width: 32, height: 32, fontSize: 12, borderRadius: 9 }}>
                    {(cust.name || 'P')[0].toUpperCase()}
                  </div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 620, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {cust.name}
                    </div>
                    <div className="tiny muted">{cust.count} dokumen</div>
                  </div>
                  <div className="text-right" style={{ fontSize: 12.5, fontWeight: 640 }}>
                    {formatCurrency(cust.total, currency)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function buildMonthlySeries(documents) {
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: monthLabel(d),
      invoiced: 0,
      received: 0,
      year: d.getFullYear(),
      month: d.getMonth(),
    });
  }
  documents.forEach((doc) => {
    if (doc.type !== 'invoice') return;
    const issue = toDate(doc.issueDate);
    if (!issue) return;
    const bucket = months.find((m) => m.year === issue.getFullYear() && m.month === issue.getMonth());
    if (bucket && effectiveStatus(doc) !== 'draft' && effectiveStatus(doc) !== 'cancelled') {
      bucket.invoiced += calculateTotals(doc).total;
    }
    (doc.payments || []).forEach((p) => {
      const pd = toDate(p.date);
      if (!pd) return;
      const payBucket = months.find((m) => m.year === pd.getFullYear() && m.month === pd.getMonth());
      if (payBucket) payBucket.received += Number(p.amount) || 0;
    });
  });
  return months;
}
