import { DEFAULT_CUSTOMERS, DEFAULT_PROFILE, createDemoDocuments } from './documents.js';

export const STORAGE_PREFIX = 'notaku';

export const STORAGE_KEYS = {
  DOCUMENTS: `${STORAGE_PREFIX}_documents_v1`,
  CUSTOMERS: `${STORAGE_PREFIX}_customers_v1`,
  PROFILE: `${STORAGE_PREFIX}_profile_v1`,
  SETTINGS: `${STORAGE_PREFIX}_settings_v1`,
  THEME: `${STORAGE_PREFIX}_theme`,
  SEEDED: `${STORAGE_PREFIX}_seeded_v1`,
};

export const DEFAULT_SETTINGS = {
  theme: 'light',
  defaultType: 'invoice',
  compactMode: false,
  showTerbilang: true,
  accent: 'teal',
};

export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return structuredCloneSafe(fallback);
    const parsed = JSON.parse(raw);
    return parsed == null ? structuredCloneSafe(fallback) : parsed;
  } catch {
    return structuredCloneSafe(fallback);
  }
}

export function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn('Gagal menyimpan data lokal:', error);
    return false;
  }
}

function structuredCloneSafe(value) {
  if (value == null) return value;
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

/** Muat semua state aplikasi; isi data demo pada kunjungan pertama. */
export function loadAppState() {
  const seeded = localStorage.getItem(STORAGE_KEYS.SEEDED) === '1';
  if (!seeded) {
    const seed = {
      documents: createDemoDocuments(),
      customers: DEFAULT_CUSTOMERS,
      profile: DEFAULT_PROFILE,
    };
    saveJSON(STORAGE_KEYS.DOCUMENTS, seed.documents);
    saveJSON(STORAGE_KEYS.CUSTOMERS, seed.customers);
    saveJSON(STORAGE_KEYS.PROFILE, seed.profile);
    localStorage.setItem(STORAGE_KEYS.SEEDED, '1');
    return { ...seed, settings: loadJSON(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS) };
  }

  return {
    documents: loadJSON(STORAGE_KEYS.DOCUMENTS, []),
    customers: loadJSON(STORAGE_KEYS.CUSTOMERS, DEFAULT_CUSTOMERS),
    profile: { ...DEFAULT_PROFILE, ...loadJSON(STORAGE_KEYS.PROFILE, {}) },
    settings: { ...DEFAULT_SETTINGS, ...loadJSON(STORAGE_KEYS.SETTINGS, {}) },
  };
}

export function exportBackup({ documents, customers, profile, settings }) {
  return {
    app: 'NotaKu',
    version: 1,
    exportedAt: new Date().toISOString(),
    documents,
    customers,
    profile,
    settings,
  };
}

/** Validasi & normalisasi hasil impor backup. */
export function parseBackup(text) {
  const data = typeof text === 'string' ? JSON.parse(text) : text;
  if (!data || typeof data !== 'object') throw new Error('File backup tidak valid.');
  if (!Array.isArray(data.documents)) throw new Error('File backup tidak memiliki daftar dokumen.');
  return {
    documents: data.documents,
    customers: Array.isArray(data.customers) ? data.customers : [],
    profile: data.profile && typeof data.profile === 'object' ? data.profile : null,
    settings: data.settings && typeof data.settings === 'object' ? data.settings : null,
  };
}

export function resetAll() {
  Object.values(STORAGE_KEYS).forEach((key) => {
    if (key === STORAGE_KEYS.THEME) return;
    localStorage.removeItem(key);
  });
}
