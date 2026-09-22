import React, { useState, useEffect } from 'react';
import { PlusCircle, Package, MapPin, CheckCircle2, ArrowUpRight, History, Layers } from 'lucide-react';
import api from '../api/client';

export const AddStockPage = ({ locations, items, refreshTrigger, userLocationId, isCentralAdmin, onStockAdded }) => {
  const [selectedLocationId, setSelectedLocationId] = useState(userLocationId || locations[0]?.location_id || 1);
  const [selectedVariantId, setSelectedVariantId] = useState(items[0]?.variants[0]?.variant_id || 1);
  const [addedQuantity, setAddedQuantity] = useState(100);
  const [reason, setReason] = useState('New Shipment Received from Factory/Vendor');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [stockList, setStockList] = useState([]);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    if (userLocationId && !isCentralAdmin) {
      setSelectedLocationId(userLocationId);
    }
  }, [userLocationId, isCentralAdmin]);

  const fetchStockAndTxns = async () => {
    try {
      const [stockRes, txnRes] = await Promise.all([
        api.get('/inventory/stock', { params: { location_id: selectedLocationId } }),
        api.get('/inventory/transactions', { params: { location_id: selectedLocationId, limit: 10 } })
      ]);
      setStockList(stockRes.data);
      setTransactions(txnRes.data);
    } catch (err) {
      console.error("Failed to fetch stock", err);
    }
  };

  useEffect(() => {
    fetchStockAndTxns();
  }, [selectedLocationId, refreshTrigger]);

  const allVariants = items.flatMap(i => i.variants.map(v => ({ ...v, item_name: i.name, category: i.category })));
  const currentStockRecord = stockList.find(s => s.variant_id === parseInt(selectedVariantId));
  const currentQuantity = currentStockRecord ? currentStockRecord.current_quantity : 0;
  const newExpectedQuantity = currentQuantity + parseInt(addedQuantity || 0);

  const handleAddStockSubmit = async (e) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    if (parseInt(addedQuantity) <= 0) {
      setErrorMsg('Stock quantity must be greater than 0.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.post('/inventory/adjust', {
        location_id: parseInt(selectedLocationId),
        variant_id: parseInt(selectedVariantId),
        quantity_change: parseInt(addedQuantity),
        txn_type: 'INBOUND',
        reason: reason
      });

      setSuccessMsg(`Successfully added +${addedQuantity} units to ${res.data.item_name} (${res.data.variant_name}) at ${res.data.location_name}! New total stock: ${res.data.current_quantity} units.`);
      fetchStockAndTxns();
      onStockAdded?.();
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Failed to add stock.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans w-full max-w-5xl mx-auto">
      
      {/* Page Header */}
      <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#1c023d] flex items-center gap-2">
            <PlusCircle className="w-6 h-6 text-[#e20d65]" />
            Receive Stock Shipment / Add Inventory
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manually add newly manufactured products (T-Shirts, Modems, Cameras, Bottles, etc.) into warehouse stock.
          </p>
        </div>
        <span className="text-xs font-bold px-3 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
          Inbound Terminal
        </span>
      </div>

      {errorMsg && (
        <div className="p-4 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
        
        {/* Left Form: Direct Stock Addition Terminal */}
        <div className="lg:col-span-7 bg-white rounded-lg p-6 border border-slate-200 shadow-sm space-y-5">
          <h2 className="text-xs font-extrabold text-[#1c023d] uppercase tracking-wider border-b border-slate-100 pb-3 flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4 text-emerald-600" />
            Inbound Shipment Receipt Form
          </h2>

          <form onSubmit={handleAddStockSubmit} className="space-y-4 text-xs">
            
            {/* Warehouse Location */}
            <div>
              <label className="block text-slate-700 font-bold mb-1.5">Destination Warehouse Hub *</label>
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(parseInt(e.target.value))}
                disabled={!isCentralAdmin}
                className="w-full px-3.5 py-2.5 rounded bg-white border border-slate-300 text-slate-900 font-semibold focus:outline-none focus:border-[#e20d65] disabled:opacity-60 shadow-sm"
              >
                {locations.map(loc => (
                  <option key={loc.location_id} value={loc.location_id}>
                    {loc.name} ({loc.city})
                  </option>
                ))}
              </select>
            </div>

            {/* Select Item */}
            <div>
              <label className="block text-slate-700 font-bold mb-1.5">Select Product & SKU Variant *</label>
              <select
                value={selectedVariantId}
                onChange={(e) => setSelectedVariantId(parseInt(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded bg-white border border-slate-300 text-slate-900 font-semibold focus:outline-none focus:border-[#e20d65] shadow-sm"
              >
                {allVariants.map(v => (
                  <option key={v.variant_id} value={v.variant_id}>
                    {v.item_name} - Variant: {v.variant_name} ({v.category})
                  </option>
                ))}
              </select>
            </div>

            {/* Live Impact Preview Card */}
            <div className="p-4 rounded bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Current Hub Stock</p>
                <p className="text-xl font-black text-slate-900 font-mono mt-0.5">{currentQuantity} units</p>
              </div>

              <div className="text-right">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Stock After Shipment</p>
                <p className="text-xl font-black text-emerald-600 font-mono mt-0.5">{newExpectedQuantity} units</p>
              </div>
            </div>

            {/* Quantity to Add */}
            <div>
              <label className="block text-slate-700 font-bold mb-1.5">New Stock Quantity Received *</label>
              <input
                type="number"
                min="1"
                required
                value={addedQuantity}
                onChange={(e) => setAddedQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                placeholder="e.g. 500"
                className="w-full px-4 py-3 rounded bg-white border border-slate-300 text-slate-900 font-black text-lg font-mono focus:outline-none focus:border-[#e20d65] shadow-sm"
              />
            </div>

            {/* Reason */}
            <div>
              <label className="block text-slate-700 font-bold mb-1.5">Inbound Reason / Vendor Tag</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Batch #490 received from Syrotech factory"
                className="w-full px-3.5 py-2.5 rounded bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#e20d65] shadow-sm"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded bg-[#e20d65] hover:bg-[#cc0059] text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-2 mt-4"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? 'Adding Stock...' : 'Confirm & Add Stock to Warehouse'}</span>
            </button>

          </form>
        </div>

        {/* Right Column: Live Audit Log */}
        <div className="lg:col-span-5 bg-white rounded-lg p-6 border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <h2 className="text-xs font-extrabold text-[#1c023d] uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4 text-[#6700ce]" />
              <span>Live Inbound Receipt Log</span>
            </h2>
            <span className="text-[10px] text-slate-400 font-mono">Recent 10 Events</span>
          </div>

          <div className="space-y-2.5 overflow-y-auto max-h-[380px]">
            {transactions.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-10">No stock receipt transactions logged yet.</p>
            ) : (
              transactions.map((t) => (
                <div key={t.txn_id} className="p-3 rounded bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1c023d]">{t.item_name} ({t.variant_name})</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black font-mono ${t.quantity > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                      {t.quantity > 0 ? `+${t.quantity}` : t.quantity} units
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>{t.location_name} • {t.performed_by_name}</span>
                    <span className="font-mono text-[10px]">{new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
