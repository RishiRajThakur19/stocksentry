import React, { useState, useRef, useEffect } from 'react';
import { 
  Building2, 
  MapPin, 
  Search, 
  BellRing, 
  ChevronDown, 
  LogOut, 
  PlusCircle, 
  Radio,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  User,
  ShieldCheck,
  Mail,
  Settings,
  Menu,
  X,
  Compass,
  Sparkles,
  HelpCircle,
  Sliders
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NotificationSettingsModal } from './NotificationSettingsModal';
import { NotificationCenterPopover } from './NotificationCenterPopover';
import { WorkflowGuideModal } from './WorkflowGuideModal';

export const Navbar = ({
  isWsConnected,
  activeTab,
  setActiveTab,
  onOpenLocationModal,
  locations = [],
  currentLocationId,
  searchQuery,
  setSearchQuery,
  onRequestOrder,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  alerts = [],
  requests = [],
  stock = [],
  onRequestReceive,
  onStartTour
}) => {
  const { user, logout } = useAuth();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationPopoverOpen, setIsNotificationPopoverOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const profileMenuRef = useRef(null);

  const currentLocation = locations.find(l => l.location_id === currentLocationId);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'CENTRAL_ADMIN';
  const isRegionalAdmin = user?.role === 'REGIONAL_ADMIN';
  const isManager = user?.role === 'MANAGER' || user?.role === 'LOCATION_MANAGER';
  const isFieldWorker = user?.role === 'FIELD_WORKER';

  const roleLabel = isSuperAdmin ? 'Super Admin' : isRegionalAdmin ? `Regional Admin` : isManager ? `City Manager` : 'Field Worker';
  const territoryLabel = isSuperAdmin ? 'Central Warehouse (National)' : isRegionalAdmin ? (user?.region_name || 'Assigned Region') : (currentLocation?.name || user?.location_name || 'City Hub');

  // Compute live action items count
  const lowStockCount = stock.filter(s => s.is_low_stock).length;
  const pendingRequestsCount = requests.filter(r => r.status === 'PENDING').length;
  const totalActionCount = lowStockCount + pendingRequestsCount + 1; // +1 for live repair ticket

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 h-16 bg-[#1c023d] text-white z-50 flex items-center justify-between px-4 md:px-6 font-sans shadow-sm border-b border-purple-900/60">
        
        {/* Left Brand Header with Hamburger Toggle for Mobile */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1.5 text-white hover:bg-purple-900/60 transition md:hidden flex items-center justify-center"
            title="Toggle Navigation Menu"
          >
            {isSidebarCollapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5 text-[#e20d65]" />}
          </button>

          <div className="flex items-center gap-2" data-tour="brand-logo">
            <span className="text-lg md:text-xl font-black tracking-tight text-white flex items-center gap-1.5 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
              <span className="text-[#e20d65]">Tata Play</span> Fiber
            </span>
            <span className="text-[9px] font-bold px-2 py-0.5 bg-purple-900/80 text-purple-200 border border-purple-700/60 uppercase tracking-wider hidden sm:inline-block">
              Multi-Region
            </span>
          </div>
        </div>

        {/* Center Search Bar & Location Badge */}
        <div className="hidden md:flex items-center gap-2.5 flex-1 max-w-lg mx-6 relative" data-tour="search-bar">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-purple-300/70 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search SKUs, serials, requests, hubs..."
              className="w-full bg-[#2c095c] text-white placeholder-purple-300/50 pl-9 pr-3.5 py-1.5 text-xs border border-purple-800/60 focus:outline-none focus:border-[#e20d65] focus:ring-1 focus:ring-[#e20d65] transition font-medium"
            />
          </div>

          {/* Active Territory Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2c095c] border border-purple-800/60 text-xs font-semibold text-purple-200 shrink-0" data-tour="territory-badge">
            <MapPin className="w-3.5 h-3.5 text-[#e20d65]" />
            <span>{territoryLabel}</span>
          </div>
        </div>

        {/* Right User Profile Avatar & Notification Center */}
        <div className="flex items-center gap-2 md:gap-3">
          
          {/* Live Telemetry Status */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-purple-950/70 border border-purple-800/50 text-xs font-mono" data-tour="telemetry-status">
            <span className={`w-2 h-2 rounded-full ${isWsConnected ? 'bg-emerald-400 ring-2 ring-emerald-400/30' : 'bg-amber-400'}`} />
            <span className="text-purple-200 font-semibold">{isWsConnected ? 'Central Live' : 'Connecting'}</span>
          </div>

          {/* Interactive Guided Tour Button */}
          {onStartTour && (
            <button
              onClick={onStartTour}
              data-tour="tour-btn"
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#e20d65]/25 to-purple-600/25 hover:from-[#e20d65] hover:to-purple-600 text-pink-200 hover:text-white text-xs font-bold border border-[#e20d65]/40 hover:border-transparent transition-all shadow-xs hover:shadow-pink-500/25"
              title="Launch Interactive Step-by-Step Tour"
            >
              <Sparkles className="w-3.5 h-3.5 text-pink-400" />
              <span>Tour</span>
            </button>
          )}

          {/* Operations & Workflow Guide Button */}
          <button
            onClick={() => setIsGuideOpen(true)}
            data-tour="ops-guide-btn"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-purple-900/70 hover:bg-purple-800 text-purple-200 hover:text-white text-xs font-bold border border-purple-700/60 transition shadow-xs"
            title="Open StockSentry Operations & Architecture Guide"
          >
            <Compass className="w-3.5 h-3.5 text-[#e20d65]" />
            <span>Ops Guide</span>
          </button>

          {/* Real-Time Notification Center Trigger */}
          <button
            onClick={() => setIsNotificationPopoverOpen(!isNotificationPopoverOpen)}
            data-tour="notification-bell"
            className="p-2 hover:bg-purple-900/60 text-purple-200 hover:text-white transition relative"
            title={`${totalActionCount} Active Operational Notifications`}
          >
            <BellRing className="w-4 h-4" />
            {totalActionCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-[#e20d65] text-white text-[10px] font-mono font-black flex items-center justify-center border border-[#1c023d] shadow-xs">
                {totalActionCount}
              </span>
            )}
          </button>

          {/* User Profile Avatar with Dropdown */}
          <div className="relative" ref={profileMenuRef}>
            <button
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              data-tour="user-profile"
              className="flex items-center gap-2 p-1 hover:bg-purple-900/50 transition border border-transparent hover:border-purple-700/50"
            >
              <div className={`w-7 h-7 text-white flex items-center justify-center font-bold text-xs shadow-xs ${
                isSuperAdmin ? 'bg-[#e20d65]' : isRegionalAdmin ? 'bg-indigo-600' : isManager ? 'bg-[#6700ce]' : 'bg-emerald-600'
              }`}>
                {user?.name ? user.name[0].toUpperCase() : 'U'}
              </div>

              <div className="text-left hidden lg:block">
                <p className="text-xs font-bold text-white leading-tight">{user?.name || 'User'}</p>
                <p className="text-[10px] text-purple-300 font-mono">{roleLabel}</p>
              </div>

              <ChevronDown className="w-3.5 h-3.5 text-purple-300" />
            </button>

            {/* Profile Dropdown Menu */}
            {isProfileMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white text-slate-900 shadow-2xl border border-slate-200 p-2.5 space-y-2.5 z-50 text-xs font-sans">
                <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100">
                  <div className="w-8 h-8 bg-[#1c023d] text-white flex items-center justify-center font-bold text-xs">
                    {user?.name ? user.name[0].toUpperCase() : 'U'}
                  </div>
                  <div className="truncate">
                    <p className="font-bold text-[#1c023d] text-xs truncate">{user?.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono truncate">{user?.email}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  {onStartTour && (
                    <button
                      onClick={() => { setIsProfileMenuOpen(false); onStartTour(); }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-pink-50 text-[#e20d65] font-bold transition text-left border border-pink-100"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#e20d65]" />
                      <span>Take Interactive Tour</span>
                    </button>
                  )}

                  <button
                    onClick={() => { setIsProfileMenuOpen(false); setIsGuideOpen(true); }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-slate-100 text-slate-700 font-medium transition text-left"
                  >
                    <Compass className="w-3.5 h-3.5 text-[#e20d65]" />
                    <span>Operations Handbook</span>
                  </button>

                  <button
                    onClick={() => { setIsProfileMenuOpen(false); setIsNotificationPopoverOpen(true); }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-slate-100 text-slate-700 font-medium transition text-left"
                  >
                    <BellRing className="w-3.5 h-3.5 text-purple-600" />
                    <span>Notification Center ({totalActionCount})</span>
                  </button>

                  <button
                    onClick={() => { setIsProfileMenuOpen(false); setIsSettingsModalOpen(true); }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-slate-100 text-slate-700 font-medium transition text-left"
                  >
                    <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                    <span>SMS / Email Relay Settings</span>
                  </button>

                  <button
                    onClick={() => { setIsProfileMenuOpen(false); setActiveTab('dashboard'); }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-slate-100 text-slate-700 font-medium transition text-left"
                  >
                    <User className="w-3.5 h-3.5 text-slate-600" />
                    <span>My Dashboard</span>
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 font-bold transition text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

      </header>

      {/* Real-time Notifications Popover */}
      <NotificationCenterPopover 
        isOpen={isNotificationPopoverOpen}
        onClose={() => setIsNotificationPopoverOpen(false)}
        alerts={alerts}
        requests={requests}
        stock={stock}
        setActiveTab={setActiveTab}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onRequestReceive={onRequestReceive}
      />

      {/* Comprehensive Operational Workflow Guide Modal */}
      <WorkflowGuideModal 
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        setActiveTab={setActiveTab}
        onStartTour={onStartTour}
      />

      {/* Notification Settings Modal (Email & SMS) */}
      <NotificationSettingsModal 
        isOpen={isSettingsModalOpen} 
        onClose={() => setIsSettingsModalOpen(false)} 
      />
    </>
  );
};
