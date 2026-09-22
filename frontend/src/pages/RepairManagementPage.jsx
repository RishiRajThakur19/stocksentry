import React, { useState, useEffect } from 'react';
import { 
  Wrench, ShieldCheck, CheckCircle2, XCircle, AlertTriangle, 
  MapPin, Phone, Building2, Package, ArrowRight, Trash2, RefreshCw,
  FileCheck, Award, Cpu, Sparkles, Check, Printer, Clock, FileText,
  User, CheckSquare, Layers, Gauge
} from 'lucide-react';
import api from '../api/client';

export const RepairManagementPage = ({ userRole = 'SUPER_ADMIN' }) => {
  const [locations, setLocations] = useState([]);
  const [repairRequests, setRepairRequests] = useState([]);
  const [decomRequests, setDecomRequests] = useState([]);
  const [activeSubTab, setActiveSubTab] = useState('requests'); // 'requests', 'decommission', 'facilities'
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Enterprise Work Order Modal State
  const [selectedRequestForComplete, setSelectedRequestForComplete] = useState(null);
  const [workOrderStep, setWorkOrderStep] = useState(1);
  const [technicianName, setTechnicianName] = useState('Er. Deepak Sharma (Lead RF Engineer)');
  const [benchStation, setBenchStation] = useState('Precision Fusion Splicing Bay #3');
  const [selectedParts, setSelectedParts] = useState(['V-Groove Optical Alignment Block', 'High-Voltage Fusion Electrode Pair']);
  const [laborHours, setLaborHours] = useState(3.5);
  const [opticalLossDb, setOpticalLossDb] = useState(0.02);
  const [burnInHours, setBurnInHours] = useState(4.0);
  const [qaSignoff, setQaSignoff] = useState(true);
  const [completionAction, setCompletionAction] = useState('RETURN_TO_WAREHOUSE');
  const [completionNotes, setCompletionNotes] = useState('');
  
  // Calibration Certificate Modal State
  const [viewCertificateReq, setViewCertificateReq] = useState(null);

  // Approval Modal State
  const [selectedRepairLocId, setSelectedRepairLocId] = useState('');
  const [selectedRequestForApprove, setSelectedRequestForApprove] = useState(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  const availableSpareParts = [
    { name: 'V-Groove Optical Alignment Block', code: 'PRT-VG-881', cost: 1850 },
    { name: 'High-Voltage Fusion Electrode Pair', code: 'PRT-EL-220', cost: 920 },
    { name: 'Optical Laser Diode (1310/1490nm)', code: 'PRT-LD-404', cost: 3200 },
    { name: 'Power Transceiver DC-DC Converter', code: 'PRT-PWR-119', cost: 650 },
    { name: 'Gigabit PHY Interface Module', code: 'PRT-PHY-992', cost: 1400 },
    { name: 'High-Impact Enclosure Rubber Bezel', code: 'PRT-ENC-041', cost: 450 }
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [locsRes, repairsRes, decomsRes] = await Promise.all([
        api.get('/repairs/locations'),
        api.get('/repairs/requests'),
        api.get('/decommission/requests')
      ]);
      setLocations(locsRes.data);
      setRepairRequests(repairsRes.data);
      setDecomRequests(decomsRes.data);
      if (locsRes.data.length > 0) {
        setSelectedRepairLocId(locsRes.data[0].repair_location_id.toString());
      }
    } catch (err) {
      console.error('Failed to fetch repair management data:', err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const handleApproveRepair = async () => {
    if (!selectedRequestForApprove || !selectedRepairLocId) return;
    setActionLoading(true);
    try {
      await api.put(`/repairs/requests/${selectedRequestForApprove.repair_request_id}/approve`, {
        repair_location_id: parseInt(selectedRepairLocId),
        notes: approvalNotes
      });
      showToast(`Repair Request #${selectedRequestForApprove.repair_request_id} approved & dispatched to regional lab bench!`);
      setSelectedRequestForApprove(null);
      setApprovalNotes('');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to approve repair.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectRepair = async (reqId) => {
    if (!window.confirm('Are you sure you want to reject this repair request?')) return;
    try {
      await api.put(`/repairs/requests/${reqId}/reject`, { notes: 'Rejected by Regional Admin' });
      showToast(`Repair Request #${reqId} rejected.`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to reject repair.');
    }
  };

  const openCompleteModal = (req) => {
    setSelectedRequestForComplete(req);
    setWorkOrderStep(1);
    setCompletionAction('RETURN_TO_TECHNICIAN');
    setCompletionNotes(`Completed optical core realignment and certified against ISO 9001 bench thresholds.`);
  };

  const togglePartSelection = (partName) => {
    if (selectedParts.includes(partName)) {
      setSelectedParts(selectedParts.filter(p => p !== partName));
    } else {
      setSelectedParts([...selectedParts, partName]);
    }
  };

  const handleCompleteRepair = async () => {
    if (!selectedRequestForComplete) return;
    setActionLoading(true);
    try {
      const certNo = `CAL-TATA-2026-0${selectedRequestForComplete.repair_request_id.toString().padStart(4, '0')}`;
      await api.put(`/repairs/requests/${selectedRequestForComplete.repair_request_id}/complete`, {
        resolution_action: completionAction,
        notes: completionNotes,
        technician_name: technicianName,
        bench_station: benchStation,
        parts_replaced: selectedParts,
        labor_hours: parseFloat(laborHours) || 3.0,
        calibration_certificate_no: certNo,
        optical_loss_db: parseFloat(opticalLossDb) || 0.02,
        burn_in_hours: parseFloat(burnInHours) || 4.0,
        qa_signoff: qaSignoff
      });

      let toastMsg = '';
      if (completionAction === 'RETURN_TO_TECHNICIAN') {
        toastMsg = `Device QA certified (Cert #${certNo}) & reassigned directly to Field Technician (${selectedRequestForComplete.requester_name || 'toolbag'})!`;
      } else if (completionAction === 'RETURN_TO_CITY_HUB') {
        toastMsg = `Device QA certified (Cert #${certNo}) & restocked into ${selectedRequestForComplete.city_name || 'City Hub'} stock pool!`;
      } else if (completionAction === 'RETURN_TO_WAREHOUSE') {
        toastMsg = `Device QA certified (Cert #${certNo}) & restocked into Central Warehouse national inventory pool!`;
      } else {
        toastMsg = 'Device condemned Beyond Economical Repair (BER) and routed to Central Scrap yard.';
      }

      showToast(toastMsg);
      setSelectedRequestForComplete(null);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to complete enterprise repair work order.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveDecom = async (decomId) => {
    if (!window.confirm('Permanently approve decommissioning and scrapping of this asset?')) return;
    try {
      await api.put(`/decommission/requests/${decomId}/approve`);
      showToast(`Asset #${decomId} approved for decommission and recorded in scrap archives.`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to approve decommission.');
    }
  };

  const handleRejectDecom = async (decomId) => {
    try {
      await api.put(`/decommission/requests/${decomId}/reject`);
      showToast(`Decommission request #${decomId} rejected.`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to reject decommission.');
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans w-full max-w-[1500px] mx-auto">
      
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-gradient-to-br from-amber-600 to-amber-700 text-white shadow-sm">
              <Wrench className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-[#1c023d] tracking-tight">Enterprise Repair & Scrap Governance</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-200">
                  Tata Central Standard
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Precision lab diagnostics, spare parts replacement manifest, ISO 9001 QA calibration certification, and end-of-life decommission approvals.
              </p>
            </div>
          </div>
        </div>

        {/* Subtabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-bold">
          <button
            onClick={() => setActiveSubTab('requests')}
            className={`px-3.5 py-1.5 rounded-lg transition ${
              activeSubTab === 'requests' ? 'bg-white text-[#1c023d] shadow-sm font-black' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Repair Work Orders ({repairRequests.filter(r => r.status === 'PENDING' || r.status === 'IN_REPAIR').length})
          </button>
          <button
            onClick={() => setActiveSubTab('decommission')}
            className={`px-3.5 py-1.5 rounded-lg transition ${
              activeSubTab === 'decommission' ? 'bg-white text-[#1c023d] shadow-sm font-black' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Decommission Queue ({decomRequests.filter(d => d.status === 'PENDING').length})
          </button>
          <button
            onClick={() => setActiveSubTab('facilities')}
            className={`px-3.5 py-1.5 rounded-lg transition ${
              activeSubTab === 'facilities' ? 'bg-white text-[#1c023d] shadow-sm font-black' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Regional Lab Facilities ({locations.length})
          </button>
        </div>
      </div>

      {toastMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-fade-in shadow-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{toastMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl p-16 border border-slate-200 text-center space-y-3">
          <div className="w-10 h-10 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 font-bold text-xs">Loading regional hardware repair work orders and lab telemetry...</p>
        </div>
      ) : (
        <>
          {/* Subtab 1: Repair Requests Queue */}
          {activeSubTab === 'requests' && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-sm font-black text-[#1c023d] flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-amber-600" />
                    Central & Regional Hardware Repair Work Orders
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Track hardware intake, lab bench rework, QA calibration certification, and restock dispositions.
                  </p>
                </div>
                <button onClick={fetchData} className="text-xs font-bold text-[#6700ce] hover:underline flex items-center gap-1.5 bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-100">
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh Queue
                </button>
              </div>

              {repairRequests.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-medium">No active repair work orders in queue.</div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200 text-[11px]">
                      <tr>
                        <th className="py-3 px-3.5">WO ID</th>
                        <th className="py-3 px-3.5">Device & Serial</th>
                        <th className="py-3 px-3.5">Territory</th>
                        <th className="py-3 px-3.5">Reported Defect</th>
                        <th className="py-3 px-3.5">Work Order Stage</th>
                        <th className="py-3 px-3.5">Assigned Lab Facility</th>
                        <th className="py-3 px-3.5 text-right">Enterprise Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {repairRequests.map((req) => (
                        <tr key={req.repair_request_id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-3.5 font-mono font-bold text-slate-400">
                            #{req.repair_request_id}
                          </td>
                          <td className="py-3 px-3.5">
                            <span className="font-black text-[#1c023d] block">{req.item_name}</span>
                            <span className="font-mono text-[11px] text-purple-800 font-bold">SN: {req.serial_number}</span>
                          </td>
                          <td className="py-3 px-3.5">
                            <span className="font-bold text-slate-800 block">{req.city_name}</span>
                            <span className="text-[10px] text-slate-400 font-bold">{req.region_name}</span>
                          </td>
                          <td className="py-3 px-3.5 text-slate-700 max-w-xs">
                            <p className="line-clamp-2">{req.notes || 'Routine hardware fault inspection'}</p>
                          </td>
                          <td className="py-3 px-3.5">
                            {req.status === 'PENDING' && (
                              <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200">
                                Pending Lab Triage
                              </span>
                            )}
                            {req.status === 'IN_REPAIR' && (
                              <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-purple-50 text-purple-700 border border-purple-200">
                                In Lab Bench Rework
                              </span>
                            )}
                            {req.status === 'REPAIR_RETURNED' && (
                              <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 w-max">
                                <CheckCircle2 className="w-3 h-3" /> QA Certified & Restocked
                              </span>
                            )}
                            {req.status === 'ROUTED_TO_SCRAP' && (
                              <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-rose-50 text-rose-700 border border-rose-200">
                                Condemned / BER
                              </span>
                            )}
                            {req.status === 'REJECTED' && (
                              <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-slate-100 text-slate-600 border border-slate-200">
                                Rejected
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-slate-600">
                            {req.repair_location_name ? (
                              <span className="font-bold text-slate-800 flex items-center gap-1">
                                <Wrench className="w-3.5 h-3.5 text-amber-600" />
                                {req.repair_location_name}
                              </span>
                            ) : (
                              <span className="text-slate-400">Unassigned Facility</span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-right">
                            {req.status === 'PENDING' && (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setSelectedRequestForApprove(req)}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition shadow-sm"
                                >
                                  Authorize Intake
                                </button>
                                <button
                                  onClick={() => handleRejectRepair(req.repair_request_id)}
                                  className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] border border-rose-200 transition"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                            {req.status === 'IN_REPAIR' && (
                              <button
                                onClick={() => openCompleteModal(req)}
                                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#6700ce] to-[#e20d65] hover:opacity-95 text-white font-extrabold text-[11px] transition shadow-sm flex items-center gap-1.5 ml-auto"
                              >
                                <FileCheck className="w-3.5 h-3.5" />
                                <span>Bench Work Order & QA</span>
                              </button>
                            )}
                            {req.status === 'REPAIR_RETURNED' && (
                              <button
                                onClick={() => setViewCertificateReq(req)}
                                className="px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-[#6700ce] border border-purple-200 font-bold text-[11px] transition flex items-center gap-1 ml-auto"
                              >
                                <Award className="w-3.5 h-3.5" />
                                <span>View QA Certificate</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Subtab 2: Decommission / Scrap Queue */}
          {activeSubTab === 'decommission' && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-sm font-black text-[#1c023d] flex items-center gap-2">
                    <Trash2 className="w-4 h-4 text-rose-600" />
                    Central Decommission & E-Waste Scrap Approval Queue
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Dual manager sign-off for retired, damaged, or Beyond Economical Repair (BER) assets.
                  </p>
                </div>
                <span className="text-xs text-slate-400 font-bold font-mono">ISO 14001 E-Waste Compliance</span>
              </div>

              {decomRequests.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-medium">No pending decommission requests.</div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200 text-[11px]">
                      <tr>
                        <th className="py-3 px-3.5">Decom ID</th>
                        <th className="py-3 px-3.5">Device & Serial</th>
                        <th className="py-3 px-3.5">Region</th>
                        <th className="py-3 px-3.5">Condemnation Reason</th>
                        <th className="py-3 px-3.5">Status</th>
                        <th className="py-3 px-3.5 text-right">Executive Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {decomRequests.map((decom) => (
                        <tr key={decom.decommission_id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-3.5 font-mono font-bold text-slate-400">
                            #{decom.decommission_id}
                          </td>
                          <td className="py-3 px-3.5">
                            <span className="font-black text-[#1c023d] block">{decom.item_name}</span>
                            <span className="font-mono text-[11px] text-purple-800 font-bold">SN: {decom.serial_number}</span>
                          </td>
                          <td className="py-3 px-3.5 font-bold text-slate-700">
                            {decom.region_name}
                          </td>
                          <td className="py-3 px-3.5 text-slate-700 max-w-sm">
                            <p className="line-clamp-2 font-medium">{decom.reason}</p>
                          </td>
                          <td className="py-3 px-3.5">
                            {decom.status === 'PENDING' ? (
                              <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200">
                                Pending Central Sign-Off
                              </span>
                            ) : decom.status === 'APPROVED' ? (
                              <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-300 font-bold">
                                Scrapped & Recycled
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-slate-100 text-slate-600 border border-slate-200">
                                Rejected
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-right">
                            {decom.status === 'PENDING' && (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleApproveDecom(decom.decommission_id)}
                                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] transition shadow-sm"
                                >
                                  Confirm Scrap
                                </button>
                                <button
                                  onClick={() => handleRejectDecom(decom.decommission_id)}
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition"
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
          )}

          {/* Subtab 3: Repair Facilities Directory */}
          {activeSubTab === 'facilities' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {locations.map((loc) => (
                <div key={loc.repair_location_id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                        {loc.region_name}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-400">Lab #{loc.repair_location_id}</span>
                    </div>

                    <h3 className="text-sm font-black text-[#1c023d]">{loc.name}</h3>
                    <p className="text-xs text-slate-500 flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
                      <span>{loc.address || `${loc.city_name} Hub Regional Workshop`}</span>
                    </p>
                    <p className="text-xs text-slate-500 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-mono">{loc.contact_phone || '+91 1800 209 0000'}</span>
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-bold">Active Bench Load:</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-50 text-amber-800 border border-amber-200">
                      {loc.active_repairs_count} Devices
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal: Approve Repair Request & Select Facility */}
      {selectedRequestForApprove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-black text-[#1c023d] border-b border-slate-100 pb-3">
              Authorize Hardware Intake & Route to Lab
            </h3>
            
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
              <span className="font-black text-slate-800 block">Device: {selectedRequestForApprove.item_name}</span>
              <span className="font-mono text-purple-800 font-bold block">SN: {selectedRequestForApprove.serial_number}</span>
              <span className="text-slate-500 block">Symptom: {selectedRequestForApprove.notes}</span>
            </div>

            <div className="text-xs space-y-1.5">
              <label className="block text-slate-700 font-bold">Assign Lab Facility *</label>
              <select
                value={selectedRepairLocId}
                onChange={(e) => setSelectedRepairLocId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-800 bg-white"
              >
                {locations.map((loc) => (
                  <option key={loc.repair_location_id} value={loc.repair_location_id}>
                    {loc.name} ({loc.city_name} • {loc.region_name})
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs space-y-1.5">
              <label className="block text-slate-700 font-bold">Intake Directive / Notes</label>
              <input
                type="text"
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="e.g. Priority rework on laser collimator"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-medium"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 text-xs">
              <button
                onClick={() => setSelectedRequestForApprove(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold"
              >
                Cancel
              </button>
              <button
                disabled={actionLoading}
                onClick={handleApproveRepair}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-sm"
              >
                {actionLoading ? 'Routing...' : 'Confirm Lab Intake'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enterprise Multi-Stage Repair Work Order Modal */}
      {selectedRequestForComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-[#1c023d]">
                  Enterprise Bench Work Order & QA Certification
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  WO #{selectedRequestForComplete.repair_request_id} • SN: {selectedRequestForComplete.serial_number}
                </span>
              </div>
              <button 
                onClick={() => setSelectedRequestForComplete(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Stepper Navigation */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              {[
                { step: 1, label: '1. Triage & Intake' },
                { step: 2, label: '2. Bench Parts' },
                { step: 3, label: '3. QA Calibration' },
                { step: 4, label: '4. Disposition' }
              ].map((s) => (
                <button
                  key={s.step}
                  onClick={() => setWorkOrderStep(s.step)}
                  className={`py-2 px-1 rounded-xl font-bold border transition ${
                    workOrderStep === s.step
                      ? 'bg-[#1c023d] text-white border-[#1c023d] shadow-sm'
                      : workOrderStep > s.step
                      ? 'bg-purple-50 text-[#6700ce] border-purple-200'
                      : 'bg-slate-50 text-slate-500 border-slate-200'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Step 1: Intake & Triage Inspection */}
            {workOrderStep === 1 && (
              <div className="space-y-4 text-xs animate-fade-in">
                <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-200 space-y-1">
                  <span className="font-black text-[#1c023d] block">{selectedRequestForComplete.item_name}</span>
                  <span className="text-slate-600 block">Reported Symptom: <em>{selectedRequestForComplete.notes}</em></span>
                  <span className="text-[10px] text-purple-800 font-mono font-bold block">
                    Assigned Facility: {selectedRequestForComplete.repair_location_name || 'Regional Lab'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Diagnostic Fault Classification</label>
                    <select className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-slate-800 bg-white">
                      <option>Optical Fiber Core Misalignment</option>
                      <option>PON RX/TX Laser Degradation</option>
                      <option>Electrode Arc High-Voltage Leak</option>
                      <option>Power Rail Voltage Fluctuation</option>
                      <option>Physical Chassis Impact Damage</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Inbound Logistics AWB / RMA #</label>
                    <input 
                      type="text" 
                      defaultValue={`AWB-TPF-LOG-${selectedRequestForComplete.repair_request_id}892`} 
                      className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-bold" 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="font-bold text-slate-700 block">Pre-Bench Physical Inspection Checklist</label>
                  <div className="grid grid-cols-2 gap-2 text-slate-700 font-medium">
                    <label className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
                      <input type="checkbox" defaultChecked className="text-[#6700ce]" />
                      <span>Housing & Rubber Bezels Intact</span>
                    </label>
                    <label className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
                      <input type="checkbox" defaultChecked className="text-[#6700ce]" />
                      <span>No Water Ingress Detected</span>
                    </label>
                    <label className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
                      <input type="checkbox" defaultChecked className="text-[#6700ce]" />
                      <span>SC/APC Optical Ferrule Clean</span>
                    </label>
                    <label className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
                      <input type="checkbox" defaultChecked className="text-[#6700ce]" />
                      <span>DC Ground Continuity Intact</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Bench Work Order & Parts Manifest */}
            {workOrderStep === 2 && (
              <div className="space-y-4 text-xs animate-fade-in">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Lead RF / Optical Technician</label>
                    <input
                      type="text"
                      value={technicianName}
                      onChange={(e) => setTechnicianName(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Bench Workstation / Lab Bay</label>
                    <input
                      type="text"
                      value={benchStation}
                      onChange={(e) => setBenchStation(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700 block">Select Replaced / Consumed Spare Parts</label>
                    <span className="text-[10px] text-slate-400 font-mono">Total Selected: {selectedParts.length}</span>
                  </div>
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {availableSpareParts.map((part) => (
                      <div
                        key={part.code}
                        onClick={() => togglePartSelection(part.name)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                          selectedParts.includes(part.name)
                            ? 'bg-purple-50 border-purple-300 text-purple-900 font-bold'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedParts.includes(part.name)}
                            onChange={() => {}}
                            className="text-[#6700ce]"
                          />
                          <div>
                            <span className="block text-xs">{part.name}</span>
                            <span className="text-[10px] font-mono text-slate-400">{part.code}</span>
                          </div>
                        </div>
                        <span className="font-mono text-xs font-black text-[#6700ce]">₹{part.cost}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Labor Hours Logged</label>
                    <input
                      type="number"
                      step="0.5"
                      value={laborHours}
                      onChange={(e) => setLaborHours(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Estimated Repair Cost</label>
                    <div className="p-2.5 rounded-xl bg-slate-100 font-mono font-black text-slate-800 text-xs">
                      ₹{selectedParts.length * 1250 + (parseFloat(laborHours) || 0) * 400} (Bill of Materials + Labor)
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: QA Calibration & Telemetry Sign-off */}
            {workOrderStep === 3 && (
              <div className="space-y-4 text-xs animate-fade-in">
                <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1 flex items-center justify-between">
                  <div>
                    <span className="font-black text-emerald-900 block text-xs">ISO 9001:2015 Precision Standards</span>
                    <span className="text-[11px] text-emerald-700">All telecom hardware must undergo calibrated attenuation and burn-in testing.</span>
                  </div>
                  <Award className="w-8 h-8 text-emerald-600 shrink-0" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Measured Optical Loss (dB)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={opticalLossDb}
                      onChange={(e) => setOpticalLossDb(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-black text-[#1c023d]"
                    />
                    <span className="text-[10px] text-slate-400">Target Standard: &lt; 0.05 dB</span>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Burn-in Stress Test Duration (Hrs)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={burnInHours}
                      onChange={(e) => setBurnInHours(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-black text-[#1c023d]"
                    />
                    <span className="text-[10px] text-slate-400">Target Standard: 4.0 Hours continuous</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={qaSignoff}
                      onChange={(e) => setQaSignoff(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                    <span className="font-black text-slate-800 text-xs">
                      QA Senior Inspector Electrical & Optical Sign-Off
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-500 pl-6">
                    I verify that this device has successfully passed all optical core alignment, high-voltage spark isolation, and throughput load tests in accordance with Tata Central Network Engineering Guidelines.
                  </p>
                </div>
              </div>
            )}

            {/* Step 4: Disposition & Hardware Allocation Decision */}
            {workOrderStep === 4 && (
              <div className="space-y-4 text-xs animate-fade-in">
                <div className="space-y-2">
                  <label className="block text-slate-700 font-bold">Final Resolution & Hardware Allocation *</label>
                  <p className="text-[11px] text-slate-500">
                    Select where this certified, calibrated device should be returned upon signing off the work order:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    
                    {/* Option 1: Return to Field Technician */}
                    <label className={`p-3.5 rounded-xl border cursor-pointer flex flex-col justify-between transition ${
                      completionAction === 'RETURN_TO_TECHNICIAN' 
                        ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-400/20 shadow-sm' 
                        : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
                    }`}>
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="woAction"
                              checked={completionAction === 'RETURN_TO_TECHNICIAN'}
                              onChange={() => setCompletionAction('RETURN_TO_TECHNICIAN')}
                              className="text-purple-600"
                            />
                            <span className="font-black text-purple-950 text-xs">Return to Field Technician</span>
                          </div>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-purple-100 text-purple-800 border border-purple-200 uppercase">
                            Toolbag Custody
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-600 mt-2 block leading-relaxed">
                          Reassign calibrated device directly back to <strong className="text-slate-800">{selectedRequestForComplete?.requester_name || 'Originating Technician'}</strong> for active FTTH fieldwork in {selectedRequestForComplete?.city_name || 'City Hub'}.
                        </span>
                      </div>
                    </label>

                    {/* Option 2: Return to City Hub Stock */}
                    <label className={`p-3.5 rounded-xl border cursor-pointer flex flex-col justify-between transition ${
                      completionAction === 'RETURN_TO_CITY_HUB' 
                        ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-400/20 shadow-sm' 
                        : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
                    }`}>
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="woAction"
                              checked={completionAction === 'RETURN_TO_CITY_HUB'}
                              onChange={() => setCompletionAction('RETURN_TO_CITY_HUB')}
                              className="text-blue-600"
                            />
                            <span className="font-black text-blue-950 text-xs">Return to {selectedRequestForComplete?.city_name || 'City'} Hub Stock</span>
                          </div>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-100 text-blue-800 border border-blue-200 uppercase">
                            City Inventory
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-600 mt-2 block leading-relaxed">
                          Restock into <strong className="text-slate-800">{selectedRequestForComplete?.city_name || 'City Hub'}</strong> warehouse inventory pool for local buffer or reissuing by the City Hub Manager.
                        </span>
                      </div>
                    </label>

                    {/* Option 3: Return to Central Warehouse */}
                    <label className={`p-3.5 rounded-xl border cursor-pointer flex flex-col justify-between transition ${
                      completionAction === 'RETURN_TO_WAREHOUSE' 
                        ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-400/20 shadow-sm' 
                        : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
                    }`}>
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="woAction"
                              checked={completionAction === 'RETURN_TO_WAREHOUSE'}
                              onChange={() => setCompletionAction('RETURN_TO_WAREHOUSE')}
                              className="text-emerald-600"
                            />
                            <span className="font-black text-emerald-950 text-xs">Recommission to Central Stock</span>
                          </div>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase">
                            National Pool
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-600 mt-2 block leading-relaxed">
                          Ship device back to Central Warehouse national repository with an ISO 9001 quality certificate and +12m warranty.
                        </span>
                      </div>
                    </label>

                    {/* Option 4: Route to Scrap */}
                    <label className={`p-3.5 rounded-xl border cursor-pointer flex flex-col justify-between transition ${
                      completionAction === 'ROUTE_TO_SCRAP' 
                        ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-400/20 shadow-sm' 
                        : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
                    }`}>
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="woAction"
                              checked={completionAction === 'ROUTE_TO_SCRAP'}
                              onChange={() => setCompletionAction('ROUTE_TO_SCRAP')}
                              className="text-rose-600"
                            />
                            <span className="font-black text-rose-950 text-xs">Condemn to Central Scrap Yard</span>
                          </div>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-100 text-rose-800 border border-rose-200 uppercase">
                            Scrap & Decom
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-600 mt-2 block leading-relaxed">
                          Beyond Economical Repair (BER). Routes directly to decommission queue for certified scrapping and salvage.
                        </span>
                      </div>
                    </label>

                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-slate-700 font-bold">Technician Summary Log</label>
                  <textarea
                    rows={2}
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-medium"
                    placeholder="Enter technician notes..."
                  />
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs">
              <button
                disabled={workOrderStep === 1}
                onClick={() => setWorkOrderStep(workOrderStep - 1)}
                className={`px-3.5 py-2 rounded-xl font-bold transition ${
                  workOrderStep === 1 ? 'opacity-40 cursor-not-allowed text-slate-400' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Back
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedRequestForComplete(null)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                {workOrderStep < 4 ? (
                  <button
                    onClick={() => setWorkOrderStep(workOrderStep + 1)}
                    className="px-4 py-2 rounded-xl bg-[#1c023d] hover:bg-[#340866] text-white font-black shadow-sm"
                  >
                    Continue to Next Stage →
                  </button>
                ) : (
                  <button
                    disabled={actionLoading}
                    onClick={handleCompleteRepair}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:opacity-95 text-white font-black shadow-md flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{actionLoading ? 'Certifying...' : 'Sign & Complete Work Order'}</span>
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Official ISO 9001 QA Calibration Certificate Modal */}
      {viewCertificateReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl w-full max-w-lg p-6 space-y-5 text-xs text-slate-800">
            
            {/* Header / Crest */}
            <div className="text-center border-b-2 border-[#1c023d] pb-4 space-y-1">
              <div className="flex items-center justify-center gap-2">
                <span className="font-mono font-black text-lg text-[#1c023d] tracking-wider">TATA PLAY FIBER</span>
                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-purple-100 text-[#6700ce]">
                  ISO 9001:2015
                </span>
              </div>
              <h2 className="text-sm font-black uppercase tracking-wide text-slate-900">
                Hardware Quality & Calibration Certificate
              </h2>
              <span className="text-[10px] font-mono text-slate-400 block">
                Certificate ID: {viewCertificateReq.work_order_meta?.calibration_certificate_no || `CAL-TATA-2026-0${viewCertificateReq.repair_request_id.toString().padStart(4, '0')}`}
              </span>
            </div>

            {/* Certificate Details Matrix */}
            <div className="grid grid-cols-2 gap-2 text-[11px] p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <span className="text-slate-400 font-bold block">Equipment / Model:</span>
                <span className="font-black text-[#1c023d]">{viewCertificateReq.item_name}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block">Serial Number:</span>
                <span className="font-mono font-black text-purple-900">{viewCertificateReq.serial_number}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block">Calibration Center:</span>
                <span className="font-bold text-slate-800">{viewCertificateReq.repair_location_name || 'Mumbai Central Precision Lab'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block">Cert Date:</span>
                <span className="font-mono text-slate-800 font-bold">{new Date(viewCertificateReq.updated_at).toLocaleDateString('en-IN')}</span>
              </div>
            </div>

            {/* Technical Verification Telemetry */}
            <div className="space-y-1.5">
              <h4 className="font-black text-xs text-[#1c023d] uppercase tracking-wider">Bench Test Telemetry</h4>
              <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                  <span className="text-slate-500 font-bold block">Insertion Loss</span>
                  <span className="font-mono font-black text-emerald-800 text-xs">
                    {viewCertificateReq.work_order_meta?.optical_loss_db || 0.02} dB
                  </span>
                  <span className="text-[9px] text-emerald-600 block">PASS (&lt;0.05)</span>
                </div>
                <div className="p-2 rounded-lg bg-sky-50 border border-sky-200">
                  <span className="text-slate-500 font-bold block">Burn-In Duration</span>
                  <span className="font-mono font-black text-sky-800 text-xs">
                    {viewCertificateReq.work_order_meta?.burn_in_hours || 4.0} Hours
                  </span>
                  <span className="text-[9px] text-sky-600 block">100% PASS</span>
                </div>
                <div className="p-2 rounded-lg bg-purple-50 border border-purple-200">
                  <span className="text-slate-500 font-bold block">Ground Resistance</span>
                  <span className="font-mono font-black text-purple-800 text-xs">&lt; 0.1 Ω</span>
                  <span className="text-[9px] text-purple-600 block">CERTIFIED</span>
                </div>
              </div>
            </div>

            {/* Replaced Parts Manifest */}
            <div className="space-y-1">
              <h4 className="font-black text-xs text-[#1c023d] uppercase tracking-wider">Replaced Sub-Assemblies</h4>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-700">
                {viewCertificateReq.work_order_meta?.parts_replaced?.length > 0 
                  ? viewCertificateReq.work_order_meta.parts_replaced.join(', ')
                  : 'V-Groove Precision Alignment Block, High-Voltage Fusion Electrode Pair'}
              </div>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-200 text-[10px]">
              <div>
                <span className="text-slate-400 font-bold block">Assigned Engineer:</span>
                <span className="font-black text-slate-900 block mt-1">
                  {viewCertificateReq.work_order_meta?.technician_name || 'Er. Deepak Sharma'}
                </span>
                <span className="text-[9px] text-slate-400 italic">Lead Optical RF Lab</span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 font-bold block">Quality Assurance Stamp:</span>
                <span className="inline-block mt-1 px-2.5 py-0.5 rounded font-black text-emerald-800 bg-emerald-100 border border-emerald-300">
                  APPROVED FOR NETWORK DEPLOYMENT
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold flex items-center gap-1 text-xs"
              >
                <Printer className="w-3.5 h-3.5" /> Print Certificate
              </button>
              <button
                onClick={() => setViewCertificateReq(null)}
                className="px-4 py-1.5 rounded-lg bg-[#1c023d] text-white font-extrabold text-xs shadow-sm"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

