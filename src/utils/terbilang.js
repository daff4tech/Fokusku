/**
 * Konversi angka menjadi kata dalam Bahasa Indonesia (untuk invoice resmi:
 * "Terbilang: Satu juta dua ratus ribu rupiah").
 */

const SATUAN = [
  '', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan',
  'sepuluh', 'sebelas',
];

function toWords(n) {
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${toWords(n - 10)} belas`;
  if (n < 100) {
    const sisa = n % 10;
    return `${toWords(Math.floor(n / 10))} puluh${sisa ? ` ${toWords(sisa)}` : ''}`;
  }
  if (n < 200) return `seratus${n % 100 ? ` ${toWords(n % 100)}` : ''}`;
  if (n < 1000) {
    const sisa = n % 100;
    return `${toWords(Math.floor(n / 100))} ratus${sisa ? ` ${toWords(sisa)}` : ''}`;
  }
  if (n < 2000) return `seribu${n % 1000 ? ` ${toWords(n % 1000)}` : ''}`;
  if (n < 1_000_000) {
    const sisa = n % 1000;
    return `${toWords(Math.floor(n / 1000))} ribu${sisa ? ` ${toWords(sisa)}` : ''}`;
  }
  if (n < 1_000_000_000) {
    const sisa = n % 1_000_000;
    return `${toWords(Math.floor(n / 1_000_000))} juta${sisa ? ` ${toWords(sisa)}` : ''}`;
  }
  if (n < 1_000_000_000_000) {
    const sisa = n % 1_000_000_000;
    return `${toWords(Math.floor(n / 1_000_000_000))} miliar${sisa ? ` ${toWords(sisa)}` : ''}`;
  }
  const sisa = n % 1_000_000_000_000;
  return `${toWords(Math.floor(n / 1_000_000_000_000))} triliun${sisa ? ` ${toWords(sisa)}` : ''}`;
}

/**
 * @param {number} value nominal (boleh desimal)
 * @param {'IDR'|'USD'|'SGD'|'MYR'} currency
 * @returns {string} kalimat terbilang dengan huruf awal kapital
 */
export function terbilang(value, currency = 'IDR') {
  const nominal = Number(value) || 0;
  const negatif = nominal < 0;
  const bulat = Math.floor(Math.abs(nominal));
  const sen = Math.round((Math.abs(nominal) - bulat) * 100);

  let kata = bulat === 0 ? 'nol' : toWords(bulat).trim();
  if (sen > 0) kata += ` koma ${toWords(sen).trim()}`.replace('nol', 'nol');

  const satuan = {
    IDR: 'rupiah',
    USD: 'dolar amerika serikat',
    SGD: 'dolar singapura',
    MYR: 'ringgit malaysia',
  }[currency] || 'rupiah';

  const kalimat = `${negatif ? 'minus ' : ''}${kata} ${satuan}`.replace(/\s+/g, ' ');
  return kalimat.charAt(0).toUpperCase() + kalimat.slice(1);
}
