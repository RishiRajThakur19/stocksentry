import React, { useState, useEffect } from 'react';
import { 
  Users, Plus, KeyRound, CheckCircle2, ShieldCheck, Mail, MapPin, Search, 
  Download, Building, ShieldAlert, Smartphone, RefreshCw, Layers, CheckSquare, Square
} from 'lucide-react';
import api from '../api/client';
import { exportToCSV } from '../utils/exportHelper';

export const UserManagementSection = ({ locations = [] }) => {
  const [users, setUsers] = useState([]);
  const [regions, setRegions] = useState([]);
  const [allLocations, setAllLocations] = useState(locations || []);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');
  const [syncingCrm, setSyncingCrm] = useState(false);
  const [crmFeedback, setCrmFeedback] = useState('');

  // Create User Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('MANAGER');
  const [regionId, setRegionId] = useState(1);
  const [locationId, setLocationId] = useState(1);
  const [createTerritoryIds, setCreateTerritoryIds] = useState([1]);
  const [password, setPassword] = useState('manager123');

  // Reset Password Modal
  const [selectedUserForReset, setSelectedUserForReset] = useState(null);
  const [newPass, setNewPass] = useState('manager123');

  // Multi-Territory & Transfer Modal
  const [selectedUserForTerritories, setSelectedUserForTerritories] = useState(null);
  const [selectedTerritoryIds, setSelectedTerritoryIds] = useState([]);
  const [savingTerritories, setSavingTerritories] = useState(false);

  const fetchUsersAndRegions = async () => {
    try {
      const [usersRes, regionsRes, locsRes] = await Promise.all([
        api.get('/users'),
        api.get('/inventory/regions'),
        api.get('/inventory/locations')
      ]);
      setUsers(usersRes.data);
      setRegions(regionsRes.data);
      if (locsRes.data && locsRes.data.length > 0) {
        setAllLocations(locsRes.data);
        if (!locationId) setLocationId(locsRes.data[0].location_id);
      }
      if (regionsRes.data.length > 0) {
        setRegionId(regionsRes.data[0].region_id);
      }
    } catch (err) {
      console.error("Failed to fetch users/regions", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAndRegions();
  }, []);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name,
        email,
        role,
        password
      };

      if (role === 'REGIONAL_ADMIN') {
        payload.region_id = parseInt(regionId);
      } else if (role === 'MANAGER' || role === 'FIELD_WORKER') {
        payload.city_id = parseInt(locationId);
        payload.location_id = parseInt(locationId);
        payload.territory_ids = createTerritoryIds.length > 0 ? createTerritoryIds : [parseInt(locationId)];
      }

      await api.post('/users', payload);
      setIsCreateOpen(false);
      setName('');
      setEmail('');
      setCrmFeedback(`Successfully created user account for ${name} with assigned territories!`);
      setTimeout(() => setCrmFeedback(''), 5000);
      fetchUsersAndRegions();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to create user.");
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUserForReset) return;
    try {
      await api.put(`/users/${selectedUserForReset.user_id}/reset-password`, {
        new_password: newPass
      });
      alert(`Password reset successfully for ${selectedUserForReset.name}`);
      setSelectedUserForReset(null);
    } catch (err) {
      alert("Failed to reset password.");
    }
  };

  const openTerritoriesModal = (user) => {
    setSelectedUserForTerritories(user);
    const existingIds = user.territory_ids && user.territory_ids.length > 0
      ? [...user.territory_ids]
      : (user.city_id ? [user.city_id] : (user.location_id ? [user.location_id] : []));
    setSelectedTerritoryIds(existingIds);
  };

  const toggleTerritorySelection = (locId) => {
    if (selectedTerritoryIds.includes(locId)) {
      setSelectedTerritoryIds(selectedTerritoryIds.filter(id => id !== locId));
    } else {
      setSelectedTerritoryIds([...selectedTerritoryIds, locId]);
    }
  };

  const toggleCreateTerritory = (locId) => {
    if (createTerritoryIds.includes(locId)) {
      if (createTerritoryIds.length > 1) {
        setCreateTerritoryIds(createTerritoryIds.filter(id => id !== locId));
      }
    } else {
      setCreateTerritoryIds([...createTerritoryIds, locId]);
    }
  };

  const handleSaveTerritories = async (e) => {
    e.preventDefault();
    if (!selectedUserForTerritories) return;
    if (selectedTerritoryIds.length === 0) {
      alert("Please select at least one territory / city hub.");
      return;
    }

    setSavingTerritories(true);
    try {
      await api.put(`/users/${selectedUserForTerritories.user_id}/territories`, {
        territory_ids: selectedTerritoryIds
      });
      setCrmFeedback(`Assigned ${selectedTerritoryIds.length} operational territories to ${selectedUserForTerritories.name}!`);
      setTimeout(() => setCrmFeedback(''), 5000);
      setSelectedUserForTerritories(null);
      await fetchUsersAndRegions();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to update territories.");
    } finally {
      setSavingTerritories(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesRole = filterRole === 'ALL' || u.role === filterRole;
    const matchesSearch = (
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.location_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.region_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.territory_names || []).some(t => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.role || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
    return matchesRole && matchesSearch;
  });

  const handleExportCSV = () => {
    exportToCSV('user_management_accounts.csv', filteredUsers, [
      { label: 'User ID', key: 'user_id' },
      { label: 'Name', key: 'name' },
      { label: 'Email', key: 'email' },
      { label: 'Role', key: 'role' },
      { label: 'Assigned Region', key: 'region_name' },
      { label: 'Assigned City Hub', key: 'location_name' },
      { label: 'All Territories', key: 'territory_names' }
    ]);
  };

  const handleSyncLakshya = async () => {
    setSyncingCrm(true);
    setCrmFeedback('');
    try {
      const res = await api.post('/users/sync-lakshya', {});
      setCrmFeedback(`Synced ${res.data.scanned_count} workforce profiles from My Lakshya CRM! (${res.data.created_count} new, ${res.data.updated_count} updated)`);
      await fetchUsersAndRegions();
      setTimeout(() => setCrmFeedback(''), 6000);
    } catch (err) {
      setCrmFeedback(err.response?.data?.detail || 'CRM Sync failed');
      setTimeout(() => setCrmFeedback(''), 6000);
    } finally {
      setSyncingCrm(false);
    }
  };

  return (
    <div className="space-y-6 font-sans w-full max-w-[1600px] mx-auto pb-12">
      
      {/* Header */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-6 h-6 text-[#e20d65]" />
            <h1 className="text-2xl font-black text-[#1c023d] tracking-tight">User & Regional Hierarchy Management</h1>
          </div>
          <p className="text-xs text-slate-500">
            4-Tier Governance: Super Admins, Regional Admins, Multi-Territory City Managers, and Field Technicians.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 font-bold text-xs">
          <button
            disabled={syncingCrm}
            onClick={handleSyncLakshya}
            className="px-4 py-2.5 rounded bg-gradient-to-r from-[#1c023d] to-[#6700ce] hover:opacity-95 text-white shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Smartphone className="w-4 h-4 text-pink-300" />
            <RefreshCw className={`w-3.5 h-3.5 ${syncingCrm ? 'animate-spin' : ''}`} />
            <span>{syncingCrm ? 'Syncing...' : 'Sync My Lakshya CRM'}</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 shadow-sm transition flex items-center gap-2"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2.5 rounded bg-[#e20d65] hover:bg-[#cc0059] text-white shadow-sm transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create User Account</span>
          </button>
        </div>
      </div>

      {crmFeedback && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs flex items-center gap-2 animate-fade-in shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{crmFeedback}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-bold">
          <span className="text-slate-400 uppercase text-[10px] tracking-wider">Role Filter:</span>
          {['ALL', 'SUPER_ADMIN', 'REGIONAL_ADMIN', 'MANAGER', 'FIELD_WORKER'].map(r => (
            <button
              key={r}
              onClick={() => setFilterRole(r)}
              className={`px-3 py-1 rounded transition text-xs ${
                filterRole === r 
                  ? 'bg-[#1c023d] text-white shadow-xs' 
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              {r.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="relative min-w-[280px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, email, territory, or city..."
            className="w-full pl-9 pr-3.5 py-1.5 rounded border border-slate-300 text-xs focus:outline-none focus:border-[#e20d65]"
          />
        </div>
      </div>

      {/* Users Data Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden w-full">
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200 z-10 shadow-xs">
              <tr>
                <th className="py-3 px-4">User ID</th>
                <th className="py-3 px-4">Full Name</th>
                <th className="py-3 px-4">Email Address</th>
                <th className="py-3 px-4">Tier / Role</th>
                <th className="py-3 px-4">Assigned Operational Territories</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Management Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredUsers.map((u) => {
                const roleBadges = {
                  SUPER_ADMIN: 'bg-purple-100 text-[#6700ce] border-purple-200',
                  REGIONAL_ADMIN: 'bg-indigo-100 text-indigo-700 border-indigo-200',
                  MANAGER: 'bg-slate-100 text-slate-700 border-slate-200',
                  FIELD_WORKER: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                };

                const isMultiTerritoryEligible = u.role === 'MANAGER' || u.role === 'FIELD_WORKER';

                return (
                  <tr key={u.user_id} className="hover:bg-purple-50/40 even:bg-slate-50/40 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-400">#USR-00{u.user_id}</td>
                    <td className="py-3 px-4 font-extrabold text-[#1c023d]">{u.name}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{u.email}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase border ${
                        roleBadges[u.role] || 'bg-slate-100 text-slate-700'
                      }`}>
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {u.role === 'SUPER_ADMIN' ? (
                        <span className="text-slate-400 font-mono text-xs">National (Central Pool)</span>
                      ) : u.role === 'REGIONAL_ADMIN' ? (
                        <span className="px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs inline-flex items-center gap-1">
                          <Building className="w-3 h-3" />
                          <span>{u.region_name || 'Assigned Region'}</span>
                        </span>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex flex-wrap gap-1 items-center">
                            {u.territory_names && u.territory_names.length > 0 ? (
                              u.territory_names.map((tName, idx) => (
                                <span 
                                  key={idx} 
                                  className={`px-2 py-0.5 rounded text-[11px] font-bold inline-flex items-center gap-1 border ${
                                    idx === 0 
                                      ? 'bg-purple-50 text-[#6700ce] border-purple-200' 
                                      : 'bg-pink-50 text-[#e20d65] border-pink-200'
                                  }`}
                                >
                                  <MapPin className="w-2.5 h-2.5" />
                                  <span>{tName}</span>
                                </span>
                              ))
                            ) : (
                              <span className="px-2.5 py-1 rounded bg-purple-50 text-[#6700ce] border border-purple-200 text-xs inline-flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-[#e20d65]" />
                                <span>{u.location_name || 'City Hub'}</span>
                              </span>
                            )}
                          </div>
                          {u.region_name && (
                            <span className="text-[10px] text-slate-400 block font-normal">
                              Region: {u.region_name}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 text-[10px] uppercase">
                        Active
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {isMultiTerritoryEligible && (
                          <button
                            onClick={() => openTerritoriesModal(u)}
                            className="px-2.5 py-1 rounded text-xs font-bold bg-pink-50 hover:bg-pink-100 text-[#e20d65] border border-pink-200 transition flex items-center gap-1"
                            title="Assign multiple territories or transfer hub"
                          >
                            <MapPin className="w-3 h-3" />
                            <span>Assign / Transfer Hub</span>
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedUserForReset(u)}
                          className="px-2.5 py-1 rounded text-xs font-bold bg-purple-50 hover:bg-purple-100 text-[#6700ce] border border-purple-200 transition flex items-center gap-1"
                        >
                          <KeyRound className="w-3 h-3" />
                          <span>Reset</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Territories & Transfer Place Modal */}
      {selectedUserForTerritories && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#e20d65]" />
                <h3 className="text-lg font-black text-[#1c023d]">Assign Operational Territories / Transfer Place</h3>
              </div>
              <button 
                onClick={() => setSelectedUserForTerritories(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 bg-purple-50/60 border border-purple-100 rounded-xl p-3 text-xs">
              <p className="font-extrabold text-[#1c023d]">{selectedUserForTerritories.name} ({selectedUserForTerritories.role})</p>
              <p className="text-slate-500 font-mono text-[11px]">{selectedUserForTerritories.email}</p>
              <p className="text-[11px] text-[#6700ce] mt-1 font-semibold">
                ✓ One manager or technician can oversee multiple city territories simultaneously.
              </p>
            </div>

            <form onSubmit={handleSaveTerritories} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-extrabold mb-2">
                  Select Telecom Hub Territories (Multi-Select Allowed):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1 border border-slate-200 rounded-lg">
                  {allLocations.map((loc) => {
                    const isChecked = selectedTerritoryIds.includes(loc.location_id);
                    return (
                      <div
                        key={loc.location_id}
                        onClick={() => toggleTerritorySelection(loc.location_id)}
                        className={`p-2.5 rounded-lg border cursor-pointer transition flex items-center gap-2.5 ${
                          isChecked 
                            ? 'bg-purple-50 border-[#6700ce] text-[#1c023d]' 
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-[#e20d65] shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <div>
                          <p className="font-extrabold text-xs">{loc.name}</p>
                          <p className="text-[10px] text-slate-500 font-normal">{loc.city} • ID #{loc.location_id}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px]">
                <strong>Notice:</strong> Assigning new territories immediately expands this manager's dashboard visibility, allowing them to supervise orders, assets, and field technicians in all selected circles.
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedUserForTerritories(null)}
                  className="px-4 py-2 rounded bg-slate-100 text-slate-700 font-bold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTerritories}
                  className="px-4 py-2 rounded bg-[#e20d65] hover:bg-[#cc0059] text-white font-bold shadow-sm disabled:opacity-50"
                >
                  {savingTerritories ? 'Saving...' : 'Save Territories / Transfer Place'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-2xl">
            <h3 className="text-lg font-black text-[#1c023d] mb-4">Create StockSentry Account</h3>
            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-extrabold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Vikramaditya Singh"
                  className="w-full px-3.5 py-2.5 rounded bg-slate-50 border border-slate-300 font-semibold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-extrabold mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@tataplay.com"
                  className="w-full px-3.5 py-2.5 rounded bg-slate-50 border border-slate-300 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-extrabold mb-1">Role Tier</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded bg-slate-50 border border-slate-300 font-bold"
                  >
                    <option value="FIELD_WORKER">Field Worker / Tech</option>
                    <option value="MANAGER">City Manager</option>
                    <option value="REGIONAL_ADMIN">Regional Admin</option>
                    <option value="SUPER_ADMIN">Super Admin (Central)</option>
                  </select>
                </div>

                {role === 'REGIONAL_ADMIN' && (
                  <div>
                    <label className="block text-slate-700 font-extrabold mb-1">Assigned Region</label>
                    <select
                      value={regionId}
                      onChange={(e) => setRegionId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded bg-slate-50 border border-slate-300 font-bold"
                    >
                      {regions.map((r) => (
                        <option key={r.region_id} value={r.region_id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {(role === 'MANAGER' || role === 'FIELD_WORKER') && (
                  <div>
                    <label className="block text-slate-700 font-extrabold mb-1">Primary Base Hub</label>
                    <select
                      value={locationId}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setLocationId(val);
                        if (!createTerritoryIds.includes(val)) {
                          setCreateTerritoryIds([...createTerritoryIds, val]);
                        }
                      }}
                      className="w-full px-3.5 py-2.5 rounded bg-slate-50 border border-slate-300 font-bold"
                    >
                      {allLocations.map((loc) => (
                        <option key={loc.location_id} value={loc.location_id}>
                          {loc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {(role === 'MANAGER' || role === 'FIELD_WORKER') && (
                <div>
                  <label className="block text-slate-700 font-extrabold mb-1">
                    Additional Territories (Multi-Select Allowed):
                  </label>
                  <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                    {allLocations.map((loc) => {
                      const isSel = createTerritoryIds.includes(loc.location_id);
                      return (
                        <button
                          key={loc.location_id}
                          type="button"
                          onClick={() => toggleCreateTerritory(loc.location_id)}
                          className={`px-2 py-1 rounded text-[11px] font-bold border transition ${
                            isSel 
                              ? 'bg-[#1c023d] text-white border-[#1c023d]' 
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          {isSel ? '✓ ' : '+ '}{loc.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-extrabold mb-1">Initial Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded bg-slate-50 border border-slate-300 font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded bg-slate-100 text-slate-700 font-bold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-[#e20d65] hover:bg-[#cc0059] text-white font-bold shadow-sm"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {selectedUserForReset && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-2xl">
            <h3 className="text-lg font-black text-[#1c023d] mb-1">Reset Password</h3>
            <p className="text-xs text-slate-500 mb-4">Reset password for <strong className="text-slate-900">{selectedUserForReset.name}</strong> ({selectedUserForReset.email})</p>

            <form onSubmit={handleResetSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-extrabold mb-1">New Password</label>
                <input
                  type="password"
                  required
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded bg-slate-50 border border-slate-300 font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedUserForReset(null)}
                  className="px-4 py-2 rounded bg-slate-100 text-slate-700 font-bold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-[#6700ce] hover:bg-[#5200a5] text-white font-bold shadow-sm"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
