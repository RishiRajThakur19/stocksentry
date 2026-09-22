import React from 'react';
import { 
  LayoutDashboard, 
  Warehouse, 
  FileCheck, 
  Truck, 
  BarChart3, 
  AlertTriangle, 
  Users, 
  FileText, 
  PackagePlus, 
  ShoppingBag, 
  LogOut, 
  ChevronLeft, 
  ChevronRight, 
  PlusSquare,
  Building2,
  ShieldCheck,
  Activity,
  Wrench,
  ArrowLeftRight,
  UserMinus,
  FileSpreadsheet,
  Layers,
  Sparkles,
  CheckSquare,
  Wifi,
  BookOpen
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Sidebar = ({ 
  activeTab, 
  setActiveTab, 
  pendingRequestsCount = 0, 
  openAlertsCount = 0,
  userRole = 'MANAGER',
  locationName = '',
  regionName = '',
  isCollapsed,
  setIsCollapsed
}) => {
  const { logout, user } = useAuth();
  const effectiveRole = user?.role || userRole;
  const isSuperAdmin = effectiveRole === 'SUPER_ADMIN' || effectiveRole === 'CENTRAL_ADMIN';
  const isRegionalAdmin = effectiveRole === 'REGIONAL_ADMIN';
  const isManager = effectiveRole === 'MANAGER' || effectiveRole === 'LOCATION_MANAGER';
  const isFieldWorker = effectiveRole === 'FIELD_WORKER';

  // Primary navigation hubs (simplified, non-complex, crystal-clear)
  let primaryNav = [];

  if (isSuperAdmin) {
    primaryNav = [
      {
        id: 'dashboard',
        label: 'Executive Dashboard',
        icon: LayoutDashboard,
        subItems: []
      },
      {
        id: 'central-stock',
        label: 'Stock & Regional Matrix',
        icon: Warehouse,
        subItems: [
          { id: 'central-stock', label: 'Central Warehouse Stock' },
          { id: 'regional-stock', label: 'Regional Matrix (Fold/Unfold)' }
        ]
      },
      {
        id: 'requests',
        label: 'Transfers & Logistics',
        icon: ArrowLeftRight,
        badge: pendingRequestsCount > 0 ? pendingRequestsCount : null,
        badgeColor: 'bg-[#e20d65] text-white',
        subItems: [
          { id: 'requests', label: 'Global Requests Queue' },
          { id: 'tracking', label: 'In-Transit Dispatch Tracking' },
          { id: 'transfers', label: 'Direct Asset Transfers' },
          { id: 'receive-stock', label: 'Receive Vendor Stock' }
        ]
      },
      {
        id: 'lifecycle',
        label: 'Asset Operations',
        icon: Activity,
        subItems: [
          { id: 'lifecycle', label: 'Serial Lifecycle Audit' },
          { id: 'repairs', label: 'Repair & Scrap Governance' },
          { id: 'offboarding', label: 'Staff Onboarding & NOC' },
          { id: 'create-product', label: 'Catalog / Add Product' }
        ]
      },
      {
        id: 'users-mgmt',
        label: 'Directory & Governance',
        icon: ShieldCheck,
        badge: openAlertsCount > 0 ? openAlertsCount : null,
        badgeColor: 'bg-rose-600 text-white',
        subItems: [
          { id: 'users-mgmt', label: 'User & Hub Directory' },
          { id: 'bulk-upload', label: 'Excel Bulk Onboarding' },
          { id: 'alerts', label: 'Alert Telemetry' },
          { id: 'analytics', label: 'Predictive Analytics' },
          { id: 'audit-logs', label: 'System Audit Logs' }
        ]
      }
    ];
  } else if (isRegionalAdmin) {
    primaryNav = [
      {
        id: 'dashboard',
        label: 'Regional Dashboard',
        icon: LayoutDashboard,
        subItems: []
      },
      {
        id: 'requests',
        label: 'Stock Approval Queue',
        icon: FileCheck,
        badge: pendingRequestsCount > 0 ? pendingRequestsCount : null,
        badgeColor: 'bg-[#e20d65] text-white',
        subItems: [
          { id: 'requests', label: 'Pending Approvals' },
          { id: 'tracking', label: 'Regional In-Transit' }
        ]
      },
      {
        id: 'central-stock',
        label: 'Stock & Regional Matrix',
        icon: Warehouse,
        subItems: [
          { id: 'central-stock', label: 'Central Available Stock' },
          { id: 'regional-stock', label: 'Regional Matrix (Fold/Unfold)' }
        ]
      },
      {
        id: 'repairs',
        label: 'Asset Lifecycle & Repairs',
        icon: Wrench,
        subItems: [
          { id: 'repairs', label: 'Repair & Scrap Approvals' },
          { id: 'lifecycle', label: 'Asset Lifecycle Audit' },
          { id: 'offboarding', label: 'Personnel Onboarding & NOC' }
        ]
      },
      {
        id: 'users-mgmt',
        label: 'City Hubs & Staff',
        icon: Users,
        badge: openAlertsCount > 0 ? openAlertsCount : null,
        badgeColor: 'bg-rose-600 text-white',
        subItems: [
          { id: 'users-mgmt', label: 'Regional Personnel' },
          { id: 'bulk-upload', label: 'Excel Bulk Onboarding' },
          { id: 'alerts', label: 'Regional Alerts' }
        ]
      }
    ];
  } else if (isManager) {
    primaryNav = [
      {
        id: 'dashboard',
        label: 'My Hub Dashboard',
        icon: LayoutDashboard,
        subItems: []
      },
      {
        id: 'request-form',
        label: 'Stock Refill Store',
        icon: ShoppingBag,
        subItems: []
      },
      {
        id: 'my-requests',
        label: 'City Requests & Tracking',
        icon: FileCheck,
        badge: pendingRequestsCount > 0 ? pendingRequestsCount : null,
        badgeColor: 'bg-[#e20d65] text-white',
        subItems: [
          { id: 'my-requests', label: 'My Hub Requests' },
          { id: 'tracking', label: 'In-Transit Deliveries' }
        ]
      },
      {
        id: 'available-stock',
        label: 'Stock & Regional Matrix',
        icon: Warehouse,
        subItems: [
          { id: 'available-stock', label: 'Central Available Stock' },
          { id: 'regional-stock', label: 'Regional Matrix (Fold/Unfold)' }
        ]
      },
      {
        id: 'lifecycle',
        label: 'Hub Assets & Staff',
        icon: Activity,
        subItems: [
          { id: 'lifecycle', label: 'Asset Lifecycle Audit' },
          { id: 'repairs', label: 'City Repairs & Faults' },
          { id: 'transfers', label: 'Direct Asset Transfers' },
          { id: 'users-mgmt', label: 'Field Technicians' },
          { id: 'offboarding', label: 'Tech Onboarding & NOC' }
        ]
      }
    ];
  } else {
    // Field Worker (Ground Installation & Break-Fix Engineer)
    primaryNav = [
      {
        id: 'field-desk',
        label: 'Daily Field Jobs & Tasks',
        icon: CheckSquare,
        subItems: []
      },
      {
        id: 'wifi-setup',
        label: 'Subscriber Wi-Fi & ONT Setup',
        icon: Wifi,
        subItems: []
      },
      {
        id: 'my-assets',
        label: 'My Assigned Toolbag',
        icon: ShieldCheck,
        subItems: []
      },
      {
        id: 'my-complaints',
        label: 'Tool Defect / Lab Repair',
        icon: Wrench,
        subItems: []
      },
      {
        id: 'field-guide',
        label: 'Fiber Diagnostic & SOP Guide',
        icon: BookOpen,
        subItems: []
      },
      {
        id: 'lifecycle',
        label: 'Serial Lifecycle Audit',
        icon: Activity,
        subItems: []
      }
    ];
  }

  const handleToggle = () => {
    if (setIsCollapsed) {
      setIsCollapsed(!isCollapsed);
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {!isCollapsed && (
        <div 
          className="fixed inset-0 top-16 bg-slate-900/40 z-30 md:hidden backdrop-blur-xs"
          onClick={handleToggle}
        />
      )}

      {/* Enterprise Rectangular Sidebar */}
      <aside 
        data-tour="sidebar-nav"
        className={`fixed top-16 left-0 bottom-0 z-40 bg-white border-r border-slate-200 transition-all duration-200 flex flex-col font-sans shadow-xs ${
          isCollapsed ? '-translate-x-full md:translate-x-0 md:w-16' : 'translate-x-0 w-64'
        }`}
      >
        
        {/* User Scope / Role Card Header */}
        <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
          {!isCollapsed && (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className={`w-7 h-7 text-white flex items-center justify-center font-black text-xs shrink-0 ${
                isSuperAdmin ? 'bg-[#e20d65]' : isRegionalAdmin ? 'bg-indigo-600' : isManager ? 'bg-[#6700ce]' : 'bg-emerald-600'
              }`}>
                {isSuperAdmin ? <ShieldCheck className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
              </div>
              <div className="truncate min-w-0">
                <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                  {isSuperAdmin ? 'SUPER ADMIN' : isRegionalAdmin ? 'REGIONAL ADMIN' : isManager ? 'CITY MANAGER' : 'FIELD WORKER'}
                </div>
                <div className="text-xs font-black text-[#1c023d] truncate">
                  {isSuperAdmin ? 'Central Oversight' : isRegionalAdmin ? (user?.region_name || 'Assigned Region') : (user?.location_name || `${locationName} Hub`)}
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleToggle}
            className={`w-6 h-6 bg-white hover:bg-slate-200 text-slate-600 flex items-center justify-center transition border border-slate-300 shrink-0 ${isCollapsed ? 'mx-auto' : ''}`}
            title={isCollapsed ? "Expand Sidebar Menu" : "Collapse Sidebar Menu"}
          >
            {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Primary Clean Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
          {primaryNav.map((item) => {
            const Icon = item.icon;
            const isSelfActive = activeTab === item.id;
            const isChildActive = item.subItems?.some(s => s.id === activeTab);
            const isActive = isSelfActive || isChildActive;

            return (
              <div key={item.id} className="space-y-0.5">
                <button
                  onClick={() => setActiveTab(item.id)}
                  data-tour={`nav-${item.id}`}
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center py-2.5 px-2' : 'justify-between px-3 py-2.5'} text-xs transition-colors group relative border ${
                    isActive 
                      ? 'bg-purple-50 text-[#1c023d] font-bold border-purple-200 border-l-4 border-l-[#e20d65] shadow-xs' 
                      : 'border-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-semibold'
                  }`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-[#e20d65]' : 'text-slate-500 group-hover:text-slate-800'
                    }`} />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </div>

                  {!isCollapsed && item.badge !== null && item.badge !== undefined && (
                    <span className={`px-1.5 py-0.2 text-[10px] font-mono font-bold ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                  )}
                </button>

                {/* Sub-Items List when Expanded and active */}
                {!isCollapsed && item.subItems && item.subItems.length > 0 && isActive && (
                  <div className="pl-6 pr-2 py-1 space-y-0.5 border-l border-purple-200 ml-4 my-1">
                    {item.subItems.map((sub) => {
                      const isSubActive = activeTab === sub.id;
                      return (
                        <button
                          key={sub.id}
                          onClick={() => setActiveTab(sub.id)}
                          className={`w-full text-left px-2 py-1 text-[11px] transition-colors flex items-center gap-1.5 ${
                            isSubActive
                              ? 'text-[#e20d65] font-extrabold bg-purple-100/60'
                              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-medium'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 ${isSubActive ? 'bg-[#e20d65]' : 'bg-slate-300'}`} />
                          <span className="truncate">{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Clean Integrated Sign Out Footer */}
        <div className="p-2.5 border-t border-slate-200 bg-slate-50">
          <button
            onClick={logout}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-start'} gap-2 px-2.5 py-2 text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition border border-transparent hover:border-rose-200`}
            title="Sign Out"
          >
            <LogOut className="w-4 h-4 shrink-0 text-slate-400 group-hover:text-rose-500" />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>

      </aside>
    </>
  );
};
