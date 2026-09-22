import React, { useState, useEffect } from 'react';
import { 
  X, Package, ShieldCheck, Cpu, CheckCircle2, AlertTriangle, 
  Wrench, ExternalLink, Hash, ArrowRight, Layers, Tag, Truck,
  Star, Award, Check, FileText, Info, Shield, HelpCircle,
  Copy, Barcode, QrCode, Sparkles, Box
} from 'lucide-react';
import api from '../api/client';

export const ProductDetailModal = ({ isOpen = true, onClose, item, onNavigateToLifecycle }) => {
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [assets, setAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [searchSerial, setSearchSerial] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [copiedSerial, setCopiedSerial] = useState('');

  useEffect(() => {
    if (item && item.variants && item.variants.length > 0) {
      setSelectedVariant(item.variants[0]);
    }
  }, [item]);

  useEffect(() => {
    if (selectedVariant && item?.is_serialized) {
      fetchVariantAssets(selectedVariant.variant_id);
    }
  }, [selectedVariant]);

  const fetchVariantAssets = async (variantId) => {
    setLoadingAssets(true);
    try {
      const res = await api.get(`/inventory/variants/${variantId}/assets`);
      setAssets(res.data);
    } catch (err) {
      console.error('Failed to fetch asset units:', err);
    } finally {
      setLoadingAssets(false);
    }
  };

  if (!isOpen || !item) return null;

  const filteredAssets = assets.filter(a => {
    const matchesSearch = 
      a.serial_number.toLowerCase().includes(searchSerial.toLowerCase()) ||
      (a.current_holder_name && a.current_holder_name.toLowerCase().includes(searchSerial.toLowerCase())) ||
      (a.location_name && a.location_name.toLowerCase().includes(searchSerial.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'IN_WAREHOUSE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">Central Warehouse</span>;
      case 'DISPATCHED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-sky-50 text-sky-700 border border-sky-200">In Transit</span>;
      case 'ASSIGNED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-purple-50 text-purple-700 border border-purple-200">Assigned Tech</span>;
      case 'IN_REPAIR':
        return <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200">In Repair Facility</span>;
      case 'DECOMMISSIONED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-50 text-rose-700 border border-rose-200">Scrapped</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-100 text-slate-700 border border-slate-200">{status}</span>;
    }
  };

  // Generate category-specific Amazon-style bullet points
  const getAboutThisItemBullets = (cat, name) => {
    const n = (name || '').toLowerCase();
    const c = (cat || '').toLowerCase();

    if (c.includes('modem') || n.includes('modem') || n.includes('nokia') || n.includes('juniper') || c.includes('ont')) {
      return [
        "Ultra-High Throughput Wi-Fi 6: Dual-band concurrent speeds up to 2.4 Gbps supporting up to 128 simultaneous subscriber devices with zero latency jitter.",
        "Carrier-Grade Fiber Uplink: 1x GPON SC/APC optical interface with 2.5 Gbps downstream / 1.25 Gbps upstream bandwidth for high-speed FTTH connections.",
        "Enterprise Gigabit Switching: 4x Gigabit Auto-MDI/MDIX Ethernet ports delivering full wire-speed backplane switching for home labs and business premises.",
        "Zero-Touch Remote Provisioning: Certified TR-069, TR-181, and OMCI protocol compliance for instant remote configuration and automated firmware updates.",
        "QoS Traffic Optimization: Dedicated VoIP FXS port with carrier-grade SIP stack and automatic voice packet prioritization."
      ];
    } else if (c.includes('splicer') || n.includes('splicer') || n.includes('clamping') || c.includes('tool')) {
      return [
        "Core-Alignment Precision Splicing: State-of-the-art 6-motor core-to-core alignment system delivering ultra-low splice loss of <0.02 dB on single-mode fiber.",
        "Lightning-Fast Operations: 6-second ultra-fast splicing time combined with a 15-second rapid automated thermal shrink heating cycle.",
        "Dual CMOS Optical Inspection: High-resolution dual cameras with 300x magnification providing crystal-clear visualization of fiber cleave angles and cores.",
        "High-Capacity Hot-Swappable Battery: 5,200 mAh lithium-ion power cell providing over 280 continuous splice and heat cycles on a single charge.",
        "Rugged Field Durability: IP52 water and dust-resistant chassis engineered to withstand 76cm drops onto concrete in harsh field environments."
      ];
    } else if (c.includes('cable') || n.includes('cable') || n.includes('fiber')) {
      return [
        "Bend-Insensitive Optical Core: Premium G.657.A2 single-mode optical glass enabling tight 7.5mm routing radius without signal attenuation.",
        "Heavy-Duty Armored Protection: High-tensile FRP (Fiber Reinforced Plastic) strength rods resisting up to 1,000N mechanical pulling tension.",
        "LSZH Flame-Retardant Sheath: Low Smoke Zero Halogen outer jacket engineered for indoor subscriber drops and outdoor overhead installations.",
        "Sequential Meter-Marked Jacket: High-visibility durable white metric markings every 1 meter for precise cable measurement and rapid deployment.",
        "All-Weather UV Resistance: Black high-density polyethylene coating formulated to resist solar UV degradation and temperature extremes from -20°C to +70°C."
      ];
    }

    // Default enterprise equipment
    return [
      "Certified Tata Play Fiber Standard: 100% compliant with national telecommunication distribution specifications and field safety standards.",
      "End-to-End Serial Number Asset Tracking: Every unit is laser-etched with unique alphanumeric serial numbers and GS1-compliant QR barcodes.",
      "Commercial Grade Reliability: Engineered for 24/7 continuous operation with comprehensive surge suppression and thermal dissipation.",
      "Seamless Hub Interchangeability: Standardized connectors and pinouts ensure cross-compatibility across all regional city warehouses.",
      "Comprehensive Enterprise Warranty: Backed by Tata Play Fiber 1-Year Next-Business-Day hub replacement guarantee."
    ];
  };

  const bullets = getAboutThisItemBullets(item.category, item.name);
  const unitCost = selectedVariant?.unit_cost || 0;
  const mrpCost = Math.round(unitCost * 1.25);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedSerial(text);
    setTimeout(() => setCopiedSerial(''), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-xs animate-fade-in font-sans overflow-y-auto">
      <div className="bg-white border border-slate-300 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col my-auto">
        
        {/* Amazon-Style Top Bar Navigation */}
        <div className="bg-[#1c023d] text-white px-5 py-3 flex items-center justify-between border-b border-purple-900 shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-purple-300 font-bold">Catalog</span>
            <span className="text-slate-400">›</span>
            <span className="text-purple-200 font-semibold">{item.category}</span>
            <span className="text-slate-400">›</span>
            <span className="font-mono text-[11px] text-amber-300 bg-amber-400/20 px-1.5 py-0.2 rounded">
              SKU #{item.item_id ? `TPF-${item.category?.slice(0,3).toUpperCase()}-${item.item_id.toString().padStart(4, '0')}` : 'TPF-PRD-0001'}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-slate-300 hover:text-white hover:bg-white/10 transition rounded"
            title="Close Product Page"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Product Details Content */}
        <div className="overflow-y-auto p-5 sm:p-7 space-y-7 flex-1">
          
          {/* ================= HERO SECTION (Image + Amazon Product Info) ================= */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            
            {/* Left Column (5 cols): Product Visual Gallery */}
            <div className="md:col-span-5 space-y-4">
              {/* Main Product Frame */}
              <div className="border border-slate-200 p-6 bg-slate-50/50 flex flex-col items-center justify-center relative min-h-[280px]">
                {/* Amazon Choice / Enterprise Badge */}
                <div className="absolute top-3 left-3 flex flex-col gap-1">
                  <span className="bg-[#1c023d] text-white text-[10px] font-black uppercase px-2 py-0.5 tracking-wider inline-flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5 text-[#e20d65]" />
                    Tata Play Choice
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold">for "{item.category}"</span>
                </div>

                <img
                  src={item.image_url || '/assets/modem_nokia.png'}
                  alt={item.name}
                  className="w-56 h-56 object-contain transition-transform duration-300 hover:scale-105"
                  onError={(e) => {
                    // Fallback to stylized SVG placeholder if asset missing
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />

                <div style={{ display: 'none' }} className="w-56 h-56 items-center justify-center bg-purple-50 text-[#6700ce] flex-col gap-2">
                  <Box className="w-16 h-16 text-[#e20d65]" />
                  <span className="text-xs font-bold font-mono text-slate-600">Enterprise Hardware</span>
                </div>

                <div className="absolute bottom-2 right-2 text-[10px] font-mono text-slate-400 bg-white/80 px-1.5 py-0.5 border border-slate-200">
                  100% Genuine Certified
                </div>
              </div>

              {/* Warranty & Assurance Ribbon */}
              <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                <div className="p-2 border border-slate-200 bg-slate-50">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 mx-auto mb-0.5" />
                  <span className="font-bold text-slate-700 block">1-Year Warranty</span>
                  <span className="text-slate-400 text-[9px]">Hub Replacement</span>
                </div>

                <div className="p-2 border border-slate-200 bg-slate-50">
                  <Truck className="w-4 h-4 text-indigo-600 mx-auto mb-0.5" />
                  <span className="font-bold text-slate-700 block">Fast Dispatch</span>
                  <span className="text-slate-400 text-[9px]">Next-Day Hub PO</span>
                </div>

                <div className="p-2 border border-slate-200 bg-slate-50">
                  <QrCode className="w-4 h-4 text-purple-600 mx-auto mb-0.5" />
                  <span className="font-bold text-slate-700 block">Serial Tracked</span>
                  <span className="text-slate-400 text-[9px]">100% Custody</span>
                </div>
              </div>
            </div>

            {/* Right Column (7 cols): Amazon Title, Price, Variants, and Bullets */}
            <div className="md:col-span-7 space-y-4">
              
              {/* Product Header */}
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Brand: Tata Play Fiber Enterprise Equipment
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-[#1c023d] mt-1 leading-snug">
                  {item.name}
                </h1>

                {/* Rating Stars & Customer Ratings */}
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center text-amber-500">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  </div>
                  <span className="text-xs font-bold text-slate-700">4.9 out of 5</span>
                  <span className="text-xs text-slate-400">|</span>
                  <span className="text-xs text-[#6700ce] hover:underline font-semibold cursor-pointer">
                    184 verified enterprise deployments
                  </span>
                </div>
              </div>

              {/* Price & Valuation Box */}
              <div className="p-3.5 bg-slate-50 border-y border-slate-200 space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-rose-600 font-extrabold">-20%</span>
                  <span className="text-2xl font-black text-[#1c023d] font-mono">
                    ₹{unitCost.toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs text-slate-400 line-through">
                    M.R.P.: ₹{mrpCost.toLocaleString('en-IN')}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  Inclusive of all GST taxes. Enterprise Procurement Order eligible.
                </p>
                <div className="flex items-center gap-2 pt-1 text-xs">
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 border border-emerald-200">
                    ✓ In Stock at Central Warehouse: <strong className="font-mono">{selectedVariant?.available_units_count ?? selectedVariant?.central_stock_qty ?? 0} units</strong>
                  </span>
                  <span className="text-slate-400 text-[10px]">Reorder Threshold: {selectedVariant?.reorder_threshold || 10}</span>
                </div>
              </div>

              {/* Variant / SKU Selection */}
              {item.variants && item.variants.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-black text-[#1c023d] uppercase tracking-wider block">
                    Available SKU Configurations / Variants:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {item.variants.map((v) => (
                      <button
                        key={v.variant_id}
                        onClick={() => setSelectedVariant(v)}
                        className={`px-3 py-2 text-xs font-bold border transition text-left ${
                          selectedVariant?.variant_id === v.variant_id
                            ? 'bg-[#1c023d] text-white border-[#1c023d] shadow-sm'
                            : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{v.variant_name}</span>
                          {selectedVariant?.variant_id === v.variant_id && (
                            <Check className="w-3.5 h-3.5 text-[#e20d65]" />
                          )}
                        </div>
                        <span className="text-[11px] font-mono opacity-80 block mt-0.5">
                          ₹{v.unit_cost?.toLocaleString('en-IN')}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Amazon "About this item" Feature Bullets */}
              <div className="space-y-2 pt-2">
                <h3 className="text-sm font-black text-[#1c023d] uppercase tracking-wider">
                  About this item
                </h3>
                <ul className="space-y-2 text-xs text-slate-700">
                  {bullets.map((bullet, idx) => (
                    <li key={idx} className="flex items-start gap-2 leading-relaxed">
                      <span className="text-[#e20d65] font-black text-sm leading-none mt-0.5">•</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>
          </div>

          {/* ================= AMAZON SPECIFICATIONS TABLE ================= */}
          <div className="border border-slate-200 p-5 bg-white space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <h3 className="text-sm font-black text-[#1c023d] uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#6700ce]" />
                Technical Specifications & Product Details
              </h3>
              <span className="text-[11px] text-slate-400 font-mono">Document Spec: TPF-STD-REV4</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-bold">Manufacturer / OEM</span>
                <span className="text-slate-900 font-semibold">Tata Play Fiber Certified Partner</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-bold">Inventory Classification</span>
                <span className="text-slate-900 font-semibold">{item.is_serialized ? 'Serialized Capital Asset (Individual Unit Barcode)' : 'Bulk Non-Serialized Consumable'}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-bold">Standard SKU Code</span>
                <span className="font-mono font-bold text-[#e20d65]">TPF-SKU-{item.item_id ? item.item_id.toString().padStart(4, '0') : '0001'}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-bold">Optical / Hardware Standard</span>
                <span className="text-slate-900 font-semibold">ITU-T G.984 / IEEE 802.3ah Compliant</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-bold">Operating Temperature</span>
                <span className="text-slate-900 font-semibold">-10°C to +55°C (Ambient Field Grade)</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-bold">Regulatory Certifications</span>
                <span className="text-slate-900 font-semibold">TEC (DoT India), CE, RoHS 2.0</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-bold">Country of Origin</span>
                <span className="text-slate-900 font-semibold">India</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-bold">Warranty Coverage</span>
                <span className="text-slate-900 font-semibold">12 Months Comprehensive Replacement</span>
              </div>
            </div>

            {/* "What's in the Box" checklist */}
            <div className="pt-3 border-t border-slate-100">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-2">
                What's in the box:
              </h4>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 font-medium">
                  ✓ 1x {item.name} Main Unit
                </span>
                <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 font-medium">
                  ✓ High-Efficiency AC Power Adapter
                </span>
                <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 font-medium">
                  ✓ Optical Cleaning Kit & Lens Cover
                </span>
                <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 font-medium">
                  ✓ Field Deployment & Safety Guide
                </span>
                <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 font-medium">
                  ✓ Serialized Calibration Certificate
                </span>
              </div>
            </div>
          </div>

          {/* ================= SERIALIZED ASSET REGISTER (If Serialized) ================= */}
          {item.is_serialized && (
            <div className="border border-slate-200 p-5 bg-white space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <h4 className="text-sm font-black text-[#1c023d] flex items-center gap-2">
                    <Hash className="w-4 h-4 text-[#e20d65]" />
                    Individual Unit Serial Register ({filteredAssets.length} Tracked Units)
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Every individual device carries a unique hardware serial. Click any serial number to inspect its complete lifecycle timeline.
                  </p>
                </div>

                {/* Search & Status Filter */}
                <div className="flex items-center gap-2 text-xs">
                  <input
                    type="text"
                    value={searchSerial}
                    onChange={(e) => setSearchSerial(e.target.value)}
                    placeholder="Search serial, technician, or city..."
                    className="px-3 py-1.5 border border-slate-300 bg-slate-50 text-slate-900 focus:outline-none focus:border-[#6700ce] w-48 text-xs"
                  />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-2.5 py-1.5 border border-slate-300 bg-slate-50 text-slate-800 font-bold focus:outline-none text-xs"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="IN_WAREHOUSE">In Warehouse</option>
                    <option value="ASSIGNED">Assigned to Tech</option>
                    <option value="IN_REPAIR">In Repair Facility</option>
                    <option value="DECOMMISSIONED">Scrapped</option>
                  </select>
                </div>
              </div>

              {/* Table of Assets */}
              <div className="overflow-x-auto max-h-60 border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Serial Number</th>
                      <th className="py-2.5 px-3">Lifecycle Status</th>
                      <th className="py-2.5 px-3">Current Location / Hub</th>
                      <th className="py-2.5 px-3">Assigned Holder</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {loadingAssets ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400">
                          Loading unit serial registers...
                        </td>
                      </tr>
                    ) : filteredAssets.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400">
                          No asset units match the serial query or filter.
                        </td>
                      </tr>
                    ) : (
                      filteredAssets.map((asset) => (
                        <tr key={asset.asset_id} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-3 font-mono font-bold text-[#1c023d] flex items-center gap-1.5">
                            <span>{asset.serial_number}</span>
                            <button
                              onClick={() => copyToClipboard(asset.serial_number)}
                              className="text-slate-400 hover:text-slate-700"
                              title="Copy serial number"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            {copiedSerial === asset.serial_number && (
                              <span className="text-[10px] text-emerald-600 font-bold">Copied!</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            {getStatusBadge(asset.status)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">
                            {asset.location_name || 'Central Warehouse (National Repo)'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {asset.current_holder_name ? (
                              <span className="font-bold text-slate-800">{asset.current_holder_name}</span>
                            ) : (
                              <span className="text-slate-400 italic">Unassigned (In Depot)</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {onNavigateToLifecycle ? (
                              <button
                                onClick={() => {
                                  onClose();
                                  onNavigateToLifecycle(asset.serial_number);
                                }}
                                className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-[#6700ce] border border-purple-200 text-[11px] font-bold transition flex items-center gap-1 mx-auto"
                              >
                                <span>Lifecycle</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            ) : (
                              <span className="font-mono text-slate-400">#{asset.asset_id}</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
          <div className="text-slate-500 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Tata Play Fiber Enterprise Procurement & Asset Serialization Protocol</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition"
          >
            Close Window
          </button>
        </div>

      </div>
    </div>
  );
};
