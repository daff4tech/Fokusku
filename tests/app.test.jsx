import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App.jsx';

function resetStorage() {
  window.localStorage.clear();
}

beforeEach(() => {
  cleanup();
  resetStorage();
});

describe('Alur aplikasi end-to-end', () => {
  it('memuat dashboard dengan data demo dan metrik utama', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Piutang berjalan')).toBeInTheDocument();
    expect(screen.getByText('Lewat jatuh tempo')).toBeInTheDocument();
    expect(screen.getByText('Arus kas 6 bulan')).toBeInTheDocument();
    expect(screen.getByText('Aksi cepat')).toBeInTheDocument();
    // 6 dokumen demo
    expect(screen.getByText(/Dapur Bunda Sari/)).toBeInTheDocument();
    const saved = JSON.parse(window.localStorage.getItem('notaku_documents_v1'));
    expect(saved).toHaveLength(6);
  }, 20000);

  it('membuat invoice baru, menambah item, dan menyimpannya', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { level: 1 });

    await user.click(screen.getByRole('button', { name: /Buat dokumen/i }));
    await screen.findByText('Informasi dokumen');

    // nomor otomatis lanjut dari data demo
    const numberInput = screen.getByLabelText(/Nomor invoice/i);
    expect(numberInput.value).toBe('INV/202611/004');

    // isi pelanggan
    await user.type(screen.getByLabelText(/Nama pelanggan/i), 'Klien Uji');
    await user.type(screen.getByLabelText(/Nomor WhatsApp/i), '081298765432');

    // isi item pertama
    await user.type(screen.getByLabelText(/Nama item 1/i), 'Katering rapat');

    // simpan
    await user.click(screen.getAllByRole('button', { name: /Simpan perubahan/i })[0]);

    await waitFor(() => {
      const docs = JSON.parse(window.localStorage.getItem('notaku_documents_v1'));
      expect(docs).toHaveLength(7);
      const latest = docs.find((d) => d.customer.name === 'Klien Uji');
      expect(latest).toBeTruthy();
      expect(latest.number).toBe('INV/202611/004');
      expect(latest.items[0].name).toBe('Katering rapat');
    });
  }, 30000);

  it('menambah item dan menghitung total otomatis', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getByRole('button', { name: /Buat dokumen/i }));
    await screen.findByText('Informasi dokumen');

    const nameInputs = () => screen.getAllByLabelText(/Nama item \d/i).map((el) => el);
    expect(nameInputs()).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: /Tambah item/i }));
    expect(nameInputs()).toHaveLength(2);

    await user.type(nameInputs()[0], 'Nasi box');
    const priceInput = screen.getByLabelText('Harga item 1');
    await user.click(priceInput);
    await user.type(priceInput, '50000');
    await user.click(screen.getByLabelText('Qty item 1'));
    await user.clear(screen.getByLabelText('Qty item 1'));
    await user.type(screen.getByLabelText('Qty item 1'), '3');

    await waitFor(() => {
      const text = document.body.textContent.replace(/\u00a0/g, ' ');
      expect(text).toMatch(/Rp\s?150\.000/);
    });
  }, 30000);

  it('mencatat pembayaran dan mengubah status jadi lunas', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { level: 1 });

    // buka invoice kedua (dibayar sebagian)
    await user.click(screen.getByRole('button', { name: /^Invoice\s*\d/ }));
    await screen.findByText('INV/202611/002');
    const row = screen.getByText('INV/202611/002').closest('tr');
    await user.click(row);
    await screen.findByText('Pembayaran');

    await user.click(screen.getAllByRole('button', { name: /Catat pembayaran/i })[0]);
    await screen.findByText('Jumlah diterima');
    await user.click(screen.getByRole('button', { name: /^Lunasi Rp/ }));
    await user.click(screen.getByRole('button', { name: /Simpan pembayaran/i }));

    await waitFor(() => {
      const docs = JSON.parse(window.localStorage.getItem('notaku_documents_v1'));
      const target = docs.find((d) => d.number === 'INV/202611/002');
      expect(target.status).toBe('paid');
      expect(target.payments).toHaveLength(2);
    });
    expect(await screen.findByText('Lunas')).toBeInTheDocument();
  }, 30000);

  it('menampilkan pratinjau WhatsApp dengan pesan berisi nomor invoice', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getByRole('button', { name: /^Penawaran\s*\d/ }));
    const row = (await screen.findByText('QTN/202611/001')).closest('tr');
    await user.click(within(row).getByTitle(/Kirim WhatsApp/i));

    expect(await screen.findByText(/Kirim penawaran harga via WhatsApp/i)).toBeInTheDocument();
    const textarea = screen.getByLabelText(/Isi pesan/i);
    expect(textarea.value).toContain('QTN/202611/001');
    expect(textarea.value).toContain('Total');
    expect(textarea.value).toContain('Berlaku s/d');
    expect(screen.getByText(/Akan dikirim ke \+62/)).toBeInTheDocument();
  }, 30000);

  it('mengubah status dokumen lewat chip status', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getByRole('button', { name: /^Invoice\s*\d/ }));
    const row = (await screen.findByText('INV/202611/003')).closest('tr');
    await user.click(row);
    await screen.findByText('Informasi dokumen');

    await user.click(screen.getByRole('button', { name: /Tandai lunas/i }));
    await user.click(screen.getAllByRole('button', { name: /Simpan perubahan/i })[0]);

    await waitFor(() => {
      const docs = JSON.parse(window.localStorage.getItem('notaku_documents_v1'));
      const target = docs.find((d) => d.number === 'INV/202611/003');
      expect(target.status).toBe('paid');
      const total = target.items.reduce((s, i) => s + i.qty * i.price, 0);
      const tax = Math.round((total * 11) / 100);
      const paid = target.payments.reduce((s, p) => s + p.amount, 0);
      expect(paid).toBe(total + tax - Math.round((total * 2) / 100));
    });
  }, 30000);

  it('menavigasi ke pelanggan dan pengaturan', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { level: 1 });

    await user.click(screen.getByTestId('qa-customers'));
    expect(await screen.findByText('Rizky Pratama')).toBeInTheDocument();
    expect(screen.getByText('Dewi Anggraini')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Profil & Pengaturan/i }));
    expect((await screen.findAllByText('Profil usaha')).length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue('Dapur Bunda Sari')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Rekening bank/i }));
    expect(await screen.findByDisplayValue('0895-01-023456-30-7')).toBeInTheDocument();
  }, 30000);

  it('menghapus dokumen dari daftar', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getByRole('button', { name: /^Penawaran\s*\d/ }));

    const row = (await screen.findByText('QTN/202611/003')).closest('tr');
    await user.click(within(row).getByTitle(/Menu lainnya/i));
    await user.click(within(row.parentElement).getByRole('button', { name: /Hapus/i }));
    await user.click(await screen.findByRole('button', { name: /^Hapus$/i, hidden: false }));

    await waitFor(() => {
      const docs = JSON.parse(window.localStorage.getItem('notaku_documents_v1'));
      expect(docs.some((d) => d.number === 'QTN/202611/003')).toBe(false);
    });
  }, 30000);

  it('menyimpan data setelah reload (persistensi localStorage)', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getByRole('button', { name: /Profil & Pengaturan/i }));
    const nameInput = await screen.findByLabelText(/Nama usaha/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Katering Baru');
    await user.click(screen.getAllByRole('button', { name: /Simpan profil/i })[0]);
    unmount();

    render(<App />);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getAllByText(/Katering Baru/).length).toBeGreaterThan(0);
  }, 30000);
});
