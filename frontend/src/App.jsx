import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useWebSocket } from './hooks/useWebSocket';
import api from './api/client';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { Login } from './pages/Login';
import { AdminDashboard } from './pages/AdminDashboard';
import { ManagerDashboard } from './pages/ManagerDashboard';
import { CentralWarehouseStockPage } from './pages/CentralWarehouseStockPage';
import { RequestsSection } from './pages/RequestsSection';
import { UserManagementSection } from './pages/UserManagementSection';
import { AuditLogSection } from './pages/AuditLogSection';
import { VendorPerformanceSection } from './pages/VendorPerformanceSection';
import { ShipmentTrackingSection } from './pages/ShipmentTrackingSection';
import { AnalyticsSection } from './pages/AnalyticsSection';
import { AlertTelemetrySection } from './pages/AlertTelemetrySection';
import { CreateProductPage } from './pages/CreateProductPage';
import { StockRefillStoreSection } from './pages/StockRefillStoreSection';
import { AssetLifecyclePage } from './pages/AssetLifecyclePage';
import { RepairManagementPage } from './pages/RepairManagementPage';
import { AssetTransferPage } from './pages/AssetTransferPage';
import { OffboardingPage } from './pages/OffboardingPage';
import { BulkUploadPage } from './pages/BulkUploadPage';
import { RegionalStockMatrixSection } from './pages/RegionalStockMatrixSection';
import { FieldWorkerDeskPage } from './pages/FieldWorkerDeskPage';
import { StockTransferPage } from './pages/StockTransferPage';
import { Warehouse, Activity, ArrowLeftRight } from 'lucide-react';
import { AICopilotAssistant } from './components/AICopilotAssistant';
import { LocationSelectorModal } from './components/LocationSelectorModal';
import { InteractiveTutorialTour } from './components/InteractiveTutorialTour';
import { OrderWorkflowModal } from './components/OrderWorkflowModal';
import { Toast } from './components/Toast';

