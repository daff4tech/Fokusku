import React, { useRef, useState } from 'react';
import {
  Building2,
  Landmark,
  Palette,
  Database,
  Plus,
  Trash2,
  Upload,
  Download,
  RefreshCw,
  Save,
  Check,
  FileSpreadsheet,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { ConfirmDialog } from './Modal.jsx';
import { CURRENCIES } from '../utils/currency.js';
import { exportBackup, parseBackup, resetAll } from '../utils/storage.js';
import { downloadText } from '../utils/download.js';

const ACCENTS = [
  { name: 'Teal', value: '#0f766e' },
  { name: 'Indigo', value: '#4338ca' },
  { name: 'Oranye', value: '#c2410c' },
  { name: 'Rose', value: '#be123c' },
  { name: 'Emerald', value: '#047857' },
  { name: 'Slate', value: '#334155' },
  { name: 'Amber', value: '#b45309' },
  { name: 'Violet', value: '#7c3aed' },
];

const TABS = [
  { id: 'business', label: 'Profil usaha', icon: Building2 },
  { id: 'bank', label: 'Rekening bank', icon: Landmark },
  { id: 'appearance', label: 'Tampilan & preferensi', icon: Palette },
  { id: 'data', label: 'Data & cadangan', icon: Database },
];

export function Settings({ profile, onSave, documents, customers, settings, onImport, onSaveSettings, toast, theme, onTheme }) {
  const [tab, setTab] = useState('business');
  const [form, setForm] = useState(profile);
  const [localSettings, setLocalSettings] = useState(settings);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef(null);

  const set = (key) => (e) => {
    const value = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const save = () => {
    onSave(form);
    onSaveSettings(localSettings);
    toast?.('Pengaturan disimpan', 'success');
  };

  const handleLogo = (file) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      toast?.('Gunakan gambar JPG, PNG, atau WEBP', 'error');
      return;
    }
    if (file.size > 2.5 * 1024 * 1024) {
      toast?.('Ukuran logo maksimal 2,5 MB', 'error');
      return;
    }
    if (file.type === 'image/jpeg') {
      const reader = new FileReader();
      reader.onload = () => setForm((f) => ({ ...f, logoDataUrl: String(reader.result) }));
      reader.readAsDataURL(file);
      return;
    }
    // konversi PNG/WebP ke JPEG agar bisa disematkan ke PDF
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const maxW = 480;
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
      setForm((f) => ({ ...f, logoDataUrl: dataUrl }));
      URL.revokeObjectURL(url);
      toast?.('Logo dikonversi & siap dipakai', 'success');
    };
    img.onerror = () => toast?.('Gagal membaca gambar', 'error');
    img.src = url;
  };

  const handleExport = () => {
    const data = exportBackup({ documents, customers, profile: form, settings: localSettings });
    const date = new Date().toISOString().slice(0, 10);
    downloadText(JSON.stringify(data, null, 2), `notaku-backup-${date}.json`);
    toast?.('Cadangan diunduh', 'success');
  };

  const handleImport = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseBackup(text);
      onImport(parsed);
      toast?.(`Impor berhasil: ${parsed.documents.length} dokumen`, 'success');
    } catch (error) {
      toast?.(error.message || 'File tidak valid', 'error');
    }
  };

  const setAccount = (id, patch) =>
    setForm((f) => ({
      ...f,
      bankAccounts: f.bankAccounts.map((acc) => (acc.id === id ? { ...acc, ...patch } : acc)),
    }));

  return (
    <div className="settings-grid">
      <nav className="settings-nav">
        {TABS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? 'active' : ''}
              onClick={() => setTab(item.id)}
            >
              <span className="flex items-center gap-8">
                <Icon size={14} /> {item.label}
              </span>
            </button>
          );
        })}
        <div className="tiny muted" style={{ padding: '12px 11px' }}>
          <ShieldCheck size={12} /> Semua data tersimpan di browser perangkat ini.
        </div>
      </nav>

      <div className="stack">
        {tab === 'business' && (
          <section className="card">
            <div className="card-head">
              <h3>Profil usaha</h3>
              <span className="tiny muted" style={{ marginLeft: 'auto' }}>
                Tampil di kop invoice & PDF
              </span>
            </div>
            <div className="card-body stack" style={{ gap: 14 }}>
              <div className="logo-upload">
                <div className="logo-preview">
                  {form.logoDataUrl ? (
                    <img src={form.logoDataUrl} alt="Logo usaha" />
                  ) : (
                    (form.businessName || 'N')[0].toUpperCase()
                  )}
                </div>
                <div className="grow">
                  <div style={{ fontSize: 12.5, fontWeight: 620, marginBottom: 2 }}>Logo usaha</div>
                  <div className="tiny muted">JPG/PNG/WEBP · maks 2,5 MB · disarankan rasio 4:3</div>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: 'none' }}
                  onChange={(e) => handleLogo(e.target.files?.[0])}
                />
                <button type="button" className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}>
                  <Upload size={13} /> Unggah
                </button>
                {form.logoDataUrl && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setForm((f) => ({ ...f, logoDataUrl: '' }))}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>

              <div className="form-grid">
                <div className="field">
                  <label htmlFor="biz-name">Nama usaha</label>
                  <input id="biz-name" className="input" value={form.businessName} onChange={set('businessName')} />
                </div>
                <div className="field">
                  <label htmlFor="biz-owner">Nama pemilik / penanggung jawab</label>
                  <input id="biz-owner" className="input" value={form.ownerName} onChange={set('ownerName')} />
                </div>
                <div className="field span-2">
                  <label htmlFor="biz-tagline">Tagline singkat</label>
                  <input
                    id="biz-tagline"
                    className="input"
                    value={form.tagline}
                    onChange={set('tagline')}
                    placeholder="Mis. Katering rumahan • Banjarmasin"
                  />
                </div>
                <div className="field">
                  <label htmlFor="biz-phone">Nomor WhatsApp usaha</label>
                  <input id="biz-phone" className="input" value={form.phone} onChange={set('phone')} inputMode="tel" />
                </div>
                <div className="field">
                  <label htmlFor="biz-email">Email</label>
                  <input id="biz-email" className="input" type="email" value={form.email} onChange={set('email')} />
                </div>
                <div className="field">
                  <label htmlFor="biz-web">Website / Instagram</label>
                  <input id="biz-web" className="input" value={form.website} onChange={set('website')} />
                </div>
                <div className="field">
                  <label htmlFor="biz-npwp">NPWP</label>
                  <input id="biz-npwp" className="input" value={form.npwp} onChange={set('npwp')} />
                </div>
                <div className="field span-2">
                  <label htmlFor="biz-address">Alamat</label>
                  <textarea id="biz-address" className="textarea" value={form.address} onChange={set('address')} />
                </div>
                <div className="field span-2">
                  <label htmlFor="biz-footer">Catatan kaki dokumen</label>
                  <input id="biz-footer" className="input" value={form.footerNote} onChange={set('footerNote')} />
                </div>
              </div>
            </div>
            <div className="card-foot">
              <button type="button" className="btn btn-primary" onClick={save}>
                <Save size={14} /> Simpan profil
              </button>
            </div>
          </section>
        )}

        {tab === 'bank' && (
          <>
            <section className="card">
              <div className="card-head">
                <h3>Rekening pembayaran</h3>
                <span className="tiny muted" style={{ marginLeft: 'auto' }}>
                  Maks 2 rekening tampil di PDF
                </span>
              </div>
              <div className="card-body stack" style={{ gap: 10 }}>
                {(form.bankAccounts || []).map((acc) => (
                  <div className="bank-row" key={acc.id}>
                    <input
                      className="input"
                      value={acc.bank}
                      onChange={(e) => setAccount(acc.id, { bank: e.target.value })}
                      placeholder="Bank"
                      aria-label="Nama bank"
                    />
                    <input
                      className="input mono"
                      value={acc.accountNumber}
                      onChange={(e) => setAccount(acc.id, { accountNumber: e.target.value })}
                      placeholder="Nomor rekening"
                      aria-label="Nomor rekening"
                    />
                    <input
                      className="input"
                      value={acc.accountName}
                      onChange={(e) => setAccount(acc.id, { accountName: e.target.value })}
                      placeholder="Atas nama"
                      aria-label="Atas nama"
                    />
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          bankAccounts: f.bankAccounts.filter((a) => a.id !== acc.id),
                        }))
                      }
                      title="Hapus rekening"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      bankAccounts: [
                        ...(f.bankAccounts || []),
                        { id: `bank_${Date.now()}`, bank: '', accountNumber: '', accountName: '' },
                      ],
                    }))
                  }
                >
                  <Plus size={13} /> Tambah rekening
                </button>
              </div>
              <div className="card-foot">
                <button type="button" className="btn btn-primary" onClick={save}>
                  <Save size={14} /> Simpan rekening
                </button>
              </div>
            </section>

            <section className="card">
              <div className="card-head">
                <h3>Default dokumen</h3>
              </div>
              <div className="card-body form-grid">
                <div className="field">
                  <label htmlFor="def-currency">Mata uang</label>
                  <select
                    id="def-currency"
                    className="select"
                    value={form.currency}
                    onChange={set('currency')}
                  >
                    {Object.values(CURRENCIES).map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} — {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="def-tax">Tarif pajak default (%)</label>
                  <input
                    id="def-tax"
                    className="input num"
                    type="number"
                    value={form.taxRate}
                    onChange={(e) => setForm((f) => ({ ...f, taxRate: Number(e.target.value) }))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="def-taxlabel">Label pajak</label>
                  <input id="def-taxlabel" className="input" value={form.taxLabel} onChange={set('taxLabel')} />
                </div>
                <div className="field">
                  <label htmlFor="def-due">Jatuh tempo (hari)</label>
                  <input
                    id="def-due"
                    className="input num"
                    type="number"
                    value={form.defaultDueDays}
                    onChange={(e) => setForm((f) => ({ ...f, defaultDueDays: Number(e.target.value) }))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="def-inv">Awalan nomor invoice</label>
                  <input
                    id="def-inv"
                    className="input mono"
                    value={form.invoicePrefix}
                    onChange={set('invoicePrefix')}
                  />
                </div>
                <div className="field">
                  <label htmlFor="def-qtn">Awalan nomor penawaran</label>
                  <input
                    id="def-qtn"
                    className="input mono"
                    value={form.quotePrefix}
                    onChange={set('quotePrefix')}
                  />
                </div>
              </div>
              <div className="card-foot">
                <button type="button" className="btn btn-primary" onClick={save}>
                  <Save size={14} /> Simpan
                </button>
              </div>
            </section>
          </>
        )}

        {tab === 'appearance' && (
          <>
            <section className="card">
              <div className="card-head">
                <h3>Warna aksen dokumen</h3>
              </div>
              <div className="card-body stack" style={{ gap: 16 }}>
                <div className="swatch-row">
                  {ACCENTS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      className={`swatch${(form.accentColor || '#0f766e') === color.value ? ' active' : ''}`}
                      style={{ background: color.value }}
                      title={color.name}
                      onClick={() => setForm((f) => ({ ...f, accentColor: color.value }))}
                      aria-label={`Warna ${color.name}`}
                    >
                      {(form.accentColor || '#0f766e') === color.value && (
                        <Check size={14} color="#fff" style={{ margin: 'auto', display: 'block' }} />
                      )}
                    </button>
                  ))}
                </div>
                <div className="field" style={{ maxWidth: 220 }}>
                  <label htmlFor="accent-custom">Warna kustom</label>
                  <input
                    id="accent-custom"
                    type="color"
                    className="input"
                    style={{ height: 38, padding: 4 }}
                    value={form.accentColor || '#0f766e'}
                    onChange={set('accentColor')}
                  />
                </div>
                <div className="flex gap-10 wrap">
                  <button
                    type="button"
                    className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => onTheme('light')}
                  >
                    Mode terang
                  </button>
                  <button
                    type="button"
                    className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => onTheme('dark')}
                  >
                    Mode gelap
                  </button>
                </div>
              </div>
              <div className="card-foot">
                <button type="button" className="btn btn-primary" onClick={save}>
                  <Save size={14} /> Terapkan
                </button>
              </div>
            </section>

            <section className="card">
              <div className="card-head">
                <h3>Preferensi dokumen</h3>
              </div>
              <div className="card-body stack" style={{ gap: 10 }}>
                <label className="checkbox-row" style={{ cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={localSettings.showTerbilang !== false}
                    onChange={(e) => setLocalSettings((s) => ({ ...s, showTerbilang: e.target.checked }))}
                  />
                  Tampilkan <strong>terbilang</strong> (nominal dalam kata) di PDF
                  <small>Disarankan untuk invoice resmi</small>
                </label>
                <label className="checkbox-row" style={{ cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!localSettings.showItemDesc}
                    onChange={(e) => setLocalSettings((s) => ({ ...s, showItemDesc: e.target.checked }))}
                  />
                  Sertakan deskripsi item di tabel invoice
                </label>
                <label className="checkbox-row" style={{ cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={localSettings.autoSave !== false}
                    onChange={(e) => setLocalSettings((s) => ({ ...s, autoSave: e.target.checked }))}
                  />
                  Simpan otomatis saat mengedit dokumen
                </label>
              </div>
              <div className="card-foot">
                <button type="button" className="btn btn-primary" onClick={save}>
                  <Save size={14} /> Simpan preferensi
                </button>
              </div>
            </section>
          </>
        )}

        {tab === 'data' && (
          <>
            <section className="card">
              <div className="card-head">
                <h3>Cadangan & pemulihan</h3>
              </div>
              <div className="card-body stack" style={{ gap: 14 }}>
                <div className="flex items-center gap-14 wrap">
                  <div className="grow">
                    <div style={{ fontSize: 12.5, fontWeight: 620 }}>Ekspor semua data</div>
                    <div className="tiny muted">
                      {documents.length} dokumen · {customers.length} pelanggan · file JSON
                    </div>
                  </div>
                  <button type="button" className="btn btn-outline" onClick={handleExport}>
                    <Download size={14} /> Unduh cadangan
                  </button>
                </div>
                <div className="divider" />
                <div className="flex items-center gap-14 wrap">
                  <div className="grow">
                    <div style={{ fontSize: 12.5, fontWeight: 620 }}>Impor cadangan</div>
                    <div className="tiny muted">Menggabungkan dokumen dari file backup NotaKu.</div>
                  </div>
                  <label className="btn btn-outline" style={{ cursor: 'pointer' }}>
                    <Upload size={14} /> Pilih file
                    <input
                      type="file"
                      accept="application/json,.json"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        handleImport(e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
                <div className="divider" />
                <div className="flex items-center gap-14 wrap">
                  <div className="grow">
                    <div style={{ fontSize: 12.5, fontWeight: 620 }}>Ekspor daftar pelanggan (CSV)</div>
                    <div className="tiny muted">Bisa dibuka di Excel / Google Sheets.</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                      const header = 'Nama,Perusahaan,WhatsApp,Email,Alamat\n';
                      const rows = customers
                        .map((c) =>
                          [c.name, c.company, c.phone, c.email, c.address]
                            .map((v) => `"${String(v || '').replace(/"/g, '""')}"`)
                            .join(',')
                        )
                        .join('\n');
                      downloadText(header + rows, 'pelanggan-notaku.csv', 'text/csv');
                      toast?.('CSV pelanggan diunduh', 'success');
                    }}
                  >
                    <FileSpreadsheet size={14} /> Unduh CSV
                  </button>
                </div>
              </div>
            </section>

            <section className="card">
              <div className="card-head">
                <h3>Zona berbahaya</h3>
              </div>
              <div className="card-body">
                <div className="flex items-center gap-14 wrap">
                  <div className="grow">
                    <div style={{ fontSize: 12.5, fontWeight: 620 }}>Reset semua data</div>
                    <div className="tiny muted">
                      Menghapus seluruh dokumen, pelanggan, dan pengaturan dari perangkat ini.
                    </div>
                  </div>
                  <button type="button" className="btn btn-danger" onClick={() => setConfirmReset(true)}>
                    <RefreshCw size={14} /> Reset
                  </button>
                </div>
              </div>
            </section>

            <section className="card">
              <div className="card-body flex items-center gap-10">
                <Smartphone size={18} className="muted" />
                <div className="tiny muted">
                  NotaKu bekerja offline dan menyimpan data di <strong>localStorage</strong> browser. Unduh cadangan
                  secara berkala, terutama sebelum mengganti perangkat atau membersihkan data browser.
                </div>
              </div>
            </section>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => {
          resetAll();
          window.location.reload();
        }}
        title="Reset semua data?"
        message="Tindakan ini akan menghapus seluruh dokumen dan pengaturan di perangkat ini. Pastikan Anda sudah mengunduh cadangan."
        confirmLabel="Ya, hapus semua"
        danger
      />
    </div>
  );
}
