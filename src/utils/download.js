/** Picu unduhan berkas dari byte/Blob di browser. */
export function downloadBytes(bytes, filename, mime = 'application/pdf') {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: mime });
  downloadBlob(blob, filename);
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadText(text, filename, mime = 'application/json') {
  downloadBlob(new Blob([text], { type: `${mime};charset=utf-8` }), filename);
}

export function safeFilename(input, fallback = 'dokumen') {
  const clean = String(input || '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return clean || fallback;
}

export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback di bawah */
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Buka URL di tab baru; jika diblokir, arahkan window saat ini. */
export function openExternal(url) {
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (!win) window.location.href = url;
}
