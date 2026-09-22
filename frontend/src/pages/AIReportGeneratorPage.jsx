import React, { useState, useEffect } from 'react';
import { Sparkles, Download, CheckCircle2, AlertTriangle, TrendingUp, ShieldCheck, FileText, Calendar, Building2, Package } from 'lucide-react';
import api from '../api/client';

export const AIReportGeneratorPage = () => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await api.get('/ai/report/summary');
      setReport(res.data);
    } catch (err) {
      console.error("Failed to fetch AI report", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 font-sans">
        Generating StockSentry Executive AI Intelligence Report...
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 font-sans w-full max-w-5xl mx-auto">
      
      {/* Page Header */}
      <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#1c023d] flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-[#e20d65]" />
            AI Executive Intelligence & Demand Forecast Report
          </h1>
          <p className="text-xs text-slate-500 mt-1">Automated AI stock risk scoring, predicted stockout dates, and 30-day hub demand velocity.</p>
        </div>

        <button
          onClick={handlePrint}
          className="px-4 py-2.5 rounded bg-[#1c023d] hover:bg-[#2c095c] text-white font-extrabold text-xs shadow-sm transition flex items-center gap-2"
        >
          <Download className="w-4 h-4 text-[#e20d65]" />
          <span>Export PDF / Print Report</span>
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 w-full">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase text-slate-400">Inventory Health Score</p>
          <p className="text-3xl font-black text-emerald-600 font-mono mt-1">{report?.health_score || 92}/100</p>
          <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 mt-2 inline-block">Healthy Condition</span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase text-slate-400">Total Hub Stock Units</p>
          <p className="text-3xl font-black text-[#1c023d] font-mono mt-1">{report?.total_stock_units} units</p>
          <span className="text-[10px] text-slate-400 font-bold">Across 3 Hubs</span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase text-slate-400">Asset Valuation</p>
          <p className="text-3xl font-black text-[#6700ce] font-mono mt-1">{report?.total_valuation_inr}</p>
          <span className="text-[10px] text-purple-700 font-bold bg-purple-50 px-2 py-0.5 rounded border border-purple-200 mt-2 inline-block">Enterprise Assets</span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase text-slate-400">Open Stock Breaches</p>
          <p className="text-3xl font-black text-[#e20d65] font-mono mt-1">{report?.open_alerts_count}</p>
          <span className="text-[10px] text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200 mt-2 inline-block">Reorder Action Req.</span>
        </div>
      </div>

      {/* AI Predicted Stockout Risks Table */}
      <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm space-y-4 w-full">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-sm font-extrabold text-[#1c023d] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>AI Predicted Stockout Risks & Reorder Recommendations</span>
          </h2>
          <span className="text-xs text-slate-400 font-mono">Real-Time Risk Analysis</span>
        </div>

        {report?.predicted_stockout_risks?.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs font-bold bg-slate-50 rounded border border-slate-200">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
            Zero critical stockout risks detected. Inventory velocity is stable across all regional hubs!
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600 font-bold uppercase bg-slate-50">
                  <th className="py-3 px-4">SKU Product</th>
                  <th className="py-3 px-4">Regional Hub</th>
                  <th className="py-3 px-4 text-center">Current Qty</th>
                  <th className="py-3 px-4 text-center">Predicted Stockout</th>
                  <th className="py-3 px-4 text-center">AI Rec. Reorder Batch</th>
                  <th className="py-3 px-4 text-center">Risk Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {report?.predicted_stockout_risks?.map((risk, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="py-3.5 px-4 font-bold text-[#1c023d]">
                      {risk.item_name}
                      <span className="text-xs text-[#e20d65] font-mono block">Variant: {risk.variant_name}</span>
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-slate-800">{risk.location_name}</td>
                    <td className="py-3.5 px-4 text-center font-mono font-black text-[#1c023d]">{risk.current_qty} units</td>
                    <td className="py-3.5 px-4 text-center font-mono text-rose-600 font-extrabold">In {risk.predicted_stockout_days} Days</td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-[#6700ce]">+{risk.recommended_reorder_batch} units</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-rose-50 text-rose-700 border border-rose-200">
                        {risk.risk_level}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* AI Hub Demand Velocity Forecast */}
      <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm space-y-4 w-full">
        <h2 className="text-sm font-extrabold text-[#1c023d] uppercase tracking-wider border-b border-slate-100 pb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#6700ce]" />
          <span>30-Day Regional Hub Demand Velocity Forecast</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {report?.hub_demand_forecast?.map((df, idx) => (
            <div key={idx} className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <h3 className="font-extrabold text-[#1c023d] text-sm">{df.hub}</h3>
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-500">Consumption Velocity:</span>
                <span className="font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {df.velocity}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Predicted Demand:</span>
                <span className="font-mono font-black text-[#1c023d]">{df.forecast_units} units</span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
