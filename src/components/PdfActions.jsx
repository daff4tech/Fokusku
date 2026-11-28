import React, { useState } from 'react';
import { Download, Eye, Printer, Loader2 } from 'lucide-react';
import { renderDocumentPdf } from '../pdf/docPdf.js';
import { downloadBytes, safeFilename } from '../utils/download.js';

export function usePdf(doc, profile, options = {}) {
  const [busy, setBusy] = useState(false);

  const build = () => renderDocumentPdf(doc, profile, options);

  const download = () => {
    if (!doc) return;
    setBusy(true);
    try {
      const bytes = build();
      const name = safeFilename(`${doc.type === 'quote' ? 'Penawaran' : 'Invoice'}-${doc.number || doc.id}`);
      downloadBytes(bytes, `${name}.pdf`);
    } finally {
      setTimeout(() => setBusy(false), 400);
    }
  };

  const openInTab = () => {
    if (!doc) return;
    const bytes = build();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) download();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const print = () => {
    if (!doc) return;
    const bytes = build();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = url;
    iframe.onload = () => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch {
        window.open(url, '_blank');
      }
    };
    document.body.appendChild(iframe);
    setTimeout(() => {
      iframe.remove();
      URL.revokeObjectURL(url);
    }, 120_000);
  };

  return { download, openInTab, print, busy, build };
}

export function PdfButtons({ doc, profile, options, compact = false, onToast }) {
  const { download, openInTab, print, busy } = usePdf(doc, profile, options);

  return (
    <div className="flex items-center gap-6 wrap">
      <button type="button" className={`btn btn-outline${compact ? ' btn-sm' : ''}`} onClick={openInTab}>
        <Eye size={compact ? 13 : 15} /> Pratinjau
      </button>
      <button type="button" className={`btn btn-primary${compact ? ' btn-sm' : ''}`} onClick={() => { download(); onToast?.('PDF berhasil dibuat', 'success'); }}>
        {busy ? <Loader2 size={compact ? 13 : 15} className="spin" /> : <Download size={compact ? 13 : 15} />}
        Unduh PDF
      </button>
      {!compact && (
        <button type="button" className="btn btn-ghost" onClick={print} title="Cetak">
          <Printer size={15} />
        </button>
      )}
    </div>
  );
}
