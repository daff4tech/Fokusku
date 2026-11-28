import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  FileText,
  FileSignature,
  Users,
  Settings,
  Plus,
  Sun,
  Moon,
  Menu,
  CloudOff,
} from 'lucide-react';
import { formatCurrency } from '../utils/currency.js';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'invoices', label: 'Invoice', icon: FileText, countKey: 'invoices' },
  { id: 'quotes', label: 'Penawaran', icon: FileSignature, countKey: 'quotes' },
  { id: 'customers', label: 'Pelanggan', icon: Users, countKey: 'customers' },
];

function Brand() {
  return (
    <div className="brand">
      <div className="brand-logo" aria-hidden="true">
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
          <path d="M6 3h9l4 4v14H6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M14.5 3v4.5H19" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M9 12h6M9 15.5h6M9 8.5h2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </div>
      <div>
        <div className="brand-name">NotaKu</div>
        <div className="brand-sub">Invoice &amp; Penawaran</div>
      </div>
    </div>
  );
}

export function Sidebar({ page, onNavigate, onNew, counts, profile, open, onClose }) {
  const initials = (profile.businessName || 'N')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} role="presentation" />}
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <Brand />
        <button type="button" className="btn btn-primary btn-block" onClick={() => onNew('invoice')}>
          <Plus size={15} /> Buat dokumen
        </button>

        <div className="nav-group-label">Menu</div>
        {NAV.map((item) => {
          const Icon = item.icon;
          const count = item.countKey ? counts?.[item.countKey] : undefined;
          return (
            <button
              type="button"
              key={item.id}
              className={`nav-item${page === item.id ? ' active' : ''}`}
              onClick={() => {
                onNavigate(item.id);
                onClose?.();
              }}
            >
              <Icon size={16} />
              {item.label}
              {count != null && count > 0 && <span className="nav-count">{count}</span>}
            </button>
          );
        })}

        <div className="nav-group-label">Pengaturan</div>
        <button
          type="button"
          className={`nav-item${page === 'settings' ? ' active' : ''}`}
          onClick={() => {
            onNavigate('settings');
            onClose?.();
          }}
        >
          <Settings size={16} />
          Profil &amp; Pengaturan
        </button>

        <div className="sidebar-footer">
          <button
            type="button"
            className="business-chip"
            onClick={() => {
              onNavigate('settings');
              onClose?.();
            }}
            style={{ textAlign: 'left', width: '100%' }}
          >
            <div className="business-avatar">
              {profile.logoDataUrl ? <img src={profile.logoDataUrl} alt="" /> : initials}
            </div>
            <div className="business-meta">
              <strong>{profile.businessName || 'Nama usaha'}</strong>
              <span>Profil usaha</span>
            </div>
          </button>
          <div
            className="tiny muted flex items-center gap-6"
            style={{ padding: '2px 4px' }}
            title="Semua data disimpan di perangkat ini"
          >
            <CloudOff size={12} /> Data tersimpan lokal
          </div>
        </div>
      </aside>
    </>
  );
}

export function Topbar({ title, subtitle, theme, onToggleTheme, onOpenMenu, actions, outstanding, currency }) {
  return (
    <header className="topbar">
      <button type="button" className="btn btn-ghost btn-icon menu-toggle" onClick={onOpenMenu} aria-label="Buka menu">
        <Menu size={19} />
      </button>
      <div style={{ minWidth: 0 }}>
        <h1 className="topbar-title">{title}</h1>
        {subtitle && <div className="topbar-sub">{subtitle}</div>}
      </div>
      <div className="topbar-actions">
        {outstanding > 0 && (
          <span className="badge tone-warning" title="Total piutang belum terbayar">
            Piutang {formatCurrency(outstanding, currency)}
          </span>
        )}
        {actions}
        <button type="button" className="btn btn-ghost btn-icon" onClick={onToggleTheme} aria-label="Ganti tema">
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>
    </header>
  );
}

export function Toasts({ toasts, onDismiss }) {
  useEffect(() => {
    if (!toasts.length) return undefined;
    const timers = toasts.map((toast) =>
      setTimeout(() => onDismiss(toast.id), toast.duration || 3200)
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toasts.map((t) => t.id).join(',')]);

  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.type || 'info'}`}>
          {toast.icon || null}
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('notaku_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('notaku_theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0b0f16' : '#f5f6f8');
  }, [theme]);

  return [theme, setTheme];
}
