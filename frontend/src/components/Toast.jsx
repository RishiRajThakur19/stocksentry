import React from 'react';
import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react';

export const Toast = ({ toasts, removeToast }) => {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-md w-full font-sans">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-start gap-3.5 p-4 rounded-2xl shadow-2xl border backdrop-blur-xl animate-in slide-in-from-bottom-5 transition-all ${
            toast.type === 'LOW_STOCK'
              ? 'bg-tata-navy/95 border-tata-magenta text-slate-100 shadow-magenta-glow'
              : toast.type === 'SUCCESS'
              ? 'bg-tata-navy/95 border-emerald-500/60 text-emerald-100 shadow-lg'
              : 'bg-tata-navy/95 border-tata-cyan/60 text-cyan-100 shadow-lg'
          }`}
        >
          {toast.type === 'LOW_STOCK' ? (
            <AlertTriangle className="w-6 h-6 text-tata-magenta-light shrink-0 mt-0.5" />
          ) : toast.type === 'SUCCESS' ? (
            <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-6 h-6 text-tata-cyan shrink-0 mt-0.5" />
          )}

          <div className="flex-1 text-sm">
            <p className="font-bold text-white text-base">{toast.title}</p>
            <p className="opacity-90 mt-0.5 text-xs text-slate-300 leading-relaxed">{toast.message}</p>
          </div>

          <button
            onClick={() => removeToast(toast.id)}
            className="text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
