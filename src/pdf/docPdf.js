import { PdfWriter, hexToRgb } from './pdfWriter.js';
import { formatCurrency } from '../utils/currency.js';
import { terbilang } from '../utils/terbilang.js';
import {
  calculateTotals,
  DOC_TYPE_META,
  paidAmount,
  balanceDue,
  lineTotal,
} from '../utils/documents.js';
import { formatDateLong } from '../utils/dates.js';

const INK = [0.09, 0.11, 0.14];
const MUTED = [0.42, 0.45, 0.5];
const LIGHT = [0.62, 0.66, 0.7];
const RULE = [0.87, 0.88, 0.9];
const SOFT = [0.965, 0.968, 0.972];

function tint(hex, amount = 0.9) {
  const rgb = hexToRgb(hex);
  return rgb.map((c) => Math.min(1, c + (1 - c) * amount));
}

/**
 * Susun PDF invoice / penawaran harga.
 * @param {object} doc dokumen (invoice atau quote)
 * @param {object} profile profil usaha
 * @param {{accent?: string, showTerbilang?: boolean, showItemsDesc?: boolean}} options
 * @returns {Uint8Array}
 */
export function renderDocumentPdf(doc, profile = {}, options = {}) {
  const meta = DOC_TYPE_META[doc.type] || DOC_TYPE_META.invoice;
  const accentHex = options.accent || '#0f766e';
  const accent = hexToRgb(accentHex);
  const currency = profile.currency || 'IDR';
  const totals = calculateTotals(doc);
  const paid = paidAmount(doc);
  const due = balanceDue(doc);
  const isQuote = doc.type === 'quote';
  const showTerbilang = options.showTerbilang !== false;

  const writer = new PdfWriter({ size: 'A4', margin: 42, title: `${meta.title} ${doc.number}` });
  const M = writer.margin;
  const RIGHT = writer.width - M;

  /* ------------------------------ KOP HALAMAN ----------------------------- */
  const drawLetterhead = () => {
    writer.beginPage();
    // bar aksen tipis di atas
    writer.rect(0, 0, writer.width, 5, { fill: accent });

    let y = 46;
    const logoW = 54;
    const hasLogo = Boolean(profile.logoDataUrl) && writer.registerJpeg(profile.logoDataUrl);

    if (hasLogo) {
      writer.image(profile.logoDataUrl, M, y, logoW, logoW * 0.8);
    }
    const textX = hasLogo ? M + logoW + 12 : M;

    writer.text(profile.businessName || 'Nama Usaha', textX, y, {
      size: hasLogo ? 13 : 16,
      bold: true,
      color: INK,
    });
    let leftY = y + (hasLogo ? 15 : 19);
    if (profile.tagline) {
      writer.text(profile.tagline, textX, leftY, { size: 7.8, color: MUTED });
      leftY += 11;
    }
    const contactBits = [profile.phone, profile.email, profile.website].filter(Boolean);
    if (contactBits.length) {
      writer.text(contactBits.join('  •  '), textX, leftY, { size: 7.5, color: MUTED });
      leftY += 10;
    }
    if (profile.address) {
      const lines = String(profile.address).split('\n');
      lines.slice(0, 2).forEach((line, i) => {
        writer.text(line, textX, leftY + i * 9, { size: 7.5, color: MUTED });
      });
    }

    // judul dokumen (kanan)
    writer.text(meta.title, RIGHT, y - 2, { size: 22, bold: true, color: accent, align: 'right' });
    writer.text(`No. ${doc.number || '—'}`, RIGHT, y + 24, {
      size: 9, color: INK, align: 'right', bold: true,
    });
    const statusText = isQuote
      ? `Berlaku s/d ${formatDateLong(doc.validUntil || doc.dueDate)}`
      : `Jatuh tempo ${formatDateLong(doc.dueDate)}`;
    writer.text(statusText, RIGHT, y + 37, { size: 7.5, color: MUTED, align: 'right' });
    if (profile.npwp) {
      writer.text(`NPWP ${profile.npwp}`, RIGHT, y + 47, { size: 7, color: LIGHT, align: 'right' });
    }

    const dividerY = Math.max(leftY + 22, y + 62);
    writer.line(M, dividerY, RIGHT, dividerY, { color: RULE, width: 0.9 });
    return dividerY + 16;
  };

  let y = drawLetterhead();

  /* ------------------------------- INFO PIHAK ----------------------------- */
  const cardH = 78;
  writer.rect(M, y, RIGHT - M, cardH, { fill: SOFT, radius: 8 });
  const colSplit = M + (RIGHT - M) * 0.52;
  writer.line(colSplit, y + 12, colSplit, y + cardH - 12, { color: RULE, width: 0.7 });

  const labelY = y + 13;
  writer.text(isQuote ? 'PENAWARAN UNTUK' : 'DITAGIHKAN KEPADA', M + 14, labelY, {
    size: 6.8, bold: true, color: accent, charSpace: 0.6,
  });
  const cust = doc.customer || {};
  writer.text(cust.name || 'Pelanggan', M + 14, labelY + 13, { size: 10, bold: true, color: INK });
  let cY = labelY + 27;
  if (cust.company) {
    writer.text(cust.company, M + 14, cY, { size: 8, color: MUTED });
    cY += 10;
  }
  const custLines = [cust.phone, cust.email].filter(Boolean).join('  •  ');
  if (custLines) {
    writer.text(custLines, M + 14, cY, { size: 7.5, color: MUTED });
    cY += 9;
  }
  if (cust.address) {
    writer.text(writer.wrap(cust.address, colSplit - M - 92, 7.5)[0] || '', M + 14, cY, {
      size: 7.5, color: MUTED,
    });
  }

  // kolom detail dokumen
  const dX = colSplit + 14;
  writer.text('DETAIL DOKUMEN', dX, labelY, { size: 6.8, bold: true, color: accent, charSpace: 0.6 });
  const detailRows = isQuote
    ? [
        ['Tanggal', formatDateLong(doc.issueDate)],
        ['Berlaku s/d', formatDateLong(doc.validUntil || doc.dueDate)],
        ['Jumlah item', `${totals.itemCount} item`],
      ]
    : [
        ['Tanggal terbit', formatDateLong(doc.issueDate)],
        ['Jatuh tempo', formatDateLong(doc.dueDate)],
        ['Status', statusLabel(doc, totals, paid)],
      ];
  detailRows.forEach(([label, value], i) => {
    const rowY = labelY + 15 + i * 12;
    writer.text(label, dX, rowY, { size: 7.5, color: MUTED });
    writer.text(value, RIGHT - 14, rowY, { size: 7.5, bold: true, color: INK, align: 'right' });
  });

  y += cardH + 20;

  /* --------------------------------- TABEL -------------------------------- */
  const COL = {
    no: M + 10,
    desc: M + 34,
    qtyRight: M + 300,
    priceRight: M + 400,
    amountRight: RIGHT - 12,
  };
  const DESC_W = COL.qtyRight - COL.desc - 42;
  const BOTTOM = 92;

  const drawTableHead = (top, continuation = false) => {
    writer.rect(M, top, RIGHT - M, 24, { fill: accent, radius: 5 });
    writer.text('NO', COL.no, top + 8, { size: 7, bold: true, color: [1, 1, 1], charSpace: 0.4 });
    writer.text(meta.itemsHeading.toUpperCase(), COL.desc, top + 8, {
      size: 7, bold: true, color: [1, 1, 1], charSpace: 0.4,
    });
    writer.text('QTY', COL.qtyRight, top + 8, {
      size: 7, bold: true, color: [1, 1, 1], align: 'right', charSpace: 0.4,
    });
    writer.text('HARGA', COL.priceRight, top + 8, {
      size: 7, bold: true, color: [1, 1, 1], align: 'right', charSpace: 0.4,
    });
    writer.text('JUMLAH', COL.amountRight, top + 8, {
      size: 7, bold: true, color: [1, 1, 1], align: 'right', charSpace: 0.4,
    });
    if (continuation) {
      writer.text('(lanjutan)', M + 10, top - 11, { size: 7, italic: true, color: MUTED });
    }
    return top + 24;
  };

  y = drawTableHead(y);

  const items = (doc.items || []).filter(
    (item) => (item.name && item.name.trim()) || (item.description && item.description.trim())
  );

  items.forEach((item, index) => {
    const name = item.name?.trim() || '-';
    const qtyLabel = `${formatQty(item.qty)}${item.unit ? ` ${item.unit}` : ''}`;
    const nameLines = writer.wrap(name, DESC_W, 8.6, true);
    const descLines = item.description ? writer.wrap(item.description, DESC_W, 7.2) : [];
    const rowH = Math.max(30, 12 + nameLines.length * 10.5 + descLines.length * 9.2);

    if (y + rowH > writer.height - BOTTOM) {
      writer.setFooter(footerFn(profile, accentHex, meta));
      y = drawLetterhead();
      y = drawTableHead(y, true);
    }

    if (index % 2 === 1) writer.rect(M, y, RIGHT - M, rowH, { fill: [0.982, 0.984, 0.988] });

    let textY = y + 11;
    nameLines.forEach((line, i) => {
      writer.text(line, COL.desc, textY + i * 10.5, { size: 8.6, bold: true, color: INK });
    });
    descLines.forEach((line, i) => {
      writer.text(line, COL.desc, textY + nameLines.length * 10.5 + 2 + i * 9.2, {
        size: 7.2, color: MUTED,
      });
    });
    writer.text(String(index + 1).padStart(2, '0'), COL.no, textY, { size: 8, color: MUTED });
    writer.text(qtyLabel, COL.qtyRight, textY, { size: 8, color: INK, align: 'right' });
    writer.text(formatCurrency(item.price, currency), COL.priceRight, textY, {
      size: 8, color: INK, align: 'right',
    });
    writer.text(formatCurrency(lineTotal(item), currency), COL.amountRight, textY, {
      size: 8.4, bold: true, color: INK, align: 'right',
    });

    y += rowH;
    writer.line(M, y, RIGHT, y, { color: RULE, width: 0.6 });
  });

  if (!items.length) {
    writer.text('Belum ada item pada dokumen ini.', COL.desc, y + 14, { size: 8.5, italic: true, color: LIGHT });
    y += 34;
    writer.line(M, y, RIGHT, y, { color: RULE, width: 0.6 });
  }

  /* ----------------------------- RINGKASAN BIAYA --------------------------- */
  const totalsRows = [];
  totalsRows.push(['Subtotal', formatCurrency(totals.itemsTotal, currency)]);
  if (totals.discountValue > 0) {
    const label =
      doc.discount?.type === 'percent'
        ? `Diskon (${formatQty(doc.discount.value)}%)`
        : 'Diskon';
    totalsRows.push([label, `- ${formatCurrency(totals.discountValue, currency)}`]);
  }
  if (totals.extraTotal !== 0) {
    (doc.extras || []).forEach((extra) => {
      const amount = Number(extra.amount) || 0;
      if (!extra.label || !amount) return;
      totalsRows.push([
        extra.label,
        `${extra.mode === 'discount' ? '- ' : ''}${formatCurrency(amount, currency)}`,
      ]);
    });
  }
  if (totals.taxValue > 0) {
    totalsRows.push([`${doc.tax?.label || 'PPN'} ${formatQty(doc.tax?.rate)}%`, formatCurrency(totals.taxValue, currency)]);
  }
  if (totals.withholdingValue > 0) {
    totalsRows.push([
      `${doc.withholding?.label || 'PPh'} ${formatQty(doc.withholding?.rate)}%`,
      `- ${formatCurrency(totals.withholdingValue, currency)}`,
    ]);
  }
  if (!isQuote && paid > 0) {
    totalsRows.push(['Sudah dibayar', `- ${formatCurrency(paid, currency)}`]);
  }

  const boxW = 238;
  const boxX = RIGHT - boxW;
  const summaryH = 30 + totalsRows.length * 12.5 + 40;
  const notesW = Math.min(boxX - M - 34, 296);

  // Catatan kiri
  let leftY = y + 18;
  const noteBlocks = [];
  if (doc.notes) noteBlocks.push(['CATATAN', doc.notes]);
  if (doc.terms) noteBlocks.push([isQuote ? 'SYARAT & KETENTUAN' : 'SYARAT PEMBAYARAN', doc.terms]);

  // pastikan blok ringkasan muat di halaman
  const needed = Math.max(summaryH, 60);
  if (y + needed > writer.height - BOTTOM) {
    writer.setFooter(footerFn(profile, accentHex, meta));
    writer.beginPage();
    y = drawLetterhead();
    leftY = y + 18;
  }

  noteBlocks.forEach(([label, body]) => {
    writer.text(label, M, leftY, { size: 6.8, bold: true, color: accent, charSpace: 0.6 });
    const used = writer.paragraph(body, M, leftY + 13, notesW, {
      size: 7.6, color: MUTED, lineHeight: 10.4,
    });
    leftY += 15 + used + 10;
  });

  // Kotak total
  writer.rect(boxX, y + 14, boxW, summaryH, { fill: SOFT, radius: 8 });
  let rowY = y + 28;
  totalsRows.forEach(([label, value]) => {
    writer.text(label, boxX + 14, rowY, { size: 8, color: MUTED });
    writer.text(value, RIGHT - 14, rowY, { size: 8, color: INK, align: 'right' });
    rowY += 12.5;
  });

  if (!isQuote && paid > 0) {
    rowY += 2;
    writer.line(boxX + 14, rowY, RIGHT - 14, rowY, { color: [0.86, 0.87, 0.9], width: 0.6 });
    rowY += 7;
    writer.text('Sisa tagihan', boxX + 14, rowY, { size: 8.5, bold: true, color: INK });
    writer.text(formatCurrency(due, currency), RIGHT - 14, rowY, {
      size: 9.5, bold: true, color: accent, align: 'right',
    });
    rowY += 18;
  } else {
    rowY += 2;
    writer.line(boxX + 14, rowY, RIGHT - 14, rowY, { color: [0.86, 0.87, 0.9], width: 0.6 });
    rowY += 7;
    writer.text(meta.totalLabel, boxX + 14, rowY + 2, { size: 8.5, bold: true, color: INK });
    writer.text(formatCurrency(totals.total, currency), RIGHT - 14, rowY, {
      size: 12, bold: true, color: accent, align: 'right',
    });
    rowY += 22;
  }

  y = Math.max(y + 14 + summaryH, leftY);

  /* ------------------------------- TERBILANG ------------------------------ */
  if (showTerbilang && totals.total > 0) {
    if (y + 34 > writer.height - 70) {
      writer.setFooter(footerFn(profile, accentHex, meta));
      writer.beginPage();
      y = drawLetterhead();
    }
    writer.rect(M, y + 6, RIGHT - M, 26, { fill: tint(accentHex, 0.9), radius: 6 });
    writer.text('TERBILANG', M + 12, y + 13, { size: 6.6, bold: true, color: accent, charSpace: 0.6 });
    writer.text(terbilang(totals.total, currency), M + 62, y + 12, {
      size: 8, italic: true, color: [0.2, 0.24, 0.28],
    });
    y += 40;
  }

  /* -------------------------------- PEMBAYARAN ---------------------------- */
  const banks = (profile.bankAccounts || []).filter((b) => b.accountNumber);
  if (banks.length && (!isQuote || options.quoteShowBank)) {
    if (y + 56 > writer.height - 70) {
      writer.setFooter(footerFn(profile, accentHex, meta));
      writer.beginPage();
      y = drawLetterhead();
    }
    writer.text(isQuote ? 'INFORMASI PEMBAYARAN (JIKA DISETUJUI)' : 'PEMBAYARAN KE', M, y, {
      size: 6.8, bold: true, color: accent, charSpace: 0.6,
    });
    let bx = M;
    banks.slice(0, 2).forEach((bank, i) => {
      const w = (RIGHT - M) / Math.min(banks.length, 2) - 8;
      writer.rect(bx, y + 12, w, 40, { fill: [1, 1, 1], stroke: RULE, radius: 6 });
      writer.text(bank.bank || 'Bank', bx + 12, y + 19, { size: 8, bold: true, color: INK });
      writer.text(bank.accountNumber, bx + 12, y + 30, { size: 10.5, bold: true, color: accent });
      writer.text(`a.n. ${bank.accountName || '-'}`, bx + 12, y + 43, { size: 7, color: MUTED });
      bx += w + 8;
      void i;
    });
    y += 66;
  }

  /* ---------------------------- RIWAYAT PEMBAYARAN ------------------------ */
  const payments = (doc.payments || []).filter((p) => Number(p.amount) > 0);
  if (payments.length && !isQuote) {
    if (y + 26 + payments.length * 14 > writer.height - 74) {
      writer.setFooter(footerFn(profile, accentHex, meta));
      writer.beginPage();
      y = drawLetterhead();
    }
    writer.text('RIWAYAT PEMBAYARAN', M, y, { size: 6.8, bold: true, color: accent, charSpace: 0.6 });
    y += 14;
    payments.forEach((payment, i) => {
      if (i % 2 === 0) writer.rect(M, y - 2, RIGHT - M, 16, { fill: SOFT, radius: 3 });
      writer.text(formatDateLong(payment.date), M + 10, y + 2, { size: 7.5, color: MUTED });
      writer.text(payment.method || 'Transfer', M + 120, y + 2, { size: 7.5, color: INK });
      writer.text(payment.note || '', M + 250, y + 2, { size: 7.2, italic: true, color: LIGHT });
      writer.text(formatCurrency(payment.amount, currency), COL.amountRight, y + 2, {
        size: 8, bold: true, color: INK, align: 'right',
      });
      y += 16;
    });
    y += 8;
  }

  /* -------------------------------- TANDA TANGAN -------------------------- */
  if (y + 74 > writer.height - 66) {
    writer.setFooter(footerFn(profile, accentHex, meta));
    writer.beginPage();
    y = drawLetterhead();
  }
  const signY = y + 18;
  writer.text(doc.signatureLabel || 'Hormat kami,', M, signY, { size: 7.8, color: MUTED });
  writer.line(M, signY + 46, M + 150, signY + 46, { color: [0.66, 0.68, 0.72], width: 0.7 });
  writer.text(profile.ownerName || profile.businessName || '', M, signY + 50, {
    size: 8.6, bold: true, color: INK,
  });
  if (profile.ownerName && profile.businessName) {
    writer.text(profile.businessName, M, signY + 61, { size: 7.2, color: MUTED });
  }

  if (isQuote) {
    const bx = RIGHT - 190;
    writer.rect(bx, signY - 2, 190, 58, { fill: [1, 1, 1], stroke: accent, radius: 6 });
    writer.text('Menyetujui penawaran ini', bx + 12, signY + 6, { size: 7.4, bold: true, color: accent });
    writer.line(bx + 12, signY + 40, bx + 178, signY + 40, { color: [0.7, 0.72, 0.76], width: 0.6 });
    writer.text('Nama & tanda tangan pelanggan', bx + 12, signY + 44, { size: 6.8, color: LIGHT });
  }

  writer.setFooter(footerFn(profile, accentHex, meta));
  return writer.toBytes();
}

