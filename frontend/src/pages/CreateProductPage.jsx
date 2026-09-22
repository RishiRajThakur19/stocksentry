import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Package, RefreshCw, Upload, Image as ImageIcon, Layers, Sparkles, Link as LinkIcon } from 'lucide-react';
import api from '../api/client';

export const CreateProductPage = ({ setActiveTab, onProductCreated }) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Networking');
  const [description, setDescription] = useState('');
  const [isSerialized, setIsSerialized] = useState(false);
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
  const [successMsg, setSuccessMsg] = useState('');

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

  const handleGenerateSKU = () => {
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    setName(`Tata Play Fiber Equipment #${randomCode}`);
    setVariantName(`Variant-${randomCode}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

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
        description: description,
        is_serialized: isSerialized,
        image_url: finalPhoto,
        variants: [
          {
            variant_name: variantName,
            unit_cost: parseFloat(unitCost),
            reorder_threshold: parseInt(reorderThreshold),
            reorder_quantity: parseInt(reorderQuantity)
          }
        ]
      });

      setSuccessMsg(`Product "${name}" created successfully as ${isSerialized ? 'Serialized Asset' : 'Consumable'}!`);
      onProductCreated?.();
      
      setTimeout(() => {
        setActiveTab('central-stock');
      }, 1500);
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Failed to create product.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans w-full max-w-5xl mx-auto">
      
      {/* Header */}
      <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-[#1c023d] flex items-center gap-2">
            <Package className="w-5 h-5 text-[#e20d65]" />
            Create Product Catalog Item
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Create new SKU items with custom image upload or preset thumbnails and regional hub stock seeding.</p>
        </div>

        <button
          onClick={() => setActiveTab('matrix')}
          className="px-4 py-2.5 rounded bg-[#1c023d] hover:bg-[#2c095c] text-white text-xs font-bold transition flex items-center gap-1.5 min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Products</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 text-xs">
        
        {/* Section 1: Product Information */}
        <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-extrabold text-[#1c023d] uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-[#e20d65]" />
              Product Details
            </h2>

            <button
              type="button"
              onClick={handleGenerateSKU}
              className="px-3 py-1.5 rounded bg-purple-50 text-[#6700ce] hover:bg-purple-100 font-bold border border-purple-200 flex items-center gap-1 text-[11px] min-h-[36px]"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Auto-Generate SKU</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-bold mb-1.5">Product Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Fiber Clamping Machine / Nokia Wi-Fi 6 Modem"
                className="w-full px-3.5 py-2.5 rounded bg-white border border-slate-300 text-slate-900 font-semibold focus:outline-none focus:border-[#e20d65]"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1.5">Category *</label>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-slate-700 font-bold mb-1.5">Inventory Class *</label>
              <div className="grid grid-cols-2 gap-2">
                <label className={`p-3 rounded-lg border cursor-pointer flex items-center gap-2 transition ${!isSerialized ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/20' : 'bg-slate-50 border-slate-200'}`}>
                  <input
                    type="radio"
                    name="inventoryClass"
                    checked={!isSerialized}
                    onChange={() => setIsSerialized(false)}
                    className="text-amber-600"
                  />
                  <div>
                    <span className="font-bold text-xs text-amber-900 block">Consumable</span>
                    <span className="text-[10px] text-slate-500">Quantity-based tracking</span>
                  </div>
                </label>

                <label className={`p-3 rounded-lg border cursor-pointer flex items-center gap-2 transition ${isSerialized ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-400/20' : 'bg-slate-50 border-slate-200'}`}>
                  <input
                    type="radio"
                    name="inventoryClass"
                    checked={isSerialized}
                    onChange={() => setIsSerialized(true)}
                    className="text-indigo-600"
                  />
                  <div>
                    <span className="font-bold text-xs text-indigo-900 block">Serialized Asset</span>
                    <span className="text-[10px] text-slate-500">Unit serial number tracked</span>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1.5">Description & Specs</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Dual-Band Wi-Fi 6 GPON Gigabit Home Gateway CPE"
                className="w-full px-3.5 py-2.5 rounded bg-white border border-slate-300 text-slate-900 font-semibold focus:outline-none focus:border-[#e20d65]"
              />
            </div>
          </div>

          {/* Product Image Option: Preset Gallery OR Custom Image Upload / URL */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="block text-slate-700 font-bold">Product Image *</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUseCustomPhoto(false)}
                  className={`px-3 py-1 rounded text-xs font-bold transition ${!useCustomPhoto ? 'bg-[#6700ce] text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  Preset Gallery
                </button>
                <button
                  type="button"
                  onClick={() => setUseCustomPhoto(true)}
                  className={`px-3 py-1 rounded text-xs font-bold transition ${useCustomPhoto ? 'bg-[#6700ce] text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  Custom Upload / URL
                </button>
              </div>
            </div>

            {!useCustomPhoto ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {photoOptions.map((photo) => (
                  <div
                    key={photo.url}
                    onClick={() => { setSelectedPhoto(photo.url); setUseCustomPhoto(false); }}
                    className={`p-3 rounded border cursor-pointer flex flex-col items-center justify-center gap-2 transition ${
                      selectedPhoto === photo.url && !useCustomPhoto
                        ? 'bg-purple-50 border-[#6700ce] text-[#6700ce] font-bold shadow-sm ring-2 ring-purple-400/30'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <img src={photo.url} alt={photo.label} className="w-16 h-16 object-contain" />
                    <span className="text-[11px] text-center font-bold line-clamp-1">{photo.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Paste Custom Image URL</label>
                    <div className="relative">
                      <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="url"
                        value={customPhotoUrl}
                        onChange={(e) => setCustomPhotoUrl(e.target.value)}
                        placeholder="https://example.com/product_image.png"
                        className="w-full pl-9 pr-3 py-2 rounded bg-white border border-slate-300 text-slate-900 font-semibold focus:outline-none focus:border-[#e20d65]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Or Upload File from Device</label>
                    <label className="flex items-center justify-center gap-2 px-4 py-2 rounded bg-white border border-dashed border-slate-300 text-slate-700 font-bold cursor-pointer hover:bg-slate-100 transition min-h-[40px]">
                      <Upload className="w-4 h-4 text-[#6700ce]" />
                      <span>Choose Local Image File</span>
                      <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                    </label>
                  </div>
                </div>

                {customPhotoUrl && (
                  <div className="flex items-center gap-3 pt-2">
                    <img src={customPhotoUrl} alt="Custom Preview" className="w-16 h-16 object-contain rounded border border-slate-300 bg-white p-1" />
                    <span className="text-xs text-emerald-600 font-extrabold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Custom Image Ready
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Variant & Pricing Details */}
        <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-sm font-extrabold text-[#1c023d] uppercase tracking-wider border-b border-slate-100 pb-3">
            SKU Variant & Cost Thresholds
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-slate-700 font-bold mb-1.5">Variant Name</label>
              <input
                type="text"
                value={variantName}
                onChange={(e) => setVariantName(e.target.value)}
                placeholder="e.g. Standard Unit / 100m Roll"
                className="w-full px-3.5 py-2.5 rounded bg-white border border-slate-300 text-slate-900 font-semibold focus:outline-none focus:border-[#e20d65]"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1.5">Unit Cost (₹)</label>
              <input
                type="number"
                min="0"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded bg-white border border-slate-300 text-slate-900 font-black font-mono focus:outline-none focus:border-[#e20d65]"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1.5">Reorder Threshold</label>
              <input
                type="number"
                min="1"
                value={reorderThreshold}
                onChange={(e) => setReorderThreshold(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded bg-white border border-slate-300 text-slate-900 font-bold font-mono focus:outline-none focus:border-[#e20d65]"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1.5">Reorder Qty Batch</label>
              <input
                type="number"
                min="1"
                value={reorderQuantity}
                onChange={(e) => setReorderQuantity(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded bg-white border border-slate-300 text-slate-900 font-bold font-mono focus:outline-none focus:border-[#e20d65]"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Warehouse Initial Stock Seeding */}
        <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-sm font-extrabold text-[#1c023d] uppercase tracking-wider border-b border-slate-100 pb-3">
            Initial Warehouse Hub Stock Seeding
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 rounded bg-slate-50 border border-slate-200">
              <label className="block text-slate-700 font-bold mb-1.5">Delhi Regional Hub Stock</label>
              <input
                type="number"
                min="0"
                value={initialStockDelhi}
                onChange={(e) => setInitialStockDelhi(e.target.value)}
                className="w-full px-3.5 py-2 rounded bg-white border border-slate-300 text-slate-900 font-bold font-mono focus:outline-none focus:border-[#e20d65]"
              />
            </div>

            <div className="p-3 rounded bg-slate-50 border border-slate-200">
              <label className="block text-slate-700 font-bold mb-1.5">Mumbai Main Hub Stock</label>
              <input
                type="number"
                min="0"
                value={initialStockMumbai}
                onChange={(e) => setInitialStockMumbai(e.target.value)}
                className="w-full px-3.5 py-2 rounded bg-white border border-slate-300 text-slate-900 font-bold font-mono focus:outline-none focus:border-[#e20d65]"
              />
            </div>

            <div className="p-3 rounded bg-slate-50 border border-slate-200">
              <label className="block text-slate-700 font-bold mb-1.5">Bangalore Tech Park Stock</label>
              <input
                type="number"
                min="0"
                value={initialStockBangalore}
                onChange={(e) => setInitialStockBangalore(e.target.value)}
                className="w-full px-3.5 py-2 rounded bg-white border border-slate-300 text-slate-900 font-bold font-mono focus:outline-none focus:border-[#e20d65]"
              />
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className="px-5 py-3 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition min-h-[44px]"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 rounded bg-[#e20d65] hover:bg-[#cc0059] text-white font-extrabold text-xs shadow-md transition flex items-center gap-2 min-h-[44px]"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{loading ? 'Creating Product...' : 'Save & Initialize Product'}</span>
          </button>
        </div>

      </form>

    </div>
  );
};
