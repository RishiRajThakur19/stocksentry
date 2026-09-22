import React, { useState } from 'react';
import { Mail, PhoneCall, BellRing, CheckCircle2, X, Send, ShieldCheck, Sparkles, Eye, Info, Server, Key } from 'lucide-react';
import api from '../api/client';

export const NotificationSettingsModal = ({ isOpen, onClose }) => {
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(true);
  const [recipientEmail, setRecipientEmail] = useState('rishirajpbs@gmail.com');
  const [recipientPhone, setRecipientPhone] = useState('+91 98765 43210');
  
  // Real SMTP Relay settings
  const [showSmtpConfig, setShowSmtpConfig] = useState(true);
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState('rishirajpbs@gmail.com');
  const [smtpPassword, setSmtpPassword] = useState('');

  const [testing, setTesting] = useState(false);
  const [dispatchedPayload, setDispatchedPayload] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSendTestAlert = async () => {
    setTesting(true);
    setErrorMsg('');
    setDispatchedPayload(null);

    try {
      const res = await api.post('/notifications/test-dispatch', {
        recipient_email: recipientEmail,
        recipient_phone: recipientPhone,
        smtp_host: smtpUser && smtpPassword ? smtpHost : null,
        smtp_port: parseInt(smtpPort),
        smtp_user: smtpUser || null,
        smtp_password: smtpPassword || null
      });
      setDispatchedPayload(res.data);
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Failed to dispatch notification.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm font-sans">
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden space-y-4 max-h-[90vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="bg-[#1c023d] text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-[#e20d65] text-white">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight">Email & SMS Alert Notification Settings</h2>
              <p className="text-[11px] text-slate-300">Configure email sending & SMS dispatchers for stock threshold breaches.</p>
            </div>
          </div>

          <button onClick={onClose} className="text-slate-300 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
          
          {errorMsg && (
            <div className="p-3.5 rounded bg-rose-50 border border-rose-200 text-rose-700 font-bold">
              {errorMsg}
            </div>
          )}

          {dispatchedPayload && (
            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-slate-900 space-y-2">
              <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>
                  {dispatchedPayload.delivery_result?.mode === 'LIVE_SMTP_NETWORK_SENT' 
                    ? 'REAL EMAIL DELIVERED TO YOUR GMAIL INBOX!' 
                    : 'Alert Logged & Dispatched Successfully!'}
                </span>
              </div>
              <p className="text-xs text-slate-700">
                {dispatchedPayload.delivery_result?.message}
              </p>

              {/* Inspector View */}
              <div className="mt-3 p-3 rounded bg-white border border-emerald-200 text-xs font-mono space-y-1 text-slate-700">
                <p className="font-bold text-[#1c023d]">{dispatchedPayload.dispatched_subject}</p>
                <pre className="whitespace-pre-line text-[11px] text-slate-600 font-sans mt-1 bg-slate-50 p-2.5 rounded border border-slate-200">
                  {dispatchedPayload.dispatched_body}
                </pre>
              </div>
            </div>
          )}

          {/* Target Email Input */}
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-extrabold text-[#1c023d]">
                <Mail className="w-4 h-4 text-[#6700ce]" />
                <span>Target Email Dispatcher</span>
              </div>

              <input
                type="checkbox"
                checked={emailAlerts}
                onChange={(e) => setEmailAlerts(e.target.checked)}
                className="w-4 h-4 accent-[#e20d65] rounded cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-bold mb-1">Your Recipient Email Address</label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="rishirajpbs@gmail.com"
                className="w-full px-3.5 py-2.5 rounded bg-white border border-slate-300 text-slate-900 font-bold focus:outline-none focus:border-[#e20d65]"
              />
            </div>
          </div>

          {/* Real SMTP Relay Toggle */}
          <div className="p-4 rounded-lg bg-purple-50 border border-purple-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-extrabold text-[#1c023d] flex items-center gap-2">
                <Server className="w-4 h-4 text-[#e20d65]" />
                <span>Live Gmail Real Inbox Delivery Setup</span>
              </div>

              <button
                type="button"
                onClick={() => setShowSmtpConfig(!showSmtpConfig)}
                className="text-xs font-bold text-[#6700ce] hover:underline"
              >
                {showSmtpConfig ? 'Hide Settings' : '+ Configure Real Gmail Delivery'}
              </button>
            </div>

            <p className="text-[11px] text-purple-900 leading-relaxed">
              Google requires a 16-character <strong>Gmail App Password</strong> (from <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="underline font-bold text-[#e20d65]">myaccount.google.com/apppasswords</a>) to bypass 2FA security.
            </p>

            {showSmtpConfig && (
              <div className="space-y-3 pt-2 border-t border-purple-200">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">SMTP Host</label>
                    <input
                      type="text"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      placeholder="smtp.gmail.com"
                      className="w-full px-3 py-2 rounded bg-white border border-purple-300 font-mono text-slate-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Port</label>
                    <input
                      type="number"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                      placeholder="587"
                      className="w-full px-3 py-2 rounded bg-white border border-purple-300 font-mono text-slate-900 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Gmail Sender Username</label>
                  <input
                    type="email"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    placeholder="rishirajpbs@gmail.com"
                    className="w-full px-3 py-2 rounded bg-white border border-purple-300 text-slate-900 focus:outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Gmail App Password (16-character passcode)</label>
                  <input
                    type="password"
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                    placeholder="e.g. abcd efgh ijkl mnop"
                    className="w-full px-3 py-2 rounded bg-white border border-purple-300 font-mono text-slate-900 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Send Test Dispatch Button */}
          <button
            onClick={handleSendTestAlert}
            disabled={testing}
            className="w-full py-3 rounded-lg bg-[#e20d65] hover:bg-[#cc0059] text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            <span>{testing ? 'Dispatching Notification...' : `Execute Email Dispatch to ${recipientEmail}`}</span>
          </button>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded bg-[#1c023d] hover:bg-[#2c095c] text-white font-extrabold text-xs shadow-sm transition"
          >
            Save Alert Preferences
          </button>
        </div>

      </div>
    </div>
  );
};
