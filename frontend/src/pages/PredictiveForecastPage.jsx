import React, { useState, useEffect } from 'react';
import { 
  TrendingDown, 
  AlertTriangle, 
  Sparkles, 
  Zap, 
  CloudRain, 
  PartyPopper, 
  Construction, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  ShieldAlert, 
  ArrowUpRight, 
  RefreshCw,
  Search,
  Filter,
  PackageCheck
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import api from '../api/client';

export const PredictiveForecastPage = ({ onOrderCreated }) => {
  const [scenario, setScenario] = useState('NORMAL');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [replenishing, setReplenishing] = useState(false);
  const [selectedSku, setSelectedSku] = useState(null);
  const [filterRisk, setFilterRisk] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [replenishSuccessMsg, setReplenishSuccessMsg] = useState(null);

  const fetchForecast = async (currentScenario = scenario) => {
    setLoading(true);
    try {
      const res = await api.get(`/forecasting/projections?scenario=${currentScenario}`);
      setData(res.data);
      if (res.data.projections.length > 0 && !selectedSku) {
        setSelectedSku(res.data.projections[0]);
      } else if (selectedSku) {
        // preserve current selection
        const updated = res.data.projections.find(p => p.variant_id === selectedSku.variant_id);
        if (updated) setSelectedSku(updated);
      }
    } catch (err) {
      console.error('Failed to load forecast', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForecast(scenario);
  }, [scenario]);

  const handleScenarioChange = (newScenario) => {
    setScenario(newScenario);
  };

  const handleAutoReplenish = async () => {
    if (!window.confirm("Launch Autonomous Replenishment? This will draft verified Purchase Orders for all critical and warning SKUs.")) {
      return;
    }
    setReplenishing(true);
    setReplenishSuccessMsg(null);
    try {
      const res = await api.post(`/forecasting/auto-replenish?scenario=${scenario}`);
      setReplenishSuccessMsg(res.data);
      fetchForecast();
      if (onOrderCreated) onOrderCreated();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to trigger auto replenishment");
    } finally {
      setReplenishing(false);
    }
  };

  const filteredProjections = data?.projections?.filter(item => {
    const matchesRisk = filterRisk === 'ALL' || item.risk_level === filterRisk;
    const matchesSearch = item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.variant_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRisk && matchesSearch;
  }) || [];

  return (
    <div className="space-y-6">
      {/* Top Hero Banner */}
      <div className="bg-gradient-to-r from-[#1c023d] via-[#2a0845] to-[#e20d65] rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            Machine Learning Engine (Air-Gapped)
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">
            Predictive AI Demand Forecasting & Autonomous Replenishment
          </h1>
          <p className="text-purple-200 text-sm mt-1 max-w-2xl">
            Forecasts 30-day stock exhaustion velocity across 7 regional hubs, incorporating seasonal monsoon fiber breaks, infrastructure trench digging, and customer subscriber spikes.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={() => fetchForecast()}
            disabled={loading}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl text-xs font-bold transition flex items-center gap-2 border border-white/20"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh ML Feed
          </button>
          <button
            onClick={handleAutoReplenish}
            disabled={replenishing || (data?.critical_count === 0 && data?.warning_count === 0)}
            className="px-5 py-2.5 bg-[#e20d65] hover:bg-[#c70054] text-white rounded-xl text-xs font-black shadow-lg shadow-pink-900/40 hover:scale-105 active:scale-95 transition flex items-center gap-2 border border-pink-400/40"
          >
            <Zap className={`w-4 h-4 ${replenishing ? 'animate-bounce' : 'fill-amber-300 text-amber-300'}`} />
            {replenishing ? 'Drafting Orders...' : '⚡ 1-Click Auto Replenish'}
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {replenishSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <div className="font-bold text-emerald-900">{replenishSuccessMsg.message}</div>
            <div className="text-xs text-emerald-700 mt-1">
              Generated <b>{replenishSuccessMsg.replenished_count} POs</b> with total capital allocated: <b>₹{replenishSuccessMsg.total_capital_allocated?.toLocaleString('en-IN')}</b>. Orders are now visible in Global Requests Queue.
            </div>
          </div>
          <button onClick={() => setReplenishSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700 text-xs font-bold">Dismiss</button>
        </div>
      )}

      {/* Scenario Stress-Testing Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
          <TrendingDown className="w-4 h-4 text-[#e20d65]" />
          Seasonal Stress-Testing Scenarios (Simulate Environmental Shocks)
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={() => handleScenarioChange('NORMAL')}
            className={`p-3.5 rounded-xl border text-left transition flex items-center gap-3 ${
              scenario === 'NORMAL'
                ? 'bg-purple-50/70 border-[#1c023d] ring-2 ring-[#1c023d]/20 text-[#1c023d]'
                : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
            }`}
          >
            <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold">Standard Baseline</div>
              <div className="text-[11px] text-slate-500">Normal run rate (1.0x)</div>
            </div>
          </button>

          <button
            onClick={() => handleScenarioChange('MONSOON_SURGE')}
            className={`p-3.5 rounded-xl border text-left transition flex items-center gap-3 ${
              scenario === 'MONSOON_SURGE'
                ? 'bg-rose-50/70 border-[#e20d65] ring-2 ring-[#e20d65]/20 text-[#e20d65]'
                : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
            }`}
          >
            <div className="p-2 rounded-lg bg-sky-100 text-sky-700">
              <CloudRain className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold">Monsoon Storm Surge</div>
              <div className="text-[11px] text-slate-500">+45% fiber snap velocity</div>
            </div>
          </button>

          <button
            onClick={() => handleScenarioChange('FESTIVE_EXPANSION')}
            className={`p-3.5 rounded-xl border text-left transition flex items-center gap-3 ${
              scenario === 'FESTIVE_EXPANSION'
                ? 'bg-amber-50/70 border-amber-600 ring-2 ring-amber-600/20 text-amber-900'
                : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
            }`}
          >
            <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
              <PartyPopper className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold">Festive Rollout Boom</div>
              <div className="text-[11px] text-slate-500">+30% connection velocity</div>
            </div>
          </button>

          <button
            onClick={() => handleScenarioChange('METRO_DIGGING')}
            className={`p-3.5 rounded-xl border text-left transition flex items-center gap-3 ${
              scenario === 'METRO_DIGGING'
                ? 'bg-orange-50/70 border-orange-600 ring-2 ring-orange-600/20 text-orange-900'
                : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
            }`}
          >
            <div className="p-2 rounded-lg bg-orange-100 text-orange-700">
              <Construction className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold">Metro & Civic Trenching</div>
              <div className="text-[11px] text-slate-500">+25% cable damage rate</div>
            </div>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Critical Stockouts</span>
            <span className="p-2 bg-rose-100 text-rose-700 rounded-xl">
              <ShieldAlert className="w-5 h-5" />
            </span>
          </div>
          <div className="text-3xl font-black text-rose-600 mt-3">
            {data?.critical_count ?? 0} <span className="text-xs font-medium text-slate-400">SKUs</span>
          </div>
          <div className="text-xs text-rose-700 font-medium mt-1 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Exhaustion within ≤ 7 Days
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Impending Warning</span>
            <span className="p-2 bg-amber-100 text-amber-700 rounded-xl">
              <Clock className="w-5 h-5" />
            </span>
          </div>
          <div className="text-3xl font-black text-amber-600 mt-3">
            {data?.warning_count ?? 0} <span className="text-xs font-medium text-slate-400">SKUs</span>
          </div>
          <div className="text-xs text-amber-700 font-medium mt-1">
            Stockout risk within 8 – 15 Days
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Autonomous Budget</span>
            <span className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-3">
            ₹{(data?.projections?.reduce((acc, p) => p.risk_level in { CRITICAL: 1, WARNING: 1 } ? acc + p.estimated_reorder_cost : acc, 0) || 0).toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-indigo-600 font-medium mt-1">
            Required for 30-day buffer parity
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active SKUs Analyzed</span>
            <span className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <PackageCheck className="w-5 h-5" />
            </span>
          </div>
          <div className="text-3xl font-black text-slate-900 mt-3">
            {data?.total_skus_analyzed ?? 0}
          </div>
          <div className="text-xs text-emerald-600 font-medium mt-1">
            Central & 7 Regional Hubs
          </div>
        </div>
      </div>

      {/* Selected SKU Interactive Forecast Chart */}
      {selectedSku && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                  selectedSku.risk_level === 'CRITICAL' ? 'bg-rose-100 text-rose-700' :
                  selectedSku.risk_level === 'WARNING' ? 'bg-amber-100 text-amber-700' :
                  'bg-emerald-100 text-emerald-700'
                }`}>
                  {selectedSku.risk_level} RISK
                </span>
                <span className="text-xs font-mono text-slate-500">{selectedSku.category}</span>
              </div>
              <h2 className="text-xl font-black text-slate-900 mt-1">
                {selectedSku.item_name} <span className="text-sm font-normal text-slate-500">({selectedSku.variant_name})</span>
              </h2>
              <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-4">
                <span>Current Stock: <b className="text-slate-900">{selectedSku.current_stock} units</b></span>
                <span>Daily Burn Rate: <b className="text-rose-600">{selectedSku.daily_burn_rate} units/day</b></span>
                <span>Days Until Stockout: <b className="text-rose-600 font-mono text-sm">{selectedSku.days_until_stockout} days</b></span>
                <span>Lead Time: <b className="text-slate-900">{selectedSku.vendor_lead_time_days} days</b></span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-xs text-slate-500 font-medium">Recommended Reorder Batch</div>
                <div className="text-lg font-black text-indigo-700">{selectedSku.recommended_order_qty} units (₹{selectedSku.estimated_reorder_cost.toLocaleString('en-IN')})</div>
              </div>
            </div>
          </div>

          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={selectedSku.projection_series} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorStock" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e20d65" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#e20d65" stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="colorBounds" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={4} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip 
                  formatter={(value, name) => [
                    `${value} units`, 
                    name === 'projected_stock' ? 'Projected Inventory' :
                    name === 'upper_bound' ? 'Confidence Ceiling' : 'Confidence Floor'
                  ]}
                  contentStyle={{ backgroundColor: '#1c023d', borderRadius: '12px', color: '#fff', border: 'none', fontSize: '12px' }}
                />
                <ReferenceLine y={selectedSku.reorder_threshold} stroke="#dc2626" strokeDasharray="4 4" label={{ value: 'Safety Threshold', fill: '#dc2626', fontSize: 11 }} />
                <Area type="monotone" dataKey="upper_bound" stroke="#818cf8" fillOpacity={1} fill="url(#colorBounds)" strokeWidth={1} strokeDasharray="3 3" />
                <Area type="monotone" dataKey="projected_stock" stroke="#e20d65" fillOpacity={1} fill="url(#colorStock)" strokeWidth={3} />
                <Area type="monotone" dataKey="lower_bound" stroke="#818cf8" fillOpacity={0} strokeWidth={1} strokeDasharray="3 3" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#e20d65] inline-block"></span> Projected Inventory Curve
              <span className="w-3 h-3 rounded-full bg-indigo-300 inline-block ml-3"></span> 95% Confidence Band
              <span className="w-3 h-0.5 bg-rose-600 inline-block ml-3"></span> Safety Threshold
            </span>
            <span>Vendor: <b>{selectedSku.primary_vendor}</b></span>
          </div>
        </div>
      )}

      {/* Full Forecasting Table with Filtering */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-slate-900">30-Day SKU Exhaustion & Replenishment Matrix</h3>
            <p className="text-xs text-slate-500 mt-0.5">Click any SKU to inspect its ML trajectory curve above.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search SKU or Category..."
                className="pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1c023d] w-48 sm:w-60"
              />
            </div>

            {/* Risk Filter Buttons */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setFilterRisk('ALL')}
                className={`px-3 py-1 rounded-lg transition ${filterRisk === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
              >
                All
              </button>
              <button
                onClick={() => setFilterRisk('CRITICAL')}
                className={`px-3 py-1 rounded-lg transition ${filterRisk === 'CRITICAL' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-600'}`}
              >
                Critical ({data?.critical_count || 0})
              </button>
              <button
                onClick={() => setFilterRisk('WARNING')}
                className={`px-3 py-1 rounded-lg transition ${filterRisk === 'WARNING' ? 'bg-amber-600 text-white shadow-xs' : 'text-amber-600'}`}
              >
                Warning ({data?.warning_count || 0})
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-black tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Item SKU & Variant</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Current Stock</th>
                <th className="py-3 px-4">Daily Burn Rate</th>
                <th className="py-3 px-4">Days to Stockout</th>
                <th className="py-3 px-4">Risk Severity</th>
                <th className="py-3 px-4">Recommended Batch</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProjections.map((item) => {
                const isSelected = selectedSku?.variant_id === item.variant_id;
                return (
                  <tr
                    key={item.variant_id}
                    onClick={() => setSelectedSku(item)}
                    className={`cursor-pointer transition hover:bg-slate-50 ${isSelected ? 'bg-purple-50/60 font-semibold' : ''}`}
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{item.item_name}</div>
                      <div className="text-[11px] text-slate-500">{item.variant_name}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-mono text-[10px]">{item.category}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900">{item.current_stock}</span>
                      <span className="text-slate-400 text-[10px] ml-1">(Thr: {item.reorder_threshold})</span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">
                      {item.daily_burn_rate} /day
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className={`font-black font-mono ${
                          item.days_until_stockout <= 7 ? 'text-rose-600' :
                          item.days_until_stockout <= 15 ? 'text-amber-600' : 'text-emerald-600'
                        }`}>
                          {item.days_until_stockout}d
                        </span>
                        <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full ${
                              item.days_until_stockout <= 7 ? 'bg-rose-500' :
                              item.days_until_stockout <= 15 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, (item.days_until_stockout / 30) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        item.risk_level === 'CRITICAL' ? 'bg-rose-100 text-rose-700' :
                        item.risk_level === 'WARNING' ? 'bg-amber-100 text-amber-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {item.risk_level}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">+{item.recommended_order_qty} units</div>
                      <div className="text-[10px] text-slate-500">₹{item.estimated_reorder_cost.toLocaleString('en-IN')}</div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSku(item);
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold text-[#1c023d] hover:bg-purple-100 border border-purple-200 transition"
                      >
                        Inspect ML
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
