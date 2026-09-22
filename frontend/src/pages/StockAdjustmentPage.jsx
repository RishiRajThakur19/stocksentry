import React, { useState, useEffect } from 'react';
import { SlidersHorizontal, Plus, Minus, History, CheckCircle2, AlertCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import api from '../api/client';

export const StockAdjustmentPage = ({ locations, items, onAdjustSubmit, refreshTrigger, userLocationId, isCentralAdmin }) => {
  const [selectedLocationId, setSelectedLocationId] = useState(userLocationId || locations[0]?.location_id || 1);
  const [selectedVariantId, setSelectedVariantId] = useState(items[0]?.variants[0]?.variant_id || 1);
  const [quantityChange, setQuantityChange] = useState(1);
  const [txnType, setTxnType] = useState('INBOUND');
  const [reason, setReason] = useState('Inventory Recount / Audit');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stockList, setStockList] = useState([]);

  useEffect(() => {
    if (userLocationId && !isCentralAdmin) {
      setSelectedLocationId(userLocationId);
    }
  }, [userLocationId, isCentralAdmin]);

  const fetchTransactions = async () => {
    try {
      const res = await api.get('/inventory/transactions', {
        params: { location_id: selectedLocationId, limit: 15 }
      });
      setTransactions(res.data);
    } catch (err) {
      console.error("Failed to fetch transactions", err);
    }
  };

  const fetchStock = async () => {
    try {
      const res = await api.get('/inventory/stock', {
        params: { location_id: selectedLocationId }
      });
      setStockList(res.data);
    } catch (err) {
      console.error("Failed to fetch stock", err);
    }
  };

  useEffect(() => {
    fetchStock();
    fetchTransactions();
  }, [selectedLocationId, refreshTrigger]);

  const currentStockRecord = stockList.find(s => s.variant_id === parseInt(selectedVariantId));
  const currentQuantity = currentStockRecord ? currentStockRecord.current_quantity : 0;
  const reorderThreshold = currentStockRecord ? currentStockRecord.reorder_threshold : 10;

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const changeVal = txnType === 'OUTBOUND' ? -Math.abs(parseInt(quantityChange)) : Math.abs(parseInt(quantityChange));

    try {
      await onAdjustSubmit({
        location_id: parseInt(selectedLocationId),
        variant_id: parseInt(selectedVariantId),
        quantity_change: changeVal,
        txn_type: txnType,
        reason: reason
      });
      fetchStock();
      fetchTransactions();
    } catch (err) {
      console.error("Adjustment failed", err);
    } finally {
      setLoading(false);
    }
  };

  const allVariants = items.flatMap(i => i.variants.map(v => ({ ...v, item_name: i.name, category: i.category })));

  const reasonsOptions = [
    "Inventory Recount / Audit",
    "Damaged Goods Write-off",
    "Return to Vendor",
    "Inbound Shipment Receipt",
    "Internal Usage / Field Install",
    "System Correction"
  ];

  return (
    <div className="space-y-6 w-full font-sans pb-12">
      
      {/* Header Banner */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-[#1c023d]" />
            Dedicated Stock Adjustment Terminal
          </h1>
          <p className="text-xs text-slate-500 mt-1">Log inventory adjustments, stock takes, and audit recount overrides for your hub.</p>
        </div>
        <span className="text-xs font-bold px-3 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-mono">
          Audit Terminal
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
        
        {/* Left Form: Dedicated Stock Adjuster */}
        <div className="lg:col-span-5 bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-5">
          <h2 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center justify-between">
            <span>Stock Adjustment Form</span>
            <span className="text-[10px] px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-mono font-bold border border-slate-200">System Log</span>
          </h2>

          <form onSubmit={handleAdjustSubmit} className="space-y-4 text-xs">
            
            {/* Location Selector */}
            <div>
              <label className="block text-slate-700 font-bold mb-1.5">Select Hub Location</label>
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(parseInt(e.target.value))}
                disabled={!isCentralAdmin}
                className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-slate-300 text-slate-900 font-semibold focus:outline-none focus:border-[#e20d65] disabled:opacity-60 shadow-sm"
              >
                {locations.map(loc => (
                  <option key={loc.location_id} value={loc.location_id}>
                    {loc.name} ({loc.city})
                  </option>
                ))}
              </select>
            </div>

            {/* SKU / Variant Selector */}
            <div>
              <label className="block text-slate-700 font-bold mb-1.5">Select Item & Variant (SKU)</label>
              <select
                value={selectedVariantId}
                onChange={(e) => setSelectedVariantId(parseInt(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-slate-300 text-slate-900 font-semibold focus:outline-none focus:border-[#e20d65] shadow-sm"
              >
                {allVariants.map(v => (
                  <option key={v.variant_id} value={v.variant_id}>
                    {v.item_name} - Variant: {v.variant_name} ({v.category})
                  </option>
                ))}
              </select>
            </div>

            {/* Current Stock Preview Card */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Current Quantity</p>
                <p className="text-2xl font-black text-slate-900 mt-0.5">{currentQuantity} <span className="text-xs font-normal text-slate-500">units</span></p>
                <p className="text-[11px] text-slate-500">Threshold: <span className="font-mono font-bold text-amber-700">{reorderThreshold}</span></p>
              </div>
              <div className={`px-3 py-1 rounded-md text-xs font-bold border ${currentQuantity <= reorderThreshold ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                {currentQuantity <= reorderThreshold ? 'Low Stock' : 'Healthy'}
              </div>
            </div>

            {/* Operation Type */}
            <div>
              <label className="block text-slate-700 font-bold mb-1.5">Transaction Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTxnType('INBOUND')}
                  className={`py-2.5 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 border transition ${
                    txnType === 'INBOUND'
                      ? 'bg-[#1c023d] text-white border-[#1c023d] shadow-sm'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                  <span>Inbound (+)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTxnType('OUTBOUND')}
                  className={`py-2.5 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 border transition ${
                    txnType === 'OUTBOUND'
                      ? 'bg-[#1c023d] text-white border-[#1c023d] shadow-sm'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <ArrowDownRight className="w-4 h-4 text-rose-400" />
                  <span>Outbound (-)</span>
                </button>
              </div>
            </div>

            {/* Stepper Quantity Control */}
            <div>
              <label className="block text-slate-700 font-bold mb-1.5">Adjustment Quantity</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantityChange(Math.max(1, quantityChange - 1))}
                  className="w-10 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-900 flex items-center justify-center font-bold border border-slate-300 transition"
                >
                  <Minus className="w-4 h-4" />
                </button>
                
                <input
                  type="number"
                  min="1"
                  value={quantityChange}
                  onChange={(e) => setQuantityChange(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex-1 text-center py-2 text-lg font-black bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#e20d65] shadow-sm"
                />

                <button
                  type="button"
                  onClick={() => setQuantityChange(quantityChange + 1)}
                  className="w-10 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-900 flex items-center justify-center font-bold border border-slate-300 transition"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Reason Selector */}
            <div>
              <label className="block text-slate-700 font-bold mb-1.5">Reason for Adjustment</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-slate-300 text-slate-900 font-semibold focus:outline-none focus:border-[#e20d65] shadow-sm"
              >
                {reasonsOptions.map((r, idx) => (
                  <option key={idx} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-[#e20d65] hover:bg-[#cc0059] text-white font-extrabold text-xs shadow-sm transition flex items-center justify-center gap-2 mt-4"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? 'Processing...' : 'Submit Stock Adjustment'}</span>
            </button>

          </form>
        </div>

        {/* Right Table: Live Audit Transaction Logs */}
        <div className="lg:col-span-7 bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4 text-[#1c023d]" />
              <span>Live Audit Transaction Log</span>
            </h2>
            <span className="text-[10px] text-slate-500 font-mono">Last 15 Events</span>
          </div>

          <div className="flex-1 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs text-slate-800">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold tracking-wider sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="px-3.5 py-3">Time</th>
                  <th className="px-3.5 py-3">SKU Item</th>
                  <th className="px-3.5 py-3">Type</th>
                  <th className="px-3.5 py-3 text-right">Change</th>
                  <th className="px-3.5 py-3">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-12 text-slate-400 text-xs">
                      No stock transaction history recorded yet for this location.
                    </td>
                  </tr>
                ) : (
                  transactions.map((t) => (
                    <tr key={t.txn_id} className="hover:bg-slate-50 transition">
                      <td className="px-3.5 py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-3.5 py-3 font-bold text-slate-900">
                        {t.item_name} <span className="text-slate-500 font-normal">({t.variant_name})</span>
                      </td>
                      <td className="px-3.5 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                          t.quantity > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {t.txn_type}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 text-right font-mono font-black text-slate-900">
                        {t.quantity > 0 ? `+${t.quantity}` : t.quantity}
                      </td>
                      <td className="px-3.5 py-3 text-slate-600 text-[11px]">
                        {t.performed_by_name}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
};
