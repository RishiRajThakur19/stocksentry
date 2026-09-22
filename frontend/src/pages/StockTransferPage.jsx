import React, { useState, useEffect } from 'react';
import { ArrowLeftRight, CheckCircle2, AlertTriangle, Building2, Package, ArrowRight } from 'lucide-react';
import api from '../api/client';

export const StockTransferPage = ({ locations, items, onTransferSubmit, refreshTrigger }) => {
  const [sourceLocId, setSourceLocId] = useState(locations[0]?.location_id || 1);
  const [destLocId, setDestLocId] = useState(locations[1]?.location_id || 2);
  const [variantId, setVariantId] = useState(items[0]?.variants[0]?.variant_id || 1);
  const [quantity, setQuantity] = useState(5);
  const [reason, setReason] = useState('Stock Rebalancing');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [sourceStockList, setSourceStockList] = useState([]);
  const [destStockList, setDestStockList] = useState([]);

  const fetchHubStocks = async () => {
    try {
      const [srcRes, destRes] = await Promise.all([
        api.get('/inventory/stock', { params: { location_id: sourceLocId } }),
        api.get('/inventory/stock', { params: { location_id: destLocId } })
      ]);
      setSourceStockList(srcRes.data);
      setDestStockList(destRes.data);
    } catch (err) {
      console.error("Failed to fetch stock for hubs", err);
    }
  };

  useEffect(() => {
    fetchHubStocks();
  }, [sourceLocId, destLocId, refreshTrigger]);

  const sourceRecord = sourceStockList.find(s => s.variant_id === parseInt(variantId));
  const destRecord = destStockList.find(s => s.variant_id === parseInt(variantId));

  const sourceQty = sourceRecord ? sourceRecord.current_quantity : 0;
  const destQty = destRecord ? destRecord.current_quantity : 0;

  const postSourceQty = Math.max(0, sourceQty - parseInt(quantity || 0));
  const postDestQty = destQty + parseInt(quantity || 0);

  const handleTransfer = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (sourceLocId === destLocId) {
      setErrorMsg("Source and Destination hubs must be different.");
      return;
    }

    if (parseInt(quantity) > sourceQty) {
      setErrorMsg(`Transfer quantity exceeds source hub available stock (${sourceQty} units).`);
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/inventory/transfer', {
        source_location_id: parseInt(sourceLocId),
        destination_location_id: parseInt(destLocId),
        variant_id: parseInt(variantId),
        quantity: parseInt(quantity),
        reason: reason
      });

      setSuccessMsg(`Transferred ${res.data.quantity} units of ${res.data.item_name} (${res.data.variant_name}) from ${res.data.source_location} to ${res.data.destination_location}.`);
      fetchHubStocks();
      onTransferSubmit?.();
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || "Transfer failed. Please check inputs.");
    } finally {
      setLoading(false);
    }
  };

  const allVariants = items.flatMap(i => i.variants.map(v => ({ ...v, item_name: i.name, category: i.category })));

  return (
    <div className="space-y-6 w-full font-sans pb-12">
      
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-[#e6e0f3] shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-[#1b003a] flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-[#6700ce]" />
            Inter-Hub Stock Transfer Terminal
          </h1>
          <p className="text-xs text-slate-500 mt-1">Rebalance inventory across Delhi, Mumbai, and Bangalore hubs in real-time.</p>
        </div>
        <span className="text-xs font-bold px-3 py-1 rounded-full bg-purple-50 text-[#6700ce] border border-purple-200">
          Central Admin Exclusive
        </span>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleTransfer} className="bg-white rounded-2xl p-6 border border-[#e6e0f3] shadow-sm space-y-6 w-full">
        
        {/* Hub Selection Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Source Hub */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              Source Hub (Outbound)
            </label>
            <select
              value={sourceLocId}
              onChange={(e) => setSourceLocId(parseInt(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#1b003a] text-xs font-semibold focus:outline-none focus:border-[#e20d65]"
            >
              {locations.map(loc => (
                <option key={loc.location_id} value={loc.location_id}>
                  {loc.name} ({loc.city})
                </option>
              ))}
            </select>
          </div>

          {/* Destination Hub */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              Destination Hub (Inbound)
            </label>
            <select
              value={destLocId}
              onChange={(e) => setDestLocId(parseInt(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#1b003a] text-xs font-semibold focus:outline-none focus:border-[#e20d65]"
            >
              {locations.map(loc => (
                <option key={loc.location_id} value={loc.location_id} disabled={loc.location_id === sourceLocId}>
                  {loc.name} ({loc.city})
                </option>
              ))}
            </select>
          </div>

        </div>

        {/* Item & Quantity Selector */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-xs">
          <div className="md:col-span-8">
            <label className="block font-bold text-slate-700 mb-1.5">Select Item & Variant (SKU)</label>
            <select
              value={variantId}
              onChange={(e) => setVariantId(parseInt(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#1b003a] font-semibold focus:outline-none focus:border-[#e20d65]"
            >
              {allVariants.map(v => (
                <option key={v.variant_id} value={v.variant_id}>
                  {v.item_name} - Variant: {v.variant_name} ({v.category})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4">
            <label className="block font-bold text-slate-700 mb-1.5">Transfer Quantity</label>
            <input
              type="number"
              min="1"
              max={sourceQty}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#1b003a] font-black focus:outline-none focus:border-[#e20d65]"
            />
          </div>
        </div>

        {/* Side-by-side Live Stock Preview Cards */}
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Live Stock Impact Preview</p>
          
          <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center">
            
            {/* Source Card */}
            <div className="md:col-span-5 p-4 rounded-xl bg-white border border-slate-200 text-center shadow-sm">
              <p className="text-[11px] font-bold text-slate-500">SOURCE: {locations.find(l => l.location_id === sourceLocId)?.name}</p>
              <div className="mt-2 flex items-center justify-center gap-3">
                <div>
                  <p className="text-2xl font-black text-[#1b003a]">{sourceQty}</p>
                  <p className="text-[10px] text-slate-400">Current</p>
                </div>
                <ArrowRight className="w-4 h-4 text-rose-500" />
                <div>
                  <p className="text-2xl font-black text-rose-600">{postSourceQty}</p>
                  <p className="text-[10px] text-slate-400">Post Transfer</p>
                </div>
              </div>
            </div>

            {/* Center Arrow Indicator */}
            <div className="md:col-span-1 flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-purple-100 border border-purple-200 flex items-center justify-center text-[#6700ce]">
                <ArrowLeftRight className="w-5 h-5" />
              </div>
            </div>

            {/* Destination Card */}
            <div className="md:col-span-5 p-4 rounded-xl bg-white border border-slate-200 text-center shadow-sm">
              <p className="text-[11px] font-bold text-slate-500">DESTINATION: {locations.find(l => l.location_id === destLocId)?.name}</p>
              <div className="mt-2 flex items-center justify-center gap-3">
                <div>
                  <p className="text-2xl font-black text-[#1b003a]">{destQty}</p>
                  <p className="text-[10px] text-slate-400">Current</p>
                </div>
                <ArrowRight className="w-4 h-4 text-emerald-500" />
                <div>
                  <p className="text-2xl font-black text-emerald-600">{postDestQty}</p>
                  <p className="text-[10px] text-slate-400">Post Transfer</p>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Reason Input */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">Transfer Reason / Audit Tag</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Demand spike in Mumbai hub"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#1b003a] text-xs focus:outline-none focus:border-[#e20d65]"
          />
        </div>

        {/* Submit Action */}
        <button
          type="submit"
          disabled={loading || sourceLocId === destLocId || quantity > sourceQty}
          className="w-full py-3.5 rounded-xl btn-tata-magenta font-extrabold text-sm shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <ArrowLeftRight className="w-4 h-4" />
          <span>{loading ? 'Executing Transfer...' : 'Confirm & Execute Inter-Hub Transfer'}</span>
        </button>

      </form>

    </div>
  );
};
