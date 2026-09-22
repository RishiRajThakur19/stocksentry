import React, { useState } from 'react';
import { X, Zap, ArrowDownLeft, ArrowUpRight, RefreshCw } from 'lucide-react';

export const StockAdjustmentModal = ({ isOpen, onClose, onSubmit, items, locations }) => {
  const [variantId, setVariantId] = useState('');
  const [locationId, setLocationId] = useState(locations[0]?.location_id || 1);
  const [quantityChange, setQuantityChange] = useState(-10);
  const [txnType, setTxnType] = useState('OUTBOUND');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const allVariants = [];
  items?.forEach(item => {
    item.variants?.forEach(v => {
      allVariants.push({
        variant_id: v.variant_id,
        name: `${item.name} - ${v.variant_name}`
      });
    });
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!variantId) return;

    setSubmitting(true);
    try {
      await onSubmit({
        variant_id: parseInt(variantId),
        location_id: parseInt(locationId),
        quantity_change: parseInt(quantityChange),
        txn_type: txnType
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
      <div className="tata-card rounded-3xl max-w-md w-full p-6 border border-slate-200 bg-white shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="bg-tata-magenta/10 p-3 rounded-2xl border border-tata-magenta/20 text-tata-magenta">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Manual Stock Control</h3>
            <p className="text-xs text-slate-500">Deduct or add stock to trigger real-time threshold engine</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              Location Hub
            </label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-tata-magenta"
            >
              {locations.map((loc) => (
                <option key={loc.location_id} value={loc.location_id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              Select SKU Variant
            </label>
            <select
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-tata-magenta"
              required
            >
              <option value="">-- Choose Item Variant --</option>
              {allVariants.map((v) => (
                <option key={v.variant_id} value={v.variant_id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              Operation Mode
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => { setTxnType('OUTBOUND'); setQuantityChange(-15); }}
                className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 transition ${
                  txnType === 'OUTBOUND'
                    ? 'bg-rose-50 border-tata-magenta text-tata-magenta'
                    : 'bg-slate-50 border-slate-300 text-slate-600'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                Deduct
              </button>
              <button
                type="button"
                onClick={() => { setTxnType('INBOUND'); setQuantityChange(20); }}
                className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 transition ${
                  txnType === 'INBOUND'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                    : 'bg-slate-50 border-slate-300 text-slate-600'
                }`}
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                Add Stock
              </button>
              <button
                type="button"
                onClick={() => { setTxnType('ADJUSTMENT'); setQuantityChange(0); }}
                className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 transition ${
                  txnType === 'ADJUSTMENT'
                    ? 'bg-amber-50 border-amber-500 text-amber-700'
                    : 'bg-slate-50 border-slate-300 text-slate-600'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Adjust
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              Quantity Delta (Negative for deduction, Positive for add)
            </label>
            <input
              type="number"
              value={quantityChange}
              onChange={(e) => setQuantityChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-mono focus:outline-none focus:border-tata-magenta"
              required
            />
            <p className="text-[11px] text-slate-500 mt-1.5">
              Tip: Set quantity low (e.g., -15) to force stock below threshold and test live WebSocket alert!
            </p>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl text-xs btn-tata-magenta"
            >
              {submitting ? 'Updating...' : 'Execute Stock Operation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
