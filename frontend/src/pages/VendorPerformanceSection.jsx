import React, { useState } from 'react';
import { Truck, Download, Search, CheckCircle2, TrendingUp, Star, ShieldCheck } from 'lucide-react';
import { exportToCSV } from '../utils/exportHelper';

export const VendorPerformanceSection = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const suppliers = [
    { id: '#SUP-0020', name: 'Syrotech Networking Systems', category: 'Networking Modems', goods: '₹14,20,000', onTime: '98.4%', activePOs: 3, rating: '4.9/5', status: 'Active' },
    { id: '#SUP-0019', name: 'Hikvision Digital Security', category: 'Cameras & DVRs', goods: '₹9,40,000', onTime: '96.2%', activePOs: 2, rating: '4.8/5', status: 'Active' },
    { id: '#SUP-0018', name: 'Sterlite Fiber Optics Ltd', category: 'Cables & Wiring', goods: '₹18,50,000', onTime: '99.1%', activePOs: 4, rating: '5.0/5', status: 'Active' },
    { id: '#SUP-0017', name: 'Cisco Enterprise Equipment', category: 'Networking Switches', goods: '₹12,70,000', onTime: '94.8%', activePOs: 1, rating: '4.7/5', status: 'Active' },
    { id: '#SUP-0016', name: 'Tata Play Apparel Vendors', category: 'T-Shirts & Uniforms', goods: '₹4,30,000', onTime: '91.5%', activePOs: 0, rating: '4.5/5', status: 'Active' }
  ];

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExportCSV = () => {
    exportToCSV('vendor_performance_report.csv', filteredSuppliers, [
      { label: 'Supplier Code', key: 'id' },
      { label: 'Vendor Name', key: 'name' },
      { label: 'Category', key: 'category' },
      { label: 'Total Goods Supplied', key: 'goods' },
      { label: 'On-Time Delivery %', key: 'onTime' },
      { label: 'Active POs', key: 'activePOs' },
      { label: 'Quality Rating', key: 'rating' }
    ]);
  };

  return (
    <div className="space-y-6 font-sans w-full max-w-[1600px] mx-auto pb-12">
      
      {/* Header */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Truck className="w-6 h-6 text-[#e20d65]" />
            <h1 className="text-2xl font-black text-[#1c023d] tracking-tight">Vendor & Supplier Performance</h1>
          </div>
          <p className="text-xs text-slate-500">
            Track equipment vendors, on-time delivery rates, total inventory goods supplied, and active purchase fulfillment orders.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="px-4 py-2.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 shadow-sm transition flex items-center gap-2 font-bold text-xs"
        >
          <Download className="w-4 h-4 text-slate-600" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
          <p className="text-[11px] font-extrabold uppercase text-slate-400">Contracted Vendors</p>
          <p className="text-2xl font-black text-[#1c023d] font-mono mt-1">5 Active</p>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
          <p className="text-[11px] font-extrabold uppercase text-slate-400">Avg On-Time Delivery Rate</p>
          <p className="text-2xl font-black text-emerald-600 font-mono mt-1">96.0%</p>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
          <p className="text-[11px] font-extrabold uppercase text-slate-400">Total Goods Supplied (YTD)</p>
          <p className="text-2xl font-black text-[#1c023d] font-mono mt-1">₹59.10L</p>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
          <p className="text-[11px] font-extrabold uppercase text-slate-400">Active Vendor POs</p>
          <p className="text-2xl font-black text-purple-600 font-mono mt-1">10 Shipments</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm flex justify-between items-center">
        <p className="text-xs font-extrabold text-[#1c023d]">Vendor Performance Matrix</p>
        <div className="relative min-w-[280px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search vendor name or category..."
            className="w-full pl-9 pr-3.5 py-1.5 rounded border border-slate-300 text-xs focus:outline-none focus:border-[#e20d65]"
          />
        </div>
      </div>

      {/* Vendor Data Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden w-full">
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200 z-10 shadow-xs">
              <tr>
                <th className="py-3 px-4">Vendor Code</th>
                <th className="py-3 px-4">Supplier Name</th>
                <th className="py-3 px-4">Equipment Category</th>
                <th className="py-3 px-4 text-right">Total Goods Supplied</th>
                <th className="py-3 px-4 text-center">On-Time Delivery Rate</th>
                <th className="py-3 px-4 text-center">Active POs</th>
                <th className="py-3 px-4 text-center">Quality Rating</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredSuppliers.map((sup) => (
                <tr key={sup.id} className="hover:bg-purple-50/40 even:bg-slate-50/40 transition">
                  <td className="py-3 px-4 font-mono font-bold text-slate-400">{sup.id}</td>
                  <td className="py-3 px-4 font-extrabold text-[#1c023d]">{sup.name}</td>
                  <td className="py-3 px-4 text-slate-600">{sup.category}</td>
                  <td className="py-3 px-4 text-right font-mono font-black text-[#1c023d]">{sup.goods}</td>
                  <td className="py-3 px-4 text-center font-mono font-black text-emerald-600">{sup.onTime}</td>
                  <td className="py-3 px-4 text-center font-mono font-bold text-purple-700">{sup.activePOs}</td>
                  <td className="py-3 px-4 text-center font-bold text-amber-600 flex items-center justify-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                    <span>{sup.rating}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 text-[10px] uppercase">
                      {sup.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
