import React, { useState, useMemo } from 'react';
import { 
  Truck, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  PackageCheck, 
  AlertCircle, 
  ChevronRight, 
  ShieldCheck, 
  UserCheck, 
  Calendar, 
  Send,
  Search,
  Boxes,
  Compass,
  Copy,
  Check,
  RotateCcw,
  Building2,
  XCircle,
  ArrowUpRight,
  ChevronDown,
  Sparkles
} from 'lucide-react';

import { getProductImage } from '../utils/imageHelper';
import { DeliveryMap } from '../components/DeliveryMap';
import { isCreatedToday, formatTimeOrDate } from '../utils/dateHelper';

export const ShipmentTrackingSection = ({ 
  orders = [], 
  isCentralAdmin = false, 
  userLocationId, 
  onFulfillOrder, 
  onDispatchOrder 
}) => {
  const getOrderId = (order) => order?.order_id ?? order?.request_id ?? null;

  // Filter & Search states
  const [timeFilter, setTimeFilter] = useState('ALL'); // 'ALL' | 'TODAY'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [copiedTracking, setCopiedTracking] = useState(false);

  // Dispatch modal state
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [dispatchTargetOrder, setDispatchTargetOrder] = useState(null);
  const [carrierName, setCarrierName] = useState('Tata Play Express Logistics / BlueDart');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState('2-3 Business Days');

  // Base role-filtered orders
  const baseOrders = useMemo(() => {
    return isCentralAdmin 
      ? orders 
      : orders.filter(o => o.location_id === userLocationId);
  }, [orders, isCentralAdmin, userLocationId]);

  const todayCount = useMemo(() => {
    return baseOrders.filter(o => isCreatedToday(o.created_at || o.dispatched_at)).length;
  }, [baseOrders]);

  // Unique locations for filter
  const uniqueLocations = useMemo(() => {
    const locs = new Set();
    baseOrders.forEach(o => {
      if (o.location_name) locs.add(o.location_name);
    });
    return Array.from(locs);
  }, [baseOrders]);

  // Filtered & Searched Orders
  const filteredOrders = useMemo(() => {
    return baseOrders.filter(o => {
      const orderId = String(getOrderId(o) || '');
      const itemName = (o.item_name || '').toLowerCase();
      const variantName = (o.variant_name || '').toLowerCase();
      const locationName = (o.location_name || '').toLowerCase();
      const requesterName = (o.requester_name || '').toLowerCase();
      const tracking = (o.tracking_number || '').toLowerCase();
      const carrier = (o.carrier_name || '').toLowerCase();
      const query = searchQuery.trim().toLowerCase();

      const matchesSearch = !query || 
        orderId.includes(query) ||
        itemName.includes(query) ||
        variantName.includes(query) ||
        locationName.includes(query) ||
        requesterName.includes(query) ||
        tracking.includes(query) ||
        carrier.includes(query);

      const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
      const matchesLocation = locationFilter === 'ALL' || o.location_name === locationFilter;
      const matchesTime = timeFilter === 'ALL' || isCreatedToday(o.created_at || o.dispatched_at);

      return matchesSearch && matchesStatus && matchesLocation && matchesTime;
    });
  }, [baseOrders, searchQuery, statusFilter, locationFilter, timeFilter]);

  const [selectedOrderId, setSelectedOrderId] = useState(getOrderId(filteredOrders[0]) || null);

  const activeOrder = useMemo(() => {
    if (!baseOrders.length) return null;
    const found = baseOrders.find(o => String(getOrderId(o)) === String(selectedOrderId));
    return found || filteredOrders[0] || baseOrders[0];
  }, [baseOrders, selectedOrderId, filteredOrders]);

  // KPI summary counters
  const stats = useMemo(() => {
    return {
      total: baseOrders.length,
      pending: baseOrders.filter(o => o.status === 'PENDING').length,
      inTransit: baseOrders.filter(o => o.status === 'IN_TRANSIT' || o.status === 'DISPATCHED' || o.status === 'APPROVED').length,
      fulfilled: baseOrders.filter(o => o.status === 'FULFILLED').length,
    };
  }, [baseOrders]);

  const handleCopyTracking = (trackingNum) => {
    if (!trackingNum) return;
    navigator.clipboard.writeText(trackingNum);
    setCopiedTracking(true);
    setTimeout(() => setCopiedTracking(false), 2000);
  };

  const handleOpenDispatch = (order) => {
    setDispatchTargetOrder(order);
    const orderId = getOrderId(order);
    setTrackingNumber(`TPF-TRK-${String(orderId).padStart(4, '0')}-${Math.floor(100 + Math.random() * 900)}`);
    setIsDispatchModalOpen(true);
  };

  const handleConfirmDispatchSubmit = async (e) => {
    e.preventDefault();
    if (!dispatchTargetOrder) return;
    const orderId = getOrderId(dispatchTargetOrder);
    await onDispatchOrder(orderId, {
      carrier_name: carrierName,
      tracking_number: trackingNumber,
      estimated_delivery: estimatedDelivery
    });
    setIsDispatchModalOpen(false);
    setDispatchTargetOrder(null);
  };

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'FULFILLED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'IN_TRANSIT':
      case 'DISPATCHED':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'APPROVED':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'PENDING':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'REJECTED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-5 font-sans w-full max-w-[1600px] mx-auto pb-16">
      
      {/* 1. Header Banner */}
      <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-[#1c023d] p-2.5 rounded text-white shrink-0 flex items-center justify-center">
            <Truck className="w-5 h-5 text-[#e20d65]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl md:text-2xl font-black text-[#1c023d] tracking-tight">
                {isCentralAdmin ? 'Global PO Dispatch & Shipment Tracker' : 'My Hub Shipment Tracker'}
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-[#e20d65]/10 text-[#e20d65] border border-[#e20d65]/20 rounded">
                Live Telemetry
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time shipment tracking, GPS delivery routes, and lifecycle progression for regional hub supplies
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-mono font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded border border-slate-200">
            {isCentralAdmin ? 'All 7 Hubs Active' : 'Connected to Local Hub'}
          </span>
        </div>
      </div>

      {/* 2. Interactive KPI Stat Filter Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        
        {/* Total Orders Card */}
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`text-left p-3.5 rounded-lg border transition flex flex-col justify-between ${
            statusFilter === 'ALL'
              ? 'bg-[#1c023d] text-white border-[#1c023d] shadow-xs'
              : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider ${statusFilter === 'ALL' ? 'text-purple-200' : 'text-slate-500'}`}>
              All Active POs
            </span>
            <Boxes className={`w-4 h-4 ${statusFilter === 'ALL' ? 'text-[#e20d65]' : 'text-slate-400'}`} />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black font-mono">{stats.total}</div>
            <div className={`text-[10px] mt-0.5 ${statusFilter === 'ALL' ? 'text-purple-300' : 'text-slate-400'}`}>
              Total logged requests
            </div>
          </div>
        </button>

        {/* Pending Approval */}
        <button
          onClick={() => setStatusFilter('PENDING')}
          className={`text-left p-3.5 rounded-lg border transition flex flex-col justify-between ${
            statusFilter === 'PENDING'
              ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
              : 'bg-white text-slate-800 border-slate-200 hover:border-amber-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider ${statusFilter === 'PENDING' ? 'text-amber-100' : 'text-amber-700'}`}>
              Pending Approval
            </span>
            <Clock className={`w-4 h-4 ${statusFilter === 'PENDING' ? 'text-white' : 'text-amber-500'}`} />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black font-mono">{stats.pending}</div>
            <div className={`text-[10px] mt-0.5 ${statusFilter === 'PENDING' ? 'text-amber-100' : 'text-slate-400'}`}>
              Awaiting admin signoff
            </div>
          </div>
        </button>

        {/* In Transit / Dispatched */}
        <button
          onClick={() => setStatusFilter(statusFilter === 'IN_TRANSIT' ? 'ALL' : 'IN_TRANSIT')}
          className={`text-left p-3.5 rounded-lg border transition flex flex-col justify-between ${
            statusFilter === 'IN_TRANSIT'
              ? 'bg-sky-600 text-white border-sky-700 shadow-xs'
              : 'bg-white text-slate-800 border-slate-200 hover:border-sky-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider ${statusFilter === 'IN_TRANSIT' ? 'text-sky-100' : 'text-sky-700'}`}>
              In Transit & Dispatched
            </span>
            <Truck className={`w-4 h-4 ${statusFilter === 'IN_TRANSIT' ? 'text-white' : 'text-sky-500'}`} />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black font-mono">{stats.inTransit}</div>
            <div className={`text-[10px] mt-0.5 ${statusFilter === 'IN_TRANSIT' ? 'text-sky-100' : 'text-slate-400'}`}>
              Active delivery route
            </div>
          </div>
        </button>

        {/* Delivered / Fulfilled */}
        <button
          onClick={() => setStatusFilter('FULFILLED')}
          className={`text-left p-3.5 rounded-lg border transition flex flex-col justify-between ${
            statusFilter === 'FULFILLED'
              ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
              : 'bg-white text-slate-800 border-slate-200 hover:border-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider ${statusFilter === 'FULFILLED' ? 'text-emerald-100' : 'text-emerald-700'}`}>
              Delivered & Closed
            </span>
            <PackageCheck className={`w-4 h-4 ${statusFilter === 'FULFILLED' ? 'text-white' : 'text-emerald-500'}`} />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black font-mono">{stats.fulfilled}</div>
            <div className={`text-[10px] mt-0.5 ${statusFilter === 'FULFILLED' ? 'text-emerald-100' : 'text-slate-400'}`}>
              Added to local stock
            </div>
          </div>
        </button>

      </div>

      {/* 3. Search & Filters Bar */}
      <div className="bg-white rounded-lg p-3 border border-slate-200 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
        
        {/* Timeline Toggle: All vs Today */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 shrink-0">
          <button
            onClick={() => setTimeFilter('ALL')}
            className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              timeFilter === 'ALL'
                ? 'bg-white text-[#1c023d] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>All ({baseOrders.length})</span>
          </button>
          <button
            onClick={() => setTimeFilter('TODAY')}
            className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              timeFilter === 'TODAY'
                ? 'bg-[#1c023d] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className={`w-3.5 h-3.5 ${timeFilter === 'TODAY' ? 'text-[#e20d65]' : 'text-slate-500'}`} />
            <span>Today's Tracking</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              timeFilter === 'TODAY' ? 'bg-[#e20d65] text-white' : 'bg-purple-100 text-[#6700ce]'
            }`}>
              {todayCount}
            </span>
          </button>
        </div>

        {/* Search Input Box */}
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by PO #, Item Name, Variant, Hub City, Requester, Tracking ID..."
            className="w-full h-9 bg-slate-50 border border-slate-300 rounded pl-9 pr-14 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#e20d65] focus:bg-white transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-200/70"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filter Controls Group */}
        <div className="flex items-center gap-2">
          {/* Location Filter for Admin */}
          {isCentralAdmin && uniqueLocations.length > 0 && (
            <div className="relative">
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="h-9 appearance-none bg-slate-50 border border-slate-300 rounded pl-3 pr-7 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#e20d65] focus:bg-white transition"
              >
                <option value="ALL">All Destination Hubs</option>
                {uniqueLocations.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          {/* Reset Filters Button */}
          {(searchQuery || statusFilter !== 'ALL' || locationFilter !== 'ALL' || timeFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setLocationFilter('ALL');
                setTimeFilter('ALL');
              }}
              title="Reset all filters"
              className="h-9 px-3 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded transition flex items-center gap-1 text-xs font-bold shrink-0 border border-slate-200 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
        </div>

      </div>

      {timeFilter === 'TODAY' && (
        <div className="px-3.5 py-2 rounded-lg bg-purple-50 border border-purple-200 text-purple-900 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#e20d65]" />
            <span>Showing <strong>Today's Shipment Movements</strong> ({filteredOrders.length} orders logged today).</span>
          </div>
          <button
            onClick={() => setTimeFilter('ALL')}
            className="text-[#6700ce] hover:underline font-bold text-[11px] cursor-pointer"
          >
            Show All Shipments ➔
          </button>
        </div>
      )}

      {/* 4. Two-Column Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 w-full items-start">
        
        {/* Left Column (5 cols): Orders Selection List */}
        <div className="lg:col-span-5 bg-white rounded-lg p-3.5 border border-slate-200 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between px-1 pb-1.5 border-b border-slate-100">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              Orders Queue ({filteredOrders.length})
            </span>
            <span className="text-[10px] text-slate-400">Click to track</span>
          </div>

          <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-0.5">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-10 text-slate-400 space-y-1.5">
                <Search className="w-6 h-6 mx-auto text-slate-300" />
                <p className="text-xs font-medium">No orders found matching criteria.</p>
              </div>
            ) : (
              filteredOrders.map((o) => {
                const orderId = getOrderId(o);
                const isSelected = String(orderId) === String(getOrderId(activeOrder));
                return (
                  <div
                    key={orderId}
                    onClick={() => setSelectedOrderId(orderId)}
                    className={`p-2.5 rounded border transition cursor-pointer flex items-center gap-2.5 relative ${
                      isSelected
                        ? 'bg-purple-50/80 text-[#1c023d] border-purple-300 shadow-xs'
                        : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="w-10 h-10 rounded flex items-center justify-center p-1 shrink-0 border bg-white border-slate-200">
                      <img 
                        src={getProductImage(o.item_name)} 
                        alt={o.item_name} 
                        className="w-full h-full object-contain" 
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-[10px] font-mono font-bold text-slate-500">
                          #PO-{String(orderId).padStart(4, '0')}
                        </span>
                        <span className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded border ${
                          getStatusBadgeStyle(o.status)
                        }`}>
                          {o.status === 'IN_TRANSIT' ? 'IN TRANSIT' : o.status}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-[#1c023d] truncate">
                        {o.item_name}
                      </h4>

                      <div className="flex items-center gap-2 mt-0.5 text-[10px] flex-wrap">
                        <span className="px-1 py-0.2 rounded font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {o.variant_name}
                        </span>
                        <span className="truncate text-slate-500">
                          📍 {o.location_name}
                        </span>
                        <span className="font-mono font-bold ml-auto text-slate-800">
                          {o.quantity_requested}u
                        </span>
                      </div>
                    </div>

                    <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[#e20d65]' : 'text-slate-300'}`} />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column (7 cols): Active Order Dossier, Live Map, and Timeline */}
        <div className="lg:col-span-7 space-y-4">
          {activeOrder ? (
            <>
              {/* Order Dossier Header Card */}
              <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-xs space-y-3.5">
                
                {/* Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      PO ID: #PO-{String(getOrderId(activeOrder)).padStart(4, '0')}
                    </span>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${getStatusBadgeStyle(activeOrder.status)}`}>
                      {activeOrder.status}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>{new Date(activeOrder.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>

                {/* Product Title & Info */}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded bg-[#f8f7fc] border border-slate-200 p-1 shrink-0 flex items-center justify-center">
                    <img 
                      src={getProductImage(activeOrder.item_name)} 
                      alt={activeOrder.item_name} 
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base md:text-lg font-black text-[#1c023d] leading-tight">
                        {activeOrder.item_name}
                      </h2>
                      <span className="text-xs font-mono font-bold text-[#e20d65] bg-[#e20d65]/10 px-1.5 py-0.2 rounded border border-[#e20d65]/20">
                        {activeOrder.variant_name}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 mt-0.5">
                      Destination: <strong className="text-slate-800">{activeOrder.location_name}</strong> • Requester: <strong className="text-slate-800">{activeOrder.requester_name || 'Hub Lead'}</strong>
                    </p>
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5">
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                    <div className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Order Quantity</div>
                    <div className="text-sm font-black text-[#1c023d] mt-0.5 font-mono">
                      {activeOrder.quantity_requested} <span className="text-xs font-normal text-slate-500">units</span>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                    <div className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Carrier Logistics</div>
                    <div className="text-xs font-bold text-slate-800 mt-0.5 truncate">
                      {activeOrder.carrier_name || 'Tata Play Express'}
                    </div>
                  </div>

                  <div className="bg-[#f0ebfa] p-2.5 rounded border border-[#e8e2f7]">
                    <div className="text-[9px] font-bold uppercase text-purple-700 tracking-wider">Estimated SLA</div>
                    <div className="text-xs font-black text-[#1c023d] mt-0.5 font-mono">
                      {activeOrder.estimated_delivery || '24-48 Hours'}
                    </div>
                  </div>
                </div>

                {/* Tracking Number Bar */}
                <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 rounded border border-slate-200 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">AWB Tracking:</span>
                    <span className="font-mono font-bold text-slate-800">{activeOrder.tracking_number || `TPF-TRK-${String(getOrderId(activeOrder)).padStart(4, '0')}-DL`}</span>
                  </div>

                  <button
                    onClick={() => handleCopyTracking(activeOrder.tracking_number || `TPF-TRK-${String(getOrderId(activeOrder)).padStart(4, '0')}-DL`)}
                    className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold flex items-center gap-1 shadow-xs transition"
                  >
                    {copiedTracking ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-400" />}
                    <span>{copiedTracking ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

              </div>

              {/* Leaflet OpenStreetMap Route Map View */}
              <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#1c023d] flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#e20d65]" />
                    Live Geographical Delivery Route
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">GPS Live Telemetry</span>
                </div>

                <div className="rounded overflow-hidden border border-slate-200">
                  <DeliveryMap
                    sourceName={activeOrder.source_location_name || "Central Admin Main Hub (Delhi)"}
                    sourceCoords={[activeOrder.source_latitude || 28.6139, activeOrder.source_longitude || 77.2090]}
                    destName={activeOrder.location_name || "Regional Hub"}
                    destCoords={[activeOrder.destination_latitude || 19.0760, activeOrder.destination_longitude || 72.8777]}
                    dispatchedAt={activeOrder.dispatched_at}
                    estimatedDelivery={activeOrder.estimated_delivery}
                    status={activeOrder.status}
                    orderId={getOrderId(activeOrder)}
                  />
                </div>
              </div>

              {/* Multi-Step Timeline Progress Bar */}
              <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-xs space-y-4">
                <h4 className="text-xs font-bold uppercase text-[#1c023d] tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#e20d65]" />
                  Shipment Delivery Milestones
                </h4>

                <div className="relative flex items-center justify-between pt-1 pb-1">
                  {/* Line Connector */}
                  <div className="absolute top-1/2 left-4 right-4 -translate-y-1/2 h-0.5 bg-slate-200 z-0" />
                  <div 
                    className="absolute top-1/2 left-4 -translate-y-1/2 h-0.5 bg-[#10b981] z-0 transition-all duration-300" 
                    style={{ 
                      width: activeOrder.status === 'PENDING' ? '0%' :
                             activeOrder.status === 'APPROVED' ? '33%' :
                             (activeOrder.status === 'IN_TRANSIT' || activeOrder.status === 'DISPATCHED') ? '66%' :
                             activeOrder.status === 'FULFILLED' ? '100%' : '0%'
                    }}
                  />

                  {/* Step 1: Placed */}
                  <div className="relative z-10 flex flex-col items-center text-center space-y-1">
                    <div className="w-8 h-8 rounded bg-[#10b981] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-900 mt-0.5">PO Placed</span>
                    <span className="text-[10px] text-slate-400 font-mono">{new Date(activeOrder.created_at || Date.now()).toLocaleDateString()}</span>
                  </div>

                  {/* Step 2: Approved */}
                  <div className="relative z-10 flex flex-col items-center text-center space-y-1">
                    <div className={`w-8 h-8 rounded flex items-center justify-center font-bold text-xs shadow-xs ${
                      activeOrder.status !== 'PENDING' && activeOrder.status !== 'REJECTED'
                        ? 'bg-[#10b981] text-white'
                        : 'bg-slate-200 text-slate-500'
                    }`}>
                      {activeOrder.status !== 'PENDING' && activeOrder.status !== 'REJECTED' ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-3.5 h-3.5 text-slate-400" />}
                    </div>
                    <span className="text-xs font-bold text-slate-900 mt-0.5">Admin Approved</span>
                    <span className="text-[10px] text-slate-400 font-mono">Central HQ</span>
                  </div>

                  {/* Step 3: In-Transit */}
                  <div className="relative z-10 flex flex-col items-center text-center space-y-1">
                    <div className={`w-8 h-8 rounded flex items-center justify-center font-bold text-xs shadow-xs ${
                      activeOrder.status === 'IN_TRANSIT' || activeOrder.status === 'DISPATCHED' ? 'bg-sky-500 text-white animate-pulse' :
                      activeOrder.status === 'FULFILLED' ? 'bg-[#10b981] text-white' :
                      'bg-slate-200 text-slate-500'
                    }`}>
                      <Truck className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-900 mt-0.5">In Transit</span>
                    <span className="text-[10px] text-slate-400 font-mono">{activeOrder.estimated_delivery || 'En-Route'}</span>
                  </div>

                  {/* Step 4: Delivered */}
                  <div className="relative z-10 flex flex-col items-center text-center space-y-1">
                    <div className={`w-8 h-8 rounded flex items-center justify-center font-bold text-xs shadow-xs ${
                      activeOrder.status === 'FULFILLED'
                        ? 'bg-[#10b981] text-white'
                        : 'bg-slate-200 text-slate-500'
                    }`}>
                      <PackageCheck className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-900 mt-0.5">Delivered</span>
                    <span className="text-[10px] text-slate-400 font-mono">{activeOrder.location_name}</span>
                  </div>
                </div>
              </div>

              {/* Admin Action: Dispatch Approved Order */}
              {activeOrder.status === 'APPROVED' && isCentralAdmin && (
                <div className="p-3.5 rounded-lg bg-indigo-50 border border-indigo-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-indigo-950">Ready for Dispatch & Transport?</p>
                    <p className="text-[11px] text-indigo-700 mt-0.5">Assign carrier details and tracking number to mark this PO as IN_TRANSIT.</p>
                  </div>

                  <button
                    onClick={() => handleOpenDispatch(activeOrder)}
                    className="px-3.5 py-1.5 rounded bg-[#6700ce] hover:bg-[#5200a5] text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Dispatch Order</span>
                  </button>
                </div>
              )}

              {/* Manager Action: Confirm Arrival of In-Transit Order */}
              {(activeOrder.status === 'IN_TRANSIT' || activeOrder.status === 'DISPATCHED') && (!isCentralAdmin || userLocationId === activeOrder.location_id) && (
                <div className="p-3.5 rounded-lg bg-sky-50 border border-sky-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-sky-950">Shipment Arrived at Destination Hub?</p>
                    <p className="text-[11px] text-sky-700 mt-0.5">Confirm physical delivery to increment local inventory stock immediately.</p>
                  </div>

                  <button
                    onClick={() => onFulfillOrder(getOrderId(activeOrder))}
                    className="px-3.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 shrink-0"
                  >
                    <PackageCheck className="w-3.5 h-3.5" />
                    <span>Confirm Delivery</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-lg p-10 border border-slate-200 text-center text-slate-400 text-xs font-semibold">
              Select an order on the left to inspect its live shipment timeline.
            </div>
          )}
        </div>

      </div>

      {/* Dispatch Order Modal */}
      {isDispatchModalOpen && dispatchTargetOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-3.5">
            <h3 className="text-base font-bold text-[#1c023d]">Dispatch PO #{getOrderId(dispatchTargetOrder)}</h3>
            <p className="text-xs text-slate-500">Provide shipping carrier details to transition order status to IN_TRANSIT.</p>

            <form onSubmit={handleConfirmDispatchSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Shipping Carrier</label>
                <input
                  type="text"
                  value={carrierName}
                  onChange={(e) => setCarrierName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-[#6700ce] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tracking Number</label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded font-mono focus:ring-1 focus:ring-[#6700ce] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Estimated Delivery (ETA)</label>
                <input
                  type="text"
                  value={estimatedDelivery}
                  onChange={(e) => setEstimatedDelivery(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-[#6700ce] focus:outline-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDispatchModalOpen(false)}
                  className="px-3 py-1.5 rounded text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded text-xs font-bold text-white bg-[#6700ce] hover:bg-[#5200a5] shadow-xs transition"
                >
                  Confirm Dispatch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
