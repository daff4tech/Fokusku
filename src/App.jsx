import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, Copy, FileText } from 'lucide-react';
import { Sidebar, Topbar, Toasts, useTheme } from './components/Layout.jsx';
import { Dashboard } from './components/Dashboard.jsx';
import { DocumentList } from './components/DocumentList.jsx';
import { DocumentEditor } from './components/DocumentEditor.jsx';
import { Customers } from './components/Customers.jsx';
import { Settings } from './components/Settings.jsx';
import { WhatsAppModal } from './components/WhatsAppModal.jsx';
import { ConfirmDialog } from './components/Modal.jsx';
import {
  DEFAULT_PROFILE,
  DOC_TYPE_META,
  createDocument,
  nextDocNumber,
  calculateTotals,
  balanceDue,
  effectiveStatus,
  uid,
} from './utils/documents.js';
import { formatCurrency } from './utils/currency.js';
import { addDaysISO, todayISO } from './utils/dates.js';
import {
  STORAGE_KEYS,
  loadAppState,
  saveJSON,
  DEFAULT_SETTINGS,
} from './utils/storage.js';
import { renderDocumentPdf } from './pdf/docPdf.js';
import { downloadBytes, safeFilename } from './utils/download.js';

const PAGE_META = {
  dashboard: { title: 'Dashboard', subtitle: 'Ringkasan tagihan, piutang, dan penawaran Anda' },
  invoices: { title: 'Invoice', subtitle: 'Kelola tagihan pelanggan dan pantau pembayaran' },
  quotes: { title: 'Penawaran Harga', subtitle: 'Kirim estimasi biaya sebelum proyek dimulai' },
  customers: { title: 'Pelanggan', subtitle: 'Basis data pelanggan & riwayat transaksi' },
  settings: { title: 'Profil & Pengaturan', subtitle: 'Identitas usaha, rekening, dan preferensi dokumen' },
  editor: { title: 'Editor dokumen', subtitle: '' },
};

