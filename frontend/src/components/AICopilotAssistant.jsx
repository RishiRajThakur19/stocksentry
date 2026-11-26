import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, Send, Sparkles, X, ArrowRight, MapPin, Wrench, Users, 
  Package, AlertTriangle, FileText, Truck, Compass, ShieldCheck,
  Maximize2, Minimize2, Copy, Check, RotateCcw, Search, ChevronRight,
  Activity, Clock, ShieldAlert, CheckCircle2, DollarSign, ExternalLink
} from 'lucide-react';
import api from '../api/client';

export const AICopilotAssistant = ({ isFullPage = false, setActiveTab }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [copiedTextKey, setCopiedTextKey] = useState(null);
  const [activeCategory, setActiveCategory] = useState('ALL');

  const initialBotWelcome = {
    sender: 'bot',
    text: '👋 **Welcome to StockSentry Enterprise Copilot**.\n\nOperating in **100% on-premise air-gapped mode** with zero external cloud dependencies or corporate data leakage. Query live regional stock, hub managers, critical threshold breaches, field technician complaints, and personnel offboarding in real time.',
    actions: [
      "What is the current manager at Delhi?",
      "What is stock count at Delhi?",
      "Which field technicians reported fault today?",
      "Is there any open alert?",
      "How many locations are there?",
      "Who is offboarding?"
    ],
    navigation_actions: [
      { label: "🗺️ Regional Stock Matrix", tab: "regional-stock" },
      { label: "🛠️ Repairs & Fault Console", tab: "repairs" },
      { label: "👥 User & Hub Directory", tab: "users-mgmt" },
      { label: "⚠️ Alert Telemetry", tab: "alerts" }
    ],
    structured_card: {
      card_type: "KPI_SUMMARY",
      title: "Executive System Status & Telemetry",
      badge: "Air-Gapped Core",
      badge_color: "emerald",
      metrics: [
        { label: "Network Coverage", value: "7 City Hubs", status: "HEALTHY" },
        { label: "Active Regions", value: "4 Zones", status: "HEALTHY" },
        { label: "Security Mode", value: "Zero Cloud LLM", status: "HEALTHY" },
        { label: "Data Integrity", value: "Live ACID DB", status: "HEALTHY" }
      ]
    }
  };

  const [messages, setMessages] = useState([initialBotWelcome]);
  const [inputMsg, setInputMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  const categoryChips = [
    { id: 'ALL', label: 'All Queries' },
    { id: 'STOCK', label: '📦 Stock & SKUs' },
    { id: 'ALERTS', label: '⚠️ Alerts' },
    { id: 'FAULTS', label: '🛠️ Tech Complaints' },
    { id: 'HUBS', label: '📍 Hubs & Managers' },
    { id: 'OFFBOARD', label: '📋 Offboarding' }
  ];

  const suggestedByCat = {
    ALL: [
      "What is the current manager at Delhi?",
      "What is stock count at Delhi?",
      "Which field technicians reported fault today?",
      "Is there any open alert?",
      "How many locations are there?",
      "Who is offboarding?"
    ],
    STOCK: [
      "What is stock count at Delhi?",
      "What is central stock level?",
      "Central inventory valuation?",
      "Search Fiber Modem - Nokia"
    ],
    ALERTS: [
      "Is there any open alert?",
      "Which SKUs breached threshold?",
      "Check Juniper Modem alerts"
    ],
    FAULTS: [
      "Which field technicians reported fault today?",
      "What is the repair triage status?",
      "Show all open equipment complaints"
    ],
    HUBS: [
      "What is the current manager at Delhi?",
      "Who is manager at Mumbai?",
      "How many locations are there?",
      "Nationwide field technicians count?"
    ],
    OFFBOARD: [
      "Who is offboarding?",
      "Check Vikram Sharma clearance status",
      "How many NOC certificates issued?"
    ]
  };

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen, isExpanded]);

  const handleSendMessage = async (textToSend) => {
    const query = textToSend || inputMsg;
    if (!query.trim()) return;

    const userMessage = { sender: 'user', text: query, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setMessages(prev => [...prev, userMessage]);
    setInputMsg('');
    setLoading(true);

    try {
      const res = await api.post('/ai/copilot/chat', { message: query });
      const botMessage = {
        sender: 'bot',
        text: res.data.reply,
        actions: res.data.suggested_actions || [],
        navigation_actions: res.data.navigation_actions || [],
        structured_card: res.data.structured_card || null,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (err) {
      setMessages(prev => [...prev, {
        sender: 'bot',
        text: '⚠️ Unable to process request. Ensure the local StockSentry intelligence service is running.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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

  const handleCopyText = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedTextKey(key);
    setTimeout(() => setCopiedTextKey(null), 2000);
  };

  const handleClearChat = () => {
    setMessages([initialBotWelcome]);
  };

  // Simple Markdown text formatter
  const renderFormattedText = (rawText) => {
    if (!rawText) return null;
    const lines = rawText.split('\n');

    return (
      <div className="space-y-1.5 text-xs leading-relaxed">
        {lines.map((line, lIdx) => {
          if (!line.trim()) return <div key={lIdx} className="h-1.5" />;

          // Headers
          if (line.startsWith('### ')) {
            return <h4 key={lIdx} className="font-black text-[#1c023d] text-xs pt-1">{line.replace('### ', '')}</h4>;
          }
          if (line.startsWith('## ') || line.startsWith('🛠️') || line.startsWith('📍') || line.startsWith('📦') || line.startsWith('⚠️') || line.startsWith('📋') || line.startsWith('🚚') || line.startsWith('🤖') || line.startsWith('💰') || line.startsWith('🌐') || line.startsWith('👷')) {
            return <div key={lIdx} className="font-extrabold text-[#1c023d] text-xs pt-1 flex items-center gap-1.5">{line}</div>;
          }

          // Bullet point
          const isBullet = line.startsWith('• ') || line.startsWith('- ');
          const isSubBullet = line.startsWith('  - ') || line.startsWith('    • ');
          const content = isBullet ? line.substring(2) : (isSubBullet ? line.substring(4) : line);

          // Inline formatting (bold & code)
          const parts = content.split(/(\*\*.*?\*\*|`.*?`|\*".*?"\*)/g);

          const formattedContent = parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={pIdx} className="font-bold text-[#1c023d]">{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('`') && part.endsWith('`')) {
              return (
                <code key={pIdx} className="px-1 py-0.5 rounded bg-slate-100 text-[#6700ce] font-mono text-[10px] border border-slate-200">
                  {part.slice(1, -1)}
                </code>
              );
            }
            if (part.startsWith('*"') && part.endsWith('"*')) {
              return <span key={pIdx} className="italic text-slate-600 font-medium">"{part.slice(2, -2)}"</span>;
            }
            return part;
          });

          if (isBullet) {
            return (
              <div key={lIdx} className="flex items-start gap-1.5 pl-1">
                <span className="text-[#e20d65] font-black shrink-0">•</span>
                <span className="text-slate-700">{formattedContent}</span>
              </div>
            );
          }

          if (isSubBullet) {
            return (
              <div key={lIdx} className="flex items-start gap-1.5 pl-4 text-[11px] text-slate-600">
                <span className="text-slate-400 font-black shrink-0">▫</span>
                <span>{formattedContent}</span>
              </div>
            );
          }

          return <p key={lIdx} className="text-slate-700">{formattedContent}</p>;
        })}
      </div>
    );
  };

  // Visual Interactive Structured Card Renderer
  const renderStructuredCard = (card) => {
    if (!card) return null;

    switch (card.card_type) {
      case 'KPI_SUMMARY':
        return (
          <div className="mt-3 p-3.5 rounded-xl bg-gradient-to-br from-[#1c023d] to-[#340866] text-white border border-purple-800/60 shadow-md space-y-3">
            <div className="flex items-center justify-between border-b border-purple-800/40 pb-2">
              <span className="text-xs font-black tracking-wide flex items-center gap-1.5 text-purple-100">
                <Activity className="w-3.5 h-3.5 text-[#e20d65]" />
                {card.title}
              </span>
              {card.badge && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  {card.badge}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {card.metrics?.map((m, mIdx) => (
                <div key={mIdx} className="p-2 rounded-lg bg-white/5 border border-white/10 flex flex-col justify-between">
                  <span className="text-[10px] text-purple-200 font-medium">{m.label}</span>
                  <span className="text-sm font-black text-white mt-1">{m.value}</span>
                </div>
              ))}
            </div>
          </div>
        );

      case 'FAULT_LIST':
        return (
          <div className="mt-3 p-3.5 rounded-xl bg-white border border-rose-200/80 shadow-md space-y-3">
            <div className="flex items-center justify-between border-b border-rose-100 pb-2">
              <div className="flex items-center gap-1.5">
                <div className="p-1 rounded bg-rose-50 text-rose-600 border border-rose-200">
                  <Wrench className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-black text-slate-900">{card.title}</span>
              </div>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                {card.badge}
              </span>
            </div>

            {card.metrics && (
              <div className="grid grid-cols-4 gap-1.5 py-1 text-center">
                {card.metrics.map((met, metIdx) => (
                  <div key={metIdx} className="p-1.5 rounded bg-slate-50 border border-slate-200/60">
                    <span className="text-[9px] text-slate-500 uppercase font-bold block">{met.label}</span>
                    <span className="text-xs font-black text-[#1c023d]">{met.value}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {card.items?.map((item, iIdx) => (
                <div key={iIdx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-purple-300 transition-colors space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-[#1c023d]">{item.item_name}</span>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded ${
                      item.status === 'OPEN' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                      item.status === 'ROUTED_TO_REPAIR' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                      'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500 text-[10px]">
                    <span className="flex items-center gap-1">
                      <Users className="w-2.5 h-2.5" /> {item.reporter_name}
                    </span>
                    <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 flex items-center gap-1">
                      <span>{item.serial_number}</span>
                      <button 
                        onClick={() => handleCopyText(item.serial_number, `sn-${item.complaint_id}`)}
                        className="text-slate-400 hover:text-[#e20d65] cursor-pointer"
                        title="Copy Serial Number"
                      >
                        {copiedTextKey === `sn-${item.complaint_id}` ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <Copy className="w-2.5 h-2.5" />}
                      </button>
                    </span>
                  </div>
                  <p className="text-slate-600 italic bg-white p-1.5 rounded border border-slate-100">
                    "{item.description}"
                  </p>
                </div>
              ))}
            </div>

            <button
              onClick={() => handleNavigate('repairs')}
              className="w-full py-1.5 rounded-lg bg-[#1c023d] hover:bg-[#e20d65] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <span>Manage Repairs Console</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        );

      case 'HUB_PROFILE':
        return (
          <div className="mt-3 p-3.5 rounded-xl bg-white border border-purple-200 shadow-md space-y-3">
            <div className="flex items-center justify-between border-b border-purple-100 pb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-purple-100 text-[#6700ce]">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-[#1c023d]">{card.city} Regional Hub</h4>
                  <p className="text-[10px] text-slate-500 font-medium">{card.hub_name}</p>
                </div>
              </div>
              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-purple-50 text-[#6700ce] border border-purple-200">
                {card.region}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 rounded bg-slate-50 border border-slate-200/80">
                <span className="text-[9px] text-slate-500 uppercase font-bold block">City Hub Manager</span>
                <span className="font-bold text-slate-900 block truncate">{card.manager_name}</span>
                <span className="text-[9.5px] text-slate-500 block truncate">{card.manager_email}</span>
              </div>
              <div className="p-2 rounded bg-slate-50 border border-slate-200/80">
                <span className="text-[9px] text-slate-500 uppercase font-bold block">Regional Admin</span>
                <span className="font-bold text-slate-900 block truncate">{card.regional_admin_name}</span>
                <span className="text-[9.5px] text-slate-500 block truncate">{card.regional_admin_email}</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-purple-50/60 border border-purple-100 text-xs">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#6700ce]" />
                <span className="text-slate-700 font-medium">Ground Force:</span>
              </div>
              <span className="font-black text-[#1c023d]">{card.technicians_count} Field Technicians</span>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => handleNavigate('regional-stock')}
                className="flex-1 py-1.5 rounded-lg bg-[#1c023d] hover:bg-[#e20d65] text-white font-bold text-xs flex items-center justify-center gap-1 transition cursor-pointer shadow-xs"
              >
                <span>Stock Matrix</span>
                <ArrowRight className="w-3 h-3" />
              </button>
              <button
                onClick={() => handleNavigate('users-mgmt')}
                className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1 transition cursor-pointer border border-slate-300"
              >
                <span>Hub Team</span>
                <ExternalLink className="w-3 h-3 text-slate-500" />
              </button>
            </div>
          </div>
        );

      case 'TOPOLOGY_GRID':
        return (
          <div className="mt-3 p-3.5 rounded-xl bg-white border border-slate-200 shadow-md space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-black text-[#1c023d] flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-[#e20d65]" />
                {card.title}
              </span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                {card.badge}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
              {card.hubs?.map((hub, hIdx) => (
                <div key={hIdx} className="p-2 rounded-lg bg-slate-50 border border-slate-200/80 hover:border-purple-300 transition text-[11px] flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-[#1c023d]">{hub.city}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-[#6700ce]">
                      {hub.region}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
                    <span>Mgr: {hub.manager_name}</span>
                    <span className="font-bold text-slate-700">{hub.technicians_count} Techs</span>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => handleNavigate('regional-stock')}
              className="w-full py-1.5 rounded-lg bg-[#1c023d] hover:bg-[#e20d65] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <span>Explore Interactive Regional Matrix</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        );

      case 'STOCK_TABLE':
        return (
          <div className="mt-3 p-3.5 rounded-xl bg-white border border-indigo-200 shadow-md space-y-3">
            <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
              <span className="text-xs font-black text-[#1c023d] flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-indigo-600" />
                {card.title}
              </span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                {card.badge}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2 rounded bg-indigo-50/50 border border-indigo-100">
                <span className="text-[9px] uppercase font-bold text-indigo-600 block">Serialized Hardware</span>
                <span className="text-base font-black text-[#1c023d]">{card.serialized_total} units</span>
              </div>
              <div className="p-2 rounded bg-slate-50 border border-slate-200">
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Consumables & Passive</span>
                <span className="text-base font-black text-[#1c023d]">~{card.consumables_total} units</span>
              </div>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {card.items?.map((it, itIdx) => (
                <div key={itIdx} className="p-2 rounded bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">{it.item_name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-[#1c023d]">{it.count} units</span>
                    <span className={`w-2 h-2 rounded-full ${it.status === 'HEALTHY' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => handleNavigate('regional-stock')}
              className="w-full py-1.5 rounded-lg bg-[#1c023d] hover:bg-[#e20d65] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <span>View City Stock Details</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        );

      case 'ALERT_FEED':
        return (
          <div className="mt-3 p-3.5 rounded-xl bg-white border border-rose-200 shadow-md space-y-3">
            <div className="flex items-center justify-between border-b border-rose-100 pb-2">
              <span className="text-xs font-black text-[#1c023d] flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                {card.title}
              </span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${
                card.status === 'CRITICAL' ? 'bg-rose-50 text-rose-700 border-rose-300' : 'bg-emerald-50 text-emerald-700 border-emerald-300'
              }`}>
                {card.badge}
              </span>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {card.alerts?.length === 0 ? (
                <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800 text-center text-xs font-bold border border-emerald-200">
                  🎉 Zero threshold breaches active. Central warehouse inventory is operating within optimal margins.
                </div>
              ) : (
                card.alerts?.map((al, aIdx) => (
                  <div key={aIdx} className="p-2.5 rounded-lg bg-rose-50/50 border border-rose-200 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-900">{al.item_name}</span>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-200 text-rose-900 uppercase">
                        {al.severity}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-600">
                      <span>Variant: <strong>{al.variant_name}</strong></span>
                      <span className="text-rose-700 font-bold">Deficit: {al.deficit} units</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-rose-600 h-full rounded-full" 
                        style={{ width: `${Math.min(100, (al.current_qty / (al.threshold || 1)) * 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[9.5px] text-slate-500">
                      <span>Stock: <strong>{al.current_qty}</strong></span>
                      <span>Threshold: <strong>{al.threshold}</strong></span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => handleNavigate('alerts')}
              className="w-full py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <span>Open Alert Resolution Desk</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        );

      case 'OFFBOARDING_CASE':
        return (
          <div className="mt-3 p-3.5 rounded-xl bg-white border border-amber-200 shadow-md space-y-3">
            <div className="flex items-center justify-between border-b border-amber-100 pb-2">
              <span className="text-xs font-black text-[#1c023d] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-600" />
                {card.title}
              </span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                {card.badge}
              </span>
            </div>

            {card.target_case && (
              <div className="p-3 rounded-lg bg-amber-50/60 border border-amber-200 space-y-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-extrabold text-slate-900">{card.target_case.name}</span>
                    <span className="text-[10px] text-slate-500 block">{card.target_case.role} ({card.target_case.hub})</span>
                  </div>
                  <span className="text-[9.5px] font-black px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
                    {card.target_case.clearance_status}
                  </span>
                </div>

                <div className="p-2 bg-white rounded border border-amber-100 space-y-1">
                  <span className="text-[9.5px] font-bold text-slate-500 uppercase block">Held Field Equipment ({card.target_case.assets_held_count} Items):</span>
                  {card.target_case.assets?.map((as, asIdx) => (
                    <div key={asIdx} className="flex items-center justify-between text-[10px] text-slate-700">
                      <span>• {as.item_name} ({as.variant})</span>
                      <span className="font-mono bg-slate-100 px-1 py-0.2 rounded text-[9px]">{as.serial_number}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => handleNavigate('offboarding')}
              className="w-full py-1.5 rounded-lg bg-[#1c023d] hover:bg-[#e20d65] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <span>Manage Staff Offboarding & NOC</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        );

      case 'LOGISTICS_TRACKING':
        return (
          <div className="mt-3 p-3.5 rounded-xl bg-white border border-indigo-200 shadow-md space-y-3">
            <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
              <span className="text-xs font-black text-[#1c023d] flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-indigo-600" />
                {card.title}
              </span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                {card.badge}
              </span>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {card.shipments?.map((sh, sIdx) => (
                <div key={sIdx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] space-y-1">
                  <div className="flex items-center justify-between font-bold text-slate-900">
                    <span>{sh.quantity}x {sh.item_name}</span>
                    <span className="text-[#e20d65]">➔ {sh.destination}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>Carrier: <strong>{sh.carrier}</strong></span>
                    <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 flex items-center gap-1">
                      {sh.tracking_number}
                      <button 
                        onClick={() => handleCopyText(sh.tracking_number, `awb-${sh.request_id}`)}
                        className="text-slate-400 hover:text-indigo-600 cursor-pointer"
                      >
                        {copiedTextKey === `awb-${sh.request_id}` ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <Copy className="w-2.5 h-2.5" />}
                      </button>
                    </span>
                  </div>
                  <div className="text-[9.5px] text-emerald-700 font-bold flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" /> ETA: {sh.eta}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => handleNavigate('tracking')}
              className="w-full py-1.5 rounded-lg bg-[#1c023d] hover:bg-[#e20d65] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <span>Open In-Transit Dispatch Radar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        );

      case 'INVENTORY_SEARCH':
        return (
          <div className="mt-3 p-3.5 rounded-xl bg-white border border-slate-200 shadow-md space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-black text-[#1c023d] flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-[#e20d65]" />
                {card.title}
              </span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-purple-50 text-[#6700ce] border border-purple-200">
                {card.badge}
              </span>
            </div>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {card.items?.map((it, iIdx) => (
                <div key={iIdx} className="p-2 rounded bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-[#1c023d] block">{it.item_name}</span>
                    <span className="text-[10px] text-slate-500">{it.variant_name} ({it.category})</span>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-[#1c023d] block">{it.stock} units</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                      it.is_low_stock ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {it.is_low_stock ? 'LOW STOCK' : 'HEALTHY'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => handleNavigate('central-stock')}
              className="w-full py-1.5 rounded-lg bg-[#1c023d] hover:bg-[#e20d65] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <span>View Full Central Catalog</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  const renderNavigationButtons = (navActions) => {
    if (!navActions || navActions.length === 0) return null;
    return (
      <div className="pt-2 pb-1 border-t border-slate-200/80 space-y-1.5">
        <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-[#e20d65]">
          <Compass className="w-3 h-3 text-[#e20d65]" />
          <span>One-Click Action & Navigation:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {navActions.map((nav, nIdx) => (
            <button
              key={nIdx}
              onClick={() => handleNavigate(nav.tab)}
              className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1c023d] hover:bg-[#e20d65] text-white font-bold text-[11px] shadow-sm transition-all duration-150 transform hover:-translate-y-0.5 cursor-pointer"
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
      <div className="pt-2 flex flex-wrap gap-1.5 border-t border-slate-200/60">
        {actions.map((act, aIdx) => (
          <button
            key={aIdx}
            onClick={() => handleSendMessage(act)}
            className="px-2.5 py-1 rounded-full bg-purple-50 hover:bg-purple-100 border border-purple-200 text-[#6700ce] font-semibold text-[10.5px] transition flex items-center gap-1 shadow-2xs cursor-pointer"
          >
            <Sparkles className="w-2.5 h-2.5 text-[#e20d65]" />
            <span>{act}</span>
          </button>
        ))}
      </div>
    );
  };

  // Full-Page View Render
  if (isFullPage) {
    return (
      <div className="space-y-6 pb-12 font-sans w-full max-w-5xl mx-auto">
        {/* Full Page Header */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="p-3.5 rounded-xl bg-gradient-to-br from-[#1c023d] to-[#6700ce] text-white shadow-md">
              <Bot className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[#1c023d] flex items-center gap-2">
                <span>StockSentry Enterprise Copilot</span>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  100% Air-Gapped / Zero External LLM
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">Live deterministic database querying across Managers, Stock Levels, Threshold Alerts, and Technician Complaints.</p>
            </div>
          </div>
          <button
            onClick={handleClearChat}
            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        </div>

        {/* Chat Body Container */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[700px] overflow-hidden">
          {/* Category Filter Pills */}
          <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2 overflow-x-auto text-[11px] no-scrollbar">
            <span className="text-slate-400 font-bold shrink-0">Filter Domain:</span>
            {categoryChips.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1 rounded-full font-bold transition shrink-0 cursor-pointer ${
                  activeCategory === cat.id 
                    ? 'bg-[#1c023d] text-white shadow-xs' 
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Chat Messages Log */}
          <div className="flex-1 p-6 overflow-y-auto space-y-4 text-xs bg-slate-50/30">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-4 space-y-3 ${
                  m.sender === 'user' 
                    ? 'bg-[#1c023d] text-white font-medium rounded-br-none shadow-md' 
                    : 'bg-white border border-slate-200 text-slate-900 rounded-bl-none shadow-sm'
                }`}>
                  <div className="flex items-center justify-between pb-1 border-b border-slate-100 text-[10px] text-slate-400">
                    <span className="font-bold flex items-center gap-1">
                      {m.sender === 'user' ? <span className="text-purple-300">Operations Commander</span> : <span className="text-[#e20d65] font-black">StockSentry Copilot</span>}
                    </span>
                    <span>{m.timestamp}</span>
                  </div>
                  {renderFormattedText(m.text)}
                  {m.structured_card && renderStructuredCard(m.structured_card)}
                  {renderNavigationButtons(m.navigation_actions)}
                  {renderSuggestedChips(m.actions)}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-bold flex items-center gap-2.5 shadow-sm">
                  <div className="w-4 h-4 border-2 border-[#e20d65] border-t-transparent rounded-full animate-spin" />
                  <span>StockSentry Intelligence is executing live database telemetry...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Prompt Chips */}
          <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center gap-2 overflow-x-auto text-[11px] no-scrollbar">
            <span className="text-slate-400 font-bold shrink-0">Suggestions:</span>
            {(suggestedByCat[activeCategory] || suggestedByCat.ALL).map((chip, cIdx) => (
              <button
                key={cIdx}
                onClick={() => handleSendMessage(chip)}
                className="px-3 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold transition shrink-0 cursor-pointer shadow-2xs"
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
                className="flex-1 px-4 py-3 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#e20d65] focus:bg-white font-medium transition shadow-inner"
              />
              <button
                type="submit"
                disabled={loading || !inputMsg.trim()}
                className="px-6 py-3 rounded-xl bg-[#e20d65] hover:bg-[#cc0059] text-white font-black text-xs transition flex items-center gap-2 shadow-md disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Submit Query</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Floating Executive Copilot Widget Version (Docked bottom right)
  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          data-tour="ai-copilot-btn"
          className="group px-4 py-3 rounded-full bg-gradient-to-r from-[#1c023d] to-[#40057c] hover:from-[#2a035c] hover:to-[#5707a8] text-white font-black text-xs shadow-2xl transition-all duration-200 flex items-center gap-2.5 border-2 border-[#e20d65] cursor-pointer transform hover:scale-105"
        >
          <div className="p-1 rounded-full bg-[#e20d65] text-white">
            <Bot className="w-4 h-4" />
          </div>
          <span>AI Ops Copilot</span>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
        </button>
      ) : (
        <div className={`bg-white rounded-2xl border border-slate-300 shadow-2xl flex flex-col overflow-hidden transition-all duration-200 animate-in fade-in slide-in-from-bottom-4 ${
          isExpanded ? 'w-[680px] h-[680px]' : 'w-[440px] h-[580px]'
        }`}>
          {/* Header */}
          <div className="bg-gradient-to-r from-[#1c023d] to-[#3a046c] text-white p-3.5 flex items-center justify-between border-b border-purple-900/60 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-purple-950 rounded-lg border border-purple-500/40 shadow-inner">
                <Bot className="w-4 h-4 text-[#e20d65]" />
              </div>
              <div>
                <span className="font-black text-xs block leading-tight">StockSentry Copilot</span>
                <span className="text-[9.5px] text-emerald-400 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-2.5 h-2.5" /> 100% On-Premise Air-Gapped
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleClearChat}
                className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
                title="Reset Conversation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
                title={isExpanded ? "Collapse View" : "Expand Workspace"}
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <button 
                onClick={() => setIsOpen(false)} 
                className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Domain Filter Bar */}
          <div className="px-3 py-1.5 bg-slate-100 border-b border-slate-200 flex items-center gap-1 overflow-x-auto text-[10px] no-scrollbar">
            {categoryChips.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-2 py-0.5 rounded-full font-bold transition shrink-0 cursor-pointer ${
                  activeCategory === cat.id 
                    ? 'bg-[#1c023d] text-white shadow-xs' 
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3.5 text-xs bg-slate-50/40">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[92%] rounded-2xl p-3.5 space-y-2.5 shadow-sm ${
                  m.sender === 'user' 
                    ? 'bg-[#1c023d] text-white font-medium rounded-br-none shadow-md' 
                    : 'bg-white border border-slate-200 text-slate-900 rounded-bl-none'
                }`}>
                  <div className="flex items-center justify-between text-[9px] text-slate-400 pb-0.5">
                    <span className="font-bold">
                      {m.sender === 'user' ? 'You' : 'StockSentry Bot'}
                    </span>
                    <span>{m.timestamp}</span>
                  </div>
                  {renderFormattedText(m.text)}
                  {m.structured_card && renderStructuredCard(m.structured_card)}
                  {renderNavigationButtons(m.navigation_actions)}
                  {renderSuggestedChips(m.actions)}
                </div>
              </div>
            ))}
            {loading && (
              <div className="p-3 rounded-xl bg-white border border-slate-200 text-slate-500 text-xs font-bold flex items-center gap-2 shadow-xs">
                <div className="w-3.5 h-3.5 border-2 border-[#e20d65] border-t-transparent rounded-full animate-spin" />
                <span>Querying live operational databases...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Chips Bar (Above Input) */}
          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center gap-1.5 overflow-x-auto text-[10px] no-scrollbar">
            {(suggestedByCat[activeCategory] || suggestedByCat.ALL).map((chip, cIdx) => (
              <button
                key={cIdx}
                onClick={() => handleSendMessage(chip)}
                className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold transition shrink-0 cursor-pointer shadow-2xs"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Input Form */}
          <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="p-2.5 border-t border-slate-200 bg-white flex items-center gap-2">
            <input
              type="text"
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              placeholder="Ask Delhi manager, stock count, alerts..."
              className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs focus:outline-none focus:border-[#e20d65] focus:bg-white transition"
            />
            <button
              type="submit"
              disabled={!inputMsg.trim() || loading}
              className="p-2.5 rounded-xl bg-[#e20d65] hover:bg-[#cc0059] text-white font-bold transition disabled:opacity-40 cursor-pointer shadow-sm flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
export default AICopilotAssistant;