function footerFn(profile, accentHex, meta) {
  const accent = hexToRgb(accentHex);
  return (w, page, total) => {
    const lineY = w.height - 54;
    w.line(w.margin, lineY, w.width - w.margin, lineY, { color: [0.88, 0.89, 0.9], width: 0.6 });
    w.text(
      [profile.businessName, profile.phone, profile.email].filter(Boolean).join('  •  '),
      w.margin,
      lineY + 8,
      { size: 7, color: [0.55, 0.58, 0.62] }
    );
    w.text(
      total > 1 ? `Dokumen ${meta.shortLabel} — Halaman ${page} dari ${total}` : `Dokumen ${meta.shortLabel}`,
      w.width - w.margin,
      lineY + 8,
      { size: 7, color: [0.55, 0.58, 0.62], align: 'right' }
    );
    w.rect(w.width - w.margin - 18, lineY + 22, 18, 2, { fill: accent });
  };
}

function statusLabel(doc, totals, paid) {
  if (totals.total > 0 && paid >= totals.total - 0.5) return 'LUNAS';
  if (paid > 0) return 'Dibayar sebagian';
  if (doc.status === 'overdue') return 'JATUH TEMPO';
  if (doc.status === 'sent') return 'Terkirim';
  return 'Draf';
}

function formatQty(value) {
  const n = Number(value) || 0;
  if (Number.isInteger(n)) return n.toLocaleString('id-ID');
  return n.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}
