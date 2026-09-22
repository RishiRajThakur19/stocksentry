import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Wrench, AlertTriangle, CheckCircle2, 
  Clock, Package, ArrowRight, RefreshCw, Hash, Wifi, 
  CheckSquare, BookOpen, User, MapPin, Gauge, Sparkles, 
  Printer, X, Copy, Check, ChevronRight, Phone, Mail, 
  Award, Zap, CheckCircle, Radio, Play, CheckCheck
} from 'lucide-react';
import api from '../api/client';
import { ReportFaultModal } from '../components/ReportFaultModal';

export const FieldWorkerDeskPage = ({ onNavigateToLifecycle, defaultSubTab = 'jobs' }) => {
  const [activeSubTab, setActiveSubTab] = useState(defaultSubTab); // 'jobs' | 'assets' | 'wifi-setup' | 'complaints' | 'guide'
  const [assignedAssets, setAssignedAssets] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedAssetForFault, setSelectedAssetForFault] = useState(null);

  // Field Service Work Orders (Simulated Real-Time Dispatch Queue)
  const [workOrders, setWorkOrders] = useState([
    {
      id: 'WO-DEL-2026-081',
      title: 'FTTH Gigabit Wi-Fi 6 Installation & Activation',
      customer: 'Pooja Verma',
      subscriberId: 'TPF-SUB-98214',
      phone: '+91 98112 45890',
      address: 'Flat 402, Block C, Green Park Extension, New Delhi',
      plan: 'Tata Play Fiber 300 Mbps Unlimited Gigabit',
      slot: '10:30 AM - 12:00 PM',
      priority: 'HIGH',
      status: 'PENDING', // PENDING, IN_PROGRESS, COMPLETED
      notes: 'New subscriber building hookup. Splitter port #4 at pole box.'
    },
    {
      id: 'WO-DEL-2026-082',
      title: 'Red Optical LOS Alarm - Splicing Breakdown',
      customer: 'Rohan Mehra',
      subscriberId: 'TPF-SUB-44109',
      phone: '+91 99580 12345',
      address: 'House 14B, Main Market, Hauz Khas, New Delhi',
      plan: 'Tata Play Fiber 500 Mbps Pro',
      slot: '02:00 PM - 03:30 PM',
      priority: 'CRITICAL',
      status: 'IN_PROGRESS',
      notes: 'Customer reports optical red flashing LOS indicator. Suspected drop cable macro-bend or core break.'
    },
    {
      id: 'WO-DEL-2026-083',
      title: 'Customer Premises ONT Relocation & Connector Rework',
      customer: 'Dr. Sameer Sen',
      subscriberId: 'TPF-SUB-76523',
      phone: '+91 98710 99881',
      address: 'Villa 7, Block F, Saket, New Delhi',
      plan: 'Tata Play Fiber 1 Gbps Enterprise Home',
      slot: '04:30 PM - 06:00 PM',
      priority: 'MEDIUM',
      status: 'PENDING',
      notes: 'Shift ONT modem from Ground Floor to 1st Floor Home Office. Needs 15m drop extension.'
    }
  ]);

  // Wi-Fi Setup & ONT Activation State
  const [wifiForm, setWifiForm] = useState({
    workOrderNo: '',
    subscriberId: '',
    subscriberName: '',
    subscriberAddress: '',
    selectedAssetId: '',
    wifiSsid: 'TataPlayFiber_5G_Home',
    wifiPassword: 'TPF@' + Math.floor(100000 + Math.random() * 900000),
    opticalPowerDbm: -19.2,
    installationNotes: 'Standard FTTH customer drop termination. Core clean and OTDR confirmed.'
  });

  const [submittingInstall, setSubmittingInstall] = useState(false);
  const [installationReceipt, setInstallationReceipt] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (defaultSubTab) {
      setActiveSubTab(defaultSubTab);
    }
  }, [defaultSubTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [assetsRes, complaintsRes] = await Promise.all([
        api.get('/lifecycle/my-assets'),
        api.get('/complaints/my')
      ]);
      setAssignedAssets(assetsRes.data);
      setComplaints(complaintsRes.data);

      // Pre-select first available ONT modem in toolbag if not set
      if (assetsRes.data && assetsRes.data.length > 0) {
        const ont = assetsRes.data.find(a => 
          (a.item_name || '').toLowerCase().includes('ont') || 
          (a.item_name || '').toLowerCase().includes('modem') ||
          (a.category || '').toLowerCase().includes('cpe')
        );
        if (ont) {
          setWifiForm(prev => ({
            ...prev,
            selectedAssetId: ont.asset_id,
            wifiSsid: `TataPlayFiber_5G_${ont.serial_number.slice(-4)}`
          }));
        } else {
          setWifiForm(prev => ({ ...prev, selectedAssetId: assetsRes.data[0].asset_id }));
        }
      }
    } catch (err) {
      console.error('Failed to fetch field technician data:', err);
    } finally {
      setLoading(false);
    }
  };

  const openReportFaultForAsset = (asset) => {
    setSelectedAssetForFault(asset);
    setIsReportModalOpen(true);
  };

  // Launch Wi-Fi Setup workflow from a Work Order
  const handleLaunchWifiSetupFromOrder = (order) => {
    setWifiForm(prev => ({
      ...prev,
      workOrderNo: order.id,
      subscriberId: order.subscriberId,
      subscriberName: order.customer,
      subscriberAddress: order.address,
      wifiSsid: `TataPlayFiber_5G_${order.customer.split(' ')[0]}`,
      installationNotes: `Completed on-site setup for ${order.plan}.`
    }));
    // Update order status to IN_PROGRESS
    setWorkOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'IN_PROGRESS' } : o));
    setActiveSubTab('wifi-setup');
  };

  const handleUpdateOrderStatus = (orderId, newStatus) => {
    setWorkOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
  };

  const handleGenerateWifiPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let key = 'TPF@';
    for (let i = 0; i < 6; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setWifiForm(prev => ({ ...prev, wifiPassword: key }));
  };

  // Submit Wi-Fi Setup & ONT Activation
  const handleSubmitWifiSetup = async (e) => {
    e.preventDefault();
    if (!wifiForm.selectedAssetId || !wifiForm.subscriberName || !wifiForm.subscriberId) {
      alert('Please fill all mandatory subscriber & equipment fields.');
      return;
    }

    setSubmittingInstall(true);
    try {
      const payload = {
        asset_id: parseInt(wifiForm.selectedAssetId),
        subscriber_id: wifiForm.subscriberId,
        subscriber_name: wifiForm.subscriberName,
        subscriber_address: wifiForm.subscriberAddress,
        wifi_ssid: wifiForm.wifiSsid,
        wifi_password: wifiForm.wifiPassword,
        optical_rx_power_dbm: parseFloat(wifiForm.opticalPowerDbm),
        work_order_no: wifiForm.workOrderNo || 'DIRECT-DISPATCH',
        installation_notes: wifiForm.installationNotes
      };

      const res = await api.post('/lifecycle/subscriber-installation', payload);
      setInstallationReceipt(res.data);

      // If tied to a work order, mark it completed
      if (wifiForm.workOrderNo) {
        handleUpdateOrderStatus(wifiForm.workOrderNo, 'COMPLETED');
      }

      // Refresh toolbag assets
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to complete subscriber Wi-Fi activation.');
    } finally {
      setSubmittingInstall(false);
    }
  };

  // Signal status evaluation
  const getSignalStatusInfo = (dbm) => {
    const val = parseFloat(dbm);
    if (val >= -24.0 && val <= -15.0) {
      return {
        label: 'Optimal 1 Gbps FTTH Signal',
        color: 'text-emerald-700 bg-emerald-50 border-emerald-300',
        badge: 'OPTIMAL (PASS)',
        icon: CheckCircle2,
        desc: 'Ideal optical link budget. Excellent SNR for full Gigabit broadband delivery.'
      };
    } else if (val >= -27.0 && val < -24.0) {
      return {
        label: 'Acceptable Signal (Clean Ferrule Advised)',
        color: 'text-amber-800 bg-amber-50 border-amber-300',
        badge: 'ACCEPTABLE',
        icon: AlertTriangle,
        desc: 'Within GPON operating range. Clean SC/APC connector with optical alcohol wipe.'
      };
    } else {
      return {
        label: 'Critical High Optical Loss',
        color: 'text-rose-800 bg-rose-50 border-rose-300',
        badge: 'FAIL (HIGH LOSS)',
        icon: AlertTriangle,
        desc: 'Below threshold (-27 dBm). High risk of red LOS alarm or subscriber disconnections.'
      };
    }
  };

  const currentSignal = getSignalStatusInfo(wifiForm.opticalPowerDbm);

  const getComplaintStatusBadge = (status) => {
    switch (status) {
      case 'OPEN':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200">Pending Review</span>;
      case 'ROUTED_TO_REPAIR':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-50 text-purple-700 border border-purple-200">In Regional Repair Lab</span>;
      case 'RESOLVED':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">Resolved & Replaced</span>;
      case 'REJECTED':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-600 border border-slate-200">Rejected</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-700 border border-slate-200">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 pb-16 font-sans w-full max-w-[1440px] mx-auto">
      
      {/* Top Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-purple-50 text-[#6700ce] border border-purple-200">
              <Wrench className="w-5 h-5 text-[#e20d65]" />
            </span>
            <h1 className="text-2xl font-black text-[#1c023d] tracking-tight">
              Field Technician Workspace & Wi-Fi Setup Desk
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Subscriber FTTH Installations, On-Site Wi-Fi Setup, Toolbag Custody, and Break-Fix Lab Status.
          </p>
        </div>

        {/* Quick Hub Telemetry Chips */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-xl bg-purple-50 text-[#6700ce] font-extrabold border border-purple-200 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>Field Assigned: Delhi Central Hub</span>
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-bold border border-slate-200 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>{assignedAssets.length} Active Kit Devices</span>
          </span>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2 text-xs font-black">
        <button
          onClick={() => setActiveSubTab('jobs')}
          className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 ${
            activeSubTab === 'jobs'
              ? 'bg-[#1c023d] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <CheckSquare className="w-4 h-4 text-[#e20d65]" />
          <span>Daily Field Work Orders</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white font-mono">
            {workOrders.filter(w => w.status !== 'COMPLETED').length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('wifi-setup')}
          className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 ${
            activeSubTab === 'wifi-setup'
              ? 'bg-[#1c023d] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Wifi className="w-4 h-4 text-emerald-400" />
          <span>Subscriber Wi-Fi & ONT Setup</span>
          <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider bg-[#e20d65] text-white font-black">
            On-Site Tool
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('assets')}
          className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 ${
            activeSubTab === 'assets'
              ? 'bg-[#1c023d] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-purple-400" />
          <span>My Assigned Toolbag</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700 font-mono">
            {assignedAssets.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('complaints')}
          className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 ${
            activeSubTab === 'complaints'
              ? 'bg-[#1c023d] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Wrench className="w-4 h-4 text-rose-400" />
          <span>Tool Defect & Lab Status</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700 font-mono">
            {complaints.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('guide')}
          className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 ${
            activeSubTab === 'guide'
              ? 'bg-[#1c023d] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-4 h-4 text-sky-400" />
          <span>Fiber Diagnostic & SOP Guide</span>
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl p-16 border border-slate-200 text-center space-y-3">
          <div className="w-10 h-10 border-3 border-[#6700ce] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 font-bold text-xs">Loading field tasks, toolbag assets, and calibration records...</p>
        </div>
      ) : (
        <>
          {/* ================= SUBTAB 1: DAILY FIELD WORK ORDERS ================= */}
          {activeSubTab === 'jobs' && (
            <div className="space-y-5 animate-fade-in">
              
              {/* Daily Overview KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Today's Assigned Jobs</span>
                  <span className="text-2xl font-black text-[#1c023d] font-mono block">{workOrders.length}</span>
                  <span className="text-[10px] text-slate-500">2 Installations • 1 Break-Fix</span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-black uppercase text-emerald-600 block">Setups Completed</span>
                  <span className="text-2xl font-black text-emerald-700 font-mono block">
                    {workOrders.filter(w => w.status === 'COMPLETED').length}
                  </span>
                  <span className="text-[10px] text-slate-500">Active Wi-Fi activated</span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-black uppercase text-amber-600 block">Pending In Field</span>
                  <span className="text-2xl font-black text-amber-700 font-mono block">
                    {workOrders.filter(w => w.status !== 'COMPLETED').length}
                  </span>
                  <span className="text-[10px] text-slate-500">Awaiting customer visit</span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-black uppercase text-purple-600 block">Assigned Toolbag Kit</span>
                  <span className="text-2xl font-black text-[#6700ce] font-mono block">{assignedAssets.length} Units</span>
                  <span className="text-[10px] text-slate-500">Splicer, OTDR, OPM, Modems</span>
                </div>
              </div>

              {/* Work Order Cards */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-black text-[#1c023d] flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-[#e20d65]" />
                    <span>Active Subscriber Jobs Scheduled for Today</span>
                  </h2>
                  <span className="text-xs text-slate-400 font-bold">Priority Dispatches from Delhi Hub</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {workOrders.map((order) => {
                    const isDone = order.status === 'COMPLETED';
                    const isInProg = order.status === 'IN_PROGRESS';

                    return (
                      <div 
                        key={order.id} 
                        className={`bg-white rounded-2xl p-5 border-2 transition flex flex-col justify-between space-y-4 shadow-sm ${
                          isDone 
                            ? 'border-emerald-200 bg-emerald-50/20' 
                            : isInProg 
                            ? 'border-[#6700ce] bg-purple-50/30' 
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="space-y-3 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[11px] font-black text-[#6700ce] bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                              {order.id}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              isDone ? 'bg-emerald-100 text-emerald-800' :
                              isInProg ? 'bg-purple-100 text-purple-800 animate-pulse' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                              {order.status}
                            </span>
                          </div>

                          <div>
                            <h3 className="font-black text-sm text-[#1c023d]">{order.title}</h3>
                            <p className="text-[11px] text-[#e20d65] font-extrabold mt-0.5">{order.plan}</p>
                          </div>

                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-[11px]">
                            <div className="flex items-center gap-1.5 font-bold text-slate-800">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              <span>{order.customer}</span>
                              <span className="font-mono text-[10px] text-slate-400">({order.subscriberId})</span>
                            </div>
                            <div className="flex items-start gap-1.5 text-slate-600">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                              <span className="leading-tight">{order.address}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-500 font-mono text-[10px]">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>Slot: {order.slot}</span>
                            </div>
                          </div>

                          <p className="text-[11px] text-slate-500 italic bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                            "{order.notes}"
                          </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                          {isDone ? (
                            <span className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-[11px] flex items-center gap-1 w-full justify-center">
                              <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Customer Activated & Signed Off</span>
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={() => handleUpdateOrderStatus(order.id, isInProg ? 'PENDING' : 'IN_PROGRESS')}
                                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition"
                              >
                                {isInProg ? 'Pause' : 'Start Job'}
                              </button>
                              <button
                                onClick={() => handleLaunchWifiSetupFromOrder(order)}
                                className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#1c023d] to-[#6700ce] hover:opacity-95 text-white font-black text-[11px] shadow-sm transition flex items-center gap-1.5"
                              >
                                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Setup Wi-Fi & Activate</span>
                              </button>
                            </>
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* ================= SUBTAB 2: SUBSCRIBER WI-FI & ONT SETUP TOOL ================= */}
          {activeSubTab === 'wifi-setup' && (
            <div className="bg-white rounded-2xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-6 animate-fade-in">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded-lg bg-emerald-50 text-emerald-600">
                      <Wifi className="w-5 h-5" />
                    </span>
                    <h2 className="text-lg font-black text-[#1c023d]">
                      On-Site Subscriber Wi-Fi Setup & ONT Activation Tool
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Bind customer details, configure wireless SSIDs, measure optical link power (dBm), and activate live service.
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <span>OLT Delhi Pole Splitter Connected</span>
                </div>
              </div>

              <form onSubmit={handleSubmitWifiSetup} className="space-y-6 text-xs">
                
                {/* 1. Subscriber Particulars */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-4 h-4 text-purple-700" />
                    <span>Step 1: Subscriber Particulars</span>
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Subscriber Account ID *</label>
                      <input
                        type="text"
                        value={wifiForm.subscriberId}
                        onChange={(e) => setWifiForm(prev => ({ ...prev, subscriberId: e.target.value }))}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 font-mono text-xs focus:bg-white focus:outline-none focus:border-[#6700ce]"
                        placeholder="e.g. TPF-SUB-98214"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Customer Full Name *</label>
                      <input
                        type="text"
                        value={wifiForm.subscriberName}
                        onChange={(e) => setWifiForm(prev => ({ ...prev, subscriberName: e.target.value }))}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold focus:bg-white focus:outline-none focus:border-[#6700ce]"
                        placeholder="e.g. Pooja Verma"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Installation Address *</label>
                      <input
                        type="text"
                        value={wifiForm.subscriberAddress}
                        onChange={(e) => setWifiForm(prev => ({ ...prev, subscriberAddress: e.target.value }))}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs focus:bg-white focus:outline-none focus:border-[#6700ce]"
                        placeholder="e.g. Flat 402, Block C, Green Park Extn"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Hardware Deployment from Toolbag */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-purple-700" />
                    <span>Step 2: Select ONT Modem From Your Assigned Toolbag</span>
                  </h3>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Assigned ONT Serial Number *</label>
                    <select
                      value={wifiForm.selectedAssetId}
                      onChange={(e) => setWifiForm(prev => ({ ...prev, selectedAssetId: e.target.value }))}
                      className="w-full md:w-1/2 px-3.5 py-2.5 rounded-xl bg-white border border-purple-300 text-xs font-mono font-bold text-purple-950 focus:outline-none focus:ring-2 focus:ring-[#6700ce]"
                      required
                    >
                      {assignedAssets.map(a => (
                        <option key={a.asset_id} value={a.asset_id}>
                          {a.item_name} ({a.variant_name}) — SN: {a.serial_number}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400 mt-1">
                      This optical device will be registered under the customer's permanent subscriber address.
                    </p>
                  </div>
                </div>

                {/* 3. Wi-Fi Configuration */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Wifi className="w-4 h-4 text-emerald-600" />
                    <span>Step 3: Dual-Band Wi-Fi Configuration</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Broadcast Wi-Fi SSID (Network Name)</label>
                      <input
                        type="text"
                        value={wifiForm.wifiSsid}
                        onChange={(e) => setWifiForm(prev => ({ ...prev, wifiSsid: e.target.value }))}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 font-bold text-xs focus:bg-white focus:outline-none focus:border-[#6700ce]"
                        placeholder="e.g. TataPlayFiber_5G_Home"
                        required
                      />
                      <span className="text-[10px] text-slate-400 block mt-1">Dual-band 2.4 GHz + 5 GHz band steering enabled.</span>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-slate-700 font-bold">WPA2/WPA3 Security Password</label>
                        <button
                          type="button"
                          onClick={handleGenerateWifiPassword}
                          className="text-[10px] font-black text-[#6700ce] hover:underline flex items-center gap-1"
                        >
                          <Sparkles className="w-3 h-3 text-[#e20d65]" /> Generate Key
                        </button>
                      </div>
                      <input
                        type="text"
                        value={wifiForm.wifiPassword}
                        onChange={(e) => setWifiForm(prev => ({ ...prev, wifiPassword: e.target.value }))}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 font-mono text-xs font-bold focus:bg-white focus:outline-none focus:border-[#6700ce]"
                        required
                      />
                      <span className="text-[10px] text-slate-400 block mt-1">Printed on customer welcome sign-off receipt.</span>
                    </div>
                  </div>
                </div>

                {/* 4. Optical Link Verification & Power Check */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Gauge className="w-4 h-4 text-sky-600" />
                    <span>Step 4: Optical Power Meter (OPM) Reading at Doorstep (dBm)</span>
                  </h3>

                  <div className="p-4 rounded-xl border-2 space-y-3 bg-slate-50 border-slate-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <label className="block text-slate-800 font-bold mb-1">
                          Measured Optical Power (dBm) from OPM-300B Tester
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.1"
                            value={wifiForm.opticalPowerDbm}
                            onChange={(e) => setWifiForm(prev => ({ ...prev, opticalPowerDbm: e.target.value }))}
                            className="w-36 px-3.5 py-2 rounded-xl bg-white border border-slate-300 font-mono font-black text-base text-[#1c023d] focus:outline-none focus:ring-2 focus:ring-[#6700ce]"
                            required
                          />
                          <span className="font-mono text-xs font-bold text-slate-500">dBm @ 1490nm</span>
                        </div>
                      </div>

                      {/* Live Diagnostic Status Card */}
                      <div className={`p-3 rounded-xl border flex items-center gap-3 ${currentSignal.color}`}>
                        <currentSignal.icon className="w-6 h-6 shrink-0" />
                        <div>
                          <span className="font-black text-xs block">{currentSignal.badge}</span>
                          <span className="text-[11px] block">{currentSignal.desc}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-4 pt-2 border-t border-slate-200">
                      <span>Standard Target: <strong className="text-slate-800">-18 dBm to -24 dBm</strong></span>
                      <span>Class B+ Limit: <strong className="text-slate-800">-8 dBm to -28 dBm</strong></span>
                      <span>Red LOS Threshold: <strong className="text-rose-600">&lt; -27 dBm</strong></span>
                    </div>
                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="submit"
                    disabled={submittingInstall}
                    className="px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs shadow-lg shadow-emerald-900/20 transition flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>{submittingInstall ? 'Activating ONT...' : 'Complete Wi-Fi Setup & Activate Customer'}</span>
                  </button>
                </div>

              </form>

            </div>
          )}

          {/* ================= SUBTAB 3: MY ASSIGNED TOOLBAG & HARDWARE ================= */}
          {activeSubTab === 'assets' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-black text-[#1c023d] flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Hardware Custody Toolbag ({assignedAssets.length} Serialized Units)</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Optical fusion machines, OTDR testers, power meters, and field installation modems under your personal care.
                  </p>
                </div>
                <button onClick={fetchData} className="text-xs font-bold text-[#6700ce] hover:underline flex items-center gap-1">
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
              </div>

              {assignedAssets.length === 0 ? (
                <div className="bg-white rounded-2xl p-16 border border-slate-200 text-center space-y-3">
                  <Package className="w-10 h-10 text-slate-300 mx-auto" />
                  <h3 className="text-sm font-black text-slate-700">No Hardware Currently Assigned</h3>
                  <p className="text-xs text-slate-400">Request equipment from your City Hub Manager to begin FTTH installations.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {assignedAssets.map((asset) => {
                    const isOnt = (asset.item_name || '').toLowerCase().includes('ont') || (asset.item_name || '').toLowerCase().includes('modem');

                    return (
                      <div key={asset.asset_id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between hover:border-purple-300 transition">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                              {asset.category}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                              In Toolbag
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <img
                              src={asset.image_url || '/assets/modem_nokia.png'}
                              alt={asset.item_name}
                              className="w-14 h-14 object-contain bg-slate-50 rounded-xl p-1 border border-slate-200 shrink-0"
                            />
                            <div>
                              <h3 className="text-sm font-black text-[#1c023d]">{asset.item_name}</h3>
                              <span className="text-xs text-slate-500 font-bold block">{asset.variant_name}</span>
                              <span className="font-mono text-xs font-bold text-purple-900 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 inline-block mt-1">
                                SN: {asset.serial_number}
                              </span>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                            <span>Unit Value: <strong className="text-slate-800 font-mono">₹{asset.unit_cost?.toLocaleString('en-IN')}</strong></span>
                            <span>Assigned: <strong className="text-slate-800">{new Date(asset.created_at).toLocaleDateString('en-IN')}</strong></span>
                          </div>
                        </div>

                        {/* Card Action Buttons */}
                        <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                          <button
                            onClick={() => openReportFaultForAsset(asset)}
                            className="flex-1 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-xs border border-rose-200 transition flex items-center justify-center gap-1.5"
                          >
                            <Wrench className="w-3.5 h-3.5" />
                            <span>Report Defect</span>
                          </button>

                          {isOnt && (
                            <button
                              onClick={() => {
                                setWifiForm(prev => ({
                                  ...prev,
                                  selectedAssetId: asset.asset_id,
                                  wifiSsid: `TataPlayFiber_5G_${asset.serial_number.slice(-4)}`
                                }));
                                setActiveSubTab('wifi-setup');
                              }}
                              className="px-3 py-1.5 rounded-xl bg-[#6700ce] hover:bg-[#5200a5] text-white font-extrabold text-xs transition flex items-center gap-1"
                              title="Deploy this ONT at customer address"
                            >
                              <Wifi className="w-3.5 h-3.5" />
                              <span>Setup</span>
                            </button>
                          )}

                          <button
                            onClick={() => onNavigateToLifecycle?.(asset.serial_number)}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                            title="View complete audit timeline"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================= SUBTAB 4: TOOL DEFECT COMPLAINTS & LAB STATUS ================= */}
          {activeSubTab === 'complaints' && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-sm font-black text-[#1c023d] flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-rose-600" />
                    <span>My Tool Defect Complaints & Regional Lab Status ({complaints.length})</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Track the diagnostic and calibration lifecycle of your reported broken tools.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedAssetForFault(null);
                    setIsReportModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#e20d65] hover:bg-[#cc0059] text-white font-extrabold text-xs shadow-sm transition flex items-center gap-2"
                >
                  <Wrench className="w-4 h-4" />
                  <span>Report Broken Tool</span>
                </button>
              </div>

              {complaints.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs space-y-1">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="font-bold text-slate-700">All Toolbag Equipment 100% Operational</p>
                  <p className="text-slate-400">No active defect complaints filed.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200 text-[11px]">
                      <tr>
                        <th className="py-3 px-3">Complaint Ref</th>
                        <th className="py-3 px-3">Equipment Particulars</th>
                        <th className="py-3 px-3">Defect Description</th>
                        <th className="py-3 px-3">Lab Status</th>
                        <th className="py-3 px-3">Filed Date</th>
                        <th className="py-3 px-3 text-right">Audit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {complaints.map((c) => (
                        <tr key={c.complaint_id} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-400">
                            #{c.complaint_id}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-extrabold text-[#1c023d] block">{c.item_name}</span>
                            <span className="font-mono text-[11px] text-purple-800 font-bold">SN: {c.serial_number}</span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-800 max-w-sm font-medium">
                            <p className="line-clamp-2">{c.description}</p>
                          </td>
                          <td className="py-2.5 px-3">
                            {getComplaintStatusBadge(c.status)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                            {new Date(c.created_at).toLocaleDateString('en-IN')}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => onNavigateToLifecycle?.(c.serial_number)}
                              className="px-2.5 py-1 rounded-lg bg-[#6700ce] hover:bg-[#5200a5] text-white font-bold text-[10px] inline-flex items-center gap-1 transition"
                            >
                              <span>Timeline</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ================= SUBTAB 5: FIBER DIAGNOSTIC & SOP GUIDE ================= */}
          {activeSubTab === 'guide' && (
            <div className="space-y-6 animate-fade-in text-xs">
              
              {/* Card 1: GPON Optical Link Standards */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Gauge className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-base font-black text-[#1c023d]">
                    Tata Play Fiber Optical Link Budget Reference (GPON Class B+)
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1">
                    <span className="text-[10px] uppercase font-black text-emerald-800 block">Optimal Signal (Target)</span>
                    <strong className="text-base font-mono text-emerald-950 block">-18.0 dBm to -24.0 dBm</strong>
                    <p className="text-[11px] text-emerald-800">
                      Standard subscriber doorstep optical power. Guarantees full 1 Gbps Gigabit speed and zero packet loss.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1">
                    <span className="text-[10px] uppercase font-black text-amber-800 block">Acceptable Margin</span>
                    <strong className="text-base font-mono text-amber-950 block">-24.1 dBm to -27.0 dBm</strong>
                    <p className="text-[11px] text-amber-800">
                      Marginal optical budget. Clean the SC/APC fiber ferrule with 99% isopropyl alcohol wipe and re-measure.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200 space-y-1">
                    <span className="text-[10px] uppercase font-black text-rose-800 block">Critical High Loss (Alarm)</span>
                    <strong className="text-base font-mono text-rose-950 block">&lt; -27.0 dBm</strong>
                    <p className="text-[11px] text-rose-800">
                      Triggers Red LOS LED on ONT. Inspect drop cable for 90° sharp bends or splice loss &gt; 0.05 dB.
                    </p>
                  </div>
                </div>
              </div>

              {/* Card 2: 5-Step Splicing SOP */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Wrench className="w-5 h-5 text-[#6700ce]" />
                  <h3 className="text-base font-black text-[#1c023d]">
                    Fujikura 90S+ Core Alignment Splicing Protocol
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-[11px]">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <span className="w-5 h-5 rounded-full bg-[#1c023d] text-white font-black text-[10px] flex items-center justify-center">1</span>
                    <strong className="text-slate-900 block font-bold">Strip 250µm Coating</strong>
                    <p className="text-slate-500">Use precision dual-hole fiber stripper to strip 35mm bare silica.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <span className="w-5 h-5 rounded-full bg-[#1c023d] text-white font-black text-[10px] flex items-center justify-center">2</span>
                    <strong className="text-slate-900 block font-bold">Clean Bare Fiber</strong>
                    <p className="text-slate-500">Wipe with 99.9% Isopropyl Alcohol (IPA) lint-free Kimwipes once only.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <span className="w-5 h-5 rounded-full bg-[#1c023d] text-white font-black text-[10px] flex items-center justify-center">3</span>
                    <strong className="text-slate-900 block font-bold">CT-50 Precision Cleave</strong>
                    <p className="text-slate-500">Ensure perpendicular 90° cleave angle (&lt; 0.8°). Check length 10mm.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <span className="w-5 h-5 rounded-full bg-[#1c023d] text-white font-black text-[10px] flex items-center justify-center">4</span>
                    <strong className="text-slate-900 block font-bold">Arc Fusion & Inspection</strong>
                    <p className="text-slate-500">Close wind cover. Splicer auto-aligns cores. Target loss &lt; 0.03 dB.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <span className="w-5 h-5 rounded-full bg-[#1c023d] text-white font-black text-[10px] flex items-center justify-center">5</span>
                    <strong className="text-slate-900 block font-bold">Heat Shrink Sleeve</strong>
                    <p className="text-slate-500">Slide 60mm protection sleeve into center oven. Run 9-second shrink.</p>
                  </div>
                </div>
              </div>

              {/* Card 3: ONT Diagnostic LED Guide */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Radio className="w-5 h-5 text-[#e20d65]" />
                  <h3 className="text-base font-black text-[#1c023d]">
                    Nokia GPON ONT Modem LED Diagnostic Guide
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-3 rounded-xl border border-slate-200 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-emerald-500" />
                      <strong className="text-slate-900">PON (Solid Green)</strong>
                    </div>
                    <p className="text-slate-500 text-[11px]">Normal OLT synchronization established. Ready for internet traffic.</p>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-200 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                      <strong className="text-slate-900">PON (Blinking Green)</strong>
                    </div>
                    <p className="text-slate-500 text-[11px]">Handshaking and authenticating with Central OLT line card.</p>
                  </div>

                  <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/50 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-rose-600 animate-ping" />
                      <strong className="text-rose-900">LOS (Flashing Red)</strong>
                    </div>
                    <p className="text-rose-800 text-[11px]">Loss of Optical Signal! Fiber break, disconnected drop, or power &lt; -27 dBm.</p>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-200 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-sky-500" />
                      <strong className="text-slate-900">LAN / 5G Wi-Fi</strong>
                    </div>
                    <p className="text-slate-500 text-[11px]">Rapid flashing indicates active high-speed subscriber packet flow.</p>
                  </div>
                </div>
              </div>

              {/* Card 4: Support Escalation Contacts */}
              <div className="bg-gradient-to-r from-[#1c023d] to-[#6700ce] text-white rounded-2xl p-6 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-base font-black">Field Escalation & Hub Support</h4>
                  <p className="text-xs text-purple-200">
                    Need additional drop cable reels, replacement fast connectors, or emergency lab assistance?
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs font-bold">
                  <span className="px-3.5 py-2 rounded-xl bg-white/10 border border-white/20 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Delhi Hub Store: Ext. 402</span>
                  </span>
                  <span className="px-3.5 py-2 rounded-xl bg-white/10 border border-white/20 flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-[#e20d65]" />
                    <span>Lab Bay Desk: Ext. 509</span>
                  </span>
                </div>
              </div>

            </div>
          )}
        </>
      )}

      {/* ================= MODAL: CUSTOMER WI-FI HANDOVER & ACTIVATION SLIP ================= */}
      {installationReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto p-8 space-y-6">
            
            {/* Header */}
            <div className="border-b-2 border-[#1c023d] pb-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-[#1c023d] text-white flex items-center justify-center font-black text-xs">
                    TPF
                  </span>
                  <span className="font-mono text-xs font-black uppercase tracking-widest text-[#6700ce]">
                    Tata Play Fiber FTTH Directorate
                  </span>
                </div>
                <h2 className="text-xl font-black text-[#1c023d] mt-1 tracking-tight">
                  Customer Wi-Fi Setup & Handover Slip
                </h2>
              </div>
              <div className="text-right">
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 inline-block">
                  Service Activated
                </span>
                <span className="font-mono text-[11px] font-black text-slate-600 block mt-1">
                  {installationReceipt.installation_id}
                </span>
              </div>
            </div>

            {/* Subscriber & Device Details */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500">Subscriber Particulars</span>
                <strong className="text-slate-900 block text-sm">{installationReceipt.subscriber_name}</strong>
                <span className="text-[11px] text-purple-800 font-mono font-bold block">{installationReceipt.subscriber_id}</span>
                <span className="text-[11px] text-slate-600 block mt-1 leading-tight">{installationReceipt.subscriber_address}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500">Deployed Optical Equipment</span>
                <strong className="text-slate-900 block text-sm">{installationReceipt.item_name}</strong>
                <span className="text-[11px] font-mono text-purple-900 font-bold block mt-1">
                  SN: {installationReceipt.serial_number}
                </span>
                <span className="text-[10px] text-emerald-700 font-bold block">Permanent Subscriber Allocation</span>
              </div>
            </div>

            {/* Configured Wi-Fi Credentials Box */}
            <div className="p-4 rounded-xl bg-slate-900 text-white space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-purple-300">
                  Configured Wireless Credentials
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`Wi-Fi: ${installationReceipt.wifi_ssid} | Key: ${wifiForm.wifiPassword}`);
                    setCopiedKey(true);
                    setTimeout(() => setCopiedKey(false), 2000);
                  }}
                  className="text-[10px] font-bold text-emerald-400 hover:underline flex items-center gap-1"
                >
                  {copiedKey ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey ? 'Copied' : 'Copy Credentials'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-[10px] text-slate-400 block">Network Name (SSID)</span>
                  <strong className="font-mono text-sm text-emerald-400">{installationReceipt.wifi_ssid}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">WPA2 Security Password</span>
                  <strong className="font-mono text-sm text-yellow-300">{wifiForm.wifiPassword}</strong>
                </div>
              </div>
            </div>

            {/* Optical Signal & Quality Stamp */}
            <div className="border-t border-slate-200 pt-4 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <span className="font-bold text-slate-800 block">
                    Optical Power: {installationReceipt.optical_rx_power_dbm} dBm
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Verified By: {installationReceipt.technician_name} (Field Technician)
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl border border-dashed border-slate-300 text-center min-w-[150px]">
                <span className="text-[9px] uppercase font-black tracking-wider text-slate-400 block">Digital Verification</span>
                <span className="font-mono text-[10px] font-black text-[#1c023d] block mt-0.5">TATA PLAY FIBER</span>
                <span className="text-[9px] text-emerald-600 font-bold block">ACTIVATED & SIGNED</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 text-xs">
              <button
                onClick={() => setInstallationReceipt(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2 rounded-xl bg-[#1c023d] hover:bg-[#2a085c] text-white font-black flex items-center gap-1.5 shadow-md transition"
              >
                <Printer className="w-4 h-4 text-[#e20d65]" />
                <span>Print Customer Slip</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Report Fault Modal */}
      <ReportFaultModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        defaultAsset={selectedAssetForFault}
        onFaultReported={fetchData}
      />

    </div>
  );
};
