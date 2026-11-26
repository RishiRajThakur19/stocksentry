import React, { useState, useEffect } from 'react';
import {
  ShoppingBag, Send, CheckCircle2, XCircle, PackageCheck,
  AlertTriangle, Search, User, RefreshCw, Plus, Minus, Trash2, ShoppingCart
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export const FieldRequisitionsPage = () => {
  const { user } = useAuth();
  const isFieldWorker = user?.role === 'FIELD_WORKER';
  const isReviewer = ['MANAGER', 'LOCATION_MANAGER', 'REGIONAL_ADMIN', 'SUPER_ADMIN', 'CENTRAL_ADMIN'].includes(user?.role);

  const [techTab, setTechTab] = useState('CATALOG'); // 'CATALOG' | 'MY_REQUESTS'
  const [requisitions, setRequisitions] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [catalogCategory, setCatalogCategory] = useState('ALL');
  const [catalogSearch, setCatalogSearch] = useState('');

  // Storefront Cart State (for Field Technicians)
  const [selectedVariantByItem, setSelectedVariantByItem] = useState({}); // { item_id: variant_id }
  const [qtyByItem, setQtyByItem] = useState({}); // { item_id: qty }
  const [cart, setCart] = useState([]); // [{ variant_id, item_name, variant_name, is_serialized, quantity }]
  const [urgency, setUrgency] = useState('NORMAL');
  const [targetApprover, setTargetApprover] = useState('BOTH');
  const [notes, setNotes] = useState('');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [reqRes, itemsRes] = await Promise.all([
        api.get('/field-requisitions'),
        api.get('/inventory/items')
      ]);
      setRequisitions(reqRes.data || []);
      const rawItems = itemsRes.data || [];
      setItems(rawItems);

      const defaults = {};
      rawItems.forEach((it) => {
        if (it.variants?.length > 0) {
          defaults[it.item_id] = it.variants[0].variant_id;
        }
      });
      setSelectedVariantByItem((prev) => ({ ...defaults, ...prev }));
    } catch (err) {
      console.error('Failed to load field requisitions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const categories = ['ALL', ...Array.from(new Set(items.map((i) => i.category || 'General')))];
  const filteredCatalog = items.filter((it) => {
    const matchesCat = catalogCategory === 'ALL' || (it.category || 'General') === catalogCategory;
    const q = catalogSearch.toLowerCase();
    const matchesSearch = !q || (it.name || '').toLowerCase().includes(q) || (it.category || '').toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  const addToRequestBasket = (item) => {
    const variantId = selectedVariantByItem[item.item_id] || item.variants?.[0]?.variant_id;
    const variant = item.variants?.find((v) => v.variant_id === variantId);
    if (!variant) return;
    const qty = Math.max(1, parseInt(qtyByItem[item.item_id] || 1, 10));

    setCart((prev) => {
      const existing = prev.find((c) => c.variant_id === variant.variant_id);
      if (existing) {
        return prev.map((c) => (c.variant_id === variant.variant_id ? { ...c, quantity: c.quantity + qty } : c));
      }
      return [
        ...prev,
        {
          variant_id: variant.variant_id,
          item_name: item.name,
          variant_name: variant.variant_name,
          is_serialized: !!item.is_serialized,
          quantity: qty,
        }
      ];
    });
  };

  const handleSubmitBasket = async (e) => {
    e.preventDefault();
    if (cart.length === 0) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const created = [];
      for (const entry of cart) {
        const res = await api.post('/field-requisitions', {
          variant_id: entry.variant_id,
          quantity_requested: entry.quantity,
          urgency,
          target_approver: targetApprover,
          notes: notes.trim() || null,
        });
        created.push(res.data);
      }
      setRequisitions((prev) => [...created, ...prev]);
      setCart([]);
      setNotes('');
      setFeedback({
        type: 'success',
        text: `Submitted ${created.length} request(s) to ${targetApprover === 'BOTH' ? 'City Manager & Regional Admin' : targetApprover.replace('_', ' ')}.`
      });
      setTechTab('MY_REQUESTS');
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to submit requisition.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewAction = async (reqId, action, extraPayload = {}) => {
    setActionLoadingId(reqId);
    setFeedback(null);
    try {
      const res = await api.put(`/field-requisitions/${reqId}/${action}`, extraPayload);
      setRequisitions((prev) => prev.map((r) => (r.requisition_id === reqId ? res.data : r)));
      setFeedback({
        type: 'success',
        text: action === 'fulfill'
          ? `Request #${reqId} ${res.data.status === 'PARTIALLY_FULFILLED' ? `partially fulfilled (${res.data.quantity_fulfilled}/${res.data.quantity_requested})` : 'fulfilled & assigned'} to ${res.data.requester_name}!`
          : action === 'approve'
          ? `Request #${reqId} approved.`
          : action === 'cancel'
          ? `Request #${reqId} cancelled.`
          : `Request #${reqId} rejected.`
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.detail || `Failed to ${action} request.`
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredRequisitions = requisitions.filter((r) => {
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      (r.item_name || '').toLowerCase().includes(q) ||
      (r.variant_name || '').toLowerCase().includes(q) ||
      (r.requester_name || '').toLowerCase().includes(q) ||
      (r.location_name || '').toLowerCase().includes(q) ||
      (r.notes || '').toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const pendingCount = requisitions.filter((r) => r.status === 'PENDING').length;
  const approvedCount = requisitions.filter((r) => r.status === 'APPROVED').length;
  const fulfilledCount = requisitions.filter((r) => r.status === 'FULFILLED').length;

  const statusBadge = (st) => {
    if (st === 'FULFILLED') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (st === 'APPROVED') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    if (st === 'REJECTED') return 'bg-rose-50 text-rose-700 border-rose-200';
    return 'bg-amber-50 text-amber-700 border-amber-200';
  };

  const urgencyBadge = (u) => {
    if (u === 'CRITICAL') return 'bg-rose-100 text-rose-800 border-rose-300';
    if (u === 'URGENT') return 'bg-orange-100 text-orange-800 border-orange-300';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  return (
    <div className="space-y-5 font-sans w-full max-w-[1600px] mx-auto pb-16">
      {/* Header */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-[#1c023d] text-white flex items-center justify-center shrink-0">
              <ShoppingBag className="w-4 h-4 text-[#e20d65]" />
            </div>
            <h1 className="text-xl md:text-2xl font-black text-[#1c023d] tracking-tight">
              {isFieldWorker ? 'Field Gear & Equipment Portal' : 'Field Technician Requests Queue'}
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            {isFieldWorker
              ? 'Browse T-shirts (pick size), modems, splicers, and safety gear — add to your request basket and send to both City Manager & Regional Admin.'
              : 'Review, approve, and fulfill equipment & uniform requests from field technicians.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isFieldWorker && (
            <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-extrabold">
              <button
                type="button"
                onClick={() => setTechTab('CATALOG')}
                className={`px-3.5 py-2 rounded-lg transition ${
                  techTab === 'CATALOG' ? 'bg-[#e20d65] text-white shadow-xs' : 'text-slate-600'
                }`}
              >
                Order Gear & Machines
              </button>
              <button
                type="button"
                onClick={() => setTechTab('MY_REQUESTS')}
                className={`px-3.5 py-2 rounded-lg transition ${
                  techTab === 'MY_REQUESTS' ? 'bg-[#1c023d] text-white shadow-xs' : 'text-slate-600'
                }`}
              >
                My Requests ({requisitions.length})
              </button>
            </div>
          )}

          <button
            onClick={fetchAll}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* FIELD WORKER: VISUAL CATALOG + BASKET */}
      {isFieldWorker && techTab === 'CATALOG' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Product Cards */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Search T-shirt, modem, splicer, safety vest..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCatalogCategory(cat)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition ${
                      catalogCategory === cat ? 'bg-[#1c023d] text-white border-[#1c023d]' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredCatalog.map((item) => {
                const activeVarId = selectedVariantByItem[item.item_id] || item.variants?.[0]?.variant_id;
                const qty = qtyByItem[item.item_id] || 1;
                return (
                  <div key={item.item_id} className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between space-y-3 hover:border-purple-300 transition">
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-purple-50 text-[#6700ce] border border-purple-200">
                          {item.category}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          {item.is_serialized ? 'Machine / Serialized' : 'Supply / Uniform'}
                        </span>
                      </div>

                      <h3 className="text-sm font-black text-[#1c023d]">{item.name}</h3>

                      {/* Size / Model Variant Pills */}
                      <div className="flex flex-wrap gap-1.5">
                        {(item.variants || []).map((v) => (
                          <button
                            key={v.variant_id}
                            type="button"
                            onClick={() => setSelectedVariantByItem((prev) => ({ ...prev, [item.item_id]: v.variant_id }))}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition ${
                              activeVarId === v.variant_id
                                ? 'bg-[#1c023d] text-white border-[#1c023d]'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {v.variant_name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setQtyByItem((prev) => ({ ...prev, [item.item_id]: Math.max(1, qty - 1) }))}
                          className="w-7 h-7 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center font-mono font-black text-xs">{qty}</span>
                        <button
                          type="button"
                          onClick={() => setQtyByItem((prev) => ({ ...prev, [item.item_id]: qty + 1 }))}
                          className="w-7 h-7 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => addToRequestBasket(item)}
                        className="px-3.5 py-2 rounded-lg bg-[#e20d65] hover:bg-[#cc0059] text-white font-extrabold text-xs transition flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add to Request</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Sticky Request Basket */}
          <form onSubmit={handleSubmitBasket} className="lg:col-span-4 bg-white rounded-xl p-5 border border-slate-200 shadow-xs h-fit space-y-4 sticky top-20">
            <h2 className="text-sm font-black text-[#1c023d] uppercase tracking-wider flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-[#e20d65]" />
              <span>Request Basket ({cart.length})</span>
            </h2>

            {cart.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                Pick a T-shirt size or machine on the left and click <strong>+ Add to Request</strong>.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {cart.map((c) => (
                  <div key={c.variant_id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-xs">
                    <div>
                      <div className="font-black text-[#1c023d]">{c.quantity} × {c.item_name}</div>
                      <div className="text-[11px] text-slate-500">{c.variant_name}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCart((prev) => prev.filter((x) => x.variant_id !== c.variant_id))}
                      className="text-rose-500 hover:text-rose-700 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3 text-xs pt-2 border-t border-slate-100">
              <div>
                <label className="block font-extrabold text-slate-700 mb-1">Priority</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {['NORMAL', 'URGENT', 'CRITICAL'].map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUrgency(u)}
                      className={`py-1.5 rounded-lg font-bold border text-[11px] ${
                        urgency === u ? 'bg-[#1c023d] text-white border-[#1c023d]' : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-extrabold text-slate-700 mb-1">Send Request To</label>
                <select
                  value={targetApprover}
                  onChange={(e) => setTargetApprover(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-purple-50 border border-purple-200 font-bold text-[#1c023d]"
                >
                  <option value="BOTH">Both City Manager & Regional Admin</option>
                  <option value="CITY_MANAGER">City Hub Manager Only</option>
                  <option value="REGIONAL_ADMIN">Regional Admin Only</option>
                </select>
              </div>

              <div>
                <label className="block font-extrabold text-slate-700 mb-1">Notes / Size / Reason</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Need Size L T-shirt & backup modem for Saket zone"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || cart.length === 0}
                className="w-full py-3 rounded-xl bg-[#e20d65] hover:bg-[#cc0059] disabled:opacity-50 text-white font-extrabold shadow-sm transition flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? 'Submitting...' : `Submit ${cart.length} Request(s)`}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* REQUISITIONS QUEUE (FOR REVIEWERS OR TECH 'MY_REQUESTS') */}
      {(isReviewer || techTab === 'MY_REQUESTS') && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
              <div className="text-[11px] font-bold text-slate-400 uppercase">Pending Review</div>
              <div className="text-2xl font-black text-amber-600 mt-1">{pendingCount}</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
              <div className="text-[11px] font-bold text-slate-400 uppercase">Approved</div>
              <div className="text-2xl font-black text-indigo-600 mt-1">{approvedCount}</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
              <div className="text-[11px] font-bold text-slate-400 uppercase">Fulfilled & Assigned</div>
              <div className="text-2xl font-black text-emerald-600 mt-1">{fulfilledCount}</div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-sm font-black text-[#1c023d] uppercase tracking-wider">
                {isFieldWorker ? 'My Submitted Requests' : 'Incoming Field Worker Requests'}
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search item, worker, city..."
                    className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 font-medium"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 font-bold"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="FULFILLED">Fulfilled</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400 font-bold">Loading requests...</div>
            ) : filteredRequisitions.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                No field requests found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 uppercase">
                    <tr>
                      <th className="py-2.5 px-3">ID & Status</th>
                      <th className="py-2.5 px-3">Worker & Hub</th>
                      <th className="py-2.5 px-3">Requested Item & Size/Model</th>
                      <th className="py-2.5 px-3">Routed To</th>
                      <th className="py-2.5 px-3">Notes</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRequisitions.map((r) => {
                      const remaining = Math.max(0, r.quantity_requested - (r.quantity_fulfilled || 0));
                      return (
                      <tr key={r.requisition_id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-3 space-y-1">
                          <div className="font-mono font-black text-slate-500">REQ-{r.requisition_id}</div>
                          <div className="flex flex-wrap gap-1">
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${statusBadge(r.status)}`}>
                              {r.status}{r.status === 'PARTIALLY_FULFILLED' ? ` (${r.quantity_fulfilled}/${r.quantity_requested})` : ''}
                            </span>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${urgencyBadge(r.urgency)}`}>{r.urgency}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-black text-[#1c023d]">{r.requester_name}</div>
                          <div className="text-[11px] text-slate-500">{r.location_name}</div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-black text-slate-900">{r.quantity_requested} × {r.item_name}</div>
                          <div className="text-[11px] text-slate-500">{r.variant_name}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                            {r.target_approver === 'BOTH' ? 'City Manager & Regional Admin' : r.target_approver.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 max-w-xs truncate">{r.notes || '—'}</td>
                        <td className="py-3 px-3 text-right">
                          {isReviewer && ['PENDING', 'APPROVED', 'PARTIALLY_FULFILLED'].includes(r.status) ? (
                            <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                              {r.status === 'PENDING' && (
                                <button
                                  onClick={() => handleReviewAction(r.requisition_id, 'approve')}
                                  disabled={actionLoadingId === r.requisition_id}
                                  className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                                >
                                  Approve
                                </button>
                              )}
                              <button
                                onClick={() => handleReviewAction(r.requisition_id, 'fulfill')}
                                disabled={actionLoadingId === r.requisition_id}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                              >
                                Fulfill ({remaining})
                              </button>
                              {remaining > 1 && (
                                <button
                                  onClick={() => {
                                    const qtyStr = window.prompt(`Partial fulfill quantity (1 to ${remaining}):`, String(Math.max(1, Math.floor(remaining / 2))));
                                    if (!qtyStr) return;
                                    const q = parseInt(qtyStr, 10);
                                    if (q >= 1 && q <= remaining) {
                                      handleReviewAction(r.requisition_id, 'fulfill', { fulfill_quantity: q, create_hub_refill_for_shortage: true });
                                    }
                                  }}
                                  disabled={actionLoadingId === r.requisition_id}
                                  className="px-2 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold"
                                  title="Partially fulfill and create hub refill request for shortage"
                                >
                                  Partial
                                </button>
                              )}
                              <button
                                onClick={() => handleReviewAction(r.requisition_id, 'reject')}
                                disabled={actionLoadingId === r.requisition_id}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold"
                              >
                                Reject
                              </button>
                            </div>
                          ) : isFieldWorker && r.status === 'PENDING' ? (
                            <button
                              onClick={() => handleReviewAction(r.requisition_id, 'cancel')}
                              disabled={actionLoadingId === r.requisition_id}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold"
                            >
                              Cancel Request
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-semibold">
                              {r.reviewer_name ? `By ${r.reviewer_name}` : r.status}
                            </span>
                          )}
                        </td>
                      </tr>
                    );})}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
