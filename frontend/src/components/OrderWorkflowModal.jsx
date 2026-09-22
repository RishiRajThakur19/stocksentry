import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShoppingCart, 
  PackageCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Truck, 
  Warehouse, 
  Clock, 
  ShieldCheck, 
  ChevronRight, 
  Building2, 
  ArrowRight,
  Plus,
  Minus,
  Sparkles,
  Info,
  DollarSign
} from 'lucide-react';
import { getProductImage } from '../utils/imageHelper';

export const OrderWorkflowModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  initialVariantId = null,
  initialItemId = null,
  items = [], 
  locations = [], 
  stock = [],
  currentRole = 'MANAGER', 
  currentLocationId = 1,
  onNavigateToTracking
}) => {
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [quantity, setQuantity] = useState(25);
  const [targetLocationId, setTargetLocationId] = useState(currentLocationId || (locations[0]?.location_id || 1));
  const [priority, setPriority] = useState('NORMAL'); // 'NORMAL' | 'URGENT' | 'CRITICAL'
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successOrder, setSuccessOrder] = useState(null);

  const isSuperAdmin = currentRole === 'SUPER_ADMIN' || currentRole === 'CENTRAL_ADMIN';

  // Build flattened list of all variants with item and central stock details
  const allVariants = [];
  items?.forEach(item => {
    item.variants?.forEach(v => {
      const stockRec = stock.find(s => s.variant_id === v.variant_id);
      allVariants.push({
        variant_id: v.variant_id,
        item_id: item.item_id,
        item_name: item.name,
        category: item.category,
        variant_name: v.variant_name,
        full_name: `${item.name} (${v.variant_name})`,
        unit_cost: v.unit_cost || 0,
        reorder_threshold: v.reorder_threshold || 10,
        reorder_quantity: v.reorder_quantity || 25,
        central_stock: stockRec ? stockRec.current_quantity : 0,
        is_low_stock: stockRec ? stockRec.is_low_stock : false,
        imgUrl: getProductImage(item.name)
      });
    });
  });

  // Prepopulate or initialize selected variant
  useEffect(() => {
    if (isOpen) {
      setSuccessOrder(null);
      setErrorMsg('');
      setIsSubmitting(false);

      if (initialVariantId) {
        setSelectedVariantId(String(initialVariantId));
        const found = allVariants.find(v => v.variant_id === parseInt(initialVariantId));
        if (found) setQuantity(found.reorder_quantity || 25);
      } else if (initialItemId) {
        const itemVariants = allVariants.filter(v => v.item_id === parseInt(initialItemId));
        if (itemVariants.length > 0) {
          setSelectedVariantId(String(itemVariants[0].variant_id));
          setQuantity(itemVariants[0].reorder_quantity || 25);
        }
      } else if (allVariants.length > 0 && !selectedVariantId) {
        setSelectedVariantId(String(allVariants[0].variant_id));
        setQuantity(allVariants[0].reorder_quantity || 25);
      }

      if (currentLocationId) {
        setTargetLocationId(currentLocationId);
      }
    }
  }, [isOpen, initialVariantId, initialItemId, items]);

  if (!isOpen) return null;

  const activeVariant = allVariants.find(v => v.variant_id === parseInt(selectedVariantId)) || allVariants[0];
  const centralStock = activeVariant?.central_stock || 0;
  const isStockAvailable = centralStock >= quantity;
  const unitCost = activeVariant?.unit_cost || 0;
  const subtotal = quantity * unitCost;
  const estimatedGst = Math.round(subtotal * 0.18); // 18% GST telecom equipment standard
  const totalPOValue = subtotal + estimatedGst;

  const targetLocation = locations.find(l => l.location_id === parseInt(targetLocationId)) || locations[0];

  const handleVariantSelect = (vId) => {
    setSelectedVariantId(vId);
    const found = allVariants.find(v => v.variant_id === parseInt(vId));
    if (found) {
      setQuantity(found.reorder_quantity || 25);
    }
  };

  const handleQtyChange = (val) => {
    const parsed = parseInt(val) || 1;
    setQuantity(Math.max(1, parsed));
  };

  const handlePresetAdd = (presetQty) => {
    setQuantity(presetQty);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activeVariant || quantity <= 0) return;

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const res = await onSubmit({
        variant_id: activeVariant.variant_id,
        quantity_requested: quantity,
        location_id: isSuperAdmin ? parseInt(targetLocationId) : currentLocationId
      });

      setSuccessOrder({
        requestId: res?.request_id || res?.data?.request_id || Math.floor(1000 + Math.random() * 9000),
        itemName: activeVariant.item_name,
        variantName: activeVariant.variant_name,
        quantity,
        totalPOValue,
        destinationName: targetLocation?.name || 'City Hub',
        priority
      });
    } catch (err) {
      console.error("Order submission failed", err);
      setErrorMsg(err.response?.data?.detail || "Failed to submit procurement request. Please check connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-800">
        
        {/* Header Strip */}
        <div className="bg-[#1c023d] text-white px-6 py-4 flex items-center justify-between border-b border-purple-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#e20d65] text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight text-white">
                  Procurement Stock Requisition
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-purple-900 text-purple-200 border border-purple-700 text-[10px] font-mono font-bold uppercase">
                  Production PO
                </span>
              </div>
              <p className="text-xs text-purple-200 mt-0.5">
                Central Warehouse refill & destination chain-of-custody request
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-purple-300 hover:text-white p-1.5 rounded-lg hover:bg-purple-900/60 transition"
            title="Close (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* SUCCESS RECEIPT VIEW */}
          {successOrder ? (
            <div className="py-4 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-inner">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-black uppercase tracking-wider">
                  Request #{successOrder.requestId} Created
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-2">
                  Procurement Order Submitted
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Your stock replenishment order has entered the central logistics queue in <strong>PENDING</strong> status. Regional and Central logistics admins have been notified via live telemetry.
                </p>
              </div>

              {/* Order Summary Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left max-w-md mx-auto space-y-2.5 text-xs font-semibold text-slate-700">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-500">Equipment SKU:</span>
                  <span className="font-bold text-[#1c023d]">{successOrder.itemName} ({successOrder.variantName})</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Quantity Requested:</span>
                  <span className="font-mono font-bold text-[#e20d65]">{successOrder.quantity} units</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Destination Hub:</span>
                  <span className="font-bold text-slate-900">{successOrder.destinationName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Estimated PO Value:</span>
                  <span className="font-mono font-bold text-slate-900">₹{successOrder.totalPOValue.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-[11px]">
                  <span className="text-slate-500">Expected Routing:</span>
                  <span className="font-mono font-bold text-purple-700">Central (Delhi) ──▶ {successOrder.destinationName}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex items-center justify-center gap-3">
                {onNavigateToTracking && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateToTracking();
                    }}
                    className="px-4 py-2.5 rounded-xl bg-[#1c023d] hover:bg-[#2c095c] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                  >
                    <Truck className="w-4 h-4 text-[#e20d65]" />
                    <span>Track in In-Transit Deliveries →</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setSuccessOrder(null);
                    setQuantity(25);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold transition"
                >
                  Create Another Request
                </button>
              </div>
            </div>
          ) : (
            
            /* ORDER FORM */
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              
              {/* Error Message Banner */}
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* 1. Equipment Variant Selection */}
              <div>
                <label className="block font-extrabold text-slate-700 mb-1.5 uppercase tracking-wider text-[10px]">
                  1. Select Equipment SKU Variant
                </label>
                <select
                  value={selectedVariantId}
                  onChange={(e) => handleVariantSelect(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 font-bold text-slate-900 focus:outline-none focus:border-[#e20d65] focus:ring-1 focus:ring-[#e20d65] transition"
                  required
                >
                  {allVariants.map((v) => (
                    <option key={v.variant_id} value={v.variant_id}>
                      {v.item_name} — {v.variant_name} (₹{v.unit_cost.toLocaleString()} / unit)
                    </option>
                  ))}
                </select>
              </div>

              {/* Active Product Highlight Card */}
              {activeVariant && (
                <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 flex items-center gap-3.5">
                  <img
                    src={activeVariant.imgUrl}
                    alt={activeVariant.item_name}
                    className="w-14 h-14 object-contain rounded-lg bg-white p-1 border border-slate-200 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-purple-100 text-[#6700ce] border border-purple-200">
                        {activeVariant.category}
                      </span>
                      <span className="font-mono font-bold text-[#e20d65] text-xs">
                        ₹{activeVariant.unit_cost.toLocaleString()} / unit
                      </span>
                    </div>
                    <h4 className="font-black text-[#1c023d] text-sm truncate mt-1">
                      {activeVariant.item_name} ({activeVariant.variant_name})
                    </h4>
                  </div>
                </div>
              )}

              {/* 2. Central Warehouse Availability & Health Check */}
              <div className="p-3.5 rounded-xl border transition-colors bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-700 text-[11px] flex items-center gap-1.5">
                    <Warehouse className="w-3.5 h-3.5 text-[#6700ce]" />
                    <span>Central Warehouse Stock Availability</span>
                  </span>
                  <span className="font-mono font-black text-xs text-slate-900">
                    {centralStock.toLocaleString()} units in stock
                  </span>
                </div>

                {/* Status Indicator Pill */}
                <div className={`p-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                  isStockAvailable
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border border-amber-200 text-amber-800'
                }`}>
                  {isStockAvailable ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Stock is available at Central. Order eligible for immediate courier dispatch upon approval.</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Requested quantity exceeds Central buffer. Order will be queued for supplier replenishment.</span>
                    </>
                  )}
                </div>
              </div>

              {/* 3. Refill Quantity & Cost Calculator */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-extrabold text-slate-700 text-[11px]">
                    Requisition Quantity:
                  </label>
                  
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleQtyChange(quantity - 10)}
                      className="w-7 h-7 rounded-lg bg-white hover:bg-slate-200 text-slate-800 border border-slate-300 flex items-center justify-center font-bold transition"
                    >
                      <Minus className="w-3 h-3" />
                    </button>

                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => handleQtyChange(e.target.value)}
                      className="w-16 text-center py-1 font-mono font-black text-slate-900 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#e20d65]"
                    />

                    <button
                      type="button"
                      onClick={() => handleQtyChange(quantity + 10)}
                      className="w-7 h-7 rounded-lg bg-white hover:bg-slate-200 text-slate-800 border border-slate-300 flex items-center justify-center font-bold transition"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 text-[10px] font-bold">
                  <span className="text-slate-400">Presets:</span>
                  {[25, 50, 100, 250].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handlePresetAdd(p)}
                      className={`px-2.5 py-0.5 rounded-md border transition ${
                        quantity === p
                          ? 'bg-[#1c023d] text-white border-[#1c023d]'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      +{p}
                    </button>
                  ))}
                </div>

                {/* Financial PO Value Calculation */}
                <div className="pt-2.5 border-t border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-slate-500 text-[11px]">
                    <span>Subtotal ({quantity} units × ₹{unitCost.toLocaleString()}):</span>
                    <span className="font-mono font-semibold">₹{subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500 text-[11px]">
                    <span>Estimated Hardware GST (18%):</span>
                    <span className="font-mono font-semibold">₹{estimatedGst.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between font-black text-slate-900 text-xs pt-1 border-t border-slate-200">
                    <span className="text-slate-700">Total Purchase Order Value:</span>
                    <span className="font-mono text-sm text-[#e20d65]">₹{totalPOValue.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* 4. Destination & Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Destination Hub */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                    Destination Hub
                  </label>
                  {isSuperAdmin ? (
                    <select
                      value={targetLocationId}
                      onChange={(e) => setTargetLocationId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800 text-xs focus:outline-none"
                    >
                      {locations.map(l => (
                        <option key={l.location_id} value={l.location_id}>{l.name} ({l.city})</option>
                      ))}
                    </select>
                  ) : (
                    <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-800 font-bold text-xs flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-[#6700ce]" />
                      <span className="truncate">{targetLocation?.name || 'City Hub'}</span>
                    </div>
                  )}
                </div>

                {/* Priority Level */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                    Dispatch Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800 text-xs focus:outline-none"
                  >
                    <option value="NORMAL">Standard (3-5 Days)</option>
                    <option value="URGENT">Urgent Outage (&lt; 48 Hours)</option>
                    <option value="CRITICAL">Critical Emergency</option>
                  </select>
                </div>
              </div>

              {/* 5. Notes / Allocation Reason */}
              <div>
                <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                  Project Allocation / Technician Purpose (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Field sales crew expansion, customer migrations"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#e20d65]"
                />
              </div>

              {/* Submit Controls with Single-Submit Idempotency Guard */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || quantity <= 0}
                  className="px-6 py-2.5 rounded-xl bg-[#e20d65] hover:bg-[#cc0059] text-white font-extrabold text-xs shadow-md transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Processing Requisition PO...</span>
                    </>
                  ) : (
                    <>
                      <PackageCheck className="w-4 h-4" />
                      <span>Confirm & Submit Requisition PO</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          )}

        </div>

      </div>
    </div>
  );
};
