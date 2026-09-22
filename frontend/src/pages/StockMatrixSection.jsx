import React from 'react';
import { StockGrid } from '../components/StockGrid';
import { Layers, ArrowRight } from 'lucide-react';

export const StockMatrixSection = ({ matrix, locations, onRequestOrder }) => {
  return (
    <div className="space-y-8 pb-12 font-sans max-w-7xl mx-auto">
      
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="bg-[#e20d65]/10 p-4 rounded-2xl text-[#e20d65] border border-[#e20d65]/20">
            <Layers className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-[#120836] tracking-tight">
              Global Stock Matrix Portal
            </h1>
            <p className="text-sm text-slate-500 mt-1">Multi-location SKU inventory breakdown across Delhi, Mumbai, and Bangalore hubs</p>
          </div>
        </div>

        <button
          onClick={() => onRequestOrder(null)}
          className="px-5 py-2.5 rounded-2xl btn-tata-magenta font-bold text-xs flex items-center gap-2 shadow-md shrink-0"
        >
          <span>New Procurement Order</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Global Stock Matrix Table */}
      <StockGrid
        matrix={matrix}
        locations={locations}
        onRequestOrder={onRequestOrder}
      />

    </div>
  );
};
