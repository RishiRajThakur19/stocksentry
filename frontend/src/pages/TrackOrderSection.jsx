import React, { useState, useMemo } from 'react';
import { 
  Search, 
  PackageCheck, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Truck, 
  MapPin, 
  Building2, 
  ChevronRight, 
  ArrowRight,
  Copy,
  Check,
  Filter,
  RotateCcw,
  Calendar,
  Layers,
  ShieldCheck,
  Tag,
  Boxes,
  Compass,
  ArrowUpRight
} from 'lucide-react';
import { getProductImage } from '../utils/imageHelper';

export const TrackOrderSection = ({ orders = [], onRequestOrder }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('newest');
  const [copiedTracking, setCopiedTracking] = useState(false);

  // Helper to normalize ID
  const getOrderId = (order) => order?.order_id 
  ?? order?.request_id ?? null;

  // Extract unique locations for filtering
  const uniqueLocations = useMemo(() => {
    const locs = new Set();
    orders.forEach(o => {
      if (o.location_name) locs.add(o.location_name);
    });
    return Array.from(locs);
  }, [orders]);

  // Filtered & Sorted orders list
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const orderId = String(getOrderId(o) || '');
      const itemName = (o.item_name || '').toLowerCase();
      const variantName = (o.variant_name || '').toLowerCase();
      const locationName = (o.location_name || '').toLowerCase();
      const requesterName = (o.requester_name || '').toLowerCase();
      const trackingNumber = (o.tracking_number || '').toLowerCase();
      const carrierName = (o.carrier_name || '').toLowerCase();
      const query = searchQuery.trim().toLowerCase();

      const matchesSearch = !query || 
        orderId.includes(query) ||
        itemName.includes(query) ||
        variantName.includes(query) ||
        locationName.includes(query) ||
        requesterName.includes(query) ||
        trackingNumber.includes(query) ||
        carrierName.includes(query);

      const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
      const matchesLocation = locationFilter === 'ALL' || o.location_name === locationFilter;

      return matchesSearch && matchesStatus && matchesLocation;
    }).sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }
      if (sortBy === 'oldest') {
        return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      }
      if (sortBy === 'qty_desc') {
        return (b.quantity_requested || 0) - (a.quantity_requested || 0);
      }
      if (sortBy === 'qty_asc') {
        return (a.quantity_requested || 0) - (b.quantity_requested || 0);
      }
      return 0;
    });
  }, [orders, searchQuery, statusFilter, locationFilter, sortBy]);

  const [selectedOrderId, setSelectedOrderId] = useState(
    getOrderId(orders[0]) || ''
  );

  // Derive active order
  const currentOrder = useMemo(() => {
    if (!orders.length) return null;
    const found = orders.find(o => String(getOrderId(o)) === String(selectedOrderId));
    return found || filteredOrders[0] || orders[0];
  }, [orders, selectedOrderId, filteredOrders]);

  // Statistics counters
  const stats = useMemo(() => {
    return {
      total: orders.length,
      pending: orders.filter(o => o.status === 'PENDING').length,
      inTransit: orders.filter(o => o.status === 'APPROVED' || o.status === 'IN_TRANSIT' || o.status === 'DISPATCHED').length,
      fulfilled: orders.filter(o => o.status === 'FULFILLED').length,
      rejected: orders.filter(o => o.status === 'REJECTED').length,
    };
  }, [orders]);

  const handleCopyTracking = (trackingNum) => {
    if (!trackingNum) return;
    navigator.clipboard.writeText(trackingNum);
    setCopiedTracking(true);
    setTimeout(() => setCopiedTracking(false), 2000);
  };

  const getStepStatus = (orderStatus, step) => {
    if (!orderStatus) return 'upcoming';
    if (orderStatus === 'REJECTED') {
      if (step === 1) return 'completed';
      return 'rejected';
    }

    if (orderStatus === 'PENDING') {
      if (step === 1) return 'completed';
      if (step === 2) return 'current';
      return 'upcoming';
    }

    if (orderStatus === 'APPROVED' || orderStatus === 'IN_TRANSIT' || orderStatus === 'DISPATCHED') {
      if (step === 1) return 'completed';
      if (step === 2) return 'completed';
      if (step === 3) return 'current';
      return 'upcoming';
    }

    if (orderStatus === 'FULFILLED') {
      return 'completed';
    }

    return 'upcoming';
  };

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'FULFILLED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-1 ring-emerald-500/20';
      case 'APPROVED':
      case 'IN_TRANSIT':
      case 'DISPATCHED':
        return 'bg-sky-50 text-sky-700 border-sky-200 ring-1 ring-sky-500/20';
      case 'PENDING':
        return 'bg-amber-50 text-amber-700 border-amber-200 ring-1 ring-amber-500/20';
      case 'REJECTED':
        return 'bg-rose-50 text-rose-700 border-rose-200 ring-1 ring-rose-500/20';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans max-w-7xl mx-auto">
      
      {/* 1. Header Banner */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/90 shadow-sm relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#e20d65]/5 via-purple-500/5 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="flex items-start md:items-center gap-4 relative z-10">
          <div className="bg-[#1c023d] p-3.5 md:p-4 rounded-2xl text-white shadow-md shadow-purple-950/10 shrink-0">
            <Truck className="w-7 h-7 md:w-8 h-8 text-[#e20d65]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-black text-[#1c023d] tracking-tight">
                PO Shipment & Logistics Tracker
              </h1>
              <span className="px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide bg-[#e20d65]/10 text-[#e20d65] border border-[#e20d65]/20 rounded-full">
                Live Telemetry
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-500 mt-1">
              End-to-end procurement order workflow, real-time dispatch milestones, and destination verification
            </p>
          </div>
        </div>

        {onRequestOrder && (
          <button
            onClick={() => onRequestOrder(null)}
            className="px-5 py-3 rounded-2xl btn-tata-magenta font-bold text-xs flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition shrink-0 relative z-10"
          >
            <span>Create PO Request</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 2. Interactive KPI Filter Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        
        {/* Total Orders Card */}
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`text-left p-4 md:p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
            statusFilter === 'ALL'
              ? 'bg-[#1c023d] text-white border-[#1c023d] shadow-md ring-2 ring-[#e20d65]'
              : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${statusFilter === 'ALL' ? 'text-purple-200' : 'text-slate-500'}`}>
              All Active POs
            </span>
            <Boxes className={`w-5 h-5 ${statusFilter === 'ALL' ? 'text-[#e20d65]' : 'text-slate-400'}`} />
          </div>
          <div className="mt-3">
            <div className="text-2xl md:text-3xl font-black">{stats.total}</div>
            <div className={`text-[11px] mt-0.5 ${statusFilter === 'ALL' ? 'text-purple-300' : 'text-slate-400'}`}>
              Total logged requests
            </div>
          </div>
        </button>

        {/* Pending Approval */}
        <button
          onClick={() => setStatusFilter('PENDING')}
          className={`text-left p-4 md:p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
            statusFilter === 'PENDING'
              ? 'bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-400'
              : 'bg-white text-slate-800 border-slate-200 hover:border-amber-200 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${statusFilter === 'PENDING' ? 'text-amber-100' : 'text-amber-700'}`}>
              Pending Approval
            </span>
            <Clock className={`w-5 h-5 ${statusFilter === 'PENDING' ? 'text-white' : 'text-amber-500'}`} />
          </div>
          <div className="mt-3">
            <div className="text-2xl md:text-3xl font-black">{stats.pending}</div>
            <div className={`text-[11px] mt-0.5 ${statusFilter === 'PENDING' ? 'text-amber-100' : 'text-slate-400'}`}>
              Awaiting admin signoff
            </div>
          </div>
        </button>

        {/* In Transit / Approved */}
        <button
          onClick={() => setStatusFilter(statusFilter === 'APPROVED' ? 'ALL' : 'APPROVED')}
          className={`text-left p-4 md:p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
            statusFilter === 'APPROVED' || statusFilter === 'IN_TRANSIT'
              ? 'bg-sky-600 text-white border-sky-700 shadow-md ring-2 ring-sky-400'
              : 'bg-white text-slate-800 border-slate-200 hover:border-sky-200 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${statusFilter === 'APPROVED' ? 'text-sky-100' : 'text-sky-700'}`}>
              In Transit & Dispatched
            </span>
            <Truck className={`w-5 h-5 ${statusFilter === 'APPROVED' ? 'text-white' : 'text-sky-500'}`} />
          </div>
          <div className="mt-3">
            <div className="text-2xl md:text-3xl font-black">{stats.inTransit}</div>
            <div className={`text-[11px] mt-0.5 ${statusFilter === 'APPROVED' ? 'text-sky-100' : 'text-slate-400'}`}>
              On delivery route
            </div>
          </div>
        </button>

        {/* Fulfilled / Delivered */}
        <button
          onClick={() => setStatusFilter('FULFILLED')}
          className={`text-left p-4 md:p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
            statusFilter === 'FULFILLED'
              ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-400'
              : 'bg-white text-slate-800 border-slate-200 hover:border-emerald-200 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${statusFilter === 'FULFILLED' ? 'text-emerald-100' : 'text-emerald-700'}`}>
              Delivered & Closed
            </span>
            <PackageCheck className={`w-5 h-5 ${statusFilter === 'FULFILLED' ? 'text-white' : 'text-emerald-500'}`} />
          </div>
          <div className="mt-3">
            <div className="text-2xl md:text-3xl font-black">{stats.fulfilled}</div>
            <div className={`text-[11px] mt-0.5 ${statusFilter === 'FULFILLED' ? 'text-emerald-100' : 'text-slate-400'}`}>
              Added to hub inventory
            </div>
          </div>
        </button>

      </div>

      {/* 3. Search, Filter & Quick Sort Controls */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        
        {/* Search Bar */}
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by PO #, Item Name, Variant, Hub City, Requester, Tracking ID..."
            className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-9 py-2.5 text-xs md:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#e20d65] focus:bg-white transition"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs px-1 py-0.5 rounded"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filters Group */}
        <div className="flex items-center gap-2 flex-wrap">
          
          {/* Location Filter */}
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#e20d65] transition"
          >
            <option value="ALL">All Destination Hubs</option>
            {uniqueLocations.map(loc => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#e20d65] transition"
          >
            <option value="newest">Sort: Newest First</option>
            <option value="oldest">Sort: Oldest First</option>
            <option value="qty_desc">Quantity: High to Low</option>
            <option value="qty_asc">Quantity: Low to High</option>
          </select>

          {/* Reset Filters */}
          {(searchQuery || statusFilter !== 'ALL' || locationFilter !== 'ALL' || sortBy !== 'newest') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setLocationFilter('ALL');
                setSortBy('newest');
              }}
              title="Reset all filters"
              className="p-2.5 bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-xl transition flex items-center gap-1 text-xs font-bold"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}

        </div>
      </div>

      {/* 4. Master-Detail Interactive View */}
      {filteredOrders.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: Order Selection Master List (5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-3xl p-4 md:p-5 border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between px-1 pb-2 border-b border-slate-100">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                Matching Orders ({filteredOrders.length})
              </span>
              <span className="text-[11px] text-slate-400">Click to inspect</span>
            </div>

            <div className="space-y-2.5 max-h-[620px] overflow-y-auto pr-1">
              {filteredOrders.map((o) => {
                const orderId = getOrderId(o);
                const isSelected = String(orderId) === String(getOrderId(currentOrder));
                return (
                  <div
                    key={orderId}
                    onClick={() => setSelectedOrderId(orderId)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 relative ${
                      isSelected
                        ? 'bg-[#1c023d] text-white border-[#1c023d] shadow-md ring-2 ring-[#e20d65]/60'
                        : 'bg-slate-50/70 hover:bg-slate-100/90 text-slate-800 border-slate-200/80 hover:border-slate-300'
                    }`}
                  >
                    {/* Item Thumbnail */}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center p-1.5 shrink-0 border ${
                      isSelected ? 'bg-white/10 border-white/20' : 'bg-white border-slate-200'
                    }`}>
                      <img 
                        src={getProductImage(o.item_name)} 
                        alt={o.item_name} 
                        className="w-full h-full object-contain"
                      />
                    </div>

                    {/* Meta info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className={`text-[11px] font-mono font-bold ${isSelected ? 'text-purple-300' : 'text-slate-500'}`}>
                          #{orderId}
                        </span>
                        <span className={`text-[9px] uppercase font-black px-2 py-0.5 rounded-full border ${
                          isSelected 
                            ? 'bg-white/20 text-white border-white/30' 
                            : getStatusBadgeStyle(o.status)
                        }`}>
                          {o.status}
                        </span>
                      </div>

                      <h4 className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-[#1c023d]'}`}>
                        {o.item_name}
                      </h4>

                      <div className="flex items-center gap-2 mt-1 text-[11px] flex-wrap">
                        <span className={`px-1.5 py-0.2 rounded font-mono font-medium ${
                          isSelected ? 'bg-white/15 text-purple-200' : 'bg-slate-200/70 text-slate-600'
                        }`}>
                          {o.variant_name}
                        </span>
                        <span className={`truncate ${isSelected ? 'text-purple-200' : 'text-slate-500'}`}>
                          📍 {o.location_name}
                        </span>
                        <span className={`font-mono font-bold ml-auto ${isSelected ? 'text-[#e20d65]' : 'text-slate-700'}`}>
                          {o.quantity_requested}u
                        </span>
                      </div>
                    </div>

                    <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isSelected ? 'text-[#e20d65] translate-x-0.5' : 'text-slate-300'}`} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT COLUMN: Active Order Detail & Live Timeline Dossier (7 cols) */}
          {currentOrder && (
            <div className="lg:col-span-7 space-y-6">
              
              {/* Order Dossier Header Card */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
                
                {/* Top Badge & ID Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-mono font-extrabold text-slate-600 bg-slate-100 px-3 py-1 rounded-xl border border-slate-200">
                      PO ID: #{getOrderId(currentOrder)}
                    </span>
                    <span className={`text-xs uppercase font-black px-3 py-1 rounded-full border ${getStatusBadgeStyle(currentOrder.status)}`}>
                      {currentOrder.status}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Requested: {new Date(currentOrder.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                {/* Product Title & Info */}
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-[#f8f7fc] border border-slate-200 p-2 shrink-0 flex items-center justify-center shadow-inner">
                    <img 
                      src={getProductImage(currentOrder.item_name)} 
                      alt={currentOrder.item_name} 
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl md:text-2xl font-black text-[#1c023d]">
                        {currentOrder.item_name}
                      </h2>
                      <span className="text-xs font-mono font-bold text-[#e20d65] bg-[#e20d65]/10 px-2.5 py-0.5 rounded-lg border border-[#e20d65]/20">
                        {currentOrder.variant_name}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 mt-1">
                      Category: <span className="font-semibold text-slate-700">{currentOrder.category || 'Telecommunication & Infrastructure'}</span> • Requested by: <span className="font-semibold text-slate-800">{currentOrder.requester_name || 'Hub Operations Lead'}</span>
                    </p>
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                    <div className="text-[10px] font-bold uppercase text-slate-400">Order Quantity</div>
                    <div className="text-base font-black text-[#1c023d] mt-0.5 font-mono">
                      {currentOrder.quantity_requested} <span className="text-xs font-normal text-slate-500">units</span>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                    <div className="text-[10px] font-bold uppercase text-slate-400">Destination Hub</div>
                    <div className="text-sm font-bold text-[#1c023d] mt-0.5 truncate">
                      {currentOrder.location_name}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                    <div className="text-[10px] font-bold uppercase text-slate-400">Unit Cost</div>
                    <div className="text-base font-black text-slate-800 mt-0.5 font-mono">
                      ₹{(currentOrder.unit_cost || 450).toLocaleString()}
                    </div>
                  </div>

                  <div className="bg-[#f0ebfa] p-3 rounded-2xl border border-[#e8e2f7]">
                    <div className="text-[10px] font-bold uppercase text-purple-700">Estimated Value</div>
                    <div className="text-base font-black text-[#1c023d] mt-0.5 font-mono">
                      ₹{((currentOrder.quantity_requested || 0) * (currentOrder.unit_cost || 450)).toLocaleString()}
                    </div>
                  </div>

                </div>

                {/* Logistics Route & Carrier Box */}
                <div className="bg-gradient-to-r from-[#f9f8fc] to-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Compass className="w-4 h-4 text-[#e20d65]" />
                      <span className="text-xs font-extrabold uppercase tracking-wide text-[#1c023d]">
                        Logistics Telemetry
                      </span>
                    </div>

                    <span className="text-[11px] font-bold text-slate-500">
                      Carrier: <strong className="text-slate-800">{currentOrder.carrier_name || 'Tata Play Express Logistics'}</strong>
                    </span>
                  </div>

                  {/* Route Indicator */}
                  <div className="flex items-center justify-between gap-3 text-xs bg-white p-3 rounded-xl border border-slate-200/80">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
                      <div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Origin</div>
                        <div className="font-bold text-slate-800">Central Warehouse (Delhi)</div>
                      </div>
                    </div>

                    <div className="flex-1 flex items-center justify-center px-4">
                      <div className="w-full h-0.5 bg-dashed border-t-2 border-dashed border-slate-300 relative flex items-center justify-center">
                        <Truck className="w-4 h-4 text-[#e20d65] absolute -top-2 bg-white px-0.5" />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-right">
                      <div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Destination</div>
                        <div className="font-bold text-[#1c023d]">{currentOrder.location_name}</div>
                      </div>
                      <div className="w-2.5 h-2.5 rounded-full bg-[#e20d65] ring-4 ring-[#e20d65]/20" />
                    </div>
                  </div>

                  {/* Tracking Number & Copy Button */}
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-400 font-medium">Tracking #:</span>
                      <span className="font-mono font-bold text-slate-800">
                        {currentOrder.tracking_number || `TPF-TRK-${String(getOrderId(currentOrder)).padStart(4, '0')}-DL`}
                      </span>
                    </div>

                    <button
                      onClick={() => handleCopyTracking(currentOrder.tracking_number || `TPF-TRK-${String(getOrderId(currentOrder)).padStart(4, '0')}-DL`)}
                      className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                    >
                      {copiedTracking ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-600">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          <span>Copy AWB</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Rejection Alert if Rejected */}
                {currentOrder.status === 'REJECTED' && (
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800">
                    <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <strong className="font-bold block text-sm">Purchase Order Request Declined</strong>
                      This request was not approved by Central Administration due to inventory quota or budget reconciliation.
                    </div>
                  </div>
                )}

              </div>

              {/* Multi-Stage Visual Stepper Timeline */}
              <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-wider text-[#1c023d] flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#e20d65]" />
                    Live Shipment Timeline & Milestones
                  </h3>
                  <span className="text-xs text-slate-400 font-medium">Standard SLA: 24-48 Hours</span>
                </div>

                <div className="relative pt-2 pb-2">
                  
                  {/* Stepper Columns */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative z-10">
                    
                    {/* Step 1: Requested */}
                    {(() => {
                      const status = getStepStatus(currentOrder.status, 1);
                      const isComplete = status === 'completed';
                      return (
                        <div className="flex md:flex-col items-center md:text-center gap-3">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold shadow-md transition-all ${
                            isComplete ? 'bg-emerald-600 text-white ring-4 ring-emerald-100' : 'bg-slate-100 text-slate-400'
                          }`}>
                            <CheckCircle2 className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="text-xs font-black text-[#1c023d]">1. Request Created</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {currentOrder.requester_name || 'Hub Manager'}
                            </div>
                            <div className="text-[10px] text-emerald-600 font-bold mt-0.5">Verified</div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Step 2: Approval */}
                    {(() => {
                      const status = getStepStatus(currentOrder.status, 2);
                      const isComplete = status === 'completed';
                      const isCurrent = status === 'current';
                      return (
                        <div className="flex md:flex-col items-center md:text-center gap-3">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold shadow-md transition-all ${
                            isComplete 
                              ? 'bg-emerald-600 text-white ring-4 ring-emerald-100' 
                              : isCurrent 
                              ? 'bg-amber-500 text-white ring-4 ring-amber-100 animate-pulse' 
                              : 'bg-slate-100 text-slate-400'
                          }`}>
                            <Building2 className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="text-xs font-black text-[#1c023d]">2. Central Approval</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {currentOrder.status === 'PENDING' ? 'Awaiting Signoff' : 'Admin Approved'}
                            </div>
                            <div className={`text-[10px] font-bold mt-0.5 ${isComplete ? 'text-emerald-600' : isCurrent ? 'text-amber-600' : 'text-slate-400'}`}>
                              {isComplete ? 'Approved' : isCurrent ? 'In Queue' : 'Pending'}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Step 3: Dispatch & In Transit */}
                    {(() => {
                      const status = getStepStatus(currentOrder.status, 3);
                      const isComplete = status === 'completed';
                      const isCurrent = status === 'current';
                      return (
                        <div className="flex md:flex-col items-center md:text-center gap-3">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold shadow-md transition-all ${
                            isComplete 
                              ? 'bg-emerald-600 text-white ring-4 ring-emerald-100' 
                              : isCurrent 
                              ? 'bg-sky-500 text-white ring-4 ring-sky-100 animate-pulse' 
                              : 'bg-slate-100 text-slate-400'
                          }`}>
                            <Truck className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="text-xs font-black text-[#1c023d]">3. In Transit</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {currentOrder.location_name} Route
                            </div>
                            <div className={`text-[10px] font-bold mt-0.5 ${isComplete ? 'text-emerald-600' : isCurrent ? 'text-sky-600' : 'text-slate-400'}`}>
                              {isComplete ? 'Dispatched' : isCurrent ? 'En Route' : 'Awaiting Dispatch'}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Step 4: Fulfilled / Delivered */}
                    {(() => {
                      const status = getStepStatus(currentOrder.status, 4);
                      const isComplete = status === 'completed';
                      return (
                        <div className="flex md:flex-col items-center md:text-center gap-3">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold shadow-md transition-all ${
                            isComplete ? 'bg-emerald-600 text-white ring-4 ring-emerald-100' : 'bg-slate-100 text-slate-400'
                          }`}>
                            <PackageCheck className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="text-xs font-black text-[#1c023d]">4. Delivered & Stocked</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {currentOrder.location_name}
                            </div>
                            <div className={`text-[10px] font-bold mt-0.5 ${isComplete ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {isComplete ? 'Completed' : 'Upcoming'}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                  </div>
                </div>

              </div>

            </div>
          )}

        </div>
      ) : (
        /* Empty Filter Results State */
        <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Search className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-black text-[#1c023d]">No Purchase Orders Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              We couldn't find any procurement orders matching your search filters. Try adjusting your query or resetting filters.
            </p>
          </div>
          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('ALL');
              setLocationFilter('ALL');
              setSortBy('newest');
            }}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition inline-flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Search & Filters</span>
          </button>
        </div>
      )}

      {/* 5. Comprehensive Purchase Orders Data Table Log */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-base font-black text-[#1c023d] tracking-tight">
              All Orders Master Telemetry Log
            </h3>
            <p className="text-xs text-slate-500">Comprehensive table log across all regional warehouse hubs</p>
          </div>

          <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-xl">
            Showing {filteredOrders.length} of {orders.length} POs
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-2xl">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600 font-bold uppercase bg-slate-50/80">
                <th className="py-3.5 px-4">PO Number</th>
                <th className="py-3.5 px-4">Item & Variant</th>
                <th className="py-3.5 px-4">Destination Hub</th>
                <th className="py-3.5 px-4 text-center">Requested Units</th>
                <th className="py-3.5 px-4">Carrier & Tracking</th>
                <th className="py-3.5 px-4">Current Status</th>
                <th className="py-3.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length > 0 ? (
                filteredOrders.map((o) => {
                  const orderId = getOrderId(o);
                  const isSelected = String(orderId) === String(getOrderId(currentOrder));
                  return (
                    <tr
                      key={orderId}
                      onClick={() => setSelectedOrderId(orderId)}
                      className={`hover:bg-purple-50/50 cursor-pointer transition ${
                        isSelected ? 'bg-[#f5effc]' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-600">
                        #{orderId}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <img 
                            src={getProductImage(o.item_name)} 
                            alt={o.item_name} 
                            className="w-8 h-8 object-contain rounded-lg bg-slate-100 p-1 shrink-0" 
                          />
                          <div>
                            <span className="font-bold text-[#1c023d] block">{o.item_name}</span>
                            <span className="text-[11px] text-[#e20d65] font-mono font-semibold">Variant: {o.variant_name}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 block">{o.location_name}</span>
                        <span className="text-[10px] text-slate-400">By {o.requester_name || 'Hub Manager'}</span>
                      </td>

                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-900">
                        {o.quantity_requested}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-700 block">{o.carrier_name || 'Tata Play Express'}</span>
                        <span className="text-[10px] font-mono text-slate-400">{o.tracking_number || `TPF-TRK-${String(orderId).padStart(4, '0')}`}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full border ${getStatusBadgeStyle(o.status)}`}>
                          {o.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrderId(orderId);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-[#1c023d] hover:bg-[#e20d65] hover:text-white hover:border-[#e20d65] transition shadow-sm inline-flex items-center gap-1"
                        >
                          <span>Track</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400 text-xs font-semibold">
                    No orders matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
