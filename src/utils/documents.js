import { getCurrency, round2 } from './currency.js';

export const DOC_TYPE = {
  INVOICE: 'invoice',
  QUOTE: 'quote',
};

export const DOC_TYPE_META = {
  [DOC_TYPE.INVOICE]: {
    key: DOC_TYPE.INVOICE,
    label: 'Invoice',
    shortLabel: 'Invoice',
    title: 'INVOICE',
    numberingPrefix: 'INV',
    priceLabel: 'Harga Satuan',
    itemsHeading: 'Deskripsi Pekerjaan / Produk',
    totalLabel: 'Total Tagihan',
    audience: 'invoice',
    whatsappNoun: 'invoice',
  },
  [DOC_TYPE.QUOTE]: {
    key: DOC_TYPE.QUOTE,
    label: 'Penawaran Harga',
    shortLabel: 'Penawaran',
    title: 'PENAWARAN HARGA',
    numberingPrefix: 'QTN',
    priceLabel: 'Harga Satuan',
    itemsHeading: 'Rincian Penawaran',
    totalLabel: 'Total Penawaran',
    audience: 'penawaran',
    whatsappNoun: 'penawaran harga',
  },
};

/** Status dokumen, urutan = urutan tampil di filter. */
export const STATUS = {
  DRAFT: 'draft',
  SENT: 'sent',
  PARTIAL: 'partial',
  PAID: 'paid',
  OVERDUE: 'overdue',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  CANCELLED: 'cancelled',
};

export const STATUS_META = {
  draft: { label: 'Draf', tone: 'neutral', icon: 'pencil' },
  sent: { label: 'Terkirim', tone: 'info', icon: 'send' },
  partial: { label: 'Dibayar Sebagian', tone: 'warning', icon: 'wallet' },
  paid: { label: 'Lunas', tone: 'success', icon: 'check-circle' },
  overdue: { label: 'Jatuh Tempo', tone: 'danger', icon: 'alarm' },
  accepted: { label: 'Disetujui', tone: 'success', icon: 'thumbs-up' },
  declined: { label: 'Ditolak', tone: 'danger', icon: 'x-circle' },
  cancelled: { label: 'Dibatalkan', tone: 'neutral', icon: 'ban' },
};

export const INVOICE_STATUSES = [
  STATUS.DRAFT, STATUS.SENT, STATUS.PARTIAL, STATUS.PAID, STATUS.OVERDUE,
];

export const QUOTE_STATUSES = [
  STATUS.DRAFT, STATUS.SENT, STATUS.ACCEPTED, STATUS.DECLINED, STATUS.CANCELLED,
];

export function statusesForType(type) {
  return type === DOC_TYPE.QUOTE ? QUOTE_STATUSES : INVOICE_STATUSES;
}

export function isQuote(doc) {
  return doc?.type === DOC_TYPE.QUOTE;
}

/** ---- Perhitungan ---- */

export function lineTotal(item) {
  return round2((Number(item?.qty) || 0) * (Number(item?.price) || 0));
}

/**
 * Hitung subtotal, diskon, PPN, PPh, biaya tambahan dan grand total.
 * @returns {{itemsTotal:number, discountValue:number, subtotal:number,
 *   taxValue:number, withholdingValue:number, extraTotal:number, total:number, itemCount:number}}
 */
export function calculateTotals(doc) {
  const items = Array.isArray(doc?.items) ? doc.items : [];
  const itemsTotal = round2(items.reduce((sum, item) => sum + lineTotal(item), 0));

  const discount = doc?.discount || {};
  const discountValue =
    discount.type === 'percent'
      ? round2((itemsTotal * (Number(discount.value) || 0)) / 100)
      : discount.type === 'amount'
        ? round2(Number(discount.value) || 0)
        : 0;

  const subtotal = round2(Math.max(0, itemsTotal - discountValue));

  const tax = doc?.tax || {};
  const taxEnabled = tax.enabled !== false && (Number(tax.rate) || 0) > 0;
  const taxValue = taxEnabled
    ? round2(((subtotal * (Number(tax.rate) || 0)) / 100) * (tax.inclusive ? 1 : 1))
    : 0;

  const withholding = doc?.withholding || {};
  const withholdingEnabled = withholding.enabled === true && (Number(withholding.rate) || 0) > 0;
  const withholdingValue = withholdingEnabled
    ? round2((subtotal * (Number(withholding.rate) || 0)) / 100)
    : 0;

  const extras = Array.isArray(doc?.extras) ? doc.extras : [];
  const extraTotal = round2(
    extras.reduce((sum, extra) => {
      const amount = Number(extra?.amount) || 0;
      if (!extra?.label || !amount) return sum;
      return sum + (extra.mode === 'discount' ? -amount : amount);
    }, 0)
  );

  const total = round2(Math.max(0, subtotal + taxValue + extraTotal - withholdingValue));

  return {
    itemsTotal,
    discountValue,
    subtotal,
    taxValue,
    withholdingValue,
    extraTotal,
    total,
    itemCount: items.length,
  };
}

