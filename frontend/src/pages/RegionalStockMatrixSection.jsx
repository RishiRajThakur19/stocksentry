import React, { useState, useEffect, useMemo } from 'react';
import { 
  Layers, 
  ChevronDown, 
  ChevronRight, 
  Search, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Building2, 
  MapPin, 
  Warehouse, 
  Package, 
  ShieldCheck, 
  SlidersHorizontal,
  RefreshCw,
  ExternalLink,
  ChevronUp,
  ArrowLeftRight
} from 'lucide-react';
import api from '../api/client';
import { exportToCSV } from '../utils/exportHelper';
import { ProductDetailModal } from '../components/ProductDetailModal';

export const RegionalStockMatrixSection = ({ userRole = 'SUPER_ADMIN', onRequestReceive, onNavigateToTransfers }) => {
  const [data, setData] = useState({ items: [], regions_meta: [] });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [classFilter, setClassFilter] = useState('ALL'); // 'ALL' | 'SERIALIZED' | 'CONSUMABLES'
  const [selectedProductForModal, setSelectedProductForModal] = useState(null);

  // Fold/unfold state per regionId (default: all expanded)
  // { [regionId]: boolean } - true means unfolded (expanded into cities), false means folded (collapsed to region aggregate)
  const [expandedRegions, setExpandedRegions] = useState({
    1: true, // North
    2: true, // West
    3: true, // South
    4: true  // East
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory/regional-stock');
      setData(res.data);
      
      // Initialize all regions as unfolded by default
      if (res.data.regions_meta) {
        const initial = {};
        res.data.regions_meta.forEach(r => {
          initial[r.region_id] = true;
        });
        setExpandedRegions(prev => ({ ...initial, ...prev }));
      }
    } catch (err) {
      console.error('Failed to fetch regional stock matrix:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleRegion = (regionId) => {
    setExpandedRegions(prev => ({
      ...prev,
      [regionId]: !prev[regionId]
    }));
  };

  const foldAllRegions = () => {
    const folded = {};
    data.regions_meta.forEach(r => {
      folded[r.region_id] = false;
    });
    setExpandedRegions(folded);
  };

  const unfoldAllRegions = () => {
    const unfolded = {};
    data.regions_meta.forEach(r => {
      unfolded[r.region_id] = true;
    });
    setExpandedRegions(unfolded);
  };

  // Categories list
  const categories = useMemo(() => {
    return ['ALL', ...new Set(data.items.map(i => i.category).filter(Boolean))];
  }, [data.items]);

  // Filtered rows
  const filteredItems = useMemo(() => {
    return data.items.filter(item => {
      const matchesCat = categoryFilter === 'ALL' || item.category === categoryFilter;
      const matchesClass = 
        classFilter === 'ALL' ||
        (classFilter === 'SERIALIZED' && item.is_serialized) ||
        (classFilter === 'CONSUMABLES' && !item.is_serialized);
      const q = searchQuery.toLowerCase();
      const matchesSearch = 
        (item.item_name || '').toLowerCase().includes(q) ||
        (item.variant_name || '').toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q);

      return matchesCat && matchesClass && matchesSearch;
    });
  }, [data.items, categoryFilter, classFilter, searchQuery]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const totalNationwideUnits = data.items.reduce((acc, i) => acc + (i.total_nationwide_stock || 0), 0);
    const totalCentralUnits = data.items.reduce((acc, i) => acc + (i.central_stock || 0), 0);
    const totalRegionalUnits = data.items.reduce((acc, i) => acc + (i.total_regional_stock || 0), 0);
    const lowStockCount = data.items.filter(i => (i.central_stock || 0) <= i.reorder_threshold).length;
    return {
      totalNationwideUnits,
      totalCentralUnits,
      totalRegionalUnits,
      totalSkus: data.items.length,
      lowStockCount
    };
  }, [data.items]);

  // CSV Export
  const handleExportCSV = () => {
    if (!filteredItems.length) return;

    const rows = filteredItems.map(item => {
      const row = {
        'Item Name': item.item_name,
        'Variant SKU': item.variant_name,
        'Category': item.category,
        'Class': item.is_serialized ? 'Serialized Device' : 'Bulk Consumable',
        'Reorder Threshold': item.reorder_threshold,
        'Central Warehouse Qty': item.central_stock,
        'Total Regional Qty': item.total_regional_stock,
        'Total Nationwide Stock': item.total_nationwide_stock
      };

      // Add regional & city columns
      item.regions.forEach(reg => {
        row[`${reg.region_name} (Total)`] = reg.total_stock;
        reg.cities.forEach(c => {
          row[`${reg.region_name} - ${c.city_name}`] = c.quantity;
        });
      });

      return row;
    });

    exportToCSV('regional_stock_matrix_hierarchy.csv', rows);
  };

  return (
    <div className="space-y-6 font-sans w-full pb-16">
      
      {/* Enterprise Top Banner */}
      <div className="bg-white border border-slate-200 border-t-4 border-t-[#6700ce] p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-[#1c023d] text-white flex items-center justify-center border border-purple-900 shrink-0">
              <Layers className="w-5 h-5 text-[#e20d65]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black text-[#1c023d] tracking-tight">
                  Regional Stock Matrix (Regions Folding into Cities)
                </h1>
                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-900 border border-indigo-200 text-[10px] font-mono font-bold uppercase tracking-wider">
                  Hierarchical Distribution
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Multi-tier stock visibility folding 4 geographic regions into 7 city distribution hubs. Click region headers to fold/unfold city breakdowns.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onNavigateToTransfers && (
            <button
              onClick={onNavigateToTransfers}
              className="px-3.5 py-2 bg-[#1c023d] hover:bg-[#2b0559] text-white border border-[#1c023d] text-xs font-bold shadow-xs transition flex items-center gap-1.5"
              title="Transfer stock between Central Warehouse and Regional Hubs"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-[#e20d65]" />
              <span>Transfer Central to Regional Hub</span>
            </button>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 border border-slate-300 text-slate-700 hover:bg-slate-50 transition text-xs font-bold flex items-center gap-1"
            title="Refresh Matrix"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#e20d65]' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold shadow-xs transition flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
        <div className="bg-white p-3.5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Total Nationwide Stock</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-[#1c023d] font-mono">{metrics.totalNationwideUnits.toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-slate-500 font-bold">Units</span>
          </div>
        </div>

        <div className="bg-white p-3.5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Central Warehouse</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-purple-700 font-mono">{metrics.totalCentralUnits.toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-purple-600 font-bold">Primary Hub</span>
          </div>
        </div>

        <div className="bg-white p-3.5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Regional Hubs Stock</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-[#6700ce] font-mono">{metrics.totalRegionalUnits.toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-indigo-600 font-bold">7 City Hubs</span>
          </div>
        </div>

        <div className="bg-white p-3.5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">SKUs Monitored</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-slate-900 font-mono">{metrics.totalSkus}</span>
            <span className="text-[10px] text-slate-500 font-bold">Active SKUs</span>
          </div>
        </div>

        <div className="bg-white p-3.5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Central Low Stock</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-rose-600 font-mono">{metrics.lowStockCount}</span>
            <span className="text-[10px] text-rose-600 font-bold">At Reorder Level</span>
          </div>
        </div>
      </div>

      {/* Folding & Filtering Control Toolbar */}
      <div className="bg-white p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by product name, variant SKU, or category..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:border-[#6700ce] text-xs font-medium placeholder-slate-400"
            />
          </div>

          {/* Category & Class dropdowns */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 border border-slate-300">
              <span className="text-[11px] font-bold text-slate-500">Cat:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-transparent text-slate-800 font-bold focus:outline-none text-xs"
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 border border-slate-300">
              <span className="text-[11px] font-bold text-slate-500">Class:</span>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="bg-transparent text-slate-800 font-bold focus:outline-none text-xs"
              >
                <option value="ALL">All Classes</option>
                <option value="SERIALIZED">Serialized Assets</option>
                <option value="CONSUMABLES">Bulk Consumables</option>
              </select>
            </div>
          </div>

          {/* Quick Fold / Unfold All Buttons */}
          <div className="flex items-center gap-2 border-t md:border-t-0 pt-2 md:pt-0">
            <button
              onClick={foldAllRegions}
              className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-[#6700ce] border border-purple-200 font-bold text-xs transition flex items-center gap-1"
              title="Collapse all regions to regional totals only"
            >
              <ChevronRight className="w-3.5 h-3.5" />
              <span>Fold All Regions</span>
            </button>

            <button
              onClick={unfoldAllRegions}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs transition flex items-center gap-1"
              title="Expand all regions into individual city hubs"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Unfold All Cities</span>
            </button>
          </div>
        </div>

        {/* Region Folding Status Badges */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-[11px]">
          <span className="font-bold text-slate-500">Interactive Region Toggles:</span>
          {data.regions_meta.map(reg => {
            const isUnfolded = expandedRegions[reg.region_id];
            return (
              <button
                key={reg.region_id}
                onClick={() => toggleRegion(reg.region_id)}
                className={`px-2.5 py-1 border transition flex items-center gap-1 font-bold ${
                  isUnfolded 
                    ? 'bg-[#1c023d] text-white border-[#1c023d]' 
                    : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                }`}
              >
                <span>{reg.region_name}</span>
                <span className="font-mono text-[10px] opacity-80">({reg.cities.length} {reg.cities.length > 1 ? 'Hubs' : 'Hub'})</span>
                {isUnfolded ? <ChevronDown className="w-3 h-3 text-[#e20d65]" /> : <ChevronRight className="w-3 h-3 text-slate-400" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Hierarchical Stock Matrix Table */}
      <div className="bg-white border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-left border-collapse text-xs">
            
            {/* TIER 1: REGIONAL HEADER GROUPS */}
            <thead className="bg-[#1c023d] text-white sticky top-0 z-20 border-b border-purple-900">
              <tr>
                <th colSpan={4} className="py-2 px-4 border-r border-purple-900 text-[11px] font-black uppercase tracking-wider bg-[#1c023d]">
                  Catalog SKU & Specifications
                </th>
                <th className="py-2 px-3 text-center border-r border-purple-900 text-[11px] font-black uppercase tracking-wider bg-[#2a0558] text-amber-300">
                  Reorder Level
                </th>
                <th className="py-2 px-4 text-center border-r border-purple-900 text-[11px] font-black uppercase tracking-wider bg-[#37006b] text-purple-200">
                  Central Warehouse
                </th>

                {/* Dynamic Regional Header Blocks */}
                {data.regions_meta.map(reg => {
                  const isUnfolded = expandedRegions[reg.region_id];
                  const colSpan = isUnfolded ? 1 + reg.cities.length : 1;

                  return (
                    <th
                      key={reg.region_id}
                      colSpan={colSpan}
                      onClick={() => toggleRegion(reg.region_id)}
                      className={`py-2 px-3 text-center border-r border-purple-900 cursor-pointer select-none transition ${
                        isUnfolded ? 'bg-[#23004d] hover:bg-[#2e0066]' : 'bg-[#180036] hover:bg-[#240050]'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1.5 font-bold">
                        <span className="text-white">{reg.region_name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/20 text-purple-200">
                          {isUnfolded ? `${reg.cities.length} Hubs Expanded` : 'Folded Total'}
                        </span>
                        {isUnfolded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-[#e20d65]" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-amber-300" />
                        )}
                      </div>
                    </th>
                  );
                })}

                <th className="py-2 px-4 text-center text-[11px] font-black uppercase tracking-wider bg-[#0f0022] text-emerald-300">
                  Nationwide Total
                </th>
              </tr>

              {/* TIER 2: SUB-COLUMNS (Cities under unfolded regions) */}
              <tr className="bg-slate-100 text-slate-700 text-[11px] font-bold border-b border-slate-200 uppercase tracking-wider sticky top-[33px] z-10">
                <th className="py-2.5 px-4">Item Code</th>
                <th className="py-2.5 px-4 min-w-[200px]">Product & SKU Variant</th>
                <th className="py-2.5 px-3">Class</th>
                <th className="py-2.5 px-3 border-r border-slate-200">Unit Cost</th>
                <th className="py-2.5 px-3 text-center border-r border-slate-200">Threshold</th>
                <th className="py-2.5 px-4 text-center border-r border-slate-200 bg-purple-50 text-purple-900">
                  Central Stock
                </th>

                {/* Sub-headers for each region */}
                {data.regions_meta.map(reg => {
                  const isUnfolded = expandedRegions[reg.region_id];

                  if (!isUnfolded) {
                    // Folded: Only Region Aggregate Column
                    return (
                      <th
                        key={reg.region_id}
                        className="py-2.5 px-4 text-center border-r border-slate-200 bg-indigo-50 text-indigo-900 font-extrabold"
                      >
                        {reg.region_name.split(' ')[0]} Total
                      </th>
                    );
                  }

                  // Unfolded: Region Aggregate + City Columns
                  return (
                    <React.Fragment key={reg.region_id}>
                      <th className="py-2.5 px-3 text-center border-r border-slate-200 bg-indigo-50/70 text-indigo-900 font-black">
                        {reg.region_name.split(' ')[0]} Subtotal
                      </th>
                      {reg.cities.map(c => (
                        <th
                          key={c.location_id}
                          className="py-2.5 px-3 text-center border-r border-slate-200 text-slate-700 font-bold bg-slate-50 min-w-[110px]"
                        >
                          {c.city_name} Hub
                        </th>
                      ))}
                    </React.Fragment>
                  );
                })}

                <th className="py-2.5 px-4 text-center bg-emerald-50 text-emerald-900 font-black">
                  Total Units
                </th>
              </tr>
            </thead>

            {/* TABLE BODY */}
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={25} className="py-12 text-center text-slate-400 font-medium">
                    No SKU records match the current filter and search criteria.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => {
                  const isCentralLow = (item.central_stock || 0) <= item.reorder_threshold;

                  return (
                    <tr key={item.variant_id} className="hover:bg-slate-50/80 transition group">
                      
                      {/* Item Code */}
                      <td className="py-3 px-4 font-mono text-slate-400 font-bold">
                        #SKU{(idx + 1).toString().padStart(3, '0')}
                      </td>

                      {/* Product Name & Variant */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => setSelectedProductForModal({
                            item_id: item.item_id,
                            name: item.item_name,
                            category: item.category,
                            description: item.description,
                            is_serialized: item.is_serialized,
                            image_url: item.image_url,
                            variants: [{
                              variant_id: item.variant_id,
                              variant_name: item.variant_name,
                              unit_cost: item.unit_cost,
                              reorder_threshold: item.reorder_threshold,
                              central_stock_qty: item.central_stock,
                              available_units_count: item.central_stock
                            }]
                          })}
                          className="text-left group-hover:text-[#6700ce] transition"
                        >
                          <div className="font-black text-[#1c023d] flex items-center gap-1.5">
                            <span>{item.item_name}</span>
                            <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-[#e20d65] opacity-0 group-hover:opacity-100 transition" />
                          </div>
                          <span className="text-[11px] font-mono text-[#e20d65] font-bold block mt-0.5">
                            {item.variant_name}
                          </span>
                        </button>
                      </td>

                      {/* Class Badge */}
                      <td className="py-3 px-3">
                        {item.is_serialized ? (
                          <span className="px-2 py-0.5 bg-purple-50 text-[#6700ce] border border-purple-200 text-[10px] font-bold rounded">
                            Serialized
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold rounded">
                            Consumable
                          </span>
                        )}
                      </td>

                      {/* Unit Cost */}
                      <td className="py-3 px-3 font-mono font-bold text-slate-700 border-r border-slate-100">
                        ₹{item.unit_cost?.toLocaleString('en-IN')}
                      </td>

                      {/* Threshold */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-400 border-r border-slate-100">
                        {item.reorder_threshold}
                      </td>

                      {/* Central Warehouse Stock Cell */}
                      <td className={`py-3 px-4 text-center font-mono font-black border-r border-slate-200 ${
                        isCentralLow ? 'bg-rose-50 text-rose-700 font-extrabold' : 'bg-purple-50/50 text-purple-950'
                      }`}>
                        <div className="flex items-center justify-center gap-1">
                          <span>{item.central_stock}</span>
                          {isCentralLow && <AlertTriangle className="w-3 h-3 text-rose-600" />}
                        </div>
                      </td>

                      {/* Dynamic Regional Cells */}
                      {item.regions.map(reg => {
                        const isUnfolded = expandedRegions[reg.region_id];

                        if (!isUnfolded) {
                          // Folded Cell (Single Regional Total)
                          return (
                            <td
                              key={reg.region_id}
                              className={`py-3 px-4 text-center font-mono font-bold border-r border-slate-100 ${
                                reg.is_low_stock ? 'bg-amber-50 text-amber-800' : 'bg-indigo-50/30 text-indigo-950'
                              }`}
                            >
                              <span>{reg.total_stock}</span>
                            </td>
                          );
                        }

                        // Unfolded Cells: Subtotal + Each City
                        return (
                          <React.Fragment key={reg.region_id}>
                            {/* Region Subtotal */}
                            <td className="py-3 px-3 text-center font-mono font-black bg-indigo-50/50 text-indigo-900 border-r border-slate-200">
                              {reg.total_stock}
                            </td>

                            {/* Individual City Cells */}
                            {reg.cities.map(c => {
                              const isCityLow = c.quantity <= item.reorder_threshold;
                              const isCityEmpty = c.quantity === 0;

                              let cellBg = 'bg-white text-slate-800';
                              if (isCityEmpty) cellBg = 'bg-rose-50 text-rose-700 font-black';
                              else if (isCityLow) cellBg = 'bg-amber-50/70 text-amber-800 font-bold';

                              return (
                                <td
                                  key={c.location_id}
                                  className={`py-3 px-3 text-center font-mono border-r border-slate-100 ${cellBg}`}
                                >
                                  {c.quantity}
                                </td>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}

                      {/* Nationwide Total Stock Cell */}
                      <td className="py-3 px-4 text-center font-mono font-black text-emerald-800 bg-emerald-50/60">
                        {item.total_nationwide_stock}
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Detail Modal */}
      {selectedProductForModal && (
        <ProductDetailModal
          isOpen={true}
          onClose={() => setSelectedProductForModal(null)}
          item={selectedProductForModal}
          onNavigateToLifecycle={(sn) => {
            // Can trigger navigation if parent provides callback
            setSelectedProductForModal(null);
          }}
        />
      )}

    </div>
  );
};
