import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Mail, Lock, Building2, User, Phone, CheckCircle2, ArrowRight, Sparkles, KeyRound, Network, Wrench } from 'lucide-react';
import api from '../api/client';

export const Login = () => {
  const { login } = useAuth();

  const [mode, setMode] = useState('LOGIN'); // 'LOGIN', 'SIGNUP', 'OTP'

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+91 98765 43210');
  const [role, setRole] = useState('LOCATION_MANAGER');
  const [locationId, setLocationId] = useState(1);
  
  // OTP state
  const [otp, setOtp] = useState(['7', '8', '9', '1', '2', '3']);
  const [demoOtpHint, setDemoOtpHint] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Quick Login Pre-sets
  const handleQuickPreset = async (presetEmail, presetPass) => {
    const targetPass = presetPass || (presetEmail.includes('admin') ? 'admin123' : 'manager123');
    setEmail(presetEmail);
    setPassword(targetPass);
    setErrorMsg('');
    setLoading(true);
    try {
      await login(presetEmail, targetPass);
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!name.trim() || !email.trim() || !password.trim()) {
      setErrorMsg('All fields are required.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.post('/auth/register', {
        name,
        email,
        phone,
        role,
        location_id: parseInt(locationId),
        password
      });

      setDemoOtpHint(res.data.demo_otp_hint || '789123');
      setSuccessMsg(`Account registered! Verification code sent to ${phone} and ${email}.`);
      setMode('OTP');
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const fullOtp = otp.join('');

    if (fullOtp.length !== 6) {
      setErrorMsg('Please enter complete 6-digit OTP code.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.post('/auth/verify-otp', {
        email: email,
        otp: fullOtp
      });

      localStorage.setItem('stocksentry_token', res.data.access_token);
      localStorage.setItem('stocksentry_user', JSON.stringify(res.data));
      window.location.reload();
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Invalid OTP code. Try demo code 789123.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpDigitChange = (index, value) => {
    if (value.length > 1) value = value[value.length - 1];
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      nextInput?.focus();
    }
  };

  return (
    <div className="min-h-screen bg-[#1c023d] text-white flex flex-col justify-between font-sans relative overflow-hidden">
      
      {/* Background Glow Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[#e20d65]/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[#6700ce]/30 blur-[120px] pointer-events-none" />

      {/* Top Header */}
      <header className="p-6 flex items-center justify-between border-b border-purple-900/40 relative z-10">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black text-white">
            <span className="text-[#e20d65]">Tata Play</span> Fiber
          </span>
          <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded bg-purple-900/60 text-purple-200 border border-purple-700/50">
            Enterprise Governance
          </span>
        </div>
      </header>

      {/* Main Form Center */}
      <main className="flex-1 flex items-center justify-center p-6 relative z-10">
        <div className="bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-8 space-y-6">
          
          {/* Mode Switcher Buttons */}
          {mode !== 'OTP' && (
            <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 font-bold text-xs">
              <button
                type="button"
                onClick={() => { setMode('LOGIN'); setErrorMsg(''); }}
                className={`py-2 rounded-lg transition ${
                  mode === 'LOGIN' ? 'bg-[#1c023d] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode('SIGNUP'); setErrorMsg(''); }}
                className={`py-2 rounded-lg transition ${
                  mode === 'SIGNUP' ? 'bg-[#1c023d] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* MODE 1: LOGIN FORM */}
          {mode === 'LOGIN' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-extrabold mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. admin@tataplay.com"
                    className="w-full pl-10 pr-3.5 py-3 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 font-semibold focus:outline-none focus:border-[#e20d65]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-extrabold mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-3.5 py-3 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 font-semibold focus:outline-none focus:border-[#e20d65]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-[#e20d65] hover:bg-[#cc0059] text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-2 mt-2"
              >
                <span>{loading ? 'Authenticating...' : 'Sign In to Portal'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Demo Quick Account Chips - 4 Tiers */}
              <div className="pt-4 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Instant 4-Tier Demo Access</p>
                  <span className="text-[9px] text-[#e20d65] font-bold">Click to auto-fill & login</span>
                </div>

                {/* Tier 1 & 2 */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickPreset('admin@tataplay.com', 'admin123')}
                    className="p-2 rounded bg-purple-50 hover:bg-purple-100 text-[#6700ce] border border-purple-200 text-[11px] font-bold transition flex flex-col items-center justify-center text-center"
                  >
                    <span className="text-[#e20d65] flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Super Admin</span>
                    </span>
                    <span className="text-[9px] font-mono text-purple-400 font-normal">admin@tataplay.com</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickPreset('north.admin@tataplay.com', 'admin123')}
                    className="p-2 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-bold transition flex flex-col items-center justify-center text-center"
                  >
                    <span className="flex items-center gap-1">
                      <Network className="w-3.5 h-3.5" />
                      <span>North Reg. Admin</span>
                    </span>
                    <span className="text-[9px] font-mono text-indigo-400 font-normal">north.admin@...</span>
                  </button>
                </div>

                {/* Tier 3 & 4 */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickPreset('delhi@tataplay.com', 'manager123')}
                    className="p-2 rounded bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold transition flex flex-col items-center justify-center text-center"
                  >
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Delhi Hub Manager</span>
                    </span>
                    <span className="text-[9px] font-mono text-slate-400 font-normal">delhi@tataplay.com</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickPreset('delhi.worker@tataplay.com', 'worker123')}
                    className="p-2 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold transition flex flex-col items-center justify-center text-center"
                  >
                    <span className="flex items-center gap-1">
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Delhi Field Tech</span>
                    </span>
                    <span className="text-[9px] font-mono text-emerald-600 font-normal">worker123</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => handleQuickPreset('west.admin@tataplay.com', 'admin123')}
                    className="p-1.5 rounded bg-indigo-50/60 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold transition text-center"
                  >
                    <span>West Reg. Admin</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickPreset('mumbai@tataplay.com', 'manager123')}
                    className="p-1.5 rounded bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold transition text-center"
                  >
                    <span>Mumbai Manager</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* MODE 2: SIGNUP FORM */}
          {mode === 'SIGNUP' && (
            <form onSubmit={handleSignupSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-extrabold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Vikramaditya Singh"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 font-semibold focus:outline-none focus:border-[#e20d65]"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-extrabold mb-1">Work Email *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@tataplay.com"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 font-semibold focus:outline-none focus:border-[#e20d65]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-extrabold mb-1">Phone Number (+91)</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-300 font-mono text-slate-900 font-semibold focus:outline-none focus:border-[#e20d65]"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-extrabold mb-1">Account Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 font-bold focus:outline-none focus:border-[#e20d65]"
                  >
                    <option value="MANAGER">City Manager</option>
                    <option value="FIELD_WORKER">Field Worker / Tech</option>
                    <option value="REGIONAL_ADMIN">Regional Admin</option>
                    <option value="SUPER_ADMIN">Super Admin (Central)</option>
                  </select>
                </div>
              </div>

              {(role === 'MANAGER' || role === 'FIELD_WORKER' || role === 'LOCATION_MANAGER') && (
                <div>
                  <label className="block text-slate-700 font-extrabold mb-1">Assigned City Hub</label>
                  <select
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 font-bold focus:outline-none focus:border-[#e20d65]"
                  >
                    <option value="1">Delhi Regional Hub (North)</option>
                    <option value="2">Mumbai Main Hub (West)</option>
                    <option value="3">Pune West Hub (West)</option>
                    <option value="4">Bangalore Tech Park (South)</option>
                    <option value="5">Hyderabad Metro Hub (South)</option>
                    <option value="6">Chennai Central Hub (South)</option>
                    <option value="7">Kolkata Eastern Hub (East)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-extrabold mb-1">Password *</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 font-semibold focus:outline-none focus:border-[#e20d65]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-[#e20d65] hover:bg-[#cc0059] text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-2 mt-2"
              >
                <span>{loading ? 'Creating Account...' : 'Continue to OTP Verification'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* MODE 3: 6-DIGIT OTP VERIFICATION SCREEN */}
          {mode === 'OTP' && (
            <form onSubmit={handleOtpSubmit} className="space-y-5 text-xs text-center">
              <div className="w-12 h-12 rounded-full bg-purple-50 text-[#6700ce] flex items-center justify-center mx-auto border border-purple-200">
                <KeyRound className="w-6 h-6 text-[#e20d65]" />
              </div>

              <div>
                <h3 className="font-extrabold text-[#1c023d] text-base">Enter 6-Digit OTP Verification</h3>
                <p className="text-slate-500 text-xs mt-1">Verification code sent to <strong className="text-slate-900 font-mono">{phone}</strong> and <strong className="text-slate-900">{email}</strong></p>
                <p className="text-[11px] text-emerald-600 font-mono font-bold mt-1 bg-emerald-50 py-1 px-2 rounded border border-emerald-200 inline-block">
                  Demo OTP Code: 789123
                </p>
              </div>

              {/* 6 OTP Boxes */}
              <div className="flex items-center justify-center gap-2 py-2">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`otp-input-${idx}`}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                    className="w-11 h-12 text-center text-lg font-mono font-black rounded-lg bg-slate-50 border border-slate-300 focus:outline-none focus:border-[#e20d65] focus:bg-white text-[#1c023d] shadow-sm"
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-[#e20d65] hover:bg-[#cc0059] text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{loading ? 'Verifying OTP...' : 'Verify OTP & Access Portal'}</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('SIGNUP')}
                className="text-xs text-slate-400 font-bold hover:underline block mx-auto"
              >
                ← Back to Registration Form
              </button>
            </form>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-xs text-purple-300/70 border-t border-purple-900/40 relative z-10 font-mono">
        Tata Play Fiber Enterprise Operations • Multi-Hub Governance
      </footer>

    </div>
  );
};
