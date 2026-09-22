import React, { useState, useEffect } from 'react';
import { 
  ArrowLeftRight, CheckCircle2, XCircle, AlertTriangle, 
  MapPin, User, ArrowRight, RefreshCw, Send, ShieldCheck
} from 'lucide-react';
import api from '../api/client';

export const AssetTransferPage = ({ userRole = 'MANAGER' }) => {
  const [transfers, setTransfers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [users, setUsers] = useState([]);
  const [myCityAssets, setMyCityAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [transferType, setTransferType] = useState('SAME_CITY'); // 'SAME_CITY', 'CROSS_CITY'
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [targetCityId, setTargetCityId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [transfersRes, locsRes, usersRes] = await Promise.all([
        api.get('/transfers'),
        api.get('/inventory/locations'),
        api.get('/users')
      ]);
      setTransfers(transfersRes.data);
      setLocations(locsRes.data);
      setUsers(usersRes.data);

      if (locsRes.data.length > 0) {
        setTargetCityId(locsRes.data[0].location_id.toString());
      }
      if (usersRes.data.length > 0) {
        setTargetUserId(usersRes.data[0].user_id.toString());
      }

      // Fetch sample search for initial city assets
      const sampleAssetRes = await api.get('/lifecycle/search?serial_number=TPF-NOK-W6-10001');
      if (sampleAssetRes.data) {
        setMyCityAssets([sampleAssetRes.data]);
        setSelectedAssetId(sampleAssetRes.data.asset_id.toString());
      }
    } catch (err) {
      console.error('Failed to fetch transfer data:', err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  const handleInitiateTransfer = async (e) => {
    e.preventDefault();
    if (!selectedAssetId) {
      alert('Please enter or select a valid asset ID.');
      return;
    }

    setSubmitting(true);
    try {
      if (transferType === 'SAME_CITY') {
        if (!targetUserId) {
          alert('Please select a recipient technician.');
          setSubmitting(false);
          return;
        }
        await api.post('/transfers/same-city', {
          asset_id: parseInt(selectedAssetId),
          to_user_id: parseInt(targetUserId),
          notes: notes
        });
        showToast('Same-city transfer completed instantly! Asset reassigned.');
      } else {
        if (!targetCityId) {
          alert('Please select a destination city hub.');
          setSubmitting(false);
          return;
        }
        await api.post('/transfers/cross-city', {
          asset_id: parseInt(selectedAssetId),
          to_city_id: parseInt(targetCityId),
          notes: notes
        });
        showToast('Cross-city transfer dispatched! Awaiting destination city manager acceptance.');
      }
      setNotes('');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to initiate transfer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptTransfer = async (transferId) => {
    try {
      await api.put(`/transfers/${transferId}/accept`);
      showToast('Transfer accepted into your City Hub!');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to accept transfer.');
    }
  };

  const handleRejectTransfer = async (transferId) => {
    try {
      await api.put(`/transfers/${transferId}/reject`, { notes: 'Rejected by destination manager' });
      showToast('Transfer rejected & returned to origin hub.');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to reject transfer.');
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans w-full max-w-[1500px] mx-auto">
      
      {/* Header Banner */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200">
              <ArrowLeftRight className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black text-[#1c023d] tracking-tight">Direct Asset Transfers & Inter-Hub Shipments</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Execute direct technician handoffs without warehouse transit or initiate cross-city equipment transfers with destination manager acceptance.
          </p>
        </div>
      </div>

      {toastMsg && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Grid: Left Transfer Form | Right Transfers Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (5/12): Initiate Transfer Card */}
        <div className="lg:col-span-5 bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-sm font-black text-[#1c023d] border-b border-slate-100 pb-3 flex items-center gap-2">
            <Send className="w-4 h-4 text-[#e20d65]" />
            Initiate Asset Transfer
          </h2>

          <form onSubmit={handleInitiateTransfer} className="space-y-4 text-xs">
            
            {/* Transfer Mode Selector */}
            <div className="space-y-1.5">
              <label className="block text-slate-700 font-bold">Transfer Type *</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTransferType('SAME_CITY')}
                  className={`p-3 rounded-xl border text-left font-bold transition flex flex-col justify-between ${
                    transferType === 'SAME_CITY'
                      ? 'bg-purple-50 border-[#6700ce] text-[#6700ce] ring-2 ring-purple-400/20'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <span className="text-xs font-black">Same-City Handoff</span>
                  <span className="text-[10px] text-slate-500 mt-1 font-normal">Direct tech-to-tech (instant)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTransferType('CROSS_CITY')}
                  className={`p-3 rounded-xl border text-left font-bold transition flex flex-col justify-between ${
                    transferType === 'CROSS_CITY'
                      ? 'bg-indigo-50 border-indigo-600 text-indigo-700 ring-2 ring-indigo-400/20'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <span className="text-xs font-black">Cross-City Transfer</span>
                  <span className="text-[10px] text-slate-500 mt-1 font-normal">Requires dest manager acceptance</span>
                </button>
              </div>
            </div>

            {/* Asset ID Input */}
            <div>
              <label className="block text-slate-700 font-bold mb-1">Asset ID / Serial Ref *</label>
              <input
                type="number"
                required
                value={selectedAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
                placeholder="e.g. 1"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold text-slate-900 focus:outline-none focus:border-[#e20d65]"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Asset #1 corresponds to modem TPF-NOK-W6-10001</span>
            </div>

            {transferType === 'SAME_CITY' ? (
              <div>
                <label className="block text-slate-700 font-bold mb-1">Select Destination Field Technician *</label>
                <select
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold text-slate-800 bg-white"
                >
                  {users.map((u) => (
                    <option key={u.user_id} value={u.user_id}>
                      {u.name} ({u.role} • {u.location_name})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-slate-700 font-bold mb-1">Select Destination City Hub *</label>
                <select
                  value={targetCityId}
                  onChange={(e) => setTargetCityId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold text-slate-800 bg-white"
                >
                  {locations.map((loc) => (
                    <option key={loc.location_id} value={loc.location_id}>
                      {loc.name} ({loc.city} • {loc.region_name})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-slate-700 font-bold mb-1">Transfer Notes / Reason</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Reassigned for urgent corporate fiber link installation"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-medium"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-lg bg-[#6700ce] hover:bg-[#5200a5] text-white font-extrabold shadow-sm transition flex items-center justify-center gap-2"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>{submitting ? 'Executing Transfer...' : 'Confirm & Execute Transfer'}</span>
            </button>

          </form>
        </div>

        {/* Right Column (7/12): Live Transfers Table */}
        <div className="lg:col-span-7 bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-black text-[#1c023d] flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-[#6700ce]" />
              Transfer Log & Destination Acceptance Queue
            </h2>
            <button onClick={fetchData} className="text-xs font-bold text-[#6700ce] hover:underline flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {transfers.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">No transfer records found.</div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-[500px]">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="py-3 px-3">Transfer ID</th>
                    <th className="py-3 px-3">Device & Serial</th>
                    <th className="py-3 px-3">Movement Route</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transfers.map((t) => (
                    <tr key={t.transfer_id} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-400">
                        #{t.transfer_id}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-extrabold text-[#1c023d] block">{t.item_name}</span>
                        <span className="font-mono text-[11px] text-purple-800 font-bold">SN: {t.serial_number}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5 font-bold text-slate-700">
                          <span>{t.from_user_name || t.from_city_name}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span className="text-purple-900">{t.to_user_name || t.to_city_name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {t.transfer_type === 'SAME_CITY' ? 'Same-City Handoff' : 'Inter-Hub Transit'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {t.status === 'COMPLETED' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Completed
                          </span>
                        ) : t.status === 'PENDING_ACCEPTANCE' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200">
                            Awaiting Acceptance
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-50 text-rose-700 border border-rose-200">
                            Rejected
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {t.status === 'PENDING_ACCEPTANCE' && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleAcceptTransfer(t.transfer_id)}
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition shadow-sm"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => handleRejectTransfer(t.transfer_id)}
                              className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] border border-rose-200 transition"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
