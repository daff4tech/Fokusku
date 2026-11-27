import React from 'react';
import {
  Database,
  Download,
  Maximize2,
  Moon,
  Sun,
  Wifi,
  WifiOff,
} from 'lucide-react';

export function Header({
  theme,
  onToggleTheme,
  onEnterZen,
  isOnline,
  canInstall,
  onInstall,
  onOpenBackup,
}) {
  return (
    <header className="app-header">
      <div className="brand">
        <img
          src="/icons/icon.svg"
          alt="Logo FokusKu"
          className="brand-logo"
        />
        <div>
          <h1 className="brand-title">FokusKu</h1>
          <p className="brand-subtitle">
            Pomodoro · Habit Tracker · Ambient Sound
          </p>
        </div>
      </div>

      <div className="header-actions">
        <span
          className={`status-pill ${isOnline ? 'online' : 'offline'}`}
          title={
            isOnline
              ? 'Tersambung & tersimpan lokal di perangkat'
              : 'Sedang offline — seluruh fitur tetap berjalan penuh'
          }
        >
          <span className="status-dot" />
          {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
          <span>{isOnline ? 'Siap Offline' : 'Mode Offline'}</span>
        </span>

        {canInstall && (
          <button
            type="button"
            className="btn btn-soft btn-sm"
            onClick={onInstall}
          >
            <Download size={14} />
            <span>Install PWA</span>
          </button>
        )}

        <button
          type="button"
          className="btn btn-sm"
          onClick={onOpenBackup}
          title="Backup, Impor JSON, atau Muat Data Demo"
        >
          <Database size={14} />
          <span>Data</span>
        </button>

        <button
          type="button"
          className="btn btn-soft btn-sm"
          onClick={onEnterZen}
          title="Masuk Mode Fullscreen Zen (Pintasan: Z)"
        >
          <Maximize2 size={14} />
          <span>Mode Zen</span>
        </button>

        <button
          type="button"
          className="icon-btn square"
          onClick={onToggleTheme}
          aria-label={
            theme === 'dark' ? 'Aktifkan Tema Terang' : 'Aktifkan Tema Gelap'
          }
          title={theme === 'dark' ? 'Tema Terang' : 'Tema Gelap'}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}
