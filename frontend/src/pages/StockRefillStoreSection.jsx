import React, { useState } from 'react';
import { 
  ShoppingBag, 
  ShoppingCart, 
  Plus, 
  Minus, 
  CheckCircle2, 
  Trash2, 
  X, 
  Search, 
  Sparkles, 
  Filter, 
  Layers, 
  Package, 
  Tag, 
  ShieldCheck, 
  ArrowRight,
  Zap,
  PackageCheck
} from 'lucide-react';
import api from '../api/client';
import { getProductImage } from '../utils/imageHelper';
import { OrderWorkflowModal } from '../components/OrderWorkflowModal';

export const StockRefillStoreSection = ({ items = [], locations = [], stock = [], currentRole = 'MANAGER', userLocationId, onRequestOrder, refreshTrigger, onNavigateToRequests, onOpenProductModal }) => {
  const [selectedLocationId, setSelectedLocationId] = useState(userLocationId || locations[0]?.location_id || 1);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // State for selected variant per item: { [itemId]: selectedVariantObj }
  const [selectedVariants, setSelectedVariants] = useState({});
  // State for quantities per item: { [itemId]: quantityNumber }
  const [itemQuantities, setItemQuantities] = useState({});

  // Production Order Review Modal State
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [modalSelectedVariantId, setModalSelectedVariantId] = useState(null);
  const [modalSelectedItemId, setModalSelectedItemId] = useState(null);

  // Shopping Cart state: list of cart items [{ variant_id, item_name, variant_name, quantity, unit_cost, imgUrl, item_id }]
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const [loadingVariantId, setLoadingVariantId] = useState(null);
  const [isSubmittingCart, setIsSubmittingCart] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Get active variant for an item (defaults to first variant)
  const getActiveVariant = (item) => {
    if (!item || !item.variants || item.variants.length === 0) return null;
    return selectedVariants[item.item_id] || item.variants[0];
  };

  // Get quantity for an item (defaults to 25)
  const getItemQty = (itemId) => {
    return itemQuantities[itemId] || 25;
  };

  const handleSelectVariant = (itemId, variant) => {
    setSelectedVariants(prev => ({ ...prev, [itemId]: variant }));
  };

  const handleQtyChange = (itemId, newQty) => {
    setItemQuantities(prev => ({ ...prev, [itemId]: Math.max(1, newQty) }));
  };

  // Open Production Order Modal with pre-selected item
  const handleOpenOrderModal = (item, variant) => {
    const activeVar = variant || getActiveVariant(item);
    setModalSelectedItemId(item.item_id);
    setModalSelectedVariantId(activeVar?.variant_id || item.variants?.[0]?.variant_id);
    setIsOrderModalOpen(true);
  };

  const handleModalOrderSubmit = async (payload) => {
    const res = await api.post('/requests', {
      variant_id: payload.variant_id,
      quantity_requested: payload.quantity_requested,
      location_id: payload.location_id || selectedLocationId || userLocationId || 1
    });
    onRequestOrder?.();
    return res.data;
  };

  // Quick Instant Single Item Refill Request (Direct)
  const handleInstantRefill = (item) => {
    handleOpenOrderModal(item);
  };

  // Add Item to Cart
  const handleAddToCart = (item) => {
    const activeVariant = getActiveVariant(item);
    if (!activeVariant) return;

    const qty = getItemQty(item.item_id);
    const imgUrl = getProductImage(item.name);

    setCart(prev => {
      const existingIdx = prev.findIndex(c => c.variant_id === activeVariant.variant_id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx].quantity += qty;
        return updated;
      }
      return [
        ...prev,
        {
          item_id: item.item_id,
          variant_id: activeVariant.variant_id,
          item_name: item.name,
          variant_name: activeVariant.variant_name,
          category: item.category,
          quantity: qty,
          unit_cost: activeVariant.unit_cost || 0,
          imgUrl
        }
      ];
    });

    setSuccessMsg(`Added ${qty}x ${item.name} (${activeVariant.variant_name}) to Cart!`);
    setIsCartOpen(true);
  };

  // Cart operations
  const updateCartQty = (variantId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.variant_id === variantId) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const removeFromCart = (variantId) => {
    setCart(prev => prev.filter(c => c.variant_id !== variantId));
  };

  // Submit all items in Cart
  const handleSubmitCart = async () => {
    if (cart.length === 0) return;
    setIsSubmittingCart(true);
    setSuccessMsg('');

    try {
      await Promise.all(
        cart.map(cartItem =>
          api.post('/requests', {
            variant_id: cartItem.variant_id,
            quantity_requested: cartItem.quantity,
            location_id: selectedLocationId
          })
        )
      );

      setSuccessMsg(`🎉 Successfully submitted batch procurement order for ${cart.length} product(s)!`);
      setCart([]);
      setIsCartOpen(false);
      onRequestOrder?.();
    } catch (err) {
      console.error("Cart submission failed", err);
      alert("Failed to submit batch procurement order.");
    } finally {
      setIsSubmittingCart(false);
    }
  };

  // Filter items
  const categories = ['ALL', 'Apparel', 'Networking', 'Tools & Equipment', 'Cables & Wiring', 'Accessories'];

  const filteredItems = items.filter(item => {
    const matchesCat = categoryFilter === 'ALL' || item.category === categoryFilter;
    const matchesSearch = !searchQuery || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const cartTotalCost = cart.reduce((sum, i) => sum + (i.quantity * i.unit_cost), 0);
  const cartTotalUnits = cart.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="space-y-6 pb-24 font-sans w-full max-w-[1600px] mx-auto">
      
      {/* Header Banner */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-gradient-to-br from-[#e20d65]/10 to-[#6700ce]/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center gap-4 relative z-10">
          <div className="bg-gradient-to-br from-[#e20d65] to-[#cc0059] p-3.5 rounded-xl text-white shadow-md">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-2xl font-black text-[#1c023d] tracking-tight">
                Tata Play Fiber Stock Procurement Store
              </h1>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-pink-100 text-[#e20d65] border border-pink-200">
                Store View
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Interactive E-Commerce catalog for City Managers to order stock refills with photos, variant selectors, and live PO calculation.
            </p>
          </div>
        </div>

        {/* Right Controls: Location Selector & Cart Button */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
            <span className="text-xs font-bold text-slate-600 pl-1">City Hub:</span>
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(parseInt(e.target.value))}
              className="px-3 py-1.5 rounded bg-white border border-slate-300 font-bold text-xs text-[#1c023d] focus:outline-none shadow-2xs"
            >
              {locations.map(loc => (
                <option key={loc.location_id} value={loc.location_id}>{loc.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setIsCartOpen(true)}
            className="px-4 py-2.5 rounded-lg bg-[#1c023d] hover:bg-[#2a045a] text-white font-extrabold text-xs shadow-md transition flex items-center gap-2 relative"
          >
            <ShoppingCart className="w-4 h-4 text-[#e20d65]" />
            <span>My PO Cart</span>
            {cart.length > 0 && (
              <span className="bg-[#e20d65] text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                {cart.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Category Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs scrollbar-none">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3.5 py-2 rounded-lg font-extrabold transition border whitespace-nowrap ${
                categoryFilter === cat
                  ? 'bg-[#1c023d] text-white border-[#1c023d] shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {cat === 'ALL' ? '🛍️ All Products' : 
               cat === 'Apparel' ? '👕 Apparel (T-Shirts)' :
               cat === 'Networking' ? '🌐 Modems & Routers' :
               cat === 'Tools & Equipment' ? '🔧 Splicing Tools' :
               cat === 'Cables & Wiring' ? '🔌 Fiber Cables' : '📎 Accessories'}
            </button>
          ))}
        </div>

        {/* Live Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search products or SKUs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#6700ce]"
          />
        </div>

      </div>

      {/* Distinct Product Box Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
        {filteredItems.map((item) => {
          const activeVariant = getActiveVariant(item);
          const qty = getItemQty(item.item_id);
          const unitCost = activeVariant?.unit_cost || 0;
          const totalCost = qty * unitCost;
          const imgUrl = getProductImage(item.name);
          const isTshirt = item.name.toLowerCase().includes('shirt') || item.category === 'Apparel';

          return (
            <div 
              key={item.item_id} 
              className="bg-white rounded-xl border border-slate-200 shadow-sm hover:border-[#6700ce]/40 transition-all duration-200 flex flex-col justify-between overflow-hidden group hover:shadow-md"
            >
              <div>
                {/* Product Photo Box */}
                <div className="h-52 bg-gradient-to-b from-slate-50 to-slate-100 p-4 border-b border-slate-100 relative flex items-center justify-center overflow-hidden">
                  <span className="absolute top-3 left-3 text-[10px] uppercase font-black tracking-wider text-[#6700ce] bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200 z-10 shadow-2xs">
                    {item.category}
                  </span>

                  {activeVariant && activeVariant.central_stock_qty !== undefined && (
                    <span className={`absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded border z-10 ${
                      activeVariant.central_stock_qty < activeVariant.reorder_threshold
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      Central: {activeVariant.central_stock_qty} in stock
                    </span>
                  )}

                  <img 
                    src={imgUrl} 
                    alt={item.name} 
                    className="h-40 w-auto object-contain transition-transform duration-300 group-hover:scale-105 drop-shadow-sm" 
                  />
                </div>

                {/* Card Title & Info */}
                <div className="p-5 space-y-4">
                  <div>
                    <h3 className="font-extrabold text-[#1c023d] text-lg leading-tight group-hover:text-[#6700ce] transition-colors">
                      {item.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {isTshirt ? "Official Tata Play Fiber Field Sales Crew Apparel" : 
                       item.name.includes("Nokia") ? "Gigabit Dual-Band Wi-Fi 6 Optical Network Terminal" :
                       item.name.includes("Juniper") ? "High-Capacity Enterprise Gateway Router" :
                       item.name.includes("Clamping") ? "Precision Fiber Optical Fusion Splicer & Clamping Unit" :
                       item.name.includes("Cables") ? "Heavy-Duty Low-Attenuation Optical Fiber Cable" :
                       "High-Tensile Nylon Locking Zip Cable Ties"}
                    </p>
                  </div>

                  {/* VARIANT SELECTOR BOX (Size for T-Shirts, Model/Spec for others) */}
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-slate-700">
                        {isTshirt ? "👕 Select Apparel Size:" : "⚙️ Select Model Variant:"}
                      </span>
                      <span className="font-mono font-bold text-[#e20d65]">
                        ₹{unitCost.toLocaleString()} / unit
                      </span>
                    </div>

                    {/* Variant Pills */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {item.variants?.map((v) => {
                        const isSelected = activeVariant?.variant_id === v.variant_id;
                        return (
                          <button
                            key={v.variant_id}
                            type="button"
                            onClick={() => handleSelectVariant(item.item_id, v)}
                            className={`px-3 py-1.5 rounded text-xs font-black transition border ${
                              isSelected
                                ? 'bg-[#6700ce] text-white border-[#6700ce] shadow-2xs scale-105'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            {v.variant_name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* QUANTITY STEPPER & COST CALCULATOR */}
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700">Batch Refill Qty:</span>
                      
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleQtyChange(item.item_id, qty - 10)}
                          className="w-7 h-7 rounded bg-white hover:bg-slate-200 text-slate-800 border border-slate-300 flex items-center justify-center font-bold"
                        >
                          <Minus className="w-3 h-3" />
                        </button>

                        <input
                          type="number"
                          min="1"
                          value={qty}
                          onChange={(e) => handleQtyChange(item.item_id, parseInt(e.target.value) || 1)}
                          className="w-14 text-center py-1 font-mono font-black text-slate-900 bg-white border border-slate-300 rounded text-xs"
                        />

                        <button
                          type="button"
                          onClick={() => handleQtyChange(item.item_id, qty + 10)}
                          className="w-7 h-7 rounded bg-white hover:bg-slate-200 text-slate-800 border border-slate-300 flex items-center justify-center font-bold"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="flex items-center gap-1 text-[10px] font-bold">
                      <span className="text-slate-400">Presets:</span>
                      {[10, 25, 50, 100].map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => handleQtyChange(item.item_id, p)}
                          className={`px-2 py-0.5 rounded border transition ${
                            qty === p 
                              ? 'bg-slate-800 text-white border-slate-800' 
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          +{p}
                        </button>
                      ))}
                    </div>

                    {/* Dynamic Total Price Breakdown */}
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200">
                      <span className="text-slate-500 font-medium">Estimated PO Cost:</span>
                      <span className="font-mono font-black text-[#1c023d] text-base">
                        ₹{totalCost.toLocaleString()}
                      </span>
                    </div>
                  </div>

                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAddToCart(item)}
                  className="flex-1 py-2.5 rounded-lg bg-white hover:bg-slate-100 text-[#1c023d] border border-slate-300 font-extrabold text-xs shadow-2xs transition flex items-center justify-center gap-1.5"
                >
                  <ShoppingCart className="w-3.5 h-3.5 text-[#6700ce]" />
                  <span>Add to Cart</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenOrderModal(item, activeVariant)}
                  className="flex-1 py-2.5 rounded-lg bg-[#e20d65] hover:bg-[#cc0059] text-white font-extrabold text-xs shadow-xs transition flex items-center justify-center gap-1.5"
                >
                  <PackageCheck className="w-3.5 h-3.5" />
                  <span>Order Refill</span>
                </button>
              </div>

            </div>
          );
        })}
      </div>

      {/* SHOPPING CART OVERLAY DRAWER */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end font-sans">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" 
            onClick={() => setIsCartOpen(false)}
          />

          {/* Drawer Container */}
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl z-10 flex flex-col justify-between">
            
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 bg-[#1c023d] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShoppingCart className="w-5 h-5 text-[#e20d65]" />
                <div>
                  <h2 className="font-black text-base">City Procurement Cart</h2>
                  <p className="text-[10px] text-slate-300">Batch Order for {locations.find(l => l.location_id === selectedLocationId)?.name || 'City Hub'}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="w-8 h-8 rounded bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Item List */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-12 text-slate-400 space-y-3">
                  <ShoppingCart className="w-12 h-12 mx-auto text-slate-300" />
                  <p className="text-xs font-bold">Your PO Cart is currently empty.</p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Select apparel sizes or equipment models above and click "Add to Cart" to build a batch stock request.
                  </p>
                </div>
              ) : (
                cart.map((c) => (
                  <div key={c.variant_id} className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 flex items-center gap-3">
                    <img src={c.imgUrl} alt={c.item_name} className="w-14 h-14 object-contain bg-white p-1 rounded border border-slate-200 shrink-0" />
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="font-extrabold text-[#1c023d] text-xs truncate">{c.item_name}</h4>
                      <p className="text-[11px] text-[#e20d65] font-mono font-bold">Variant: {c.variant_name}</p>
                      <p className="text-[11px] font-mono font-bold text-slate-600 mt-0.5">₹{c.unit_cost.toLocaleString()} / unit</p>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded p-0.5">
                        <button 
                          onClick={() => updateCartQty(c.variant_id, -5)}
                          className="w-5 h-5 bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center rounded text-xs font-bold"
                        >
                          -
                        </button>
                        <span className="w-8 text-center text-xs font-mono font-black">{c.quantity}</span>
                        <button 
                          onClick={() => updateCartQty(c.variant_id, 5)}
                          className="w-5 h-5 bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center rounded text-xs font-bold"
                        >
                          +
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-black text-[#1c023d]">₹{(c.quantity * c.unit_cost).toLocaleString()}</span>
                        <button 
                          onClick={() => removeFromCart(c.variant_id)}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Cart Footer Summary & Checkout */}
            {cart.length > 0 && (
              <div className="p-5 border-t border-slate-200 bg-slate-50 space-y-4">
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Total Batch SKUs:</span>
                    <span className="font-bold">{cart.length} item types</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Total Units Requested:</span>
                    <span className="font-bold">{cartTotalUnits} units</span>
                  </div>
                  <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-200 font-extrabold text-[#1c023d]">
                    <span>Grand Estimated PO Cost:</span>
                    <span className="font-mono text-base font-black text-[#e20d65]">₹{cartTotalCost.toLocaleString()}</span>
                  </div>
                </div>

                <button
                  onClick={handleSubmitCart}
                  disabled={isSubmittingCart}
                  className="w-full py-3 rounded-lg bg-[#e20d65] hover:bg-[#cc0059] text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmittingCart ? 'Submitting Batch PO...' : `Submit Batch Procurement Order (₹${cartTotalCost.toLocaleString()})`}</span>
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Production Procurement Order Workflow Modal */}
      <OrderWorkflowModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        onSubmit={handleModalOrderSubmit}
        initialVariantId={modalSelectedVariantId}
        initialItemId={modalSelectedItemId}
        items={items}
        locations={locations}
        stock={stock}
        currentRole={currentRole}
        currentLocationId={selectedLocationId || userLocationId || 1}
        onNavigateToTracking={() => {
          setIsOrderModalOpen(false);
          if (onNavigateToRequests) onNavigateToRequests();
          else onRequestOrder?.();
        }}
      />

    </div>
  );
};
