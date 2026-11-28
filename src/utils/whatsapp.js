import { formatCurrency } from './currency.js';
import { calculateTotals, balanceDue, DOC_TYPE_META, paidAmount, effectiveStatus, STATUS } from './documents.js';
import { formatDateLong } from './dates.js';

/**
 * Normalisasi nomor HP Indonesia ke format internasional tanpa "+".
 * "0812-3456-7890" -> "6281234567890"
 */
export function normalizePhone(raw, defaultCountry = '62') {
  if (!raw) return '';
  let digits = String(raw).replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (digits.startsWith('0')) digits = defaultCountry + digits.slice(1);
  else if (digits.startsWith('8')) digits = defaultCountry + digits;
  return digits.replace(/\D/g, '');
}

export function formatPhoneDisplay(raw) {
  const n = normalizePhone(raw);
  if (!n) return '';
  if (n.startsWith('62')) {
    const rest = n.slice(2);
    return `+62 ${rest.replace(/(\d{3})(\d{4})(\d+)/, '$1-$2-$3')}`;
  }
  return `+${n}`;
}

/** Link chat WhatsApp (wa.me) dengan pesan terisi otomatis. */
export function buildWhatsAppLink(phone, message) {
  const normalized = normalizePhone(phone);
  const text = encodeURIComponent(message || '');
  return normalized
    ? `https://wa.me/${normalized}?text=${text}`
    : `https://wa.me/?text=${text}`;
}

function docLabel(doc) {
  return (DOC_TYPE_META[doc.type] || DOC_TYPE_META.invoice).whatsappNoun;
}

export function formatGreeting(customer, profile) {
  const name = (customer?.name || '').split(' ')[0];
  return name ? `Halo Kak ${name}` : 'Halo';
}

/**
 * Susun pesan WhatsApp berdasarkan jenis dokumen & status pembayaran.
 * @param {object} doc
 * @param {object} profile
 * @param {{variant?: 'default'|'reminder'|'thanks'}} options
 */
export function buildWhatsAppMessage(doc, profile = {}, options = {}) {
  const currency = profile.currency || 'IDR';
  const meta = DOC_TYPE_META[doc.type] || DOC_TYPE_META.invoice;
  const { total } = calculateTotals(doc);
  const paid = paidAmount(doc);
  const due = balanceDue(doc);
  const status = effectiveStatus(doc);
  const business = profile.businessName || 'kami';
  const greeting = formatGreeting(doc.customer, profile);
  const number = doc.number || '(nomor belum diisi)';
  const lines = [];

  if (options.variant === 'reminder') {
    lines.push(`${greeting}, kami ingin mengingatkan ${meta.whatsappNoun} *${number}* dengan sisa tagihan:`);
  } else if (options.variant === 'thanks') {
    lines.push(`${greeting}, terima kasih atas pembayaran ${meta.whatsappNoun} *${number}*.`);
  } else {
    lines.push(`${greeting}, berikut ${meta.whatsappNoun} dari *${business}*:`);
  }

  lines.push('');
  lines.push(`🧾 No. ${number}`);
  lines.push(`📅 Tanggal: ${formatDateLong(doc.issueDate)}`);
  if (doc.type === 'quote') {
    lines.push(`⏳ Berlaku s/d: ${formatDateLong(doc.validUntil || doc.dueDate)}`);
  } else {
    lines.push(`⏳ Jatuh tempo: ${formatDateLong(doc.dueDate)}`);
  }

  const items = (doc.items || []).filter((item) => item.name?.trim());
  if (items.length) {
    lines.push('');
    lines.push('*Rincian:*');
    items.slice(0, 8).forEach((item) => {
      const amount = formatCurrency((Number(item.qty) || 0) * (Number(item.price) || 0), currency);
      lines.push(`• ${item.name} — ${item.qty} ${item.unit || ''} × ${formatCurrency(item.price, currency)} = ${amount}`);
    });
    if (items.length > 8) lines.push(`• …dan ${items.length - 8} item lainnya`);
  }

  lines.push('');
  lines.push(`*Total: ${formatCurrency(total, currency)}*`);

  if (doc.type !== 'quote') {
    if (paid > 0 && due > 0) {
      lines.push(`Sudah dibayar: ${formatCurrency(paid, currency)}`);
      lines.push(`Sisa tagihan: *${formatCurrency(due, currency)}*`);
    } else if (due === 0 && status === STATUS.PAID) {
      lines.push('Status: ✅ LUNAS — terima kasih!');
    }
  }

  const bank = (profile.bankAccounts || [])[0];
  if (bank && due > 0 && doc.type !== 'quote') {
    lines.push('');
    lines.push('*Pembayaran ke:*');
    lines.push(`${bank.bank} • ${bank.accountNumber}`);
    lines.push(`a.n. ${bank.accountName}`);
  }

  if (options.variant === 'default') {
    lines.push('');
    lines.push(`Mohon dibalas bila ada pertanyaan. Terima kasih 🙏`);
    lines.push(`— ${profile.ownerName || business}`);
  } else if (options.variant === 'reminder') {
    lines.push('');
    lines.push('Mohon konfirmasi setelah transfer ya Kak. Terima kasih 🙏');
  } else {
    lines.push('');
    lines.push(`Sampai jumpa di pesanan berikutnya! 🙏`);
  }

  return lines.join('\n');
}

/** Template singkat untuk follow-up penawaran. */
export function buildFollowUpMessage(doc, profile = {}) {
  const greeting = formatGreeting(doc.customer, profile);
  const meta = DOC_TYPE_META[doc.type] || DOC_TYPE_META.invoice;
  return [
    `${greeting}, kami ingin menanyakan kelanjutan ${meta.whatsappNoun} *${doc.number}* dari *${profile.businessName || 'kami'}*.`,
    '',
    `Apakah ada yang perlu kami sesuaikan? Kami siap membantu. 🙏`,
  ].join('\n');
}