const MainApp = () => {
  const { user, loading } = useAuth();
  const [lifecycleInitialSerial, setLifecycleInitialSerial] = useState('');
  const [toasts, setToasts] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [transferMode, setTransferMode] = useState('BULK_WAREHOUSE'); // 'BULK_WAREHOUSE' | 'SERIALIZED_ASSET'

  // Auto-launch tour for first-time visitors unless dismissed
  useEffect(() => {
    if (user) {
      const tourDismissed = localStorage.getItem('stocksentry_tour_dismissed');
      if (!tourDismissed) {
        const timer = setTimeout(() => {
          setIsTourOpen(true);
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [user]);

  const handleCloseTour = (dontShowAgain) => {
    setIsTourOpen(false);
    if (dontShowAgain) {
      localStorage.setItem('stocksentry_tour_dismissed', 'true');
    }
  };

  const handleStartTour = () => {
    setIsTourOpen(true);
  };

  // Modals
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [selectedVariantForReq, setSelectedVariantForReq] = useState(null);

  // App State Data
  const [items, setItems] = useState([]);
  const [stock, setStock] = useState([]);
  const [locations, setLocations] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [summary, setSummary] = useState(null);
  const [currentLocationId, setCurrentLocationId] = useState(user?.location_id || 1);

  // Receive stock form state
  const [receiveVariantId, setReceiveVariantId] = useState('');
  const [receiveQty, setReceiveQty] = useState(100);
  const [receiveSupplier, setReceiveSupplier] = useState('Syrotech Networking Systems');

  // Create request form state
  const [requestVariantId, setRequestVariantId] = useState('');
  const [requestQty, setRequestQty] = useState(50);

  useEffect(() => {
    if (user?.location_id) {
      setCurrentLocationId(user.location_id);
    }
  }, [user]);

  const fetchData = useCallback(async () => {
    try {
      const [itemRes, locRes, reqRes, stockRes, alertRes, sumRes] = await Promise.all([
        api.get('/inventory/items'),
        api.get('/inventory/locations'),
        api.get('/requests'),
        api.get('/inventory/stock'),
        api.get('/alerts'),
        api.get('/analytics/summary')
      ]);
      setItems(itemRes.data);
      setLocations(locRes.data);
      setRequests(reqRes.data);
      setStock(stockRes.data);
      setAlerts(alertRes.data);
      setSummary(sumRes.data);
    } catch (err) {
      console.error("Failed to fetch app data", err);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [fetchData, refreshTrigger, user]);

  const recentToastsRef = useRef(new Map());

  const addToast = useCallback((toast) => {
    const dedupeKey = toast.dedupeKey || toast.id || `${toast.type || ''}_${toast.title}_${toast.message}`;
    const now = Date.now();

    // Suppress duplicate toasts arriving within 3500ms
    if (recentToastsRef.current.has(dedupeKey)) {
      const lastTime = recentToastsRef.current.get(dedupeKey);
      if (now - lastTime < 3500) {
        return;
      }
    }
    recentToastsRef.current.set(dedupeKey, now);

    // Prune stale cache entries
    if (recentToastsRef.current.size > 50) {
      for (const [k, time] of recentToastsRef.current.entries()) {
        if (now - time > 10000) recentToastsRef.current.delete(k);
      }
    }

    const id = Date.now() + Math.random();
    setToasts((prev) => {
      if (prev.some(t => t.title === toast.title && t.message === toast.message)) {
        return prev;
      }
      return [...prev, { id, ...toast }];
    });

    setTimeout(() => {
      removeToast(id);
    }, 6000);
  }, []);

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // WebSocket message handler
  const handleWsMessage = useCallback((msg) => {
    setRefreshTrigger((prev) => prev + 1);

    if (msg.type === 'LOW_STOCK_ALERT') {
      addToast({
        dedupeKey: `low_stock_${msg.payload.variant_id}`,
        type: 'LOW_STOCK',
        title: `⚡ CENTRAL LOW STOCK ALERT!`,
        message: `${msg.payload.item_name} (${msg.payload.variant_name}) is down to ${msg.payload.current_quantity} (Threshold: ${msg.payload.reorder_threshold})`
      });
    } else if (msg.type === 'ORDER_CREATED') {
      const isSelf = msg.payload.requester_id && user?.user_id && msg.payload.requester_id === user.user_id;
      addToast({
        dedupeKey: `order_${msg.payload.request_id || msg.payload.order_id}`,
        type: 'INFO',
        title: isSelf ? `📦 Stock Request Created!` : `📦 New City Stock Request Submitted!`,
        message: isSelf
          ? `PO Request #${msg.payload.request_id} for ${msg.payload.quantity_requested}x ${msg.payload.item_name} is now PENDING approval.`
          : `Request #${msg.payload.request_id} for ${msg.payload.quantity_requested}x ${msg.payload.item_name} submitted by ${msg.payload.location_name}.`
      });
    } else if (msg.type === 'ORDER_APPROVED') {
      addToast({
        dedupeKey: `order_appr_${msg.payload.request_id}`,
        type: 'SUCCESS',
        title: `✅ City Request Approved!`,
        message: `Request #${msg.payload.request_id} for ${msg.payload.location_name} has been approved.`
      });
    } else if (msg.type === 'ORDER_DISPATCHED') {
      addToast({
        dedupeKey: `order_disp_${msg.payload.request_id}`,
        type: 'INFO',
        title: `🚚 Stock Dispatched In-Transit!`,
        message: `Request #${msg.payload.request_id} dispatched via ${msg.payload.carrier_name} (Tracking: ${msg.payload.tracking_number}).`
      });
    } else if (msg.type === 'ORDER_FULFILLED') {
      addToast({
        dedupeKey: `order_fulf_${msg.payload.request_id}`,
        type: 'SUCCESS',
        title: `📦 Delivery Confirmed!`,
        message: `Delivery receipt confirmed for Request #${msg.payload.request_id}.`
      });
    } else if (msg.type === 'ALERT_RESOLVED') {
      addToast({
        dedupeKey: `alert_res_${msg.payload.variant_id}`,
        type: 'INFO',
        title: `✨ Low Stock Resolved`,
        message: `Central stock level for ${msg.payload.item_name} (${msg.payload.variant_name}) is now healthy.`
      });
    }
  }, [addToast, user]);

  const { isConnected } = useWebSocket(handleWsMessage);

  const handleApproveRequest = async (id) => {
    try {
      await api.put(`/requests/${id}/approve`);
      setRefreshTrigger(p => p + 1);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectRequest = async (id) => {
    try {
      await api.put(`/requests/${id}/reject`);
      setRefreshTrigger(p => p + 1);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDispatchRequest = async (id, payload) => {
    try {
      await api.put(`/requests/${id}/dispatch`, payload);
      setRefreshTrigger(p => p + 1);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to dispatch request");
    }
  };

  const handleConfirmDelivery = async (id) => {
    try {
      await api.put(`/requests/${id}/confirm-delivery`);
      setRefreshTrigger(p => p + 1);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to confirm delivery");
    }
  };

  const handleUpdateAlertStatus = async (alertId, status) => {
    try {
      await api.put(`/alerts/${alertId}/status`, { status });
      setRefreshTrigger(p => p + 1);
    } catch (err) {
      console.error(err);
    }
  };

  const handleReceiveStockSubmit = async (e) => {
    e.preventDefault();
    if (!receiveVariantId || receiveQty <= 0) return;
    try {
      await api.post('/inventory/receive', {
        variant_id: parseInt(receiveVariantId),
        quantity_received: parseInt(receiveQty),
        supplier_name: receiveSupplier
      });
      setIsReceiveModalOpen(false);
      setRefreshTrigger(p => p + 1);
      addToast({
        type: 'SUCCESS',
        title: 'Vendor Stock Received',
        message: `+${receiveQty} units added to Central Warehouse stock.`
      });
    } catch (err) {
      alert("Failed to receive vendor stock.");
    }
  };

  const handleRequestStockModalSubmit = async (payload) => {
    try {
      const res = await api.post('/requests', {
        variant_id: parseInt(payload.variant_id),
        quantity_requested: parseInt(payload.quantity_requested),
        location_id: payload.location_id
      });
      setRefreshTrigger(p => p + 1);
      return res.data;
    } catch (err) {
      throw err;
    }
  };

  const handleRequestStockSubmit = async (e) => {
    e.preventDefault();
    if (!requestVariantId || requestQty <= 0) return;
    try {
      await api.post('/requests', {
        variant_id: parseInt(requestVariantId),
        quantity_requested: parseInt(requestQty)
      });
      setIsRequestModalOpen(false);
      setRefreshTrigger(p => p + 1);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to submit request.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1c023d] text-white flex items-center justify-center font-sans">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#e20d65] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-extrabold text-slate-200">Loading Tata Play Fiber StockSentry ERP...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const isCentralAdmin = user.role === 'CENTRAL_ADMIN' || user.role === 'SUPER_ADMIN';
  const isSuperAdmin = user.role === 'SUPER_ADMIN' || user.role === 'CENTRAL_ADMIN';
  const pendingRequestsCount = requests.filter(r => r.status === 'PENDING').length;
  const openAlertsCount = alerts.filter(a => a.status === 'OPEN').length;

  const isStockGroup = ['central-stock', 'available-stock', 'regional-stock'].includes(activeTab);
  const isTransfersGroup = ['requests', 'my-requests', 'tracking', 'transfers', 'receive-stock'].includes(activeTab);
  const isLifecycleGroup = ['lifecycle', 'repairs', 'offboarding', 'create-product'].includes(activeTab);
  const isGovernanceGroup = ['users-mgmt', 'bulk-upload', 'alerts', 'analytics', 'audit-logs', 'vendors'].includes(activeTab);

  const allVariants = [];
  items?.forEach(item => {
    item.variants?.forEach(v => {
      allVariants.push({
        variant_id: v.variant_id,
        name: `${item.name} - ${v.variant_name}`,
        unit_cost: v.unit_cost
      });
    });
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans flex flex-col">
      
      {/* Fixed Top Bar */}
      <Navbar
        isWsConnected={isConnected}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        locations={locations}
        currentLocationId={currentLocationId}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        alerts={alerts}
        requests={requests}
        stock={stock}
        onRequestReceive={() => setIsReceiveModalOpen(true)}
        onStartTour={handleStartTour}
      />

      {/* Main Container below Top Bar */}
      <div className="pt-16 flex-1 flex">
        
        {/* Fixed Left Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          pendingRequestsCount={pendingRequestsCount}
          openAlertsCount={openAlertsCount}
          userRole={user.role}
          locationName={locations.find(l => l.location_id === currentLocationId)?.city || 'City'}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
        />

        {/* Dynamic Main Body Content */}
        <main className={`flex-1 transition-all duration-200 ${isSidebarCollapsed ? 'pl-0 md:pl-16' : 'pl-0 md:pl-64'} px-6 md:px-10 py-6 md:py-8 pb-28 w-full overflow-y-auto`}>

          {/* Sub Navigation Bar for Stock & Regional Matrix */}
          {isStockGroup && (
            <div className="bg-white border border-slate-200 p-2 shadow-xs mb-6 flex flex-wrap items-center gap-1.5 text-xs font-bold">
              <button
                onClick={() => setActiveTab(isSuperAdmin ? 'central-stock' : 'available-stock')}
                className={`px-3.5 py-1.5 border transition ${['central-stock', 'available-stock'].includes(activeTab) ? 'bg-[#1c023d] text-white border-[#1c023d]' : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'}`}
              >
                Central Warehouse Stock
              </button>
              <button
                onClick={() => setActiveTab('regional-stock')}
                className={`px-3.5 py-1.5 border transition ${activeTab === 'regional-stock' ? 'bg-[#1c023d] text-white border-[#1c023d]' : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'}`}
              >
                Regional Stock Matrix (Regions Folding into Cities)
              </button>
            </div>
          )}

          {/* Sub Navigation Bar for Transfers & Logistics */}
          {isTransfersGroup && isSuperAdmin && (
            <div className="bg-white border border-slate-200 p-2 shadow-xs mb-6 flex flex-wrap items-center gap-1.5 text-xs font-bold">
              <button
                onClick={() => setActiveTab('requests')}
                className={`px-3.5 py-1.5 border transition ${activeTab === 'requests' ? 'bg-[#1c023d] text-white border-[#1c023d]' : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'}`}
              >
                Global Requests Queue {pendingRequestsCount > 0 && <span className="ml-1.5 px-1.5 py-0.2 bg-[#e20d65] text-white text-[10px] font-mono">{pendingRequestsCount}</span>}
              </button>
              <button
                onClick={() => setActiveTab('tracking')}
                className={`px-3.5 py-1.5 border transition ${activeTab === 'tracking' ? 'bg-[#1c023d] text-white border-[#1c023d]' : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'}`}
              >
                Dispatch In-Transit Tracking
              </button>
              <button
                onClick={() => setActiveTab('transfers')}
                className={`px-3.5 py-1.5 border transition ${activeTab === 'transfers' ? 'bg-[#1c023d] text-white border-[#1c023d]' : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'}`}
              >
                Direct Asset Transfers
              </button>
              <button
                onClick={() => setActiveTab('receive-stock')}
                className={`px-3.5 py-1.5 border transition ${activeTab === 'receive-stock' ? 'bg-[#1c023d] text-white border-[#1c023d]' : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'}`}
              >
                Receive Vendor Stock
              </button>
            </div>
          )}

          {/* Sub Navigation Bar for Asset Operations */}
          {isLifecycleGroup && isSuperAdmin && (
            <div className="bg-white border border-slate-200 p-2 shadow-xs mb-6 flex flex-wrap items-center gap-1.5 text-xs font-bold">
              <button
                onClick={() => setActiveTab('lifecycle')}
                className={`px-3.5 py-1.5 border transition ${activeTab === 'lifecycle' ? 'bg-[#1c023d] text-white border-[#1c023d]' : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'}`}
              >
                Serial Lifecycle Audit
              </button>
              <button
                onClick={() => setActiveTab('repairs')}
                className={`px-3.5 py-1.5 border transition ${activeTab === 'repairs' ? 'bg-[#1c023d] text-white border-[#1c023d]' : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'}`}
              >
                Repair & Scrap Governance
              </button>
              <button
                onClick={() => setActiveTab('offboarding')}
                className={`px-3.5 py-1.5 border transition ${activeTab === 'offboarding' ? 'bg-[#1c023d] text-white border-[#1c023d]' : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'}`}
              >
                Staff Onboarding & NOC
              </button>
              <button
                onClick={() => setActiveTab('create-product')}
                className={`px-3.5 py-1.5 border transition ${activeTab === 'create-product' ? 'bg-[#1c023d] text-white border-[#1c023d]' : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'}`}
              >
                + Add Catalog Product
              </button>
            </div>
          )}

          {/* Sub Navigation Bar for Directory & Governance */}
          {isGovernanceGroup && isSuperAdmin && (
            <div className="bg-white border border-slate-200 p-2 shadow-xs mb-6 flex flex-wrap items-center gap-1.5 text-xs font-bold">
              <button
                onClick={() => setActiveTab('users-mgmt')}
                className={`px-3.5 py-1.5 border transition ${activeTab === 'users-mgmt' ? 'bg-[#1c023d] text-white border-[#1c023d]' : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'}`}
              >
                User & Hub Directory
              </button>
              <button
                onClick={() => setActiveTab('bulk-upload')}
                className={`px-3.5 py-1.5 border transition ${activeTab === 'bulk-upload' ? 'bg-[#1c023d] text-white border-[#1c023d]' : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'}`}
              >
                Excel Bulk Onboarding
              </button>
              <button
                onClick={() => setActiveTab('alerts')}
                className={`px-3.5 py-1.5 border transition ${activeTab === 'alerts' ? 'bg-[#1c023d] text-white border-[#1c023d]' : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'}`}
              >
                Alert Telemetry {openAlertsCount > 0 && <span className="ml-1.5 px-1.5 py-0.2 bg-rose-600 text-white text-[10px] font-mono">{openAlertsCount}</span>}
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`px-3.5 py-1.5 border transition ${activeTab === 'analytics' ? 'bg-[#1c023d] text-white border-[#1c023d]' : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'}`}
              >
                Predictive Analytics
              </button>
              <button
                onClick={() => setActiveTab('audit-logs')}
                className={`px-3.5 py-1.5 border transition ${activeTab === 'audit-logs' ? 'bg-[#1c023d] text-white border-[#1c023d]' : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'}`}
              >
                System Audit Logs
              </button>
            </div>
          )}

          {activeTab === 'dashboard' && (
            isCentralAdmin ? (
              <AdminDashboard
                refreshTrigger={refreshTrigger}
                setActiveTab={setActiveTab}
              />
            ) : user?.role === 'FIELD_WORKER' ? (
              <FieldWorkerDeskPage
                defaultSubTab="jobs"
                onNavigateToLifecycle={(sn) => {
                  setLifecycleInitialSerial(sn);
                  setActiveTab('lifecycle');
                }}
              />
            ) : (
              <ManagerDashboard
                user={user}
                onRequestOrder={() => setIsRequestModalOpen(true)}
                refreshTrigger={refreshTrigger}
                setActiveTab={setActiveTab}
              />
            )
          )}

          {(activeTab === 'central-stock' || activeTab === 'available-stock') && (
            <CentralWarehouseStockPage
              stock={stock}
              onRequestReceive={() => setIsReceiveModalOpen(true)}
              isCentralAdmin={isCentralAdmin}
              onNavigateToLifecycle={(sn) => {
                setLifecycleInitialSerial(sn);
                setActiveTab('lifecycle');
              }}
              onNavigateToTransfers={() => {
                setTransferMode('BULK_WAREHOUSE');
                setActiveTab('transfers');
              }}
            />
          )}

          {activeTab === 'regional-stock' && (
            <RegionalStockMatrixSection
              userRole={user.role}
              onRequestReceive={() => setIsReceiveModalOpen(true)}
              onNavigateToTransfers={() => {
                setTransferMode('BULK_WAREHOUSE');
                setActiveTab('transfers');
              }}
            />
          )}

          {activeTab === 'lifecycle' && (
            <AssetLifecyclePage
              initialSerialNumber={lifecycleInitialSerial}
              userRole={user.role}
            />
          )}

          {activeTab === 'repairs' && (
            <RepairManagementPage
              userRole={user.role}
            />
          )}

          {activeTab === 'transfers' && (
            <div className="space-y-4">
              {/* Transfer Console Segmented Switcher */}
              <div className="bg-white p-2 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTransferMode('BULK_WAREHOUSE')}
                    className={`px-4 py-2 text-xs font-black uppercase tracking-wider transition flex items-center gap-2 ${
                      transferMode === 'BULK_WAREHOUSE'
                        ? 'bg-[#1c023d] text-white shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    <Warehouse className="w-3.5 h-3.5 text-[#e20d65]" />
                    <span>Bulk Warehouse Transfer (Central ↔ Regional Hubs)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransferMode('SERIALIZED_ASSET')}
                    className={`px-4 py-2 text-xs font-black uppercase tracking-wider transition flex items-center gap-2 ${
                      transferMode === 'SERIALIZED_ASSET'
                        ? 'bg-[#1c023d] text-white shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Serialized Hardware Transfer (Technicians & Cities)</span>
                  </button>
                </div>
                <span className="text-[11px] font-mono text-slate-400 font-bold px-2">
                  {transferMode === 'BULK_WAREHOUSE' ? 'Inter-Hub SKU Rebalancing' : 'Custody Chain Reassignment'}
                </span>
              </div>

              {transferMode === 'BULK_WAREHOUSE' ? (
                <StockTransferPage
                  locations={locations}
                  items={items}
                  onTransferSubmit={() => setRefreshTrigger(prev => prev + 1)}
                  refreshTrigger={refreshTrigger}
                />
              ) : (
                <AssetTransferPage
                  userRole={user.role}
                />
              )}
            </div>
          )}

          {activeTab === 'offboarding' && (
            <OffboardingPage
              userRole={user.role}
              locations={locations}
              onNavigateToBulk={() => setActiveTab('bulk-upload')}
            />
          )}

          {activeTab === 'bulk-upload' && (
            <BulkUploadPage
              userRole={user.role}
            />
          )}

          {['my-assets', 'my-complaints', 'field-desk', 'wifi-setup', 'field-guide'].includes(activeTab) && (
            <FieldWorkerDeskPage
              defaultSubTab={
                activeTab === 'my-complaints' ? 'complaints' :
                activeTab === 'wifi-setup' ? 'wifi-setup' :
                activeTab === 'field-guide' ? 'guide' :
                activeTab === 'my-assets' ? 'assets' : 'jobs'
              }
              onNavigateToLifecycle={(sn) => {
                setLifecycleInitialSerial(sn);
                setActiveTab('lifecycle');
              }}
            />
          )}

          {(activeTab === 'requests' || activeTab === 'my-requests') && (
            <RequestsSection
              requests={requests}
              onRequestSubmit={() => setIsRequestModalOpen(true)}
              onApprove={handleApproveRequest}
              onReject={handleRejectRequest}
              onDispatch={handleDispatchRequest}
              onConfirmDelivery={handleConfirmDelivery}
              isCentralAdmin={isCentralAdmin}
            />
          )}

          {activeTab === 'receive-stock' && (
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm max-w-xl mx-auto space-y-4">
              <h2 className="text-xl font-black text-[#1c023d]">Receive Vendor Stock Shipment</h2>
              <p className="text-xs text-slate-500">Record incoming vendor inventory restock into Central Warehouse.</p>

              <form onSubmit={handleReceiveStockSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-extrabold mb-1">Select Product SKU Variant</label>
                  <select
                    value={receiveVariantId}
                    onChange={(e) => setReceiveVariantId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded bg-slate-50 border border-slate-300 font-semibold"
                    required
                  >
                    <option value="">-- Choose Item Variant --</option>
                    {allVariants.map(v => (
                      <option key={v.variant_id} value={v.variant_id}>{v.name} (Cost: ₹{v.unit_cost})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-extrabold mb-1">Quantity Received</label>
                  <input
                    type="number"
                    min="1"
                    value={receiveQty}
                    onChange={(e) => setReceiveQty(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded bg-slate-50 border border-slate-300 font-mono font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-extrabold mb-1">Equipment Supplier</label>
                  <input
                    type="text"
                    value={receiveSupplier}
                    onChange={(e) => setReceiveSupplier(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded bg-slate-50 border border-slate-300 font-semibold"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded bg-[#e20d65] hover:bg-[#cc0059] text-white font-extrabold shadow-sm transition"
                >
                  Receive Stock into Central Warehouse
                </button>
              </form>
            </div>
          )}

          {(activeTab === 'request-form' || activeTab === 'store') && (
            user?.role === 'FIELD_WORKER' ? (
              <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center max-w-xl mx-auto space-y-4">
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-[#6700ce] flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-black text-[#1c023d]">Procurement & Ordering Restricted</h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Field Technicians handle on-site subscriber installation, fiber splicing, and Wi-Fi activation. Commercial stock procurement and warehouse refill orders are managed exclusively by City Hub Managers and Central Logistics.
                </p>
                <button
                  onClick={() => setActiveTab('field-desk')}
                  className="px-5 py-2.5 rounded-xl bg-[#1c023d] text-white font-extrabold text-xs transition"
                >
                  Return to Field Operations Desk
                </button>
              </div>
            ) : (
              <StockRefillStoreSection
                items={items}
                locations={locations}
                stock={stock}
                currentRole={user?.role}
                userLocationId={currentLocationId}
                onRequestOrder={fetchData}
                onNavigateToRequests={() => setActiveTab('requests')}
                onOpenProductModal={(p) => setSelectedProductDetail(p)}
              />
            )
          )}

          {activeTab === 'tracking' && (
            <ShipmentTrackingSection
              orders={requests}
              isCentralAdmin={isCentralAdmin}
              userLocationId={currentLocationId}
              onFulfillOrder={handleConfirmDelivery}
              onDispatchOrder={handleDispatchRequest}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsSection
              summary={summary}
              stock={stock}
            />
          )}

          {activeTab === 'users-mgmt' && (
            <UserManagementSection locations={locations} />
          )}

          {activeTab === 'audit-logs' && (
            <AuditLogSection />
          )}

          {activeTab === 'vendors' && (
            <VendorPerformanceSection />
          )}

          {activeTab === 'create-product' && (
            <CreateProductPage
              setActiveTab={setActiveTab}
              onProductCreated={() => setRefreshTrigger(p => p + 1)}
            />
          )}

          {activeTab === 'alerts' && (
            <AlertTelemetrySection
              alerts={alerts}
              onUpdateStatus={handleUpdateAlertStatus}
            />
          )}

        </main>
      </div>

      {/* Floating AI Copilot Widget on all pages (Single Entry Point) */}
      <AICopilotAssistant isFullPage={false} setActiveTab={setActiveTab} />

      {/* Interactive Step-by-Step Guided Product Tour */}
      <InteractiveTutorialTour
        isOpen={isTourOpen}
        onClose={handleCloseTour}
        setActiveTab={setActiveTab}
        activeTab={activeTab}
        userRole={user.role}
      />

      {/* Production Procurement Order Workflow Modal */}
      <OrderWorkflowModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        onSubmit={handleRequestStockModalSubmit}
        initialVariantId={selectedVariantForReq?.variant_id}
        items={items}
        locations={locations}
        stock={stock}
        currentRole={user?.role}
        currentLocationId={currentLocationId}
        onNavigateToTracking={() => setActiveTab('tracking')}
      />

      {/* Toast Notifications */}
      <Toast toasts={toasts} removeToast={removeToast} />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
