const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(String(value).length <= 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "28 Nov 2026" */
export function formatDate(value, { fallback = '—' } = {}) {
  const d = toDate(value);
  if (!d) return fallback;
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

/** "28 November 2026" */
export function formatDateLong(value, { fallback = '—' } = {}) {
  const d = toDate(value);
  if (!d) return fallback;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateWithDay(value) {
  const d = toDate(value);
  if (!d) return '—';
  return `${DAYS[d.getDay()]}, ${formatDateLong(d)}`;
}

export function todayISO() {
  return toISODate(new Date());
}

export function toISODate(date) {
  const d = toDate(date);
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export function addDaysISO(value, days) {
  const d = toDate(value) || new Date();
  const next = new Date(d);
  next.setDate(next.getDate() + Number(days || 0));
  return toISODate(next);
}

export function monthLabel(value) {
  const d = toDate(value);
  if (!d) return '';
  return `${MONTHS[d.getMonth()].slice(0, 3)} ${String(d.getFullYear()).slice(2)}`;
}

export function relativeDayText(value, now = new Date()) {
  const d = toDate(value);
  if (!d) return '';
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((b - a) / 86_400_000);
  if (diff === 0) return 'Hari ini';
  if (diff === 1) return 'Besok';
  if (diff === -1) return 'Kemarin';
  if (diff > 0) return `${diff} hari lagi`;
  return `Lewat ${Math.abs(diff)} hari`;
}

export { MONTHS, DAYS };
