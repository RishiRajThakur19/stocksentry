import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Sparkles, 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Search, 
  MapPin, 
  Activity, 
  ShieldCheck, 
  Warehouse, 
  Truck, 
  ArrowLeftRight, 
  Bot, 
  Lightbulb, 
  Layers,
  Wrench,
  ShoppingBag,
  Users,
  FileCheck,
  PackageCheck,
  QrCode,
  Building2,
  HardHat,
  Wifi,
  BookOpen
} from 'lucide-react';

export const InteractiveTutorialTour = ({ 
  isOpen, 
  onClose, 
  setActiveTab, 
  activeTab,
  userRole = 'SUPER_ADMIN' 
}) => {
  // Normalize initial role
  const getInitialRoleKey = (role) => {
    if (role === 'SUPER_ADMIN' || role === 'CENTRAL_ADMIN') return 'SUPER_ADMIN';
    if (role === 'REGIONAL_ADMIN') return 'REGIONAL_ADMIN';
    if (role === 'MANAGER' || role === 'LOCATION_MANAGER') return 'MANAGER';
    if (role === 'FIELD_WORKER') return 'FIELD_WORKER';
    return 'SUPER_ADMIN';
  };

  const [selectedRole, setSelectedRole] = useState(() => getInitialRoleKey(userRole));
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [cardPosition, setCardPosition] = useState({ top: 0, left: 0, placement: 'center' });
  const [dontShowAgain, setDontShowAgain] = useState(true);
  const cardRef = useRef(null);

  // Sync role if prop changes
  useEffect(() => {
    setSelectedRole(getInitialRoleKey(userRole));
    setCurrentStep(0);
  }, [userRole]);

  // Role Definitions & Tour Steps
  const ROLE_TOURS = {
    SUPER_ADMIN: {
      roleTitle: 'Super Admin',
      roleBadge: 'Central Command',
      icon: ShieldCheck,
      badgeColor: 'text-[#e20d65] bg-pink-50 border-pink-200',
      steps: [
        {
          id: 'welcome',
          target: null,
          tab: 'dashboard',
          badge: 'Super Admin',
          icon: ShieldCheck,
          iconColor: 'text-[#e20d65]',
          iconBg: 'bg-pink-50 border-pink-100',
          title: 'Central Command Oversight',
          description: 'As Super Admin, you have nationwide inventory authority across all Indian hubs, inbound supplier restock, and master ERP governance.',
          tip: 'Use the role pills above to explore other staff views.',
          buttonText: 'Start Tour'
        },
        {
          id: 'search-scope',
          target: '[data-tour="search-bar"]',
          tab: 'dashboard',
          badge: 'Global Search',
          icon: Search,
          iconColor: 'text-indigo-600',
          iconBg: 'bg-indigo-50 border-indigo-100',
          title: 'Nationwide SKU & Serial Search',
          description: 'Instantly query SKUs, serial barcodes, or regional warehouses across India with real-time WebSocket telemetry sync.',
          tip: 'Search by serial number (e.g. ONT-2024-001) for instant history.',
          buttonText: 'Next'
        },
        {
          id: 'central-stock',
          target: '[data-tour="nav-central-stock"]',
          tab: 'central-stock',
          badge: 'Central Stock',
          icon: Warehouse,
          iconColor: 'text-purple-600',
          iconBg: 'bg-purple-50 border-purple-100',
          title: 'Master Warehouse & Catalog',
          description: 'Manage master catalog definitions, receive supplier bulk restocks, and configure reorder safety thresholds.',
          tip: 'Click "+ Inbound Restock" on the dashboard to log new vendor stock.',
          buttonText: 'Next'
        },
        {
          id: 'requests-dispatch',
          target: '[data-tour="nav-requests"]',
          tab: 'requests',
          badge: 'Logistics Queue',
          icon: ArrowLeftRight,
          iconColor: 'text-[#e20d65]',
          iconBg: 'bg-pink-50 border-pink-100',
          title: 'Global Requests & Dispatches',
          description: 'Review city replenishment requisitions, approve stock allocations, and dispatch shipments with courier waybills.',
          tip: 'Inventory is only deducted when marked as officially dispatched.',
          buttonText: 'Next'
        },
        {
          id: 'lifecycle-governance',
          target: '[data-tour="nav-lifecycle"]',
          tab: 'lifecycle',
          badge: 'Serial Audit',
          icon: Activity,
          iconColor: 'text-indigo-600',
          iconBg: 'bg-indigo-50 border-indigo-100',
          title: 'Serial Lifecycle & Repairs',
          description: 'Trace individual device pedigree, manage repair centers & scrap approvals, and issue employee clearance NOCs.',
          tip: 'Audit history shows procurement date, field tech, and fault logs.',
          buttonText: 'Next'
        },
        {
          id: 'copilot-governance',
          target: '[data-tour="ai-copilot-btn"]',
          tab: 'dashboard',
          badge: 'AI & Audits',
          icon: Bot,
          iconColor: 'text-[#e20d65]',
          iconBg: 'bg-pink-50 border-pink-100',
          title: 'AI Copilot & Predictive Telemetry',
          description: 'Query 30-day stockout predictions, calculate inventory valuations, and review system audit logs anytime.',
          tip: 'Reopen this tour or Ops Guide anytime from the top bar.',
          buttonText: 'Finish Tour 🎉'
        }
      ]
    },

    REGIONAL_ADMIN: {
      roleTitle: 'Regional Admin',
      roleBadge: 'Regional Authority',
      icon: Building2,
      badgeColor: 'text-indigo-600 bg-indigo-50 border-indigo-200',
      steps: [
        {
          id: 'welcome',
          target: null,
          tab: 'dashboard',
          badge: 'Regional Admin',
          icon: Building2,
          iconColor: 'text-indigo-600',
          iconBg: 'bg-indigo-50 border-indigo-100',
          title: 'Regional Logistics Command',
          description: 'As Regional Admin, you oversee inventory across all city hubs within your assigned state territory and approve refilling orders.',
          tip: 'Your jurisdiction badge shows your assigned regional zone.',
          buttonText: 'Start Tour'
        },
        {
          id: 'approval-queue',
          target: '[data-tour="nav-requests"]',
          tab: 'requests',
          badge: 'Approvals',
          icon: FileCheck,
          iconColor: 'text-[#e20d65]',
          iconBg: 'bg-pink-50 border-pink-100',
          title: 'Stock Approval Queue',
          description: 'Review city hub replenishment orders, verify local stock burn-rates, and approve requisitions for central fulfillment.',
          tip: 'Approve or reject requests with one click.',
          buttonText: 'Next'
        },
        {
          id: 'in-transit',
          target: '[data-tour="search-bar"]',
          tab: 'dashboard',
          badge: 'Tracking',
          icon: Truck,
          iconColor: 'text-purple-600',
          iconBg: 'bg-purple-50 border-purple-100',
          title: 'Regional In-Transit Tracking',
          description: 'Monitor courier shipments moving into your regional hubs with live dispatch status, vehicle numbers, and ETAs.',
          tip: 'Ensures zero-loss in-transit visibility across state lines.',
          buttonText: 'Next'
        },
        {
          id: 'repairs-transfers',
          target: '[data-tour="nav-repairs"]',
          tab: 'repairs',
          badge: 'Repairs & NOC',
          icon: Wrench,
          iconColor: 'text-amber-600',
          iconBg: 'bg-amber-50 border-amber-100',
          title: 'Regional Repairs & Transfers',
          description: 'Authorize device repair triage, approve RMA scrap certificates, and transfer surplus stock between nearby city hubs.',
          tip: 'Prevents unnecessary new orders when neighboring hubs have stock.',
          buttonText: 'Next'
        },
        {
          id: 'hubs-staff',
          target: '[data-tour="sidebar-nav"]',
          tab: 'dashboard',
          badge: 'City Hubs',
          icon: Users,
          iconColor: 'text-indigo-600',
          iconBg: 'bg-indigo-50 border-indigo-100',
          title: 'City Hubs & Staff Governance',
          description: 'Manage city manager personnel, perform bulk Excel technician onboarding, and review regional alert telemetry.',
          tip: 'Regional alerts highlight city hubs approaching critical levels.',
          buttonText: 'Finish Tour 🎉'
        }
      ]
    },

    MANAGER: {
      roleTitle: 'City Manager',
      roleBadge: 'City Hub Node',
      icon: Warehouse,
      badgeColor: 'text-purple-600 bg-purple-50 border-purple-200',
      steps: [
        {
          id: 'welcome',
          target: null,
          tab: 'dashboard',
          badge: 'City Manager',
          icon: Warehouse,
          iconColor: 'text-purple-600',
          iconBg: 'bg-purple-50 border-purple-100',
          title: 'City Hub Operations',
          description: 'As City Hub Manager, you supply equipment to ~600-700 field sales & installation staff, request refills, and confirm deliveries.',
          tip: 'Your hub name is displayed on the top right jurisdiction pill.',
          buttonText: 'Start Tour'
        },
        {
          id: 'kpis',
          target: '[data-tour="kpi-metrics"]',
          tab: 'dashboard',
          badge: 'Hub Health',
          icon: Activity,
          iconColor: 'text-emerald-600',
          iconBg: 'bg-emerald-50 border-emerald-100',
          title: 'City Stock & Low-Stock Alerts',
          description: 'Monitor catalog SKUs in your city node, review low stock thresholds, and track pending technician allocations.',
          tip: 'Thresholds turn amber or red when safety stock is breached.',
          buttonText: 'Next'
        },
        {
          id: 'refill-store',
          target: '[data-tour="nav-request-form"]',
          tab: 'request-form',
          badge: 'Refill Store',
          icon: ShoppingBag,
          iconColor: 'text-[#e20d65]',
          iconBg: 'bg-pink-50 border-pink-100',
          title: 'Stock Refill Store',
          description: 'Order ONTs, dual-band Wi-Fi 6 routers, fiber spools, and patch cords in bulk from Central/Regional warehouses.',
          tip: 'Submit bulk requests before weekend installation rushes.',
          buttonText: 'Next'
        },
        {
          id: 'delivery-confirmation',
          target: '[data-tour="nav-my-requests"]',
          tab: 'my-requests',
          badge: 'Deliveries',
          icon: PackageCheck,
          iconColor: 'text-indigo-600',
          iconBg: 'bg-indigo-50 border-indigo-100',
          title: 'Shipment Tracking & Receipt',
          description: 'Track dispatched replenishments on a live map and click "Confirm Delivery" upon arrival to add stock to your city hub.',
          tip: 'Confirming receipt completes the verified chain-of-custody.',
          buttonText: 'Next'
        },
        {
          id: 'hub-assets',
          target: '[data-tour="sidebar-nav"]',
          tab: 'dashboard',
          badge: 'Field Force',
          icon: HardHat,
          iconColor: 'text-amber-600',
          iconBg: 'bg-amber-50 border-amber-100',
          title: 'Field Tech Assets & Repairs',
          description: 'Issue hardware to installation technicians, report customer faulty units, and handle technician offboarding NOC sign-offs.',
          tip: 'Never lose a router: every serial unit is mapped to a technician.',
          buttonText: 'Finish Tour 🎉'
        }
      ]
    },

    FIELD_WORKER: {
      roleTitle: 'Field Worker',
      roleBadge: 'Technician Desk',
      icon: HardHat,
      badgeColor: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      steps: [
        {
          id: 'welcome',
          target: null,
          tab: 'my-assets',
          badge: 'Field Worker',
          icon: HardHat,
          iconColor: 'text-emerald-600',
          iconBg: 'bg-emerald-50 border-emerald-100',
          title: 'Field Worker Desk',
          description: 'As a field technician, you install customer fiber lines, verify serial equipment, and report defective hardware from the field.',
          tip: 'Keep your active devices synced for quick daily dispatch.',
          buttonText: 'Start Tour'
        },
        {
          id: 'my-devices',
          target: '[data-tour="sidebar-nav"]',
          tab: 'my-assets',
          badge: 'My Custody',
          icon: ShieldCheck,
          iconColor: 'text-indigo-600',
          iconBg: 'bg-indigo-50 border-indigo-100',
          title: 'My Assigned Devices',
          description: 'View every ONT, router, and optical power meter currently checked out to your technician ID.',
          tip: 'Verify device serial numbers before customer premises installation.',
          buttonText: 'Next'
        },
        {
          id: 'fault-reports',
          target: '[data-tour="search-bar"]',
          tab: 'my-complaints',
          badge: 'Fault Triage',
          icon: Wrench,
          iconColor: 'text-rose-600',
          iconBg: 'bg-rose-50 border-rose-100',
          title: 'Customer Fault Logging',
          description: 'Report malfunctioning customer ONTs or optical faults directly from your mobile/tablet to initiate replacement.',
          tip: 'Faulty units get automatically flagged for repair triage.',
          buttonText: 'Next'
        },
        {
          id: 'wifi-setup-tour',
          target: '[data-tour="sidebar-nav"]',
          tab: 'wifi-setup',
          badge: 'Wi-Fi Setup',
          icon: Wifi,
          iconColor: 'text-[#e20d65]',
          iconBg: 'bg-pink-50 border-pink-100',
          title: 'Subscriber Wi-Fi & ONT Setup',
          description: 'Calibrate optical power dBm (-15 to -24 dBm optimal gauge), configure subscriber SSID, generate secure WPA2 password, and print on-site handover certificate.',
          tip: 'Never activate an ONT if optical loss exceeds -27 dBm.',
          buttonText: 'Next'
        },
        {
          id: 'field-sop-guide',
          target: '[data-tour="sidebar-nav"]',
          tab: 'field-guide',
          badge: 'Field SOP',
          icon: BookOpen,
          iconColor: 'text-indigo-600',
          iconBg: 'bg-indigo-50 border-indigo-100',
          title: 'Field SOP & Troubleshooting Guide',
          description: 'Access Fujikura 90S+ 5-step splicing protocols, GPON link budget tables, and Nokia ONT LED diagnostic codes on-site.',
          tip: 'You are all set! Have a productive day in the field.',
          buttonText: 'Got It 🎉'
        }
      ]
    }
  };

  const activeRoleData = ROLE_TOURS[selectedRole] || ROLE_TOURS.SUPER_ADMIN;
  const currentSteps = activeRoleData.steps;
  const currentStepData = currentSteps[currentStep] || currentSteps[0];

  // Auto-switch tab if step requires a specific view
  useEffect(() => {
    if (isOpen && currentStepData.tab && currentStepData.tab !== activeTab) {
      if (setActiveTab) {
        setActiveTab(currentStepData.tab);
      }
    }
  }, [isOpen, currentStep, currentStepData, activeTab, setActiveTab]);

  // Recalculate target element position with compact offsets
  const updatePosition = useCallback(() => {
    if (!isOpen) return;

    if (!currentStepData.target) {
      setTargetRect(null);
      setCardPosition({ top: 0, left: 0, placement: 'center' });
      return;
    }

    const timer = setTimeout(() => {
      const el = document.querySelector(currentStepData.target);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);

        const isInViewport = (
          rect.top >= 0 &&
          rect.left >= 0 &&
          rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
          rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );

        if (!isInViewport) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        // Compact Dimensions: ~340px width x ~220px height
        const cardWidth = Math.min(340, window.innerWidth - 24);
        const cardHeight = 225;
        const margin = 12;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let top = 0;
        let left = 0;
        let placement = 'bottom';

        if (rect.bottom + cardHeight + margin < viewportHeight) {
          top = rect.bottom + margin;
          left = Math.max(margin, Math.min(rect.left, viewportWidth - cardWidth - margin));
          placement = 'bottom';
        } else if (rect.top - cardHeight - margin > 0) {
          top = rect.top - cardHeight - margin;
          left = Math.max(margin, Math.min(rect.left, viewportWidth - cardWidth - margin));
          placement = 'top';
        } else if (rect.right + cardWidth + margin < viewportWidth) {
          top = Math.max(margin, Math.min(rect.top, viewportHeight - cardHeight - margin));
          left = rect.right + margin;
          placement = 'right';
        } else if (rect.left - cardWidth - margin > 0) {
          top = Math.max(margin, Math.min(rect.top, viewportHeight - cardHeight - margin));
          left = rect.left - cardWidth - margin;
          placement = 'left';
        } else {
          top = Math.max(margin, (viewportHeight - cardHeight) / 2);
          left = Math.max(margin, (viewportWidth - cardWidth) / 2);
          placement = 'center';
        }

        setCardPosition({ top, left, placement });
      } else {
        setTargetRect(null);
        setCardPosition({ top: 0, left: 0, placement: 'center' });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isOpen, currentStepData]);

  useEffect(() => {
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [updatePosition]);

  // Handle ESC key and arrow keys
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleCloseTour();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleNextStep();
      } else if (e.key === 'ArrowLeft') {
        handlePrevStep();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStep, currentSteps]);

  if (!isOpen) return null;

  const handleCloseTour = () => {
    if (dontShowAgain) {
      localStorage.setItem('stocksentry_tour_dismissed', 'true');
    }
    onClose(dontShowAgain);
  };

  const handleNextStep = () => {
    if (currentStep < currentSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleCloseTour();
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleRoleChange = (newRoleKey) => {
    setSelectedRole(newRoleKey);
    setCurrentStep(0);
  };

  const StepIcon = currentStepData.icon;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans pointer-events-auto select-none">
      
      {/* Snug, Clean Spotlight Ring */}
      {targetRect && (
        <div 
          className="fixed pointer-events-none transition-all duration-200 ease-out z-50 rounded-xl"
          style={{
            top: `${Math.max(0, targetRect.top - 4)}px`,
            left: `${Math.max(0, targetRect.left - 4)}px`,
            width: `${targetRect.width + 8}px`,
            height: `${targetRect.height + 8}px`,
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.45)',
            border: '2px solid #e20d65'
          }}
        />
      )}

      {/* Light Backdrop for Center Steps */}
      {!targetRect && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-200 z-40"
          onClick={handleCloseTour}
        />
      )}

      {/* Compact Clean Card (Crisp White / Slate / Tata Magenta) */}
      <div 
        ref={cardRef}
        className={`fixed z-50 transition-all duration-150 ease-out flex flex-col ${
          cardPosition.placement === 'center' || !targetRect
            ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-[350px]'
            : 'w-[90vw] max-w-[350px]'
        }`}
        style={
          cardPosition.placement !== 'center' && targetRect
            ? {
                top: `${cardPosition.top}px`,
                left: `${cardPosition.left}px`,
              }
            : undefined
        }
      >
        <div className="rounded-2xl bg-white border border-slate-200/90 shadow-[0_12px_36px_-6px_rgba(0,0,0,0.18),0_0_1px_1px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col font-sans text-slate-800 animate-in fade-in zoom-in-95 duration-150">
          
          {/* Top Role Indicator (Strict Role Locking) */}
          <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Guided Walkthrough</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-purple-100 text-[#1c023d] border border-purple-200">
              {activeRoleData.roleTitle}
            </span>
          </div>

          {/* Segmented Story Progress Bar */}
          <div className="px-3.5 pt-2 pb-1 flex items-center gap-1 w-full bg-white">
            {currentSteps.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setCurrentStep(idx)}
                className={`h-1 flex-1 rounded-full transition-all duration-200 ${
                  idx === currentStep 
                    ? 'bg-[#e20d65]' 
                    : idx < currentStep 
                      ? 'bg-purple-300' 
                      : 'bg-slate-200 hover:bg-slate-300'
                }`}
                title={`Step ${idx + 1}: ${s.badge}`}
              />
            ))}
          </div>

          {/* Header Row */}
          <div className="px-3.5 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg ${currentStepData.iconBg} ${currentStepData.iconColor} border flex items-center justify-center shrink-0 shadow-xs`}>
                <StepIcon className="w-3.5 h-3.5" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 tracking-wider">
                  {currentStepData.badge}
                </span>
                <span className="text-[10px] font-mono text-slate-400 font-bold">
                  {currentStep + 1}/{currentSteps.length}
                </span>
              </div>
            </div>

            {/* Quick Skip Pill */}
            <button
              onClick={handleCloseTour}
              className="text-slate-400 hover:text-slate-700 text-[11px] font-semibold flex items-center gap-0.5 transition px-1.5 py-0.5 rounded hover:bg-slate-100"
              title="Skip Tour anytime (ESC)"
            >
              <span>Skip</span>
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Content Body */}
          <div className="px-3.5 pb-2.5 space-y-1.5">
            <h3 className="text-sm font-bold text-slate-900 leading-snug">
              {currentStepData.title}
            </h3>

            <p className="text-xs text-slate-600 leading-relaxed font-normal">
              {currentStepData.description}
            </p>

            {/* Pro-Tip */}
            {currentStepData.tip && (
              <div className="pt-1 text-[11px] text-[#e20d65] font-medium flex items-center gap-1.5">
                <Lightbulb className="w-3 h-3 text-amber-500 shrink-0" />
                <span className="truncate">{currentStepData.tip}</span>
              </div>
            )}
          </div>

          {/* Controls Footer */}
          <div className="px-3.5 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
            <div>
              {currentStep > 0 && (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="px-2.5 py-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 text-xs font-semibold transition flex items-center gap-1"
                >
                  <ChevronLeft className="w-3 h-3" />
                  <span>Back</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleNextStep}
                className="px-3.5 py-1.5 rounded-lg bg-[#e20d65] hover:bg-[#cc0059] text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1"
              >
                <span>{currentStepData.buttonText}</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Minimalist Bottom Bar */}
          <div className="px-3.5 py-1.5 bg-slate-100/60 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
            <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-600">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-3 h-3 accent-[#e20d65] rounded cursor-pointer"
              />
              <span>Don't show again</span>
            </label>

            <button
              onClick={handleCloseTour}
              className="hover:text-slate-700 underline"
            >
              Exit (ESC)
            </button>
          </div>

        </div>
      </div>

    </div>
  );
};
