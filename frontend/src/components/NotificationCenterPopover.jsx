import React, { useState } from 'react';
import { 
  BellRing, 
  AlertTriangle, 
  FileCheck, 
  Truck, 
  Wrench, 
  CheckCircle2, 
  X, 
  ArrowRight, 
  ExternalLink,
  Sliders,
  Sparkles,
  Package,
  Layers,
  Cpu,
  Clock
} from 'lucide-react';

export const NotificationCenterPopover = ({ 
  isOpen, 
  onClose, 
  alerts = [], 
  requests = [], 
  stock = [], 
  setActiveTab,
  onOpenSettings,
  onRequestReceive
}) => {
  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL', 'LOW_STOCK', 'REQUESTS', 'REPAIRS'

  if (!isOpen) return null;

  // 1. Gather Low Stock Notifications
  const lowStockItems = stock.filter(s => s.is_low_stock).map(s => ({
    id: `stock-${s.variant_id}`,
    type: 'LOW_STOCK',
    category: 'LOW_STOCK',
    title: `Low Stock Breach: ${s.item_name}`,
    subtitle: `Variant: ${s.variant_name} (${s.is_serialized ? 'Serialized Asset' : 'Consumable'})`,
    detail: `Current Stock: ${s.current_quantity} units | Reorder Threshold: ${s.reorder_threshold} (Deficit: ${s.reorder_threshold - s.current_quantity} units)`,
    badge: 'CRITICAL DEFICIT',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
    icon: AlertTriangle,
    iconColor: 'text-rose-600',
    borderColor: 'border-l-rose-500',
    targetTab: 'central-stock',
    actionText: 'View Stock Master',
    secondaryAction: () => onRequestReceive && onRequestReceive(),
    secondaryActionText: '+ Quick Refill'
  }));

  // 2. Gather Pending Requests Notifications
  const pendingRequests = requests.filter(r => r.status === 'PENDING').map(r => ({
    id: `req-${r.request_id}`,
    type: 'REQUEST',
    category: 'REQUESTS',
    title: `Pending Stock Refill: Request #${r.request_id}`,
    subtitle: `${r.quantity_requested}x ${r.item_name || 'Stock Item'} (${r.variant_name || 'Standard'})`,
    detail: `Requested by ${r.requester_name || 'City Manager'} for ${r.location_name || 'City Hub'}`,
    badge: 'PENDING APPROVAL',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    icon: FileCheck,
    iconColor: 'text-amber-600',
    borderColor: 'border-l-amber-500',
    targetTab: 'requests',
    actionText: 'Review in Queue'
  }));

  // 3. Gather In-Transit Shipments
  const inTransitOrders = requests.filter(r => r.status === 'DISPATCHED').map(r => ({
    id: `transit-${r.request_id}`,
    type: 'TRANSIT',
    category: 'REQUESTS',
    title: `Shipment In-Transit: Order #${r.request_id}`,
    subtitle: `Destination: ${r.location_name || 'City Hub'} (${r.quantity_requested} units)`,
    detail: `Carrier: ${r.carrier_name || 'Tata Play Express Logistics'} · Tracking: ${r.tracking_number || 'TRK-LIVE'}`,
    badge: 'IN-TRANSIT',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    icon: Truck,
    iconColor: 'text-indigo-600',
    borderColor: 'border-l-indigo-500',
    targetTab: 'tracking',
    actionText: 'Track Shipment'
  }));

  // 4. Sample Repair / Fault notifications
  const faultAlerts = [
    {
      id: 'fault-1',
      type: 'REPAIR',
      category: 'REPAIRS',
      title: 'Technician Fault Report: TPF-NOK-W6-10001',
      subtitle: 'Nokia GPON ONT Wi-Fi 6',
      detail: 'Optical PON RX laser signal degradation reported by Amit Verma (Delhi Hub)',
      badge: 'REPAIR REQUIRED',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
      icon: Wrench,
      iconColor: 'text-purple-600',
      borderColor: 'border-l-purple-500',
      targetTab: 'repairs',
      actionText: 'Inspect Repair'
    }
  ];

  // Combine all actionable items
  const allNotifications = [
    ...lowStockItems,
    ...pendingRequests,
    ...faultAlerts,
    ...inTransitOrders
  ];

  const filteredNotifications = allNotifications.filter(n => {
    if (activeFilter === 'ALL') return true;
    return n.category === activeFilter;
  });

  const handleNavigate = (tab) => {
    if (setActiveTab) {
      setActiveTab(tab);
    }
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-xs"
        onClick={onClose}
      />

      {/* Popover Container */}
      <div className="fixed top-16 right-4 md:right-8 z-50 w-[92vw] sm:w-[460px] md:w-[500px] bg-white border border-slate-300 shadow-2xl font-sans flex flex-col max-h-[85vh] animate-in fade-in slide-in-from-top-2 duration-150">
        
        {/* Header Strip */}
        <div className="bg-[#1c023d] text-white p-4 border-b border-purple-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#e20d65] text-white flex items-center justify-center font-bold">
              <BellRing className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black tracking-tight text-white">
                  Operations Notification Center
                </h3>
                <span className="px-1.5 py-0.2 bg-[#e20d65] text-white text-[10px] font-mono font-bold">
                  {allNotifications.length} Action Items
                </span>
              </div>
              <p className="text-[11px] text-purple-200">
                Live inventory breaches, refill requests & fault telemetry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onOpenSettings && (
              <button
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className="p-1.5 text-purple-300 hover:text-white hover:bg-purple-900/60 transition"
                title="Configure SMS/Email Dispatch Alerts"
              >
                <Sliders className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-purple-300 hover:text-white hover:bg-purple-900/60 transition"
              title="Close Notification Panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Category Segmented Tabs */}
        <div className="bg-slate-50 border-b border-slate-200 p-2 flex items-center gap-1 overflow-x-auto text-xs font-bold shrink-0">
          <button
            onClick={() => setActiveFilter('ALL')}
            className={`px-3 py-1 border transition ${
              activeFilter === 'ALL'
                ? 'bg-[#1c023d] text-white border-[#1c023d]'
                : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'
            }`}
          >
            All ({allNotifications.length})
          </button>
          <button
            onClick={() => setActiveFilter('LOW_STOCK')}
            className={`px-3 py-1 border transition flex items-center gap-1 ${
              activeFilter === 'LOW_STOCK'
                ? 'bg-rose-600 text-white border-rose-600'
                : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'
            }`}
          >
            <span className="w-2 h-2 bg-rose-500 rounded-full" />
            <span>Low Stock ({lowStockItems.length})</span>
          </button>
          <button
            onClick={() => setActiveFilter('REQUESTS')}
            className={`px-3 py-1 border transition flex items-center gap-1 ${
              activeFilter === 'REQUESTS'
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'
            }`}
          >
            <span className="w-2 h-2 bg-amber-500 rounded-full" />
            <span>Refills ({pendingRequests.length + inTransitOrders.length})</span>
          </button>
          <button
            onClick={() => setActiveFilter('REPAIRS')}
            className={`px-3 py-1 border transition flex items-center gap-1 ${
              activeFilter === 'REPAIRS'
                ? 'bg-purple-700 text-white border-purple-700'
                : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'
            }`}
          >
            <span className="w-2 h-2 bg-purple-500 rounded-full" />
            <span>Faults ({faultAlerts.length})</span>
          </button>
        </div>

        {/* Notifications Scroll List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-2">
          {filteredNotifications.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="text-xs font-bold text-slate-700">No active alerts in this category.</p>
              <p className="text-[11px] text-slate-400">All inventory thresholds and workflows are currently healthy.</p>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const Icon = notif.icon;
              return (
                <div
                  key={notif.id}
                  className={`p-3 bg-white border border-slate-200 border-l-4 ${notif.borderColor} shadow-xs hover:border-slate-400 transition flex flex-col justify-between gap-2.5`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <div className={`p-1.5 bg-slate-50 border border-slate-200 shrink-0 mt-0.5 ${notif.iconColor}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs font-black text-[#1c023d]">
                            {notif.title}
                          </h4>
                          <span className={`px-1.5 py-0.2 text-[9px] font-mono font-bold border uppercase ${notif.badgeColor}`}>
                            {notif.badge}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-700 mt-0.5">
                          {notif.subtitle}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-tight font-mono">
                          {notif.detail}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action Link Footer */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>Live Operational Signal</span>
                    </span>

                    <div className="flex items-center gap-2 font-bold">
                      {notif.secondaryAction && (
                        <button
                          onClick={() => {
                            onClose();
                            notif.secondaryAction();
                          }}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-[11px] transition font-bold"
                        >
                          {notif.secondaryActionText}
                        </button>
                      )}

                      <button
                        onClick={() => handleNavigate(notif.targetTab)}
                        className="px-3 py-1 bg-[#1c023d] hover:bg-[#2c095c] text-white border border-[#1c023d] text-[11px] transition flex items-center gap-1 shadow-xs"
                      >
                        <span>{notif.actionText}</span>
                        <ArrowRight className="w-3 h-3 text-[#e20d65]" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Strip */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
          <button
            onClick={() => handleNavigate('alerts')}
            className="font-bold text-[#6700ce] hover:underline flex items-center gap-1"
          >
            <span>Open Telemetry Console</span>
            <ExternalLink className="w-3 h-3" />
          </button>

          {onOpenSettings && (
            <button
              onClick={() => {
                onClose();
                onOpenSettings();
              }}
              className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 border border-slate-300 px-2.5 py-1 bg-white hover:bg-slate-100 transition"
            >
              SMS & Email Relays
            </button>
          )}
        </div>

      </div>
    </>
  );
};
