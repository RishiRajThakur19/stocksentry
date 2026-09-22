import React, { useState } from 'react';
import { ShoppingCart, CheckCircle2, XCircle, Clock, ArrowRight, PackageCheck, Truck, Send } from 'lucide-react';

export const ProcurementOrdersSection = ({ orders, onRequestOrder, onApproveOrder, onRejectOrder, onDispatchOrder, onFulfillOrder, isCentralAdmin, userLocationId }) => {
  const pendingOrders = orders.filter(o => o.status === 'PENDING');
  
  // Dispatch Modal state
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [targetOrder, setTargetOrder] = useState(null);
  const [carrierName, setCarrierName] = useState('Tata Play Express Logistics / BlueDart');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState('2-3 Business Days');

  // Filter orders for manager view if not central admin
  const filteredOrders = isCentralAdmin 
    ? orders 
    : orders.filter(o => o.location_id === userLocationId);

  const handleOpenDispatch = (order) => {
    setTargetOrder(order);
    setTrackingNumber(`TPF-TRK-${String(order.order_id).padStart(4, '0')}-${Math.floor(100 + Math.random() * 900)}`);
    setIsDispatchModalOpen(true);
  };


  const handleDispatchSubmit = async (e) => {
    e.preventDefault();
    if (!targetOrder) return;
    await onDispatchOrder(targetOrder.order_id, {
      carrier_name: carrierName,
      tracking_number: trackingNumber,
      estimated_delivery: estimatedDelivery
    });
    setIsDispatchModalOpen(false);
    setTargetOrder(null);
  };

  return (
    <div className="space-y-6 pb-12 font-sans w-full">
      
      {/* Header Banner */}
      <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="bg-purple-50 p-3.5 rounded text-[#6700ce] border border-purple-100">
            <ShoppingCart className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#1c023d] tracking-tight">
              {isCentralAdmin ? 'Global Procurement PO Approvals & Shipment Tracking' : 'My Hub Procurement Orders'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {isCentralAdmin ? 'Approve manager order requests, dispatch shipments, and monitor live deliveries.' : 'Track your requested purchase orders and confirm physical delivery arrivals.'}
            </p>
          </div>
        </div>

        {!isCentralAdmin && (
          <button
            onClick={() => onRequestOrder(null)}
            className="px-4 py-2.5 rounded font-extrabold text-xs bg-[#e20d65] hover:bg-[#cc0059] text-white flex items-center gap-2 shadow-sm transition shrink-0 min-h-[44px]"
          >
            <span>+ Request Procurement Order</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Pending Approval Queue Card (Admin only) */}
      {isCentralAdmin && (
        <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm space-y-4 w-full">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-[#1c023d] flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              <span>Pending PO Approval Queue</span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                {pendingOrders.length} Pending Approval
              </span>
            </h2>
          </div>

          {pendingOrders.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs font-bold bg-slate-50 rounded border border-slate-200">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
              No pending procurement requests. Approval queue is clear!
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600 font-bold uppercase bg-slate-50 sticky top-0 z-10">
                    <th className="py-3 px-4">PO ID</th>
                    <th className="py-3 px-4">Destination Hub</th>
                    <th className="py-3 px-4">Item & Variant</th>
                    <th className="py-3 px-4 text-center">Qty Requested</th>
                    <th className="py-3 px-4">Requested By</th>
                    <th className="py-3 px-4 text-center">Admin Approval Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {pendingOrders.map((o) => (
                    <tr key={o.order_id} className="hover:bg-slate-50 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-500">#{o.order_id}</td>
                      <td className="py-3.5 px-4 font-extrabold text-[#1c023d]">{o.location_name}</td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-[#1c023d]">{o.item_name}</span>
                        <span className="text-xs text-[#e20d65] font-mono block">Variant: {o.variant_name}</span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-black text-[#1c023d] text-base">{o.quantity_requested}</td>
                      <td className="py-3.5 px-4 text-slate-700">{o.requester_name}</td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => onApproveOrder(o.order_id)}
                            className="px-3.5 py-2 rounded text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition flex items-center gap-1.5 min-h-[44px]"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Approve Order</span>
                          </button>
                          <button
                            onClick={() => onRejectOrder(o.order_id)}
                            className="px-3.5 py-2 rounded text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition flex items-center gap-1.5 min-h-[44px]"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Reject Order</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Global Procurement Orders & Shipment Tracking Log */}
      <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm space-y-4 w-full">
        <h2 className="text-base font-extrabold text-[#1c023d] uppercase tracking-wider flex items-center gap-2">
          <Truck className="w-5 h-5 text-[#6700ce]" />
          <span>{isCentralAdmin ? 'Global Orders Shipment Tracking Portal' : 'My Location Procurement Orders Log'}</span>
        </h2>
        
        <div className="overflow-x-auto border border-slate-200 rounded">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600 font-bold uppercase bg-slate-50 sticky top-0 z-10">
                <th className="py-3 px-4">PO ID</th>
                <th className="py-3 px-4">Destination Hub</th>
                <th className="py-3 px-4">Item & Variant</th>
                <th className="py-3 px-4 text-center">Qty</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Action / Carrier Tracking</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-slate-400">
                    No procurement orders found.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => {
                  const isApproved = o.status === 'APPROVED';
                  const isInTransit = o.status === 'IN_TRANSIT';
                  const isFulfilled = o.status === 'FULFILLED';
                  const isPending = o.status === 'PENDING';

                  const isManagerRecipient = !isCentralAdmin && userLocationId === o.location_id;

                  return (
                    <tr key={o.order_id} className="hover:bg-slate-50 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-500">#{o.order_id}</td>
                      <td className="py-3.5 px-4 font-extrabold text-[#1c023d]">{o.location_name}</td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-[#1c023d]">{o.item_name}</span>
                        <span className="text-xs text-[#e20d65] font-mono block">Variant: {o.variant_name}</span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-black text-[#1c023d] text-base">{o.quantity_requested}</td>
                      <td className="py-3.5 px-4">
                        <span className={`text-[10px] uppercase font-black px-2.5 py-1 rounded border ${
                          isApproved ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 
                          isInTransit ? 'bg-sky-50 text-sky-700 border-sky-200 animate-pulse' :
                          isFulfilled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                          isPending ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                          'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {isInTransit ? 'IN TRANSIT' : o.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {/* Admin Dispatch button for APPROVED orders */}
                        {isApproved && isCentralAdmin ? (
                          <button
                            onClick={() => handleOpenDispatch(o)}
                            className="px-3 py-1.5 rounded text-xs font-bold bg-[#6700ce] hover:bg-[#5200a5] text-white shadow-sm transition flex items-center gap-1.5 mx-auto min-h-[44px]"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Dispatch Order</span>
                          </button>
                        ) : isInTransit && isManagerRecipient ? (
                          <button
                            onClick={() => onFulfillOrder(o.order_id)}
                            className="px-3 py-1.5 rounded text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition flex items-center gap-1.5 mx-auto min-h-[44px]"
                          >
                            <PackageCheck className="w-4 h-4" />
                            <span>Confirm Delivery Arrival</span>
                          </button>
                        ) : isInTransit ? (
                          <div className="text-xs text-sky-800 font-mono">
                            <span className="font-bold block">{o.tracking_number || 'TRK-IN-TRANSIT'}</span>
                            <span className="text-[10px] text-slate-500">{o.carrier_name}</span>
                          </div>
                        ) : isFulfilled ? (
                          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Delivered & Stock Added
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 font-mono">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dispatch Modal */}
      {isDispatchModalOpen && targetOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-black text-[#1c023d]">Dispatch Order #{targetOrder.order_id}</h3>
            <p className="text-xs text-slate-500">Provide shipping carrier details to mark order as IN_TRANSIT.</p>

            <form onSubmit={handleDispatchSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Shipping Carrier</label>
                <input
                  type="text"
                  value={carrierName}
                  onChange={(e) => setCarrierName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded focus:ring-2 focus:ring-[#6700ce]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tracking Number</label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded font-mono focus:ring-2 focus:ring-[#6700ce]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Estimated Delivery (ETA)</label>
                <input
                  type="text"
                  value={estimatedDelivery}
                  onChange={(e) => setEstimatedDelivery(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded focus:ring-2 focus:ring-[#6700ce]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDispatchModalOpen(false)}
                  className="px-4 py-2.5 rounded text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded text-xs font-bold text-white bg-[#6700ce] hover:bg-[#5200a5] shadow min-h-[44px]"
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
