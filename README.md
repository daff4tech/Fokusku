# NotaKu — Pembuat Invoice & Penawaran Harga

Aplikasi web untuk **freelancer, katering, dan jasa rumahan**: isi data pelanggan & item, hasilkan **invoice/penawaran PDF** yang rapi, pantau **status pembayaran**, lalu **kirim lewat WhatsApp** — semuanya berjalan offline di browser.

Dibangun dengan **React + Vite**, mesin **PDF buatan sendiri** (tanpa library PDF berat), dan `localStorage` sebagai basis data.

## Fitur

- **Dua jenis dokumen** — Invoice dan Penawaran Harga dengan penomoran otomatis terpisah (`INV/202611/001`, `QTN/202611/001`), label, warna, dan syarat yang berbeda.
- **Editor + pratinjau langsung** — ubah apa pun di kiri, pratinjau A4 di kanan ikut berubah. Total, diskon, pajak, dan terbilang dihitung seketika.
- **PDF profesional** — kop usaha + logo, tabel item multi-halaman (header tabel & nomor halaman berulang), ringkasan biaya, **terbilang** Bahasa Indonesia, rekening pembayaran, riwayat pembayaran, dan kolom tanda tangan. Ukuran file hanya belasan KB.
- **Pantau pembayaran** — catat DP/pelunasan (tombol *Lunasi*, 50%, 25%), status otomatis berubah menjadi *Dibayar Sebagian* / *Lunas*, plus deteksi **jatuh tempo** otomatis.
- **Kirim via WhatsApp** — pesan terisi otomatis (rincian item, total, sisa tagihan, nomor rekening) dan bisa dipilih variannya: kirim dokumen, **pengingat pembayaran**, atau ucapan terima kasih. Nomor `08xx` otomatis dinormalisasi ke `62xx`.
- **Manajemen pelanggan** — simpan kontak, lihat total tagihan & piutang per pelanggan, buat invoice langsung dari kartu pelanggan.
- **Dashboard** — piutang berjalan, dana diterima, invoice lewat jatuh tempo, konversi penawaran, grafik arus kas 6 bulan, daftar "perlu perhatian", dan pelanggan teratas.
- **Pengaturan lengkap** — profil usaha, logo (PNG/WEBP otomatis dikonversi), hingga 2 rekening bank, mata uang (IDR/USD/SGD/MYR), tarif PPN & PPh 23, warna aksen dokumen, tema terang/gelap.
- **Offline-first & data milik Anda** — PWA dengan service worker, ekspor/impor cadangan JSON, ekspor pelanggan CSV. Tidak ada server, tidak ada akun.

## Menjalankan

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 52 unit + integration test (Vitest + Testing Library)
npm run build    # build produksi PWA
npm run preview  # pratinjau hasil build
```

## Alur singkat

1. Atur **Profil & Pengaturan → Profil usaha**: nama, logo, kontak, dan rekening bank (dipakai di kop PDF).
2. Klik **Buat dokumen** → pilih Invoice atau Penawaran.
3. Pilih pelanggan (atau ketik manual), isi item, qty, satuan, dan harga.
4. Atur diskon, PPN, PPh 23, atau biaya tambahan bila perlu.
5. **Simpan** → **Unduh PDF** / **Kirim via WhatsApp**.
6. Setelah dana masuk: **Catat pembayaran** agar status invoice terupdate.

Pintasan: `Ctrl/⌘ + N` dokumen baru · `Ctrl/⌘ + S` simpan.

## Struktur proyek

```
src/
├── App.jsx                 # orkestrasi state, routing, persistensi
├── components/
│   ├── Dashboard.jsx       # metrik, grafik arus kas, prioritas penagihan
│   ├── DocumentList.jsx    # tabel invoice/penawaran: cari, filter, aksi
│   ├── DocumentEditor.jsx  # form dokumen, item, pajak, pembayaran
│   ├── DocumentPreview.jsx # pratinjau A4 (HTML) real-time
│   ├── Customers.jsx       # basis data pelanggan
│   ├── Settings.jsx        # profil usaha, bank, tampilan, backup
│   ├── WhatsAppModal.jsx   # penyusun pesan & deep link wa.me
│   └── ...
├── pdf/
│   ├── pdfWriter.js        # penulis PDF low-level (font, vektor, JPEG, xref)
│   └── docPdf.js           # tata letak invoice/penawaran A4
└── utils/
    ├── documents.js        # model, perhitungan, status, data demo
    ├── currency.js         # format & parsing Rupiah/mata uang lain
    ├── terbilang.js        # angka → kata Bahasa Indonesia
    ├── whatsapp.js         # normalisasi nomor & template pesan
    └── storage.js          # localStorage, seed, backup
```

## Catatan teknis

- `src/pdf/pdfWriter.js` menulis PDF 1.4 secara manual: metrik Helvetica (regular/bold/italic), `WinAnsiEncoding` (karakter Indonesia, `•`, `–`, `“ ”` aman), rounded rect, gambar JPEG (marker `DCTDecode`), dan tabel `xref` yang valid — diuji terhadap pembaca PDF.
- Semua nominal rupiah disimpan sebagai bilangan bulat dan dibulatkan ke 2 desimal pada operasi uang untuk menghindari galat pembulatan.
- Logo PNG/WEBP dikonversi ke JPEG di kanvas sebelum disematkan ke PDF; jika konversi gagal, dokumen tetap dibuat tanpa logo.
- Data demo (katering Banjarmasin) dimuat pada kunjungan pertama agar aplikasi langsung bisa dijelajahi; **Reset semua data** di Pengaturan menghapusnya.
