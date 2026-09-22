import React, { useState } from 'react';
import { 
  Warehouse, 
  Download, 
  PlusCircle, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  Cpu, 
  ChevronDown, 
  ChevronUp, 
  QrCode, 
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  PackageCheck,
  Box,
  SlidersHorizontal,
  ExternalLink,
  ArrowLeftRight
} from 'lucide-react';
import { exportToCSV } from '../utils/exportHelper';
import api from '../api/client';
import { ProductDetailModal } from '../components/ProductDetailModal';

export const CentralWarehouseStockPage = ({ stock, onRequestReceive, isCentralAdmin, onNavigateToLifecycle, onNavigateToTransfers }) => {
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterClass, setFilterClass] = useState('ALL'); // 'ALL', 'CONSUMABLES', 'SERIALIZED'
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal & Expanded row state
  const [selectedItemForModal, setSelectedItemForModal] = useState(null);
  const [expandedVariantId, setExpandedVariantId] = useState(null);
  const [variantAssets, setVariantAssets] = useState({});
  const [loadingAssets, setLoadingAssets] = useState({});
  const [serialSearchQuery, setSerialSearchQuery] = useState('');

  const categories = ['ALL', ...new Set(stock.map(s => s.category).filter(Boolean))];

  const filteredStock = stock.filter(s => {
    const matchesCat = filterCategory === 'ALL' || s.category === filterCategory;
    const matchesClass = (
      filterClass === 'ALL' ||
      (filterClass === 'SERIALIZED' && s.is_serialized) ||
      (filterClass === 'CONSUMABLES' && !s.is_serialized)
    );
    const matchesSearch = (
      (s.item_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.variant_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.category || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
    return matchesCat && matchesClass && matchesSearch;
  });

  const totalCentralValuation = stock.reduce((acc, s) => acc + (s.current_quantity * (s.unit_cost || 0)), 0);
  const totalWarehouseUnits = stock.reduce((a, b) => a + (b.current_quantity || 0), 0);
  const lowStockCount = stock.filter(s => s.is_low_stock).length;
  const serializedSkusCount = stock.filter(s => s.is_serialized).length;
  const consumablesCount = stock.filter(s => !s.is_serialized).length;

  const toggleExpand = async (variantId) => {
    if (expandedVariantId === variantId) {
      setExpandedVariantId(null);
      setSerialSearchQuery('');
      return;
    }

    setExpandedVariantId(variantId);
    setSerialSearchQuery('');

    if (!variantAssets[variantId]) {
      setLoadingAssets(prev => ({ ...prev, [variantId]: true }));
      try {
        const res = await api.get(`/inventory/variants/${variantId}/assets`);
        setVariantAssets(prev => ({ ...prev, [variantId]: res.data }));
      } catch (err) {
        console.error("Failed to load serialized assets", err);
      } finally {
        setLoadingAssets(prev => ({ ...prev, [variantId]: false }));
      }
    }
  };

  const handleExportCSV = () => {
    exportToCSV('central_warehouse_inventory_stock.csv', filteredStock, [
      { label: 'Stock ID', key: 'stock_id' },
      { label: 'Item Name', key: 'item_name' },
      { label: 'SKU Variant', key: 'variant_name' },
      { label: 'Inventory Class', key: 'is_serialized', format: v => v ? 'Serialized Asset' : 'Consumable' },
      { label: 'Category', key: 'category' },
      { label: 'Central Available Qty', key: 'current_quantity' },
      { label: 'Reorder Threshold', key: 'reorder_threshold' },
      { label: 'Unit Cost (INR)', key: 'unit_cost' },
      { label: 'Last Updated', key: 'last_updated' }
    ]);
  };

  return (
    <div className="space-y-6 font-sans w-full pb-16">
      
      {/* Rectangular Enterprise Header Banner */}
      <div className="bg-white border border-slate-200 border-t-4 border-t-[#e20d65] p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-purple-950 text-white flex items-center justify-center border border-purple-900 shrink-0">
              <Warehouse className="w-4 h-4 text-[#e20d65]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black text-[#1c023d] tracking-tight">
                  Central Warehouse Inventory Master
                </h1>
                <span className="px-2 py-0.5 bg-purple-100 text-purple-900 border border-purple-300 text-[10px] font-mono font-bold uppercase tracking-wider">
                  National Repository
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Unified master repository managing bulk consumables and individual serialized assets with real-time sync across regional hubs.
              </p>
            </div>
          </div>
        </div>

        {/* Right Action Bar */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-bold shrink-0">
          <div className="px-4 py-2 bg-slate-900 text-white border border-slate-800 flex items-center gap-2.5 font-mono shadow-xs">
            <span className="text-slate-400 text-[11px] uppercase tracking-wider">Total Book Value:</span>
            <strong className="text-sm font-black text-emerald-400">₹{totalCentralValuation.toLocaleString('en-IN')}</strong>
          </div>

          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 transition flex items-center gap-2 font-semibold shadow-xs"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>

          {isCentralAdmin && (
            <>
              {onNavigateToTransfers && (
                <button
                  onClick={onNavigateToTransfers}
                  className="px-4 py-2 bg-[#1c023d] hover:bg-[#2b0559] text-white border border-[#1c023d] transition flex items-center gap-2 font-bold shadow-xs"
                  title="Transfer or balance stock between Central Warehouse and Regional Hubs"
                >
                  <ArrowLeftRight className="w-4 h-4 text-[#e20d65]" />
                  <span>Dispatch to Regional Hub</span>
                </button>
              )}
              <button
                onClick={onRequestReceive}
                className="px-4 py-2 bg-[#e20d65] hover:bg-[#cc0059] text-white border border-[#cc0059] transition flex items-center gap-2 font-bold shadow-xs"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Receive Vendor Stock</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI Flashcards: Full Rectangular Executive Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        
        {/* Card 1: SKUs */}
        <div className="bg-white p-5 border border-slate-200 border-t-2 border-t-purple-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Total Catalog SKUs
              </span>
              <span className="px-1.5 py-0.5 bg-purple-50 text-purple-800 border border-purple-200 text-[10px] font-mono font-bold">
                Live Catalog
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-black text-[#1c023d] font-mono">{stock.length}</span>
              <span className="text-xs text-slate-500 font-medium">Unique SKUs</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span><strong className="text-indigo-700 font-mono">{serializedSkusCount}</strong> Serialized</span>
            <span>·</span>
            <span><strong className="text-amber-700 font-mono">{consumablesCount}</strong> Consumables</span>
          </div>
        </div>

        {/* Card 2: Units */}
        <div className="bg-white p-5 border border-slate-200 border-t-2 border-t-indigo-600 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Central Warehouse Stock
              </span>
              <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-mono font-bold">
                In Stock
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-black text-[#1c023d] font-mono">
                {totalWarehouseUnits.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500 font-medium">Physical Units</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="text-[11px] text-indigo-700 font-semibold">Ready for regional dispatch</span>
            <Box className="w-3.5 h-3.5 text-indigo-500" />
          </div>
        </div>

        {/* Card 3: Valuation */}
        <div className="bg-white p-5 border border-slate-200 border-t-2 border-t-emerald-600 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Inventory Asset Valuation
              </span>
              <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-mono font-bold">
                Audited
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-black text-emerald-600 font-mono">
                ₹{(totalCentralValuation / 100000).toFixed(2)}L
              </span>
              <span className="text-xs text-slate-500 font-medium">Net Value</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="font-mono text-[11px]">₹{totalCentralValuation.toLocaleString('en-IN')} total</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          </div>
        </div>

        {/* Card 4: Low Stock */}
        <div className="bg-white p-5 border border-slate-200 border-t-2 border-t-rose-600 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Low Stock Breaches
              </span>
              <span className={`px-1.5 py-0.5 border text-[10px] font-mono font-bold ${
                lowStockCount > 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {lowStockCount > 0 ? 'Action Req.' : 'Nominal'}
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className={`text-3xl font-black font-mono ${lowStockCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {lowStockCount}
              </span>
              <span className="text-xs text-slate-500 font-medium">SKU Alerts</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="text-[11px]">{lowStockCount > 0 ? 'Auto-procurement advisory' : 'All SKUs above threshold'}</span>
            <AlertTriangle className={`w-3.5 h-3.5 ${lowStockCount > 0 ? 'text-rose-500' : 'text-emerald-500'}`} />
          </div>
        </div>

      </div>

      {/* Rectangular Enterprise Filter Controls */}
      <div className="bg-white border border-slate-200 p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Rectangular Class Segmented Control */}
          <div className="inline-flex border border-slate-300 bg-slate-100 p-0.5 text-xs font-bold">
            <button
              onClick={() => setFilterClass('ALL')}
              className={`px-3 py-1.5 transition ${filterClass === 'ALL' ? 'bg-[#1c023d] text-white shadow-xs' : 'text-slate-700 hover:text-slate-900'}`}
            >
              All Classes ({stock.length})
            </button>
            <button
              onClick={() => setFilterClass('CONSUMABLES')}
              className={`px-3 py-1.5 transition flex items-center gap-1.5 ${filterClass === 'CONSUMABLES' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-700 hover:text-slate-900'}`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Consumables ({consumablesCount})</span>
            </button>
            <button
              onClick={() => setFilterClass('SERIALIZED')}
              className={`px-3 py-1.5 transition flex items-center gap-1.5 ${filterClass === 'SERIALIZED' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-700 hover:text-slate-900'}`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Serialized Assets ({serializedSkusCount})</span>
            </button>
          </div>

          {/* Rectangular Category Filter Chips */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-slate-400 uppercase text-[10px] font-bold tracking-wider mr-1">Category:</span>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-2.5 py-1 text-xs font-semibold border transition ${
                  filterCategory === cat
                    ? 'bg-purple-950 text-white border-purple-950 font-bold'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Rectangular Search Input */}
        <div className="relative min-w-[300px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search SKU code, equipment name, category..."
            className="w-full pl-9 pr-3.5 py-1.5 bg-white border border-slate-300 text-xs font-medium focus:outline-none focus:border-[#e20d65] focus:ring-1 focus:ring-[#e20d65] transition"
          />
        </div>

      </div>

      {/* Main Stock Table: Full Rectangular Enterprise Design */}
      <div className="bg-white border border-slate-200 shadow-xs overflow-hidden w-full">
        
        {/* Table Header Summary Strip */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="text-slate-600 font-semibold">
            Showing <strong className="text-[#1c023d] font-bold">{filteredStock.length}</strong> of {stock.length} catalog SKU items
          </div>
          <div className="text-slate-500 font-mono text-[11px]">
            Real-Time Synchronization with Central Database
          </div>
        </div>

        <div className="overflow-x-auto max-h-[720px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-200 z-10 text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4 border-r border-slate-200">SKU Code</th>
                <th className="py-3 px-4 border-r border-slate-200">Item & Specification</th>
                <th className="py-3 px-4 border-r border-slate-200">Class</th>
                <th className="py-3 px-4 border-r border-slate-200">Category</th>
                <th className="py-3 px-4 text-center border-r border-slate-200">Warehouse Stock</th>
                <th className="py-3 px-4 text-center border-r border-slate-200">Threshold</th>
                <th className="py-3 px-4 text-right border-r border-slate-200">Unit Price</th>
                <th className="py-3 px-4 text-right border-r border-slate-200">Total Valuation</th>
                <th className="py-3 px-4 text-center border-r border-slate-200">Status</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredStock.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-12 text-center text-slate-500 font-medium">
                    No equipment or stock items matched your search criteria.
                  </td>
                </tr>
              ) : (
                filteredStock.map((s) => {
                  const totalVal = s.current_quantity * (s.unit_cost || 0);
                  const isExpanded = expandedVariantId === s.variant_id;
                  const assetsList = variantAssets[s.variant_id] || [];
                  const isLoadingAssets = loadingAssets[s.variant_id];

                  const filteredAssets = assetsList.filter(a => 
                    !serialSearchQuery || 
                    (a.serial_number || '').toLowerCase().includes(serialSearchQuery.toLowerCase()) ||
                    (a.status || '').toLowerCase().includes(serialSearchQuery.toLowerCase())
                  );

                  return (
                    <React.Fragment key={s.stock_id}>
                      <tr className={`hover:bg-purple-50/40 transition ${isExpanded ? 'bg-purple-50/70 border-l-4 border-l-indigo-600' : 'even:bg-slate-50/40'}`}>
                        
                        {/* SKU Code */}
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-600 text-xs border-r border-slate-200 whitespace-nowrap">
                          #SKU-00{s.variant_id}
                        </td>

                        {/* Item & Spec */}
                        <td className="py-3.5 px-4 border-r border-slate-200 max-w-xs">
                          <button
                            onClick={() => setSelectedItemForModal({
                              item_id: s.stock_id,
                              name: s.item_name,
                              category: s.category,
                              description: s.description,
                              is_serialized: s.is_serialized,
                              image_url: s.image_url,
                              variants: [{
                                variant_id: s.variant_id,
                                variant_name: s.variant_name,
                                unit_cost: s.unit_cost,
                                reorder_threshold: s.reorder_threshold,
                                reorder_quantity: s.reorder_quantity,
                                available_units_count: s.current_quantity
                              }]
                            })}
                            className="font-extrabold text-[#1c023d] hover:text-[#e20d65] hover:underline text-left block text-sm"
                          >
                            {s.item_name}
                          </button>
                          <div className="text-xs text-[#e20d65] font-mono font-semibold mt-0.5">
                            Variant: {s.variant_name}
                          </div>
                          {s.description && (
                            <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 font-normal leading-relaxed">
                              {s.description}
                            </p>
                          )}
                        </td>

                        {/* Class */}
                        <td className="py-3.5 px-4 border-r border-slate-200 whitespace-nowrap">
                          {s.is_serialized ? (
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold text-[10px] uppercase border border-indigo-200 inline-flex items-center gap-1 font-mono">
                              <Cpu className="w-3 h-3 text-indigo-600" />
                              <span>Serialized</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-800 font-bold text-[10px] uppercase border border-amber-200 inline-flex items-center gap-1 font-mono">
                              <Layers className="w-3 h-3 text-amber-600" />
                              <span>Consumable</span>
                            </span>
                          )}
                        </td>

                        {/* Category */}
                        <td className="py-3.5 px-4 text-slate-700 font-semibold border-r border-slate-200 whitespace-nowrap text-xs">
                          {s.category}
                        </td>

                        {/* Stock */}
                        <td className="py-3.5 px-4 text-center font-mono font-black text-[#1c023d] text-base border-r border-slate-200 whitespace-nowrap">
                          {s.current_quantity.toLocaleString()}
                          {s.is_serialized && (
                            <span className="block text-[10px] font-medium text-indigo-600 uppercase tracking-tight">Units Available</span>
                          )}
                        </td>

                        {/* Threshold */}
                        <td className="py-3.5 px-4 text-center font-mono text-slate-600 font-bold border-r border-slate-200 whitespace-nowrap">
                          {s.reorder_threshold}
                        </td>

                        {/* Unit Price */}
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                          ₹{s.unit_cost?.toLocaleString('en-IN') || '0'}
                        </td>

                        {/* Valuation */}
                        <td className="py-3.5 px-4 text-right font-mono font-black text-[#1c023d] border-r border-slate-200 whitespace-nowrap">
                          ₹{totalVal.toLocaleString('en-IN')}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-4 text-center border-r border-slate-200 whitespace-nowrap">
                          <span className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 border inline-flex items-center gap-1 ${
                            s.is_low_stock
                              ? 'bg-rose-50 text-rose-700 border-rose-300'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          }`}>
                            {s.is_low_stock ? <AlertTriangle className="w-3 h-3 text-rose-600" /> : <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                            <span>{s.is_low_stock ? 'Low Stock' : 'Healthy'}</span>
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {s.is_serialized ? (
                            <button
                              onClick={() => toggleExpand(s.variant_id)}
                              className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-bold transition inline-flex items-center gap-1.5 shadow-xs"
                            >
                              <span>{isExpanded ? 'Hide Serials' : 'View Serials'}</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-mono italic">Bulk Stock</span>
                          )}
                        </td>

                      </tr>

                      {/* Expandable Serial Units Drawer Row */}
                      {s.is_serialized && isExpanded && (
                        <tr>
                          <td colSpan="10" className="p-0 bg-slate-900 text-white">
                            <div className="p-5 space-y-4 border-y border-purple-900/60">
                              
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-purple-800/40 pb-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 bg-[#e20d65] text-white flex items-center justify-center shrink-0">
                                    <QrCode className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-sm text-white flex items-center gap-2">
                                      Serialized Unit Register: {s.item_name} ({s.variant_name})
                                    </h4>
                                    <p className="text-[11px] text-purple-300 font-mono">
                                      {assetsList.length} physical units tracked in Central Database
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3">
                                  <div className="relative min-w-[220px]">
                                    <Search className="w-3.5 h-3.5 text-purple-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                    <input
                                      type="text"
                                      value={serialSearchQuery}
                                      onChange={(e) => setSerialSearchQuery(e.target.value)}
                                      placeholder="Filter serials..."
                                      className="w-full pl-8 pr-2.5 py-1 bg-purple-950/80 border border-purple-800 text-white text-xs placeholder-purple-400/50 focus:outline-none focus:border-[#e20d65]"
                                    />
                                  </div>
                                </div>
                              </div>

                              {isLoadingAssets ? (
                                <div className="py-6 text-center text-purple-300 font-mono text-xs">
                                  Querying unit registry...
                                </div>
                              ) : filteredAssets.length === 0 ? (
                                <div className="py-6 text-center text-purple-300 font-mono text-xs">
                                  No serialized units matching query.
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 max-h-60 overflow-y-auto pr-1">
                                  {filteredAssets.map(asset => (
                                    <div 
                                      key={asset.asset_id}
                                      className="p-2.5 bg-purple-950/40 border border-purple-800/60 flex items-center justify-between hover:border-purple-500 transition group"
                                    >
                                      <div>
                                        <div className="font-mono text-xs font-bold text-white tracking-wider flex items-center gap-1.5">
                                          <span>{asset.serial_number}</span>
                                        </div>
                                        <div className="text-[10px] text-purple-300 font-mono mt-0.5 flex items-center gap-1">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                          <span>{asset.status}</span>
                                        </div>
                                      </div>

                                      {onNavigateToLifecycle && (
                                        <button
                                          onClick={() => onNavigateToLifecycle(asset.serial_number)}
                                          className="p-1.5 bg-purple-900/60 hover:bg-[#e20d65] text-purple-200 hover:text-white transition border border-purple-700/50"
                                          title="Audit Full Serial Lifecycle History"
                                        >
                                          <ExternalLink className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                            </div>
                          </td>
                        </tr>
                      )}

                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Product Detail Modal */}
      {selectedItemForModal && (
        <ProductDetailModal
          item={selectedItemForModal}
          onClose={() => setSelectedItemForModal(null)}
          onNavigateToLifecycle={onNavigateToLifecycle}
        />
      )}

    </div>
  );
};
