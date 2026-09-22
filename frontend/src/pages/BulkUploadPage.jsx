import React, { useState } from 'react';
import { 
  Upload, FileSpreadsheet, Download, CheckCircle2, AlertTriangle, 
  XCircle, ArrowRight, UserPlus, RefreshCw, Sparkles, Copy, Check,
  Cpu, Layers, ShieldCheck, MapPin, Database, Award, Package, User
} from 'lucide-react';
import api from '../api/client';

export const BulkUploadPage = ({ userRole = 'SUPER_ADMIN' }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [enterpriseSummary, setEnterpriseSummary] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const aiPromptText = `Generate an Excel-compatible dataset (.xlsx) with 2 sheets for Tata Play Fiber enterprise inventory system:

Sheet 1: '1_Personnel_Roster'
Columns: Employee ID, Full Name, Email Address, Role, Region, City Hub, Phone Number
- Generate 1 Super Admin (Central Headquarters), 4 Regional Admins (North Region, West Region, South Region, East Region), 7 City Managers (Delhi, Mumbai, Pune, Bangalore, Hyderabad, Chennai, Kolkata), and 600 Field Workers / Salesmen distributed across the 7 cities.
- Use realistic Indian employee names and corporate emails matching @tataplay.com.
- Valid Roles: SUPER_ADMIN, REGIONAL_ADMIN, MANAGER, FIELD_WORKER.
- Valid Regions: North Region, West Region, South Region, East Region.
- Valid City Hubs: Delhi, Mumbai, Pune, Bangalore, Hyderabad, Chennai, Kolkata.

Sheet 2: '2_Serialized_Hardware_Kits'
Columns: Serial Number, Equipment Name, Variant / Model, Category, Unit Cost (INR), Assigned Employee Email / ID, Status, City Hub
- Assign 6 essential hardware devices to each of the 600 field workers (total 3,600 devices):
  1. Nokia Dual-Band Wi-Fi 6 GPON ONT (CPE Modems, Cost: 4500)
  2. Precision Fiber Core Alignment Splicer (Splicing Equipment, Cost: 85000)
  3. Smart Handheld OTDR Reflectometer (Testing & Measurement, Cost: 32000)
  4. High-Precision Optical Power Meter (Testing & Measurement, Cost: 3800)
  5. Visual Fault Locator Laser Pen (Field Tools, Cost: 1200)
  6. Single-Action Optical Fiber Cleaver (Field Tools, Cost: 4200)
- Link each device to the worker using their Email Address or Employee ID.
- Set Status to 'ASSIGNED' for staff devices, and add 50 'IN_WAREHOUSE' spare cable spools per city hub.
- Ensure all serial numbers are unique (e.g. TPF-NOK-10001, TPF-CLP-30001, TPF-OTDR-80001).`;

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(aiPromptText);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 3000);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewData(null);
      setEnterpriseSummary(null);
      setSuccessMsg('');
      setErrorMsg('');
      uploadAndProcess(file, false);
    }
  };

  const uploadAndProcess = async (file, commit = false) => {
    const formData = new FormData();
    formData.append('file', file);

    if (commit) {
      setCommitting(true);
    } else {
      setLoadingPreview(true);
    }
    setErrorMsg('');

    try {
      // First attempt enterprise multi-sheet ingestion
      const res = await api.post(`/users/bulk-upload-enterprise?commit=${commit}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setEnterpriseSummary(res.data);

      if (commit) {
        setSuccessMsg(res.data.message || `Successfully committed enterprise dataset to database!`);
      }
    } catch (err) {
      // If enterprise endpoint fails, fallback to standard user bulk upload
      try {
        const fallbackRes = await api.post(`/users/bulk-upload?commit=${commit}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setPreviewData(fallbackRes.data);
        if (commit) {
          setSuccessMsg(`Successfully onboarded ${fallbackRes.data.valid_count} personnel accounts!`);
        }
      } catch (fallbackErr) {
        setErrorMsg(err.response?.data?.detail || fallbackErr.response?.data?.detail || 'Failed to process Excel spreadsheet.');
      }
    } finally {
      setLoadingPreview(false);
      setCommitting(false);
    }
  };

  const handleDownloadStandardTemplate = async () => {
    try {
      const response = await api.get('/users/template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'tataplay_user_onboarding_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      alert('Failed to download Excel template.');
    }
  };

  const handleDownloadEnterpriseSample = async () => {
    try {
      const response = await api.get('/users/enterprise-template?staff_count=600&devices_per_worker=6', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'tataplay_enterprise_600_staff_with_kits.xlsx');
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      alert('Failed to generate enterprise workbook.');
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans w-full max-w-[1450px] mx-auto">
      
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-gradient-to-br from-[#1c023d] to-[#6700ce] text-white shadow-sm">
              <FileSpreadsheet className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-[#1c023d] tracking-tight">Enterprise Excel Dataset Ingestion</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-100 text-[#6700ce] border border-purple-200">
                  Tata Central Standard
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Bulk ingest up to 600+ Field Technicians, Managers & Admins along with 3,600+ serialized hardware toolkits (6-7 devices per worker) in a single workbook.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowPromptModal(true)}
            className="px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#6700ce] font-extrabold text-xs border border-purple-200 transition flex items-center gap-1.5 shadow-2xs"
          >
            <Sparkles className="w-4 h-4 text-[#e20d65]" />
            <span>AI Prompt & Columns Guide</span>
          </button>

          <button
            onClick={handleDownloadEnterpriseSample}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#1c023d] to-[#6700ce] hover:opacity-95 text-white font-extrabold text-xs shadow-md transition flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Download 600-Staff Sample (.xlsx)</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs flex items-center gap-2 animate-fade-in shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Upload Dropzone */}
      <div className="bg-white rounded-2xl p-8 border-2 border-dashed border-slate-300 hover:border-[#6700ce] transition text-center space-y-4 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-purple-50 text-[#6700ce] flex items-center justify-center mx-auto shadow-inner">
          <Upload className="w-7 h-7" />
        </div>
        <div className="max-w-md mx-auto space-y-1">
          <h3 className="text-base font-black text-[#1c023d]">Choose Enterprise Excel Workbook (.xlsx)</h3>
          <p className="text-xs text-slate-500">
            Supports multi-sheet workbooks: Sheet 1 (<code className="font-bold text-[#6700ce]">Personnel_Roster</code>) and Sheet 2 (<code className="font-bold text-[#6700ce]">Serialized_Hardware_Kits</code>).
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <label className="inline-block">
            <span className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#6700ce] to-[#e20d65] hover:opacity-95 text-white font-black text-xs cursor-pointer shadow-md transition inline-flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              <span>{selectedFile ? selectedFile.name : 'Select Local Excel Spreadsheet'}</span>
            </span>
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Loading Indicator */}
      {loadingPreview && (
        <div className="bg-white rounded-2xl p-16 border border-slate-200 text-center space-y-3">
          <div className="w-10 h-10 border-3 border-[#6700ce] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 font-bold text-xs">Parsing 600+ personnel records and mapping 3,600+ serialized hardware devices...</p>
        </div>
      )}

      {/* Enterprise Multi-Entity Ingestion Summary Preview */}
      {enterpriseSummary && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6 animate-fade-in">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-100 text-emerald-800">
                  Pre-Commit Validation Verified
                </span>
                <span className="text-xs font-mono text-slate-400 font-bold">
                  File: {selectedFile?.name || 'Enterprise Ingestion Workbook'}
                </span>
              </div>
              <h2 className="text-lg font-black text-[#1c023d] mt-1">
                Enterprise Batch Telemetry Overview
              </h2>
            </div>

            <button
              disabled={committing}
              onClick={() => uploadAndProcess(selectedFile, true)}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:opacity-95 text-white font-black text-xs shadow-md transition flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{committing ? 'Committing Batch...' : 'Commit Enterprise Ingestion (Fill Database)'}</span>
            </button>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            
            <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-200 space-y-1">
              <span className="text-[10px] uppercase font-black text-purple-700 tracking-wider flex items-center gap-1">
                <User className="w-3.5 h-3.5" /> Total Personnel Roster
              </span>
              <span className="text-2xl font-black text-[#1c023d] font-mono block">
                {enterpriseSummary.total_users_created}
              </span>
              <span className="text-[10px] text-slate-500 block font-medium">
                Admins, Managers & Field Techs
              </span>
            </div>

            <div className="p-4 rounded-xl bg-sky-50/60 border border-sky-200 space-y-1">
              <span className="text-[10px] uppercase font-black text-sky-700 tracking-wider flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5" /> Serialized Hardware Units
              </span>
              <span className="text-2xl font-black text-[#1c023d] font-mono block">
                {enterpriseSummary.total_devices_created}
              </span>
              <span className="text-[10px] text-slate-500 block font-medium">
                ONTs, Splicers, OTDRs, Power Meters
              </span>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-1">
              <span className="text-[10px] uppercase font-black text-emerald-700 tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Bound Kit Assignments
              </span>
              <span className="text-2xl font-black text-[#1c023d] font-mono block">
                {enterpriseSummary.total_devices_assigned}
              </span>
              <span className="text-[10px] text-slate-500 block font-medium">
                ~6 Devices Assigned Per Field Worker
              </span>
            </div>

            <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-1">
              <span className="text-[10px] uppercase font-black text-amber-700 tracking-wider flex items-center gap-1">
                <Award className="w-3.5 h-3.5" /> Batch Asset Capital Valuation
              </span>
              <span className="text-2xl font-black text-[#6700ce] font-mono block">
                ₹{enterpriseSummary.total_valuation_inr?.toLocaleString('en-IN') || '0'}
              </span>
              <span className="text-[10px] text-slate-500 block font-medium">
                +{enterpriseSummary.total_warehouse_stock_added} Spare Hub Reserves
              </span>
            </div>

          </div>

          {/* Sample Preview Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
            
            {/* Personnel Sample */}
            <div className="space-y-2 text-xs">
              <h3 className="font-black text-[#1c023d] flex items-center gap-1.5">
                <User className="w-4 h-4 text-purple-600" /> Sample Personnel Rows (Preview)
              </h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Name</th>
                      <th className="py-2.5 px-3">Email Address</th>
                      <th className="py-2.5 px-3">Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {enterpriseSummary.sample_users?.map((u, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-bold text-slate-800">{u.name}</td>
                        <td className="py-2 px-3 font-mono text-slate-600">{u.email}</td>
                        <td className="py-2 px-3 font-black text-purple-800">{u.role}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Devices Sample */}
            <div className="space-y-2 text-xs">
              <h3 className="font-black text-[#1c023d] flex items-center gap-1.5">
                <Package className="w-4 h-4 text-sky-600" /> Sample Serialized Devices (Preview)
              </h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Serial Number</th>
                      <th className="py-2.5 px-3">Equipment Name</th>
                      <th className="py-2.5 px-3">City Hub</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {enterpriseSummary.sample_devices?.map((d, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono font-bold text-purple-900">{d.serial}</td>
                        <td className="py-2 px-3 text-slate-800">{d.item}</td>
                        <td className="py-2 px-3 font-bold text-slate-600">{d.city}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* AI Prompt & Column Mapping Modal */}
      {showPromptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-lg bg-purple-50 text-[#6700ce]">
                  <Sparkles className="w-4 h-4" />
                </span>
                <h3 className="text-base font-black text-[#1c023d]">
                  Enterprise Dataset Specification & AI Prompt
                </h3>
              </div>
              <button 
                onClick={() => setShowPromptModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-700">
              <p className="leading-relaxed">
                Copy this prompt directly into <strong>ChatGPT</strong>, <strong>Gemini</strong>, or <strong>Claude</strong> to generate custom enterprise Excel workbooks formatted specifically for StockSentry.
              </p>

              {/* Prompt Box */}
              <div className="relative">
                <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] leading-relaxed whitespace-pre-wrap overflow-x-auto border border-slate-800">
                  {aiPromptText}
                </pre>
                <button
                  onClick={handleCopyPrompt}
                  className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-[#6700ce] hover:bg-[#5200a5] text-white font-extrabold text-[10px] shadow-sm flex items-center gap-1 transition"
                >
                  {copiedPrompt ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedPrompt ? 'Copied to Clipboard!' : 'Copy Prompt'}</span>
                </button>
              </div>

              {/* Specification Table */}
              <div className="space-y-2 pt-2">
                <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider">Required Column Definitions</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <span className="font-black text-[#1c023d] block">Sheet 1: 1_Personnel_Roster</span>
                    <ul className="list-disc list-inside text-[11px] space-y-0.5 text-slate-600">
                      <li><code>Employee ID</code>: e.g. TPF-EMP-1001</li>
                      <li><code>Full Name</code>: Staff full name</li>
                      <li><code>Email Address</code>: Must be unique</li>
                      <li><code>Role</code>: SUPER_ADMIN, REGIONAL_ADMIN, MANAGER, FIELD_WORKER</li>
                      <li><code>Region</code>: North/West/South/East Region</li>
                      <li><code>City Hub</code>: Delhi, Mumbai, Pune, Bangalore, etc.</li>
                    </ul>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <span className="font-black text-[#1c023d] block">Sheet 2: 2_Serialized_Hardware_Kits</span>
                    <ul className="list-disc list-inside text-[11px] space-y-0.5 text-slate-600">
                      <li><code>Serial Number</code>: Unique electronic serial</li>
                      <li><code>Equipment Name</code>: e.g. Nokia GPON ONT</li>
                      <li><code>Variant / Model</code>: Hardware revision</li>
                      <li><code>Category</code>: CPE Modems, Splicing Equipment, etc.</li>
                      <li><code>Unit Cost (INR)</code>: Asset valuation</li>
                      <li><code>Assigned Employee Email / ID</code>: Matches Sheet 1</li>
                      <li><code>Status</code>: ASSIGNED or IN_WAREHOUSE</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 text-xs">
              <button
                onClick={() => setShowPromptModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fallback Single-Sheet User Batch Preview */}
      {previewData && !enterpriseSummary && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-purple-100 text-purple-800">
                Personnel Batch Validation
              </span>
              <h2 className="text-lg font-black text-[#1c023d] mt-1">
                Parsed {previewData.total_rows} Records ({previewData.valid_count} Valid, {previewData.error_count} Errors)
              </h2>
            </div>
            <button
              disabled={committing || previewData.valid_count === 0}
              onClick={() => uploadAndProcess(selectedFile, true)}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:opacity-95 text-white font-black text-xs shadow-md transition flex items-center gap-2 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{committing ? 'Committing Batch...' : `Commit ${previewData.valid_count} Valid Users`}</span>
            </button>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Full Name</th>
                  <th className="py-2.5 px-3">Email Address</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">City / Region</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Validation Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px]">
                {previewData.rows?.map((row, idx) => (
                  <tr key={idx} className={row.is_valid ? 'hover:bg-slate-50' : 'bg-rose-50/40 hover:bg-rose-50'}>
                    <td className="py-2.5 px-3 font-bold text-slate-800">{row.full_name || '—'}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{row.email || '—'}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-purple-50 text-purple-700 border border-purple-200">
                        {row.role || '—'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">
                      <span className="font-bold">{row.city || '—'}</span>
                      <span className="text-[10px] text-slate-400 font-bold block">{row.region || '—'}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      {row.is_valid ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Valid
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> Error
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-xs">
                      {row.errors && row.errors.length > 0 ? (
                        <ul className="text-[11px] text-rose-700 font-medium space-y-0.5 list-disc pl-3">
                          {row.errors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-emerald-700 font-bold text-[11px]">Ready for database commit</span>
                      )}
                    </td>
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
