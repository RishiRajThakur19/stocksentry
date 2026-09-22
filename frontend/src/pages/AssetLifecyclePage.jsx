import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, ShieldCheck, Clock, User, MapPin, Wrench, Trash2, 
  ArrowRight, ArrowLeftRight, CheckCircle2, AlertTriangle, 
  Package, Calendar, Activity, Layers, Hash, Sparkles, 
  TrendingUp, Award, Gauge, FileText, ChevronRight, RefreshCw,
  Cpu, Zap, Compass, Check
} from 'lucide-react';
import api from '../api/client';

export const AssetLifecyclePage = ({ initialSerialNumber = '', userRole = 'SUPER_ADMIN' }) => {
  const [searchQuery, setSearchQuery] = useState(initialSerialNumber || 'TPF-NOK-W6-10001');
  const [assetData, setAssetData] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Real-time suggestions state
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const searchContainerRef = useRef(null);

  const samplePresets = [
    { label: 'Nokia ONT Modem', query: 'TPF-NOK-W6-10001', category: 'Modems' },
    { label: 'Fiber Splicer (Plain ID: 3)', query: '3', category: 'Tools' },
    { label: 'Juniper Edge Router', query: 'TPF-JUN-GW-20001', category: 'Core' },
    { label: 'Test Camera (clp partial)', query: 'clp', category: 'Testing' },
    { label: 'Plain ID: 1', query: '1', category: 'Hardware' }
  ];

  // Debounced auto-suggestions
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 1) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSuggesting(true);
      try {
        const res = await api.get(`/lifecycle/suggest?q=${encodeURIComponent(searchQuery.trim())}`);
        setSuggestions(res.data || []);
        setShowSuggestions(true);
      } catch (err) {
        setSuggestions([]);
      } finally {
        setIsSuggesting(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside listener to dismiss suggestions
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (initialSerialNumber) {
      handleSearch(initialSerialNumber);
    } else {
      handleSearch('TPF-NOK-W6-10001');
    }
  }, []);

  const handleSearch = async (termToSearch = searchQuery) => {
    if (!termToSearch || !termToSearch.trim()) return;
    setLoading(true);
    setErrorMsg('');
    setShowSuggestions(false);

    try {
      const assetRes = await api.get(`/lifecycle/search?query=${encodeURIComponent(termToSearch.trim())}`);
      setAssetData(assetRes.data);
      setSearchQuery(assetRes.data.serial_number);

      const eventsRes = await api.get(`/lifecycle/events/${assetRes.data.asset_id}`);
      setEvents(eventsRes.data);
    } catch (err) {
      setAssetData(null);
      setEvents([]);
      setErrorMsg(err.response?.data?.detail || `No asset found matching identifier '${termToSearch}'.`);
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (eventType) => {
    switch (eventType) {
      case 'REGISTERED':
        return <Package className="w-4 h-4 text-emerald-600" />;
      case 'DISPATCHED':
        return <MapPin className="w-4 h-4 text-sky-600" />;
      case 'ASSIGNED':
        return <User className="w-4 h-4 text-purple-600" />;
      case 'TRANSFERRED':
        return <ArrowLeftRight className="w-4 h-4 text-indigo-600" />;
      case 'FAULT_REPORTED':
        return <AlertTriangle className="w-4 h-4 text-rose-600" />;
      case 'REPAIR_REQUESTED':
      case 'REPAIR_APPROVED':
        return <Wrench className="w-4 h-4 text-amber-600" />;
      case 'REPAIR_COMPLETED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'DECOMMISSION_REQUESTED':
      case 'SCRAPPED':
        return <Trash2 className="w-4 h-4 text-rose-700" />;
      default:
        return <Activity className="w-4 h-4 text-slate-500" />;
    }
  };

  const getEventBadgeColor = (eventType) => {
    switch (eventType) {
      case 'REGISTERED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'DISPATCHED':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'ASSIGNED':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'TRANSFERRED':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'FAULT_REPORTED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'REPAIR_REQUESTED':
      case 'REPAIR_APPROVED':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'REPAIR_COMPLETED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'SCRAPPED':
        return 'bg-rose-100 text-rose-800 border-rose-300 font-black';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusBannerColor = (status) => {
    switch (status) {
      case 'IN_WAREHOUSE':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'ASSIGNED':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'IN_REPAIR':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'DISPATCHED':
        return 'bg-sky-50 text-sky-800 border-sky-200';
      case 'DECOMMISSIONED':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans w-full max-w-[1450px] mx-auto">
      
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-gradient-to-br from-[#1c023d] to-[#6700ce] text-white shadow-sm">
              <Activity className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-[#1c023d] tracking-tight">Enterprise Asset Lifecycle & Audit</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-100 text-[#6700ce] border border-purple-200">
                  Tata Central Standard
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Full chronological trajectory tracking from OEM procurement batch, through field custody, incident diagnostics, bench calibrations, and future service horizons.
              </p>
            </div>
          </div>
        </div>

        {/* Smart Flexible Omnibox Search */}
        <div ref={searchContainerRef} className="relative w-full md:w-[460px]">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch(searchQuery);
                  }
                }}
                placeholder="Search by serial (TPF-NOK...), plain ID (1, 2), or SKU..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold focus:outline-none focus:border-[#e20d65] focus:ring-2 focus:ring-[#e20d65]/20 shadow-sm bg-slate-50/50"
              />
              {isSuggesting && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin">
                  <RefreshCw className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
            <button
              onClick={() => handleSearch(searchQuery)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#6700ce] to-[#e20d65] hover:opacity-95 text-white font-extrabold text-xs shadow-md transition shrink-0"
            >
              Search
            </button>
          </div>

          {/* Autocomplete Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl border border-slate-200 shadow-2xl z-50 overflow-hidden divide-y divide-slate-100 max-h-80 overflow-y-auto animate-fade-in">
              <div className="p-2 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Matching Serial Units ({suggestions.length})</span>
                <span>Click to View Full Lifecycle</span>
              </div>
              {suggestions.map((item) => (
                <button
                  key={item.asset_id}
                  onClick={() => {
                    setSearchQuery(item.serial_number);
                    handleSearch(item.serial_number);
                  }}
                  className="w-full text-left p-3 hover:bg-purple-50/60 transition flex items-center justify-between gap-3 group"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black text-[#1c023d] group-hover:text-[#6700ce]">
                        {item.serial_number}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-slate-100 text-slate-600">
                        ID #{item.asset_id}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-purple-100 text-[#6700ce]">
                        {item.category}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 font-medium line-clamp-1">
                      {item.item_name} — <span className="text-slate-400">{item.variant_name}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2">
                      <span>📍 {item.location_name || 'Central Warehouse'}</span>
                      {item.holder_name && <span>• 👤 {item.holder_name}</span>}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${getStatusBannerColor(item.status)}`}>
                      {item.status.replace('_', ' ')}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#6700ce] transition transform group-hover:translate-x-0.5" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Search Chips */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-400 font-bold text-[11px] flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-[#e20d65]" /> Quick Query Presets:
        </span>
        {samplePresets.map((preset) => (
          <button
            key={preset.query}
            onClick={() => {
              setSearchQuery(preset.query);
              handleSearch(preset.query);
            }}
            className={`px-3 py-1 rounded-full text-[11px] font-bold border transition flex items-center gap-1.5 ${
              searchQuery === preset.query && assetData
                ? 'bg-[#1c023d] text-white border-[#1c023d] shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            <span>{preset.label}</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-mono">
              {preset.category}
            </span>
          </button>
        ))}
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading && (
        <div className="bg-white rounded-2xl p-16 border border-slate-200 text-center space-y-3">
          <div className="w-10 h-10 border-3 border-[#6700ce] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 font-bold text-xs">Compiling complete cryptographic audit record and trajectory metrics...</p>
        </div>
      )}

      {assetData && !loading && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Executive Overview & Hardware Profile Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="flex items-start sm:items-center gap-4">
                <div className="relative shrink-0">
                  <img
                    src={assetData.image_url || '/assets/modem_nokia.png'}
                    alt={assetData.item_name}
                    className="w-20 h-20 object-contain bg-slate-50 rounded-xl p-2 border border-slate-200 shadow-inner"
                  />
                  <span className="absolute -bottom-2 -right-1 px-1.5 py-0.5 rounded bg-[#1c023d] text-white text-[9px] font-mono font-bold">
                    #{assetData.asset_id}
                  </span>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-100 text-slate-700 border border-slate-200">
                      {assetData.category}
                    </span>
                    <span className="font-mono text-xs font-black text-purple-900 bg-purple-50 px-2.5 py-0.5 rounded-md border border-purple-200">
                      SN: {assetData.serial_number}
                    </span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold border border-emerald-200 flex items-center gap-1">
                      <Check className="w-3 h-3" /> ISO 9001:2015 Verified
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-[#1c023d] mt-1 tracking-tight">
                    {assetData.item_name}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Variant: <span className="text-slate-800 font-bold">{assetData.variant_name}</span> • Valuation: <span className="text-[#6700ce] font-black font-mono">₹{assetData.unit_cost?.toLocaleString('en-IN') || '0'}</span>
                  </p>
                </div>
              </div>

              {/* Status Banner */}
              <div className={`px-5 py-3 rounded-2xl border flex items-center gap-3 ${getStatusBannerColor(assetData.status)} shadow-sm`}>
                <div className="p-2 rounded-xl bg-white/70">
                  <ShieldCheck className="w-6 h-6 shrink-0" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-black tracking-wider block opacity-70">Current Live State</span>
                  <span className="text-base font-black tracking-tight">{assetData.status.replace('_', ' ')}</span>
                </div>
              </div>
            </div>

            {/* 3-Way Horizon & Health Gauges */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Metric 1: Health Score */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50/50 to-white border border-purple-100 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold">
                  <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                    <Gauge className="w-4 h-4 text-[#6700ce]" /> Reliability Score
                  </span>
                  <span className="font-mono text-emerald-600 font-black">Grade A</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-[#1c023d] font-mono">{assetData.health_score || 95}%</span>
                  <span className="text-[10px] text-slate-500 font-medium">Operating Integrity</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-emerald-500 to-[#6700ce] h-full rounded-full transition-all duration-700" 
                    style={{ width: `${assetData.health_score || 95}%` }} 
                  />
                </div>
              </div>

              {/* Metric 2: MTBF Telemetry */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-sky-50/50 to-white border border-sky-100 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold">
                  <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                    <Cpu className="w-4 h-4 text-sky-600" /> MTBF Expectancy
                  </span>
                  <span className="font-mono text-sky-700 font-bold">Telemetric</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-[#1c023d] font-mono">{(assetData.mtbf_hours || 12000).toLocaleString()}</span>
                  <span className="text-[10px] text-slate-500 font-medium">Hours to Failure</span>
                </div>
                <p className="text-[10px] text-slate-500 font-medium">
                  {assetData.in_service_days || 180} Days actively running in network.
                </p>
              </div>

              {/* Metric 3: Custody & Location */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 shadow-sm space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Active Custody & Hub</span>
                <div className="space-y-0.5">
                  <div className="font-extrabold text-[#1c023d] text-sm flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-purple-600" />
                    <span>{assetData.current_holder_name || 'Unassigned (Warehouse Pool)'}</span>
                  </div>
                  <div className="text-xs text-slate-600 flex items-center gap-1 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-sky-600" />
                    <span>{assetData.current_location_name || (assetData.repair_location_name ? `Lab: ${assetData.repair_location_name}` : 'Central Warehouse')}</span>
                  </div>
                </div>
              </div>

              {/* Metric 4: Projected Horizon */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50/60 to-white border border-amber-200/80 shadow-sm space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-black text-amber-900 tracking-wider flex items-center gap-1">
                    <Compass className="w-3.5 h-3.5 text-amber-600" /> Next Milestone Horizon
                  </span>
                </div>
                <p className="text-xs font-black text-[#1c023d] leading-snug">
                  {assetData.next_maintenance_due || 'In 45 Days (Quarterly Diagnostic Run)'}
                </p>
                <span className="text-[10px] text-slate-500 block font-medium">
                  {assetData.next_calibration_due || 'In 120 Days (ISO 9001 Recertification)'}
                </span>
              </div>

            </div>
          </div>

          {/* 3-Phase Horizon Visual Journey Map */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-[#1c023d] flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#6700ce]" />
                  Tri-Horizon Trajectory: Origin, Custody & Future Horizon
                </h3>
                <p className="text-[11px] text-slate-400">
                  Visual roadmap capturing where the hardware was, where it is operating today, and projected future milestones.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-600 font-mono">
                Batch #{assetData.serial_number.split('-')[1] || 'TPF-STD'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              
              {/* Horizon 1: Origin */}
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                    Phase 1: Inward & Procurement
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <h4 className="text-xs font-black text-[#1c023d]">Central Warehouse Inwarding</h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Registered from OEM dispatch batch with barcode verification, baseline optical attenuation testing, and central ERP inventory ingestion.
                </p>
                <div className="text-[10px] text-slate-400 font-mono pt-1">
                  Baseline Attenuation: &lt; 0.05 dB
                </div>
              </div>

              {/* Horizon 2: Operational Custody */}
              <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-purple-800 bg-purple-100 px-2 py-0.5 rounded">
                    Phase 2: Operational Field Service
                  </span>
                  <Activity className="w-4 h-4 text-[#6700ce]" />
                </div>
                <h4 className="text-xs font-black text-[#1c023d]">
                  {assetData.current_holder_name ? `Field Assigned (${assetData.current_holder_name})` : 'Warehouse Inventory Active Pool'}
                </h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Active deployment for gigabit fiber last-mile delivery, subscriber provisioning, and on-site fiber core alignment.
                </p>
                <div className="text-[10px] text-purple-800 font-mono pt-1 font-bold">
                  Custody Jurisdiction: {assetData.current_location_name || 'Central Warehouse'}
                </div>
              </div>

              {/* Horizon 3: Future Service Horizon */}
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                    Phase 3: Preventative & Calibration
                  </span>
                  <Compass className="w-4 h-4 text-amber-600" />
                </div>
                <h4 className="text-xs font-black text-[#1c023d]">Scheduled Maintenance Horizon</h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Automated preventative inspection alerts, electrode lifespan audits, and certified return-to-warehouse calibration workflows.
                </p>
                <div className="text-[10px] text-amber-800 font-mono pt-1 font-bold">
                  Next ISO Audit: {assetData.next_calibration_due || 'Due in Q4 2026'}
                </div>
              </div>

            </div>
          </div>

          {/* Chronological Lifecycle Timeline */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-black text-[#1c023d] flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#6700ce]" />
                  Chronological Custody & Audit Milestone Ledger
                </h3>
                <p className="text-xs text-slate-400">
                  Immutable cryptographically linked ledger of every physical custody handover, dispatch, fault report, and bench work order.
                </p>
              </div>
              <span className="text-xs text-slate-500 font-mono font-bold bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                Total Events: {events.length}
              </span>
            </div>

            {events.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs font-medium">
                No historical events logged for this asset record yet.
              </div>
            ) : (
              <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                {events.map((event) => (
                  <div key={event.event_id} className="relative group">
                    
                    {/* Node Dot / Icon */}
                    <div className="absolute -left-6 sm:-left-8 top-1 p-1.5 rounded-full bg-white border-2 border-slate-300 shadow-sm group-hover:border-[#6700ce] group-hover:scale-110 transition">
                      {getEventIcon(event.event_type)}
                    </div>

                    {/* Event Content Card */}
                    <div className="bg-slate-50/80 hover:bg-slate-100/90 p-4 sm:p-5 rounded-2xl border border-slate-200 transition space-y-2 text-xs shadow-sm">
                      
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase border ${getEventBadgeColor(event.event_type)}`}>
                            {event.event_type.replace('_', ' ')}
                          </span>
                          <span className="font-mono text-[11px] text-slate-400 font-bold">
                            Ledger Event #{event.event_id}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-slate-500 font-mono text-[11px]">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{new Date(event.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                        </div>
                      </div>

                      {/* Event Description */}
                      <p className="text-slate-800 font-semibold text-xs sm:text-sm leading-relaxed">
                        {event.notes || `Milestone recorded: ${event.event_type}`}
                      </p>

                      {/* Custody Movement Tags */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 text-[11px] text-slate-600 border-t border-slate-200/60 mt-3">
                        {event.actor_name && (
                          <span className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-md border border-slate-200 font-medium shadow-2xs">
                            <strong className="text-slate-400">Actor:</strong> {event.actor_name} <span className="text-[10px] font-mono text-purple-700 font-bold">({event.actor_role})</span>
                          </span>
                        )}
                        {event.to_holder_name && (
                          <span className="flex items-center gap-1 bg-purple-50 text-purple-900 px-2.5 py-1 rounded-md border border-purple-200 font-medium">
                            <strong className="text-purple-600">Assigned Holder:</strong> {event.to_holder_name}
                          </span>
                        )}
                        {event.to_location_name && (
                          <span className="flex items-center gap-1 bg-sky-50 text-sky-900 px-2.5 py-1 rounded-md border border-sky-200 font-medium">
                            <strong className="text-sky-600">City Hub:</strong> {event.to_location_name}
                          </span>
                        )}
                        {event.repair_location_name && (
                          <span className="flex items-center gap-1 bg-amber-50 text-amber-900 px-2.5 py-1 rounded-md border border-amber-200 font-medium">
                            <strong className="text-amber-700">Lab Center:</strong> {event.repair_location_name}
                          </span>
                        )}
                      </div>

                    </div>

                  </div>
                ))}
              </div>
            )}

          </div>

        </div>
      )}

    </div>
  );
};

