/**
 * Utilitas uang & angka.
 * Semua nominal disimpan sebagai `number` rupiah utuh (tanpa desimal),
 * sehingga aman dari galat pembulatan floating point pada perhitungan biasa.
 */

export const CURRENCIES = {
  IDR: { code: 'IDR', symbol: 'Rp', locale: 'id-ID', decimals: 0, label: 'Rupiah Indonesia' },
  USD: { code: 'USD', symbol: '$', locale: 'en-US', decimals: 2, label: 'US Dollar' },
  SGD: { code: 'SGD', symbol: 'S$', locale: 'en-SG', decimals: 2, label: 'Singapore Dollar' },
  MYR: { code: 'MYR', symbol: 'RM', locale: 'ms-MY', decimals: 2, label: 'Ringgit Malaysia' },
};

export const DEFAULT_CURRENCY = 'IDR';

export function getCurrency(code = DEFAULT_CURRENCY) {
  return CURRENCIES[code] || CURRENCIES[DEFAULT_CURRENCY];
}

/** Bulatkan ke 2 desimal agar hasil perkalian tetap "bersih". */
export function round2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Ubah input pengguna ("1.500.000", "Rp 1,5jt", "1500000,50") jadi angka. */
export function parseAmount(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0;
  if (input == null) return 0;
  let str = String(input).trim().toLowerCase();
  if (!str) return 0;

  let multiplier = 1;
  if (/jt$|juta$/.test(str)) multiplier = 1_000_000;
  else if (/rb$|ribu$|k$/.test(str)) multiplier = 1_000;

  str = str
    .replace(/rp\.?/g, '')
    .replace(/jt$|juta$|rb$|ribu$|k$/g, '')
    .replace(/\s/g, '');

  // Format Indonesia: titik = ribuan, koma = desimal. Format Anglo kebalikannya.
  const hasComma = str.includes(',');
  const hasDot = str.includes('.');
  if (hasComma && hasDot) {
    // pemisah desimal adalah simbol yang muncul paling akhir
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (hasComma) {
    const parts = str.split(',');
    str = parts[parts.length - 1].length === 3 && parts.length > 1
      ? parts.join('')
      : str.replace(',', '.');
  } else if (hasDot) {
    const parts = str.split('.');
    str = parts.length > 1 && parts[parts.length - 1].length === 3 && parts[0].length <= 3
      ? parts.join('') // "1.500" -> 1500
      : str;
  }

  const n = Number.parseFloat(str.replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(n)) return 0;
  return round2(n * multiplier);
}

/** Format angka ke mata uang, mis. "Rp 1.250.000". */
export function formatCurrency(value, currency = DEFAULT_CURRENCY, options = {}) {
  const meta = getCurrency(currency);
  const n = round2(value || 0);
  const withSymbol = options.symbol !== false;
  const body = new Intl.NumberFormat(meta.locale, {
    minimumFractionDigits: options.minDecimals ?? meta.decimals,
    maximumFractionDigits: options.maxDecimals ?? meta.decimals,
  }).format(n);
  if (!withSymbol) return body;
  return `${meta.symbol} ${body}`.trim();
}

/** Format ringkas untuk kartu dashboard: 1,25 jt. */
export function formatCompact(value, currency = DEFAULT_CURRENCY) {
  const meta = getCurrency(currency);
  const n = Math.abs(round2(value || 0));
  const sign = value < 0 ? '-' : '';
  if (currency === 'IDR') {
    if (n >= 1_000_000_000) return `${sign}${meta.symbol} ${trim(n / 1_000_000_000)} M`;
    if (n >= 1_000_000) return `${sign}${meta.symbol} ${trim(n / 1_000_000)} jt`;
    if (n >= 10_000) return `${sign}${meta.symbol} ${trim(n / 1_000)} rb`;
  } else {
    if (n >= 1_000_000) return `${sign}${meta.symbol} ${trim(n / 1_000_000)}M`;
    if (n >= 10_000) return `${sign}${meta.symbol} ${trim(n / 1_000)}K`;
  }
  return `${sign}${meta.symbol} ${new Intl.NumberFormat(meta.locale, {
    maximumFractionDigits: meta.decimals,
  }).format(n)}`;
}

function trim(n) {
  return Number(n.toFixed(2)).toLocaleString('id-ID');
}
