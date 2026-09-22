import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, ShoppingBag, Layers, Search, Filter, RefreshCw, Package, Check, XCircle } from 'lucide-react';

export const StockGrid = ({ matrix, locations, onRequestOrder, isManager = false, userLocationId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  if (!matrix || matrix.length === 0) {
    return (
      <div className="bg-white rounded-lg p-8 text-center text-slate-500 font-sans border border-slate-200">
        Loading inventory matrix...
      </div>
    );
  }

  // Filter locations if manager role
  const displayLocations = isManager && userLocationId
    ? locations.filter(l => l.location_id === userLocationId)
    : locations;

  // Filter matrix rows based on search, category, and status
  const filteredMatrix = matrix.filter(row => {
    const matchesSearch = 
      row.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.variant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.category.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = categoryFilter === 'ALL' || row.category === categoryFilter;

    const totalQty = Object.values(row.stocks || {}).reduce((a, b) => a + b, 0);
    const isLow = totalQty <= (row.reorder_threshold * displayLocations.length);
    const isOut = totalQty === 0;

    let matchesStatus = true;
    if (statusFilter === 'IN_STOCK') matchesStatus = !isLow && !isOut;
    if (statusFilter === 'LOW_STOCK') matchesStatus = isLow && !isOut;
    if (statusFilter === 'OUT_OF_STOCK') matchesStatus = isOut;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Calculate summary stats (Dreams ERP top summary pills)
  const totalItemsCount = matrix.length;
  let healthyCount = 0;
  let lowStockCount = 0;
  let criticalCount = 0;

  matrix.forEach(row => {
    const totalQty = Object.values(row.stocks || {}).reduce((a, b) => a + b, 0);
    if (totalQty === 0) criticalCount++;
    else if (totalQty <= (row.reorder_threshold * displayLocations.length)) lowStockCount++;
    else healthyCount++;
  });

  const categories = Array.from(new Set(matrix.map(m => m.category)));

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200 font-sans w-full space-y-5">
      
      {/* Title & Top Metric Pills (Dreams ERP Screenshot 3 & 4 style) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-black text-[#1c023d] flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#e20d65]" />
            <span>{isManager ? 'Location Stock Inventory Matrix' : 'Global Stock Matrix Heatmap'}</span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-[#e20d65]/10 text-[#e20d65] border border-[#e20d65]/20">
              {displayLocations.length} Hub{displayLocations.length > 1 ? 's' : ''}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Real-time inventory levels across Tata Play Fiber regional fulfillment hubs.</p>
        </div>

        {/* Dreams ERP Summary Pills Header */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3 py-1.5 rounded bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-[#6700ce]" />
            <span>Total SKUs: <strong className="font-mono font-black text-[#1c023d]">{totalItemsCount}</strong></span>
          </div>

          <div className="px-3 py-1.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Healthy: <strong className="font-mono font-black">{healthyCount}</strong></span>
          </div>

          <div className="px-3 py-1.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            <span>Low Stock: <strong className="font-mono font-black">{lowStockCount}</strong></span>
          </div>

          <div className="px-3 py-1.5 rounded bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>Critical: <strong className="font-mono font-black">{criticalCount}</strong></span>
          </div>
        </div>
      </div>

      {/* Dreams ERP Filter & Control Toolbar */}
      <div className="p-3 bg-slate-50 rounded border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        
        {/* Search Bar */}
        <div className="relative flex-1 w-full md:w-auto">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search product code, SKU, or category..."
            className="w-full pl-9 pr-3 py-1.5 rounded bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#e20d65]"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-800 font-semibold focus:outline-none focus:border-[#e20d65]"
          >
            <option value="ALL">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-800 font-semibold focus:outline-none focus:border-[#e20d65]"
          >
            <option value="ALL">All Stock Statuses</option>
            <option value="IN_STOCK">In Stock (Healthy)</option>
            <option value="LOW_STOCK">Low Stock</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
          </select>

          <button
            onClick={() => { setSearchTerm(''); setCategoryFilter('ALL'); setStatusFilter('ALL'); }}
            className="px-3 py-1.5 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold flex items-center gap-1 transition"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Reset</span>
          </button>
        </div>

      </div>

      {/* Dreams ERP Stock Matrix Table */}
      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider bg-slate-50 sticky top-0 z-10">
              <th className="py-3.5 px-4">Code</th>
              <th className="py-3.5 px-4">Product Name</th>
              <th className="py-3.5 px-4">Variant SKU</th>
              <th className="py-3.5 px-4">Category</th>
              <th className="py-3.5 px-4 text-center">Reorder Threshold</th>
              {displayLocations.map((loc) => (
                <th key={loc.location_id} className="py-3.5 px-4 text-center min-w-[130px]">
                  {loc.name.replace(' Hub', '').replace(' Main', '').replace(' Tech Park', '')}
                </th>
              ))}
              {!isManager && <th className="py-3.5 px-4 text-center">Total Stock</th>}
              {isManager && <th className="py-3.5 px-4 text-center">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {filteredMatrix.length === 0 ? (
              <tr>
                <td colSpan={6 + displayLocations.length} className="py-8 text-center text-slate-400 text-xs">
                  No inventory records match your search filter criteria.
                </td>
              </tr>
            ) : (
              filteredMatrix.map((row, idx) => {
                const totalQty = Object.values(row.stocks || {}).reduce((a, b) => a + b, 0);

                return (
                  <tr key={row.variant_id} className="hover:bg-slate-50 transition">
                    
                    {/* Code */}
                    <td className="py-3.5 px-4 font-mono text-slate-400 text-xs font-bold">
                      #SKU00{idx + 1}
                    </td>

                    {/* Product Name */}
                    <td className="py-3.5 px-4 font-black text-[#1c023d]">
                      {row.item_name}
                    </td>

                    {/* Variant Name */}
                    <td className="py-3.5 px-4">
                      <span className="text-xs font-mono font-bold text-[#e20d65] bg-[#e20d65]/10 px-2 py-0.5 rounded border border-[#e20d65]/20">
                        {row.variant_name}
                      </span>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4">
                      <span className="text-xs px-2 py-0.5 rounded font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {row.category}
                      </span>
                    </td>

                    {/* Reorder Threshold */}
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-500">
                      {row.reorder_threshold}
                    </td>

                    {/* Color-Coded Heatmap Cell per location */}
                    {displayLocations.map((loc) => {
                      const qty = row.stocks[loc.location_id] ?? 0;
                      const isCritical = qty <= 3;
                      const isLow = qty <= row.reorder_threshold;

                      let cellStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";
                      let icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
                      let statusLabel = "Healthy";

                      if (isCritical) {
                        cellStyle = "bg-rose-50 text-rose-700 border-rose-200 shadow-sm animate-pulse";
                        icon = <AlertCircle className="w-3.5 h-3.5 text-rose-600" />;
                        statusLabel = "Critical";
                      } else if (isLow) {
                        cellStyle = "bg-amber-50 text-amber-700 border-amber-200";
                        icon = <AlertCircle className="w-3.5 h-3.5 text-amber-600" />;
                        statusLabel = "Low Stock";
                      }

                      return (
                        <td key={loc.location_id} className="py-3.5 px-4 text-center">
                          <div className={`p-2 rounded border flex items-center justify-between gap-1.5 transition ${cellStyle}`}>
                            <div className="flex items-center gap-1">
                              {icon}
                              <span className="text-[10px] uppercase font-bold tracking-wider">{statusLabel}</span>
                            </div>
                            <span className="font-mono font-black text-sm">{qty}</span>
                          </div>
                        </td>
                      );
                    })}

                    {/* Total Qty (Admin view) */}
                    {!isManager && (
                      <td className="py-3.5 px-4 text-center font-black text-[#1c023d] font-mono text-base">
                        {totalQty}
                      </td>
                    )}

                    {/* Manager Action only */}
                    {isManager && (
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => onRequestOrder(row)}
                          className="px-3.5 py-1.5 rounded text-xs font-bold bg-[#e20d65] hover:bg-[#cc0059] text-white flex items-center justify-center gap-1.5 mx-auto shadow-sm"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>Request Order</span>
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
