import React from 'react';
import { AlertTriangle, CheckCircle, Clock, MapPin, Gauge } from 'lucide-react';

import { getProductImage } from '../utils/imageHelper';

export const AlertsFeed = ({ alerts, onUpdateStatus, isManager = false, onRequestOrder }) => {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="bg-white rounded-lg p-8 text-center text-slate-500 text-xs border border-slate-200 font-sans w-full">
        <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
        <p className="font-bold text-[#1c023d] text-sm">No active low-stock alerts. All inventory levels are healthy!</p>
        <p className="text-xs text-slate-400 mt-1">Real-time WebSocket monitoring active across all hubs.</p>
      </div>
    );
  }


  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200 font-sans w-full space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h2 className="text-base font-extrabold text-[#1c023d] flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-[#e20d65]" />
          <span>{isManager ? 'Hub Telemetry Low-Stock Alert Feed' : 'Global Telemetry & Low-Stock Alerts Feed'}</span>
          <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
            {alerts.filter(a => a.status === 'OPEN').length} Open Alerts
          </span>
        </h2>
        <span className="text-xs text-slate-400 font-mono">Live WebSocket Updates</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-1">
        {alerts.map((alert) => {
          const isOpen = alert.status === 'OPEN';
          const isAck = alert.status === 'ACKNOWLEDGED';
          const imgUrl = getProductImage(alert.item_name);

          const currentQty = alert.current_quantity ?? alert.current_qty_at_trigger;
          const threshold = alert.threshold_at_trigger;
          const percent = Math.min(100, Math.round((currentQty / threshold) * 100));

          return (
            <div
              key={alert.alert_id}
              className={`p-4 rounded-lg border transition-all flex flex-col justify-between space-y-3 ${
                isOpen
                  ? 'bg-rose-50/70 border-rose-200 text-slate-900 shadow-sm'
                  : isAck
                  ? 'bg-amber-50/70 border-amber-200 text-slate-900'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              
              {/* Card Header: Product Picture + Item Info */}
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-lg bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0 shadow-sm">
                  <img src={imgUrl} alt={alert.item_name} className="w-full h-full object-contain rounded" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-black text-[#1c023d] text-sm truncate">{alert.item_name}</h3>
                    <span
                      className={`text-[10px] uppercase font-black px-2 py-0.5 rounded border ${
                        isOpen
                          ? 'bg-[#e20d65] text-white border-[#b3004b] animate-pulse'
                          : isAck
                          ? 'bg-amber-500 text-white border-amber-600'
                          : 'bg-emerald-600 text-white border-emerald-700'
                      }`}
                    >
                      {alert.status}
                    </span>
                  </div>

                  <p className="text-xs font-mono font-bold text-[#e20d65] mt-0.5">Variant: {alert.variant_name}</p>
                  
                  <div className="flex items-center gap-2 text-xs text-slate-600 mt-1 font-semibold">
                    <MapPin className="w-3.5 h-3.5 text-[#e20d65] shrink-0" />
                    <span>{alert.location_name}</span>
                  </div>
                </div>
              </div>

              {/* Threshold Gauge Bar */}
              <div className="bg-white p-3 rounded border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-600 flex items-center gap-1">
                    <Gauge className="w-3.5 h-3.5 text-[#e20d65]" />
                    Stock Level vs Threshold:
                  </span>
                  <span className="font-mono font-black text-rose-600">
                    {currentQty} <span className="text-slate-400 font-normal">/ {threshold} threshold</span>
                  </span>
                </div>

                <div className="w-full bg-slate-100 h-2 rounded overflow-hidden border border-slate-200">
                  <div 
                    className={`h-full rounded transition-all duration-500 ${
                      percent <= 30 ? 'bg-rose-600' : percent <= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`} 
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>

              {/* Card Footer: Timestamp & Action Controls */}
              <div className="flex items-center justify-between pt-1 text-xs">
                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>{new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                <div className="flex items-center gap-2">
                  {isOpen && (
                    <button
                      onClick={() => onUpdateStatus(alert.alert_id, 'ACKNOWLEDGED')}
                      className="px-3 py-1 rounded text-xs font-extrabold bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition"
                    >
                      Acknowledge
                    </button>
                  )}
                  {isAck && (
                    <button
                      onClick={() => onUpdateStatus(alert.alert_id, 'RESOLVED')}
                      className="px-3 py-1 rounded text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition"
                    >
                      Resolve
                    </button>
                  )}
                  {isManager && onRequestOrder && (
                    <button
                      onClick={() => onRequestOrder(alert)}
                      className="px-3 py-1 rounded text-xs font-extrabold bg-[#e20d65] hover:bg-[#cc0059] text-white shadow-sm transition"
                    >
                      Order Stock
                    </button>
                  )}
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
};
