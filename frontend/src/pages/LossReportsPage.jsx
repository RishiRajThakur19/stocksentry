import React, { useState, useEffect } from 'react';
import { AlertOctagon, CheckCircle2, XCircle, RotateCcw, RefreshCw, Plus } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export const LossReportsPage = () => {
  const { user } = useAuth();
  const isFieldWorker = user?.role === 'FIELD_WORKER';
  const isRegionalOrSuper = ['REGIONAL_ADMIN', 'SUPER_ADMIN', 'CENTRAL_ADMIN'].includes(user?.role);

  const [reports, setReports] = useState([]);
  const [summary, setSummary] = useState([]);
  const [myAssets, setMyAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ asset_id: '', loss_type: 'LOST', circumstances: '', date_last_seen: '', police_report_ref: '' });
  const [feedback, setFeedback] = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [repRes, sumRes, assetsRes] = await Promise.all([
        api.get('/loss-reports'),
        api.get('/loss-reports/summary'),
        api.get('/lifecycle/my-assets').catch(() => ({ data: [] })),
      ]);
      setReports(repRes.data || []);
      setSummary(sumRes.data || []);
      setMyAssets(assetsRes.data || []);
      if (assetsRes.data?.length > 0 && !form.asset_id) {
        setForm((p) => ({ ...p, asset_id: String(assetsRes.data[0].asset_id) }));
      }
    } catch (err) {
      console.error('Failed to load loss reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback(null);
    try {
      await api.post('/loss-reports', { ...form, asset_id: parseInt(form.asset_id, 10) });
      setForm({ asset_id: '', loss_type: 'LOST', circumstances: '', date_last_seen: '', police_report_ref: '' });
      setFeedback({ type: 'success', text: 'Loss/stolen report submitted for Regional Admin review.' });
      await fetchAll();
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.detail || 'Failed to submit loss report.' });
    }
  };

  const handleReview = async (id, action) => {
    try {
      await api.put(`/loss-reports/${id}/${action}`, {});
      setFeedback({ type: 'success', text: `Loss report #${id} ${action}d.` });
      await fetchAll();
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.detail || `Failed to ${action} report.` });
    }
  };

  return (
    <div className="space-y-5 font-sans w-full max-w-[1600px] mx-auto pb-16">
      <div className="bg-white rounded-xl p-5 border border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#1c023d] text-white flex items-center justify-center">
            <AlertOctagon className="w-4 h-4 text-[#e20d65]" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#1c023d]">Lost & Stolen Asset Governance</h1>
            <p className="text-xs text-slate-500">Report missing or stolen equipment, approve write-offs, and recover found assets.</p>
          </div>
        </div>
        <button onClick={fetchAll} className="px-3 py-2 rounded-lg bg-slate-100 text-xs font-bold flex items-center gap-1">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {feedback && (
        <div className={`p-3 rounded-xl border text-xs font-bold ${feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
          {feedback.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <form onSubmit={handleSubmit} className="lg:col-span-4 bg-white rounded-xl p-5 border border-slate-200 space-y-3 text-xs h-fit">
          <h2 className="text-sm font-black text-[#1c023d] flex items-center gap-1.5"><Plus className="w-4 h-4 text-[#e20d65]" /> Report Lost / Stolen Asset</h2>
          {!isFieldWorker && (
            <input type="number" required value={form.asset_id} onChange={(e) => setForm({ ...form, asset_id: e.target.value })} placeholder="Asset ID (or select below)" className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 font-mono" />
          )}
          {myAssets.length > 0 ? (
            <select required value={form.asset_id} onChange={(e) => setForm({ ...form, asset_id: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 font-semibold">
              {myAssets.map((a) => <option key={a.asset_id} value={a.asset_id}>{a.item_name} — {a.serial_number}</option>)}
            </select>
          ) : isFieldWorker ? (
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-500">No assets currently assigned to your toolbag.</div>
          ) : null}
          <select value={form.loss_type} onChange={(e) => setForm({ ...form, loss_type: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 font-bold">
            <option value="LOST">Lost</option>
            <option value="STOLEN">Stolen</option>
          </select>
          <input type="text" value={form.date_last_seen} onChange={(e) => setForm({ ...form, date_last_seen: e.target.value })} placeholder="Date last seen (YYYY-MM-DD)" className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300" />
          <input type="text" value={form.police_report_ref} onChange={(e) => setForm({ ...form, police_report_ref: e.target.value })} placeholder="Police FIR / Ref (optional)" className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300" />
          <textarea rows={3} required value={form.circumstances} onChange={(e) => setForm({ ...form, circumstances: e.target.value })} placeholder="Circumstances..." className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300" />
          <button type="submit" className="w-full py-2.5 rounded-xl bg-[#e20d65] text-white font-extrabold">Submit Loss Report</button>
        </form>

        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-xl p-5 border border-slate-200 overflow-x-auto">
            <h2 className="text-sm font-black text-[#1c023d] mb-3">Loss & Write-Off Queue</h2>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 text-[10px] text-slate-500 uppercase">
                <tr>
                  <th className="py-2 pr-3">Serial / Item</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Reporter</th>
                  <th className="py-2 pr-3">Status</th>
                  {isRegionalOrSuper && <th className="py-2 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((r) => (
                  <tr key={r.loss_id}>
                    <td className="py-2.5 pr-3">
                      <div className="font-mono font-black text-[#1c023d]">{r.serial_number}</div>
                      <div className="text-[11px] text-slate-500">{r.item_name} (₹{r.unit_cost})</div>
                    </td>
                    <td className="py-2.5 pr-3 font-bold">{r.loss_type}</td>
                    <td className="py-2.5 pr-3">{r.reporter_name}</td>
                    <td className="py-2.5 pr-3 font-extrabold">{r.status}</td>
                    {isRegionalOrSuper && (
                      <td className="py-2.5 text-right space-x-1.5">
                        {r.status === 'PENDING_REGIONAL' && (
                          <>
                            <button onClick={() => handleReview(r.loss_id, 'approve')} className="px-2.5 py-1 rounded bg-emerald-600 text-white font-bold inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Approve</button>
                            <button onClick={() => handleReview(r.loss_id, 'reject')} className="px-2.5 py-1 rounded bg-rose-50 text-rose-700 font-bold inline-flex items-center gap-1"><XCircle className="w-3 h-3" /> Reject</button>
                          </>
                        )}
                        {r.status === 'APPROVED' && (
                          <button onClick={() => handleReview(r.loss_id, 'recover')} className="px-2.5 py-1 rounded bg-indigo-600 text-white font-bold inline-flex items-center gap-1"><RotateCcw className="w-3 h-3" /> Mark Recovered</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {summary.length > 0 && (
            <div className="bg-white rounded-xl p-5 border border-slate-200">
              <h2 className="text-sm font-black text-[#1c023d] mb-2">Approved Write-Offs by City & Month</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {summary.map((s, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="font-black text-[#1c023d]">{s.city_name} · {s.month}</div>
                    <div className="text-slate-600">{s.count} unit(s) · ₹{s.total_value.toLocaleString('en-IN')}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
