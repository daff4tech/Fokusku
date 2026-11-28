/**
 * PDF Writer minimalis — cukup lengkap untuk invoice/penawaran profesional.
 * Fitur: teks Helvetica (regular/bold/italic) dengan WinAnsiEncoding, vektor
 * (garis, kotak, rounded rect, lingkaran), gambar JPEG, rotasi teks, dan
 * halaman multi-page dengan footer nomor halaman.
 *
 * Tidak ada dependensi eksternal sehingga bundle tetap ringan & offline-ready.
 */

const PAGE_SIZES = {
  A4: [595.28, 841.89],
  A5: [419.53, 595.28],
  LETTER: [612, 792],
};

/* ----------------------------- Font metrics ----------------------------- */

const HELVETICA = {
  32: 278, 33: 278, 34: 355, 35: 556, 36: 556, 37: 889, 38: 667, 39: 191,
  40: 333, 41: 333, 42: 389, 43: 584, 44: 278, 45: 333, 46: 278, 47: 278,
  48: 556, 49: 556, 50: 556, 51: 556, 52: 556, 53: 556, 54: 556, 55: 556,
  56: 556, 57: 556, 58: 278, 59: 278, 60: 584, 61: 584, 62: 584, 63: 556,
  64: 1015, 65: 667, 66: 667, 67: 722, 68: 722, 69: 667, 70: 611, 71: 778,
  72: 722, 73: 278, 74: 500, 75: 667, 76: 556, 77: 833, 78: 722, 79: 778,
  80: 667, 81: 778, 82: 722, 83: 667, 84: 611, 85: 722, 86: 667, 87: 944,
  88: 667, 89: 667, 90: 611, 91: 278, 92: 278, 93: 278, 94: 469, 95: 556,
  96: 333, 97: 556, 98: 556, 99: 500, 100: 556, 101: 556, 102: 278, 103: 556,
  104: 556, 105: 222, 106: 222, 107: 500, 108: 222, 109: 833, 110: 556,
  111: 556, 112: 556, 113: 556, 114: 333, 115: 500, 116: 278, 117: 556,
  118: 500, 119: 722, 120: 500, 121: 500, 122: 500, 123: 334, 124: 260,
  125: 334, 126: 584,
};

const HELVETICA_BOLD = {
  32: 278, 33: 333, 34: 474, 35: 556, 36: 556, 37: 889, 38: 722, 39: 238,
  40: 333, 41: 333, 42: 389, 43: 584, 44: 278, 45: 333, 46: 278, 47: 278,
  48: 556, 49: 556, 50: 556, 51: 556, 52: 556, 53: 556, 54: 556, 55: 556,
  56: 556, 57: 556, 58: 333, 59: 333, 60: 584, 61: 584, 62: 584, 63: 611,
  64: 975, 65: 722, 66: 722, 67: 722, 68: 722, 69: 667, 70: 611, 71: 778,
  72: 722, 73: 278, 74: 556, 75: 722, 76: 611, 77: 833, 78: 722, 79: 778,
  80: 667, 81: 778, 82: 722, 83: 667, 84: 611, 85: 722, 86: 667, 87: 944,
  88: 667, 89: 667, 90: 611, 91: 333, 92: 278, 93: 333, 94: 584, 95: 556,
  96: 333, 97: 556, 98: 611, 99: 556, 100: 611, 101: 556, 102: 333, 103: 611,
  104: 611, 105: 278, 106: 278, 107: 556, 108: 278, 109: 889, 110: 611,
  111: 611, 112: 611, 113: 611, 114: 389, 115: 556, 116: 333, 117: 611,
  118: 556, 119: 778, 120: 556, 121: 556, 122: 500, 123: 389, 124: 280,
  125: 389, 126: 584,
};

/* --------------------------- Text normalisasi --------------------------- */

/** Karakter Unicode → kode byte WinAnsiEncoding. */
const WIN_ANSI = {
  '\u20AC': 128, '\u201A': 130, '\u0192': 131, '\u201E': 132, '\u2026': 133,
  '\u2020': 134, '\u2021': 135, '\u02C6': 136, '\u2030': 137, '\u0160': 138,
  '\u2039': 139, '\u0152': 140, '\u017D': 142, '\u2018': 145, '\u2019': 146,
  '\u201C': 147, '\u201D': 148, '\u2022': 149, '\u2013': 150, '\u2014': 151,
  '\u02DC': 152, '\u2122': 153, '\u0161': 154, '\u203A': 155, '\u0153': 156,
  '\u017E': 158, '\u0178': 159, '\u00A0': 32,
};

