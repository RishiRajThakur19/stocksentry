import React, { useState } from 'react';
import { X, Plus, Package, Upload, CheckCircle2, DollarSign, Layers, Link as LinkIcon } from 'lucide-react';
import api from '../api/client';

export const CreateProductModal = ({ isOpen, onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Networking');
  const [selectedPhoto, setSelectedPhoto] = useState('/assets/modem_nokia.png');
  const [customPhotoUrl, setCustomPhotoUrl] = useState('');
  const [useCustomPhoto, setUseCustomPhoto] = useState(false);

  const [variantName, setVariantName] = useState('Standard Unit');
  const [unitCost, setUnitCost] = useState(3500);
  const [reorderThreshold, setReorderThreshold] = useState(10);
  const [reorderQuantity, setReorderQuantity] = useState(25);
  
  const [initialStockDelhi, setInitialStockDelhi] = useState(50);
  const [initialStockMumbai, setInitialStockMumbai] = useState(50);
  const [initialStockBangalore, setInitialStockBangalore] = useState(50);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const photoOptions = [
    { label: 'Nokia Wi-Fi 6 Modem', url: '/assets/modem_nokia.png' },
    { label: 'Juniper Gateway Router', url: '/assets/modem_juniper.png' },
    { label: 'Fiber Clamping Machine', url: '/assets/clamping_machine.png' },
    { label: 'Fiber Optic Cables', url: '/assets/cables.png' },
    { label: 'Cable Zip Ties Pack', url: '/assets/ties.png' },
    { label: 'Security Camera', url: '/assets/camera.png' },
    { label: 'Tata Play Apparel T-Shirt', url: '/assets/tshirt.png' },
  ];

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomPhotoUrl(reader.result);
        setUseCustomPhoto(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('Product name is required.');
      return;
    }

    const finalPhoto = useCustomPhoto ? (customPhotoUrl || '/assets/modem_nokia.png') : selectedPhoto;

    setLoading(true);

    try {
      await api.post('/inventory/items', {
        name: name,
        category: category,
        image_url: finalPhoto,
        variants: [
          {
            variant_name: variantName,
            unit_cost: parseFloat(unitCost),
            reorder_threshold: parseInt(reorderThreshold),
            reorder_quantity: parseInt(reorderQuantity),
            initial_stock_delhi: parseInt(initialStockDelhi),
            initial_stock_mumbai: parseInt(initialStockMumbai),
            initial_stock_bangalore: parseInt(initialStockBangalore)
          }
        ]
      });

      onSuccess?.();
      onClose();
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Failed to create product.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto font-sans">
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-[#1c023d] text-white flex items-center justify-center font-bold">
              <Package className="w-5 h-5 text-[#e20d65]" />
            </div>
            <div>
              <h2 className="text-lg font-black text-[#1c023d]">Create New Inventory Product</h2>
              <p className="text-xs text-slate-500">Add a new SKU product item with photo upload or preset selection, cost thresholds, and hub stock.</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition min-h-[44px]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          {/* Section 1: Basic Product Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Product Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Fiber Clamping Machine / Nokia Modem"
                className="w-full px-3.5 py-2.5 rounded bg-white border border-slate-300 text-slate-900 font-semibold focus:outline-none focus:border-[#e20d65]"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded bg-white border border-slate-300 text-slate-900 font-semibold focus:outline-none focus:border-[#e20d65]"
              >
                <option value="Networking">Networking (Modems, Routers, ONTs)</option>
                <option value="Tools & Equipment">Tools & Equipment (Clamping Machines, Splicers)</option>
                <option value="Cables & Wiring">Cables & Wiring (Fiber Optic Rolls, Drums)</option>
                <option value="Accessories">Accessories (Zip Ties, Connectors)</option>
                <option value="Security">Security (CCTV, Smart Cameras)</option>
                <option value="Apparel">Apparel (Technician Uniforms, T-Shirts)</option>
              </select>
            </div>
          </div>

          {/* Section 2: Photo Selection / Upload */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-slate-700 font-bold">Product Photo Thumbnail *</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUseCustomPhoto(false)}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${!useCustomPhoto ? 'bg-[#6700ce] text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  Presets
                </button>
                <button
                  type="button"
                  onClick={() => setUseCustomPhoto(true)}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${useCustomPhoto ? 'bg-[#6700ce] text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  Custom Upload / URL
                </button>
              </div>
            </div>

            {!useCustomPhoto ? (
              <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto pr-1">
                {photoOptions.map((photo) => (
                  <div
                    key={photo.url}
                    onClick={() => { setSelectedPhoto(photo.url); setUseCustomPhoto(false); }}
                    className={`p-2 rounded border cursor-pointer flex flex-col items-center justify-center gap-1 transition ${
                      selectedPhoto === photo.url && !useCustomPhoto
                        ? 'bg-purple-50 border-[#6700ce] text-[#6700ce] font-bold shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <img src={photo.url} alt={photo.label} className="w-10 h-10 object-contain" />
                    <span className="text-[9px] text-center line-clamp-1">{photo.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded bg-slate-50 border border-slate-200 space-y-2">
                <input
                  type="url"
                  value={customPhotoUrl}
                  onChange={(e) => setCustomPhotoUrl(e.target.value)}
                  placeholder="Paste Image URL..."
                  className="w-full px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-900 text-xs font-semibold focus:outline-none focus:border-[#e20d65]"
                />
                <label className="flex items-center justify-center gap-2 px-3 py-1.5 rounded bg-white border border-dashed border-slate-300 text-slate-700 text-xs font-bold cursor-pointer hover:bg-slate-100 transition">
                  <Upload className="w-3.5 h-3.5 text-[#6700ce]" />
                  <span>Or Upload Image File</span>
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            )}
          </div>

          {/* Section 3: Variant & Pricing Details */}
          <div className="p-3.5 rounded bg-slate-50 border border-slate-200 space-y-2">
            <h3 className="font-extrabold text-[#1c023d] text-[11px] uppercase tracking-wider">SKU Variant & Cost Thresholds</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-600 font-bold mb-1">Variant Name</label>
                <input
                  type="text"
                  value={variantName}
                  onChange={(e) => setVariantName(e.target.value)}
                  placeholder="e.g. Standard Unit"
                  className="w-full px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-900 font-semibold focus:outline-none focus:border-[#e20d65]"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Unit Cost (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-900 font-black font-mono focus:outline-none focus:border-[#e20d65]"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Reorder Threshold</label>
                <input
                  type="number"
                  min="1"
                  value={reorderThreshold}
                  onChange={(e) => setReorderThreshold(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-900 font-bold font-mono focus:outline-none focus:border-[#e20d65]"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Initial Regional Hub Stock Seeding */}
          <div className="p-3.5 rounded bg-slate-50 border border-slate-200 space-y-2">
            <h3 className="font-extrabold text-[#1c023d] text-[11px] uppercase tracking-wider">Initial Stock Seeding by Regional Hub</h3>
            
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-600 font-bold mb-1">Delhi Hub</label>
                <input
                  type="number"
                  min="0"
                  value={initialStockDelhi}
                  onChange={(e) => setInitialStockDelhi(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-900 font-bold font-mono focus:outline-none focus:border-[#e20d65]"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Mumbai Hub</label>
                <input
                  type="number"
                  min="0"
                  value={initialStockMumbai}
                  onChange={(e) => setInitialStockMumbai(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-900 font-bold font-mono focus:outline-none focus:border-[#e20d65]"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Bangalore Hub</label>
                <input
                  type="number"
                  min="0"
                  value={initialStockBangalore}
                  onChange={(e) => setInitialStockBangalore(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-900 font-bold font-mono focus:outline-none focus:border-[#e20d65]"
                />
              </div>
            </div>
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition min-h-[44px]"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded bg-[#e20d65] hover:bg-[#cc0059] text-white font-extrabold shadow-sm transition flex items-center gap-1.5 min-h-[44px]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? 'Creating Product...' : 'Create & Save Product'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
