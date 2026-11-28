import { describe, expect, it } from 'vitest';
import {
  PdfWriter,
  base64ToBytes,
  hexToRgb,
  toWinAnsi,
} from '../src/pdf/pdfWriter.js';
import { renderDocumentPdf } from '../src/pdf/docPdf.js';
import { DEFAULT_PROFILE, createDemoDocuments, createDocument } from '../src/utils/documents.js';

function asLatin1(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) out += String.fromCharCode(bytes[i]);
  return out;
}

/** Ambil semua stream teks dari PDF hasil render. */
function extractText(bytes) {
  const raw = asLatin1(bytes);
  const chunks = [];
  const regex = /stream\n([\s\S]*?)\nendstream/g;
  let match = regex.exec(raw);
  while (match) {
    const cleaned = match[1].replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
    chunks.push(cleaned);
    match = regex.exec(raw);
  }
  return chunks.join('\n');
}

/** Validasi struktur xref: setiap offset harus menunjuk ke "N 0 obj". */
function validateXref(bytes) {
  const raw = asLatin1(bytes);
  expect(raw.startsWith('%PDF-1.4')).toBe(true);
  expect(raw.trimEnd().endsWith('%%EOF')).toBe(true);

  const startxrefIndex = raw.lastIndexOf('startxref');
  const xrefOffset = Number.parseInt(raw.slice(startxrefIndex + 9).trim(), 10);
  expect(Number.isFinite(xrefOffset)).toBe(true);
  expect(raw.slice(xrefOffset, xrefOffset + 4)).toBe('xref');

  const xrefBlock = raw.slice(xrefOffset);
  const header = /^xref\n(\d+) (\d+)\n/.exec(xrefBlock);
  expect(header).toBeTruthy();
  const start = Number(header[1]);
  const count = Number(header[2]);
  expect(start).toBe(0);

  const lines = xrefBlock.split('\n').slice(2, 2 + count);
  const missing = [];
  lines.forEach((line, index) => {
    const offset = Number.parseInt(line.slice(0, 10), 10);
    if (index === 0) {
      expect(line.slice(17, 18)).toBe('f');
      return;
    }
    if (!raw.startsWith(`${index} 0 obj`, offset)) missing.push(index);
  });
  expect(missing).toEqual([]);

  const trailer = /trailer\n<< \/Size (\d+) \/Root (\d+) 0 R \/Info (\d+) 0 R >>/.exec(raw);
  expect(trailer).toBeTruthy();
  expect(Number(trailer[1])).toBe(count);
  return { root: Number(trailer[2]), count };
}

describe('PDF writer', () => {
  it('mengonversi warna hex ke RGB', () => {
    expect(hexToRgb('#0f766e')).toEqual([15 / 255, 118 / 255, 110 / 255]);
    expect(hexToRgb('#fff')).toEqual([1, 1, 1]);
    expect(hexToRgb('tidak-valid')).toEqual(hexToRgb('#0f766e'));
  });

  it('menormalkan karakter non-ASCII ke WinAnsi', () => {
    expect(toWinAnsi('Rp 1.000 • “halo” – é')).toBe('Rp 1.000 \u0095 \u0093halo\u0094 \u0096 e');
    expect(toWinAnsi('Tanda ✓ selesai')).toBe('Tanda v selesai');
    expect(toWinAnsi('emoji 😀 dibuang')).toBe('emoji  dibuang');
      });

  it('mengukur lebar teks sesuai metrik Helvetica', () => {
    const writer = new PdfWriter();
    // "Halo" pada 10pt = (722+556+222+556)/1000*10
    expect(writer.textWidth('Halo', 10)).toBeCloseTo(20.56, 2);
    expect(writer.textWidth('Halo', 10, true)).toBeGreaterThan(writer.textWidth('Halo', 10));
    expect(writer.textWidth('', 10)).toBe(0);
  });

  it('memecah paragraf panjang menjadi beberapa baris', () => {
    const writer = new PdfWriter();
    const text =
      'Penawaran ini berlaku sampai tanggal yang tertera pada dokumen. Harga dapat berubah setelah masa berlaku habis.';
    const lines = writer.wrap(text, 200, 9);
    expect(lines.length).toBeGreaterThan(1);
    lines.forEach((line) => expect(writer.textWidth(line, 9)).toBeLessThanOrEqual(200));
    expect(lines.join(' ').replace(/\s+/g, ' ')).toBe(text);
    expect(writer.wrap('', 100)).toEqual(['']);
    // kata super panjang dipotong paksa
    const long = writer.wrap('x'.repeat(300), 60, 9);
    expect(long.length).toBeGreaterThan(1);
  });

  it('menghasilkan PDF satu halaman dengan xref valid', () => {
    const writer = new PdfWriter({ title: 'Uji' });
    writer.beginPage();
    writer.text('Halo Dunia', 40, 40, { size: 12, bold: true });
    writer.rect(40, 60, 100, 20, { fill: [0.9, 0.9, 0.9], radius: 4 });
    writer.circle(200, 80, 12, { fill: [0, 0, 0] });
    writer.line(40, 100, 300, 100);
    writer.setFooter((w, page, total) => w.text(`Halaman ${page}/${total}`, 40, w.height - 30, { size: 8 }));
    const bytes = writer.toBytes();
    expect(bytes).toBeInstanceOf(Uint8Array);
    validateXref(bytes);
    const text = extractText(bytes);
    expect(text).toContain('Halo Dunia');
    expect(text).toContain('Halaman 1/1');
  });

  it('membuat halaman tambahan dengan footer berbeda', () => {
    const writer = new PdfWriter();
    writer.setFooter((w, page, total) => w.text(`hal ${page} dari ${total}`, 40, w.height - 30, { size: 8 }));
    writer.beginPage();
    writer.text('Halaman pertama', 40, 40);
    writer.beginPage();
    writer.text('Halaman kedua', 40, 40);
    const bytes = writer.toBytes();
    const { count } = validateXref(bytes);
    const raw = asLatin1(bytes);
    expect(raw.match(/\/Type \/Page[^s]/g)).toHaveLength(2);
    expect(count).toBeGreaterThan(10);
    const text = extractText(bytes);
    expect(text).toContain('hal 1 dari 2');
    expect(text).toContain('hal 2 dari 2');
    expect(text).toContain('Halaman kedua');
  });

  it('menyematkan gambar JPEG bila valid', () => {
    // JPEG 1x1 piksel minimal
    const tinyJpeg =
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEB/8AAEQgAAQABAwERAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/aAAwDAQACEQMRAD8A/v4oAKAP/9k=';
    const writer = new PdfWriter();
    writer.beginPage();
    const ok = writer.image(tinyJpeg, 40, 40, 50, 50);
    expect(ok).toBe(true);
    expect(writer.image('data:image/png;base64,AAAA', 0, 0, 10, 10)).toBe(false);
    const bytes = writer.toBytes();
    validateXref(bytes);
    const raw = asLatin1(bytes);
    expect(raw).toContain('/Subtype /Image');
    expect(raw).toContain('/DCTDecode');
    expect(raw).toContain('/Width 1 /Height 1');
  });

  it('mengurai base64 ke byte', () => {
    expect(Array.from(base64ToBytes('AAAA'))).toEqual([0, 0, 0]);
    expect(Array.from(base64ToBytes('AQID'))).toEqual([1, 2, 3]);
    expect(base64ToBytes('').length).toBe(0);
  });
});

