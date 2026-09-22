import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { AlertsFeed } from '../components/AlertsFeed';
import { MapPin, ShoppingBag, AlertCircle, CheckCircle2, PackageCheck, Clock, Layers, Package, Warehouse, Truck } from 'lucide-react';

export const ManagerDashboard = ({ user, onRequestOrder, refreshTrigger, setActiveTab }) => {
  const [stockRecords, setStockRecords] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [stockRes, alertRes, reqRes] = await Promise.all([
        api.get('/inventory/stock'),
        api.get('/alerts'),
        api.get('/requests')
      ]);

      setStockRecords(stockRes.data);
      setAlerts(alertRes.data);
      setRequests(reqRes.data);
    } catch (err) {
      console.error("Failed to fetch location manager data", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  const handleConfirmDelivery = async (reqId) => {
    try {
      await api.put(`/requests/${reqId}/confirm-delivery`);
      fetchData();
    } catch (err) {
      console.error("Failed to confirm delivery", err);
    }
  };

  const handleUpdateAlertStatus = async (alertId, status) => {
    try {
      await api.put(`/alerts/${alertId}/status`, { status });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 font-sans">
        Loading City Manager Operations...
      </div>
    );
  }

  const pendingRequests = requests.filter(r => r.status === 'PENDING');
  const dispatchedRequests = requests.filter(r => r.status === 'DISPATCHED');
  const openAlerts = alerts.filter(a => a.status === 'OPEN');

  return (
    <div className="space-y-6 pb-12 font-sans w-full max-w-[1600px] mx-auto">
      
      {/* City Manager Header Banner */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-[#6700ce] to-[#5200a5] p-3.5 rounded-xl text-white shadow-md">
            <MapPin className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-2xl font-black text-[#1c023d] tracking-tight">
                My Dashboard — {user?.location_name || 'City Territory'}
              </h1>
              <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded bg-purple-100 text-[#6700ce] border border-purple-200">
                City Manager Node
              </span>
            </div>
            <p className="text-xs text-slate-500">
              City Manager: <strong className="text-[#6700ce]">{user?.name}</strong> • Bulk stock requests for city field sales team (~600-700 salespeople)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 font-bold text-xs">
          <button
            onClick={() => setActiveTab?.('request-form')}
            className="px-4 py-2.5 rounded bg-[#e20d65] hover:bg-[#cc0059] text-white flex items-center gap-2 shadow-sm transition"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>+ Submit City Stock Request</span>
          </button>
        </div>
      </div>

      {/* Row 1: 4 Metric Cards */}
      <div data-tour="kpi-metrics" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Central Available SKUs</span>
            <Warehouse className="w-4 h-4 text-purple-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#1c023d] font-mono">{stockRecords.length}</span>
            <span className="text-xs font-bold text-slate-500">catalog SKUs</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Single central warehouse master</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">My Active Requests</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-600 font-mono">{pendingRequests.length}</span>
            <span className="text-xs font-bold text-amber-700">Awaiting Admin</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">In central review queue</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">En-Route Shipments</span>
            <Truck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-blue-600 font-mono">{dispatchedRequests.length}</span>
            <span className="text-xs font-bold text-blue-600">Dispatched</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Ready for Delivery Confirmation</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Low Stock Breaches</span>
            <AlertCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-rose-600 font-mono">{openAlerts.length}</span>
            <span className="text-xs font-bold text-rose-700">Central Alerts</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Reorder threshold alert triggers</p>
        </div>

      </div>

      {/* My City Stock Requests Pipeline */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm w-full space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-[#1c023d] flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#e20d65]" />
            <span>My City Stock Requests Pipeline</span>
          </h2>
          <button onClick={() => setActiveTab?.('my-requests')} className="text-xs font-bold text-[#6700ce] hover:underline">
            View All Requests ➔
          </button>
        </div>

        {requests.length === 0 ? (
          <div className="p-4 text-center text-slate-500 text-xs font-semibold bg-slate-50 rounded border border-slate-200">
            No stock requests logged for your city yet. Click "+ Submit City Stock Request" to order bulk stock.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200 z-10">
                <tr>
                  <th className="py-3 px-4">Req ID</th>
                  <th className="py-3 px-4">SKU Item & Variant</th>
                  <th className="py-3 px-4 text-center">Qty Requested</th>
                  <th className="py-3 px-4">Request Date</th>
                  <th className="py-3 px-4">Request Status</th>
                  <th className="py-3 px-4 text-center">Delivery Confirmation Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {requests.map((r) => {
                  const isDispatched = r.status === 'DISPATCHED';
                  const isDelivered = r.status === 'DELIVERED';
                  const isPending = r.status === 'PENDING';

                  return (
                    <tr key={r.request_id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-500">#{r.request_id}</td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-[#1c023d]">{r.item_name}</span>
                        <span className="text-xs text-[#e20d65] font-mono block">Variant: {r.variant_name}</span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-black text-[#1c023d] text-base">{r.quantity_requested}</td>
                      <td className="py-3 px-4 text-slate-500 text-xs font-mono">{new Date(r.created_at).toLocaleDateString()}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase border ${
                          isPending ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          r.status === 'APPROVED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          isDispatched ? 'bg-purple-50 text-purple-700 border-purple-200' :
                          isDelivered ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isDispatched ? (
                          <button
                            onClick={() => handleConfirmDelivery(r.request_id)}
                            className="px-3 py-1.5 rounded text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition flex items-center justify-center gap-1.5 mx-auto"
                          >
                            <PackageCheck className="w-4 h-4" />
                            <span>Confirm Receipt</span>
                          </button>
                        ) : isDelivered ? (
                          <span className="text-xs text-emerald-600 font-bold flex items-center justify-center gap-1">
                            <CheckCircle2 className="w-4 h-4" /> Received
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 font-mono">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