export function paidAmount(doc) {
  const payments = Array.isArray(doc?.payments) ? doc.payments : [];
  return round2(payments.reduce((sum, p) => sum + (Number(p?.amount) || 0), 0));
}

export function balanceDue(doc) {
  const { total } = calculateTotals(doc);
  return round2(Math.max(0, total - paidAmount(doc)));
}

export function isEffectivelyPaid(doc) {
  if (!doc) return false;
  if (doc.type === DOC_TYPE.QUOTE) return doc.status === STATUS.ACCEPTED;
  const { total } = calculateTotals(doc);
  return total > 0 && paidAmount(doc) >= total - 0.5;
}

/** Hari menuju jatuh tempo (negatif = sudah lewat). */
export function daysToDue(doc, now = new Date()) {
  if (!doc?.dueDate) return null;
  const due = new Date(`${doc.dueDate}T23:59:59`);
  if (Number.isNaN(due.getTime())) return null;
  const a = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const b = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  return Math.round((b - a) / 86_400_000);
}

/**
 * Status efektif yang sebaiknya ditampilkan (auto-deteksi jatuh tempo).
 */
export function effectiveStatus(doc, now = new Date()) {
  if (!doc) return STATUS.DRAFT;
  const base = doc.status || STATUS.DRAFT;
  if (doc.type === DOC_TYPE.QUOTE) return base;
  const { total } = calculateTotals(doc);
  const paid = paidAmount(doc);
  if (total > 0 && paid >= total - 0.5) return STATUS.PAID;
  if (base === STATUS.DRAFT || base === STATUS.CANCELLED) return base;
  if (paid > 0) return STATUS.PARTIAL;
  const days = daysToDue(doc, now);
  if (days != null && days < 0) return STATUS.OVERDUE;
  return base;
}

export function paymentProgress(doc) {
  const { total } = calculateTotals(doc);
  if (!total) return 0;
  return Math.min(1, paidAmount(doc) / total);
}

/** --- Nomor dokumen --- */

