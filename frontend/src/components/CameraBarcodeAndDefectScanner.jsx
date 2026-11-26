import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Scan, 
  X, 
  CheckCircle, 
  AlertTriangle, 
  Flame, 
  Layers, 
  Maximize2, 
  RefreshCw, 
  Upload, 
  Sparkles, 
  ShieldCheck,
  Cpu,
  Trash2,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import api from '../api/client';

export const CameraBarcodeAndDefectScanner = ({ isOpen, onClose, onSerialsVerified, onNavigateToRepairs }) => {
  const [activeMode, setActiveMode] = useState('BARCODE'); // 'BARCODE' | 'DEFECT_AI'
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [scannedSerials, setScannedSerials] = useState([
    'TPF-ONT-8921',
    'TPF-NOK-W6-10001',
    'TPF-RTR-7712'
  ]);
  const [verificationResults, setVerificationResults] = useState(null);
  const [verifying, setVerifying] = useState(false);

  // Defect AI State
  const [defectSymptom, setDefectSymptom] = useState('optical port melted and laser diode burned');
  const [defectInspectionResult, setDefectInspectionResult] = useState(null);
  const [inspecting, setInspecting] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraActive(true);
      } else {
        setCameraError("Camera device access not supported in this browser. Interactive camera simulation active.");
        setCameraActive(false);
      }
    } catch (err) {
      console.warn("Camera init error (using simulated preview fallback):", err);
      setCameraError("Camera permission not granted or device unavailable. Running in high-fidelity computer vision simulation mode.");
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleSimulateAddBarcode = () => {
    const randomSampleSerials = [
      `TPF-ONT-${Math.floor(1000 + Math.random() * 9000)}`,
      `TPF-SPL-${Math.floor(1000 + Math.random() * 9000)}`,
      `TPF-NOK-W6-${Math.floor(10000 + Math.random() * 90000)}`,
      `TPF-SW-${Math.floor(1000 + Math.random() * 9000)}`
    ];
    const picked = randomSampleSerials[Math.floor(Math.random() * randomSampleSerials.length)];
    if (!scannedSerials.includes(picked)) {
      setScannedSerials(prev => [picked, ...prev]);
    }
  };

  const handleVerifyBatch = async () => {
    if (scannedSerials.length === 0) return;
    setVerifying(true);
    try {
      const res = await api.post('/ai/batch-barcode-verify', { serials: scannedSerials });
      setVerificationResults(res.data);
      if (onSerialsVerified) {
        onSerialsVerified(res.data);
      }
    } catch (err) {
      alert("Verification failed: " + (err.response?.data?.detail || err.message));
    } finally {
      setVerifying(false);
    }
  };

  const handleRunDefectInspection = async (overrideSymptom = defectSymptom) => {
    setInspecting(true);
    try {
      const res = await api.post('/ai/inspect-defect', {
        serial_number: scannedSerials[0] || 'TPF-ONT-8921',
        reported_symptom: overrideSymptom
      });
      setDefectInspectionResult(res.data);
    } catch (err) {
      alert("Defect inspection failed: " + (err.response?.data?.detail || err.message));
    } finally {
      setInspecting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-4xl w-full text-white shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#e20d65]/20 border border-[#e20d65]/40 text-[#e20d65]">
              <Scan className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight">AI Vision Scanner & Hardware Defect OCR</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold">
                  ISO-9001 AI Triage
                </span>
              </div>
              <p className="text-xs text-slate-400">Multi-barcode extraction & returned optical modem defect analyzer</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Mode Switcher */}
            <div className="flex items-center bg-slate-800 p-1 rounded-xl text-xs font-bold border border-slate-700">
              <button
                onClick={() => setActiveMode('BARCODE')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${activeMode === 'BARCODE' ? 'bg-[#e20d65] text-white shadow' : 'text-slate-300 hover:text-white'}`}
              >
                <Scan className="w-3.5 h-3.5" /> Multi-Barcode
              </button>
              <button
                onClick={() => {
                  setActiveMode('DEFECT_AI');
                  if (!defectInspectionResult) handleRunDefectInspection();
                }}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${activeMode === 'DEFECT_AI' ? 'bg-[#e20d65] text-white shadow' : 'text-slate-300 hover:text-white'}`}
              >
                <Sparkles className="w-3.5 h-3.5" /> Defect OCR
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Live Camera Video Viewfinder */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-slate-700 flex items-center justify-center group shadow-inner">
              
              {/* Real Video Element */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
              />

              {/* Simulation Visual Viewfinder if physical camera unavailable */}
              {!cameraActive && (
                <div className="w-full h-full bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
                  {/* Grid Lines Overlay */}
                  <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:16px_16px]" />
                  
                  {/* Synthetic Equipment Visual Frame */}
                  <div className="relative z-10 p-4 border border-indigo-500/30 rounded-2xl bg-indigo-950/40 backdrop-blur-md max-w-sm">
                    <Cpu className="w-12 h-12 text-indigo-400 mx-auto mb-2 opacity-80" />
                    <div className="text-xs font-mono font-bold text-indigo-200">Optical Network Terminal (ONT)</div>
                    <div className="text-[10px] font-mono text-indigo-300/70 mt-1">Dual-Band Wi-Fi 6 GPON • SN: TPF-NOK-W6-10001</div>
                    <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[10px]">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> Optical Rx: -19.4 dBm (Normal)
                    </div>
                  </div>

                  {cameraError && (
                    <div className="mt-4 text-[11px] text-amber-300/80 bg-amber-950/40 border border-amber-800/40 px-3 py-1.5 rounded-lg max-w-xs">
                      {cameraError}
                    </div>
                  )}
                </div>
              )}

              {/* Laser Scanning Line Animation */}
              <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#e20d65] to-transparent shadow-[0_0_15px_#e20d65] animate-bounce pointer-events-none opacity-80" />

              {/* Viewfinder Target Bounding Reticle */}
              <div className="absolute inset-8 border border-white/20 rounded-2xl pointer-events-none flex flex-col justify-between p-2">
                <div className="flex justify-between">
                  <div className="w-6 h-6 border-t-2 border-l-2 border-[#e20d65] rounded-tl" />
                  <div className="w-6 h-6 border-t-2 border-r-2 border-[#e20d65] rounded-tr" />
                </div>
                <div className="flex justify-between">
                  <div className="w-6 h-6 border-b-2 border-l-2 border-[#e20d65] rounded-bl" />
                  <div className="w-6 h-6 border-b-2 border-r-2 border-[#e20d65] rounded-br" />
                </div>
              </div>

              {/* Real-Time Detection Pill */}
              <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-mono font-bold flex items-center gap-2 border border-white/10">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>AI Vision: {activeMode === 'BARCODE' ? 'Batch Barcode Active' : 'Defect Classification'}</span>
              </div>
            </div>

            {/* Quick Action Bar under Camera */}
            <div className="flex items-center justify-between text-xs gap-3">
              <button
                onClick={handleSimulateAddBarcode}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition flex items-center gap-2 border border-slate-700 font-bold"
              >
                <Scan className="w-4 h-4 text-pink-400" />
                Simulate Camera Barcode Scan
              </button>

              <button
                onClick={() => (cameraActive ? stopCamera() : startCamera())}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition flex items-center gap-2 border border-slate-700"
              >
                <RefreshCw className="w-4 h-4 text-indigo-400" />
                {cameraActive ? 'Stop Stream' : 'Switch/Reset Camera'}
              </button>
            </div>
          </div>

          {/* Right Column: Mode Specific Results Panel */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            
            {/* Mode 1: MULTI-BARCODE SCANNER */}
            {activeMode === 'BARCODE' && (
              <div className="flex flex-col gap-3 h-full">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Scanned Queue ({scannedSerials.length})
                  </span>
                  {scannedSerials.length > 0 && (
                    <button
                      onClick={() => { setScannedSerials([]); setVerificationResults(null); }}
                      className="text-xs text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Clear
                    </button>
                  )}
                </div>

                {/* Scanned Serials List */}
                <div className="flex-1 bg-slate-950/60 border border-slate-800 rounded-2xl p-3 overflow-y-auto max-h-56 divide-y divide-slate-800/60">
                  {scannedSerials.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500">
                      No serials scanned yet. Point your camera at box barcodes or click "Simulate Camera Barcode Scan".
                    </div>
                  ) : (
                    scannedSerials.map((sn, idx) => (
                      <div key={idx} className="py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-mono flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="font-mono text-xs font-bold text-slate-200">{sn}</span>
                        </div>
                        <button
                          onClick={() => setScannedSerials(scannedSerials.filter((_, i) => i !== idx))}
                          className="text-slate-500 hover:text-rose-400"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Batch Verify Button */}
                <button
                  onClick={handleVerifyBatch}
                  disabled={verifying || scannedSerials.length === 0}
                  className="w-full py-2.5 bg-gradient-to-r from-[#1c023d] to-[#e20d65] hover:opacity-90 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-lg transition flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {verifying ? 'Verifying with ERP...' : `Verify ${scannedSerials.length} Scanned Serials in Database`}
                </button>

                {/* Verification Results Display */}
                {verificationResults && (
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2 mt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-300">Registry Match</span>
                      <span className="font-mono text-emerald-400 font-bold">
                        {verificationResults.recognized_count} / {verificationResults.total_scanned} Verified
                      </span>
                    </div>

                    <div className="space-y-1.5 max-h-40 overflow-y-auto pt-1">
                      {verificationResults.results.map((res, i) => (
                        <div key={i} className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] flex items-center justify-between">
                          <div>
                            <div className="font-mono font-bold text-slate-200 flex items-center gap-1.5">
                              {res.recognized ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              ) : (
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              )}
                              {res.serial_number}
                            </div>
                            <div className="text-slate-400 text-[10px] mt-0.5">
                              {res.item_name} • {res.current_location}
                            </div>
                          </div>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                            res.status === 'ASSIGNED' ? 'bg-indigo-500/20 text-indigo-300' :
                            res.status === 'IN_WAREHOUSE' ? 'bg-emerald-500/20 text-emerald-300' :
                            'bg-slate-700 text-slate-300'
                          }`}>
                            {res.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mode 2: AI DEFECT OCR INSPECTION */}
            {activeMode === 'DEFECT_AI' && (
              <div className="flex flex-col gap-3 h-full">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Returned Hardware Defect Classifier
                </div>

                {/* Symptom selector / override buttons */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    onClick={() => {
                      setDefectSymptom('optical port melted and laser diode burned');
                      handleRunDefectInspection('optical port melted and laser diode burned');
                    }}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-left border border-slate-700 transition"
                  >
                    <div className="font-bold text-rose-400 flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5" /> Laser Port Burn
                    </div>
                    <div className="text-[10px] text-slate-400">Thermal voltage spike</div>
                  </button>

                  <button
                    onClick={() => {
                      setDefectSymptom('chassis cracked casing broken drop impact');
                      handleRunDefectInspection('chassis cracked casing broken drop impact');
                    }}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-left border border-slate-700 transition"
                  >
                    <div className="font-bold text-amber-400 flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5" /> Chassis Fracture
                    </div>
                    <div className="text-[10px] text-slate-400">Exterior shell drop</div>
                  </button>

                  <button
                    onClick={() => {
                      setDefectSymptom('water liquid ingress oxidation corrosion');
                      handleRunDefectInspection('water liquid ingress oxidation corrosion');
                    }}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-left border border-slate-700 transition"
                  >
                    <div className="font-bold text-sky-400 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Liquid Corrosion
                    </div>
                    <div className="text-[10px] text-slate-400">Moisture salt ingress</div>
                  </button>

                  <button
                    onClick={() => {
                      setDefectSymptom('sc apc ferrule scratch dust attenuation');
                      handleRunDefectInspection('sc apc ferrule scratch dust attenuation');
                    }}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-left border border-slate-700 transition"
                  >
                    <div className="font-bold text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Ferrule Dust/Loss
                    </div>
                    <div className="text-[10px] text-slate-400">Clean & recalibrate</div>
                  </button>
                </div>

                {inspecting ? (
                  <div className="p-8 text-center bg-slate-950 rounded-2xl border border-slate-800">
                    <RefreshCw className="w-8 h-8 text-[#e20d65] animate-spin mx-auto mb-2" />
                    <div className="text-xs font-bold text-slate-200">Executing Optical Core Neural Analysis...</div>
                    <div className="text-[11px] text-slate-400 mt-1">Inspecting PCB traces & optical diode cavity</div>
                  </div>
                ) : defectInspectionResult ? (
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-slate-400">{defectInspectionResult.inspection_id}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase font-mono ${
                        defectInspectionResult.severity === 'CRITICAL_SCRAP' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                        defectInspectionResult.severity === 'BENCH_REPAIR' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                        'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {defectInspectionResult.severity}
                      </span>
                    </div>

                    <div>
                      <div className="text-sm font-black text-white">{defectInspectionResult.defect_label}</div>
                      <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        {defectInspectionResult.detailed_diagnosis}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800">
                      <div>
                        <div className="text-[10px] text-slate-500">AI Confidence</div>
                        <div className="font-mono font-black text-emerald-400">{defectInspectionResult.ai_confidence_score}%</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500">Salvage Valuation</div>
                        <div className="font-mono font-black text-amber-400">₹{defectInspectionResult.estimated_salvage_inr}</div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <div className="text-[10px] text-slate-400">Certified ISO Disposition:</div>
                        <div className="font-bold text-pink-400">{defectInspectionResult.recommended_action}</div>
                      </div>
                      {onNavigateToRepairs && (
                        <button
                          onClick={() => {
                            onClose();
                            onNavigateToRepairs();
                          }}
                          className="px-3 py-1.5 bg-[#e20d65] hover:bg-[#c70054] text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow"
                        >
                          Route Docket <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Tata Play Fiber AI Telemetry • Serial & Return Governance Engine</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition"
          >
            Close Scanner
          </button>
        </div>
      </div>
    </div>
  );
};
