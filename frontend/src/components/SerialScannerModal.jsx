import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, Check } from 'lucide-react';

export const SerialScannerModal = ({ isOpen, onClose, onScan }) => {
  const videoRef = useRef(null);
  const [manualSerial, setManualSerial] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let stream = null;
    let timer = null;
    const hasDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;
    setSupported(hasDetector);

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        if (hasDetector) {
          const detector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13'] });
          timer = setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) return;
            try {
              const codes = await detector.detect(videoRef.current);
              if (codes.length > 0 && codes[0].rawValue) {
                onScan(codes[0].rawValue.trim());
                onClose();
              }
            } catch {
              // ignore frame errors
            }
          }, 350);
        }
      } catch {
        setCameraError('Camera unavailable (HTTPS required or permission denied). Enter serial manually below.');
      }
    };

    if (navigator.mediaDevices?.getUserMedia) {
      startCamera();
    } else {
      setCameraError('Camera API unavailable in this browser. Enter serial manually below.');
    }

    return () => {
      if (timer) clearInterval(timer);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-4 bg-[#1c023d] text-white flex items-center justify-between">
          <div className="flex items-center gap-2 font-black text-sm">
            <Camera className="w-4 h-4 text-[#e20d65]" />
            <span>Scan Serial / QR Code</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-3 text-xs">
          {!cameraError ? (
            <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              <div className="absolute bottom-2 left-2 right-2 text-center text-[11px] font-bold text-white bg-black/50 py-1 rounded">
                {supported ? 'Point camera at QR or barcode' : 'BarcodeDetector unsupported — use manual entry'}
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 font-semibold">{cameraError}</div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (manualSerial.trim()) {
                onScan(manualSerial.trim());
                setManualSerial('');
                onClose();
              }
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={manualSerial}
              onChange={(e) => setManualSerial(e.target.value)}
              placeholder="Or type / paste serial number..."
              className="flex-1 px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 font-mono font-bold"
            />
            <button type="submit" className="px-3.5 py-2 rounded-lg bg-[#e20d65] text-white font-extrabold flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Use
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
