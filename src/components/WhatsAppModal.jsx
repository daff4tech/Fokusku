import React, { useMemo, useState } from 'react';
import { MessageCircle, Copy, ExternalLink, Phone, Check } from 'lucide-react';
import { Modal } from './Modal.jsx';
import { buildWhatsAppLink, buildWhatsAppMessage, buildFollowUpMessage, formatPhoneDisplay, normalizePhone } from '../utils/whatsapp.js';
import { copyText, openExternal } from '../utils/download.js';
import { DOC_TYPE_META, balanceDue, calculateTotals } from '../utils/documents.js';
import { formatCurrency } from '../utils/currency.js';
import { formatDateLong } from '../utils/dates.js';

const VARIANTS = [
  { id: 'default', label: 'Kirim dokumen' },
  { id: 'reminder', label: 'Ingatkan pembayaran' },
  { id: 'thanks', label: 'Ucapan terima kasih' },
];

export function WhatsAppModal({ open, onClose, doc, profile, onSent, toast }) {
  const [variant, setVariant] = useState('default');
  const [phone, setPhone] = useState(doc?.customer?.phone || '');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const isQuote = doc?.type === 'quote';
  const meta = DOC_TYPE_META[doc?.type] || DOC_TYPE_META.invoice;
  const totals = calculateTotals(doc || {});
  const due = balanceDue(doc || {});

  const variants = useMemo(() => {
    if (!doc) return VARIANTS;
    if (isQuote) {
      return [
        { id: 'default', label: 'Kirim penawaran' },
        { id: 'reminder', label: 'Follow-up penawaran' },
        { id: 'thanks', label: 'Konfirmasi disetujui' },
      ];
    }
    if (doc.status === 'paid') {
      return [
        { id: 'thanks', label: 'Ucapan terima kasih' },
        { id: 'default', label: 'Kirim ulang invoice' },
      ];
    }
    return VARIANTS;
  }, [doc, isQuote]);

  const generated = useMemo(() => {
    if (!doc) return '';
    if (isQuote && variant === 'reminder') {
      const base = buildFollowUpMessage(doc, profile);
      const validity = formatDateLong(doc.validUntil || doc.dueDate);
      return `${base}\n\nPenawaran berlaku sampai ${validity}.`;
    }
    if (isQuote && variant === 'thanks') {
      return [
        `Halo Kak ${(doc.customer?.name || '').split(' ')[0]}, terima kasih sudah menyetujui penawaran *${doc.number}*.`,
        '',
        `Total disetujui: *${formatCurrency(totals.total, profile.currency || 'IDR')}*`,
        '',
        'Kami akan segera menghubungi Kakak untuk jadwal pengerjaan. 🙏',
      ].join('\n');
    }
    return buildWhatsAppMessage(doc, profile, { variant });
  }, [doc, profile, variant, isQuote, totals.total]);

  React.useEffect(() => {
    setMessage(generated);
    setCopied(false);
  }, [generated]);

  React.useEffect(() => {
    if (open && doc) {
      setPhone(doc.customer?.phone || '');
      setVariant(isQuote ? 'default' : doc.status === 'paid' ? 'thanks' : 'default');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, doc?.id]);

  if (!doc) return null;

  const link = buildWhatsAppLink(phone, message);
  const normalized = normalizePhone(phone);

  const handleSend = () => {
    openExternal(link);
    onSent?.(doc.id);
    onClose?.();
  };

  const handleCopy = async () => {
    const ok = await copyText(message);
    setCopied(ok);
    toast?.(ok ? 'Pesan disalin ke clipboard' : 'Gagal menyalin pesan', ok ? 'success' : 'error');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Kirim ${meta.whatsappNoun} via WhatsApp`}
      description={`${doc.number} • ${doc.customer?.name || 'Pelanggan'}`}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={handleCopy}>
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? 'Tersalin' : 'Salin pesan'}
          </button>
          <button type="button" className="btn btn-wa" onClick={handleSend} disabled={!message.trim()}>
            <MessageCircle size={16} /> Buka WhatsApp
          </button>
        </>
      }
    >
      <div className="chip-row">
        {variants.map((v) => (
          <button
            key={v.id}
            type="button"
            className={`chip${variant === v.id ? ' active' : ''}`}
            onClick={() => setVariant(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="field">
        <label htmlFor="wa-phone">Nomor WhatsApp pelanggan</label>
        <div className="input-group">
          <span className="prefix">
            <Phone size={13} />
          </span>
          <input
            id="wa-phone"
            className="input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0812 3456 7890"
            inputMode="tel"
          />
        </div>
        <span className="hint">
          {normalized
            ? `Akan dikirim ke ${formatPhoneDisplay(phone)}`
            : 'Nomor kosong — WhatsApp akan meminta Anda memilih kontak.'}
        </span>
      </div>

      <div className="field">
        <label htmlFor="wa-message">Isi pesan</label>
        <textarea
          id="wa-message"
          className="textarea"
          style={{ minHeight: 230, fontFamily: 'var(--font-sans)', fontSize: 12.5 }}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <span className="hint flex items-center gap-6">
          <ExternalLink size={11} /> Pesan akan terbuka di WhatsApp; lampirkan PDF secara manual.
        </span>
      </div>

      <div
        className="flex items-center gap-8"
        style={{
          padding: '10px 12px',
          borderRadius: 10,
          background: 'var(--info-soft)',
          color: 'var(--info)',
          fontSize: 12,
        }}
      >
        <MessageCircle size={15} />
        <span>
          {isQuote
            ? `Total penawaran ${formatCurrency(totals.total, profile.currency || 'IDR')}`
            : due > 0
              ? `Sisa tagihan ${formatCurrency(due, profile.currency || 'IDR')}`
              : 'Invoice sudah lunas'}
        </span>
      </div>
    </Modal>
  );
}
