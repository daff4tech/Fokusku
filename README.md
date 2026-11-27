# FokusKu — Pomodoro + Habit Tracker + Ambient Sound (Offline-First PWA)

Workspace fokus minimalis untuk kerja dan belajar dalam satu tab, dibangun dengan **React + Vite + Chart.js + Web Audio API + Service Worker**.

## Fitur Unggulan

- **Timer Pomodoro Fleksibel**: Preset **25/5 (Klasik)**, **50/10 (Deep Work)**, dan mode **Custom** (atur durasi fokus, istirahat pendek/panjang, interval siklus, auto-start, dan bel selesai).
- **Daftar Task Harian (*Drag & Drop*)**: Tambah target harian beserta estimasi sesi Pomodoro, tandai sebagai task aktif, seret untuk ubah prioritas (atau gunakan tombol geser atas/bawah), serta filter status.
- **Mixer Suara Ambient Bawaan (Web Audio API)**: 4 kanal suara procedural offline (**Hujan**, **Kafe**, **White Noise**, **Lo-fi**) yang dapat digabung volumenya secara bersamaan + volume master dan preset cepat.
- **Habit Tracker & Heatmap Konsistensi**: Checklist habit harian + grafik kontribusi 24 minggu ala GitHub + indikator streak aktif/terpanjang.
- **Statistik Jam Fokus Mingguan**: Grafik batang interaktif 7 hari terakhir berbasis **Chart.js** yang otomatis mengikuti tema gelap/terang.
- **Mode Fullscreen Zen & Tema Gelap/Terang**: Tampilan bebas distraksi dengan pintasan keyboard (`Spasi` mulai/jeda, `R` reset, `Z` mode Zen, `Esc` keluar Zen).
- **Offline-First PWA**: Seluruh data tersimpan di `localStorage`, dilengkapi `manifest.webmanifest`, Service Worker (`public/sw.js`), dan fitur Ekspor/Impor backup JSON.

## Menjalankan Proyek

```bash
npm install
npm run dev      # Jalankan development server
npm test         # Jalankan unit test (Vitest)
npm run build    # Build produksi PWA
```
