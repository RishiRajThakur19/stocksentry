import React from 'react';
import { AnalyticsCharts } from '../components/AnalyticsCharts';
import { KPIMeter } from '../components/KPIMeter';
import { BarChart3, TrendingUp, Package, Building2 } from 'lucide-react';

export const AnalyticsSection = ({ chartData, summary, matrix }) => {
  return (
    <div className="space-y-6 pb-12 font-sans w-full">
      
      {/* Header Banner */}
      <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-purple-50 p-3.5 rounded text-[#6700ce] border border-purple-100">
            <BarChart3 className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#1c023d] tracking-tight">
              Executive Analytics & Visual Reports Portal
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Comprehensive visual analytics, regional distribution charts, category breakdowns, and valuation meters.</p>
          </div>
        </div>

        <span className="text-xs font-bold px-3 py-1 rounded bg-purple-50 text-[#6700ce] border border-purple-200 font-mono">
          Interactive Analytics
        </span>
      </div>

      {/* Grid Layout containing all visual charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
        
        {/* Main Stock Distribution & Threshold Charts (8/12 Width) */}
        <div className="lg:col-span-8">
          <AnalyticsCharts data={chartData} matrix={matrix} />
        </div>


        {/* Category Share Donut & Valuation Meter (4/12 Width) */}
        <div className="lg:col-span-4 space-y-6">
          <KPIMeter summary={summary} matrix={matrix} />
        </div>

      </div>

    </div>
  );
};
