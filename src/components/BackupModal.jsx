import React, { useRef } from 'react';
import { Download, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { exportAllData } from '../utils/storage.js';

export function BackupModal({
  onClose,
  onImportData,
  onLoadDemo,
  onClearHistory,
}) {
  const fileRef = useRef(null);

  const handleExport = () => {
    const payload = exportAllData();
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fokusku-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (parsed && parsed.data) {
          onImportData(parsed.data);
          onClose();
        }
      } catch {
        // Ignore invalid JSON
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-label="Kelola Data Lokal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-header" style={{ marginBottom: 12 }}>
          <h2 className="card-title">Data & Backup Offline</h2>
          <button
            type="button"
            className="mini-icon-btn"
            onClick={onClose}
            aria-label="Tutup"
          >
            <X size={16} />
          </button>
        </div>

        <p
          style={{
            margin: '0 0 16px',
            fontSize: '0.84rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
          }}
        >
          Seluruh data Pomodoro, task, habit, dan pengaturan tersimpan otomatis di{' '}
          <code>localStorage</code> browser kamu secara offline.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button type="button" className="btn btn-primary" onClick={handleExport}>
            <Download size={15} />
            <span>Ekspor Backup (.json)</span>
          </button>

          <button
            type="button"
            className="btn"
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={15} />
            <span>Impor Backup (.json)</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          <hr
            style={{
              width: '100%',
              border: 'none',
              borderTop: '1px solid var(--border-subtle)',
              margin: '4px 0',
            }}
          />

          <button
            type="button"
            className="btn btn-soft"
            onClick={() => {
              onLoadDemo();
              onClose();
            }}
          >
            <Sparkles size={15} />
            <span>Muat Data Demo (24 Minggu)</span>
          </button>

          <button
            type="button"
            className="btn"
            style={{ color: 'var(--danger)' }}
            onClick={() => {
              onClearHistory();
              onClose();
            }}
          >
            <Trash2 size={15} />
            <span>Hapus Riwayat Fokus & Habit</span>
          </button>
        </div>
      </div>
    </div>
  );
}