/** Pengganti untuk karakter yang tak ada di font standar (emoji, simbol). */
const FALLBACK = {
  '\u2713': 'v', '\u2714': 'v', '\u2717': 'x', '\u2718': 'x',
  '\u2192': '->', '\u2190': '<-', '\u2264': '<=', '\u2265': '>=',
  '\u00B7': '-', '\u2500': '-', '\u2550': '=',
};

function normalizeChar(ch) {
  const code = ch.charCodeAt(0);
  if (code === 32) return ' ';
  if (code >= 33 && code <= 126) return ch;
  if (WIN_ANSI[ch]) return String.fromCharCode(WIN_ANSI[ch]);
  if (ch.normalize) {
    const decomposed = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (decomposed !== ch && /^[\x20-\x7E]+$/.test(decomposed)) return decomposed;
  }
  if (code >= 160 && code <= 255) return ch;
  if (FALLBACK[ch]) return FALLBACK[ch];
  if (/[\u2600-\u27BF\u{1F300}-\u{1FAFF}\uFE0F\u200D]/u.test(ch)) return '';
  return '?';
}

export function toWinAnsi(str) {
  let out = '';
  for (const ch of String(str ?? '')) out += normalizeChar(ch);
  return out;
}

function escapePdfText(str) {
  let out = '';
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    const ch = str[i];
    if (ch === '(') out += '\\(';
    else if (ch === ')') out += '\\)';
    else if (ch === '\\') out += '\\\\';
    else if (code < 32) out += ' ';
    else if (code > 126) out += `\\${code.toString(8).padStart(3, '0')}`;
    else out += ch;
  }
  return out;
}

/* -------------------------------- Helpers ------------------------------- */

export function hexToRgb(hex) {
  let h = String(hex || '').replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) h = '0F766E';
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

