import { describe, expect, it } from 'vitest';
import {
  buildDocNumber,
  calculateTotals,
  balanceDue,
  createDemoDocuments,
  createDocument,
  createEmptyItem,
  daysToDue,
  effectiveStatus,
  lineTotal,
  nextDocNumber,
  paidAmount,
  paymentProgress,
  DOC_TYPE_META,
} from '../src/utils/documents.js';

describe('Perhitungan dokumen', () => {
  const baseItems = [
    { id: 'a', name: 'Nasi box', qty: 40, unit: 'box', price: 35000 },
    { id: 'b', name: 'Snack box', qty: 40, unit: 'box', price: 15000 },
  ];

  it('menghitung jumlah baris tanpa galat pembulatan', () => {
    expect(lineTotal(baseItems[0])).toBe(1_400_000);
    expect(lineTotal({ qty: 3, price: 100000 / 3 })).toBe(100_000);
    expect(lineTotal({ qty: 0, price: 5000 })).toBe(0);
    expect(lineTotal({})).toBe(0);
  });

  it('menghitung subtotal, diskon persen, PPN, dan potongan PPh', () => {
    const doc = {
      items: baseItems,
      discount: { type: 'percent', value: 10 },
      tax: { enabled: true, rate: 11 },
      withholding: { enabled: true, rate: 2 },
      extras: [{ id: 'e', label: 'Ongkir', amount: 50000, mode: 'add' }],
    };
    const t = calculateTotals(doc);
    expect(t.itemsTotal).toBe(2_000_000);
    expect(t.discountValue).toBe(200_000);
    expect(t.subtotal).toBe(1_800_000);
    expect(t.taxValue).toBe(198_000);
    expect(t.extraTotal).toBe(50_000);
    expect(t.withholdingValue).toBe(36_000);
    expect(t.total).toBe(2_012_000); // 1.800.000 + 198.000 + 50.000 - 36.000
  });

  it('mendukung diskon nominal dan tidak pernah negatif', () => {
    const t = calculateTotals({
      items: [{ id: 'a', qty: 1, price: 100_000 }],
      discount: { type: 'amount', value: 400_000 },
      tax: { enabled: false, rate: 11 },
    });
    expect(t.discountValue).toBe(400_000);
    expect(t.subtotal).toBe(0);
    expect(t.total).toBe(0);
  });

  it('menghitung sisa tagihan & progres pembayaran', () => {
    const doc = {
      items: [{ id: 'a', qty: 2, price: 500_000 }],
      tax: { enabled: false },
      payments: [
        { id: 'p1', amount: 400_000 },
        { id: 'p2', amount: 100_000 },
      ],
    };
    expect(paidAmount(doc)).toBe(500_000);
    expect(balanceDue(doc)).toBe(500_000);
    const t = calculateTotals(doc);
    expect(t.total).toBe(1_000_000);
    expect(balanceDue({ ...doc, payments: [{ id: 'p', amount: 1_000_000 }] })).toBe(0);
    expect(paymentProgress(doc)).toBeCloseTo(0.5, 5);
    expect(paymentProgress({ items: [] })).toBe(0);
  });
});

describe('Status efektif & jatuh tempo', () => {
  const now = new Date(2026, 10, 28); // 28 Nov 2026

  it('mendeteksi invoice lewat jatuh tempo', () => {
    const doc = {
      type: 'invoice',
      status: 'sent',
      issueDate: '2026-11-01',
      dueDate: '2026-11-20',
      items: [{ id: 'a', qty: 1, price: 100_000 }],
      tax: { enabled: false },
    };
    expect(daysToDue(doc, now)).toBe(-8);
    expect(effectiveStatus(doc, now)).toBe('overdue');
  });

  it('menandai lunas otomatis ketika pembayaran menutup total', () => {
    const doc = {
      type: 'invoice',
      status: 'sent',
      dueDate: '2026-11-20',
      items: [{ id: 'a', qty: 1, price: 100_000 }],
      tax: { enabled: false },
      payments: [{ id: 'p', amount: 100_000 }],
    };
    expect(effectiveStatus(doc, now)).toBe('paid');
  });

  it('tidak menimpa status draf & batal', () => {
    const draft = { type: 'invoice', status: 'draft', dueDate: '2020-01-01', items: [] };
    expect(effectiveStatus(draft, now)).toBe('draft');
    const cancelled = { type: 'invoice', status: 'cancelled', dueDate: '2020-01-01', items: [] };
    expect(effectiveStatus(cancelled, now)).toBe('cancelled');
  });

  it('penawaran tidak pernah otomatis jadi lewat tempo', () => {
    const quote = {
      type: 'quote',
      status: 'sent',
      validUntil: '2026-11-01',
      items: [{ id: 'a', qty: 1, price: 10_000 }],
    };
    expect(effectiveStatus(quote, now)).toBe('sent');
  });

  it('hari menuju jatuh tempo dihitung dari tanggal lokal', () => {
    expect(daysToDue({ dueDate: '2026-11-28' }, now)).toBe(0);
    expect(daysToDue({ dueDate: '2026-12-05' }, now)).toBe(7);
    expect(daysToDue({}, now)).toBeNull();
  });
});

describe('Penomoran dokumen', () => {
  it('membuat nomor berurutan per jenis dokumen', () => {
    const date = new Date(2026, 10, 28);
    expect(buildDocNumber('invoice', 3, date)).toBe('INV/202611/003');
    expect(buildDocNumber('quote', 12, date, 'QTN')).toBe('QTN/202611/012');
  });

  it('melanjutkan nomor dari dokumen yang sudah ada', () => {
    const docs = [
      { type: 'invoice', number: 'INV/202611/001' },
      { type: 'invoice', number: 'INV/202611/007' },
      { type: 'quote', number: 'QTN/202611/002' },
    ];
    const date = new Date(2026, 10, 28);
    expect(nextDocNumber(docs, 'invoice', date)).toBe('INV/202611/008');
    expect(nextDocNumber(docs, 'quote', date)).toBe('QTN/202611/003');
    expect(nextDocNumber([], 'invoice', date)).toBe('INV/202611/001');
  });

  it('menyediakan label & awalan untuk kedua jenis dokumen', () => {
    expect(DOC_TYPE_META.invoice.title).toBe('INVOICE');
    expect(DOC_TYPE_META.quote.title).toBe('PENAWARAN HARGA');
  });
});

describe('Data demo', () => {
  it('menghasilkan 6 dokumen dengan total valid', () => {
    const docs = createDemoDocuments();
    expect(docs).toHaveLength(6);
    docs.forEach((doc) => {
      expect(doc.id).toBeTruthy();
      expect(doc.number).toMatch(/^(INV|QTN)\//);
      const { total } = calculateTotals(doc);
      expect(total).toBeGreaterThan(0);
      expect(Number.isFinite(total)).toBe(true);
    });
    const paidDoc = docs.find((d) => d.status === 'paid');
    expect(effectiveStatus(paidDoc)).toBe('paid');
    expect(balanceDue(paidDoc)).toBe(0);
  });

  it('createDocument mengisi tenggat default sesuai jenis', () => {
    const inv = createDocument();
    const quote = createDocument({ type: 'quote' });
    expect(inv.type).toBe('invoice');
    expect(quote.type).toBe('quote');
    expect(inv.items).toHaveLength(1);
    expect(quote.dueDate > quote.issueDate).toBe(true);
    expect(createEmptyItem({ name: 'X' }).name).toBe('X');
  });
});