describe('PDF invoice & penawaran', () => {
  it('merender seluruh dokumen demo tanpa error', () => {
    const docs = createDemoDocuments();
    docs.forEach((doc) => {
      const bytes = renderDocumentPdf(doc, DEFAULT_PROFILE, { showTerbilang: true });
      expect(bytes.length).toBeGreaterThan(2000);
      validateXref(bytes);
      const text = extractText(bytes);
      expect(text).toContain(doc.number);
      expect(text).toContain(doc.customer.name);
    });
  });

  it('menampilkan label yang sesuai untuk invoice & penawaran', () => {
    const invoices = createDemoDocuments().filter((d) => d.type === 'invoice');
    const quotes = createDemoDocuments().filter((d) => d.type === 'quote');

    const invoiceText = extractText(renderDocumentPdf(invoices[0], DEFAULT_PROFILE));
    expect(invoiceText).toContain('INVOICE');
    expect(invoiceText).toContain('DITAGIHKAN KEPADA');
    expect(invoiceText).toContain('TERBILANG');
    expect(invoiceText).toContain('PEMBAYARAN KE');

    const quoteText = extractText(renderDocumentPdf(quotes[0], DEFAULT_PROFILE));
    expect(quoteText).toContain('PENAWARAN HARGA');
    expect(quoteText).toContain('PENAWARAN UNTUK');
    expect(quoteText).toContain('SYARAT & KETENTUAN');
  });

  it('memecah invoice panjang menjadi beberapa halaman', () => {
    const items = Array.from({ length: 40 }, (_, i) => ({
      id: `i${i}`,
      name: `Item katering nomor ${i + 1} dengan deskripsi cukup panjang`,
      description: 'Termasuk nasi, lauk utama, sayur, dan air mineral kemasan',
      qty: 10,
      unit: 'box',
      price: 25000,
    }));
    const doc = createDocument({
      items,
      customer: { name: 'PT Uji Halaman', address: 'Jl. Panjang sekali no 1' },
      tax: { enabled: true, rate: 11 },
    });
    const bytes = renderDocumentPdf(doc, DEFAULT_PROFILE);
    const raw = asLatin1(bytes);
    const pageCount = (raw.match(/\/Type \/Page[^s]/g) || []).length;
    expect(pageCount).toBeGreaterThan(1);
    validateXref(bytes);
    const text = extractText(bytes);
    expect(text).toContain('Item katering nomor 40');
    expect(text).toContain('lanjutan');
  });

  it('menyembunyikan terbilang saat preferensi dimatikan', () => {
    const doc = createDemoDocuments()[0];
    const text = extractText(renderDocumentPdf(doc, DEFAULT_PROFILE, { showTerbilang: false }));
    expect(text).not.toContain('TERBILANG');
  });

  it('tetap aman untuk dokumen kosong', () => {
    const empty = createDocument({ items: [], customer: {} });
    const bytes = renderDocumentPdf(empty, DEFAULT_PROFILE);
    validateXref(bytes);
  });

  it('mendukung profil tanpa logo maupun rekening', () => {
    const doc = createDemoDocuments()[0];
    const bytes = renderDocumentPdf(doc, { businessName: 'Tanpa Rekening', currency: 'IDR' });
    const text = extractText(bytes);
    expect(text).toContain('Tanpa Rekening');
    expect(text).not.toContain('PEMBAYARAN KE');
  });
});
