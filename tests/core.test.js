import { describe, expect, it } from 'vitest';
import { formatCompact, formatCurrency, parseAmount, round2, getCurrency } from '../src/utils/currency.js';
import { terbilang } from '../src/utils/terbilang.js';
import {
  buildWhatsAppLink,
  buildWhatsAppMessage,
  formatPhoneDisplay,
  normalizePhone,
} from '../src/utils/whatsapp.js';
import { addDaysISO, formatDate, formatDateLong, relativeDayText, toISODate, monthLabel } from '../src/utils/dates.js';
import { parseBackup, exportBackup, DEFAULT_SETTINGS } from '../src/utils/storage.js';
import { createDocument } from '../src/utils/documents.js';

describe('Format mata uang', () => {
  it('memformat rupiah gaya Indonesia', () => {
    expect(formatCurrency(1250000)).toBe('Rp 1.250.000');
    expect(formatCurrency(0)).toBe('Rp 0');
    expect(formatCurrency(999.6)).toBe('Rp 1.000');
    expect(formatCurrency(1500.5, 'IDR', { symbol: false })).toBe('1.501');
  });

  it('memformat mata uang asing dengan desimal', () => {
    expect(formatCurrency(1234.5, 'USD')).toBe('$ 1,234.50');
    expect(getCurrency('USD').decimals).toBe(2);
    expect(getCurrency('XXX').code).toBe('IDR');
  });

  it('menyediakan format ringkas untuk kartu statistik', () => {
    expect(formatCompact(1500000)).toBe('Rp 1,5 jt');
    expect(formatCompact(250000)).toBe('Rp 250 rb');
    expect(formatCompact(2500000000)).toBe('Rp 2,5 M');
    expect(formatCompact(-1500000)).toBe('-Rp 1,5 jt');
  });

  it('membaca input nominal yang ditulis pengguna', () => {
    expect(parseAmount('1.500.000')).toBe(1500000);
    expect(parseAmount('Rp 1.500.000')).toBe(1500000);
    expect(parseAmount('2,5jt')).toBe(2500000);
    expect(parseAmount('350rb')).toBe(350000);
    expect(parseAmount(12500)).toBe(12500);
    expect(parseAmount('')).toBe(0);
    expect(parseAmount('abc')).toBe(0);
  });

  it('membulatkan ke dua desimal', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });
});

describe('Terbilang Bahasa Indonesia', () => {
  it('menghasilkan kata yang benar', () => {
    expect(terbilang(0)).toBe('Nol rupiah');
    expect(terbilang(1500)).toBe('Seribu lima ratus rupiah');
    expect(terbilang(1250000)).toBe('Satu juta dua ratus lima puluh ribu rupiah');
    expect(terbilang(21000)).toBe('Dua puluh satu ribu rupiah');
    expect(terbilang(11000)).toBe('Sebelas ribu rupiah');
    expect(terbilang(201_000_000)).toBe('Dua ratus satu juta rupiah');
    expect(terbilang(1_500_000_000)).toBe('Satu miliar lima ratus juta rupiah');
  });

  it('mendukung mata uang lain dan nilai desimal', () => {
    expect(terbilang(1500, 'USD')).toBe('Seribu lima ratus dolar amerika serikat');
    expect(terbilang(1234.5, 'USD')).toBe('Seribu dua ratus tiga puluh empat koma lima puluh dolar amerika serikat');
    expect(terbilang(-500)).toBe('Minus lima ratus rupiah');
  });
});

describe('WhatsApp', () => {
  it('menormalisasi nomor Indonesia', () => {
    expect(normalizePhone('0812-3456-7890')).toBe('6281234567890');
    expect(normalizePhone('+62 812 3456 7890')).toBe('6281234567890');
    expect(normalizePhone('81234567890')).toBe('6281234567890');
    expect(normalizePhone('')).toBe('');
    expect(formatPhoneDisplay('081234567890')).toBe('+62 812-3456-7890');
  });

  it('membuat tautan wa.me dengan pesan terenkode', () => {
    const link = buildWhatsAppLink('08123456789', 'Halo dunia & rekan');
    expect(link.startsWith('https://wa.me/628123456789?text=')).toBe(true);
    expect(link).toContain(encodeURIComponent('Halo dunia & rekan'));
    expect(buildWhatsAppLink('', 'x')).toContain('https://wa.me/?text=');
  });

  it('menyusun pesan invoice lengkap dengan sisa tagihan', () => {
    const doc = createDocument({
      number: 'INV/202611/009',
      customer: { name: 'Budi Santoso', phone: '0812', company: 'PT Budi' },
      items: [{ id: 'a', name: 'Katering', qty: 2, unit: 'hari', price: 500000 }],
      tax: { enabled: true, rate: 10 },
      payments: [{ id: 'p', date: '2026-11-01', amount: 400000 }],
    });
    const message = buildWhatsAppMessage(doc, {
      businessName: 'Dapur Bunda',
      ownerName: 'Sari',
      currency: 'IDR',
      bankAccounts: [{ id: 'b', bank: 'BRI', accountNumber: '123', accountName: 'Sari' }],
    });
    expect(message).toContain('Halo Kak Budi');
    expect(message).toContain('INV/202611/009');
    expect(message).toContain('Katering');
    expect(message).toContain('Total: Rp 1.100.000');
    expect(message).toContain('Sisa tagihan');
    expect(message).toContain('BRI • 123');
  });

  it('menyusun pesan penawaran tanpa info rekening', () => {
    const quote = createDocument({
      type: 'quote',
      number: 'QTN/202611/002',
      customer: { name: 'Rina' },
      items: [{ id: 'a', name: 'Desain logo', qty: 1, price: 750000 }],
      tax: { enabled: false },
    });
    const message = buildWhatsAppMessage(quote, { businessName: 'Studio R', currency: 'IDR' });
    expect(message).toContain('penawaran harga');
    expect(message).toContain('Berlaku s/d');
    expect(message).not.toContain('Pembayaran ke');
  });
});

describe('Utilitas tanggal', () => {
  it('memformat tanggal lokal', () => {
    expect(formatDate('2026-11-28')).toBe('28 Nov 2026');
    expect(formatDateLong('2026-01-05')).toBe('5 Januari 2026');
    expect(formatDate(null)).toBe('—');
    expect(monthLabel('2026-11-01')).toBe('Nov 26');
  });

  it('menambah hari & menghasilkan ISO date', () => {
    expect(addDaysISO('2026-11-28', 7)).toBe('2026-12-05');
    expect(toISODate(new Date(2026, 0, 9))).toBe('2026-01-09');
  });

  it('memberi label relatif', () => {
    const now = new Date(2026, 10, 28);
    expect(relativeDayText('2026-11-28', now)).toBe('Hari ini');
    expect(relativeDayText('2026-11-29', now)).toBe('Besok');
    expect(relativeDayText('2026-11-27', now)).toBe('Kemarin');
    expect(relativeDayText('2026-12-05', now)).toBe('7 hari lagi');
    expect(relativeDayText('2026-11-20', now)).toBe('Lewat 8 hari');
  });
});

describe('Cadangan data', () => {
  it('mengekspor dan memvalidasi backup', () => {
    const payload = exportBackup({
      documents: [createDocument()],
      customers: [],
      profile: { businessName: 'X' },
      settings: DEFAULT_SETTINGS,
    });
    const parsed = parseBackup(JSON.stringify(payload));
    expect(parsed.documents).toHaveLength(1);
    expect(parsed.profile.businessName).toBe('X');
    expect(() => parseBackup('{"foo": 1}')).toThrow();
    expect(() => parseBackup('bukan json')).toThrow();
  });
});