export default function App() {
  const initial = useMemo(() => loadAppState(), []);
  const [documents, setDocuments] = useState(initial.documents);
  const [customers, setCustomers] = useState(initial.customers);
  const [profile, setProfile] = useState(initial.profile);
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS, ...initial.settings });

  const [page, setPage] = useState('dashboard');
  const [editor, setEditor] = useState(null); // { draft, isNew }
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [waDoc, setWaDoc] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [theme, setTheme] = useTheme();

  /* ------------------------------ persistence ----------------------------- */
  useEffect(() => {
    saveJSON(STORAGE_KEYS.DOCUMENTS, documents);
  }, [documents]);
  useEffect(() => {
    saveJSON(STORAGE_KEYS.CUSTOMERS, customers);
  }, [customers]);
  useEffect(() => {
    saveJSON(STORAGE_KEYS.PROFILE, profile);
  }, [profile]);
  useEffect(() => {
    saveJSON(STORAGE_KEYS.SETTINGS, settings);
  }, [settings]);

  /* --------------------------------- toasts ------------------------------- */
  const toast = useCallback((message, type = 'info') => {
    const id = uid('toast');
    const icons = {
      success: <CheckCircle2 size={15} />,
      error: <AlertCircle size={15} />,
      info: <Info size={15} />,
      copy: <Copy size={15} />,
    };
    setToasts((prev) => [...prev.slice(-2), { id, message, type, icon: icons[type] || icons.info }]);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /* -------------------------------- routing ------------------------------- */
  const navigate = useCallback((next) => {
    setPage(next);
    if (next !== 'editor') setEditor(null);
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const openDocument = useCallback(
    (doc, { isNew = false } = {}) => {
      setEditor({ draft: { ...doc, items: doc.items.map((i) => ({ ...i })) }, isNew });
      setPage('editor');
      window.scrollTo({ top: 0 });
    },
    []
  );

  const createNew = useCallback(
    (type = 'invoice', patch = {}) => {
      const prefix = type === 'quote' ? profile.quotePrefix : profile.invoicePrefix;
      const number = nextDocNumber(documents, type, new Date(), prefix);
      const dueDays = type === 'quote' ? 14 : profile.defaultDueDays || 7;
      const blank = createDocument({
        type,
        number,
        issueDate: todayISO(),
        dueDate: addDaysISO(todayISO(), type === 'quote' ? 14 : dueDays),
        validUntil: addDaysISO(todayISO(), 14),
        tax: { enabled: true, rate: profile.taxRate ?? 11, label: profile.taxLabel || 'PPN' },
        customerId: patch.customerId || null,
        customer: patch.customer || {
          name: '',
          company: '',
          phone: '',
          email: '',
          address: '',
        },
        ...patch,
      });
      openDocument(blank, { isNew: true });
    },
    [documents, openDocument, profile]
  );

  const saveDocument = useCallback(
    (draft) => {
      const stamped = { ...draft, updatedAt: new Date().toISOString() };
      setDocuments((prev) => {
        const exists = prev.some((d) => d.id === stamped.id);
        return exists ? prev.map((d) => (d.id === stamped.id ? stamped : d)) : [stamped, ...prev];
      });
      setEditor((prev) => (prev ? { ...prev, isNew: false, draft: stamped } : prev));
      toast(`${DOC_TYPE_META[stamped.type]?.shortLabel || 'Dokumen'} ${stamped.number} disimpan`, 'success');
    },
    [toast]
  );

  const deleteDocument = useCallback(
    (doc) => {
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      if (editor?.draft?.id === doc.id) {
        setEditor(null);
        setPage(doc.type === 'quote' ? 'quotes' : 'invoices');
      }
      toast('Dokumen dihapus', 'success');
    },
    [editor, toast]
  );

  const duplicateDocument = useCallback(
    (doc) => {
      const type = doc.type;
      const prefix = type === 'quote' ? profile.quotePrefix : profile.invoicePrefix;
      const clone = {
        ...doc,
        id: uid('doc'),
        number: nextDocNumber(documents, type, new Date(), prefix),
        status: 'draft',
        issueDate: todayISO(),
        dueDate: addDaysISO(todayISO(), type === 'quote' ? 14 : profile.defaultDueDays || 7),
        validUntil: addDaysISO(todayISO(), 14),
        payments: [],
        items: doc.items.map((item) => ({ ...item, id: uid('itm') })),
        extras: (doc.extras || []).map((x) => ({ ...x, id: uid('ext') })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setDocuments((prev) => [clone, ...prev]);
      openDocument(clone, { isNew: true });
      toast('Dokumen diduplikasi sebagai draf baru', 'success');
    },
    [documents, openDocument, profile, toast]
  );

  const downloadDocument = useCallback(
    (doc) => {
      const bytes = renderDocumentPdf(doc, profile, {
        showTerbilang: settings.showTerbilang !== false,
        accent: profile.accentColor,
      });
      const name = safeFilename(`${doc.type === 'quote' ? 'Penawaran' : 'Invoice'}-${doc.number || doc.id}`);
      downloadBytes(bytes, `${name}.pdf`);
      toast('PDF berhasil dibuat', 'success');
    },
    [profile, settings.showTerbilang, toast]
  );

  const markWhatsAppSent = useCallback(
    (docId) => {
      setDocuments((prev) =>
        prev.map((d) => {
          if (d.id !== docId) return d;
          if (d.status === 'draft' || (d.type === 'quote' && d.status === 'draft')) {
            return { ...d, status: 'sent', updatedAt: new Date().toISOString() };
          }
          return d;
        })
      );
    },
    []
  );

  const saveCustomer = useCallback(
    (customer) => {
      setCustomers((prev) => {
        const exists = prev.some((c) => c.id === customer.id);
        return exists ? prev.map((c) => (c.id === customer.id ? customer : c)) : [customer, ...prev];
      });
    },
    []
  );

  const deleteCustomer = useCallback((customer) => {
    setCustomers((prev) => prev.filter((c) => c.id !== customer.id));
  }, []);

  const importBackup = useCallback(
    (data) => {
      setDocuments((prev) => {
        const ids = new Set(prev.map((d) => d.id));
        return [...data.documents.filter((d) => !ids.has(d.id)), ...prev];
      });
      if (data.customers?.length) {
        setCustomers((prev) => {
          const ids = new Set(prev.map((c) => c.id));
          return [...data.customers.filter((c) => !ids.has(c.id)), ...prev];
        });
      }
      if (data.profile) setProfile((prev) => ({ ...prev, ...data.profile }));
      if (data.settings) setSettings((prev) => ({ ...prev, ...data.settings }));
    },
    []
  );

  /* --------------------------- deep link ?new=... -------------------------- */
  const deepLinkDone = useRef(false);
  useEffect(() => {
    if (deepLinkDone.current) return;
    deepLinkDone.current = true;
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('new');
    if (requested === 'invoice' || requested === 'quote') {
      createNew(requested);
    }
  }, [createNew]);

  /* -------------------------- autosave dokumen lama ----------------------- */
  useEffect(() => {
    if (!editor || editor.isNew || settings.autoSave === false) return undefined;
    const draft = editor.draft;
    const timer = setTimeout(() => {
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === draft.id ? { ...draft, updatedAt: new Date().toISOString() } : doc
        )
      );
    }, 900);
    return () => clearTimeout(timer);
  }, [editor, settings.autoSave]);

  /* ------------------------------- shortcuts ------------------------------ */
  useEffect(() => {
    const onKey = (event) => {
      const target = event.target;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (editor) saveDocument(editor.draft);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n' && !typing) {
        event.preventDefault();
        createNew('invoice');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editor, saveDocument, createNew]);

  /* --------------------------------- derived ------------------------------ */
  const counts = useMemo(
    () => ({
      invoices: documents.filter((d) => d.type === 'invoice' && !['paid', 'cancelled'].includes(effectiveStatus(d))).length,
      quotes: documents.filter((d) => d.type === 'quote' && ['sent', 'draft'].includes(effectiveStatus(d))).length,
      customers: customers.length,
    }),
    [documents, customers]
  );

  const outstanding = useMemo(
    () =>
      documents
        .filter((d) => d.type === 'invoice' && !['draft', 'paid', 'cancelled'].includes(effectiveStatus(d)))
        .reduce((sum, doc) => sum + balanceDue(doc), 0),
    [documents]
  );

  const pageMeta = PAGE_META[page] || PAGE_META.dashboard;
  const subtitle =
    page === 'editor' && editor
      ? `${DOC_TYPE_META[editor.draft.type]?.label || 'Dokumen'} • ${
          formatCurrency(calculateTotals(editor.draft).total, editor.draft.currency || profile.currency)
        }`
      : pageMeta.subtitle;

  const handleBack = () => {
    if (editor && !editor.isNew) {
      const exists = documents.some((d) => d.id === editor.draft.id);
      if (!exists) {
        setConfirmDelete(editor.draft);
        return;
      }
    }
    navigate(editor?.draft?.type === 'quote' ? 'quotes' : 'invoices');
  };

  return (
    <div className="app-shell">
      <Sidebar
        page={page === 'editor' ? (editor?.draft?.type === 'quote' ? 'quotes' : 'invoices') : page}
        onNavigate={navigate}
        onNew={(type) => createNew(type)}
        counts={counts}
        profile={profile}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="main">
        <Topbar
          title={pageMeta.title}
          subtitle={subtitle}
          theme={theme}
          onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          onOpenMenu={() => setSidebarOpen(true)}
          outstanding={page === 'editor' ? 0 : outstanding}
          currency={profile.currency}
          actions={
            page !== 'settings' && page !== 'editor' ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => createNew(page === 'quotes' ? 'quote' : 'invoice')}
              >
                <FileText size={14} />
                <span className="hide-sm">Buat baru</span>
              </button>
            ) : null
          }
        />

        <main className="page">
          {page === 'dashboard' && (
            <Dashboard
              documents={documents}
              customers={customers}
              profile={profile}
              onNavigate={navigate}
              onOpenDoc={(doc) => openDocument(doc)}
              onNew={createNew}
              onWhatsApp={(doc) => setWaDoc(doc)}
            />
          )}

          {page === 'invoices' && (
            <DocumentList
              type="invoice"
              documents={documents}
              profile={profile}
              onOpen={(doc) => openDocument(doc)}
              onNew={createNew}
              onWhatsApp={(doc) => setWaDoc(doc)}
              onDuplicate={duplicateDocument}
              onDelete={(doc) => setConfirmDelete(doc)}
              onDownload={downloadDocument}
            />
          )}

          {page === 'quotes' && (
            <DocumentList
              type="quote"
              documents={documents}
              profile={profile}
              onOpen={(doc) => openDocument(doc)}
              onNew={createNew}
              onWhatsApp={(doc) => setWaDoc(doc)}
              onDuplicate={duplicateDocument}
              onDelete={(doc) => setConfirmDelete(doc)}
              onDownload={downloadDocument}
            />
          )}

          {page === 'customers' && (
            <Customers
              customers={customers}
              documents={documents}
              profile={profile}
              onSave={saveCustomer}
              onDelete={deleteCustomer}
              onCreateInvoice={(customer) =>
                createNew('invoice', {
                  customerId: customer.id,
                  customer: {
                    name: customer.name || '',
                    company: customer.company || '',
                    phone: customer.phone || '',
                    email: customer.email || '',
                    address: customer.address || '',
                  },
                })
              }
              onOpenDoc={(doc) => openDocument(doc)}
              toast={toast}
            />
          )}

          {page === 'settings' && (
            <Settings
              profile={{ ...DEFAULT_PROFILE, ...profile }}
              onSave={(next) => setProfile((prev) => ({ ...prev, ...next }))}
              documents={documents}
              customers={customers}
              settings={settings}
              onSaveSettings={(next) => setSettings((prev) => ({ ...prev, ...next }))}
              onImport={importBackup}
              toast={toast}
              theme={theme}
              onTheme={setTheme}
            />
          )}

          {page === 'editor' && editor && (
            <DocumentEditor
              key={editor.draft.id}
              draft={editor.draft}
              isNew={editor.isNew}
              onChange={(next) => setEditor((prev) => ({ ...prev, draft: next }))}
              onBack={handleBack}
              onSave={saveDocument}
              onDelete={(doc) => setConfirmDelete(doc)}
              onDuplicate={duplicateDocument}
              onWhatsApp={(doc) => setWaDoc(doc)}
              profile={profile}
              customers={customers}
              onAddCustomer={(customer) => {
                saveCustomer(customer);
                setCustomers((prev) => prev);
              }}
              toast={toast}
              showTerbilang={settings.showTerbilang !== false}
            />
          )}
        </main>
      </div>

      <WhatsAppModal
        open={Boolean(waDoc)}
        onClose={() => setWaDoc(null)}
        doc={waDoc}
        profile={profile}
        onSent={markWhatsAppSent}
        toast={toast}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) deleteDocument(confirmDelete);
        }}
        title="Hapus dokumen?"
        message={`Dokumen ${confirmDelete?.number || ''} akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus"
        danger
      />

      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
