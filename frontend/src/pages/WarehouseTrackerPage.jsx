import React, { useState, useEffect } from 'react';
import { Building2, Package, MapPin, Plus, CheckCircle2, AlertTriangle, UserCheck, ArrowUpRight } from 'lucide-react';
import api from '../api/client';

export const WarehouseTrackerPage = ({ locations, items, refreshTrigger, setActiveTab }) => {
  const [selectedHubId, setSelectedHubId] = useState(locations[0]?.location_id || 1);
  const [stockRecords, setStockRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchHubStock = async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory/stock', { params: { location_id: selectedHubId } });
      setStockRecords(res.data);
    } catch (err) {
      console.error("Failed to fetch hub stock", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHubStock();
  }, [selectedHubId, refreshTrigger]);

  const hubsData = [
    { id: 1, name: "Delhi Regional Hub", manager: "Rahul Sharma", email: "delhi@tataplay.com", city: "Delhi", capacity: 85, phone: "+91 98765 43210" },
    { id: 2, name: "Mumbai Main Hub", manager: "Rajesh Patel", email: "mumbai@tataplay.com", city: "Mumbai", capacity: 72, phone: "+91 98123 45678" },
    { id: 3, name: "Bangalore Tech Park", manager: "Ananya Rao", email: "bangalore@tataplay.com", city: "Bangalore", capacity: 64, phone: "+91 97654 32109" },
  ];

  const currentHub = hubsData.find(h => h.id === selectedHubId) || hubsData[0];
  const totalStockCount = stockRecords.reduce((acc, s) => acc + s.current_quantity, 0);

  return (
    <div className="space-y-6 pb-12 font-sans w-full">
      
      {/* Page Header */}
      <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-black text-[#1c023d] flex items-center gap-2">
            <Building2 className="w-6 h-6 text-[#6700ce]" />
            Warehouse Hub Stock Tracker
          </h1>
          <p className="text-xs text-slate-500 mt-1">Select a regional hub to track real-time stock levels, manager contacts, and manually add new inventory.</p>
        </div>

        <button
          onClick={() => setActiveTab('add-stock')}
          className="px-4 py-2.5 rounded bg-[#e20d65] hover:bg-[#cc0059] text-white font-extrabold text-xs shadow-sm transition flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>+ Receive Stock Shipment</span>
        </button>
      </div>

      {/* Hub Selector Cards Row (Dreams ERP Warehouse style) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
        {hubsData.map((hub) => {
          const isSelected = hub.id === selectedHubId;
          return (
            <div
              key={hub.id}
              onClick={() => setSelectedHubId(hub.id)}
              className={`p-5 rounded-lg border cursor-pointer transition-all ${
                isSelected
                  ? 'bg-white border-[#6700ce] ring-2 ring-[#6700ce]/20 shadow-md'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-extrabold text-[#1c023d] text-base">{hub.name}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <UserCheck className="w-3.5 h-3.5 text-[#e20d65]" />
                    Manager: <strong className="text-slate-900">{hub.manager}</strong>
                  </p>
                </div>
                
                <div className="w-10 h-10 rounded-full bg-purple-50 border border-purple-200 flex items-center justify-center font-mono font-black text-xs text-[#6700ce]">
                  {hub.capacity}%
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">{hub.city}, India</span>
                <span className={`font-extrabold ${isSelected ? 'text-[#6700ce]' : 'text-slate-400'}`}>
                  {isSelected ? 'Active View' : 'Select Hub'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Hub Detailed Inventory Table */}
      <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm space-y-4 w-full">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-extrabold text-[#1c023d]">
              {currentHub.name} • Inventory Stock Table
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Total Hub Stock: <strong className="font-mono text-slate-900">{totalStockCount} units</strong> • Assigned Manager: <strong className="text-slate-900">{currentHub.manager}</strong> ({currentHub.email})</p>
          </div>

          <button
            onClick={() => setActiveTab('add-stock')}
            className="px-3.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center gap-1.5"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Add Stock to this Hub</span>
          </button>
        </div>

        {loading ? (
          <p className="text-xs text-slate-400 py-8 text-center">Loading hub stock levels...</p>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600 font-bold uppercase bg-slate-50">
                  <th className="py-3.5 px-4">SKU Product</th>
                  <th className="py-3.5 px-4">Variant</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4 text-center">Reorder Threshold</th>
                  <th className="py-3.5 px-4 text-center">Current Hub Stock</th>
                  <th className="py-3.5 px-4 text-center">Stock Health</th>
                  <th className="py-3.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {stockRecords.map((st) => {
                  const isLow = st.current_quantity <= st.reorder_threshold;
                  return (
                    <tr key={st.stock_id} className="hover:bg-slate-50 transition">
                      <td className="py-3.5 px-4 font-bold text-[#1c023d]">{st.item_name}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-[#e20d65]">{st.variant_name}</td>
                      <td className="py-3.5 px-4 text-slate-600">{st.category}</td>
                      <td className="py-3.5 px-4 text-center font-mono text-slate-500 font-bold">{st.reorder_threshold}</td>
                      <td className="py-3.5 px-4 text-center font-mono font-black text-[#1c023d] text-base">{st.current_quantity}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`text-[10px] uppercase font-black px-2.5 py-0.5 rounded border ${isLow ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                          {isLow ? 'Low Stock' : 'Healthy'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => setActiveTab('add-stock')}
                          className="px-3 py-1.5 rounded text-xs font-bold bg-[#e20d65] hover:bg-[#cc0059] text-white flex items-center gap-1 mx-auto shadow-sm"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Stock</span>
                        </button>
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
