import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../api/client';
import { CreateProductModal } from '../components/CreateProductModal';
import { AlertsFeed } from '../components/AlertsFeed';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  Cell
} from 'recharts';
import { 
  Building2, 
  Package, 
  CheckCircle2, 
  XCircle, 
  ShoppingCart, 
  TrendingUp, 
  TrendingDown,
  Search, 
  Plus, 
  Calendar, 
  Truck,
  Warehouse,
  Flame,
  ArrowRight,
  AlertTriangle,
  Clock,
  MapPin,
  RefreshCw,
  Boxes,
  ShieldCheck,
  ExternalLink,
  Activity,
  Layers,
  ArrowUpRight,
  X
} from 'lucide-react';

export const AdminDashboard = ({ refreshTrigger, setActiveTab }) => {
  const [summary, setSummary] = useState(null);
  const [stock, setStock] = useState([]);
  const [locations, setLocations] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Active Tab in Action Center: 'pending_requests' | 'in_transit' | 'low_stock_refill'
  const [actionTab, setActionTab] = useState('pending_requests');
  const [searchFilter, setSearchFilter] = useState('');

  // Modals
  const [isCreateProductOpen, setIsCreateProductOpen] = useState(false);
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [selectedRestockVariantId, setSelectedRestockVariantId] = useState('');
  const [restockQty, setRestockQty] = useState(100);
  const [restockSupplier, setRestockSupplier] = useState('Syrotech Networking Systems');
  const [restockSubmitting, setRestockSubmitting] = useState(false);

  // Toast feedback
  const [toastMsg, setToastMsg] = useState(null);

  const showToast = (type, text) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const fetchData = useCallback(async () => {
    try {
      const [sumRes, stockRes, locRes, alertRes, reqRes] = await Promise.all([
        api.get('/analytics/summary'),
        api.get('/inventory/stock'),
        api.get('/inventory/locations'),
        api.get('/alerts'),
        api.get('/requests')
      ]);

      setSummary(sumRes.data);
      setStock(stockRes.data);
      setLocations(locRes.data);
      setAlerts(alertRes.data);
      setRequests(reqRes.data);
    } catch (err) {
      console.error("Failed to fetch admin dashboard data", err);
      showToast('error', 'Failed to synchronize central warehouse data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Quick Action: Approve Request
  const handleApproveRequest = async (id, reqLocationName, itemName) => {
    try {
      await api.put(`/requests/${id}/approve`);
      showToast('success', `Approved Request #${id} for ${reqLocationName} (${itemName}).`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to approve request.');
    }
  };

  // Quick Action: Reject Request
  const handleRejectRequest = async (id) => {
    if (!window.confirm(`Decline and reject Request #${id}?`)) return;
    try {
      await api.put(`/requests/${id}/reject`);
      showToast('info', `Request #${id} rejected.`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to reject request.');
    }
  };

  // Quick Action: Inbound Restock Submit
  const handleRestockSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRestockVariantId || restockQty <= 0) return;
    setRestockSubmitting(true);
    try {
      await api.post('/inventory/receive', {
        variant_id: parseInt(selectedRestockVariantId),
        quantity_received: parseInt(restockQty),
        supplier_name: restockSupplier
      });
      showToast('success', `Inbound restock of +${restockQty} units received into Central Warehouse.`);
      setIsRestockModalOpen(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to receive restock.');
    } finally {
      setRestockSubmitting(false);
    }
  };

  const handleUpdateAlertStatus = async (alertId, status) => {
    try {
      await api.put(`/alerts/${alertId}/status`, { status });
      showToast('info', `Alert #${alertId} updated to ${status}.`);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Derived datasets
  const pendingRequests = useMemo(() => requests.filter(r => r.status === 'PENDING'), [requests]);
  const dispatchedRequests = useMemo(() => requests.filter(r => r.status === 'DISPATCHED'), [requests]);
  const lowStockItems = useMemo(() => {
    return stock.filter(s => s.is_low_stock || s.current_quantity <= s.reorder_threshold);
  }, [stock]);

  // Dynamic Category Distribution computed from real stock
  const dynamicCategoryData = useMemo(() => {
    const counts = {};
    stock.forEach(s => {
      const cat = s.category || 'General';
      counts[cat] = (counts[cat] || 0) + (s.current_quantity || 0);
    });
    return Object.entries(counts).map(([category, count]) => ({
      category: category.length > 18 ? category.substring(0, 16) + '...' : category,
      fullName: category,
      count
    })).sort((a, b) => b.count - a.count);
  }, [stock]);

  // Filtered pending requests
  const filteredPendingRequests = useMemo(() => {
    return pendingRequests.filter(r => 
      (r.item_name || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
      (r.location_name || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
      (r.requester_name || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
      (r.variant_name || '').toLowerCase().includes(searchFilter.toLowerCase())
    );
  }, [pendingRequests, searchFilter]);

  // Valuation Sparkline
  const sparklineDataStock = [
    { value: 8200 }, { value: 8450 }, { value: 8390 }, { value: 8750 }, 
    { value: 8900 }, { value: 8850 }, { value: summary?.total_central_stock || 9004 }
  ];

  const sparklineDataValuation = [
    { value: 1.55 }, { value: 1.60 }, { value: 1.62 }, { value: 1.68 }, 
    { value: 1.70 }, { value: 1.71 }, { value: 1.73 }
  ];

  // Colors for Category Bar Chart
  const categoryColors = ['#10b981', '#6700ce', '#e20d65', '#3b82f6', '#f59e0b', '#06b6d4'];

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-500 font-sans space-y-3">
        <div className="w-10 h-10 border-4 border-[#6700ce] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-[#1c023d]">Synchronizing Tata Play Fiber Central Command...</p>
      </div>
    );
  }

  const totalStockCount = summary?.total_central_stock || stock.reduce((a, b) => a + b.current_quantity, 0);
  const totalValuationLakhs = summary ? (summary.total_inventory_value / 100000).toFixed(2) : '172.70';
  const totalValuationCrores = summary ? (summary.total_inventory_value / 10000000).toFixed(2) : '1.73';

  return (
    <div className="space-y-6 pb-16 font-sans w-full max-w-none text-slate-800">
      
      {/* ================= EXECUTIVE COMMAND HEADER ================= */}
      <div className="bg-gradient-to-r from-[#1c023d] via-[#2a085c] to-[#1c023d] text-white rounded-2xl p-6 md:p-7 shadow-xl border border-purple-900/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-[#e20d65]/15 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />
        <div className="absolute left-1/4 bottom-0 w-64 h-64 bg-[#6700ce]/25 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-[11px] font-black uppercase tracking-wider text-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Central Live & Synced
              </span>
              <span className="px-3 py-1 rounded-full bg-white/10 text-[11px] font-mono font-bold text-purple-200">
                IST (UTC+05:30) • National Central Hub
              </span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              Executive Central Command
            </h1>
            <p className="text-xs sm:text-sm text-purple-200/80 max-w-2xl leading-relaxed">
              Real-time nationwide inventory valuation, regional city hub fulfillment pipeline, and serialized asset telemetry.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Quick Inbound Restock Button */}
            <button
              onClick={() => {
                setSelectedRestockVariantId(stock[0]?.variant_id || '');
                setIsRestockModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#e20d65] to-[#c20955] hover:from-[#ff1a7a] hover:to-[#e20d65] text-white font-black text-xs shadow-lg shadow-rose-900/30 transition-all transform hover:-translate-y-0.5 flex items-center gap-2"
            >
              <Package className="w-4 h-4" />
              <span>+ Inbound Restock</span>
            </button>

            {/* Add Product Button */}
            <button
              onClick={() => setIsCreateProductOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs transition backdrop-blur-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4 text-purple-300" />
              <span>+ Add SKU</span>
            </button>

            {/* Refresh Button */}
            <button
              onClick={handleManualRefresh}
              className={`p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white transition backdrop-blur-sm ${
                refreshing ? 'animate-spin text-purple-300' : ''
              }`}
              title="Refresh Live Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Toast notification */}
      {toastMsg && (
        <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-3 shadow-md animate-fade-in ${
          toastMsg.type === 'error' ? 'bg-rose-50 border border-rose-200 text-rose-800' :
          toastMsg.type === 'info' ? 'bg-purple-50 border border-purple-200 text-purple-900' :
          'bg-emerald-50 border border-emerald-200 text-emerald-900'
        }`}>
          {toastMsg.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" /> : <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* ================= TOP 5 PRIORITY KPI PERFORMANCE CARDS ================= */}
      <div data-tour="kpi-metrics" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 w-full">
        
        {/* KPI 1: Master Central Stock */}
        <div 
          onClick={() => setActiveTab?.('central-stock')}
          className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:shadow-md hover:border-purple-300 transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Central Stock</span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-2xl sm:text-3xl font-black text-[#1c023d] font-mono">{totalStockCount.toLocaleString()}</span>
                <span className="text-[11px] font-bold text-slate-400">units</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center font-bold shrink-0">
              <Package className="w-4 h-4" />
            </div>
          </div>

          <div className="h-10 w-full mt-2 -mb-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineDataStock}>
                <Area type="monotone" dataKey="value" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between text-[11px] pt-3 border-t border-slate-100 text-slate-500 font-semibold mt-1">
            <span>{stock.length} Active SKUs</span>
            <span className="text-emerald-600 font-bold flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" /> +8.4%
            </span>
          </div>
        </div>

        {/* KPI 2: Inventory Valuation */}
        <div 
          onClick={() => setActiveTab?.('central-stock')}
          className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:shadow-md hover:border-purple-300 transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Valuation</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl sm:text-3xl font-black text-[#1c023d] font-mono">₹{totalValuationCrores}</span>
                <span className="text-xs font-bold text-slate-500">Cr</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-100 text-[#6700ce] flex items-center justify-center font-bold shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
          </div>

          <div className="h-10 w-full mt-2 -mb-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineDataValuation}>
                <Area type="monotone" dataKey="value" stroke="#6700ce" fill="#6700ce" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between text-[11px] pt-3 border-t border-slate-100 text-slate-500 font-semibold mt-1">
            <span>(₹{totalValuationLakhs}L)</span>
            <span className="text-emerald-600 font-bold flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" /> +4.2%
            </span>
          </div>
        </div>

        {/* KPI 3: Pending Order Approvals (Highest Priority Action) */}
        <div 
          onClick={() => {
            setActionTab('pending_requests');
            const el = document.getElementById('action-center');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          className={`bg-white rounded-2xl p-5 border shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between ${
            pendingRequests.length > 0 ? 'border-amber-300 bg-gradient-to-b from-amber-50/40 to-white' : 'border-slate-200'
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block">Pending Approvals</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-black text-amber-600 font-mono">{pendingRequests.length}</span>
                <span className="text-xs font-bold text-amber-700">Orders</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold shrink-0">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>

          <p className="text-[11px] text-amber-800 mt-2 line-clamp-2">
            {pendingRequests.length > 0 ? 'City bulk orders awaiting Executive authorization' : 'All city bulk orders approved'}
          </p>

          <div className="flex items-center justify-between text-[11px] pt-3 border-t border-amber-200 text-amber-900 font-bold mt-1">
            <span>Review Queue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* KPI 4: In-Transit Dispatches */}
        <div 
          onClick={() => {
            setActionTab('in_transit');
            const el = document.getElementById('action-center');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:shadow-md hover:border-purple-300 transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">In-Transit Deliveries</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-black text-indigo-600 font-mono">{dispatchedRequests.length}</span>
                <span className="text-xs font-bold text-slate-500">Trucks</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold shrink-0">
              <Truck className="w-4 h-4" />
            </div>
          </div>

          <p className="text-[11px] text-slate-500 mt-2">
            Active highway logistics across 7 regional hubs
          </p>

          <div className="flex items-center justify-between text-[11px] pt-3 border-t border-slate-100 text-indigo-600 font-bold mt-1">
            <span>Track Freight</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* KPI 5: Serialized Assets in Field Custody */}
        <div 
          onClick={() => setActiveTab?.('offboarding')}
          className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:shadow-md hover:border-purple-300 transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Field Custody</span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-2xl sm:text-3xl font-black text-[#1c023d] font-mono">{summary?.serialized_assets_count || 675}</span>
                <span className="text-[11px] font-bold text-slate-400">serials</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 text-[#e20d65] flex items-center justify-center font-bold shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>

          <p className="text-[11px] text-slate-500 mt-2">
            Active modems, splicers & tools with technicians
          </p>

          <div className="flex items-center justify-between text-[11px] pt-3 border-t border-slate-100 text-[#e20d65] font-bold mt-1">
            <span>Staff & NOC Hub</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

      </div>

      {/* ================= ROW 2: LIVE DYNAMIC ANALYTICS & 7 REGIONAL HUBS ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
        
        {/* Left Column (5/12): Real Stock Category Distribution */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-black text-[#1c023d] flex items-center gap-2">
                <Boxes className="w-4 h-4 text-[#6700ce]" />
                <span>Central Stock Category Distribution</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Real-time physical inventory breakdown across all SKUs</p>
            </div>
            <span className="px-2 py-0.5 rounded bg-purple-50 text-[#6700ce] font-mono font-bold text-[10px] border border-purple-200">
              {dynamicCategoryData.length} Categories
            </span>
          </div>

          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dynamicCategoryData} layout="vertical" margin={{ top: 5, right: 25, left: 15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                <YAxis dataKey="category" type="category" stroke="#475569" tick={{ fontSize: 11, fontWeight: 700 }} width={120} />
                <Tooltip 
                  formatter={(val, name, item) => [`${val.toLocaleString()} Units`, item.payload.fullName]}
                  contentStyle={{ backgroundColor: '#1c023d', color: '#ffffff', borderRadius: '12px', fontSize: '11px', border: 'none' }} 
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={16}>
                  {dynamicCategoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={categoryColors[index % categoryColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 text-slate-500 font-medium">
            <span>Total Units: <strong className="text-[#1c023d]">{totalStockCount.toLocaleString()}</strong></span>
            <button onClick={() => setActiveTab?.('central-stock')} className="text-[#6700ce] hover:underline font-bold flex items-center gap-1">
              <span>View Full Inventory</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Column (7/12): 7 Regional Hubs Fulfillment Matrix (Live Data) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-black text-[#1c023d] flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#e20d65]" />
                <span>Nationwide Regional City Hubs (7 Centers)</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Live operational status across all primary distribution territories</p>
            </div>
            <button onClick={() => setActiveTab?.('users-mgmt')} className="text-xs font-bold text-[#6700ce] hover:underline flex items-center gap-1">
              <span>Manage Hubs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Grid of Real 7 Locations */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[260px] overflow-y-auto pr-1">
            {locations.map((loc) => {
              const activeHubReqs = requests.filter(r => r.location_id === loc.location_id && (r.status === 'PENDING' || r.status === 'DISPATCHED'));
              const hasPending = activeHubReqs.some(r => r.status === 'PENDING');
              
              return (
                <div 
                  key={loc.location_id} 
                  className="p-3 bg-slate-50 hover:bg-purple-50/50 border border-slate-200 hover:border-purple-200 rounded-xl transition flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-[#1c023d]">{loc.city}</span>
                      <span className="text-[10px] text-slate-400 font-mono">({loc.region_name?.split(' ')[0] || 'Hub'})</span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate max-w-[140px]">
                      Mgr: <strong className="text-slate-700">{loc.manager_name || 'Unassigned'}</strong>
                    </p>
                  </div>

                  <div className="text-right">
                    {activeHubReqs.length > 0 ? (
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase inline-block ${
                        hasPending ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}>
                        {activeHubReqs.length} {hasPending ? 'Req Pending' : 'In-Transit'}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-block">
                        Stock Synced
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 text-slate-500 font-medium">
            <span>Coverage: <strong className="text-slate-800">100% Regional Reach (India)</strong></span>
            <button onClick={() => setActiveTab?.('tracking')} className="text-[#6700ce] hover:underline font-bold flex items-center gap-1">
              <span>View In-Transit Map</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* ================= ROW 3: INTERACTIVE PRIORITY ACTION CENTER ================= */}
      <div id="action-center" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-black text-[#1c023d] flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#e20d65]" />
              <span>Priority Operational Action Center</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Direct executive authorization queue, active freight monitoring, and proactive stockout prevention.
            </p>
          </div>

          {/* Action Center Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1 text-xs font-bold">
            <button
              onClick={() => setActionTab('pending_requests')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                actionTab === 'pending_requests' ? 'bg-[#1c023d] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Pending Approvals</span>
              {pendingRequests.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-[#e20d65] text-white text-[10px] font-mono">
                  {pendingRequests.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActionTab('in_transit')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                actionTab === 'in_transit' ? 'bg-[#1c023d] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Active In-Transit ({dispatchedRequests.length})</span>
            </button>

            <button
              onClick={() => setActionTab('low_stock_refill')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                actionTab === 'low_stock_refill' ? 'bg-[#1c023d] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <AlertTriangle className={`w-3.5 h-3.5 ${lowStockItems.length > 0 ? 'text-rose-500' : ''}`} />
              <span>Low-Stock Spotlight ({lowStockItems.length})</span>
            </button>
          </div>
        </div>

        {/* TAB 1: PENDING REQUESTS APPROVAL QUEUE */}
        {actionTab === 'pending_requests' && (
          <div className="space-y-4">
            
            <div className="flex items-center justify-between">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter requests by city, manager, or SKU..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:border-[#6700ce] focus:bg-white"
                />
              </div>

              <span className="text-xs text-slate-400 font-mono font-bold">
                {filteredPendingRequests.length} Orders Pending Authorization
              </span>
            </div>

            {filteredPendingRequests.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs font-semibold bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <p className="font-bold text-slate-700">Approval Queue is 100% Clear</p>
                <p className="text-slate-400">No pending stock requests from city hub managers.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-extrabold uppercase border-b border-slate-200 text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Order ID</th>
                      <th className="py-3 px-4">Destination Hub</th>
                      <th className="py-3 px-4">Item & SKU Variant</th>
                      <th className="py-3 px-4 text-center">Qty Requested</th>
                      <th className="py-3 px-4">Estimated Value</th>
                      <th className="py-3 px-4">Requester</th>
                      <th className="py-3 px-4 text-right">Executive Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredPendingRequests.map((r) => {
                      const estimatedVal = (r.quantity_requested * (r.unit_cost || 0)).toLocaleString('en-IN');
                      return (
                        <tr key={r.request_id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-4 font-mono font-bold text-purple-900">#{r.request_id}</td>
                          <td className="py-3 px-4">
                            <span className="px-2.5 py-1 rounded-lg bg-purple-50 text-[#6700ce] border border-purple-200 font-bold inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {r.location_name}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-extrabold text-[#1c023d] block">{r.item_name}</span>
                            <span className="text-[11px] text-[#e20d65] font-mono">{r.variant_name}</span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-black text-base text-[#1c023d]">
                            {r.quantity_requested}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-700">
                            ₹{estimatedVal}
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-slate-800 font-bold block">{r.requester_name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{new Date(r.created_at).toLocaleDateString('en-IN')}</span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleApproveRequest(r.request_id, r.location_name, r.item_name)}
                                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition flex items-center gap-1.5"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Approve Order</span>
                              </button>
                              <button
                                onClick={() => handleRejectRequest(r.request_id)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 border border-slate-200 transition"
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        )}

        {/* TAB 2: ACTIVE IN-TRANSIT SHIPMENTS */}
        {actionTab === 'in_transit' && (
          <div className="space-y-4">
            {dispatchedRequests.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs font-semibold bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <Truck className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="font-bold text-slate-700">No Dispatches In-Transit</p>
                <p className="text-slate-400">All dispatched transfer shipments have been confirmed by hub managers.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dispatchedRequests.map((d) => (
                  <div key={d.request_id} className="p-5 rounded-2xl border border-indigo-200 bg-indigo-50/20 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-black text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-200">
                        Dispatch #{d.request_id}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 uppercase flex items-center gap-1">
                        <Truck className="w-3 h-3 animate-pulse" /> On Highway
                      </span>
                    </div>

                    <div>
                      <h4 className="font-black text-base text-[#1c023d]">{d.item_name}</h4>
                      <p className="text-[11px] text-slate-500">{d.variant_name} • Qty: <strong>{d.quantity_requested} units</strong></p>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Destination City Hub</span>
                        <span className="font-extrabold text-[#1c023d] text-xs">{d.location_name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Carrier / Tracking</span>
                        <span className="font-mono font-bold text-indigo-700 text-xs">
                          {d.carrier_name || 'BlueDart Express'}: {d.tracking_number || `BD-${d.request_id * 8492}`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-400">Recipient: <strong className="text-slate-700">{d.requester_name}</strong></span>
                      <button onClick={() => setActiveTab?.('tracking')} className="text-indigo-600 hover:underline font-bold flex items-center gap-1">
                        <span>Live GPS Tracking</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: LOW STOCK REFILL SPOTLIGHT */}
        {actionTab === 'low_stock_refill' && (
          <div className="space-y-4">
            {lowStockItems.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs font-semibold bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <p className="font-bold text-slate-700">Healthy Stock Across All SKUs</p>
                <p className="text-slate-400">All products are currently holding inventory above safety reorder thresholds.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {lowStockItems.map((item) => {
                  const percentLeft = Math.min(100, Math.round((item.current_quantity / (item.reorder_threshold * 1.5)) * 100));
                  return (
                    <div key={item.variant_id} className="p-5 rounded-2xl border-2 border-rose-200 bg-rose-50/20 space-y-3 text-xs">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-black text-base text-[#1c023d] block">{item.item_name}</span>
                          <span className="text-[11px] text-[#e20d65] font-semibold">{item.variant_name}</span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Below Safety Limit
                        </span>
                      </div>

                      {/* Stock Level Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-bold">
                          <span className="text-rose-700 font-mono">Current: {item.current_quantity} units</span>
                          <span className="text-slate-400 font-mono">Threshold: {item.reorder_threshold} units</span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-rose-500 rounded-full" 
                            style={{ width: `${percentLeft}%` }}
                          />
                        </div>
                      </div>

                      <div className="pt-2 border-t border-rose-200 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">
                          Recommended Order: <strong className="text-slate-800 font-mono">+{item.reorder_quantity} units</strong>
                        </span>
                        <button
                          onClick={() => {
                            setSelectedRestockVariantId(item.variant_id);
                            setRestockQty(item.reorder_quantity || 100);
                            setIsRestockModalOpen(true);
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#e20d65] to-[#c20955] hover:from-[#ff1a7a] hover:to-[#e20d65] text-white font-extrabold shadow-sm transition flex items-center gap-1.5"
                        >
                          <Package className="w-3.5 h-3.5" />
                          <span>Restock SKU</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ================= ROW 4: TELEMETRY ALERTS FEED ================= */}
      <div className="w-full">
        <AlertsFeed alerts={alerts} onUpdateStatus={handleUpdateAlertStatus} isManager={false} />
      </div>

      {/* ================= MODAL: INBOUND RESTOCK MODAL ================= */}
      {isRestockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-[#e20d65] flex items-center justify-center font-bold">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#1c023d]">Receive Inbound Vendor Shipment</h3>
                  <p className="text-xs text-slate-500">Restock catalog hardware into National Central Warehouse</p>
                </div>
              </div>
              <button onClick={() => setIsRestockModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRestockSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-extrabold mb-1">Select Product Variant SKU *</label>
                <select
                  value={selectedRestockVariantId}
                  onChange={(e) => setSelectedRestockVariantId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 focus:outline-none focus:border-[#6700ce]"
                  required
                >
                  {stock.map((s) => (
                    <option key={s.variant_id} value={s.variant_id}>
                      {s.item_name} — {s.variant_name} (Current: {s.current_quantity})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-extrabold mb-1">Restock Quantity (Units) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={restockQty}
                    onChange={(e) => setRestockQty(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold focus:outline-none focus:border-[#6700ce]"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-extrabold mb-1">OEM Supplier / Vendor *</label>
                  <input
                    type="text"
                    required
                    value={restockSupplier}
                    onChange={(e) => setRestockSupplier(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-semibold focus:outline-none focus:border-[#6700ce]"
                    placeholder="e.g. Syrotech Networking"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-[11px] text-purple-900 leading-relaxed">
                If the selected SKU is serialized (e.g. Modems, Splicing Machines), individual tracking barcodes will automatically be registered in the Central Asset Ledger.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRestockModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={restockSubmitting}
                  className="px-5 py-2 rounded-xl bg-[#e20d65] hover:bg-[#cc0059] text-white font-black shadow-md transition flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{restockSubmitting ? 'Receiving Stock...' : 'Confirm Inbound Restock'}</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Create Product Modal */}
      <CreateProductModal
        isOpen={isCreateProductOpen}
        onClose={() => setIsCreateProductOpen(false)}
        onSuccess={() => fetchData()}
      />

    </div>
  );
};
