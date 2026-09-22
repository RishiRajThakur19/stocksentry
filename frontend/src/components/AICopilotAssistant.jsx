import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Sparkles, X, ArrowRight, MapPin, Wrench, Users, Package, AlertTriangle, FileText, Truck, Compass, ShieldCheck } from 'lucide-react';
import api from '../api/client';

export const AICopilotAssistant = ({ isFullPage = false, setActiveTab }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: '👋 **Hello! I am your StockSentry Air-Gapped Operational Copilot**.\n\nRunning **100% on-premise** with zero external LLM dependencies or data leakage. Ask me anything about City Managers, Hub Stock counts, Open Alerts, Equipment Faults, or Staff Offboarding!',
      actions: [
        "What is the current manager at Delhi?",
        "What is stock count at Delhi?",
        "Which field technicians reported fault today?",
        "Is there any open alert?"
      ],
      navigation_actions: [
        { label: "🗺️ Regional Stock Matrix", tab: "regional-stock" },
        { label: "🛠️ Repairs & Fault Console", tab: "repairs" },
        { label: "👥 User & Hub Directory", tab: "users-mgmt" }
      ]
    }
  ]);
  const [inputMsg, setInputMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  const suggestedChips = [
    "What is the current manager at Delhi?",
    "Stock count at Delhi?",
    "Which field technicians reported fault today?",
    "Is there any open alert?",
    "How many locations are there?",
    "Who is offboarding?"
  ];

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend) => {
    const query = textToSend || inputMsg;
    if (!query.trim()) return;

    const userMessage = { sender: 'user', text: query };
    setMessages(prev => [...prev, userMessage]);
    setInputMsg('');
    setLoading(true);

    try {
      const res = await api.post('/ai/copilot/chat', { message: query });
      const botMessage = {
        sender: 'bot',
        text: res.data.reply,
        actions: res.data.suggested_actions || [],
        navigation_actions: res.data.navigation_actions || []
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (err) {
      setMessages(prev => [...prev, {
        sender: 'bot',
        text: '⚠️ Unable to process request. Ensure the local StockSentry intelligence service is running.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (tab) => {
    if (setActiveTab) {
      setActiveTab(tab);
    }
  };

  const renderNavigationButtons = (navActions) => {
    if (!navActions || navActions.length === 0) return null;
    return (
      <div className="pt-2.5 pb-1 border-t border-slate-200/80 space-y-1.5">
        <div className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-[#e20d65]">
          <Compass className="w-3 h-3 text-[#e20d65]" />
          <span>One-Click Action & Navigation:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {navActions.map((nav, nIdx) => (
            <button
              key={nIdx}
              onClick={() => handleNavigate(nav.tab)}
              className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1c023d] hover:bg-[#e20d65] text-white font-bold text-[11px] shadow-sm transition-all duration-150 transform hover:-translate-y-0.5"
            >
              <span>{nav.label}</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-white group-hover:translate-x-0.5 transition-transform" />
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderSuggestedChips = (actions) => {
    if (!actions || actions.length === 0) return null;
    return (
      <div className="pt-2 flex flex-wrap gap-1.5 border-t border-slate-200/50">
        {actions.map((act, aIdx) => (
          <button
            key={aIdx}
            onClick={() => handleSendMessage(act)}
            className="px-2.5 py-1 rounded-full bg-purple-50 hover:bg-purple-100 border border-purple-200 text-[#6700ce] font-semibold text-[10.5px] transition flex items-center gap-1 shadow-2xs"
          >
            <Sparkles className="w-2.5 h-2.5 text-[#e20d65]" />
            <span>{act}</span>
          </button>
        ))}
      </div>
    );
  };

  if (isFullPage) {
    return (
      <div className="space-y-6 pb-12 font-sans w-full max-w-4xl mx-auto">
        {/* Full Page Header */}
        <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded bg-purple-50 text-[#6700ce] border border-purple-100">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[#1c023d] flex items-center gap-2">
                <span>StockSentry Enterprise Copilot</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  Air-Gapped / Zero Cloud LLM
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">Query live stock counts, city managers, open alerts, equipment fault complaints, and jump directly to consoles.</p>
            </div>
          </div>
        </div>

        {/* Chat Body Container */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col h-[640px]">
          {/* Chat Messages Log */}
          <div className="flex-1 p-6 overflow-y-auto space-y-4 text-xs">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-lg p-4 space-y-2.5 ${
                  m.sender === 'user' 
                    ? 'bg-[#1c023d] text-white font-semibold rounded-br-none shadow-sm' 
                    : 'bg-slate-50 border border-slate-200 text-slate-900 rounded-bl-none shadow-sm'
                }`}>
                  <p className="whitespace-pre-line leading-relaxed">{m.text}</p>
                  {renderNavigationButtons(m.navigation_actions)}
                  {renderSuggestedChips(m.actions)}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="p-3 rounded bg-slate-50 border border-slate-200 text-slate-500 text-xs font-bold flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-[#e20d65] border-t-transparent rounded-full animate-spin" />
                  <span>StockSentry Intelligence is searching live databases...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Prompt Chips */}
          <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center gap-2 overflow-x-auto text-[11px]">
            <span className="text-slate-400 font-bold shrink-0">Quick Queries:</span>
            {suggestedChips.map((chip, cIdx) => (
              <button
                key={cIdx}
                onClick={() => handleSendMessage(chip)}
                className="px-3 py-1 rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold transition shrink-0"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Chat Input Bar */}
          <div className="p-4 border-t border-slate-200 bg-white">
            <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex items-center gap-3">
              <input
                type="text"
                value={inputMsg}
                onChange={(e) => setInputMsg(e.target.value)}
                placeholder="Ask about Delhi manager, stock count, open alerts, technician complaints..."
                className="flex-1 px-4 py-2.5 rounded bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#e20d65] font-medium"
              />
              <button
                type="submit"
                disabled={loading || !inputMsg.trim()}
                className="px-5 py-2.5 rounded bg-[#e20d65] hover:bg-[#cc0059] text-white font-extrabold text-xs transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Ask</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Floating Chatbot Widget Version
  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          data-tour="ai-copilot-btn"
          className="px-4 py-3 rounded-full bg-[#1c023d] hover:bg-[#2c095c] text-white font-extrabold text-xs shadow-xl transition flex items-center gap-2 border border-[#e20d65] cursor-pointer"
        >
          <Bot className="w-5 h-5 text-[#e20d65]" />
          <span>AI Copilot</span>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
        </button>
      ) : (
        <div className="w-[420px] h-[560px] bg-white rounded-xl border border-slate-300 shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-200">
          {/* Header */}
          <div className="bg-[#1c023d] text-white p-3.5 flex items-center justify-between border-b border-purple-900/50">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-purple-950/80 rounded border border-purple-500/30">
                <Bot className="w-4 h-4 text-[#e20d65]" />
              </div>
              <div>
                <span className="font-extrabold text-xs block leading-tight">StockSentry Copilot</span>
                <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                  <ShieldCheck className="w-2.5 h-2.5" /> 100% On-Premise Air-Gapped
                </span>
              </div>
            </div>

            <button onClick={() => setIsOpen(false)} className="p-1 text-slate-300 hover:text-white rounded hover:bg-white/10 transition cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Prompt Chips (Top Bar) */}
          <div className="px-3 py-1.5 bg-slate-100 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto text-[10px] no-scrollbar">
            {suggestedChips.map((chip, cIdx) => (
              <button
                key={cIdx}
                onClick={() => handleSendMessage(chip)}
                className="px-2.5 py-1 rounded bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 font-semibold transition shrink-0 cursor-pointer"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3 text-xs bg-slate-50/50">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] rounded-lg p-3 space-y-2 ${
                  m.sender === 'user' 
                    ? 'bg-[#1c023d] text-white font-medium rounded-br-none shadow-xs' 
                    : 'bg-white border border-slate-200 text-slate-900 rounded-bl-none shadow-xs'
                }`}>
                  <p className="whitespace-pre-line leading-relaxed">{m.text}</p>
                  {renderNavigationButtons(m.navigation_actions)}
                  {renderSuggestedChips(m.actions)}
                </div>
              </div>
            ))}
            {loading && (
              <div className="p-2.5 rounded bg-white border border-slate-200 text-slate-500 text-xs font-medium flex items-center gap-2 shadow-2xs">
                <div className="w-3.5 h-3.5 border-2 border-[#e20d65] border-t-transparent rounded-full animate-spin" />
                <span>Searching live operational data...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="p-2.5 border-t border-slate-200 bg-white flex items-center gap-2">
            <input
              type="text"
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              placeholder="Ask Delhi manager, stock count, alerts..."
              className="flex-1 px-3 py-2 rounded bg-slate-50 border border-slate-300 text-xs focus:outline-none focus:border-[#e20d65] focus:bg-white transition"
            />
            <button
              type="submit"
              disabled={!inputMsg.trim() || loading}
              className="p-2 rounded bg-[#e20d65] hover:bg-[#cc0059] text-white font-bold transition disabled:opacity-40 cursor-pointer shadow-xs"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
