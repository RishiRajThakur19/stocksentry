import React, { useState, useEffect } from 'react';
import { AnalyticsCharts } from '../components/AnalyticsCharts';
import { KPIMeter } from '../components/KPIMeter';
import { BarChart3, Download, AlertTriangle, Wrench, Clock, ShieldCheck } from 'lucide-react';
import api from '../api/client';

export const AnalyticsSection = ({ chartData, summary, matrix }) => {
  const [days, setDays] = useState(90);
  const [insights, setInsights] = useState(null);

  useEffect(() => {
    api.get('/analytics/lifecycle-insights', { params: { days } })
      .then((res) => setInsights(res.data))
      .catch(() => setInsights(null));
  }, [days]);

  const handleExport = (dataset, fmt) => {
    const token = localStorage.getItem('stocksentry_token');
    fetch(`${api.defaults.baseURL}/exports/${dataset}?format=${fmt}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `stocksentry_${dataset}.${fmt}`;
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  return (
    <div className="space-y-6 pb-12 font-sans w-full">
      {/* Header Banner */}
      <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-purple-50 p-3.5 rounded text-[#6700ce] border border-purple-100">
            <BarChart3 className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#1c023d] tracking-tight">
              Executive Analytics & Visual Reports Portal
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Comprehensive visual analytics, lifecycle insights, and scoped CSV/XLSX exports.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value, 10))}
            className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-[#1c023d]"
          >
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
            <option value={365}>Last 365 Days</option>
          </select>
          <button onClick={() => handleExport('central_stock', 'csv')} className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1">
            <Download className="w-3.5 h-3.5" /> Stock CSV
          </button>
          <button onClick={() => handleExport('assets', 'xlsx')} className="px-3 py-1.5 rounded-lg bg-[#1c023d] text-white flex items-center gap-1">
            <Download className="w-3.5 h-3.5" /> Assets XLSX
          </button>
        </div>
      </div>

      {/* Grid Layout containing all visual charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
        <div className="lg:col-span-8">
          <AnalyticsCharts data={chartData} matrix={matrix} />
        </div>
        <div className="lg:col-span-4 space-y-6">
          <KPIMeter summary={summary} matrix={matrix} />
        </div>
      </div>

      {/* Lifecycle Insights (Stage 4.3) */}
      {insights && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <div className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1"><Wrench className="w-3.5 h-3.5 text-[#e20d65]" /> Mean Repair Time</div>
              <div className="text-2xl font-black text-[#1c023d] mt-1">{insights.repair_metrics.mean_time_hours}h</div>
              <div className="text-[11px] text-slate-500">Returned: {insights.repair_metrics.returned} · Scrapped: {insights.repair_metrics.scrapped}</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <div className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-indigo-600" /> Idle Stock Ageing</div>
              <div className="text-sm font-black text-[#1c023d] mt-2">
                0-30d: {insights.idle_stock_ageing['0_30']} · 31-90d: {insights.idle_stock_ageing['31_90']} · 90+d: {insights.idle_stock_ageing['90_plus']}
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <div className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Ticket SLA Compliance</div>
              <div className="text-2xl font-black text-emerald-600 mt-1">{insights.ticket_metrics.sla_compliance_pct}%</div>
              <div className="text-[11px] text-slate-500">{insights.ticket_metrics.total} tickets · {insights.ticket_metrics.sla_breached} breached</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <div className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Requisition Outliers</div>
              <div className="text-2xl font-black text-amber-600 mt-1">{insights.requisition_outliers.flagged_workers.length}</div>
              <div className="text-[11px] text-slate-500">Peer median: {insights.requisition_outliers.peer_median} units (flag for review)</div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 overflow-x-auto">
            <h2 className="text-sm font-black text-[#1c023d] mb-3">Failure Rate by Model (Last {days} Days)</h2>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 text-[10px] text-slate-500 uppercase">
                <tr>
                  <th className="py-2 pr-3">Model</th>
                  <th className="py-2 pr-3">Units in Service</th>
                  <th className="py-2 pr-3">Faults</th>
                  <th className="py-2">Faults / 100 Units</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {insights.failure_rate_by_model.map((m) => (
                  <tr key={m.model}>
                    <td className="py-2 pr-3 font-bold text-[#1c023d]">{m.model}</td>
                    <td className="py-2 pr-3 font-mono">{m.units_in_service}</td>
                    <td className="py-2 pr-3 font-mono">{m.faults}</td>
                    <td className="py-2 font-mono font-black text-[#e20d65]">{m.faults_per_100}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
