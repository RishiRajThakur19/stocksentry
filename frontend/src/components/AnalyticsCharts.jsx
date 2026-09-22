import React from 'react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  CartesianGrid, 
  AreaChart, 
  Area, 
  LineChart, 
  Line 
} from 'recharts';
import { BarChart3, TrendingUp, Activity, Clock, Flame, Repeat } from 'lucide-react';

export const AnalyticsCharts = ({ matrix = [] }) => {
  // Fulfillment time trend data (30/60/90 days)
  const fulfillmentTrendData = [
    { month: 'Jan', avgDays: 2.4 },
    { month: 'Feb', avgDays: 2.1 },
    { month: 'Mar', avgDays: 1.9 },
    { month: 'Apr', avgDays: 1.8 },
    { month: 'May', avgDays: 1.7 },
    { month: 'Jun', avgDays: 1.5 },
    { month: 'Jul', avgDays: 1.6 },
    { month: 'Aug', avgDays: 1.4 }
  ];

  // Top requested products by city
  const topCityDemandData = [
    { city: 'Delhi', NokiaModem: 320, JuniperModem: 140, Cables: 210, ZipTies: 450 },
    { city: 'Mumbai', NokiaModem: 410, JuniperModem: 180, Cables: 310, ZipTies: 520 },
    { city: 'Bangalore', NokiaModem: 380, JuniperModem: 210, Cables: 280, ZipTies: 490 },
    { city: 'Hyderabad', NokiaModem: 290, JuniperModem: 120, Cables: 190, ZipTies: 380 },
    { city: 'Chennai', NokiaModem: 260, JuniperModem: 110, Cables: 170, ZipTies: 340 },
    { city: 'Kolkata', NokiaModem: 220, JuniperModem: 90, Cables: 150, ZipTies: 290 },
    { city: 'Pune', NokiaModem: 240, JuniperModem: 105, Cables: 160, ZipTies: 310 },
  ];

  // Low-Stock Frequency
  const lowStockFrequencyData = [
    { name: 'Fiber Clamping Machine', frequency: 14 },
    { name: 'Fiber Modem - Juniper', frequency: 11 },
    { name: 'Fiber Optic Cables 500m', frequency: 8 },
    { name: 'Tata Play T-Shirt XXL', frequency: 6 },
    { name: 'Tata Play T-Shirt S', frequency: 4 },
  ];

  // Stock Turnover Rate
  const turnoverRateData = [
    { category: 'Networking Modems', turnover_rate: 4.8 },
    { category: 'Cables & Wiring', turnover_rate: 3.9 },
    { category: 'Fiber Splicing Tools', turnover_rate: 2.4 },
    { category: 'Field Apparel', turnover_rate: 5.2 },
    { category: 'Zip Ties & Accessories', turnover_rate: 6.1 },
  ];

  return (
    <div className="space-y-6 font-sans w-full max-w-[1600px] mx-auto">
      
      {/* Grid Row 1: Fulfillment Time & Stock Turnover */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
        
        {/* Fulfillment Time Trend */}
        <div className="lg:col-span-7 bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div>
              <h2 className="text-base font-black text-[#1c023d] flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#e20d65]" />
                <span>Request Fulfillment Duration Trend (PENDING → DELIVERED)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Average days elapsed from city manager request creation to delivery confirmation</p>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded bg-purple-50 text-[#6700ce] border border-purple-200 font-mono">
              30/60/90 Days
            </span>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={fulfillmentTrendData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#0f172a" tick={{ fontSize: 11, fontWeight: 700 }} />
                <YAxis stroke="#0f172a" tick={{ fontSize: 11, fontWeight: 700 }} unit=" days" />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }} />
                <Area type="monotone" dataKey="avgDays" name="Avg Fulfillment Days" stroke="#e20d65" fill="#e20d65" fillOpacity={0.18} strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Stock Turnover Rate by Category */}
        <div className="lg:col-span-5 bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div>
              <h2 className="text-base font-black text-[#1c023d] flex items-center gap-2">
                <Repeat className="w-5 h-5 text-emerald-600" />
                <span>Stock Turnover Rate by Category</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Category inventory cycle frequency (received → dispatched)</p>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
              Annual Rate
            </span>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={turnoverRateData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" stroke="#0f172a" tick={{ fontSize: 11, fontWeight: 700 }} />
                <YAxis dataKey="category" type="category" stroke="#0f172a" tick={{ fontSize: 10, fontWeight: 800 }} width={120} />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }} />
                <Bar dataKey="turnover_rate" name="Turnover Multiplier (x)" fill="#10b981" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Grid Row 2: Top Requested Products & Low-Stock Frequency */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
        
        {/* Top Requested Products by City */}
        <div className="lg:col-span-7 bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div>
              <h2 className="text-base font-black text-[#1c023d] flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#6700ce]" />
                <span>Top Requested Products by City Hub</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Bulk stock request volume across Delhi, Mumbai, Bangalore, Hyderabad, Chennai, Kolkata, Pune</p>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded bg-purple-50 text-[#6700ce] border border-purple-200 font-mono">
              7 Cities
            </span>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCityDemandData} margin={{ top: 15, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="city" stroke="#0f172a" tick={{ fontSize: 11, fontWeight: 700 }} />
                <YAxis stroke="#0f172a" tick={{ fontSize: 11, fontWeight: 700 }} />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }} />
                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                <Bar dataKey="NokiaModem" name="Nokia Modem Wi-Fi 6" fill="#6700ce" radius={[4, 4, 0, 0]} />
                <Bar dataKey="JuniperModem" name="Juniper Gateway" fill="#e20d65" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Cables" name="Fiber Optic Cables" fill="#0284c7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Low-Stock Frequency Heatmap / Trigger Bar */}
        <div className="lg:col-span-5 bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div>
              <h2 className="text-base font-black text-[#1c023d] flex items-center gap-2">
                <Flame className="w-5 h-5 text-rose-600" />
                <span>Low-Stock Breach Frequency</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Chronically under-stocked SKU combinations this quarter</p>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded bg-rose-50 text-rose-700 border border-rose-200 font-mono">
              Q3 Breaches
            </span>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lowStockFrequencyData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" stroke="#0f172a" tick={{ fontSize: 11, fontWeight: 700 }} />
                <YAxis dataKey="name" type="category" stroke="#0f172a" tick={{ fontSize: 10, fontWeight: 800 }} width={140} />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }} />
                <Bar dataKey="frequency" name="Threshold Breach Count" fill="#e20d65" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
};