export function buildDocNumber(type, sequence, date = new Date(), prefixOverride) {
  const meta = DOC_TYPE_META[type] || DOC_TYPE_META[DOC_TYPE.INVOICE];
  const prefix = (prefixOverride || meta.numberingPrefix).toUpperCase();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${prefix}/${y}${m}/${String(sequence).padStart(3, '0')}`;
}

export function nextSequence(documents, type) {
  const meta = DOC_TYPE_META[type] || DOC_TYPE_META[DOC_TYPE.INVOICE];
  const sameType = (documents || []).filter((d) => d.type === type);
  return sameType.length + 1;
}

export function nextDocNumber(documents, type, date = new Date()) {
  const nums = (documents || [])
    .filter((d) => d.type === type)
    .map((d) => Number(String(d.number || '').split('/').pop()) || 0);
  const max = nums.length ? Math.max(...nums) : 0;
  return buildDocNumber(type, max + 1, date);
}

/** --- Template & seed demo --- */

const today = () => new Date();
const iso = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(
    x.getDate()
  ).padStart(2, '0')}`;
};
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export function createEmptyItem(overrides = {}) {
  return {
    id: uid('itm'),
    name: '',
    description: '',
    qty: 1,
    unit: 'pcs',
    price: 0,
    ...overrides,
  };
}

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function createDocument(overrides = {}) {
  const now = today();
  const type = overrides.type || DOC_TYPE.INVOICE;
  const meta = DOC_TYPE_META[type];
  return {
    id: uid('doc'),
    type,
    number: '',
    status: STATUS.DRAFT,
    issueDate: iso(now),
    dueDate: iso(addDays(now, type === DOC_TYPE.QUOTE ? 14 : 7)),
    validUntil: iso(addDays(now, 14)),
    customerId: null,
    customer: {
      name: '',
      company: '',
      phone: '',
      email: '',
      address: '',
    },
    items: [createEmptyItem()],
    discount: { type: 'none', value: 0 },
    tax: { enabled: true, rate: 11, label: 'PPN' },
    withholding: { enabled: false, rate: 2, label: 'PPh 23' },
    extras: [],
    payments: [],
    notes: meta.key === DOC_TYPE.QUOTE
      ? 'Penawaran ini berlaku sampai tanggal yang tertera. Harga dapat berubah setelah masa berlaku habis.'
      : 'Pembayaran melalui transfer bank. Mohon cantumkan nomor invoice pada berita transfer.',
    terms: meta.key === DOC_TYPE.QUOTE
      ? 'Harga belum termasuk ongkos kirim bila di luar area layanan.\nDP 50% diperlukan untuk memulai pekerjaan.'
      : 'Barang/jasa yang sudah dibeli tidak dapat dikembalikan.\nKeterlambatan pembayaran dikenakan denda 1% per minggu.',
    signatureLabel: 'Hormat kami,',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export const DEFAULT_PROFILE = {
  businessName: 'Dapur Bunda Sari',
  tagline: 'Katering rumahan & snack box • Banjarmasin',
  ownerName: 'Sari Wulandari',
  phone: '6281234567890',
  email: 'halo@dapurbundasari.id',
  website: 'dapurbundasari.id',
  address: 'Jl. Kayu Tangi II No. 18, Banjarmasin Utara,\nKalimantan Selatan 70123',
  npwp: '73.421.887.2-731.000',
  logoDataUrl: '',
  bankAccounts: [
    {
      id: 'bank_bri',
      bank: 'BRI',
      accountNumber: '0895-01-023456-30-7',
      accountName: 'Sari Wulandari',
    },
    {
      id: 'bank_bca',
      bank: 'BCA',
      accountNumber: '7280 1100 2211',
      accountName: 'Sari Wulandari',
    },
  ],
  currency: 'IDR',
  taxRate: 11,
  taxLabel: 'PPN',
  invoicePrefix: 'INV',
  quotePrefix: 'QTN',
  numberFormat: 'slash',
  defaultDueDays: 7,
  footerNote: 'Terima kasih atas kepercayaan Anda.',
  paymentNote: '',
};

export const DEFAULT_CUSTOMERS = [
  {
    id: 'cus_1',
    name: 'Rizky Pratama',
    company: 'PT Rasa Nusantara',
    phone: '6281356789012',
    email: 'rizky@rasanusa.co.id',
    address: 'Jl. Ahmad Yani Km 5, Banjarmasin',
  },
  {
    id: 'cus_2',
    name: 'Dewi Anggraini',
    company: 'Koperasi Karyawan Bank Kalsel',
    phone: '6281900123456',
    email: 'dewi@koperasikalsel.id',
    address: 'Jl. Lambung Mangkurat No. 7, Banjarmasin',
  },
  {
    id: 'cus_3',
    name: 'Hendra Gunawan',
    company: 'CV Mitra Banua',
    phone: '6281122334455',
    email: 'hendra@mitrabanua.com',
    address: 'Komplek Hasanuddin HM, Banjarmasin Timur',
  },
];

export function createDemoDocuments() {
  const now = today();
  const bank = DEFAULT_PROFILE.bankAccounts[0];

  const d1 = createDocument({
    type: DOC_TYPE.INVOICE,
    number: buildDocNumber(DOC_TYPE.INVOICE, 1, now),
    status: STATUS.PAID,
    issueDate: iso(addDays(now, -24)),
    dueDate: iso(addDays(now, -17)),
    customerId: 'cus_1',
    customer: { ...DEFAULT_CUSTOMERS[0] },
    items: [
      createEmptyItem({ name: 'Nasi box paket ayam bakar', qty: 40, unit: 'box', price: 35000, description: 'Nasi, ayam bakar, sayur, sambal, buah, air mineral' }),
      createEmptyItem({ name: 'Snack box kue basah', qty: 40, unit: 'box', price: 15000, description: 'Kue basah 4 macam + teh kotak' }),
      createEmptyItem({ name: 'Biaya pengiriman', qty: 1, unit: 'trip', price: 100000 }),
    ],
    discount: { type: 'percent', value: 5 },
    tax: { enabled: true, rate: 11, label: 'PPN' },
    payments: [{ id: 'pay_1', date: iso(addDays(now, -20)), amount: 2214450, method: 'Transfer BCA', note: 'Pelunasan' }],
    notes: 'Terima kasih sudah memesan! Kami tunggu pesanan berikutnya.',
  });

  const d2 = createDocument({
    type: DOC_TYPE.INVOICE,
    number: buildDocNumber(DOC_TYPE.INVOICE, 2, now),
    status: STATUS.PARTIAL,
    issueDate: iso(addDays(now, -9)),
    dueDate: iso(addDays(now, 5)),
    customerId: 'cus_2',
    customer: { ...DEFAULT_CUSTOMERS[1] },
    items: [
      createEmptyItem({ name: 'Paket meeting pagi (minimal 25 pax)', qty: 60, unit: 'pax', price: 32000, description: 'Kopi, teh, gorengan, lemper, dan air mineral' }),
      createEmptyItem({ name: 'Prasmanan makan siang', qty: 60, unit: 'pax', price: 55000, description: '5 lauk, sayur, nasi, dessert' }),
    ],
    tax: { enabled: true, rate: 11, label: 'PPN' },
    payments: [{ id: 'pay_2', date: iso(addDays(now, -7)), amount: 3000000, method: 'Transfer BRI', note: 'DP 50%' }],
  });

  const d3 = createDocument({
    type: DOC_TYPE.INVOICE,
    number: buildDocNumber(DOC_TYPE.INVOICE, 3, now),
    status: STATUS.SENT,
    issueDate: iso(addDays(now, -19)),
    dueDate: iso(addDays(now, -5)),
    customerId: 'cus_3',
    customer: { ...DEFAULT_CUSTOMERS[2] },
    items: [
      createEmptyItem({ name: 'Catering acara syukuran', qty: 120, unit: 'pax', price: 42000, description: 'Menu Banjar lengkap' }),
      createEmptyItem({ name: 'Sewa tenda & kursi', qty: 1, unit: 'paket', price: 1750000 }),
    ],
    tax: { enabled: true, rate: 11, label: 'PPN' },
    withholding: { enabled: true, rate: 2, label: 'PPh 23' },
  });

  const d4 = createDocument({
    type: DOC_TYPE.QUOTE,
    number: buildDocNumber(DOC_TYPE.QUOTE, 1, now),
    status: STATUS.SENT,
    issueDate: iso(addDays(now, -2)),
    validUntil: iso(addDays(now, 12)),
    customerId: 'cus_1',
    customer: { ...DEFAULT_CUSTOMERS[0] },
    items: [
      createEmptyItem({ name: 'Katering makan siang harian', qty: 22, unit: 'hari', price: 950000, description: 'Untuk 30 porsi/hari, Senin–Jumat selama 1 bulan' }),
      createEmptyItem({ name: 'Snack sore', qty: 22, unit: 'hari', price: 300000, description: 'Untuk 30 porsi/hari' }),
    ],
    discount: { type: 'percent', value: 10 },
    tax: { enabled: true, rate: 11, label: 'PPN' },
  });

  const d5 = createDocument({
    type: DOC_TYPE.QUOTE,
    number: buildDocNumber(DOC_TYPE.QUOTE, 2, now),
    status: STATUS.ACCEPTED,
    issueDate: iso(addDays(now, -16)),
    validUntil: iso(addDays(now, -2)),
    customerId: 'cus_2',
    customer: { ...DEFAULT_CUSTOMERS[1] },
    items: [
      createEmptyItem({ name: 'Paket hampers lebaran', qty: 25, unit: 'paket', price: 185000, description: 'Kotak premium, kue kering 4 jenis, kartu ucapan' }),
    ],
    tax: { enabled: true, rate: 11, label: 'PPN' },
  });

  const d6 = createDocument({
    type: DOC_TYPE.QUOTE,
    number: buildDocNumber(DOC_TYPE.QUOTE, 3, now),
    status: STATUS.DRAFT,
    customerId: 'cus_3',
    customer: { ...DEFAULT_CUSTOMERS[2] },
    items: [createEmptyItem({ name: 'Paket tumpeng syukuran', qty: 5, unit: 'set', price: 375000 })],
  });

  return [d1, d2, d3, d4, d5, d6].map((doc, i) => ({
    ...doc,
    payments: (doc.payments || []).map((p) => (p.method ? p : { ...p, method: `${bank.bank} • ${bank.accountNumber}` })),
    createdAt: new Date(now.getTime() - i * 3_600_000).toISOString(),
  }));
}
