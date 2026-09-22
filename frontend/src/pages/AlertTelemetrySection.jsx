import React, { useState, useEffect } from 'react';
import { AlertsFeed } from '../components/AlertsFeed';
import { AlertTriangle, Send, Mail, MessageSquare, Phone, CheckCircle2, ShieldAlert, Sparkles, Server } from 'lucide-react';
import api from '../api/client';

export const AlertTelemetrySection = ({ alerts, onUpdateStatus }) => {
  const [recipientPhone, setRecipientPhone] = useState('+917620522139');
  const [recipientEmail, setRecipientEmail] = useState('admin@tataplay.com');
  const [selectedChannel, setSelectedChannel] = useState('ALL');
  const [isSending, setIsSending] = useState(false);
  const [dispatchResult, setDispatchResult] = useState(null);
  const [channelStatus, setChannelStatus] = useState(null);

  useEffect(() => {
    fetchChannelStatus();
  }, []);

  const fetchChannelStatus = async () => {
    try {
      const res = await api.get('/notifications/status');
      setChannelStatus(res.data);
    } catch (err) {
      console.error("Failed to fetch notification status", err);
    }
  };

  const handleTestDispatch = async (e) => {
    e.preventDefault();
    setIsSending(true);
    setDispatchResult(null);

    try {
      const res = await api.post('/notifications/test-dispatch', {
        recipient_phone: recipientPhone,
        recipient_email: recipientEmail,
        item_name: 'Fiber Modem - Nokia',
        variant_name: 'Dual-Band Wi-Fi 6',
        current_quantity: 12,
        threshold: 80,
        channel: selectedChannel
      });
      setDispatchResult(res.data);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to dispatch notification");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans max-w-7xl mx-auto">
      
      {/* Header Banner */}
      <div className="bg-[#170e3b] rounded-3xl p-6 md:p-8 border border-[#2d205a] shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="bg-rose-500/10 p-4 rounded-2xl text-rose-400 border border-rose-500/20 shadow-inner">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Low-Stock Alert Telemetry & Notification Center
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              Automated threshold detection with multi-channel dispatch across <strong>WebSockets</strong>, <strong>Email</strong>, <strong>SMS</strong>, and <strong>WhatsApp</strong>.
            </p>
          </div>
        </div>

        {/* Live Channel Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            WebSockets: Active
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold bg-sky-500/20 text-sky-300 border border-sky-500/30">
            <Mail className="w-3.5 h-3.5" /> Email Engine: Ready
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <MessageSquare className="w-3.5 h-3.5" /> SMS & WhatsApp: Ready
          </span>
        </div>
      </div>

      {/* Multi-Channel Test Dispatcher Panel */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-black text-[#1c023d] flex items-center gap-2">
              <Send className="w-5 h-5 text-[#e20d65]" />
              Multi-Channel Alert Dispatcher & Live Test Console
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Fires real-time low-stock telemetry alerts directly to your phone number and email inbox.
            </p>
          </div>
          <span className="text-[11px] font-mono font-bold bg-purple-50 text-purple-700 px-3 py-1 rounded-full border border-purple-200">
            Target Phone: {recipientPhone}
          </span>
        </div>

        <form onSubmit={handleTestDispatch} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-slate-700 font-extrabold mb-1.5 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-[#e20d65]" /> Recipient Phone (SMS / WhatsApp)
            </label>
            <input
              type="text"
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              placeholder="+9176520522139"
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-300 font-mono font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#e20d65] outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-slate-700 font-extrabold mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-sky-600" /> Recipient Email
            </label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="admin@tataplay.com"
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-300 font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#e20d65] outline-none"
              required
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={isSending}
              className="w-full py-2.5 px-4 rounded-lg bg-[#e20d65] hover:bg-[#cc0059] text-white font-extrabold shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Dispatching Telemetry...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Test Alert to Phone & Email</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Live Dispatch Result Box */}
        {dispatchResult && (
          <div className="bg-slate-900 text-slate-100 rounded-xl p-4 border border-slate-800 font-mono text-xs space-y-3 animate-in fade-in duration-300">
            <div className="flex items-center justify-between text-emerald-400 font-bold border-b border-slate-800 pb-2">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Telemetry Dispatch Execution Complete
              </span>
              <span className="text-slate-400 text-[11px]">{dispatchResult.results?.timestamp}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
              {/* Email Result */}
              <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700 space-y-1">
                <div className="flex items-center justify-between text-sky-400 font-bold">
                  <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email Channel</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950 border border-sky-800 text-sky-300">
                    {dispatchResult.results?.email_delivery?.mode}
                  </span>
                </div>
                <p className="text-slate-300 text-[10px] mt-1">{dispatchResult.results?.email_delivery?.message}</p>
              </div>

              {/* SMS Result */}
              <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700 space-y-1">
                <div className="flex items-center justify-between text-amber-400 font-bold">
                  <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> SMS Channel</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 border border-amber-800 text-amber-300">
                    {dispatchResult.results?.sms_delivery?.mode}
                  </span>
                </div>
                <p className="text-slate-300 text-[10px] mt-1">{dispatchResult.results?.sms_delivery?.message}</p>
              </div>

              {/* WhatsApp Result */}
              <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700 space-y-1">
                <div className="flex items-center justify-between text-emerald-400 font-bold">
                  <span className="flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> WhatsApp Channel</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300">
                    {dispatchResult.results?.whatsapp_delivery?.mode}
                  </span>
                </div>
                <p className="text-slate-300 text-[10px] mt-1">{dispatchResult.results?.whatsapp_delivery?.message}</p>
              </div>
            </div>

            <div className="pt-2 text-[10px] text-slate-400 flex items-center justify-between border-t border-slate-800/80">
              <span>Triggered Item: <strong>{dispatchResult.item}</strong> (Stock: {dispatchResult.current_stock} / Threshold: {dispatchResult.threshold})</span>
              <span className="text-emerald-400">✅ Background Dispatch Logged</span>
            </div>
          </div>
        )}
      </div>

      {/* Alert Feed Component */}
      <AlertsFeed alerts={alerts} onUpdateStatus={onUpdateStatus} />

    </div>
  );
};
