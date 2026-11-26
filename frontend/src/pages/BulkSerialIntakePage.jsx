import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { QrCode, Upload, CheckCircle2, AlertTriangle, Printer, Camera } from 'lucide-react';
import api from '../api/client';
import { SerialScannerModal } from '../components/SerialScannerModal';

export const BulkSerialIntakePage = () => {
  const [variants, setVariants] = useState([]);
  const [batches, setBatches] = useState([]);
  const [variantId, setVariantId] = useState('');
  const [serialsText, setSerialsText] = useState('');
  const [referenceNote, setReferenceNote] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  // QR Sheet Print state
  const [qrBatch, setQrBatch] = useState(null);
  const [qrImages, setQrImages] = useState([]);

  const loadData = async () => {
    const [itemsRes, batchesRes] = await Promise.all([
      api.get('/inventory/items'),
      api.get('/inventory/receipt-batches').catch(() => ({ data: [] })),
    ]);
    const serialized = [];
    (itemsRes.data || []).forEach((it) => {
      if (it.is_serialized) {
        (it.variants || []).forEach((v) => {
          serialized.push({ variant_id: v.variant_id, label: `${it.name} — ${v.variant_name}` });
        });
      }
    });
    setVariants(serialized);
    if (serialized.length > 0 && !variantId) setVariantId(String(serialized[0].variant_id));
    setBatches(batchesRes.data || []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePreview = async (e) => {
    e.preventDefault();
    setFeedback(null);
    const fd = new FormData();
    fd.append('variant_id', variantId);
    if (serialsText.trim()) fd.append('serials_text', serialsText);
    if (file) fd.append('file', file);
    try {
      const res = await api.post('/inventory/bulk-serials/preview', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setPreview(res.data);
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.detail || 'Preview failed.' });
    }
  };

  const handleCommit = async () => {
    if (!preview || preview.valid.length === 0) return;
    setFeedback(null);
    try {
      const res = await api.post('/inventory/bulk-serials/commit', {
        variant_id: parseInt(variantId, 10),
        serials: preview.valid,
        reference_note: referenceNote.trim() || null,
      });
      setFeedback({ type: 'success', text: `Committed Batch ${res.data.batch_code} (${res.data.unit_count} serials).` });
      setPreview(null);
      setSerialsText('');
      setFile(null);
      await loadData();
      await openQrSheet(res.data.batch_id);
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.detail?.message || err.response?.data?.detail || 'Commit failed.' });
    }
  };

  const openQrSheet = async (batchId) => {
    const res = await api.get(`/inventory/receipt-batches/${batchId}`);
    setQrBatch(res.data);
    const generated = await Promise.all(
      (res.data.serials || []).map(async (sn) => ({
        sn,
        dataUrl: await QRCode.toDataURL(sn, { width: 140, margin: 1 }),
      }))
    );
    setQrImages(generated);
  };

  return (
    <div className="space-y-5 font-sans w-full max-w-[1600px] mx-auto pb-16">
      <div className="bg-white rounded-xl p-5 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#1c023d] text-white flex items-center justify-center">
            <QrCode className="w-4 h-4 text-[#e20d65]" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#1c023d]">Bulk Serial Intake & QR Label Sheets</h1>
            <p className="text-xs text-slate-500">Import serials via paste, CSV/XLSX, or camera scan, validate duplicates, and print A4 QR labels.</p>
          </div>
        </div>
        <button onClick={() => setScannerOpen(true)} className="px-3.5 py-2 rounded-lg bg-[#1c023d] text-white text-xs font-extrabold flex items-center gap-1.5">
          <Camera className="w-4 h-4 text-[#e20d65]" /> Scan to List
        </button>
      </div>

      {feedback && (
        <div className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{feedback.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <form onSubmit={handlePreview} className="lg:col-span-6 bg-white rounded-xl p-5 border border-slate-200 space-y-3 text-xs">
          <h2 className="text-sm font-black text-[#1c023d]">1. Intake Serials</h2>
          <select value={variantId} onChange={(e) => setVariantId(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-300 font-semibold" required>
            {variants.map((v) => <option key={v.variant_id} value={v.variant_id}>{v.label}</option>)}
          </select>
          <input type="text" value={referenceNote} onChange={(e) => setReferenceNote(e.target.value)} placeholder="Reference note (e.g., Delhi Lot #12)" className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300" />
          <textarea rows={5} value={serialsText} onChange={(e) => setSerialsText(e.target.value)} placeholder="Paste serial numbers (one per line)..." className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 font-mono" />
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 font-bold text-slate-600 cursor-pointer">
              <Upload className="w-4 h-4" />
              <input type="file" accept=".csv,.xlsx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#e20d65] text-white font-extrabold">Preview & Validate</button>
          </div>

          {preview && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex flex-wrap gap-3 font-bold">
                <span className="text-emerald-700">Valid: {preview.valid.length}</span>
                <span className="text-amber-700">File Dupes: {preview.duplicate_in_file.length}</span>
                <span className="text-rose-700">DB Dupes: {preview.duplicate_in_db.length}</span>
                <span className="text-rose-700">Invalid: {preview.invalid.length}</span>
              </div>
              {preview.valid.length > 0 && preview.duplicate_in_file.length === 0 && preview.duplicate_in_db.length === 0 && preview.invalid.length === 0 ? (
                <button type="button" onClick={handleCommit} className="w-full py-2.5 rounded-lg bg-emerald-600 text-white font-extrabold">
                  Commit {preview.valid.length} Serial(s) Atomically
                </button>
              ) : (
                <div className="text-rose-700 font-semibold">Resolve duplicates/invalid rows before committing.</div>
              )}
            </div>
          )}
        </form>

        <div className="lg:col-span-6 bg-white rounded-xl p-5 border border-slate-200 space-y-3 text-xs">
          <h2 className="text-sm font-black text-[#1c023d]">2. Receipt Batches (Click to Print QR Sheet)</h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {batches.map((b) => (
              <button key={b.batch_id} onClick={() => openQrSheet(b.batch_id)} className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-[#e20d65] flex items-center justify-between">
                <div>
                  <div className="font-mono font-black text-[#1c023d]">{b.batch_code}</div>
                  <div className="text-slate-500">{b.item_name} ({b.variant_name})</div>
                </div>
                <span className="px-2.5 py-1 rounded bg-purple-50 text-[#6700ce] font-extrabold">{b.unit_count} units</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {qrBatch && (
        <div className="bg-white rounded-xl p-5 border border-slate-200 space-y-4">
          <div className="flex items-center justify-between print:hidden">
            <h3 className="text-sm font-black text-[#1c023d]">Printable A4 QR Sheet — {qrBatch.batch_code}</h3>
            <button onClick={() => window.print()} className="px-3.5 py-2 rounded-lg bg-[#1c023d] text-white text-xs font-extrabold flex items-center gap-1.5">
              <Printer className="w-4 h-4" /> Print A4 Sheet
            </button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
            {qrImages.map(({ sn, dataUrl }) => (
              <div key={sn} className="p-2 border border-slate-300 rounded-lg flex flex-col items-center text-center">
                <img src={dataUrl} alt={sn} className="w-24 h-24" />
                <span className="text-[10px] font-mono font-bold mt-1 break-all">{sn}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <SerialScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(sn) => setSerialsText((prev) => (prev ? `${prev}\n${sn}` : sn))}
      />
    </div>
  );
};