function n(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

function colorOp(rgb, stroke = false) {
  return `${n(rgb[0])} ${n(rgb[1])} ${n(rgb[2])} ${stroke ? 'RG' : 'rg'}`;
}

/* ------------------------------- Writer -------------------------------- */

export class PdfWriter {
  constructor({ size = 'A4', margin = 42, title = 'Dokumen' } = {}) {
    const [width, height] = (Array.isArray(size) ? size : PAGE_SIZES[size]) || PAGE_SIZES.A4;
    this.width = width;
    this.height = height;
    this.margin = margin;
    this.title = title;
    this.pages = [];
    this.ops = [];
    this.y = margin;
    this.images = [];
    this.pageIndex = 0;
  }

  /* ---- state ---- */

  beginPage() {
    if (this.ops.length) this.endPage();
    this.ops = [];
    this.y = this.margin;
    this.pageIndex += 1;
  }

  endPage() {
    this.pages.push(this.ops.join('\n'));
    this.ops = [];
  }

  /** Sisa ruang vertikal dari posisi sekarang sampai batas bawah konten. */
  remaining(bottom = 84) {
    return this.height - bottom - this.y;
  }

  /* ---- primitif ---- */

  moveTo(y) {
    this.y = y;
    return this;
  }

  gap(dy) {
    this.y += dy;
    return this;
  }

  op(command) {
    this.ops.push(command);
    return this;
  }

  rect(x, top, w, h, { fill, stroke, lineWidth = 0.8, radius = 0 } = {}) {
    const y = this.height - top - h;
    const ops = ['q'];
    if (fill) ops.push(colorOp(fill));
    if (stroke) {
      ops.push(colorOp(stroke, true));
      ops.push(`${n(lineWidth)} w`);
    }
    if (radius > 0) {
      const r = Math.min(radius, w / 2, h / 2);
      const k = 0.5523 * r;
      const x0 = x;
      const x1 = x + w;
      const y0 = y;
      const y1 = y + h;
      ops.push(
        `${n(x0 + r)} ${n(y0)} m`,
        `${n(x1 - r)} ${n(y0)} l`,
        `${n(x1 - r + k)} ${n(y0)} ${n(x1)} ${n(y0 + r - k)} ${n(x1)} ${n(y0 + r)} c`,
        `${n(x1)} ${n(y1 - r)} l`,
        `${n(x1)} ${n(y1 - r + k)} ${n(x1 - r + k)} ${n(y1)} ${n(x1 - r)} ${n(y1)} c`,
        `${n(x0 + r)} ${n(y1)} l`,
        `${n(x0 + r - k)} ${n(y1)} ${n(x0)} ${n(y1 - r + k)} ${n(x0)} ${n(y1 - r)} c`,
        `${n(x0)} ${n(y0 + r)} l`,
        `${n(x0)} ${n(y0 + r - k)} ${n(x0 + r - k)} ${n(y0)} ${n(x0 + r)} ${n(y0)} c`,
        'h'
      );
      ops.push(fill && stroke ? 'B' : fill ? 'f' : 'S');
    } else {
      ops.push(`${n(x)} ${n(y)} ${n(w)} ${n(h)} re`);
      ops.push(fill && stroke ? 'B' : fill ? 'f' : 'S');
    }
    ops.push('Q');
    return this.op(ops.join('\n'));
  }

  line(x1, top1, x2, top2, { color = [0.85, 0.86, 0.88], width = 0.8, dash } = {}) {
    const ops = ['q', colorOp(color, true), `${n(width)} w`];
    if (dash) ops.push(`[${dash.map(n).join(' ')}] 0 d`);
    ops.push(`${n(x1)} ${n(this.height - top1)} m ${n(x2)} ${n(this.height - top2)} l S`, 'Q');
    return this.op(ops.join('\n'));
  }

  circle(cx, top, r, { fill, stroke, lineWidth = 1 } = {}) {
    const cy = this.height - top;
    const k = 0.5523 * r;
    const ops = ['q'];
    if (fill) ops.push(colorOp(fill));
    if (stroke) ops.push(colorOp(stroke, true), `${n(lineWidth)} w`);
    ops.push(
      `${n(cx - r)} ${n(cy)} m`,
      `${n(cx - r)} ${n(cy + k)} ${n(cx - k)} ${n(cy + r)} ${n(cx)} ${n(cy + r)} c`,
      `${n(cx + k)} ${n(cy + r)} ${n(cx + r)} ${n(cy + k)} ${n(cx + r)} ${n(cy)} c`,
      `${n(cx + r)} ${n(cy - k)} ${n(cx + k)} ${n(cy - r)} ${n(cx)} ${n(cy - r)} c`,
      `${n(cx - k)} ${n(cy - r)} ${n(cx - r)} ${n(cy - k)} ${n(cx - r)} ${n(cy)} c`,
      'h',
      fill && stroke ? 'B' : fill ? 'f' : 'S',
      'Q'
    );
    return this.op(ops.join('\n'));
  }

  textWidth(str, size = 9, bold = false, charSpace = 0) {
    const metrics = bold ? HELVETICA_BOLD : HELVETICA;
    const clean = toWinAnsi(str);
    let total = 0;
    for (let i = 0; i < clean.length; i += 1) {
      total += metrics[clean.charCodeAt(i)] ?? 556;
    }
    return (total / 1000) * size + charSpace * Math.max(0, clean.length - 1);
  }

  /**
   * Tulis satu baris teks. `top` = koordinat atas baris (baseline dihitung dari situ).
   * align: 'left' | 'right' | 'center'
   */
  text(str, x, top, opts = {}) {
    const {
      size = 9, bold = false, italic = false, color = [0.1, 0.11, 0.13],
      align = 'left', width = 0, charSpace = 0, rotate = 0,
    } = opts;
    const value = toWinAnsi(str);
    if (!value) return this;
    const font = italic ? 'F3' : bold ? 'F2' : 'F1';
    const textW = this.textWidth(value, size, bold, charSpace);
    let drawX = x;
    if (align === 'right') drawX = x - textW;
    else if (align === 'center') drawX = x + (width ? width / 2 - textW / 2 : -textW / 2);

    const baseline = this.height - top - size * 0.82;
    const ops = ['BT', colorOp(color), `/${font} ${n(size)} Tf`];
    if (charSpace) ops.push(`${n(charSpace)} Tc`);
    if (rotate) {
      const rad = (rotate * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      ops.push(`${n(cos)} ${n(sin)} ${n(-sin)} ${n(cos)} ${n(drawX)} ${n(baseline)} Tm`);
    } else {
      ops.push(`1 0 0 1 ${n(drawX)} ${n(baseline)} Tm`);
    }
    ops.push(`(${escapePdfText(value)}) Tj`, 'ET');
    return this.op(ops.join('\n'));
  }

  /** Pecah teks menjadi baris sesuai lebar maksimum. */
  wrap(str, maxWidth, size = 9, bold = false) {
    const paragraphs = String(str ?? '').split(/\r?\n/);
    const lines = [];
    paragraphs.forEach((paragraph) => {
      const words = paragraph.split(/\s+/).filter(Boolean);
      if (!words.length) {
        lines.push('');
        return;
      }
      let current = '';
      words.forEach((word) => {
        const candidate = current ? `${current} ${word}` : word;
        if (this.textWidth(candidate, size, bold) <= maxWidth) {
          current = candidate;
          return;
        }
        if (current) lines.push(current);
        if (this.textWidth(word, size, bold) > maxWidth) {
          // potong kata yang terlalu panjang
          let chunk = '';
          for (const ch of word) {
            if (this.textWidth(chunk + ch, size, bold) > maxWidth && chunk) {
              lines.push(chunk);
              chunk = ch;
            } else {
              chunk += ch;
            }
          }
          current = chunk;
        } else {
          current = word;
        }
      });
      if (current) lines.push(current);
    });
    return lines;
  }

  /** Tulis paragraf dengan wrapping; mengembalikan tinggi yang terpakai. */
  paragraph(str, x, top, maxWidth, opts = {}) {
    const { size = 8.5, bold = false, italic = false, lineHeight = size * 1.45, color } = opts;
    const lines = this.wrap(str, maxWidth, size, bold);
    lines.forEach((lineText, i) => {
      this.text(lineText, x, top + i * lineHeight, { ...opts, size, bold, italic, color });
    });
    return lines.length * lineHeight;
  }

  /** Sematkan gambar JPEG (data URL base64). */
  image(dataUrl, x, top, w, h) {
    const name = this.registerJpeg(dataUrl);
    if (!name) return false;
    const y = this.height - top - h;
    this.op(`q ${n(w)} 0 0 ${n(h)} ${n(x)} ${n(y)} cm /${name} Do Q`);
    return true;
  }

  registerJpeg(dataUrl) {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/jpeg')) return null;
    const base64 = dataUrl.split(',')[1] || '';
    if (!base64) return null;
    const name = `Im${this.images.length + 1}`;
    this.images.push({ name, base64 });
    return name;
  }

  /* ---- serialisasi ---- */

  /** Daftarkan fungsi penggambar footer: fn(writer, pageNumber, totalPages). */
  setFooter(fn) {
    this.footerFn = typeof fn === 'function' ? fn : null;
    return this;
  }

  toBytes() {
    if (this.ops.length) this.endPage();

    const totalPages = this.pages.length;
    const pageStreams = this.pages.map((stream, index) => {
      if (!this.footerFn) return stream;
      this.ops = [];
      this.footerFn(this, index + 1, totalPages);
      const extra = this.ops.join('\n');
      this.ops = [];
      return `${stream}\n${extra}`;
    });

    let nextId = 1;
    const alloc = () => nextId++;
    const objects = new Map();

    const fontRegular = alloc();
    objects.set(fontRegular, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const fontBold = alloc();
    objects.set(fontBold, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const fontItalic = alloc();
    objects.set(fontItalic, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>');

    const xObjects = [];
    this.images.forEach((img) => {
      const bytes = base64ToBytes(img.base64);
      const dims = jpegSize(bytes) || { width: 100, height: 100 };
      const id = alloc();
      objects.set(id, [
        `<< /Type /XObject /Subtype /Image /Width ${dims.width} /Height ${dims.height} ` +
          `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`,
        bytes,
        '\nendstream',
      ]);
      xObjects.push({ name: img.name, id });
    });

    const pageIds = this.pages.map(() => alloc());
    const contentIds = this.pages.map(() => alloc());
    const pagesId = alloc();
    const catalogId = alloc();
    const infoId = alloc();

    const xObjectResources = xObjects.length
      ? ` /XObject << ${xObjects.map(({ name, id }) => `/${name} ${id} 0 R`).join(' ')} >>`
      : '';

    pageStreams.forEach((/* stream */ _stream, index) => {
      const content = pageStreams[index];
      const bytes = latin1Bytes(content);
      objects.set(contentIds[index], [`<< /Length ${bytes.length} >>\nstream\n`, bytes, '\nendstream']);
      objects.set(
        pageIds[index],
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${n(this.width)} ${n(this.height)}] ` +
          `/Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R /F3 ${fontItalic} 0 R >>${xObjectResources} >> ` +
          `/Contents ${contentIds[index]} 0 R >>`
      );
    });

    objects.set(
      pagesId,
      `<< /Type /Pages /Count ${pageIds.length} /Kids [ ${pageIds.map((id) => `${id} 0 R`).join(' ')} ] >>`
    );
    objects.set(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
    objects.set(
      infoId,
      `<< /Title (${escapePdfText(toWinAnsi(this.title))}) /Producer (NotaKu PDF Engine) /Creator (NotaKu) /CreationDate (D:${pdfDate(new Date())}) >>`
    );

    return serialize(objects, catalogId, infoId, nextId - 1);
  }
}

function pdfDate(date) {
  const pad = (v) => String(v).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(
    date.getHours()
  )}${pad(date.getMinutes())}${pad(date.getSeconds())}+07'00'`;
}

/* --------------------------- Byte utilities ---------------------------- */

function latin1Bytes(str) {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i += 1) bytes[i] = str.charCodeAt(i) & 0xff;
  return bytes;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64ToBytes(base64) {
  const clean = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  const len = clean.length;
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const size = Math.floor((len * 3) / 4) - padding;
  const bytes = new Uint8Array(size);
  let byteIndex = 0;
  for (let i = 0; i < len; i += 4) {
    const c1 = B64.indexOf(clean[i]);
    const c2 = B64.indexOf(clean[i + 1]);
    const c3 = B64.indexOf(clean[i + 2]);
    const c4 = B64.indexOf(clean[i + 3]);
    const chunk = (c1 << 18) | (c2 << 12) | ((c3 < 0 ? 0 : c3) << 6) | (c4 < 0 ? 0 : c4);
    if (byteIndex < size) bytes[byteIndex++] = (chunk >> 16) & 0xff;
    if (byteIndex < size) bytes[byteIndex++] = (chunk >> 8) & 0xff;
    if (byteIndex < size) bytes[byteIndex++] = chunk & 0xff;
  }
  return bytes;
}

/** Baca dimensi JPEG dari marker SOF. */
function jpegSize(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i < bytes.length - 8) {
    if (bytes[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = bytes[i + 1];
    const length = (bytes[i + 2] << 8) + bytes[i + 3];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return {
        height: (bytes[i + 5] << 8) + bytes[i + 6],
        width: (bytes[i + 7] << 8) + bytes[i + 8],
      };
    }
    i += 2 + length;
  }
  return null;
}

/** Gabungkan semua objek menjadi byte PDF final dengan xref yang benar. */
function serialize(objects, rootId, infoId, maxId) {
  const chunks = [];
  let length = 0;
  const write = (data) => {
    const bytes = typeof data === 'string' ? latin1Bytes(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  };

  write('%PDF-1.4\n');
  write(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  const offsets = new Map();
  for (let id = 1; id <= maxId; id += 1) {
    const parts = objects.get(id);
    if (!parts) continue;
    offsets.set(id, length);
    write(`${id} 0 obj\n`);
    if (Array.isArray(parts)) parts.forEach((part) => write(part));
    else write(parts);
    write('\nendobj\n');
  }

  const xrefStart = length;
  write(`xref\n0 ${maxId + 1}\n`);
  write('0000000000 65535 f \n');
  for (let id = 1; id <= maxId; id += 1) {
    const offset = offsets.get(id);
    write(`${String(offset ?? 0).padStart(10, '0')} 00000 n \n`);
  }
  write(`trailer\n<< /Size ${maxId + 1} /Root ${rootId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let cursor = 0;
  chunks.forEach((chunk) => {
    out.set(chunk, cursor);
    cursor += chunk.length;
  });
  return out;
}
