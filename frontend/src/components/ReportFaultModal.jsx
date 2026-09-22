import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Wrench, CheckCircle2, ShieldAlert } from 'lucide-react';
import api from '../api/client';

export const ReportFaultModal = ({ isOpen, onClose, onFaultReported, defaultAsset = null }) => {
  const [myAssets, setMyAssets] = useState([]);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [description, setDescription] = useState('');
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setSuccessMsg('');
      setDescription('');
      fetchMyAssets();
    }
  }, [isOpen]);

  const fetchMyAssets = async () => {
    setLoadingAssets(true);
    try {
      const res = await api.get('/lifecycle/my-assets');
      setMyAssets(res.data);
      if (defaultAsset) {
        setSelectedAssetId(defaultAsset.asset_id.toString());
      } else if (res.data.length > 0) {
        setSelectedAssetId(res.data[0].asset_id.toString());
      }
    } catch (err) {
      console.error('Failed to fetch assigned assets:', err);
    } finally {
      setLoadingAssets(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAssetId) {
      setErrorMsg('Please select an assigned equipment/device.');
      return;
    }
    if (!description.trim()) {
      setErrorMsg('Please describe the fault or issue symptom.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await api.post('/complaints', {
        asset_id: parseInt(selectedAssetId),
        description: description.trim()
      });

      setSuccessMsg(`Complaint #${res.data.complaint_id} logged successfully! Repair Request automatically routed to your City Manager & Regional Admin.`);
      onFaultReported?.();

      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Failed to submit fault report.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedAsset = myAssets.find(a => a.asset_id.toString() === selectedAssetId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#e20d65] to-[#b00a4d] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/20">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-black">Report Equipment Fault</h2>
              <p className="text-[11px] text-white/80">Log device malfunction for repair facility dispatch</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-bold flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-slate-700 font-extrabold mb-1">Select Assigned Equipment *</label>
            {loadingAssets ? (
              <div className="py-3 text-slate-400">Loading your assigned devices...</div>
            ) : myAssets.length === 0 ? (
              <div className="p-3 rounded bg-amber-50 border border-amber-200 text-amber-800 font-medium">
                No electronic equipment is currently assigned to your account.
              </div>
            ) : (
              <select
                value={selectedAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold text-slate-800 focus:outline-none focus:border-[#e20d65] bg-white"
              >
                {myAssets.map((a) => (
                  <option key={a.asset_id} value={a.asset_id}>
                    {a.item_name} ({a.variant_name}) — SN: {a.serial_number}
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedAsset && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-3">
              <img
                src={selectedAsset.image_url || '/assets/modem_nokia.png'}
                alt="Selected Device"
                className="w-12 h-12 object-contain bg-white rounded p-1 border border-slate-200"
              />
              <div>
                <h4 className="font-extrabold text-[#1c023d]">{selectedAsset.item_name}</h4>
                <p className="font-mono text-[11px] text-slate-500 font-bold">SN: {selectedAsset.serial_number}</p>
                <span className="text-[10px] text-purple-700 font-bold bg-purple-50 px-2 py-0.5 rounded border border-purple-200 inline-block mt-0.5">
                  Currently Assigned to You
                </span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-slate-700 font-extrabold mb-1">Describe Fault & Symptoms *</label>
            <textarea
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Optical PON laser signal loss / Red indicator light flashing / Core alignment failure during splicing"
              className="w-full p-3 rounded-lg border border-slate-300 text-slate-800 font-medium focus:outline-none focus:border-[#e20d65]"
            />
          </div>

          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-[11px] space-y-1">
            <span className="font-extrabold block">⚙️ Automated Routing Notice</span>
            <p>Submitting this fault report automatically logs a complaint and notifies your City Manager and Regional Admin to authorize pickup and transit to your regional Repair Facility.</p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || myAssets.length === 0}
              className="px-5 py-2 rounded-lg bg-[#e20d65] hover:bg-[#cc0059] disabled:opacity-50 text-white font-extrabold shadow-sm transition flex items-center gap-2"
            >
              <Wrench className="w-4 h-4" />
              <span>{submitting ? 'Submitting Report...' : 'Submit Fault Report'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
