import React from 'react';
import { STATUS_META, DOC_TYPE_META } from '../utils/documents.js';
import { formatCurrency, formatCompact } from '../utils/currency.js';
import { formatDate, relativeDayText } from '../utils/dates.js';

export function StatusBadge({ status, children }) {
  const meta = STATUS_META[status] || STATUS_META.draft;
  return (
    <span className={`badge tone-${meta.tone}`}>
      <span className="dot" />
      {children || meta.label}
    </span>
  );
}

export function TypePill({ type }) {
  const meta = DOC_TYPE_META[type] || DOC_TYPE_META.invoice;
  return (
    <span className={`type-pill${type === 'quote' ? ' quote' : ''}`}>
      {meta.shortLabel}
    </span>
  );
}

export function StatCard({ label, value, foot, icon: Icon, tone = 'primary', hint }) {
  return (
    <div className={`card stat-card tone-${tone}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {foot && <div className="stat-foot">{foot}</div>}
      {Icon && (
        <div className="stat-icon" aria-hidden="true">
          <Icon size={15} />
        </div>
      )}
      {hint && <span className="sr-only">{hint}</span>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="empty">
      {Icon && (
        <div className="empty-icon">
          <Icon size={23} />
        </div>
      )}
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function Money({ value, currency = 'IDR', compact = false, className = '' }) {
  return (
    <span className={className}>
      {compact ? formatCompact(value, currency) : formatCurrency(value, currency)}
    </span>
  );
}

export function DueHint({ doc }) {
  if (!doc?.dueDate) return null;
  const label = relativeDayText(doc.dueDate);
  return <span className="tiny muted">{formatDate(doc.dueDate)} · {label}</span>;
}

export function Progress({ value }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Input nominal dengan pemisah ribuan otomatis (format Indonesia). */
export function MoneyInput({ value, onChange, currency = 'IDR', className = '', id, placeholder = '0', disabled, ariaLabel }) {
  const [focused, setFocused] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const decimals = currency === 'IDR' ? 0 : 2;
  const display = focused
    ? draft
    : Number(value || 0).toLocaleString('id-ID', {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals,
      });

  return (
    <input
      id={id}
      aria-label={ariaLabel}
      className={`input input-money ${className}`}
      value={display}
      inputMode="numeric"
      disabled={disabled}
      placeholder={placeholder}
      onFocus={(e) => {
        setFocused(true);
        setDraft(value ? String(value) : '');
        e.target.select();
      }}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        if (decimals) {
          // mata uang asing: izinkan koma desimal
          const norm = raw.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '');
          const parsed = Number.parseFloat(norm);
          onChange?.(Number.isFinite(parsed) ? parsed : 0);
        } else {
          const parsed = Number.parseInt(raw.replace(/\D/g, ''), 10);
          onChange?.(Number.isFinite(parsed) ? parsed : 0);
        }
      }}
    />
  );
}

/** Input qty yang menerima desimal. */
export function QtyInput({ value, onChange, className = '', ariaLabel }) {
  return (
    <input
      className={`input num ${className}`}
      aria-label={ariaLabel}
      value={value === 0 ? '0' : String(value)}
      inputMode="decimal"
      onChange={(e) => {
        const raw = e.target.value.replace(',', '.');
        if (raw === '') return onChange?.('');
        if (!/^\d*\.?\d*$/.test(raw)) return undefined;
        const n = Number.parseFloat(raw);
        return onChange?.(Number.isFinite(n) ? n : 0);
      }}
      onBlur={() => {
        if (value === '' || Number.isNaN(Number(value))) onChange?.(0);
      }}
    />
  );
}
