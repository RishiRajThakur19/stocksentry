import React, { useState, useEffect } from 'react';
import { FileText, Search, Download, ShieldCheck, Clock, RefreshCw } from 'lucide-react';
import api from '../api/client';
import { exportToCSV } from '../utils/exportHelper';

export const AuditLogSection = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/audit-logs', { params: { limit: 100 } });
      setLogs(res.data);
    } catch (err) {
      console.error("Failed to fetch audit logs", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(l => 
    (l.action || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (l.user_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (l.details || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExportCSV = () => {
    exportToCSV('system_audit_logs.csv', filteredLogs, [
      { label: 'Log ID', key: 'log_id' },
      { label: 'User Name', key: 'user_name' },
      { label: 'Role', key: 'user_role' },
      { label: 'Action', key: 'action' },
      { label: 'Event Details', key: 'details' },
      { label: 'IP Address', key: 'ip_address' },
      { label: 'Timestamp', key: 'timestamp' }
    ]);
  };

  return (
    <div className="space-y-6 font-sans w-full max-w-[1600px] mx-auto pb-12">
      
      {/* Header */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-6 h-6 text-[#e20d65]" />
            <h1 className="text-2xl font-black text-[#1c023d] tracking-tight">System Audit Trail</h1>
          </div>
          <p className="text-xs text-slate-500">
            Immutable chronological audit log of all stock dispatches, request approvals, vendor receipts, and admin user actions.
          </p>
        </div>

        <div className="flex items-center gap-3 font-bold text-xs">
          <button
            onClick={fetchLogs}
            className="px-3.5 py-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 shadow-sm transition flex items-center gap-2"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm flex justify-between items-center">
        <p className="text-xs font-extrabold text-[#1c023d]">Audit Log Entries ({filteredLogs.length})</p>
        <div className="relative min-w-[280px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search action, user, or event description..."
            className="w-full pl-9 pr-3.5 py-1.5 rounded border border-slate-300 text-xs focus:outline-none focus:border-[#e20d65]"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden w-full">
        <div className="max-h-[620px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200 z-10 shadow-xs">
              <tr>
                <th className="py-3 px-4">Log ID</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Action Event</th>
                <th className="py-3 px-4">Details</th>
                <th className="py-3 px-4 font-mono">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredLogs.map((l) => (
                <tr key={l.log_id} className="hover:bg-purple-50/40 even:bg-slate-50/40 transition">
                  <td className="py-2.5 px-4 font-mono font-bold text-slate-400 text-xs">#LOG-00{l.log_id}</td>
                  <td className="py-2.5 px-4 font-mono text-slate-500 text-xs">
                    {new Date(l.timestamp).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-4 font-extrabold text-[#1c023d]">{l.user_name || 'System'}</td>
                  <td className="py-2.5 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-100 text-slate-700 border border-slate-200">
                      {l.user_role || 'SYSTEM'}
                    </span>
                  </td>
                  <td className="py-2.5 px-4">
                    <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-purple-50 text-[#6700ce] border border-purple-200">
                      {l.action}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-slate-700 font-medium text-xs max-w-md truncate">
                    {l.details}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-slate-400 text-xs">{l.ip_address || '127.0.0.1'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
