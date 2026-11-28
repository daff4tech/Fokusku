import React from 'react';
import { calculateTotals, lineTotal, DOC_TYPE_META } from '../utils/documents.js';
import { formatCurrency } from '../utils/currency.js';
import { terbilang } from '../utils/terbilang.js';
import { formatDateLong } from '../utils/dates.js';

function fmtQty(v) {
  const n = Number(v) || 0;
  return Number.isInteger(n) ? n.toLocaleString('id-ID') : n.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

/**
 * Pratinjau visual dokumen (HTML) yang menyerupai hasil PDF A4.
 * Ringkas & responsif; PDF asli tetap dibuat oleh mesin PDF.
 */
export function DocumentPreview({ doc, profile }) {
  const meta = DOC_TYPE_META[doc.type] || DOC_TYPE_META.invoice;
  const currency = profile.currency || 'IDR';
  const totals = calculateTotals(doc);
  const isQuote = doc.type === 'quote';
  const accent = profile.accentColor || '#0f766e';
  const items = (doc.items || []).filter((i) => i.name?.trim() || i.description?.trim());
  const banks = (profile.bankAccounts || []).filter((b) => b.accountNumber).slice(0, 2);
  const paid = (doc.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const due = Math.max(0, totals.total - paid);

  return (
    <div className="invoice-sheet" style={{ '--accent': accent }}>
      <div className="sheet-accent" />

      <div className="sheet-head">
        <div style={{ minWidth: 0 }}>
          {profile.logoDataUrl && (
            <img
              src={profile.logoDataUrl}
              alt=""
              style={{ height: 22, marginBottom: 4, objectFit: 'contain' }}
            />
          )}
          <div className="sheet-biz-name">{profile.businessName || 'Nama Usaha'}</div>
          {profile.tagline && <div className="sheet-biz-line">{profile.tagline}</div>}
          <div className="sheet-biz-line">
            {[profile.phone, profile.email].filter(Boolean).join('  •  ')}
          </div>
          {profile.address && (
            <div className="sheet-biz-line" style={{ whiteSpace: 'pre-line' }}>
              {profile.address}
            </div>
          )}
        </div>
        <div style={{ flexShrink: 0, maxWidth: '46%' }}>
          <div className="sheet-title">{meta.title}</div>
          <div className="sheet-doc-no">No. {doc.number || '—'}</div>
          <div className="sheet-doc-meta">
            {isQuote
              ? `Berlaku s/d ${formatDateLong(doc.validUntil || doc.dueDate)}`
              : `Jatuh tempo ${formatDateLong(doc.dueDate)}`}
          </div>
          {profile.npwp && <div className="sheet-doc-meta">NPWP {profile.npwp}</div>}
        </div>
      </div>

      <div className="sheet-divider" />

      <div className="sheet-parties">
        <div style={{ minWidth: 0 }}>
          <div className="sheet-label">{isQuote ? 'Penawaran untuk' : 'Ditagihkan kepada'}</div>
          <div className="sheet-cust-name">{doc.customer?.name || 'Nama pelanggan'}</div>
          {doc.customer?.company && <div className="sheet-small">{doc.customer.company}</div>}
          <div className="sheet-small">
            {[doc.customer?.phone, doc.customer?.email].filter(Boolean).join('  •  ')}
          </div>
          {doc.customer?.address && (
            <div className="sheet-small" style={{ whiteSpace: 'pre-line' }}>
              {doc.customer.address}
            </div>
          )}
        </div>
        <div>
          <div className="sheet-label">Detail dokumen</div>
          <div className="sheet-detail-row">
            <span>{isQuote ? 'Tanggal' : 'Tanggal terbit'}</span>
            <b>{formatDateLong(doc.issueDate)}</b>
          </div>
          <div className="sheet-detail-row">
            <span>{isQuote ? 'Berlaku s/d' : 'Jatuh tempo'}</span>
            <b>{formatDateLong(isQuote ? doc.validUntil || doc.dueDate : doc.dueDate)}</b>
          </div>
          <div className="sheet-detail-row">
            <span>Item</span>
            <b>{totals.itemCount} item</b>
          </div>
        </div>
      </div>

      <table className="sheet-table">
        <thead>
          <tr>
            <th style={{ width: '46%' }}>{meta.itemsHeading}</th>
            <th className="num" style={{ width: '14%' }}>Qty</th>
            <th className="num" style={{ width: '20%' }}>Harga</th>
            <th className="num" style={{ width: '20%' }}>Jumlah</th>
          </tr>
        </thead>
        <tbody>
          {items.slice(0, 7).map((item, i) => (
            <tr key={item.id || i}>
              <td>
                <div className="sheet-item-name">{item.name || '-'}</div>
                {item.description && <div className="sheet-item-desc">{item.description}</div>}
              </td>
              <td className="num">
                {fmtQty(item.qty)}
                {item.unit ? ` ${item.unit}` : ''}
              </td>
              <td className="num">{formatCurrency(item.price, currency, { symbol: false })}</td>
              <td className="num" style={{ fontWeight: 600 }}>
                {formatCurrency(lineTotal(item), currency, { symbol: false })}
              </td>
            </tr>
          ))}
          {items.length > 7 && (
            <tr>
              <td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                +{items.length - 7} item lainnya…
              </td>
            </tr>
          )}
          {!items.length && (
            <tr>
              <td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                Belum ada item
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="sheet-bottom">
        <div style={{ minWidth: 0 }}>
          {doc.notes && (
            <>
              <div className="sheet-label sheet-notes-label">Catatan</div>
              <div className="sheet-note-text">{doc.notes}</div>
            </>
          )}
          {doc.terms && (
            <>
              <div className="sheet-label sheet-notes-label">
                {isQuote ? 'Syarat & ketentuan' : 'Syarat pembayaran'}
              </div>
              <div className="sheet-note-text">{doc.terms}</div>
            </>
          )}
        </div>
        <div>
          <div className="sheet-total-box">
            <div className="sheet-total-row">
              <span>Subtotal</span>
              <b>{formatCurrency(totals.itemsTotal, currency)}</b>
            </div>
            {totals.discountValue > 0 && (
              <div className="sheet-total-row">
                <span>
                  Diskon{doc.discount?.type === 'percent' ? ` (${fmtQty(doc.discount.value)}%)` : ''}
                </span>
                <b style={{ color: '#15803d' }}>- {formatCurrency(totals.discountValue, currency)}</b>
              </div>
            )}
            {(doc.extras || []).map((extra) =>
              extra.label && Number(extra.amount) ? (
                <div className="sheet-total-row" key={extra.id}>
                  <span>{extra.label}</span>
                  <b>
                    {extra.mode === 'discount' ? '- ' : ''}
                    {formatCurrency(extra.amount, currency)}
                  </b>
                </div>
              ) : null
            )}
            {totals.taxValue > 0 && (
              <div className="sheet-total-row">
                <span>
                  {doc.tax?.label || 'PPN'} {fmtQty(doc.tax?.rate)}%
                </span>
                <b>{formatCurrency(totals.taxValue, currency)}</b>
              </div>
            )}
            {totals.withholdingValue > 0 && (
              <div className="sheet-total-row">
                <span>
                  {doc.withholding?.label || 'PPh'} {fmtQty(doc.withholding?.rate)}%
                </span>
                <b>- {formatCurrency(totals.withholdingValue, currency)}</b>
              </div>
            )}
            {!isQuote && paid > 0 && (
              <div className="sheet-total-row">
                <span>Sudah dibayar</span>
                <b>- {formatCurrency(paid, currency)}</b>
              </div>
            )}
            <div className="sheet-grand">
              <span>{!isQuote && paid > 0 ? 'Sisa tagihan' : meta.totalLabel}</span>
              <span>{formatCurrency(due === totals.total ? totals.total : due, currency)}</span>
            </div>
          </div>
        </div>
      </div>

      {totals.total > 0 && (
        <div className="sheet-terbilang">
          <b style={{ fontStyle: 'normal', color: accent }}>Terbilang: </b>
          {terbilang(totals.total, currency)}
        </div>
      )}

      {banks.length > 0 && (
        <>
          <div className="sheet-label" style={{ marginTop: 8 }}>
            {isQuote ? 'Pembayaran (jika disetujui)' : 'Pembayaran ke'}
          </div>
          <div className="sheet-bank-grid">
            {banks.map((bank) => (
              <div className="sheet-bank" key={bank.id}>
                <div className="sheet-small" style={{ fontWeight: 700 }}>{bank.bank}</div>
                <b>{bank.accountNumber}</b>
                <div className="sheet-small">a.n. {bank.accountName}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="sheet-sign">
        <div>
          <div className="sheet-small">{doc.signatureLabel || 'Hormat kami,'}</div>
          <div className="sheet-sign-line">{profile.ownerName || profile.businessName}</div>
        </div>
        {isQuote && (
          <div className="sheet-sign-box">
            <div className="sheet-small" style={{ fontWeight: 700, color: accent }}>
              Menyetujui penawaran
            </div>
            <div className="sheet-sign-space" />
            <div className="sheet-small">Nama & tanda tangan</div>
          </div>
        )}
      </div>

      <div className="sheet-footer">
        <span>{[profile.businessName, profile.phone].filter(Boolean).join(' • ')}</span>
        <span>Dokumen {meta.shortLabel}</span>
      </div>
    </div>
  );
}
