import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Radio, 
  Send, 
  Search, 
  Megaphone, 
  User, 
  Users, 
  ShieldAlert, 
  CheckCheck, 
  Check, 
  Clock, 
  Building2, 
  MapPin, 
  AlertTriangle, 
  Sparkles, 
  RefreshCw, 
  Info, 
  ShieldCheck, 
  Compass, 
  CornerDownRight, 
  ChevronRight,
  Filter
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';

export const CommunicationsCenterPage = () => {
  const { user } = useAuth();
  const [activeMode, setActiveMode] = useState('CHANNELS'); // 'CHANNELS' | 'DIRECT'
  const [channels, setChannels] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // New Message Form State
  const [messageContent, setMessageContent] = useState('');
  const [messageSubject, setMessageSubject] = useState('');
  const [messagePriority, setMessagePriority] = useState('NORMAL'); // 'NORMAL' | 'URGENT' | 'OPERATIONAL_DIRECTIVE'
  const [statusNotice, setStatusNotice] = useState(null);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch Channels
  const fetchChannels = useCallback(async () => {
    try {
      const res = await api.get('/communications/channels');
      setChannels(res.data);
      if (!selectedChannel && !selectedContact && res.data.length > 0) {
        setSelectedChannel(res.data[0]);
      }
    } catch (err) {
      console.error('Error fetching channels:', err);
    }
  }, [selectedChannel, selectedContact]);

  // Fetch Contacts
  const fetchContacts = useCallback(async () => {
    try {
      const res = await api.get('/communications/contacts');
      setContacts(res.data);
    } catch (err) {
      console.error('Error fetching contacts:', err);
    }
  }, []);

  // Fetch Messages for current selection
  const fetchMessages = useCallback(async () => {
    if (!selectedChannel && !selectedContact) return;
    setLoading(true);
    try {
      let params = {};
      if (activeMode === 'CHANNELS' && selectedChannel) {
        params = {
          channel_type: selectedChannel.channel_type,
          target_region_id: selectedChannel.target_region_id,
          target_city_id: selectedChannel.target_city_id
        };
      } else if (activeMode === 'DIRECT' && selectedContact) {
        params = {
          channel_type: 'DIRECT',
          recipient_id: selectedContact.user_id
        };
      }

      const res = await api.get('/communications/messages', { params });
      setMessages(res.data);

      // Auto mark thread as read if direct
      if (activeMode === 'DIRECT' && selectedContact) {
        await api.post(`/communications/read-thread?recipient_id=${selectedContact.user_id}`).catch(() => {});
        // Refresh contacts unread count
        fetchContacts();
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoading(false);
    }
  }, [activeMode, selectedChannel, selectedContact, fetchContacts]);

  useEffect(() => {
    fetchChannels();
    fetchContacts();
  }, [fetchChannels, fetchContacts]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = useCallback((data) => {
    if (data.type === 'NEW_COMMUNICATION_MESSAGE') {
      // If current thread matches incoming message, refresh feed
      const isCurrentChannel = 
        activeMode === 'CHANNELS' && 
        selectedChannel && 
        selectedChannel.channel_type === data.channel_type &&
        (!data.target_region_id || data.target_region_id === selectedChannel.target_region_id) &&
        (!data.target_city_id || data.target_city_id === selectedChannel.target_city_id);

      const isCurrentDM = 
        activeMode === 'DIRECT' && 
        selectedContact && 
        (data.sender_id === selectedContact.user_id || data.recipient_id === selectedContact.user_id);

      if (isCurrentChannel || isCurrentDM) {
        fetchMessages();
      } else {
        // Refresh sidebar indicators
        fetchChannels();
        fetchContacts();
      }
    }
  }, [activeMode, selectedChannel, selectedContact, fetchMessages, fetchChannels, fetchContacts]);

  useWebSocket(handleWebSocketMessage);

  // Send Message Handler
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!messageContent.trim()) return;

    setSending(true);
    setStatusNotice(null);

    try {
      const payload = {
        content: messageContent.trim(),
        subject: messageSubject.trim() || undefined,
        priority: messagePriority,
      };

      if (activeMode === 'CHANNELS' && selectedChannel) {
        payload.channel_type = selectedChannel.channel_type;
        payload.target_region_id = selectedChannel.target_region_id;
        payload.target_city_id = selectedChannel.target_city_id;
      } else if (activeMode === 'DIRECT' && selectedContact) {
        payload.channel_type = 'DIRECT';
        payload.recipient_id = selectedContact.user_id;
      }

      await api.post('/communications/send', payload);
      setMessageContent('');
      setMessageSubject('');
      setMessagePriority('NORMAL');
      fetchMessages();
      fetchChannels();
    } catch (err) {
      console.error('Error sending message:', err);
      const detail = err.response?.data?.detail || 'Failed to send message. Please verify hierarchy permissions.';
      setStatusNotice({ type: 'error', text: detail });
    } finally {
      setSending(false);
    }
  };

  // Contacts filtering
  const filteredContacts = contacts.filter((c) => {
    const matchesSearch = 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.city_name && c.city_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.region_name && c.region_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      c.hierarchy_relation.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === 'ALL' || c.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const canCurrentPost = () => {
    if (activeMode === 'CHANNELS') {
      return selectedChannel?.can_post;
    }
    return true; // Direct messages allowed based on contacts list
  };

  const getPriorityBadgeClass = (priority) => {
    switch (priority) {
      case 'OPERATIONAL_DIRECTIVE':
        return 'bg-purple-900/90 text-purple-200 border-purple-500 shadow-xs animate-pulse';
      case 'URGENT':
        return 'bg-amber-950/80 text-amber-300 border-amber-600 shadow-xs';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'SUPER_ADMIN':
      case 'CENTRAL_ADMIN':
        return 'bg-rose-950 text-rose-300 border-rose-700';
      case 'REGIONAL_ADMIN':
        return 'bg-indigo-950 text-indigo-300 border-indigo-700';
      case 'MANAGER':
        return 'bg-emerald-950 text-emerald-300 border-emerald-700';
      case 'FIELD_WORKER':
        return 'bg-amber-950 text-amber-300 border-amber-700';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="space-y-4">
      {/* Enterprise Header Banner */}
      <div className="bg-gradient-to-r from-[#1c023d] via-[#2c0b56] to-[#120026] text-white p-5 border border-purple-900/50 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-gradient-to-br from-[#e20d65] to-purple-600 flex items-center justify-center shadow-xs">
                <Radio className="w-4 h-4 text-white animate-pulse" />
              </div>
              <h1 className="text-xl font-black tracking-tight">
                Unified Comms & Team Dispatch Center
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase bg-[#e20d65]/30 text-rose-300 border border-[#e20d65]/50">
                Tata Play Fiber ERP
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium">
              4-Tier Organizational Hierarchy Messaging: Top-down operational directives & peer-to-manager dispatch memos.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-purple-950/70 border border-purple-800 px-3.5 py-1.5 rounded flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <div className="text-left">
                <div className="text-[10px] font-mono uppercase text-purple-300 tracking-wider">Active Station</div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>{user?.name || 'Staff User'}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded border font-mono ${getRoleBadgeClass(user?.role)}`}>
                    {user?.role}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                fetchChannels();
                fetchContacts();
                fetchMessages();
              }}
              className="p-2.5 bg-white/10 hover:bg-white/20 rounded border border-white/20 text-white transition flex items-center gap-1.5 text-xs font-bold"
              title="Refresh Comms Feed"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main 3-Pane Comms Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-185px)] min-h-[640px]">
        {/* ================= PANE 1: CHANNELS & DIRECT CONTACTS (4 Cols) ================= */}
        <div className="lg:col-span-4 bg-white border border-slate-200 shadow-xs flex flex-col h-full overflow-hidden">
          {/* Mode Switcher Tabs */}
          <div className="p-2 bg-slate-50 border-b border-slate-200 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveMode('CHANNELS');
                if (channels.length > 0 && !selectedChannel) setSelectedChannel(channels[0]);
              }}
              className={`flex-1 py-2 px-3 text-xs font-extrabold flex items-center justify-center gap-2 rounded transition ${
                activeMode === 'CHANNELS'
                  ? 'bg-[#1c023d] text-white shadow-xs'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              <Megaphone className="w-3.5 h-3.5 text-[#e20d65]" />
              <span>Broadcast Directives</span>
              {channels.some(c => c.unread_count > 0) && (
                <span className="w-2 h-2 rounded-full bg-[#e20d65]"></span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveMode('DIRECT');
                if (contacts.length > 0 && !selectedContact) setSelectedContact(contacts[0]);
              }}
              className={`flex-1 py-2 px-3 text-xs font-extrabold flex items-center justify-center gap-2 rounded transition ${
                activeMode === 'DIRECT'
                  ? 'bg-[#1c023d] text-white shadow-xs'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              <span>Direct Hierarchy</span>
              {contacts.some(c => c.unread_count > 0) && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-[#e20d65] text-white">
                  {contacts.reduce((acc, c) => acc + (c.unread_count || 0), 0)}
                </span>
              )}
            </button>
          </div>

          {/* CHANNELS LIST */}
          {activeMode === 'CHANNELS' && (
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
              <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                Operational Channels ({channels.length})
              </div>
              {channels.map((chan) => {
                const isSelected = selectedChannel?.channel_id === chan.channel_id;
                return (
                  <button
                    key={chan.channel_id}
                    onClick={() => {
                      setSelectedChannel(chan);
                      setSelectedContact(null);
                    }}
                    className={`w-full text-left p-3 rounded transition flex items-start gap-3 ${
                      isSelected
                        ? 'bg-purple-50/80 border-l-4 border-[#e20d65] shadow-xs'
                        : 'hover:bg-slate-50 border-l-4 border-transparent'
                    }`}
                  >
                    <div className="w-9 h-9 rounded bg-[#1c023d] text-white flex items-center justify-center shrink-0 shadow-xs font-bold text-sm">
                      {chan.channel_type === 'BROADCAST_NATIONWIDE' ? '📢' : chan.channel_type === 'BROADCAST_REGION' ? '🌐' : '🏙️'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-xs font-extrabold text-[#1c023d] truncate">
                          {chan.name}
                        </span>
                        {chan.can_post && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-bold">
                            Can Post
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1 leading-snug">
                        {chan.description}
                      </p>
                      {chan.last_message && (
                        <div className="mt-1.5 text-[10px] text-slate-600 bg-white/80 p-1.5 rounded border border-slate-200/70">
                          <span className="font-bold text-purple-900">{chan.last_message.subject || 'Notice'}: </span>
                          <span className="italic truncate">{chan.last_message.content}</span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* DIRECT CONTACTS LIST */}
          {activeMode === 'DIRECT' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Search & Filter Bar */}
              <div className="p-2 border-b border-slate-200 space-y-2 bg-white">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search personnel, role, city..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-600"
                  />
                </div>

                <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px]">
                  {['ALL', 'SUPER_ADMIN', 'REGIONAL_ADMIN', 'MANAGER', 'FIELD_WORKER'].map((r) => (
                    <button
                      key={r}
                      onClick={() => setRoleFilter(r)}
                      className={`px-2 py-0.5 rounded font-mono font-bold whitespace-nowrap transition ${
                        roleFilter === r
                          ? 'bg-[#1c023d] text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                    >
                      {r === 'ALL' ? 'All Roles' : r.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Contacts Scrollable */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
                {filteredContacts.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No contacts matching your search criteria.
                  </div>
                ) : (
                  filteredContacts.map((c) => {
                    const isSelected = selectedContact?.user_id === c.user_id;
                    return (
                      <button
                        key={c.user_id}
                        onClick={() => {
                          setSelectedContact(c);
                          setSelectedChannel(null);
                        }}
                        className={`w-full text-left p-2.5 rounded transition flex items-start gap-2.5 ${
                          isSelected
                            ? 'bg-purple-50/80 border-l-4 border-indigo-600 shadow-xs'
                            : 'hover:bg-slate-50 border-l-4 border-transparent'
                        }`}
                      >
                        <div className="w-8 h-8 rounded bg-slate-800 text-white flex items-center justify-center shrink-0 font-bold text-xs uppercase shadow-xs">
                          {c.name.substring(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="text-xs font-bold text-[#1c023d] truncate">
                              {c.name}
                            </span>
                            {c.unread_count > 0 && (
                              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold bg-[#e20d65] text-white">
                                {c.unread_count} new
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                            <span className="truncate text-indigo-700 font-semibold">{c.hierarchy_relation}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[9px] text-slate-400 mt-0.5">
                            <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                            <span className="truncate">
                              {c.city_name || c.region_name || 'Central Corporate'}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* ================= PANE 2: ACTIVE CONVERSATION FEED (6 Cols) ================= */}
        <div className="lg:col-span-5 bg-white border border-slate-200 shadow-xs flex flex-col h-full overflow-hidden">
          {/* Thread Header */}
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded bg-[#1c023d] text-white flex items-center justify-center font-bold text-base shadow-xs">
                {activeMode === 'CHANNELS' ? (
                  selectedChannel?.channel_type === 'BROADCAST_NATIONWIDE' ? '📢' : '🌐'
                ) : (
                  <User className="w-4 h-4 text-purple-300" />
                )}
              </div>
              <div>
                <h2 className="text-xs font-black text-[#1c023d]">
                  {activeMode === 'CHANNELS'
                    ? selectedChannel?.name || 'Select Channel'
                    : selectedContact?.name || 'Select Contact'}
                </h2>
                <div className="text-[10px] text-slate-500 flex items-center gap-1.5 font-medium">
                  {activeMode === 'CHANNELS' ? (
                    <span>Broadcast Feed • {selectedChannel?.channel_type}</span>
                  ) : (
                    <>
                      <span className="text-indigo-700 font-bold">{selectedContact?.hierarchy_relation}</span>
                      <span>•</span>
                      <span>{selectedContact?.city_name || selectedContact?.region_name || 'HQ'}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchMessages}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded transition"
                title="Refresh Messages"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
            {loading ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                Loading operational messages...
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-2 text-slate-400">
                <Compass className="w-8 h-8 text-slate-300" />
                <div className="text-xs font-bold text-slate-600">No Messages in this Thread Yet</div>
                <p className="text-[11px] text-slate-400 max-w-xs">
                  {canCurrentPost()
                    ? 'Start this operational thread by composing a message below.'
                    : 'No announcements have been issued to this channel yet.'}
                </p>
              </div>
            ) : (
              messages.map((m) => {
                const isMyMessage = m.sender_id === user?.user_id;
                return (
                  <div
                    key={m.message_id}
                    className={`flex flex-col ${isMyMessage ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded p-3 border shadow-xs space-y-1.5 ${
                        isMyMessage
                          ? 'bg-purple-50 border-purple-200 text-slate-800'
                          : m.priority === 'OPERATIONAL_DIRECTIVE'
                          ? 'bg-purple-950 text-purple-50 border-purple-800'
                          : m.priority === 'URGENT'
                          ? 'bg-amber-50 border-amber-300 text-amber-950'
                          : 'bg-white border-slate-200 text-slate-800'
                      }`}
                    >
                      {/* Sender Meta Header */}
                      <div className="flex items-center justify-between gap-3 text-[10px] pb-1 border-b border-black/5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold">
                            {isMyMessage ? 'You' : m.sender_name}
                          </span>
                          <span
                            className={`px-1 py-0.2 rounded font-mono text-[9px] border font-bold ${getRoleBadgeClass(
                              m.sender_role
                            )}`}
                          >
                            {m.sender_role}
                          </span>
                        </div>

                        {m.priority !== 'NORMAL' && (
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-black border ${getPriorityBadgeClass(
                              m.priority
                            )}`}
                          >
                            {m.priority === 'OPERATIONAL_DIRECTIVE' ? 'DIRECTIVE' : 'URGENT'}
                          </span>
                        )}
                      </div>

                      {/* Subject if provided */}
                      {m.subject && (
                        <div className="text-xs font-bold text-[#1c023d] pt-0.5">
                          {m.subject}
                        </div>
                      )}

                      {/* Content */}
                      <div className="text-xs leading-relaxed whitespace-pre-wrap font-sans">
                        {m.content}
                      </div>

                      {/* Timestamp & Read Receipt */}
                      <div className="flex items-center justify-end gap-1.5 text-[9px] text-slate-400 pt-1 font-mono">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {isMyMessage && (
                          <span>
                            {m.is_read ? (
                              <CheckCheck className="w-3 h-3 text-indigo-600 inline ml-0.5" title="Read" />
                            ) : (
                              <Check className="w-3 h-3 text-slate-400 inline ml-0.5" title="Sent" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Status Notice */}
          {statusNotice && (
            <div className={`p-2 text-xs flex items-center justify-between ${
              statusNotice.type === 'error' ? 'bg-rose-50 text-rose-800 border-t border-rose-200' : 'bg-emerald-50 text-emerald-800'
            }`}>
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>{statusNotice.text}</span>
              </div>
              <button onClick={() => setStatusNotice(null)} className="text-xs font-bold">✕</button>
            </div>
          )}

          {/* Composer / Input Area */}
          <div className="p-3 bg-white border-t border-slate-200">
            {!canCurrentPost() ? (
              <div className="bg-slate-100 p-3 rounded border border-slate-200 text-center space-y-1">
                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-700">
                  <ShieldAlert className="w-4 h-4 text-purple-700" />
                  <span>Channel Posting Restricted by Hierarchy</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {selectedChannel?.channel_type === 'BROADCAST_NATIONWIDE'
                    ? 'Nationwide executive broadcasts are reserved for Super Admin.'
                    : 'Only Regional Admins and City Managers can issue operational broadcast dispatches.'}
                  {' '}Switch to "Direct Hierarchy" to send an operational message to your manager.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSendMessage} className="space-y-2">
                {/* Priority & Subject row */}
                <div className="flex items-center gap-2">
                  <select
                    value={messagePriority}
                    onChange={(e) => setMessagePriority(e.target.value)}
                    className="text-[11px] font-mono font-bold px-2 py-1 bg-slate-50 border border-slate-200 rounded focus:outline-none"
                  >
                    <option value="NORMAL">Priority: Normal</option>
                    <option value="URGENT">Priority: URGENT ⚠️</option>
                    {(user?.role === 'SUPER_ADMIN' || user?.role === 'CENTRAL_ADMIN' || user?.role === 'REGIONAL_ADMIN') && (
                      <option value="OPERATIONAL_DIRECTIVE">OPERATIONAL DIRECTIVE ⚡</option>
                    )}
                  </select>

                  <input
                    type="text"
                    value={messageSubject}
                    onChange={(e) => setMessageSubject(e.target.value)}
                    placeholder="Subject (Optional)..."
                    className="flex-1 text-xs px-2.5 py-1 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-600"
                  />
                </div>

                {/* Textarea & Send button */}
                <div className="flex items-end gap-2">
                  <textarea
                    rows={2}
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={`Compose ${activeMode === 'CHANNELS' ? 'broadcast directive' : 'direct message'} (Press Enter to send)...`}
                    className="flex-1 p-2 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-600 resize-none font-sans"
                  />

                  <button
                    type="submit"
                    disabled={sending || !messageContent.trim()}
                    className="px-4 py-2 bg-[#1c023d] hover:bg-purple-900 disabled:opacity-50 text-white rounded font-extrabold text-xs flex items-center gap-1.5 shadow-xs transition shrink-0"
                  >
                    {sending ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5 text-[#e20d65]" />
                    )}
                    <span>Send</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* ================= PANE 3: HIERARCHY INTELLIGENCE & CONTEXT (3 Cols) ================= */}
        <div className="lg:col-span-3 bg-white border border-slate-200 shadow-xs flex flex-col h-full overflow-y-auto p-4 space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="text-xs font-black text-[#1c023d] uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Hierarchy Scope & Governance</span>
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Strict communication boundaries enforced per Tata Play Fiber SOP.
            </p>
          </div>

          {/* Active entity info card */}
          {activeMode === 'CHANNELS' && selectedChannel && (
            <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-2 text-xs">
              <div className="font-bold text-[#1c023d]">{selectedChannel.name}</div>
              <p className="text-[11px] text-slate-500">{selectedChannel.description}</p>
              
              <div className="pt-2 border-t border-slate-200/60 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-mono">Scope:</span>
                  <span className="font-bold text-slate-700">{selectedChannel.channel_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-mono">Posting Authority:</span>
                  <span className="font-bold text-purple-900">
                    {selectedChannel.channel_type === 'BROADCAST_NATIONWIDE' ? 'Super Admin Only' : 'Admins & Hub Managers'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-mono">Your Clearance:</span>
                  <span className={`font-mono font-bold ${selectedChannel.can_post ? 'text-emerald-600' : 'text-slate-500'}`}>
                    {selectedChannel.can_post ? 'READ & WRITE' : 'READ ONLY'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeMode === 'DIRECT' && selectedContact && (
            <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-[#1c023d] text-white flex items-center justify-center font-bold text-xs">
                  {selectedContact.name.substring(0, 2)}
                </div>
                <div>
                  <div className="font-bold text-[#1c023d]">{selectedContact.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{selectedContact.email}</div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-mono">Role Tier:</span>
                  <span className={`font-mono font-bold px-1 rounded text-[10px] border ${getRoleBadgeClass(selectedContact.role)}`}>
                    {selectedContact.role}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-mono">Relation:</span>
                  <span className="font-bold text-indigo-700">{selectedContact.hierarchy_relation}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-mono">Jurisdiction:</span>
                  <span className="font-bold text-slate-700">
                    {selectedContact.city_name || selectedContact.region_name || 'Nationwide Central'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Tata Play Fiber 4-Tier SOP Rules Reference */}
          <div className="bg-purple-50/60 p-3 rounded border border-purple-200 space-y-2">
            <div className="text-[11px] font-black text-[#1c023d] uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#e20d65]" />
              <span>Hierarchical Protocol</span>
            </div>
            
            <ul className="text-[10px] text-slate-600 space-y-1.5 list-disc pl-3">
              <li>
                <strong className="text-purple-950">Super Admin</strong>: Directs nationwide directives across all circles; unrestricted direct communication.
              </li>
              <li>
                <strong className="text-purple-950">Regional Admin</strong>: Issues regional directives for their circles; oversees hub managers & escalation requests.
              </li>
              <li>
                <strong className="text-purple-950">Hub Manager</strong>: Dispatches shift orders to field techs; messages peer managers & regional leadership.
              </li>
              <li>
                <strong className="text-purple-950">Field Worker</strong>: Operates ground fiber tasks; direct escalation line to City Hub Manager and peers.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
