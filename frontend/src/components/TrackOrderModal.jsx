import React, { useState, useMemo } from 'react';
import { Search, PackageCheck, Clock, CheckCircle2, XCircle, Truck, MapPin, Building2, ChevronRight, X, Copy, Check, Calendar } from 'lucide-react';
import { getProductImage } from '../utils/imageHelper';

export const TrackOrderModal = ({ isOpen, onClose, orders = [] }) => {
  const getOrderId = (o) => o?.order_id ?? o?.request_id ?? null;
  const [selectedOrderId, setSelectedOrderId] = useState(getOrderId(orders[0]) || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedTracking, setCopiedTracking] = useState(false);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const id = String(getOrderId(o) || '');
      const item = (o.item_name || '').toLowerCase();
      const loc = (o.location_name || '').toLowerCase();
      const variant = (o.variant_name || '').toLowerCase();
      const query = searchQuery.trim().toLowerCase();

      return !query || id.includes(query) || item.includes(query) || loc.includes(query) || variant.includes(query);
    });
  }, [orders, searchQuery]);

  const currentOrder = useMemo(() => {
    if (!orders.length) return null;
    const found = orders.find(o => String(getOrderId(o)) === String(selectedOrderId));
    return found || filteredOrders[0] || orders[0];
  }, [orders, selectedOrderId, filteredOrders]);

  if (!isOpen) return null;

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
      if (step <= 2) return 'completed';
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
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 font-sans animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-3xl w-full p-6 md:p-8 border border-slate-200 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-6 pr-8">
          <div className="bg-[#1c023d] p-3.5 rounded-2xl text-white shadow-md">
            <Truck className="w-6 h-6 text-[#e20d65]" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black text-[#1c023d] tracking-tight">
              PO Shipment Progress & Tracking
            </h2>
            <p className="text-xs text-slate-500">Live multi-stage telemetry for Tata Play Fiber regional hubs</p>
          </div>
        </div>

        {/* Order Select Dropdown / Quick Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <div>
            <label className="block text-[11px] font-black text-[#1c023d] uppercase tracking-wider mb-1.5">
              Select Active Purchase Order
            </label>
            <select
              value={getOrderId(currentOrder) || ''}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#1c023d] focus:outline-none focus:border-[#e20d65]"
            >
              {orders.map((o) => {
                const oid = getOrderId(o);
                return (
                  <option key={oid} value={oid}>
                    PO #{oid} - {o.item_name} ({o.location_name}) [{o.status}]
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-black text-[#1c023d] uppercase tracking-wider mb-1.5">
              Filter by PO # or Hub Name
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type PO #, Modem, Delhi, Mumbai..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#e20d65]"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>
        </div>

        {currentOrder ? (
          <div className="space-y-6">
            
            {/* Selected Order Detail Header Box */}
            <div className="bg-[#f8f7fc] rounded-2xl p-5 border border-[#e8e2f7] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img 
                    src={getProductImage(currentOrder.item_name)} 
                    alt={currentOrder.item_name} 
                    className="w-12 h-12 object-contain rounded-xl bg-white p-1.5 border border-slate-200 shrink-0"
                  />
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-mono font-extrabold text-slate-600 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200">
                        PO #{getOrderId(currentOrder)}
                      </span>
                      <span className={`text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full border ${getStatusBadgeStyle(currentOrder.status)}`}>
                        {currentOrder.status}
                      </span>
                    </div>
                    <h3 className="text-base font-black text-[#1c023d]">
                      {currentOrder.item_name} <span className="text-[#e20d65] font-mono text-xs">({currentOrder.variant_name})</span>
                    </h3>
                  </div>
                </div>

                <div className="text-left sm:text-right bg-white p-3 rounded-xl border border-slate-200 shrink-0">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Estimated SLA</div>
                  <div className="text-xs font-bold text-[#e20d65]">{currentOrder.estimated_delivery || '24-48 Hours'}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {new Date(currentOrder.created_at || Date.now()).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Order Meta Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs pt-1 border-t border-purple-100/80">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Destination Hub</span>
                  <span className="font-bold text-slate-800">{currentOrder.location_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Requested Quantity</span>
                  <span className="font-bold font-mono text-[#1c023d]">{currentOrder.quantity_requested} units</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Requester</span>
                  <span className="font-bold text-slate-800">{currentOrder.requester_name || 'Hub Operations Lead'}</span>
                </div>
              </div>
            </div>

            {/* Visual Shipment Timeline Stepper */}
            <div className="py-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-6 flex items-center justify-between">
                <span>Shipment Milestones</span>
                <span className="text-[10px] font-normal text-slate-400">Step {currentOrder.status === 'FULFILLED' ? 4 : currentOrder.status === 'APPROVED' ? 3 : currentOrder.status === 'PENDING' ? 2 : 1} of 4</span>
              </h4>

              <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                
                {/* Step 1 */}
                {(() => {
                  const status = getStepStatus(currentOrder.status, 1);
                  return (
                    <div className="flex md:flex-col items-center gap-3 relative z-10 w-full text-left md:text-center">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shadow-md transition ${
                        status === 'completed' ? 'bg-emerald-600 text-white ring-4 ring-emerald-100' : 'bg-slate-200 text-slate-500'
                      }`}>
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-black text-[#1c023d]">1. PO Requested</div>
                        <div className="text-[10px] text-slate-500">{currentOrder.requester_name || 'Hub Manager'}</div>
                      </div>
                    </div>
                  );
                })()}

                {/* Connector Line 1 */}
                <div className="hidden md:block flex-1 h-0.5 bg-slate-200 -mt-6" />

                {/* Step 2 */}
                {(() => {
                  const status = getStepStatus(currentOrder.status, 2);
                  const isComplete = status === 'completed';
                  const isCurrent = status === 'current';
                  return (
                    <div className="flex md:flex-col items-center gap-3 relative z-10 w-full text-left md:text-center">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shadow-md transition ${
                        isComplete ? 'bg-emerald-600 text-white ring-4 ring-emerald-100' : isCurrent ? 'bg-amber-500 text-white ring-4 ring-amber-100 animate-pulse' : 'bg-slate-200 text-slate-500'
                      }`}>
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-black text-[#1c023d]">2. Central Approval</div>
                        <div className="text-[10px] text-slate-500">
                          {currentOrder.status === 'PENDING' ? 'Awaiting Approval' : 'Approved by Admin'}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Connector Line 2 */}
                <div className="hidden md:block flex-1 h-0.5 bg-slate-200 -mt-6" />

                {/* Step 3 */}
                {(() => {
                  const status = getStepStatus(currentOrder.status, 3);
                  const isComplete = status === 'completed';
                  const isCurrent = status === 'current';
                  return (
                    <div className="flex md:flex-col items-center gap-3 relative z-10 w-full text-left md:text-center">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shadow-md transition ${
                        isComplete ? 'bg-emerald-600 text-white ring-4 ring-emerald-100' : isCurrent ? 'bg-sky-500 text-white ring-4 ring-sky-100 animate-pulse' : 'bg-slate-200 text-slate-500'
                      }`}>
                        <Truck className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-black text-[#1c023d]">3. In Transit</div>
                        <div className="text-[10px] text-slate-500">Dispatched to {currentOrder.location_name}</div>
                      </div>
                    </div>
                  );
                })()}

                {/* Connector Line 3 */}
                <div className="hidden md:block flex-1 h-0.5 bg-slate-200 -mt-6" />

                {/* Step 4 */}
                {(() => {
                  const status = getStepStatus(currentOrder.status, 4);
                  const isComplete = status === 'completed';
                  return (
                    <div className="flex md:flex-col items-center gap-3 relative z-10 w-full text-left md:text-center">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shadow-md transition ${
                        isComplete ? 'bg-emerald-600 text-white ring-4 ring-emerald-100' : 'bg-slate-200 text-slate-500'
                      }`}>
                        <PackageCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-black text-[#1c023d]">4. Delivered</div>
                        <div className="text-[10px] text-slate-500">Added to Local Stock</div>
                      </div>
                    </div>
                  );
                })()}

              </div>
            </div>

            {/* Carrier & Tracking Bar */}
            <div className="flex items-center justify-between gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Carrier:</span>
                <span className="font-bold text-slate-800">{currentOrder.carrier_name || 'Tata Play Express'}</span>
                <span className="text-slate-300">|</span>
                <span className="font-mono text-slate-600">{currentOrder.tracking_number || `TPF-TRK-${String(getOrderId(currentOrder)).padStart(4, '0')}`}</span>
              </div>

              <button
                onClick={() => handleCopyTracking(currentOrder.tracking_number || `TPF-TRK-${String(getOrderId(currentOrder)).padStart(4, '0')}`)}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-[11px] font-bold flex items-center gap-1 shadow-sm transition"
              >
                {copiedTracking ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-400" />}
                <span>{copiedTracking ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

          </div>
        ) : (
          <div className="text-center py-12 text-slate-400 text-xs font-semibold">
            No procurement orders found matching your search.
          </div>
        )}

      </div>
    </div>
  );
};
