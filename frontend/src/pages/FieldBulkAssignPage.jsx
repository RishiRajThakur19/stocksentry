import React, { useState, useEffect } from 'react';
import {
  Users, Package, Send, CheckCircle2, AlertTriangle, Plus, Minus,
  Zap, Search, RefreshCw, X, Trash2, Shirt, Cpu, Wrench, Cable
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export const FieldBulkAssignPage = () => {
  const { user } = useAuth();
  const isRegionalOrSuper = ['REGIONAL_ADMIN', 'SUPER_ADMIN', 'CENTRAL_ADMIN'].includes(user?.role);

  const [mode, setMode] = useState('WORKERS'); // 'WORKERS' | 'BATCH'
  const [items, setItems] = useState([]);
  const [variants, setVariants] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [recentAssignments, setRecentAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [cityFilter, setCityFilter] = useState('ALL');
  const [techSearch, setTechSearch] = useState('');

  // Per-worker Kit Drawer state
  const [activeWorker, setActiveWorker] = useState(null);
  const [workerHoldings, setWorkerHoldings] = useState(null);
  const [kitCategory, setKitCategory] = useState('ALL');
  const [kitItemSearch, setKitItemSearch] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [selectedQty, setSelectedQty] = useState(1);
  const [serialMode, setSerialMode] = useState('AUTO'); // 'AUTO' | 'SPECIFIC'
  const [availableSerials, setAvailableSerials] = useState([]);
  const [selectedSerialId, setSelectedSerialId] = useState('');
  const [kitCart, setKitCart] = useState([]); // [{ variant_id, item_name, variant_name, is_serialized, quantity, asset_ids, serial_label }]
  const [kitNotes, setKitNotes] = useState('');

  // Batch Distribute state
  const [batchCategory, setBatchCategory] = useState('ALL');
  const [batchVariantId, setBatchVariantId] = useState('');
  const [allocations, setAllocations] = useState({});
  const [batchTargetTotal, setBatchTargetTotal] = useState(50);
  const [autoFulfillReqs, setAutoFulfillReqs] = useState(true);
  const [batchNotes, setBatchNotes] = useState('');

  const [resultBanner, setResultBanner] = useState(null);
  const [errorBanner, setErrorBanner] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [stockRes, itemsRes, techRes, recentRes] = await Promise.all([
        api.get('/inventory/stock'),
        api.get('/inventory/items'),
        api.get('/field-requisitions/technicians'),
        api.get('/field-requisitions/my-consumables')
      ]);

      const stockMap = {};
      (stockRes.data || []).forEach((s) => {
        stockMap[s.variant_id] = s.current_quantity;
      });

      const rawItems = itemsRes.data || [];
      const flatVariants = [];
      rawItems.forEach((item) => {
        (item.variants || []).forEach((v) => {
          flatVariants.push({
            item_id: item.item_id,
            variant_id: v.variant_id,
            item_name: item.name,
            variant_name: v.variant_name,
            category: item.category || 'General',
            is_serialized: !!item.is_serialized,
            available_stock: stockMap[v.variant_id] ?? v.stock_quantity ?? 0,
          });
        });
      });

      setItems(rawItems);
      setVariants(flatVariants);
      setTechnicians(techRes.data || []);
      setRecentAssignments(recentRes.data || []);

      if (flatVariants.length > 0 && !batchVariantId) {
        const tshirt = flatVariants.find((v) => v.item_name.toLowerCase().includes('t-shirt') || v.item_name.toLowerCase().includes('tshirt'));
        setBatchVariantId(String((tshirt || flatVariants[0]).variant_id));
      }
      if (rawItems.length > 0 && !selectedItemId) {
        setSelectedItemId(String(rawItems[0].item_id));
        if (rawItems[0].variants?.length > 0) {
          setSelectedVariantId(String(rawItems[0].variants[0].variant_id));
        }
      }
    } catch (err) {
      console.error('Failed to load bulk assign data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch available serials when a serialized variant is selected in the Worker Kit Drawer
  useEffect(() => {
    const v = variants.find((x) => String(x.variant_id) === String(selectedVariantId));
    if (activeWorker && v && v.is_serialized) {
      api.get(`/inventory/variants/${v.variant_id}/assets`)
        .then((res) => {
          const free = (res.data || []).filter(
            (a) => !a.current_holder_id && ['IN_WAREHOUSE', 'DISPATCHED'].includes(a.status)
          );
          setAvailableSerials(free);
          setSelectedSerialId(free.length > 0 ? String(free[0].asset_id) : '');
        })
        .catch(() => setAvailableSerials([]));
    } else {
      setAvailableSerials([]);
      setSelectedSerialId('');
    }
  }, [activeWorker, selectedVariantId]);

  const categories = ['ALL', ...Array.from(new Set(items.map((i) => i.category || 'General')))];
  const cities = ['ALL', ...Array.from(new Set(technicians.map((t) => t.location_name)))];

  const visibleTechs = technicians.filter((t) => {
    const matchesCity = cityFilter === 'ALL' || t.location_name === cityFilter;
    const q = techSearch.toLowerCase();
    const matchesSearch = !q || (t.name || '').toLowerCase().includes(q) || (t.email || '').toLowerCase().includes(q) || (t.location_name || '').toLowerCase().includes(q);
    return matchesCity && matchesSearch;
  });

  // Worker Kit Drawer helpers
  const filteredKitItems = items.filter((it) => {
    const matchesCat = kitCategory === 'ALL' || (it.category || 'General') === kitCategory;
    const q = kitItemSearch.toLowerCase();
    const matchesSearch = !q || (it.name || '').toLowerCase().includes(q) || (it.category || '').toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  const activeKitItem = items.find((i) => String(i.item_id) === String(selectedItemId));
  const activeKitVariants = activeKitItem?.variants || [];
  const activeKitVariant = variants.find((v) => String(v.variant_id) === String(selectedVariantId));

  const openWorkerKit = (tech) => {
    setActiveWorker(tech);
    setWorkerHoldings(null);
    setKitCart([]);
    setKitNotes('');
    setErrorBanner(null);
    api.get(`/field-requisitions/technicians/${tech.user_id}/holdings`)
      .then((res) => setWorkerHoldings(res.data))
      .catch(() => setWorkerHoldings(null));
  };

  const handleSelectKitItem = (item) => {
    setSelectedItemId(String(item.item_id));
    if (item.variants?.length > 0) {
      setSelectedVariantId(String(item.variants[0].variant_id));
    }
    setSelectedQty(1);
    setSerialMode('AUTO');
  };

  const handleAddToKit = () => {
    if (!activeKitVariant) return;
    const qty = activeKitVariant.is_serialized && serialMode === 'SPECIFIC' ? 1 : Math.max(1, parseInt(selectedQty, 10) || 1);
    let assetIds = null;
    let serialLabel = activeKitVariant.is_serialized ? 'Auto-pick next available serial(s)' : null;

    if (activeKitVariant.is_serialized && serialMode === 'SPECIFIC') {
      if (!selectedSerialId) {
        setErrorBanner('No available serial number selected for this item.');
        return;
      }
      const serialObj = availableSerials.find((s) => String(s.asset_id) === String(selectedSerialId));
      assetIds = [parseInt(selectedSerialId, 10)];
      serialLabel = serialObj ? `SN: ${serialObj.serial_number}` : `Asset #${selectedSerialId}`;
    }

    setKitCart((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        variant_id: activeKitVariant.variant_id,
        item_name: activeKitVariant.item_name,
        variant_name: activeKitVariant.variant_name,
        is_serialized: activeKitVariant.is_serialized,
        quantity: qty,
        asset_ids: assetIds,
        serial_label: serialLabel,
      }
    ]);
  };

  const handleAssignWorkerKit = async () => {
    if (!activeWorker || kitCart.length === 0) return;
    setSubmitting(true);
    setErrorBanner(null);
    setResultBanner(null);
    try {
      const responses = [];
      for (const entry of kitCart) {
        const res = await api.post('/field-requisitions/bulk-assign', {
          variant_id: entry.variant_id,
          allocations: [{ user_id: activeWorker.user_id, quantity: entry.quantity }],
          asset_ids: entry.asset_ids,
          auto_assign_serials: !entry.asset_ids,
          auto_fulfill_requisitions: true,
          notes: kitNotes.trim() || `Assigned kit to ${activeWorker.name}`,
        });
        responses.push(res.data);
      }
      setResultBanner({
        message: `Assigned ${kitCart.length} item line(s) to ${activeWorker.name} (${activeWorker.location_name}).`,
        fulfilled_requisitions_count: responses.reduce((s, r) => s + (r.fulfilled_requisitions_count || 0), 0),
        results: responses.flatMap((r) => r.results || []),
      });
      setActiveWorker(null);
      setKitCart([]);
      await fetchData();
    } catch (err) {
      setErrorBanner(err.response?.data?.detail || 'Failed to assign kit to worker.');
    } finally {
      setSubmitting(false);
    }
  };

  // Batch Distribute helpers
  const batchVariants = variants.filter((v) => batchCategory === 'ALL' || v.category === batchCategory);
  const selectedBatchVariant = variants.find((v) => String(v.variant_id) === String(batchVariantId));
  const totalAllocated = Object.values(allocations).reduce((sum, q) => sum + (parseInt(q, 10) || 0), 0);

  const setTechQty = (userId, qty) => {
    setAllocations((prev) => ({ ...prev, [userId]: Math.max(0, parseInt(qty, 10) || 0) }));
  };

  const handleDistributeEach = (qtyPerTech) => {
    const next = { ...allocations };
    visibleTechs.forEach((t) => { next[t.user_id] = qtyPerTech; });
    setAllocations(next);
  };

  const handleSplitEvenly = () => {
    if (visibleTechs.length === 0) return;
    const total = Math.max(1, parseInt(batchTargetTotal, 10) || 0);
    const base = Math.floor(total / visibleTechs.length);
    let rem = total % visibleTechs.length;
    const next = { ...allocations };
    visibleTechs.forEach((t) => {
      next[t.user_id] = base + (rem > 0 ? 1 : 0);
      if (rem > 0) rem -= 1;
    });
    setAllocations(next);
  };

  const handleBatchSubmit = async (e) => {
    e.preventDefault();
    setErrorBanner(null);
    setResultBanner(null);
    const payloadAllocations = Object.entries(allocations)
      .map(([uid, qty]) => ({ user_id: parseInt(uid, 10), quantity: parseInt(qty, 10) || 0 }))
      .filter((a) => a.quantity > 0);

    if (payloadAllocations.length === 0) {
      setErrorBanner('Allocate at least 1 unit to at least one worker.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/field-requisitions/bulk-assign', {
        variant_id: parseInt(batchVariantId, 10),
        allocations: payloadAllocations,
        auto_assign_serials: true,
        auto_fulfill_requisitions: autoFulfillReqs,
        notes: batchNotes.trim() || null,
      });
      setResultBanner(res.data);
      setAllocations({});
      setBatchNotes('');
      await fetchData();
    } catch (err) {
      setErrorBanner(err.response?.data?.detail || 'Batch assignment failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 font-sans w-full max-w-[1600px] mx-auto pb-16">
      {/* Header + Mode Toggle */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-[#1c023d] text-white flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-[#e20d65]" />
            </div>
            <h1 className="text-xl md:text-2xl font-black text-[#1c023d] tracking-tight">
              Field Workforce Assignment Center
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            Assign modems, splicers, T-shirts (with size), or safety kits directly to field workers—either per-worker or in a bulk batch.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-extrabold">
            <button
              type="button"
              onClick={() => setMode('WORKERS')}
              className={`px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 ${
                mode === 'WORKERS' ? 'bg-[#1c023d] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Workers Directory (Assign Kit)</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('BATCH')}
              className={`px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 ${
                mode === 'BATCH' ? 'bg-[#e20d65] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Bulk Batch Distribute (e.g. 50 T-Shirts)</span>
            </button>
          </div>

          <button
            onClick={fetchData}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {errorBanner && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorBanner}</span>
        </div>
      )}

      {resultBanner && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-black text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{resultBanner.message}</span>
            </div>
            <button onClick={() => setResultBanner(null)} className="text-emerald-700 hover:text-emerald-900">
              <X className="w-4 h-4" />
            </button>
          </div>
          {resultBanner.fulfilled_requisitions_count > 0 && (
            <p className="text-xs font-bold text-emerald-700">
              Auto-fulfilled {resultBanner.fulfilled_requisitions_count} pending technician request(s).
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
            {(resultBanner.results || []).map((r, idx) => (
              <div key={`${r.user_id}-${idx}`} className="bg-white rounded-lg p-2.5 border border-emerald-200 text-xs">
                <div className="font-extrabold text-slate-900">{r.user_name} ({r.city_name})</div>
                <div className="font-bold text-emerald-700">Assigned: {r.quantity_assigned} unit(s)</div>
                {r.assigned_serials && r.assigned_serials.length > 0 && (
                  <div className="text-[10px] font-mono text-slate-500 mt-0.5 truncate" title={r.assigned_serials.join(', ')}>
                    Serials: {r.assigned_serials.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={techSearch}
            onChange={(e) => setTechSearch(e.target.value)}
            placeholder="Search field worker by name, email, or hub..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:border-[#e20d65]"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          {isRegionalOrSuper && (
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 font-bold text-slate-700"
            >
              {cities.map((c) => (
                <option key={c} value={c}>{c === 'ALL' ? 'All City Hubs' : c}</option>
              ))}
            </select>
          )}
          <span className="px-3 py-2 rounded-lg bg-purple-50 text-[#6700ce] font-extrabold border border-purple-200">
            {visibleTechs.length} Field Workers
          </span>
        </div>
      </div>

      {/* MODE 1: WORKERS DIRECTORY TABLE */}
      {mode === 'WORKERS' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 font-bold">Loading field workers...</div>
          ) : visibleTechs.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 font-semibold">No active field workers found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500 uppercase">
                  <tr>
                    <th className="py-3 px-4">Field Worker</th>
                    <th className="py-3 px-4">City Hub</th>
                    <th className="py-3 px-4">Assigned Machines / Modems</th>
                    <th className="py-3 px-4">Assigned Uniforms / Gear</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleTechs.map((tech) => (
                    <tr key={tech.user_id} className="hover:bg-purple-50/30 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-black text-[#1c023d] text-sm">{tech.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{tech.email}</div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-700">{tech.location_name}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-extrabold">
                          {tech.assigned_assets_count} Serialized
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold">
                          {tech.assigned_consumables_count} Gear / Tees
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => openWorkerKit(tech)}
                          className="px-3.5 py-2 rounded-lg bg-[#e20d65] hover:bg-[#cc0059] text-white font-extrabold text-xs shadow-xs transition inline-flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Assign Modem / T-Shirt / Gear</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODE 2: BULK BATCH DISTRIBUTE (1 ITEM -> MANY WORKERS) */}
      {mode === 'BATCH' && (
        <form onSubmit={handleBatchSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-4 bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-4 h-fit">
            <h2 className="text-sm font-black text-[#1c023d] uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-[#e20d65]" />
              <span>1. Choose Item & Size / Model</span>
            </h2>

            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setBatchCategory(cat);
                    const first = variants.find((v) => cat === 'ALL' || v.category === cat);
                    if (first) setBatchVariantId(String(first.variant_id));
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition ${
                    batchCategory === cat ? 'bg-[#1c023d] text-white border-[#1c023d]' : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-extrabold text-slate-700 mb-1">Product & Size / Variant</label>
                <select
                  value={batchVariantId}
                  onChange={(e) => setBatchVariantId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-300 font-semibold"
                  required
                >
                  {batchVariants.map((v) => (
                    <option key={v.variant_id} value={v.variant_id}>
                      {v.item_name} — {v.variant_name} ({v.is_serialized ? 'Serialized' : `Stock: ${v.available_stock}`})
                    </option>
                  ))}
                </select>
              </div>

              {selectedBatchVariant && (
                <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 space-y-1">
                  <div className="font-black text-[#1c023d]">{selectedBatchVariant.item_name}</div>
                  <div className="text-[11px] text-purple-700 font-semibold">
                    Variant / Size: {selectedBatchVariant.variant_name} ·{' '}
                    {selectedBatchVariant.is_serialized
                      ? 'Auto-assigns next available serials'
                      : `Available Stock: ${selectedBatchVariant.available_stock}`}
                  </div>
                </div>
              )}

              <div>
                <label className="block font-extrabold text-slate-700 mb-1">Batch Note</label>
                <input
                  type="text"
                  value={batchNotes}
                  onChange={(e) => setBatchNotes(e.target.value)}
                  placeholder="e.g., 50 T-Shirts New Batch Distribution"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 font-medium"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoFulfillReqs}
                  onChange={(e) => setAutoFulfillReqs(e.target.checked)}
                  className="rounded border-slate-300 text-[#e20d65]"
                />
                <span className="font-bold text-slate-700">Auto-fulfill matching pending requests</span>
              </label>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-500">Total Units Selected:</span>
                <span className="text-lg font-black text-[#1c023d]">{totalAllocated}</span>
              </div>
              <button
                type="submit"
                disabled={submitting || totalAllocated === 0}
                className="w-full py-3 rounded-xl bg-[#e20d65] hover:bg-[#cc0059] disabled:opacity-50 text-white font-extrabold text-xs shadow-sm transition flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? 'Distributing...' : `Assign ${totalAllocated} Unit(s) to Workers`}</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-8 bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-black text-[#1c023d] uppercase tracking-wider">
                2. Allocate Across Field Workers
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button type="button" onClick={() => handleDistributeEach(1)} className="px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-[#6700ce] border border-purple-200 font-bold">
                  1 Each
                </button>
                <button type="button" onClick={() => handleDistributeEach(2)} className="px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-[#6700ce] border border-purple-200 font-bold">
                  2 Each
                </button>
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                  <input
                    type="number"
                    min="1"
                    value={batchTargetTotal}
                    onChange={(e) => setBatchTargetTotal(e.target.value)}
                    className="w-12 bg-transparent font-mono font-bold text-center focus:outline-none"
                  />
                  <button type="button" onClick={handleSplitEvenly} className="px-2 py-0.5 rounded bg-[#1c023d] text-white font-bold text-[11px]">
                    Split Evenly
                  </button>
                </div>
                <button type="button" onClick={() => setAllocations({})} className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold">
                  Clear
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Worker</th>
                    <th className="py-2.5 px-3">Hub</th>
                    <th className="py-2.5 px-3">Current Holdings</th>
                    <th className="py-2.5 px-3 text-right">Assign Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleTechs.map((tech) => {
                    const qty = allocations[tech.user_id] || 0;
                    return (
                      <tr key={tech.user_id} className={qty > 0 ? 'bg-pink-50/40' : ''}>
                        <td className="py-2.5 px-3 font-black text-[#1c023d]">{tech.name}</td>
                        <td className="py-2.5 px-3 text-slate-600 font-semibold">{tech.location_name}</td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {tech.assigned_assets_count} serials · {tech.assigned_consumables_count} gear
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <button type="button" onClick={() => setTechQty(tech.user_id, qty - 1)} className="w-7 h-7 rounded bg-white border border-slate-300 flex items-center justify-center hover:bg-slate-100">
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={qty}
                              onChange={(e) => setTechQty(tech.user_id, e.target.value)}
                              className="w-12 h-7 text-center font-mono font-black rounded border border-slate-300 bg-white"
                            />
                            <button type="button" onClick={() => setTechQty(tech.user_id, qty + 1)} className="w-7 h-7 rounded bg-white border border-slate-300 flex items-center justify-center hover:bg-slate-100">
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </form>
      )}

      {/* PER-WORKER KIT ASSIGNMENT MODAL */}
      {activeWorker && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-5 bg-[#1c023d] text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black">Assign Equipment & Gear to {activeWorker.name}</h3>
                <p className="text-xs text-purple-200">{activeWorker.location_name} · {activeWorker.email}</p>
              </div>
              <button onClick={() => setActiveWorker(null)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto grid grid-cols-1 md:grid-cols-12 gap-5 flex-1">
              {/* Left: Item & Size/Model Picker */}
              <div className="md:col-span-7 space-y-4">
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setKitCategory(cat)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition ${
                        kitCategory === cat ? 'bg-[#1c023d] text-white border-[#1c023d]' : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={kitItemSearch}
                    onChange={(e) => setKitItemSearch(e.target.value)}
                    placeholder="Search modem, splicer, t-shirt..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold"
                  />
                </div>

                {/* Item Pills */}
                <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                  {filteredKitItems.map((it) => (
                    <button
                      key={it.item_id}
                      type="button"
                      onClick={() => handleSelectKitItem(it)}
                      className={`p-2.5 rounded-xl border text-left transition text-xs ${
                        String(selectedItemId) === String(it.item_id)
                          ? 'border-[#e20d65] bg-pink-50/50 ring-1 ring-[#e20d65]'
                          : 'border-slate-200 hover:border-purple-300 bg-white'
                      }`}
                    >
                      <div className="font-black text-[#1c023d] truncate">{it.name}</div>
                      <div className="text-[10px] text-slate-500 font-semibold">{it.category} · {it.is_serialized ? 'Machine/Serial' : 'Supply/Size'}</div>
                    </button>
                  ))}
                </div>

                {/* Variant / Size & Serial Selection */}
                {activeKitItem && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                    <div>
                      <label className="block font-extrabold text-slate-700 mb-1.5">
                        Select {activeKitItem.is_serialized ? 'Model / Variant' : 'Size / Variant'}
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {activeKitVariants.map((v) => (
                          <button
                            key={v.variant_id}
                            type="button"
                            onClick={() => setSelectedVariantId(String(v.variant_id))}
                            className={`px-3 py-1.5 rounded-lg font-bold border transition ${
                              String(selectedVariantId) === String(v.variant_id)
                                ? 'bg-[#6700ce] text-white border-[#6700ce]'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            {v.variant_name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {activeKitVariant?.is_serialized ? (
                      <div className="space-y-2">
                        <label className="block font-extrabold text-slate-700">Serial Number Selection</label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setSerialMode('AUTO')}
                            className={`flex-1 py-2 rounded-lg font-bold border ${
                              serialMode === 'AUTO' ? 'bg-[#1c023d] text-white border-[#1c023d]' : 'bg-white text-slate-600 border-slate-300'
                            }`}
                          >
                            Auto-Pick Next Available
                          </button>
                          <button
                            type="button"
                            onClick={() => setSerialMode('SPECIFIC')}
                            className={`flex-1 py-2 rounded-lg font-bold border ${
                              serialMode === 'SPECIFIC' ? 'bg-[#1c023d] text-white border-[#1c023d]' : 'bg-white text-slate-600 border-slate-300'
                            }`}
                          >
                            Pick Specific Serial ({availableSerials.length})
                          </button>
                        </div>

                        {serialMode === 'SPECIFIC' ? (
                          <select
                            value={selectedSerialId}
                            onChange={(e) => setSelectedSerialId(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 font-mono font-bold"
                          >
                            {availableSerials.length === 0 ? (
                              <option value="">No unassigned serials available</option>
                            ) : (
                              availableSerials.map((s) => (
                                <option key={s.asset_id} value={s.asset_id}>
                                  {s.serial_number} ({s.current_location_name || 'Warehouse'})
                                </option>
                              ))
                            )}
                          </select>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-600">Quantity:</span>
                            <input
                              type="number"
                              min="1"
                              max="20"
                              value={selectedQty}
                              onChange={(e) => setSelectedQty(e.target.value)}
                              className="w-16 px-2 py-1 rounded border border-slate-300 font-mono font-bold bg-white"
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-700">
                          Quantity (Available: {activeKitVariant?.available_stock ?? 0})
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button type="button" onClick={() => setSelectedQty(Math.max(1, selectedQty - 1))} className="w-7 h-7 rounded bg-white border border-slate-300 flex items-center justify-center">
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={selectedQty}
                            onChange={(e) => setSelectedQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-12 h-7 text-center font-mono font-black rounded border border-slate-300 bg-white"
                          />
                          <button type="button" onClick={() => setSelectedQty(selectedQty + 1)} className="w-7 h-7 rounded bg-white border border-slate-300 flex items-center justify-center">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleAddToKit}
                      className="w-full py-2.5 rounded-lg bg-[#1c023d] hover:bg-[#2d055f] text-white font-extrabold flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add to {activeWorker.name}'s Kit</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Right: Kit Summary Cart + Current Holdings */}
              <div className="md:col-span-5 bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  {/* Currently Held by Worker */}
                  <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1.5">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      Currently Held by {activeWorker.name}
                    </div>
                    {!workerHoldings ? (
                      <div className="text-[11px] text-slate-400">Loading current tools...</div>
                    ) : workerHoldings.serialized_assets.length === 0 && workerHoldings.consumables.length === 0 ? (
                      <div className="text-[11px] text-slate-400">No tools or gear assigned yet.</div>
                    ) : (
                      <div className="max-h-28 overflow-y-auto space-y-1.5 text-[11px]">
                        {workerHoldings.serialized_assets.map((a) => (
                          <div key={a.asset_id} className="flex items-center justify-between gap-2 text-slate-700">
                            <div className="min-w-0">
                              <span className="font-bold truncate block">{a.item_name}</span>
                              <span className="font-mono text-[10px] text-purple-700">{a.serial_number} · {a.tech_delivery_status === 'DISPATCHED' ? 'Pending Confirm' : 'Confirmed'}</span>
                            </div>
                            <button
                              type="button"
                              onClick={async () => {
                                await api.post(`/field-requisitions/return-asset/${a.asset_id}`);
                                openWorkerKit(activeWorker);
                                fetchData();
                              }}
                              className="px-2 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[10px] shrink-0"
                            >
                              Return
                            </button>
                          </div>
                        ))}
                        {workerHoldings.consumables.map((c) => (
                          <div key={c.assignment_id} className="flex items-center justify-between gap-2 text-slate-600">
                            <div className="min-w-0">
                              <span className="truncate block">{c.quantity}× {c.item_name} ({c.variant_name})</span>
                              <span className="text-[10px] text-slate-400">{c.delivery_status === 'DELIVERED' ? 'Delivered' : 'Pending Confirm'}</span>
                            </div>
                            <button
                              type="button"
                              onClick={async () => {
                                await api.post(`/field-requisitions/return-consumable/${c.assignment_id}`);
                                openWorkerKit(activeWorker);
                                fetchData();
                              }}
                              className="px-2 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[10px] shrink-0"
                            >
                              Return
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <h4 className="text-xs font-black text-[#1c023d] uppercase tracking-wider">
                    Assignment Kit ({kitCart.length} item(s))
                  </h4>
                  {kitCart.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400 border border-dashed border-slate-300 rounded-lg">
                      Select a modem, splicer, or T-shirt size on the left and click "Add to Kit".
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {kitCart.map((c) => (
                        <div key={c.id} className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-start justify-between gap-2 text-xs">
                          <div>
                            <div className="font-black text-[#1c023d]">{c.quantity} × {c.item_name}</div>
                            <div className="text-[11px] text-slate-500">{c.variant_name}</div>
                            {c.serial_label && <div className="text-[10px] font-mono text-purple-700">{c.serial_label}</div>}
                          </div>
                          <button
                            type="button"
                            onClick={() => setKitCart((prev) => prev.filter((x) => x.id !== c.id))}
                            className="text-rose-500 hover:text-rose-700 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3 pt-3 border-t border-slate-200 text-xs">
                  <input
                    type="text"
                    value={kitNotes}
                    onChange={(e) => setKitNotes(e.target.value)}
                    placeholder="Optional note (e.g., Onboarding kit)"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300"
                  />
                  <button
                    type="button"
                    disabled={submitting || kitCart.length === 0}
                    onClick={handleAssignWorkerKit}
                    className="w-full py-3 rounded-xl bg-[#e20d65] hover:bg-[#cc0059] disabled:opacity-50 text-white font-extrabold shadow-sm transition flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>{submitting ? 'Assigning...' : `Confirm & Assign to ${activeWorker.name}`}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Bulk Supply Distributions */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-3">
        <h2 className="text-sm font-black text-[#1c023d] uppercase tracking-wider">
          Recent Field Gear & Supply Assignments
        </h2>
        {recentAssignments.length === 0 ? (
          <p className="text-xs text-slate-400">No supply assignments recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                  <th className="py-2 pr-3">Worker</th>
                  <th className="py-2 pr-3">Item & Size/Variant</th>
                  <th className="py-2 pr-3">Qty</th>
                  <th className="py-2 pr-3">Hub</th>
                  <th className="py-2 pr-3">Assigned By</th>
                  <th className="py-2 pr-3">Delivery</th>
                  <th className="py-2">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentAssignments.slice(0, 12).map((a) => (
                  <tr key={a.assignment_id}>
                    <td className="py-2 pr-3 font-bold text-slate-900">{a.technician_name}</td>
                    <td className="py-2 pr-3">{a.item_name} ({a.variant_name})</td>
                    <td className="py-2 pr-3 font-mono font-black text-[#e20d65]">{a.quantity}</td>
                    <td className="py-2 pr-3 text-slate-600">{a.location_name}</td>
                    <td className="py-2 pr-3 text-slate-600">{a.assigner_name}</td>
                    <td className="py-2 pr-3">
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${
                        a.delivery_status === 'DELIVERED'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {a.delivery_status === 'DELIVERED' ? 'Delivered' : 'Pending Confirm'}
                      </span>
                    </td>
                    <td className="py-2 text-slate-400">{new Date(a.assigned_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
