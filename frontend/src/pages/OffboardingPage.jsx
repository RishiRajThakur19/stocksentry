import React, { useState, useEffect, useMemo } from 'react';
import { 
  UserMinus, ShieldCheck, AlertTriangle, CheckCircle2, FileText, 
  Printer, X, ArrowRight, User, Package, Wrench, RefreshCw, 
  Search, UserPlus, Download, Building2, MapPin, Sparkles, 
  Clock, ChevronRight, Eye, Check, RotateCcw, FileSpreadsheet, 
  Layers, Shield, QrCode, Award, Laptop, Hash, ArrowUpRight
} from 'lucide-react';
import api from '../api/client';

export const OffboardingPage = ({ userRole = 'SUPER_ADMIN', locations = [], onNavigateToBulk }) => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState('directory'); // 'directory' | 'onboarding' | 'clearance_hub' | 'noc_archive'

  // Data state
  const [users, setUsers] = useState([]);
  const [nocRecords, setNocRecords] = useState([]);
  const [allLocations, setAllLocations] = useState(locations);
  const [availableAssets, setAvailableAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [custodyFilter, setCustodyFilter] = useState('ALL');

  // Modals & Active Selections
  const [selectedUserForClearance, setSelectedUserForClearance] = useState(null);
  const [clearanceData, setClearanceData] = useState(null);
  const [selectedNocModal, setSelectedNocModal] = useState(null);
  const [viewCustodyUser, setViewCustodyUser] = useState(null);
  const [handoverReceipt, setHandoverReceipt] = useState(null);
  const [nocRemarks, setNocRemarks] = useState('All Tata Play Fiber modems, tools, and equipment returned in good order.');

  // Managerial Stock Handover & Warehouse Transition State
  const [managerHandoverModal, setManagerHandoverModal] = useState({
    isOpen: false,
    managerData: null,
    loading: false,
    actionType: 'TRANSFER_TO_SUCCESSOR',
    successorId: '',
    targetCityId: '',
    transferNotes: ''
  });
  const [activeHandoverRecord, setActiveHandoverRecord] = useState(null);
  const [managerHandovers, setManagerHandovers] = useState([]);

  // Onboarding Form State
  const [obName, setObName] = useState('');
  const [obEmail, setObEmail] = useState('');
  const [obRole, setObRole] = useState('FIELD_WORKER');
  const [obCityId, setObCityId] = useState('');
  const [obPassword, setObPassword] = useState('tataplay123');
  const [obSelectedAssets, setObSelectedAssets] = useState([]);
  const [obSubmitting, setObSubmitting] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (locations && locations.length > 0) {
      setAllLocations(locations);
      if (!obCityId) {
        setObCityId(locations[0].location_id);
      }
    }
  }, [locations]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [usersRes, nocRes, locsRes, handoversRes] = await Promise.all([
        api.get('/users'),
        api.get('/offboarding/noc-records'),
        locations.length === 0 ? api.get('/inventory/locations') : Promise.resolve({ data: locations }),
        api.get('/offboarding/manager-handovers').catch(() => ({ data: [] }))
      ]);
      setUsers(usersRes.data);
      setNocRecords(nocRes.data);
      if (handoversRes?.data) {
        setManagerHandovers(handoversRes.data);
      }
      if (locsRes?.data) {
        setAllLocations(locsRes.data);
        if (locsRes.data.length > 0 && !obCityId) {
          setObCityId(locsRes.data[0].location_id);
        }
      }
      // Also fetch available hub assets for onboarding allocation
      fetchAvailableAssets(obCityId || (locsRes?.data?.[0]?.location_id));
    } catch (err) {
      console.error('Failed to fetch offboarding data:', err);
      showToast('error', 'Failed to load staff records.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableAssets = async (cityId) => {
    try {
      const url = cityId ? `/offboarding/available-hub-assets?city_id=${cityId}` : '/offboarding/available-hub-assets';
      const res = await api.get(url);
      setAvailableAssets(res.data);
    } catch (err) {
      console.error('Failed to fetch available assets:', err);
    }
  };

  const showToast = (type, message) => {
    setToastMsg({ type, message });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Lifecycle & Clearance Handlers
  const handleMarkLeaving = async (userId) => {
    if (!window.confirm('Initiate offboarding audit for this personnel? This locks new asset allocations and initiates mandatory custody surrender.')) return;
    try {
      const res = await api.post('/offboarding/mark-leaving', { user_id: userId });
      showToast('info', `Offboarding audit initiated for ${res.data.user_name}.`);
      setClearanceData(res.data);
      setSelectedUserForClearance(users.find(u => u.user_id === userId) || null);
      fetchInitialData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to initiate offboarding.');
    }
  };

  const handleCancelLeaving = async (userId) => {
    if (!window.confirm('Cancel offboarding and restore this personnel to Active Staff status?')) return;
    try {
      await api.post('/offboarding/cancel-leaving', { user_id: userId });
      showToast('success', 'Personnel restored to Active Staff status.');
      if (clearanceData?.user_id === userId) {
        setClearanceData(null);
        setSelectedUserForClearance(null);
      }
      fetchInitialData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to cancel offboarding.');
    }
  };

  const handleCheckClearance = async (user) => {
    setSelectedUserForClearance(user);
    try {
      const res = await api.get(`/offboarding/check-clearance/${user.user_id}`);
      setClearanceData(res.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to check asset clearance.');
    }
  };

  const handleSurrenderAsset = async (assetId, condition, notes = '') => {
    try {
      const res = await api.post('/offboarding/surrender-asset', {
        asset_id: assetId,
        condition,
        notes
      });
      showToast('success', `Asset checked-in (${condition === 'DAMAGED' ? 'Flagged Damaged' : 'Surrendered to Hub Stock'}).`);
      setClearanceData(res.data);
      fetchInitialData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to surrender asset.');
    }
  };

  const handleIssueNOC = async (userId) => {
    setActionLoading(true);
    try {
      const res = await api.post('/offboarding/issue-noc', {
        user_id: userId,
        remarks: nocRemarks
      });
      showToast('success', `Official NOC Certificate #${res.data.noc_number} issued successfully!`);
      setSelectedNocModal(res.data);
      setClearanceData(null);
      setSelectedUserForClearance(null);
      fetchInitialData();
      setActiveTab('noc_archive');
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to issue NOC certificate.');
    } finally {
      setActionLoading(false);
    }
  };

  // Managerial Stock Custody Handover Handlers
  const handleOpenManagerHandover = async (managerId) => {
    setManagerHandoverModal({
      isOpen: true,
      managerData: null,
      loading: true,
      actionType: 'TRANSFER_TO_SUCCESSOR',
      successorId: '',
      targetCityId: '',
      transferNotes: ''
    });
    try {
      const res = await api.get(`/offboarding/manager-stock/${managerId}`);
      const data = res.data;
      const defaultAction = (data.candidate_successors && data.candidate_successors.length > 0)
        ? 'TRANSFER_TO_SUCCESSOR'
        : 'EVACUATE_TO_CENTRAL';
      setManagerHandoverModal({
        isOpen: true,
        managerData: data,
        loading: false,
        actionType: defaultAction,
        successorId: data.candidate_successors?.[0]?.user_id || '',
        targetCityId: data.candidate_cities?.[0]?.location_id || '',
        transferNotes: `Formal managerial warehouse custody transition for ${data.manager_name} (${data.city_name} Hub).`
      });
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to load manager hub inventory details.');
      setManagerHandoverModal(prev => ({ ...prev, isOpen: false, loading: false }));
    }
  };

  const handleExecuteManagerHandover = async () => {
    const { managerData, actionType, successorId, targetCityId, transferNotes } = managerHandoverModal;
    if (!managerData) return;

    if (actionType === 'TRANSFER_TO_SUCCESSOR' && !successorId) {
      alert('Please select a successor manager from the candidate list.');
      return;
    }
    if (actionType === 'TRANSFER_TO_CITY' && !targetCityId) {
      alert('Please select a destination city hub.');
      return;
    }

    try {
      setActionLoading(true);
      const res = await api.post('/offboarding/manager-handover', {
        outgoing_manager_id: managerData.manager_id,
        action_type: actionType,
        successor_manager_id: actionType === 'TRANSFER_TO_SUCCESSOR' ? parseInt(successorId) : null,
        target_city_id: actionType === 'TRANSFER_TO_CITY' ? parseInt(targetCityId) : null,
        transfer_notes: transferNotes
      });
      showToast('success', res.data.message || 'Managerial stock custody handover completed successfully!');
      setActiveHandoverRecord(res.data);
      setManagerHandoverModal(prev => ({ ...prev, isOpen: false }));
      if (clearanceData && clearanceData.user_id === managerData.manager_id) {
        const refreshedClearance = await api.get(`/offboarding/check-clearance/${managerData.manager_id}`);
        setClearanceData(refreshedClearance.data);
      }
      fetchInitialData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to execute manager stock handover.');
    } finally {
      setActionLoading(false);
    }
  };

  // Staff Onboarding Handler
  const handleOnboardSubmit = async (e) => {
    e.preventDefault();
    if (!obName || !obEmail || !obCityId) {
      alert('Please fill all mandatory employee fields.');
      return;
    }
    setObSubmitting(true);
    try {
      const payload = {
        name: obName,
        email: obEmail,
        role: obRole,
        city_id: parseInt(obCityId),
        password: obPassword,
        initial_asset_ids: obSelectedAssets
      };
      const res = await api.post('/offboarding/onboard-staff', payload);
      showToast('success', `Personnel ${obName} onboarded successfully!`);
      
      // If kit was assigned, prepare digital handover receipt
      if (res.data.assigned_assets_count > 0) {
        setHandoverReceipt({
          ...res.data,
          city_name: allLocations.find(l => l.location_id === parseInt(obCityId))?.city || 'Hub'
        });
      }

      // Reset form
      setObName('');
      setObEmail('');
      setObSelectedAssets([]);
      fetchInitialData();
      if (res.data.assigned_assets_count === 0) {
        setActiveTab('directory');
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to onboard personnel.');
    } finally {
      setObSubmitting(false);
    }
  };

  // View Custody Breakdown
  const handleViewCustody = async (user) => {
    setViewCustodyUser(user);
    try {
      const res = await api.get(`/offboarding/check-clearance/${user.user_id}`);
      setClearanceData(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.location_name || '').toLowerCase().includes(q) ||
        (u.role || '').toLowerCase().includes(q)
      );

      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;

      let matchesStatus = true;
      if (statusFilter === 'ACTIVE') {
        matchesStatus = u.clearance_status !== 'OFFBOARDED' && !u.is_leaving;
      } else if (statusFilter === 'PENDING_CLEARANCE') {
        matchesStatus = u.is_leaving || u.clearance_status === 'PENDING_CLEARANCE';
      } else if (statusFilter === 'OFFBOARDED') {
        matchesStatus = u.clearance_status === 'OFFBOARDED';
      }

      let matchesCustody = true;
      if (custodyFilter === 'WITH_ASSETS') {
        matchesCustody = (u.assigned_assets_count || 0) > 0;
      } else if (custodyFilter === 'CLEAR') {
        matchesCustody = (u.assigned_assets_count || 0) === 0;
      }

      return matchesSearch && matchesRole && matchesStatus && matchesCustody;
    });
  }, [users, searchQuery, roleFilter, statusFilter, custodyFilter]);

  // Exiting Users (for Clearance Hub)
  const exitingUsers = useMemo(() => {
    return users.filter(u => u.is_leaving || u.clearance_status === 'PENDING_CLEARANCE');
  }, [users]);

  // Statistics KPI calculations
  const totalStaff = users.length;
  const activeStaffCount = users.filter(u => u.clearance_status !== 'OFFBOARDED' && !u.is_leaving).length;
  const totalAssetsInCustody = users.reduce((acc, u) => acc + (u.assigned_assets_count || 0), 0);
  const pendingExitCount = exitingUsers.length;
  const issuedNocCount = nocRecords.length;

  return (
    <div className="space-y-6 pb-20 font-sans w-full max-w-none text-slate-800">
      
      {/* ================= TOP EXECUTIVE BANNER ================= */}
      <div className="bg-gradient-to-r from-[#1c023d] via-[#2a085c] to-[#1c023d] text-white rounded-2xl p-6 md:p-8 shadow-xl border border-purple-900/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-[#e20d65]/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute left-1/3 bottom-0 w-64 h-64 bg-[#6700ce]/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[11px] font-bold tracking-wide uppercase text-purple-200">
              <ShieldCheck className="w-3.5 h-3.5 text-[#e20d65]" />
              <span>Tata Play Fiber • Human Capital & Custody Governance</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              Staff Onboarding & NOC Clearance Portal
            </h1>
            <p className="text-xs sm:text-sm text-purple-200/80 max-w-3xl leading-relaxed">
              Unified enterprise personnel lifecycle protocol: streamlined digital onboarding, serialized technician toolkit allocation, real-time hardware liability audit, and zero-loss No Objection Certificate (NOC) generation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => setActiveTab('onboarding')}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#e20d65] to-[#c20955] hover:from-[#ff1a7a] hover:to-[#e20d65] text-white font-black text-xs shadow-lg shadow-rose-900/30 transition-all transform hover:-translate-y-0.5 flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>Onboard New Staff</span>
            </button>

            {onNavigateToBulk ? (
              <button
                onClick={onNavigateToBulk}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs transition backdrop-blur-sm flex items-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4 text-purple-300" />
                <span>Excel Bulk Onboard</span>
              </button>
            ) : (
              <a
                href="/api/users/template"
                download="tataplay_user_onboarding_template.xlsx"
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs transition backdrop-blur-sm flex items-center gap-2"
              >
                <Download className="w-4 h-4 text-purple-300" />
                <span>Excel Template</span>
              </a>
            )}

            <button
              onClick={fetchInitialData}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white transition backdrop-blur-sm"
              title="Refresh Records"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ================= TOAST NOTIFICATION ================= */}
      {toastMsg && (
        <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-3 shadow-md animate-fade-in ${
          toastMsg.type === 'error' ? 'bg-rose-50 border border-rose-200 text-rose-800' :
          toastMsg.type === 'info' ? 'bg-purple-50 border border-purple-200 text-purple-900' :
          'bg-emerald-50 border border-emerald-200 text-emerald-900'
        }`}>
          {toastMsg.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" /> : <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />}
          <span>{toastMsg.message}</span>
        </div>
      )}

      {/* ================= KPI METRIC CARDS ================= */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-4 hover:shadow-md transition">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-[#6700ce] flex items-center justify-center font-bold shrink-0 border border-purple-100">
            <User className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-wider font-extrabold text-slate-400 block">Total Staff</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-[#1c023d]">{totalStaff}</span>
              <span className="text-[11px] font-bold text-emerald-600">({activeStaffCount} Active)</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-4 hover:shadow-md transition">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-[#e20d65] flex items-center justify-center font-bold shrink-0 border border-rose-100">
            <Laptop className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-wider font-extrabold text-slate-400 block">Hardware in Custody</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-[#1c023d]">{totalAssetsInCustody}</span>
              <span className="text-[11px] font-bold text-slate-500">Serialized Units</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-4 hover:shadow-md transition">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0 border border-amber-100">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-wider font-extrabold text-slate-400 block">In Exit Clearance</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-amber-700">{pendingExitCount}</span>
              <span className="text-[11px] font-bold text-amber-600">Audits Ongoing</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-4 hover:shadow-md transition">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0 border border-emerald-100">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-wider font-extrabold text-slate-400 block">Issued NOCs</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-emerald-700">{issuedNocCount}</span>
              <span className="text-[11px] font-bold text-emerald-600">100% Cleared</span>
            </div>
          </div>
        </div>

      </div>

      {/* ================= MAIN NAVIGATION TABS ================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-1.5 flex flex-wrap gap-1">
        
        <button
          onClick={() => setActiveTab('directory')}
          className={`flex-1 min-w-[200px] py-3 px-4 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 ${
            activeTab === 'directory'
              ? 'bg-[#1c023d] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Personnel Custody Directory</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
            activeTab === 'directory' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {users.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('onboarding')}
          className={`flex-1 min-w-[200px] py-3 px-4 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 ${
            activeTab === 'onboarding'
              ? 'bg-[#1c023d] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <UserPlus className="w-4 h-4 text-[#e20d65]" />
          <span>Staff Onboarding & Kit Allocation</span>
          <span className="px-1.5 py-0.5 rounded bg-rose-100 text-[#e20d65] text-[10px] uppercase font-black tracking-wider">Fast</span>
        </button>

        <button
          onClick={() => setActiveTab('clearance_hub')}
          className={`flex-1 min-w-[200px] py-3 px-4 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 ${
            activeTab === 'clearance_hub'
              ? 'bg-[#1c023d] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <AlertTriangle className={`w-4 h-4 ${pendingExitCount > 0 ? 'text-amber-500 animate-pulse' : 'text-slate-400'}`} />
          <span>NOC Clearance & Asset Surrender</span>
          {pendingExitCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold font-mono">
              {pendingExitCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('noc_archive')}
          className={`flex-1 min-w-[200px] py-3 px-4 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 ${
            activeTab === 'noc_archive'
              ? 'bg-[#1c023d] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4 text-emerald-600" />
          <span>Official NOC Archive</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
            activeTab === 'noc_archive' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {nocRecords.length}
          </span>
        </button>

      </div>

      {/* ================= TAB 1: PERSONNEL CUSTODY DIRECTORY ================= */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          
          {/* Search & Filter Bar */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search personnel by name, email, hub or role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:border-[#6700ce] focus:bg-white transition"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                
                {/* Role Filter */}
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:border-[#6700ce]"
                >
                  <option value="ALL">All Designations</option>
                  <option value="FIELD_WORKER">Field Technicians</option>
                  <option value="MANAGER">Hub Managers</option>
                  <option value="REGIONAL_ADMIN">Regional Admins</option>
                  <option value="SUPER_ADMIN">Super Admins</option>
                </select>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:border-[#6700ce]"
                >
                  <option value="ALL">All Employment Status</option>
                  <option value="ACTIVE">Active Staff Only</option>
                  <option value="PENDING_CLEARANCE">Pending Clearance</option>
                  <option value="OFFBOARDED">Offboarded</option>
                </select>

                {/* Custody Filter */}
                <select
                  value={custodyFilter}
                  onChange={(e) => setCustodyFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:border-[#6700ce]"
                >
                  <option value="ALL">All Hardware Holdings</option>
                  <option value="WITH_ASSETS">With Active Devices</option>
                  <option value="CLEAR">Zero Liability (0 Devices)</option>
                </select>

                {(searchQuery || roleFilter !== 'ALL' || statusFilter !== 'ALL' || custodyFilter !== 'ALL') && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setRoleFilter('ALL');
                      setStatusFilter('ALL');
                      setCustodyFilter('ALL');
                    }}
                    className="px-2.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                )}

              </div>

            </div>
          </div>

          {/* Full-Width Personnel Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {loading ? (
              <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-3 border-[#6700ce] border-t-transparent rounded-full animate-spin" />
                <span>Loading personnel custody records...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs space-y-2">
                <User className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="font-bold text-slate-600">No personnel records found matching filters.</p>
                <p className="text-slate-400">Try adjusting your search terms or role filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 text-slate-600 font-extrabold uppercase border-b border-slate-200 text-[11px] tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4 min-w-[220px]">Personnel Particulars</th>
                      <th className="py-3.5 px-4 min-w-[160px]">Role & Designation</th>
                      <th className="py-3.5 px-4 min-w-[180px]">Assigned Territory / Hub</th>
                      <th className="py-3.5 px-4 min-w-[180px]">Hardware in Custody</th>
                      <th className="py-3.5 px-4 min-w-[140px]">Clearance Status</th>
                      <th className="py-3.5 px-4 min-w-[220px] text-right">Lifecycle Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredUsers.map((u) => {
                      const isTech = u.role === 'FIELD_WORKER';
                      const hasAssets = (u.assigned_assets_count || 0) > 0;
                      const isLeaving = u.is_leaving || u.clearance_status === 'PENDING_CLEARANCE';
                      const isOffboarded = u.clearance_status === 'OFFBOARDED';

                      return (
                        <tr key={u.user_id} className="hover:bg-slate-50/80 transition-colors">
                          
                          {/* Personnel Details */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-xs ${
                                isOffboarded ? 'bg-slate-100 text-slate-500' :
                                isTech ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                u.role === 'MANAGER' ? 'bg-purple-50 text-[#6700ce] border border-purple-200' :
                                'bg-[#1c023d] text-white'
                              }`}>
                                {u.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <span className="font-black text-[#1c023d] block truncate">{u.name}</span>
                                <span className="font-mono text-[11px] text-slate-400 block truncate">{u.email}</span>
                              </div>
                            </div>
                          </td>

                          {/* Role */}
                          <td className="py-3.5 px-4">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide inline-block ${
                              u.role === 'SUPER_ADMIN' ? 'bg-[#1c023d] text-white' :
                              u.role === 'REGIONAL_ADMIN' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                              u.role === 'MANAGER' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                              'bg-cyan-50 text-cyan-800 border border-cyan-200'
                            }`}>
                              {u.role.replace('_', ' ')}
                            </span>
                          </td>

                          {/* Territory / Hub */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-bold text-slate-700">{u.location_name || 'Central National'}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 block pl-5">{u.region_name || 'National'}</span>
                          </td>

                          {/* Hardware in Custody */}
                          <td className="py-3.5 px-4">
                            {hasAssets ? (
                              <button
                                onClick={() => handleViewCustody(u)}
                                className="px-3 py-1 rounded-lg font-black text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 inline-flex items-center gap-1.5 transition text-[11px]"
                                title="Click to view assigned hardware details"
                              >
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                <span>{u.assigned_assets_count} Devices Held</span>
                                <Eye className="w-3 h-3 ml-0.5 text-rose-400" />
                              </button>
                            ) : (
                              <span className="px-2.5 py-1 rounded-lg font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 inline-flex items-center gap-1 text-[11px]">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>0 Devices (Clear)</span>
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            {isOffboarded ? (
                              <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-slate-100 text-slate-600 border border-slate-200 inline-flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3 text-slate-500" /> Offboarded
                              </span>
                            ) : isLeaving ? (
                              <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-amber-50 text-amber-800 border border-amber-300 inline-flex items-center gap-1 animate-pulse">
                                <Clock className="w-3 h-3 text-amber-600" /> In Clearance
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active Staff
                              </span>
                            )}
                          </td>

                          {/* Lifecycle Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {u.role === 'MANAGER' && !isOffboarded && (
                                <button
                                  onClick={() => handleOpenManagerHandover(u.user_id)}
                                  className="px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-[#6700ce] hover:text-[#5200a5] border border-purple-200 font-bold text-[11px] transition flex items-center gap-1"
                                  title="Execute Managerial Warehouse Stock Custody Handover"
                                >
                                  <Building2 className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Handover Stock</span>
                                </button>
                              )}

                              {isOffboarded ? (
                                <button
                                  onClick={() => {
                                    const noc = nocRecords.find(n => n.user_id === u.user_id);
                                    if (noc) setSelectedNocModal(noc);
                                    else alert('NOC Record details archived.');
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold text-[11px] shadow-xs transition flex items-center gap-1.5"
                                >
                                  <Printer className="w-3.5 h-3.5 text-purple-700" />
                                  <span>View NOC</span>
                                </button>
                              ) : isLeaving ? (
                                <>
                                  <button
                                    onClick={() => handleCheckClearance(u)}
                                    className="px-3 py-1.5 rounded-lg bg-[#6700ce] hover:bg-[#5200a5] text-white font-extrabold text-[11px] shadow-sm transition flex items-center gap-1.5"
                                  >
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    <span>Verify & Clear</span>
                                  </button>
                                  <button
                                    onClick={() => handleCancelLeaving(u.user_id)}
                                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition"
                                    title="Cancel offboarding and restore active status"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleMarkLeaving(u.user_id)}
                                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 hover:border-rose-300 border border-slate-200 font-bold text-[11px] transition flex items-center gap-1"
                                >
                                  <UserMinus className="w-3.5 h-3.5" />
                                  <span>Initiate Exit</span>
                                </button>
                              )}
                            </div>
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
      )}

      {/* ================= TAB 2: FAST STAFF ONBOARDING & KIT ALLOCATION ================= */}
      {activeTab === 'onboarding' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Form: Personnel Registration & Kit Assignment (8 cols) */}
          <div className="lg:col-span-8 bg-white rounded-2xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-6">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-black text-[#1c023d] flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-[#6700ce]" />
                  <span>Onboard New Personnel</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Register employee credentials, territory assignment, and allocate initial serialized technician toolkit.
                </p>
              </div>

              {onNavigateToBulk && (
                <button
                  type="button"
                  onClick={onNavigateToBulk}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-[#6700ce] font-extrabold text-xs transition flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Excel Batch Import</span>
                </button>
              )}
            </div>

            <form onSubmit={handleOnboardSubmit} className="space-y-6 text-xs">
              
              {/* Step 1: Employee Particulars */}
              <div className="space-y-3">
                <span className="text-[11px] font-black uppercase text-purple-900 tracking-wider flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-[#1c023d] text-white flex items-center justify-center text-[10px]">1</span>
                  Personnel Identity & Credentials
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Full Legal Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Chandra"
                      value={obName}
                      onChange={(e) => setObName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-semibold focus:outline-none focus:border-[#6700ce] focus:bg-white transition"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Corporate Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. ramesh.chandra@tataplay.com"
                      value={obEmail}
                      onChange={(e) => setObEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-semibold focus:outline-none focus:border-[#6700ce] focus:bg-white transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Designation / Role *</label>
                    <select
                      value={obRole}
                      onChange={(e) => setObRole(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 focus:outline-none focus:border-[#6700ce]"
                    >
                      <option value="FIELD_WORKER">Field Technician</option>
                      <option value="MANAGER">City Hub Manager</option>
                      <option value="REGIONAL_ADMIN">Regional Admin</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Assigned City Hub *</label>
                    <select
                      value={obCityId}
                      onChange={(e) => {
                        setObCityId(e.target.value);
                        fetchAvailableAssets(e.target.value);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 focus:outline-none focus:border-[#6700ce]"
                    >
                      {allLocations.map((loc) => (
                        <option key={loc.location_id} value={loc.location_id}>
                          {loc.city} ({loc.region_name || 'Regional'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Temporary Password *</label>
                    <input
                      type="text"
                      required
                      value={obPassword}
                      onChange={(e) => setObPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold focus:outline-none focus:border-[#6700ce]"
                    />
                  </div>
                </div>
              </div>

              {/* Step 2: Initial Hardware Kit Allocation */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase text-purple-900 tracking-wider flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-[#1c023d] text-white flex items-center justify-center text-[10px]">2</span>
                    Allocate Starter Technician Hardware Kit (Optional)
                  </span>
                  <span className="text-xs text-purple-700 font-extrabold bg-purple-50 px-2.5 py-0.5 rounded-lg border border-purple-200">
                    {obSelectedAssets.length} Selected for Handover
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Select available serialized inventory from the chosen hub. Assets will be bound to this employee with formal digital handover.
                </p>

                {availableAssets.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-slate-400">
                    No unassigned serialized units currently available in this hub. You can onboard the technician without hardware and assign tools later.
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50/50">
                    {availableAssets.map((asset) => {
                      const isChecked = obSelectedAssets.includes(asset.asset_id);
                      return (
                        <label
                          key={asset.asset_id}
                          className={`p-3 flex items-center justify-between cursor-pointer transition ${
                            isChecked ? 'bg-purple-50/90' : 'hover:bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setObSelectedAssets([...obSelectedAssets, asset.asset_id]);
                                } else {
                                  setObSelectedAssets(obSelectedAssets.filter(id => id !== asset.asset_id));
                                }
                              }}
                              className="w-4 h-4 rounded text-[#6700ce] focus:ring-[#6700ce]"
                            />
                            <div>
                              <span className="font-extrabold text-[#1c023d] block">{asset.item_name}</span>
                              <span className="text-[11px] text-slate-500">{asset.variant_name} • {asset.category}</span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="font-mono text-[11px] font-black text-[#6700ce] bg-purple-100/70 px-2 py-0.5 rounded border border-purple-200 block">
                              SN: {asset.serial_number}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase">{asset.status}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('directory')}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={obSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#1c023d] to-[#6700ce] hover:from-[#2a085c] hover:to-[#5200a5] text-white font-black shadow-lg shadow-purple-900/20 transition flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{obSubmitting ? 'Onboarding Personnel...' : 'Complete Staff Onboarding'}</span>
                </button>
              </div>

            </form>

          </div>

          {/* Right Info Box: Corporate Onboarding Compliance (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            
            <div className="bg-gradient-to-br from-purple-900 to-[#1c023d] text-white rounded-2xl p-6 shadow-md space-y-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-[#e20d65]">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black">Tata Play Fiber Custody SLA</h3>
                <p className="text-xs text-purple-200 mt-1 leading-relaxed">
                  Every device issued to field technicians or managers is electronically serialized and logged into our central audit registry.
                </p>
              </div>

              <div className="space-y-2 pt-2 text-xs border-t border-white/10">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Instant serialized custody binding</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Auto-generated digital handover receipt</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Zero unrecovered assets on employee departure</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-3 text-xs">
              <h4 className="font-black text-[#1c023d] flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-purple-700" />
                <span>Bulk Technician Onboarding</span>
              </h4>
              <p className="text-slate-500 leading-relaxed">
                Have more than 5 technicians joining at once? Download the standard Tata Play Fiber Excel template, fill the details, and import in 1 click.
              </p>
              <a
                href="/api/users/template"
                download="tataplay_user_onboarding_template.xlsx"
                className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold transition flex items-center justify-center gap-2 border border-slate-300 block text-center"
              >
                <Download className="w-4 h-4 text-[#6700ce]" />
                <span>Download .xlsx Template</span>
              </a>
            </div>

          </div>

        </div>
      )}

      {/* ================= TAB 3: NOC CLEARANCE & ASSET SURRENDER HUB ================= */}
      {activeTab === 'clearance_hub' && (
        <div className="space-y-6">
          
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-[#1c023d] flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <span>Staff Exit Clearance & Hardware Surrender Hub</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Inspect returned serialized devices, check-in equipment back to hub stock, and certify zero liability before NOC certificate issuance.
              </p>
            </div>

            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl">
              {exitingUsers.length} Personnel Currently in Clearance
            </span>
          </div>

          {exitingUsers.length === 0 ? (
            <div className="bg-white rounded-2xl p-16 border border-slate-200 text-center space-y-3">
              <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto" />
              <h3 className="text-base font-black text-[#1c023d]">All Clear! No Pending Employee Offboarding Audits</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No personnel are currently in the exit clearance pipeline. To initiate offboarding for a departing employee, go to the Personnel Custody Directory and click "Initiate Exit".
              </p>
              <button
                onClick={() => setActiveTab('directory')}
                className="px-4 py-2 rounded-xl bg-[#1c023d] text-white font-extrabold text-xs transition"
              >
                Go to Personnel Directory
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {exitingUsers.map((u) => {
                const hasAssets = (u.assigned_assets_count || 0) > 0;
                return (
                  <div key={u.user_id} className="bg-white rounded-2xl border-2 border-amber-200/80 shadow-sm p-6 space-y-4">
                    
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center font-black text-sm">
                          {u.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-black text-base text-[#1c023d]">{u.name}</h3>
                          <p className="text-xs text-slate-500">{u.email}</p>
                          <p className="text-[11px] text-slate-400 font-bold mt-0.5">{u.role} • {u.location_name}</p>
                        </div>
                      </div>

                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300">
                        In Clearance
                      </span>
                    </div>

                    {/* Liability Summary */}
                    <div className={`p-4 rounded-xl text-xs space-y-2 ${
                      hasAssets ? 'bg-rose-50 border border-rose-200 text-rose-900' : 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                    }`}>
                      <div className="flex items-center justify-between font-black">
                        <span className="flex items-center gap-1.5">
                          {hasAssets ? <AlertTriangle className="w-4 h-4 text-rose-600" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                          {hasAssets ? `${u.assigned_assets_count} Devices Unreturned` : '100% Asset Surrender Verified'}
                        </span>
                        <span className="font-mono text-[11px] font-extrabold">
                          {hasAssets ? 'NOC Blocked' : 'NOC Unlocked'}
                        </span>
                      </div>
                      <p className="text-[11px] opacity-90 leading-relaxed">
                        {hasAssets 
                          ? 'This employee still holds active serialized hardware. Inspect and surrender these assets to release NOC.' 
                          : 'Zero active hardware liability recorded. Employee is clear to receive official Tata Play Fiber No Objection Certificate.'
                        }
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                      <button
                        onClick={() => handleCancelLeaving(u.user_id)}
                        className="text-xs font-bold text-slate-500 hover:text-slate-800 transition"
                      >
                        Cancel Exit
                      </button>

                      <div className="flex items-center gap-2">
                        {u.role === 'MANAGER' && (
                          <button
                            onClick={() => handleOpenManagerHandover(u.user_id)}
                            className="px-3 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#6700ce] font-extrabold text-xs border border-purple-200 transition flex items-center gap-1.5 shadow-2xs"
                          >
                            <Building2 className="w-3.5 h-3.5" />
                            <span>Stock Handover</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleCheckClearance(u)}
                          className={`px-4 py-2 rounded-xl font-extrabold text-xs shadow-sm transition flex items-center gap-2 ${
                            hasAssets 
                              ? 'bg-[#6700ce] hover:bg-[#5200a5] text-white' 
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                        >
                          {hasAssets ? <Wrench className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                          <span>{hasAssets ? 'Inspect & Surrender Assets' : 'Issue Official NOC Certificate'}</span>
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ================= TAB 4: OFFICIAL ISSUED NOC ARCHIVE ================= */}
      {activeTab === 'noc_archive' && (
        <div className="space-y-4">
          
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-[#1c023d] flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-600" />
                <span>Issued Official NOC Certificates Archive</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Official legal register of all digitally signed No Objection Certificates issued by Tata Play Fiber.
              </p>
            </div>

            <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl">
              {nocRecords.length} Certificates Digitally Stamped
            </span>
          </div>

          {nocRecords.length === 0 ? (
            <div className="bg-white rounded-2xl p-16 border border-slate-200 text-center space-y-2">
              <FileText className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-sm font-black text-slate-600">No NOC Certificates Issued Yet</h3>
              <p className="text-xs text-slate-400">Certificates issued upon 100% asset clearance will appear here permanently.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {nocRecords.map((noc) => (
                <div key={noc.noc_id} className="bg-white rounded-2xl p-5 border border-slate-200 hover:border-purple-300 hover:shadow-md transition space-y-3">
                  
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-black text-[#6700ce] bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
                      {noc.noc_number}
                    </span>
                    <span className="text-slate-400 font-mono text-[10px] font-bold">
                      {new Date(noc.cleared_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-black text-base text-[#1c023d]">{noc.user_name}</h3>
                    <p className="text-xs text-slate-500 font-medium">{noc.user_role} • {noc.city_name} Hub</p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Issued by: <strong className="text-slate-800">{noc.issued_by_name}</strong></span>
                    <button
                      onClick={() => setSelectedNocModal(noc)}
                      className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-[#6700ce] hover:text-white border border-slate-200 font-bold text-slate-700 flex items-center gap-1.5 transition shadow-xs"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print / PDF</span>
                    </button>
                  </div>

                </div>
              ))}
            </div>
          )}

          {/* Managerial Stock Handover Registry */}
          {managerHandovers && managerHandovers.length > 0 && (
            <div className="pt-6 space-y-4">
              <div className="border-t border-slate-200 pt-6">
                <h3 className="text-base font-black text-[#1c023d] flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[#6700ce]" />
                  <span>Managerial Stock Custody Handover Registry</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Official certificates documenting warehouse inventory reassignment, evacuation to central, and inter-city transfers.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {managerHandovers.map((ho) => (
                  <div key={ho.handover_id} className="bg-white rounded-2xl p-5 border border-purple-200 hover:border-purple-400 hover:shadow-md transition space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-black text-[#6700ce] bg-purple-50 px-2 py-1 rounded border border-purple-200">
                        {ho.handover_number}
                      </span>
                      <span className="text-slate-400 font-mono text-[10px] font-bold">
                        {new Date(ho.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-black text-sm text-[#1c023d]">{ho.outgoing_manager_name}</h4>
                      <p className="text-[11px] text-slate-500 font-bold">{ho.city_name} Hub Warehouse</p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Destination:</span>
                        <strong className="text-purple-900">{ho.target_entity_name}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Assets Moved:</span>
                        <strong className="font-mono">{ho.assets_transferred_count} units</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Valuation:</span>
                        <strong className="font-mono text-emerald-700">₹{ho.total_valuation_inr?.toLocaleString('en-IN')}</strong>
                      </div>
                    </div>

                    <button
                      onClick={() => setActiveHandoverRecord(ho)}
                      className="w-full py-1.5 rounded-lg bg-purple-50 hover:bg-[#6700ce] hover:text-white border border-purple-200 font-bold text-[11px] text-[#6700ce] transition flex items-center justify-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>View Handover Certificate</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* ================= MODAL 1: CLEARANCE VERIFICATION & IN-PLACE ASSET SURRENDER ================= */}
      {clearanceData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-5">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-[#1c023d] flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#6700ce]" />
                  <span>Hardware Custody Audit & NOC Clearance</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verify serial return, surrender items to stock or flag damaged, then issue certificate.
                </p>
              </div>
              <button onClick={() => setClearanceData(null)} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Employee Particulars Card */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-[#1c023d] text-sm">{clearanceData.user_name}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-purple-100 text-[#6700ce]">
                  {clearanceData.user_role}
                </span>
              </div>
              <span className="text-slate-500 block">Territory: {clearanceData.city_name || 'Central'} • {clearanceData.region_name || 'National'}</span>
            </div>

            {/* Managerial City Hub Stock Stewardship Card */}
            {clearanceData.user_role === 'MANAGER' && (
              <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-black">
                    <Building2 className="w-4 h-4 text-[#6700ce]" />
                    <span>City Warehouse Custody Stewardship</span>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-purple-200 text-purple-900">
                    Manager Protocol
                  </span>
                </div>
                <p className="text-[11px] text-purple-800 leading-relaxed">
                  As the <strong>{clearanceData.city_name || 'City'} Hub Manager</strong>, leaving the position requires reassigning or evacuating the city warehouse stock. Custody can be assigned to a successor manager, evacuated back to Central Warehouse, or reallocated to another regional hub.
                </p>
                <button
                  type="button"
                  onClick={() => handleOpenManagerHandover(clearanceData.user_id)}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#1c023d] to-[#6700ce] hover:opacity-95 text-white font-black text-xs shadow-md transition flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Execute Manager Stock Handover & Warehouse Transition</span>
                </button>
              </div>
            )}

            {/* Clearance Blocking Reasons Display */}
            {clearanceData.blocking_reasons && clearanceData.blocking_reasons.length > 0 && !clearanceData.can_issue_noc && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-1">
                <span className="font-black text-rose-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Mandatory Clearance Hold
                </span>
                <ul className="list-disc list-inside text-[11px] text-rose-800 space-y-0.5">
                  {clearanceData.blocking_reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Clearance Status Condition */}
            {clearanceData.can_issue_noc ? (
              <div className="p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-200 text-emerald-900 text-xs space-y-3">
                <div className="flex items-center gap-2.5 font-black text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>100% Asset Clearance Verified!</span>
                </div>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  No active electronic equipment, modems, or technician tools are currently held by this personnel. All liabilities have been resolved. You can now issue the official No Objection Certificate.
                </p>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Official NOC Remarks / Settlement Notes</label>
                  <input
                    type="text"
                    value={nocRemarks}
                    onChange={(e) => setNocRemarks(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-emerald-300 font-medium text-xs focus:outline-none"
                    placeholder="Enter NOC certification remarks..."
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 font-black">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>NOC Issuance Blocked ({clearanceData.assigned_assets.length} Active Unit[s] Held)</span>
                  </div>
                  <p className="text-[11px] text-rose-800 leading-relaxed">
                    Mandatory physical surrender is required. Inspect each unit below and click <strong>"Check-In Stock"</strong> (if functional) or <strong>"Route Damaged"</strong> to clear the personnel.
                  </p>
                </div>

                {/* List of Held Assets with 1-Click Surrender Actions */}
                <div className="space-y-2.5 max-h-64 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50 text-xs">
                  {clearanceData.assigned_assets.map((asset) => (
                    <div key={asset.asset_id} className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-black text-[#1c023d] block">{asset.item_name}</span>
                          <span className="text-[11px] text-slate-500">{asset.variant_name} • {asset.category}</span>
                          <span className="font-mono text-[11px] text-[#6700ce] font-bold block mt-0.5">SN: {asset.serial_number}</span>
                        </div>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                          Surrender Required
                        </span>
                      </div>

                      {/* Surrender Action Buttons */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2 text-[11px]">
                        <button
                          onClick={() => handleSurrenderAsset(asset.asset_id, 'DAMAGED', 'Physical wear / damage observed during exit audit.')}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 font-bold border border-slate-200 transition flex items-center gap-1"
                        >
                          <Wrench className="w-3 h-3 text-rose-600" />
                          <span>Flag Damaged</span>
                        </button>
                        <button
                          onClick={() => handleSurrenderAsset(asset.asset_id, 'FUNCTIONAL', 'Returned in good working order.')}
                          className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-xs transition flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Check-In to Hub Stock</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            )}

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 pt-2 text-xs">
              <button
                onClick={() => setClearanceData(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition"
              >
                Close Audit
              </button>

              {clearanceData.can_issue_noc && (
                <button
                  disabled={actionLoading}
                  onClick={() => handleIssueNOC(clearanceData.user_id)}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black shadow-md flex items-center gap-2 transition"
                >
                  <Award className="w-4 h-4" />
                  <span>{actionLoading ? 'Generating NOC Certificate...' : 'Issue Official NOC Certificate'}</span>
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ================= MODAL 2: PRINTABLE OFFICIAL TATA PLAY FIBER NOC CERTIFICATE ================= */}
      {selectedNocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[95vh]">
            
            {/* Modal Top Actions */}
            <div className="px-6 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs no-print">
              <span className="font-extrabold text-[#1c023d] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Official Digital Document Preview</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-1.5 rounded-lg bg-[#1c023d] hover:bg-[#2a085c] text-white font-black flex items-center gap-1.5 transition shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5 text-[#e20d65]" />
                  <span>Print / Save PDF</span>
                </button>
                <button
                  onClick={() => setSelectedNocModal(null)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Certificate Canvas */}
            <div className="p-8 md:p-12 overflow-y-auto printable-certificate bg-white">
              
              <div className="border-8 border-double border-purple-900/30 p-8 md:p-10 rounded-xl space-y-6 relative bg-gradient-to-b from-white via-purple-50/10 to-slate-50">
                
                {/* Watermark Logo */}
                <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
                  <span className="text-9xl font-black text-purple-900 tracking-tighter">TPF</span>
                </div>

                {/* Certificate Header */}
                <div className="text-center space-y-1.5 border-b-2 border-slate-200 pb-5 relative z-10">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="w-9 h-9 rounded-xl bg-[#e20d65] text-white flex items-center justify-center font-black text-sm shadow-xs">
                      TP
                    </div>
                    <h1 className="text-2xl font-black text-[#1c023d] tracking-tight">TATA PLAY FIBER</h1>
                  </div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#e20d65]">Supply Chain & Asset Management Division</p>
                  <h2 className="text-xl font-black text-[#1c023d] uppercase pt-2 tracking-wide">NO OBJECTION CERTIFICATE (NOC)</h2>
                  <p className="font-mono text-xs font-bold text-slate-500">Certificate Ref: {selectedNocModal.noc_number}</p>
                </div>

                {/* Certificate Body */}
                <div className="space-y-4 text-xs sm:text-sm text-slate-800 leading-relaxed relative z-10">
                  <p>
                    This is to formally certify that <strong>{selectedNocModal.user_name}</strong>, who served in the capacity of <strong>{selectedNocModal.user_role}</strong> at the <strong>{selectedNocModal.city_name} Hub ({selectedNocModal.region_name})</strong>, has undergone and successfully concluded the mandatory serialized hardware asset return and inventory reconciliation protocol.
                  </p>

                  <div className="p-4 rounded-xl bg-emerald-50 border-2 border-emerald-200 text-emerald-950 font-bold flex items-center gap-3">
                    <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
                    <span>100% Serialized Asset Surrender Verified: All electronic modems, fusion splicers, OTDR meters, and corporate assets have been returned in satisfactory condition.</span>
                  </div>

                  <p className="text-xs text-slate-600 italic">
                    Tata Play Fiber confirms that the aforementioned personnel holds <strong>Zero Liability</strong> with regard to company inventory, field equipment, or serialized hardware dues.
                  </p>

                  {selectedNocModal.remarks && (
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                      <strong className="text-slate-700 block">Clearance Remarks:</strong>
                      <span className="text-slate-600">{selectedNocModal.remarks}</span>
                    </div>
                  )}
                </div>

                {/* Security Verification Stamp & Signatures */}
                <div className="pt-8 grid grid-cols-3 gap-4 text-xs border-t-2 border-slate-200 relative z-10 items-end">
                  
                  {/* Left: Authorized By */}
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-extrabold block">Authorized Controller</span>
                    <span className="font-black text-[#1c023d] block mt-1">{selectedNocModal.issued_by_name}</span>
                    <span className="text-[10px] text-slate-500">Asset Governance Division</span>
                  </div>

                  {/* Middle: Security Seal */}
                  <div className="text-center flex flex-col items-center">
                    <div className="w-14 h-14 rounded-full border-2 border-dashed border-[#6700ce] flex items-center justify-center p-1">
                      <div className="w-full h-full rounded-full bg-purple-50 text-[#6700ce] flex flex-col items-center justify-center text-[8px] font-black uppercase">
                        <span>CERTIFIED</span>
                        <Check className="w-3 h-3 text-emerald-600" />
                      </div>
                    </div>
                    <span className="text-[9px] font-mono text-slate-400 mt-1 uppercase font-bold">Tamper-Proof Seal</span>
                  </div>

                  {/* Right: Date & QR Code representation */}
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-extrabold block">Issue Date</span>
                    <span className="font-mono font-bold text-slate-800 block mt-1">
                      {new Date(selectedNocModal.cleared_at).toLocaleDateString('en-IN', { dateStyle: 'full' })}
                    </span>
                    <span className="text-[9px] font-mono font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block mt-1">
                      Digitally Verified
                    </span>
                  </div>

                </div>

              </div>

            </div>

          </div>
        </div>
      )}

      {/* ================= MODAL 3: DIGITAL HANDOVER RECEIPT (UPON ONBOARDING) ================= */}
      {handoverReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#1c023d]">Staff Onboarded & Kit Allocated!</h3>
                  <p className="text-xs text-slate-500">Official digital custody receipt generated</p>
                </div>
              </div>
              <button onClick={() => setHandoverReceipt(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 text-xs space-y-1">
              <span className="font-bold text-[#1c023d] block">{handoverReceipt.name} ({handoverReceipt.role})</span>
              <span className="font-mono text-slate-500 block">{handoverReceipt.email}</span>
              <span className="text-slate-600 block">Hub Territory: {handoverReceipt.city_name}</span>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-black text-[#1c023d] block">
                Issued Serialized Equipment ({handoverReceipt.assigned_serials?.length || 0} items):
              </span>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 max-h-40 overflow-y-auto space-y-1 font-mono text-xs">
                {handoverReceipt.assigned_serials?.map((sn, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[#6700ce] font-bold">
                    <span>• {sn}</span>
                    <span className="text-[10px] text-emerald-700 font-sans uppercase">Allocated</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 text-xs">
              <button
                onClick={() => setHandoverReceipt(null)}
                className="px-4 py-2 rounded-xl bg-[#1c023d] text-white font-extrabold transition"
              >
                Close & Done
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================= MODAL 4: VIEW PERSONNEL CUSTODY DETAIL DRAWER ================= */}
      {viewCustodyUser && clearanceData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-[#1c023d] flex items-center gap-2">
                  <Laptop className="w-5 h-5 text-[#6700ce]" />
                  <span>Assigned Hardware Custody List</span>
                </h3>
                <p className="text-xs text-slate-500">{viewCustodyUser.name} • {viewCustodyUser.location_name}</p>
              </div>
              <button onClick={() => setViewCustodyUser(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {clearanceData.assigned_assets.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 space-y-1">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <p className="font-bold">No Hardware Liabilities</p>
                <p className="text-slate-400">This employee does not hold any serialized devices.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {clearanceData.assigned_assets.map((asset) => (
                  <div key={asset.asset_id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-extrabold text-[#1c023d] block">{asset.item_name}</span>
                      <span className="text-[11px] text-slate-500">{asset.variant_name}</span>
                      <span className="font-mono text-[11px] text-[#6700ce] font-bold block mt-0.5">SN: {asset.serial_number}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-purple-100 text-[#6700ce]">
                      {asset.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 text-xs">
              <button
                onClick={() => setViewCustodyUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================= MODAL 5: MANAGERIAL STOCK HANDOVER & WAREHOUSE TRANSITION ================= */}
      {managerHandoverModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto p-6 md:p-8 space-y-5">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-[#1c023d] flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[#6700ce]" />
                  <span>Managerial Stock Custody Handover</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Reassign city warehouse stock, evacuate to central, or transfer to another regional hub.
                </p>
              </div>
              <button
                onClick={() => setManagerHandoverModal(prev => ({ ...prev, isOpen: false }))}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {managerHandoverModal.loading || !managerHandoverModal.managerData ? (
              <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-3 border-[#6700ce] border-t-transparent rounded-full animate-spin" />
                <span>Loading city warehouse stock metrics...</span>
              </div>
            ) : (
              <div className="space-y-5 text-xs">
                
                {/* Outgoing Manager Hub Telemetry Card */}
                <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-black tracking-wider text-purple-700 block">Departing Manager</span>
                      <strong className="text-base text-[#1c023d]">{managerHandoverModal.managerData.manager_name}</strong>
                    </div>
                    <span className="px-3 py-1 rounded-lg text-xs font-black uppercase bg-[#1c023d] text-white">
                      {managerHandoverModal.managerData.city_name} Hub
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-purple-200/60 text-center">
                    <div className="p-2 rounded-lg bg-white border border-purple-100">
                      <span className="text-[10px] text-slate-500 font-bold block">Warehouse Stock</span>
                      <strong className="text-sm font-mono text-[#1c023d]">{managerHandoverModal.managerData.warehouse_asset_count} units</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-purple-100">
                      <span className="text-[10px] text-slate-500 font-bold block">Asset Valuation</span>
                      <strong className="text-sm font-mono text-[#6700ce]">₹{managerHandoverModal.managerData.warehouse_valuation_inr?.toLocaleString('en-IN')}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-purple-100">
                      <span className="text-[10px] text-slate-500 font-bold block">Field Workers</span>
                      <strong className="text-sm font-mono text-[#1c023d]">{managerHandoverModal.managerData.team_field_worker_count} Staff</strong>
                    </div>
                  </div>
                </div>

                {/* Transition Action Options */}
                <div className="space-y-2.5">
                  <label className="block font-black text-slate-800 text-xs uppercase tracking-wider">
                    Select Transition Protocol:
                  </label>

                  {/* Option A: Successor Manager */}
                  <label
                    onClick={() => setManagerHandoverModal(prev => ({ ...prev, actionType: 'TRANSFER_TO_SUCCESSOR' }))}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer block transition space-y-2 ${
                      managerHandoverModal.actionType === 'TRANSFER_TO_SUCCESSOR'
                        ? 'border-[#6700ce] bg-purple-50/50 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="handover_action"
                          checked={managerHandoverModal.actionType === 'TRANSFER_TO_SUCCESSOR'}
                          onChange={() => {}}
                          className="text-[#6700ce] focus:ring-purple-500"
                        />
                        <strong className="text-slate-900 text-xs">Transfer to Successor City Manager</strong>
                      </div>
                      <span className="text-[10px] font-black uppercase text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                        Recommended
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 pl-6 leading-relaxed">
                      Reassigns all city warehouse inventory and custody stewardship directly to an incoming city manager.
                    </p>

                    {managerHandoverModal.actionType === 'TRANSFER_TO_SUCCESSOR' && (
                      <div className="pl-6 pt-1">
                        {managerHandoverModal.managerData.candidate_successors?.length > 0 ? (
                          <select
                            value={managerHandoverModal.successorId}
                            onChange={(e) => setManagerHandoverModal(prev => ({ ...prev, successorId: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-purple-300 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6700ce]"
                          >
                            {managerHandoverModal.managerData.candidate_successors.map(c => (
                              <option key={c.user_id} value={c.user_id}>
                                {c.name} ({c.email}) {c.city_name ? `• ${c.city_name}` : ''}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
                            No other active managers found. Please select <strong>"Evacuate to Central"</strong> or onboard a successor first.
                          </div>
                        )}
                      </div>
                    )}
                  </label>

                  {/* Option B: Evacuate to Central */}
                  <label
                    onClick={() => setManagerHandoverModal(prev => ({ ...prev, actionType: 'EVACUATE_TO_CENTRAL' }))}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer block transition space-y-2 ${
                      managerHandoverModal.actionType === 'EVACUATE_TO_CENTRAL'
                        ? 'border-[#6700ce] bg-purple-50/50 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="handover_action"
                        checked={managerHandoverModal.actionType === 'EVACUATE_TO_CENTRAL'}
                        onChange={() => {}}
                        className="text-[#6700ce] focus:ring-purple-500"
                      />
                      <strong className="text-slate-900 text-xs">Evacuate Stock to Central National Warehouse</strong>
                    </div>
                    <p className="text-[11px] text-slate-500 pl-6 leading-relaxed">
                      De-links all warehouse items from this city and absorbs them into the Central Headquarters reserve pool.
                    </p>
                  </label>

                  {/* Option C: Reallocate to Another City */}
                  <label
                    onClick={() => setManagerHandoverModal(prev => ({ ...prev, actionType: 'TRANSFER_TO_CITY' }))}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer block transition space-y-2 ${
                      managerHandoverModal.actionType === 'TRANSFER_TO_CITY'
                        ? 'border-[#6700ce] bg-purple-50/50 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="handover_action"
                        checked={managerHandoverModal.actionType === 'TRANSFER_TO_CITY'}
                        onChange={() => {}}
                        className="text-[#6700ce] focus:ring-purple-500"
                      />
                      <strong className="text-slate-900 text-xs">Reallocate Stock to Another Regional City Hub</strong>
                    </div>
                    <p className="text-[11px] text-slate-500 pl-6 leading-relaxed">
                      Transfers all city inventory to a neighboring regional hub (e.g., consolidating Delhi stock into Gurgaon or Noida).
                    </p>

                    {managerHandoverModal.actionType === 'TRANSFER_TO_CITY' && (
                      <div className="pl-6 pt-1">
                        <select
                          value={managerHandoverModal.targetCityId}
                          onChange={(e) => setManagerHandoverModal(prev => ({ ...prev, targetCityId: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl bg-white border border-purple-300 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6700ce]"
                        >
                          {managerHandoverModal.managerData.candidate_cities?.map(city => (
                            <option key={city.location_id} value={city.location_id}>
                              {city.name} Hub {city.region_name ? `(${city.region_name})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </label>

                </div>

                {/* Handover Notes */}
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">Official Transition Notes / Authorization Log</label>
                  <textarea
                    rows={2}
                    value={managerHandoverModal.transferNotes}
                    onChange={(e) => setManagerHandoverModal(prev => ({ ...prev, transferNotes: e.target.value }))}
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:bg-white focus:outline-none focus:border-[#6700ce]"
                    placeholder="Enter audit remarks or authorization references..."
                  />
                </div>

                {/* Submit / Cancel Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setManagerHandoverModal(prev => ({ ...prev, isOpen: false }))}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={actionLoading}
                    onClick={handleExecuteManagerHandover}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#1c023d] to-[#6700ce] hover:opacity-95 text-white font-black shadow-md transition flex items-center gap-2 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>{actionLoading ? 'Executing Handover...' : 'Execute Stock Handover & Clear Manager'}</span>
                  </button>
                </div>

              </div>
            )}

          </div>
        </div>
      )}

      {/* ================= MODAL 6: OFFICIAL MANAGERIAL HANDOVER CERTIFICATE ================= */}
      {activeHandoverRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto p-8 space-y-6">
            
            {/* Certificate Header */}
            <div className="border-b-2 border-[#1c023d] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-[#1c023d] text-white flex items-center justify-center font-black text-xs">
                    TPF
                  </span>
                  <span className="font-mono text-xs font-black uppercase tracking-widest text-[#6700ce]">
                    Tata Play Fiber Logistics Directorate
                  </span>
                </div>
                <h2 className="text-xl font-black text-[#1c023d] mt-1 tracking-tight">
                  Managerial Stock Custody Handover Certificate
                </h2>
              </div>
              <div className="text-right">
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 inline-block">
                  Official Audit Certified
                </span>
                <span className="font-mono text-[11px] font-black text-slate-600 block mt-1">
                  {activeHandoverRecord.handover_number}
                </span>
              </div>
            </div>

            {/* Legal Statement */}
            <p className="text-xs text-slate-600 leading-relaxed italic bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              "This document officially certifies that all warehouse inventory, spare modems, optical splice toolkits, and physical stock liabilities under the stewardship of <strong>{activeHandoverRecord.outgoing_manager_name}</strong> for the <strong>{activeHandoverRecord.city_name} Hub</strong> have been formally reallocated and transitioned to <strong>{activeHandoverRecord.target_entity_name}</strong>."
            </p>

            {/* Particulars Grid */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500">Outgoing Hub Manager</span>
                <strong className="text-slate-900 block text-sm">{activeHandoverRecord.outgoing_manager_name}</strong>
                <span className="text-[11px] text-purple-700 font-bold">{activeHandoverRecord.city_name} Hub Warehouse</span>
              </div>

              <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500">Transferee / Successor Custodian</span>
                <strong className="text-slate-900 block text-sm">{activeHandoverRecord.target_entity_name}</strong>
                <span className="text-[11px] text-emerald-700 font-bold">{activeHandoverRecord.action_type?.replace(/_/g, ' ')}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500">Hardware Units Transitioned</span>
                <strong className="text-slate-900 font-mono text-base block">{activeHandoverRecord.assets_transferred_count} Units</strong>
                <span className="text-[10px] text-slate-400">ONTs, Splicers & Power Meters</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500">Total Asset Capital Valuation</span>
                <strong className="text-[#6700ce] font-mono text-base block">₹{activeHandoverRecord.total_valuation_inr?.toLocaleString('en-IN')}</strong>
                <span className="text-[10px] text-slate-400">National Assets Registry Logged</span>
              </div>
            </div>

            {/* Verification Stamp & Signatures */}
            <div className="border-t border-slate-200 pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <span className="font-bold text-slate-800 block">Status: Formally Discharged & Cleared for NOC</span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Timestamp: {new Date(activeHandoverRecord.created_at || activeHandoverRecord.timestamp || Date.now()).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-dashed border-slate-300 text-center min-w-[180px]">
                <span className="text-[9px] uppercase font-black tracking-wider text-slate-400 block">Digital Verification Seal</span>
                <span className="font-mono text-[10px] font-black text-[#1c023d] block mt-0.5">TATA PLAY FIBER - HQ</span>
                <span className="text-[9px] text-emerald-600 font-bold block">IMMUTABLY LOGGED</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 text-xs">
              <button
                onClick={() => setActiveHandoverRecord(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2 rounded-xl bg-[#1c023d] hover:bg-[#2a085c] text-white font-black flex items-center gap-1.5 shadow-md transition"
              >
                <Printer className="w-4 h-4 text-[#e20d65]" />
                <span>Print Certificate</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
