import React, { useState } from 'react';
import { ShoppingCart, Download, Search, CheckCircle2, XCircle, Truck, PackageCheck, AlertCircle, Cpu, Layers, MapPin, Calendar, Clock, Sparkles } from 'lucide-react';
import { exportToCSV } from '../utils/exportHelper';
import { isCreatedToday, formatTimeOrDate } from '../utils/dateHelper';
import { useAuth } from '../context/AuthContext';

export const RequestsSection = ({
  requests = [],
  onRequestSubmit,
  onApprove,
  onReject,
  onDispatch,
  onConfirmDelivery,
  isCentralAdmin = false
}) => {
  const { user } = useAuth();
  const effectiveRole = user?.role || (isCentralAdmin ? 'SUPER_ADMIN' : 'MANAGER');
  const isSuperAdmin = effectiveRole === 'SUPER_ADMIN' || effectiveRole === 'CENTRAL_ADMIN';
  const isRegionalAdmin = effectiveRole === 'REGIONAL_ADMIN';
  const isManager = effectiveRole === 'MANAGER' || effectiveRole === 'LOCATION_MANAGER';
  const isFieldWorker = effectiveRole === 'FIELD_WORKER';

  const [timeFilter, setTimeFilter] = useState('ALL'); // 'ALL' | 'TODAY'
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedDispatchReq, setSelectedDispatchReq] = useState(null);
  const [carrierName, setCarrierName] = useState('Tata Play Express Logistics');
  const [trackingNumber, setTrackingNumber] = useState('');

  const todayCount = requests.filter(r => isCreatedToday(r.created_at)).length;

  const filteredRequests = requests.filter(r => {
    const matchesTime = timeFilter === 'ALL' || isCreatedToday(r.created_at);
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    const matchesSearch = (
      (r.item_name || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
      (r.location_name || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
      (r.region_name || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
      (r.city || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
      (r.requester_name || '').toLowerCase().includes(searchFilter.toLowerCase())
    );
    return matchesTime && matchesStatus && matchesSearch;
  });

  const handleExportCSV = () => {
    exportToCSV('city_stock_requests_report.csv', filteredRequests, [
      { label: 'Request ID', key: 'request_id' },
      { label: 'Region', key: 'region_name' },
      { label: 'City Hub', key: 'location_name' },
      { label: 'Item Name', key: 'item_name' },
      { label: 'Variant', key: 'variant_name' },
      { label: 'Quantity Requested', key: 'quantity_requested' },
      { label: 'Status', key: 'status' },
      { label: 'Requester', key: 'requester_name' },
      { label: 'Carrier', key: 'carrier_name' },
      { label: 'Tracking #', key: 'tracking_number' },
      { label: 'Request Date', key: 'created_at' }
    ]);
  };

  const handleDispatchSubmit = (e) => {
    e.preventDefault();
    if (!selectedDispatchReq) return;
    onDispatch(selectedDispatchReq.request_id, {
      carrier_name: carrierName,
      tracking_number: trackingNumber || `TPF-TRK-${String(selectedDispatchReq.request_id).padStart(4, '0')}`,
      estimated_delivery: "2 Business Days"
    });
    setSelectedDispatchReq(null);
  };

  const pendingCount = requests.filter(r => r.status === 'PENDING').length;
  const dispatchedCount = requests.filter(r => r.status === 'DISPATCHED').length;
  const deliveredCount = requests.filter(r => r.status === 'DELIVERED').length;

  return (
    <div className="space-y-5 font-sans w-full max-w-[1600px] mx-auto pb-16">
      
      {/* Header Banner */}
      <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded bg-[#1c023d] text-white flex items-center justify-center shrink-0">
              <ShoppingCart className="w-4 h-4 text-[#e20d65]" />
            </div>
            <h1 className="text-xl md:text-2xl font-black text-[#1c023d] tracking-tight">
              {isSuperAdmin ? 'Global Warehouse Stock Requests' : isRegionalAdmin ? `Regional Stock Approvals (${user?.region_name || 'My Region'})` : 'City Stock Requests & Delivery'}
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            {isSuperAdmin 
              ? 'Central dispatch overview across all regions and territories in India.'
              : isRegionalAdmin
              ? 'Review and approve stock replenishment requests from city managers in your assigned region.'
              : 'Submit bulk stock refill requests for your city team and confirm delivery.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 font-bold text-xs">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-xs transition flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Export CSV</span>
          </button>

          {isManager && (
            <button
              onClick={onRequestSubmit}
              className="px-4 py-2 rounded bg-[#e20d65] hover:bg-[#cc0059] text-white shadow-xs transition flex items-center gap-1.5"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>+ Create New Request</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick Summary Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Requests</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <p className="text-2xl font-black text-[#1c023d] font-mono">{requests.length}</p>
              {todayCount > 0 && (
                <span className="text-[11px] font-bold text-[#e20d65]">
                  ({todayCount} Today)
                </span>
              )}
            </div>
          </div>
          <span className="p-2.5 rounded bg-purple-50 text-[#6700ce] border border-purple-100">
            <ShoppingCart className="w-4 h-4" />
          </span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Pending Regional Approval</p>
            <p className="text-2xl font-black text-amber-600 font-mono mt-0.5">{pendingCount}</p>
          </div>
          <span className="p-2.5 rounded bg-amber-50 text-amber-600 border border-amber-100">
            <AlertCircle className="w-4 h-4" />
          </span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">In-Transit Dispatches</p>
            <p className="text-2xl font-black text-sky-600 font-mono mt-0.5">{dispatchedCount}</p>
          </div>
          <span className="p-2.5 rounded bg-sky-50 text-sky-600 border border-sky-100">
            <Truck className="w-4 h-4" />
          </span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Delivered & Stocked</p>
            <p className="text-2xl font-black text-emerald-600 font-mono mt-0.5">{deliveredCount}</p>
          </div>
          <span className="p-2.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100">
            <CheckCircle2 className="w-4 h-4" />
          </span>
        </div>
      </div>

      {/* Filter Bar with Today Scope */}
      <div className="bg-white rounded-lg p-3 border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Today vs All Time Scope Toggle */}
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
              <span>All ({requests.length})</span>
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
              <span>Today's Requests</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                timeFilter === 'TODAY' ? 'bg-[#e20d65] text-white' : 'bg-purple-100 text-[#6700ce]'
              }`}>
                {todayCount}
              </span>
            </button>
          </div>

          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          {/* Status Filters */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
            <span className="text-slate-500 uppercase tracking-wider text-[10px] mr-0.5">Status:</span>
            {['ALL', 'PENDING', 'APPROVED', 'DISPATCHED', 'DELIVERED', 'REJECTED'].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded text-xs transition cursor-pointer ${
                  statusFilter === st
                    ? 'bg-[#1c023d] text-white font-bold shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filter by city, region, SKU, requester..."
            className="w-full pl-8 pr-3 py-1.5 rounded border border-slate-300 text-xs focus:outline-none focus:border-[#e20d65]"
          />
        </div>
      </div>

      {timeFilter === 'TODAY' && (
        <div className="px-3.5 py-2 rounded-lg bg-purple-50 border border-purple-200 text-purple-900 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#e20d65]" />
            <span>Showing <strong>Today's Requests</strong> ({filteredRequests.length} matching current status filter).</span>
          </div>
          <button
            onClick={() => setTimeFilter('ALL')}
            className="text-[#6700ce] hover:underline font-bold text-[11px] cursor-pointer"
          >
            Show All Time Records ➔
          </button>
        </div>
      )}

      {/* Requests Data Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden w-full">
        {filteredRequests.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs font-semibold bg-slate-50">
            <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-2 opacity-80" />
            <p className="font-bold text-slate-700 text-sm">
              {timeFilter === 'TODAY' ? "No stock requests submitted today." : "No stock requests match current filter."}
            </p>
            {timeFilter === 'TODAY' && (
              <button
                onClick={() => setTimeFilter('ALL')}
                className="mt-2 text-[#e20d65] font-bold text-xs hover:underline cursor-pointer"
              >
                Switch to All Time ({requests.length} total)
              </button>
            )}
          </div>
        ) : (
          <div className="max-h-[620px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200 z-10">
                <tr>
                  <th className="py-2.5 px-3.5">Req ID & Time</th>
                  <th className="py-2.5 px-3.5">Region & City Hub</th>
                  <th className="py-2.5 px-3.5">Item & SKU Variant</th>
                  <th className="py-2.5 px-3.5 text-center">Units Requested</th>
                  <th className="py-2.5 px-3.5">Requester</th>
                  <th className="py-2.5 px-3.5">Status</th>
                  <th className="py-2.5 px-3.5">Carrier & Tracking</th>
                  <th className="py-2.5 px-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredRequests.map((r) => (
                  <tr key={r.request_id} className="hover:bg-purple-50/40 even:bg-slate-50/30 transition">
                    <td className="py-2.5 px-3.5">
                      <div className="flex items-center gap-1.5 font-mono font-bold text-slate-700">
                        <span>#{r.request_id}</span>
                        {isCreatedToday(r.created_at) && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] font-black uppercase tracking-wider border border-amber-300">
                            Today
                          </span>
                        )}
                      </div>
                      <div className="text-[10.5px] text-slate-400 font-sans mt-0.5">
                        {formatTimeOrDate(r.created_at)}
                      </div>
                    </td>
                    <td className="py-2.5 px-3.5">
                      <div className="font-extrabold text-slate-800 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#e20d65] shrink-0" />
                        <span>{r.location_name}</span>
                      </div>
                      {r.region_name && (
                        <span className="text-[10px] text-indigo-600 font-semibold block ml-4">
                          {r.region_name}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5">
                      <span className="font-bold text-[#1c023d] block">{r.item_name}</span>
                      <span className="text-[11px] text-[#e20d65] font-mono font-semibold">Variant: {r.variant_name}</span>
                    </td>
                    <td className="py-2.5 px-3.5 text-center font-mono font-bold text-[#1c023d]">
                      {r.quantity_requested}
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-700">
                      <span className="font-semibold">{r.requester_name}</span>
                    </td>
                    <td className="py-2.5 px-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border inline-block ${
                        r.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        r.status === 'APPROVED' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                        r.status === 'DISPATCHED' ? 'bg-sky-50 text-sky-700 border-sky-200' :
                        r.status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-xs font-mono text-slate-600">
                      {r.tracking_number ? (
                        <div>
                          <p className="font-bold text-slate-800 font-sans text-[11px]">{r.carrier_name}</p>
                          <p className="text-[10px] text-purple-600">{r.tracking_number}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-normal">Not dispatched yet</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Regional Admin Approval Controls */}
                        {r.status === 'PENDING' && (isRegionalAdmin || isSuperAdmin) && (
                          <>
                            <button
                              onClick={() => onApprove(r.request_id)}
                              className="px-2.5 py-1 rounded text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => onReject(r.request_id)}
                              className="px-2.5 py-1 rounded text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition flex items-center gap-1"
                            >
                              <XCircle className="w-3 h-3" />
                              <span>Reject</span>
                            </button>
                          </>
                        )}

                        {/* Super Admin Central Dispatch Control */}
                        {r.status === 'APPROVED' && isSuperAdmin && (
                          <button
                            onClick={() => setSelectedDispatchReq(r)}
                            className="px-3 py-1 rounded text-xs font-bold bg-[#e20d65] hover:bg-[#cc0059] text-white shadow-xs transition flex items-center gap-1"
                          >
                            <Truck className="w-3 h-3" />
                            <span>Dispatch</span>
                          </button>
                        )}

                        {/* Awaiting Central Dispatch */}
                        {r.status === 'APPROVED' && !isSuperAdmin && (
                          <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono text-[10px] font-bold border border-indigo-200">
                            Approved — Ready for Dispatch
                          </span>
                        )}

                        {/* Manager & Field Worker Receipt Confirmation */}
                        {r.status === 'DISPATCHED' && (isManager || isFieldWorker) && (
                          <button
                            onClick={() => onConfirmDelivery(r.request_id)}
                            className="px-3 py-1 rounded text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition flex items-center gap-1"
                          >
                            <PackageCheck className="w-3.5 h-3.5" />
                            <span>Confirm Receipt</span>
                          </button>
                        )}

                        {r.status === 'DISPATCHED' && (isSuperAdmin || isRegionalAdmin) && (
                          <span className="text-xs text-sky-600 font-mono font-bold">In-Transit</span>
                        )}

                        {r.status === 'DELIVERED' && (
                          <span className="text-xs text-emerald-600 font-bold flex items-center justify-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Delivered
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Admin Dispatch Modal */}
      {selectedDispatchReq && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-5 border border-slate-200 shadow-xl">
            <h3 className="text-base font-black text-[#1c023d] mb-1">Dispatch Stock Request #{selectedDispatchReq.request_id}</h3>
            <p className="text-xs text-slate-500 mb-3">
              Dispatching <strong className="text-slate-900">{selectedDispatchReq.quantity_requested}x {selectedDispatchReq.item_name}</strong> to <strong className="text-[#6700ce]">{selectedDispatchReq.location_name}</strong>.
            </p>

            <form onSubmit={handleDispatchSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Logistics Carrier Name</label>
                <input
                  type="text"
                  required
                  value={carrierName}
                  onChange={(e) => setCarrierName(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-slate-50 border border-slate-300 font-semibold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Tracking Number</label>
                <input
                  type="text"
                  required
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder={`e.g. TPF-TRK-${String(selectedDispatchReq.request_id).padStart(4, '0')}-882`}
                  className="w-full px-3 py-2 rounded bg-slate-50 border border-slate-300 font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDispatchReq(null)}
                  className="px-3.5 py-1.5 rounded bg-slate-100 text-slate-700 font-bold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-[#e20d65] hover:bg-[#cc0059] text-white font-bold flex items-center gap-1.5 shadow-xs"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Confirm Dispatch</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
