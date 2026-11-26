import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageSquare, 
  X, 
  Send, 
  Mic, 
  CheckCheck, 
  Sparkles, 
  Smartphone, 
  ChevronDown, 
  Bot, 
  UserCheck, 
  Minimize2,
  RefreshCw,
  PhoneCall
} from 'lucide-react';
import api from '../api/client';

export const WhatsAppBotSimulator = ({ isOpen, onToggle }) => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: "👋 *Tata Play Fiber Ops Bot*\nWelcome back, *Amit Verma*!\n\nSend a command or tap a quick action below to manage field equipment directly from WhatsApp.",
      time: '12:00 PM'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [technicianEmail, setTechnicianEmail] = useState('delhi.worker@tataplay.com');
  const [technicianPhone, setTechnicianPhone] = useState('+917620522139');
  const chatBottomRef = useRef(null);

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend = inputValue, isVoice = false) => {
    const text = textToSend.trim();
    if (!text) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isVoice: isVoice
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setLoading(true);

    try {
      const res = await api.post('/whatsapp/simulate', {
        message_text: text,
        user_email: technicianEmail,
        phone_number: technicianPhone,
        is_voice_note: isVoice
      });

      const botMsg = {
        id: Date.now() + 1,
        sender: 'bot',
        text: res.data.response,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action: res.data.action_executed
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      const errMsg = {
        id: Date.now() + 1,
        sender: 'bot',
        text: "⚠️ Connection to Ops NLP engine failed. Please try again.",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    { label: "📦 Stock ONT Delhi", text: "stock ONT Delhi" },
    { label: "🔧 Install ONT to CID-9021", text: "install TPF-NOK-W6-10001 to CID-9021" },
    { label: "🚨 Report Port Burn", text: "fault TPF-NOK-W6-10001 optical laser port melted" },
    { label: "💼 My Van Assets", text: "my assets" },
    { label: "❓ Commands Menu", text: "help" }
  ];

  return (
    <>
      {/* Floating Widget Button when closed */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed bottom-6 right-6 z-40 p-4 bg-[#25D366] hover:bg-[#20ba5a] text-white rounded-full shadow-2xl hover:scale-110 active:scale-95 transition flex items-center gap-2.5 group border-2 border-white"
          title="Open WhatsApp Field Ops Bot Simulator"
        >
          <div className="relative">
            <MessageSquare className="w-6 h-6 fill-white" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-white animate-pulse" />
          </div>
          <span className="font-bold text-xs pr-1 hidden group-hover:inline transition-all duration-300">
            WhatsApp Ops Bot
          </span>
        </button>
      )}

      {/* WhatsApp Mobile Chat Drawer */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-2rem)] h-[580px] max-h-[85vh] bg-[#efeae2] rounded-3xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col font-sans animate-in slide-in-from-bottom-5 duration-200">
          
          {/* WhatsApp Header Bar */}
          <div className="bg-[#075E54] text-white p-3.5 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-emerald-700 flex items-center justify-center font-bold text-white text-sm border-2 border-emerald-400">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#075E54]" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="font-bold text-sm tracking-tight">Tata Play Ops Bot</h4>
                  <span className="w-3.5 h-3.5 bg-emerald-400 text-[#075E54] rounded-full flex items-center justify-center text-[9px] font-black">
                    ✓
                  </span>
                </div>
                <div className="text-[11px] text-emerald-200 flex items-center gap-1">
                  <span>online • Field Tech Automation</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setMessages([messages[0]])}
                title="Clear Chat History"
                className="p-1.5 hover:bg-emerald-800 rounded-full text-emerald-100 transition"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={onToggle}
                className="p-1.5 hover:bg-emerald-800 rounded-full text-emerald-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Active Persona Banner */}
          <div className="bg-[#128C7E] px-3.5 py-1.5 text-white text-[11px] flex items-center justify-between">
            <span className="flex items-center gap-1 font-mono">
              <UserCheck className="w-3 h-3 text-emerald-200" />
              {technicianEmail.split('@')[0]} ({technicianPhone})
            </span>
            <span className="text-[10px] bg-emerald-900/60 px-2 py-0.5 rounded text-emerald-100 font-mono">
              LIVE ERP LINK
            </span>
          </div>

          {/* Messages Area with WhatsApp wallpaper look */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#efeae2]">
            {messages.map((m) => {
              const isUser = m.sender === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-3 shadow-xs text-xs relative ${
                      isUser
                        ? 'bg-[#d9fdd3] text-slate-800 rounded-tr-none'
                        : 'bg-white text-slate-800 rounded-tl-none border border-slate-200/60'
                    }`}
                  >
                    {/* Voice Note Simulation Banner */}
                    {m.isVoice && (
                      <div className="flex items-center gap-2 mb-1.5 text-emerald-800 font-bold text-[10px] pb-1 border-b border-emerald-200">
                        <Mic className="w-3.5 h-3.5 animate-pulse text-emerald-600" /> Voice Message Audio Note
                      </div>
                    )}

                    {/* Formatted Text Content */}
                    <div className="whitespace-pre-line leading-relaxed">
                      {m.text.split('\n').map((line, lIdx) => {
                        // Bold tags replacement (*text*)
                        const formatted = line.replace(/\*(.*?)\*/g, '<b>$1</b>');
                        const codeFormatted = formatted.replace(/`(.*?)`/g, '<code class="bg-black/10 px-1 py-0.5 rounded font-mono text-[10px]">$1</code>');
                        return <div key={lIdx} dangerouslySetInnerHTML={{ __html: codeFormatted }} />;
                      })}
                    </div>

                    {/* Timestamp & Read receipts */}
                    <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-slate-400">
                      <span>{m.time}</span>
                      {isUser && <CheckCheck className="w-3 h-3 text-sky-500" />}
                    </div>
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex items-start">
                <div className="bg-white rounded-2xl rounded-tl-none p-2.5 px-3 shadow-xs border border-slate-200/60 flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce [animation-delay:0.4s]" />
                  <span className="text-[10px] font-mono ml-1">AI Ops Engine executing...</span>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Quick Prompt Chips */}
          <div className="p-2 bg-[#f0f2f5] border-t border-slate-200 flex items-center gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none">
            {quickPrompts.map((q, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(q.text)}
                className="px-2.5 py-1 rounded-full bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-300 text-[11px] font-medium transition shrink-0 shadow-2xs"
              >
                {q.label}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <div className="p-3 bg-[#f0f2f5] border-t border-slate-200 flex items-center gap-2">
            <button
              onClick={() => handleSendMessage("voice: I just installed ONT TPF-NOK-W6-10001 at Customer CID-9021", true)}
              title="Simulate Technician Voice Note"
              className="p-2 rounded-full hover:bg-slate-200 text-slate-600 transition shrink-0"
            >
              <Mic className="w-5 h-5 text-emerald-700" />
            </button>

            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type WhatsApp message..."
              className="flex-1 py-2 px-3.5 text-xs bg-white border border-slate-300 rounded-full focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-inner"
            />

            <button
              onClick={() => handleSendMessage()}
              disabled={!inputValue.trim()}
              className="p-2 rounded-full bg-[#075E54] hover:bg-[#128C7E] disabled:opacity-40 text-white transition shrink-0 shadow"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

        </div>
      )}
    </>
  );
};
