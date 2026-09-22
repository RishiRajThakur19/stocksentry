import React, { useState } from 'react';
import { 
  Compass, 
  X, 
  Warehouse, 
  Truck, 
  ShoppingBag, 
  Activity, 
  Wrench, 
  ShieldCheck, 
  Users, 
  ArrowRight, 
  CheckCircle2, 
  QrCode, 
  Layers, 
  Cpu, 
  Building2, 
  UserMinus,
  Sparkles,
  HelpCircle,
  Clock,
  BookOpen
} from 'lucide-react';

export const WorkflowGuideModal = ({ isOpen, onClose, setActiveTab, onStartTour }) => {
  const [activeTab, setGuideTab] = useState('pipeline'); // 'pipeline', 'roles', 'how-to', 'status'

  if (!isOpen) return null;

  const handleQuickJump = (tab) => {
    if (setActiveTab) {
      setActiveTab(tab);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans animate-in fade-in duration-150">
      <div className="bg-white border border-slate-300 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header Strip */}
        <div className="bg-[#1c023d] text-white p-5 border-b border-purple-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#e20d65] text-white flex items-center justify-center font-bold shrink-0">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight text-white">
                  StockSentry Operational Architecture & Workflow Guide
                </h2>
                <span className="px-2 py-0.5 bg-purple-900 text-purple-200 border border-purple-700 text-[10px] font-mono font-bold uppercase">
                  Handbook
                </span>
              </div>
              <p className="text-xs text-purple-200 mt-0.5">
                Master guide for end-to-end telecom asset lifecycle, role responsibilities, and inventory refill governance.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onStartTour && (
              <button
                onClick={() => {
                  onClose();
                  onStartTour();
                }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#e20d65] hover:bg-[#c20955] text-white text-xs font-black transition shadow-xs"
                title="Start interactive guided tour"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Live Interactive Tour →</span>
              </button>
            )}

            <button 
              onClick={onClose} 
              className="text-purple-300 hover:text-white hover:bg-purple-900/60 p-1.5 transition"
              title="Close Guide"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 flex items-center gap-2 text-xs font-bold shrink-0 overflow-x-auto">
          <button
            onClick={() => setGuideTab('pipeline')}
            className={`py-3 px-3.5 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'pipeline'
                ? 'border-[#e20d65] text-[#1c023d] font-black'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity className="w-4 h-4 text-[#e20d65]" />
            <span>End-to-End Pipeline</span>
          </button>

          <button
            onClick={() => setGuideTab('roles')}
            className={`py-3 px-3.5 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'roles'
                ? 'border-[#e20d65] text-[#1c023d] font-black'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>4-Tier Role Authority</span>
          </button>

          <button
            onClick={() => setGuideTab('how-to')}
            className={`py-3 px-3.5 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'how-to'
                ? 'border-[#e20d65] text-[#1c023d] font-black'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4 text-emerald-600" />
            <span>Operational Walkthroughs</span>
          </button>

          <button
            onClick={() => setGuideTab('status')}
            className={`py-3 px-3.5 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'status'
                ? 'border-[#e20d65] text-[#1c023d] font-black'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <HelpCircle className="w-4 h-4 text-amber-600" />
            <span>Status Codes & Glossary</span>
          </button>
        </div>

        {/* Modal Scroll Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 text-xs">
          
          {/* TAB 1: PIPELINE */}
          {activeTab === 'pipeline' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-black text-[#1c023d] uppercase tracking-wide">
                  The 5-Stage Telecom Hardware Lifecycle
                </h3>
                <p className="text-slate-500 mt-0.5">
                  How materials move from vendor intake to customer homes and regional repair facilities.
                </p>
              </div>

              {/* Stage Flow */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                
                {/* Step 1 */}
                <div className="p-4 bg-slate-50 border border-slate-200 border-t-4 border-t-purple-900 flex flex-col justify-between space-y-2">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-purple-900 bg-purple-100 px-1.5 py-0.5">
                      STAGE 01
                    </span>
                    <h4 className="font-black text-[#1c023d] text-xs mt-2">Central Procurement</h4>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Vendors deliver to National Warehouse. Consumables tracked by batch; Serialized modems/splicers tagged with unique barcodes.
                    </p>
                  </div>
                  <button 
                    onClick={() => handleQuickJump('central-stock')}
                    className="text-[10px] font-bold text-[#e20d65] hover:underline flex items-center gap-1 pt-2 border-t border-slate-200"
                  >
                    <span>View Central Stock</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {/* Step 2 */}
                <div className="p-4 bg-slate-50 border border-slate-200 border-t-4 border-t-amber-600 flex flex-col justify-between space-y-2">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5">
                      STAGE 02
                    </span>
                    <h4 className="font-black text-[#1c023d] text-xs mt-2">City Refill Orders</h4>
                    <p className="text-[11px] text-slate-600 mt-1">
                      City Managers monitor hub buffer. If low, they submit refill request. Regional Admins review and approve budget.
                    </p>
                  </div>
                  <button 
                    onClick={() => handleQuickJump('requests')}
                    className="text-[10px] font-bold text-amber-700 hover:underline flex items-center gap-1 pt-2 border-t border-slate-200"
                  >
                    <span>Approval Queue</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {/* Step 3 */}
                <div className="p-4 bg-slate-50 border border-slate-200 border-t-4 border-t-indigo-600 flex flex-col justify-between space-y-2">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-indigo-900 bg-indigo-100 px-1.5 py-0.5">
                      STAGE 03
                    </span>
                    <h4 className="font-black text-[#1c023d] text-xs mt-2">Dispatch In-Transit</h4>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Central Warehouse packs equipment and generates Waybill. Logistics carrier moves stock to city destination.
                    </p>
                  </div>
                  <button 
                    onClick={() => handleQuickJump('tracking')}
                    className="text-[10px] font-bold text-indigo-700 hover:underline flex items-center gap-1 pt-2 border-t border-slate-200"
                  >
                    <span>Track Shipments</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {/* Step 4 */}
                <div className="p-4 bg-slate-50 border border-slate-200 border-t-4 border-t-emerald-600 flex flex-col justify-between space-y-2">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-emerald-900 bg-emerald-100 px-1.5 py-0.5">
                      STAGE 04
                    </span>
                    <h4 className="font-black text-[#1c023d] text-xs mt-2">Tech Handover</h4>
                    <p className="text-[11px] text-slate-600 mt-1">
                      City Manager receives shipment and assigns CPE modems/cleavers to Field Workers with recorded digital custody.
                    </p>
                  </div>
                  <button 
                    onClick={() => handleQuickJump('lifecycle')}
                    className="text-[10px] font-bold text-emerald-700 hover:underline flex items-center gap-1 pt-2 border-t border-slate-200"
                  >
                    <span>Audit Custody</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {/* Step 5 */}
                <div className="p-4 bg-slate-50 border border-slate-200 border-t-4 border-t-rose-600 flex flex-col justify-between space-y-2">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-rose-900 bg-rose-100 px-1.5 py-0.5">
                      STAGE 05
                    </span>
                    <h4 className="font-black text-[#1c023d] text-xs mt-2">Repairs & NOC</h4>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Damaged or optical signal loss units sent to Regional Diagnostics Lab. Departing staff must return all assets before NOC.
                    </p>
                  </div>
                  <button 
                    onClick={() => handleQuickJump('repairs')}
                    className="text-[10px] font-bold text-rose-700 hover:underline flex items-center gap-1 pt-2 border-t border-slate-200"
                  >
                    <span>Repairs Console</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

              </div>

              {/* Distinctions Box */}
              <div className="p-4 bg-purple-50 border border-purple-200 space-y-2">
                <div className="flex items-center gap-2 font-black text-[#1c023d]">
                  <Sparkles className="w-4 h-4 text-[#e20d65]" />
                  <span>Key Distinction: Consumables vs Serialized Assets</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 bg-white border border-purple-200 space-y-1">
                    <strong className="text-amber-700 flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5" />
                      <span>Consumables (Quantity Tracked)</span>
                    </strong>
                    <p className="text-slate-600 text-[11px]">
                      Fiber Drop Cables, Patch Cords, Heat Shrink Sleeves, Cable Ties, Uniforms. Stored and refilled in bulk counts. Deducted directly upon city fulfillment.
                    </p>
                  </div>
                  <div className="p-3 bg-white border border-purple-200 space-y-1">
                    <strong className="text-indigo-700 flex items-center gap-1">
                      <Cpu className="w-3.5 h-3.5" />
                      <span>Serialized Assets (Unit-by-Unit Tracked)</span>
                    </strong>
                    <p className="text-slate-600 text-[11px]">
                      Nokia/Huawei Wi-Fi 6 GPON ONTs, Fujikura 90S+ Splicers, EXFO OTDRs. Each single piece has a unique serial number (e.g. <code>TPF-NOK-W6-10001</code>) and complete chronological history.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: ROLES */}
          {activeTab === 'roles' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-black text-[#1c023d] uppercase tracking-wide">
                  4-Tier Organizational Role Hierarchy
                </h3>
                <p className="text-slate-500 mt-0.5">
                  Clear separation of duties across central governance, regional territories, city operations, and field personnel.
                </p>
              </div>

              <div className="space-y-3">
                
                {/* Super Admin */}
                <div className="p-4 bg-white border border-slate-200 border-l-4 border-l-[#e20d65] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-[#e20d65] text-white text-[10px] font-mono font-bold">TIER 1</span>
                      <h4 className="text-sm font-black text-[#1c023d]">Super Admin (Central Headquarters)</h4>
                    </div>
                    <p className="text-[11px] text-slate-600 max-w-2xl">
                      Full national oversight. Manages central warehouse inventory master, creates catalog SKUs, conducts nationwide predictive analytics, and dispatches supplier batches.
                    </p>
                  </div>
                  <span className="font-mono text-xs text-slate-500 bg-slate-100 px-3 py-1 border border-slate-200 shrink-0">
                    admin@tataplay.com
                  </span>
                </div>

                {/* Regional Admin */}
                <div className="p-4 bg-white border border-slate-200 border-l-4 border-l-indigo-600 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-mono font-bold">TIER 2</span>
                      <h4 className="text-sm font-black text-[#1c023d]">Regional Admin (North / West / South Regions)</h4>
                    </div>
                    <p className="text-[11px] text-slate-600 max-w-2xl">
                      Territorial governance. Reviews and approves stock refill orders from City Managers in their jurisdiction; oversees regional repair and hardware diagnostic facilities.
                    </p>
                  </div>
                  <span className="font-mono text-xs text-slate-500 bg-slate-100 px-3 py-1 border border-slate-200 shrink-0">
                    north.admin@tataplay.com
                  </span>
                </div>

                {/* City Manager */}
                <div className="p-4 bg-white border border-slate-200 border-l-4 border-l-[#6700ce] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-[#6700ce] text-white text-[10px] font-mono font-bold">TIER 3</span>
                      <h4 className="text-sm font-black text-[#1c023d]">City Manager (Delhi, Mumbai, Bangalore Hubs)</h4>
                    </div>
                    <p className="text-[11px] text-slate-600 max-w-2xl">
                      Runs the city distribution center. Submits replenishment orders to Central Warehouse, confirms shipment delivery receipt, and assigns optical equipment to technicians.
                    </p>
                  </div>
                  <span className="font-mono text-xs text-slate-500 bg-slate-100 px-3 py-1 border border-slate-200 shrink-0">
                    delhi@tataplay.com
                  </span>
                </div>

                {/* Field Worker */}
                <div className="p-4 bg-white border border-slate-200 border-l-4 border-l-emerald-600 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-mono font-bold">TIER 4</span>
                      <h4 className="text-sm font-black text-[#1c023d]">Field Worker & Optical Splicing Technician</h4>
                    </div>
                    <p className="text-[11px] text-slate-600 max-w-2xl">
                      Frontline FTTH installation. Holds digital custody of assigned fusion splicers & modems; submits laser fault complaints; requests consumable patch cords.
                    </p>
                  </div>
                  <span className="font-mono text-xs text-slate-500 bg-slate-100 px-3 py-1 border border-slate-200 shrink-0">
                    delhi.worker@tataplay.com
                  </span>
                </div>

              </div>
            </div>
          )}

          {/* TAB 3: HOW TO */}
          {activeTab === 'how-to' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-black text-[#1c023d] uppercase tracking-wide">
                  Step-by-Step Daily Workflows
                </h3>
                <p className="text-slate-500 mt-0.5">
                  Frequently executed tasks and how to perform them seamlessly in the system.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                <div className="p-4 bg-slate-50 border border-slate-200 space-y-2">
                  <h4 className="font-black text-[#1c023d] flex items-center gap-2">
                    <span className="w-5 h-5 bg-purple-900 text-white text-[10px] flex items-center justify-center font-mono">1</span>
                    <span>How to Receive Vendor Stock Restock</span>
                  </h4>
                  <p className="text-slate-600 text-[11px]">
                    Go to <strong>Central Warehouse Stock</strong> ➔ click the magenta <strong>+ Receive Vendor Stock</strong> button in the top right. Pick the SKU variant, enter quantity and supplier name, then confirm.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 space-y-2">
                  <h4 className="font-black text-[#1c023d] flex items-center gap-2">
                    <span className="w-5 h-5 bg-purple-900 text-white text-[10px] flex items-center justify-center font-mono">2</span>
                    <span>How to Request a City Stock Refill</span>
                  </h4>
                  <p className="text-slate-600 text-[11px]">
                    As a City Manager, go to <strong>Stock Refill Store</strong>, select items needed, specify quantity, and click <strong>Submit Refill Request</strong>. It routes to Regional Admin for review.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 space-y-2">
                  <h4 className="font-black text-[#1c023d] flex items-center gap-2">
                    <span className="w-5 h-5 bg-purple-900 text-white text-[10px] flex items-center justify-center font-mono">3</span>
                    <span>How to Audit a Serial Number's Lifetime</span>
                  </h4>
                  <p className="text-slate-600 text-[11px]">
                    Go to <strong>Asset Operations ➔ Serial Lifecycle Audit</strong>, enter any serial number (e.g. <code>TPF-NOK-W6-10001</code>), and view every chronological transfer, assignment, and fault record.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 space-y-2">
                  <h4 className="font-black text-[#1c023d] flex items-center gap-2">
                    <span className="w-5 h-5 bg-purple-900 text-white text-[10px] flex items-center justify-center font-mono">4</span>
                    <span>How Staff Offboarding & NOC Works</span>
                  </h4>
                  <p className="text-slate-600 text-[11px]">
                    When a field worker resigns, go to <strong>Staff Offboarding & NOC</strong>. The system verifies whether any assigned modems or splicers are still outstanding before generating the digital clearance certificate.
                  </p>
                </div>

              </div>
            </div>
          )}

          {/* TAB 4: STATUS */}
          {activeTab === 'status' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-black text-[#1c023d] uppercase tracking-wide">
                  System Status Codes & Reference Glossary
                </h3>
                <p className="text-slate-500 mt-0.5">
                  Standard definitions for asset states, request lifecycles, and alert severity.
                </p>
              </div>

              <div className="border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4">Status Code</th>
                      <th className="py-2.5 px-4">Entity</th>
                      <th className="py-2.5 px-4">Meaning & Trigger</th>
                      <th className="py-2.5 px-4">Next Expected Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-[11px]">
                    <tr>
                      <td className="py-2.5 px-4 font-mono font-bold text-indigo-700">IN_WAREHOUSE</td>
                      <td className="py-2.5 px-4">Asset Unit</td>
                      <td className="py-2.5 px-4">Stock resides safely in central or city storage facility.</td>
                      <td className="py-2.5 px-4 text-slate-600">Available for assignment or dispatch.</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-mono font-bold text-emerald-700">ASSIGNED</td>
                      <td className="py-2.5 px-4">Asset Unit</td>
                      <td className="py-2.5 px-4">Actively assigned to field technician or customer.</td>
                      <td className="py-2.5 px-4 text-slate-600">Technician holds custody; tracks maintenance.</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-mono font-bold text-purple-700">IN_REPAIR</td>
                      <td className="py-2.5 px-4">Asset Unit</td>
                      <td className="py-2.5 px-4">Undergoing optical diagnostics in regional facility.</td>
                      <td className="py-2.5 px-4 text-slate-600">Lab technician repairs or recommends scrap.</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-mono font-bold text-rose-700">DECOMMISSIONED</td>
                      <td className="py-2.5 px-4">Asset Unit</td>
                      <td className="py-2.5 px-4">Unit scrapped or written off with administrative audit.</td>
                      <td className="py-2.5 px-4 text-slate-600">Archived; excluded from active inventory book.</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-mono font-bold text-amber-700">PENDING</td>
                      <td className="py-2.5 px-4">City Request</td>
                      <td className="py-2.5 px-4">Submitted by city manager awaiting regional approval.</td>
                      <td className="py-2.5 px-4 text-slate-600">Regional admin reviews quota & approves.</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-mono font-bold text-blue-700">DISPATCHED</td>
                      <td className="py-2.5 px-4">City Request</td>
                      <td className="py-2.5 px-4">In-transit with carrier logistics.</td>
                      <td className="py-2.5 px-4 text-slate-600">Hub manager confirms receipt upon arrival.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Footer Strip with Quick Action Shortcuts */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 text-xs">
          <span className="text-slate-500 font-mono text-[11px]">
            StockSentry Enterprise Operations Engine v2.4
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleQuickJump('dashboard')}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold transition"
            >
              Executive Dashboard
            </button>
            <button
              onClick={() => handleQuickJump('central-stock')}
              className="px-3.5 py-1.5 bg-[#e20d65] hover:bg-[#cc0059] text-white font-bold transition shadow-xs flex items-center gap-1.5"
            >
              <span>Central Stock Master</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
