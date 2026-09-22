
import React from 'react';
import { Users, Building2, MapPin, Mail, Phone, ShieldCheck, CheckCircle2, Package, Activity } from 'lucide-react';

export const RegionalManagersSection = ({ locations = [] }) => {
  const managersData = [
    {
      location_id: 1,
      hub_name: "Delhi Regional Hub",
      city: "Delhi",
      manager_name: "Rahul Sharma",
      email: "delhi@tataplay.com",
      phone: "+91 98765 43210",
      capacity: 85,
      total_stock: 185,
      open_alerts: 1,
      status: "Active",
      role: "Location Manager"
    },
    {
      location_id: 2,
      hub_name: "Mumbai Main Hub",
      city: "Mumbai",
      manager_name: "Rajesh Patel",
      email: "mumbai@tataplay.com",
      phone: "+91 98123 45678",
      capacity: 72,
      total_stock: 210,
      open_alerts: 0,
      status: "Active",
      role: "Location Manager"
    },
    {
      location_id: 3,
      hub_name: "Bangalore Tech Park Hub",
      city: "Bangalore",
      manager_name: "Ananya Rao",
      email: "bangalore@tataplay.com",
      phone: "+91 97654 32109",
      capacity: 64,
      total_stock: 195,
      open_alerts: 1,
      status: "Active",
      role: "Location Manager"
    }
  ];

  return (
    <div className="space-y-6 pb-12 font-sans w-full">
      
      {/* Header Banner */}
      <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="bg-purple-50 p-3.5 rounded text-[#6700ce] border border-purple-100">
            <Users className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-2xl font-black text-[#1c023d] tracking-tight">Regional Hub Managers Directory</h1>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-purple-50 text-[#6700ce] border border-purple-200">
                3 Assigned Managers
              </span>
            </div>
            <p className="text-xs text-slate-500">Central Admin oversight of all hub location managers, contact info, and capacity status.</p>
          </div>
        </div>
      </div>

      {/* Grid of Manager Cards (Matching Dreams ERP Warehouse Card Style) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
        {managersData.map((m) => (
          <div key={m.location_id} className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm space-y-4 hover:border-[#e20d65]/40 transition">
            
            {/* Manager Header & Avatar */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-lg bg-[#1c023d] text-white flex items-center justify-center font-black text-base shadow-sm">
                  {m.manager_name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <h3 className="font-extrabold text-[#1c023d] text-sm">{m.manager_name}</h3>
                  <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#e20d65]" />
                    {m.role}
                  </span>
                </div>
              </div>

              <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                {m.status}
              </span>
            </div>

            {/* Hub Details */}
            <div className="space-y-2 text-xs text-slate-700 font-medium">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#6700ce]" />
                <span className="font-bold text-[#1c023d]">{m.hub_name}</span>
              </div>

              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#e20d65]" />
                <span>{m.city}, India</span>
              </div>

              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400" />
                <span className="font-mono text-slate-600">{m.email}</span>
              </div>

              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400" />
                <span className="font-mono text-slate-600">{m.phone}</span>
              </div>
            </div>

            {/* Hub Capacity & Stock Metrics (Dreams ERP style gauge) */}
            <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-600 flex items-center gap-1">
                  <Package className="w-3.5 h-3.5 text-[#00b4d8]" />
                  Hub Stock Quantity:
                </span>
                <span className="font-mono font-black text-[#1c023d] text-sm">{m.total_stock} units</span>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="font-bold text-slate-600">Hub Storage Capacity:</span>
                <span className="font-mono font-bold text-[#6700ce]">{m.capacity}% Filled</span>
              </div>

              <div className="w-full bg-slate-200 h-2 rounded overflow-hidden">
                <div 
                  className={`h-full rounded ${m.capacity > 80 ? 'bg-[#e20d65]' : 'bg-[#6700ce]'}`} 
                  style={{ width: `${m.capacity}%` }}
                />
              </div>
            </div>

          </div>
        ))}
      </div>

      {/* Managers Summary Table */}
      <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm space-y-4 w-full">
        <h2 className="text-base font-extrabold text-[#1c023d] uppercase tracking-wider">
          Regional Hub Managers Control Table
        </h2>

        <div className="overflow-x-auto border border-slate-200 rounded">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600 font-bold uppercase bg-slate-50">
                <th className="py-3 px-4">Manager Name</th>
                <th className="py-3 px-4">Assigned Location Hub</th>
                <th className="py-3 px-4">Contact Email</th>
                <th className="py-3 px-4 text-center">Hub Stock</th>
                <th className="py-3 px-4 text-center">Hub Capacity</th>
                <th className="py-3 px-4 text-center">Active Alerts</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {managersData.map((m) => (
                <tr key={m.location_id} className="hover:bg-slate-50 transition">
                  <td className="py-3.5 px-4 font-bold text-[#1c023d] flex items-center gap-2">
                    <div className="w-7 h-7 rounded bg-[#1c023d] text-white flex items-center justify-center font-bold text-xs">
                      {m.manager_name[0]}
                    </div>
                    <span>{m.manager_name}</span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-800">{m.hub_name}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-600">{m.email}</td>
                  <td className="py-3.5 px-4 text-center font-mono font-black text-[#1c023d] text-base">{m.total_stock}</td>
                  <td className="py-3.5 px-4 text-center font-mono font-bold text-[#6700ce]">{m.capacity}%</td>
                  <td className="py-3.5 px-4 text-center font-mono font-bold text-rose-600">{m.open_alerts}</td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {m.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
