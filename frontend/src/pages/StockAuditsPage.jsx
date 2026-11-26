import React, { useState, useEffect } from 'react';
import { ClipboardCheck, Plus, Download, CheckCircle2, Send, RefreshCw } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export const StockAuditsPage = () => {
  const { user } = useAuth();
  const isSuperAdmin = ['SUPER_ADMIN', 'CENTRAL_ADMIN'].includes(user?.role);
  const isRegionalOrSuper = ['REGIONAL_ADMIN', 'SUPER_ADMIN', 'CENTRAL_ADMIN'].includes(user?.role);

  const [audits, setAudits] = useState([]);
  const [selected, setSelected] = useState(null);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);

  const fetchAudits = async () => {
    setLoading(true);
    try {
      const res = await api.get('/audits');
      setAudits(res.data || []);
    } catch (err) {
      console.error('Failed to load audits:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAudit = async (auditId) => {
    const res = await api.get(`/audits/${auditId}`);
    setSelected(res.data.audit);
    setLines(res.data.lines || []);
  };

  useEffect(() => {
    fetchAudits();
  }, []);

  const handleStartAudit = async (scopeType) => {
    setFeedback(null);
    try {
      const res = await api.post('/audits', { scope_type: scopeType });
      setFeedback({ type: 'success', text: `Started ${res.data.audit_code}` });
      await fetchAudits();
      await loadAudit(res.data.audit_id);
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.detail || 'Failed to start audit.' });
    }
  };

  const handleUpdateLine = async (lineId, countedQty, reason) => {
    if (!selected) return;
    const res = await api.put(`/audits/${selected.audit_id}/lines/${lineId}`, {
      counted_quantity: parseInt(countedQty, 10) || 0,
      reason: reason || null,
    });
    setLines((prev) => prev.map((l) => (l.line_id === lineId ? res.data : l)));
  };

  const handleSubmitAudit = async () => {
    if (!selected) return;
    await api.post(`/audits/${selected.audit_id}/submit`);
    await fetchAudits();
    await loadAudit(selected.audit_id);
  };

  const handleApproveAudit = async () => {
    if (!selected) return;
    await api.post(`/audits/${selected.audit_id}/approve`);
    await fetchAudits();
    await loadAudit(selected.audit_id);
  };

  return (
    <div className="space-y-5 font-sans w-full max-w-[1600px] mx-auto pb-16">
      <div className="bg-white rounded-xl p-5 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#1c023d] text-white flex items-center justify-center">
            <ClipboardCheck className="w-4 h-4 text-[#e20d65]" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#1c023d]">Stock Audits & Cycle Counts</h1>
            <p className="text-xs text-slate-500">Count physical inventory, track variances, and generate approved adjustment transactions.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-extrabold">
          <button onClick={() => handleStartAudit('CITY')} className="px-3.5 py-2 rounded-lg bg-[#e20d65] text-white flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Start City Audit
          </button>
          {isSuperAdmin && (
            <button onClick={() => handleStartAudit('CENTRAL')} className="px-3.5 py-2 rounded-lg bg-[#1c023d] text-white flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Start Central Audit
            </button>
          )}
          <button onClick={fetchAudits} className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

      {feedback && (
        <div className={`p-3 rounded-xl border text-xs font-bold ${feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
          {feedback.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-4 bg-white rounded-xl p-4 border border-slate-200 space-y-2">
          <h2 className="text-xs font-black text-[#1c023d] uppercase">Audit Sessions</h2>
          {audits.map((a) => (
            <button key={a.audit_id} onClick={() => loadAudit(a.audit_id)} className={`w-full text-left p-3 rounded-xl border text-xs ${selected?.audit_id === a.audit_id ? 'border-[#e20d65] bg-pink-50/40' : 'border-slate-200'}`}>
              <div className="flex justify-between font-mono font-bold text-slate-500">
                <span>{a.audit_code}</span>
                <span>{a.status}</span>
              </div>
              <div className="font-black text-[#1c023d] mt-0.5">{a.location_name} ({a.scope_type})</div>
            </button>
          ))}
        </div>

        <div className="lg:col-span-8 bg-white rounded-xl p-5 border border-slate-200 space-y-4">
          {!selected ? (
            <div className="py-16 text-center text-xs text-slate-400">Select or start an audit session to begin counting.</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-black text-[#1c023d]">{selected.audit_code} — {selected.location_name}</h2>
                  <p className="text-xs text-slate-500">Status: <strong>{selected.status}</strong></p>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold">
                  {selected.status === 'COUNTING' && (
                    <button onClick={handleSubmitAudit} className="px-3 py-1.5 rounded-lg bg-[#e20d65] text-white flex items-center gap-1">
                      <Send className="w-3.5 h-3.5" /> Submit Count
                    </button>
                  )}
                  {selected.status === 'SUBMITTED' && isRegionalOrSuper && (
                    <button onClick={handleApproveAudit} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Adjust
                    </button>
                  )}
                  <a href={`${api.defaults.baseURL}/audits/${selected.audit_id}/export`} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 flex items-center gap-1">
                    <Download className="w-3.5 h-3.5" /> CSV
                  </a>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 text-[10px] text-slate-500 uppercase">
                    <tr>
                      <th className="py-2 pr-3">Item / Variant</th>
                      <th className="py-2 pr-3">System</th>
                      <th className="py-2 pr-3">Counted</th>
                      <th className="py-2 pr-3">Variance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lines.map((l) => (
                      <tr key={l.line_id}>
                        <td className="py-2 pr-3 font-bold text-[#1c023d]">{l.item_name} ({l.variant_name})</td>
                        <td className="py-2 pr-3 font-mono">{l.system_quantity}</td>
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            disabled={selected.status !== 'COUNTING'}
                            defaultValue={l.counted_quantity}
                            onBlur={(e) => handleUpdateLine(l.line_id, e.target.value, l.reason)}
                            className="w-20 px-2 py-1 rounded border border-slate-300 font-mono font-bold"
                          />
                        </td>
                        <td className={`py-2 pr-3 font-mono font-black ${l.variance < 0 ? 'text-rose-600' : l.variance > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {l.variance > 0 ? `+${l.variance}` : l.variance}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
