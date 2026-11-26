import React, { useState, useEffect } from 'react';
import {
  LifeBuoy, Plus, Search, Send, Paperclip, AlertTriangle, CheckCircle2,
  Clock, ArrowUpRight, RefreshCw, Lock
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export const TicketsPage = () => {
  const { user } = useAuth();
  const isStaff = ['MANAGER', 'LOCATION_MANAGER', 'REGIONAL_ADMIN', 'SUPER_ADMIN', 'CENTRAL_ADMIN'].includes(user?.role);

  const [tickets, setTickets] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [tab, setTab] = useState('scope');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  const [selectedTicket, setSelectedTicket] = useState(null);
  const [detail, setDetail] = useState(null);
  const [commentBody, setCommentBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState(null);

  const [isNewOpen, setIsNewOpen] = useState(false);
  const [newForm, setNewForm] = useState({ category: 'ASSET_FAULT', priority: 'NORMAL', subject: '', description: '' });
  const [feedback, setFeedback] = useState(null);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const [tRes, mRes] = await Promise.all([
        api.get('/tickets', { params: { tab, category: categoryFilter, priority: priorityFilter, q: search || undefined } }),
        api.get('/tickets/metrics'),
      ]);
      setTickets(tRes.data || []);
      setMetrics(mRes.data);
    } catch (err) {
      console.error('Failed to load tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (ticketId) => {
    try {
      const res = await api.get(`/tickets/${ticketId}`);
      setDetail(res.data);
      setSelectedTicket(res.data.ticket);
    } catch (err) {
      console.error('Failed to load ticket detail:', err);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [tab, categoryFilter, priorityFilter]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const res = await api.post('/tickets', newForm);
      if (attachmentFile) {
        const fd = new FormData();
        fd.append('file', attachmentFile);
        await api.post(`/tickets/${res.data.ticket_id}/attachments`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      setIsNewOpen(false);
      setNewForm({ category: 'ASSET_FAULT', priority: 'NORMAL', subject: '', description: '' });
      setAttachmentFile(null);
      setFeedback({ type: 'success', text: `Created ticket ${res.data.ticket_code}` });
      await fetchTickets();
      await loadDetail(res.data.ticket_id);
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.detail || 'Failed to create ticket.' });
    }
  };

  const handleSendComment = async (e) => {
    e.preventDefault();
    if (!selectedTicket || !commentBody.trim()) return;
    try {
      const res = await api.post(`/tickets/${selectedTicket.ticket_id}/comments`, {
        body: commentBody,
        is_internal: isInternal,
      });
      if (attachmentFile) {
        const fd = new FormData();
        fd.append('file', attachmentFile);
        fd.append('comment_id', res.data.comment_id);
        await api.post(`/tickets/${selectedTicket.ticket_id}/attachments`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      setCommentBody('');
      setIsInternal(false);
      setAttachmentFile(null);
      await loadDetail(selectedTicket.ticket_id);
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.detail || 'Failed to send reply.' });
    }
  };

  const handleAction = async (action) => {
    if (!selectedTicket) return;
    try {
      await api.put(`/tickets/${selectedTicket.ticket_id}/action`, { action });
      await fetchTickets();
      await loadDetail(selectedTicket.ticket_id);
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.detail || `Failed to ${action}` });
    }
  };

  return (
    <div className="space-y-5 font-sans w-full max-w-[1600px] mx-auto pb-16">
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-[#1c023d] text-white flex items-center justify-center">
              <LifeBuoy className="w-4 h-4 text-[#e20d65]" />
            </div>
            <h1 className="text-xl md:text-2xl font-black text-[#1c023d] tracking-tight">Support Helpdesk & SLA Tickets</h1>
          </div>
          <p className="text-xs text-slate-500">Raise equipment faults, stock queries, or access tickets with SLA tracking and escalation.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsNewOpen(!isNewOpen)}
            className="px-4 py-2 rounded-lg bg-[#e20d65] hover:bg-[#cc0059] text-white text-xs font-extrabold flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>New Ticket</span>
          </button>
          <button onClick={fetchTickets} className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="text-[11px] font-bold text-slate-400 uppercase">Open Tickets</div>
            <div className="text-2xl font-black text-[#1c023d] mt-1">{metrics.open}</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="text-[11px] font-bold text-slate-400 uppercase">SLA Breached</div>
            <div className="text-2xl font-black text-rose-600 mt-1">{metrics.sla_breached}</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="text-[11px] font-bold text-slate-400 uppercase">Avg Resolution</div>
            <div className="text-2xl font-black text-indigo-600 mt-1">{metrics.avg_resolution_hours}h</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="text-[11px] font-bold text-slate-400 uppercase">Total in Scope</div>
            <div className="text-2xl font-black text-slate-700 mt-1">{metrics.total}</div>
          </div>
        </div>
      )}

      {isNewOpen && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl p-5 border border-purple-200 shadow-sm space-y-3 text-xs">
          <h2 className="text-sm font-black text-[#1c023d]">Create Support Ticket</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select value={newForm.category} onChange={(e) => setNewForm({ ...newForm, category: e.target.value })} className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 font-bold">
              <option value="ASSET_FAULT">Asset Fault</option>
              <option value="STOCK_ISSUE">Stock Issue</option>
              <option value="ACCESS_ACCOUNT">Access / Account</option>
              <option value="REQUEST_QUERY">Request Query</option>
              <option value="OTHER">Other</option>
            </select>
            <select value={newForm.priority} onChange={(e) => setNewForm({ ...newForm, priority: e.target.value })} className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 font-bold">
              <option value="LOW">Low (5d SLA)</option>
              <option value="NORMAL">Normal (48h SLA)</option>
              <option value="HIGH">High (24h SLA)</option>
              <option value="URGENT">Urgent (4h SLA)</option>
            </select>
            <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)} className="text-xs" />
          </div>
          <input type="text" required value={newForm.subject} onChange={(e) => setNewForm({ ...newForm, subject: e.target.value })} placeholder="Subject" className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 font-semibold" />
          <textarea rows={3} required value={newForm.description} onChange={(e) => setNewForm({ ...newForm, description: e.target.value })} placeholder="Describe the issue..." className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsNewOpen(false)} className="px-4 py-2 rounded-lg bg-slate-100 font-bold">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#e20d65] text-white font-extrabold">Submit Ticket</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 bg-white rounded-xl p-4 border border-slate-200 space-y-3">
          {isStaff && (
            <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
              {[['scope', 'My Scope'], ['assigned', 'Assigned to Me'], ['escalated', 'Escalated'], ['breached', 'SLA Breached'], ['closed', 'Closed']].map(([k, lbl]) => (
                <button key={k} onClick={() => setTab(k)} className={`px-2.5 py-1 rounded-md border ${tab === k ? 'bg-[#1c023d] text-white border-[#1c023d]' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                  {lbl}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2 text-xs">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchTickets()} placeholder="Search TKT-..., subject, serial" className="w-full pl-8 pr-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200" />
            </div>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200 font-bold">
              <option value="ALL">All Prio</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="NORMAL">Normal</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <div className="space-y-2 max-h-[540px] overflow-y-auto">
            {tickets.map((t) => (
              <button
                key={t.ticket_id}
                onClick={() => loadDetail(t.ticket_id)}
                className={`w-full text-left p-3 rounded-xl border transition ${selectedTicket?.ticket_id === t.ticket_id ? 'border-[#e20d65] bg-pink-50/40' : 'border-slate-200 hover:border-purple-200'}`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-500">
                  <span>{t.ticket_code}</span>
                  <span className={t.sla_breached ? 'text-rose-600 font-black' : 'text-slate-400'}>{t.status}</span>
                </div>
                <div className="text-xs font-black text-[#1c023d] truncate mt-0.5">{t.subject}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{t.creator_name} · {t.priority}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7 bg-white rounded-xl p-5 border border-slate-200 flex flex-col justify-between min-h-[480px]">
          {!detail ? (
            <div className="m-auto text-xs text-slate-400 font-semibold">Select a ticket to view the conversation and SLA details.</div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <div className="text-[11px] font-mono font-bold text-slate-500">{detail.ticket.ticket_code} · {detail.ticket.category} · {detail.ticket.priority}</div>
                  <h2 className="text-base font-black text-[#1c023d]">{detail.ticket.subject}</h2>
                  <p className="text-xs text-slate-600 mt-1">{detail.ticket.description}</p>
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {isStaff && detail.ticket.status !== 'CLOSED' && (
                    <>
                      <button onClick={() => handleAction('IN_PROGRESS')} className="px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 font-bold">In Progress</button>
                      <button onClick={() => handleAction('RESOLVE')} className="px-2.5 py-1 rounded bg-emerald-600 text-white font-bold">Resolve</button>
                      <button onClick={() => handleAction('ESCALATE')} className="px-2.5 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold flex items-center gap-1">
                        <ArrowUpRight className="w-3 h-3" /> Escalate
                      </button>
                    </>
                  )}
                  {detail.ticket.status === 'RESOLVED' && (
                    <>
                      <button onClick={() => handleAction('CONFIRM_CLOSE')} className="px-2.5 py-1 rounded bg-[#1c023d] text-white font-bold">Confirm & Close</button>
                      <button onClick={() => handleAction('REOPEN')} className="px-2.5 py-1 rounded bg-rose-50 text-rose-700 font-bold">Reopen</button>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto">
                {detail.comments.map((c) => (
                  <div key={c.comment_id} className={`p-3 rounded-xl text-xs border ${c.is_internal ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1">
                      <span className="flex items-center gap-1">
                        {c.is_internal && <Lock className="w-3 h-3 text-amber-700" />}
                        {c.author_name} ({c.author_role})
                      </span>
                      <span>{new Date(c.created_at).toLocaleString()}</span>
                    </div>
                    <div className="text-slate-800">{c.body}</div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSendComment} className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                <textarea rows={2} value={commentBody} onChange={(e) => setCommentBody(e.target.value)} placeholder="Write a reply..." className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300" />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {isStaff && (
                      <label className="flex items-center gap-1.5 font-bold text-amber-700 cursor-pointer">
                        <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} />
                        <span>Internal note</span>
                      </label>
                    )}
                    <label className="flex items-center gap-1 text-slate-500 cursor-pointer">
                      <Paperclip className="w-3.5 h-3.5" />
                      <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)} className="text-[11px]" />
                    </label>
                  </div>
                  <button type="submit" className="px-4 py-2 rounded-lg bg-[#e20d65] text-white font-extrabold flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
