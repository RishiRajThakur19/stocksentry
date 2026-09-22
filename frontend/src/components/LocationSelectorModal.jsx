import React, { useState } from 'react';
import { Search, X, MapPin } from 'lucide-react';

export const LocationSelectorModal = ({ isOpen, onClose, selectedLocationId, onSelectLocation, locations }) => {
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  // City landmark SVGs matching Tata Play Fiber site
  const cityLandmarks = {
    'mumbai': (
      <svg className="w-16 h-16 mx-auto stroke-[1.5] text-slate-800" viewBox="0 0 64 64" fill="none" stroke="currentColor">
        <path d="M12 52H52M16 52V36L24 30V52M48 52V36L40 30V52M24 52V24H40V52M28 20C28 17.7909 29.7909 16 32 16C34.2091 16 36 17.7909 36 20V24H28V20ZM28 36H36V52H28V36Z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    'delhi': (
      <svg className="w-16 h-16 mx-auto stroke-[1.5] text-slate-800" viewBox="0 0 64 64" fill="none" stroke="currentColor">
        <path d="M12 52H52M18 52V24L32 16L46 24V52M24 52V32H40V52M28 38H36V52H28V38Z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    'bangalore': (
      <svg className="w-16 h-16 mx-auto stroke-[1.5] text-slate-800" viewBox="0 0 64 64" fill="none" stroke="currentColor">
        <path d="M10 52H54M14 52V28H50V52M22 28V18H42V28M28 18V12H36V18M26 36H38V52H26V36Z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    'default': (
      <svg className="w-16 h-16 mx-auto stroke-[1.5] text-slate-800" viewBox="0 0 64 64" fill="none" stroke="currentColor">
        <path d="M16 52H48M20 52V24H44V52M26 24V16H38V24M28 34H36V52H28V34Z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  };

  const getLandmarkIcon = (name) => {
    const lower = name.toLowerCase();
    if (lower.includes('mumbai')) return cityLandmarks['mumbai'];
    if (lower.includes('delhi')) return cityLandmarks['delhi'];
    if (lower.includes('bangalore') || lower.includes('bengaluru')) return cityLandmarks['bangalore'];
    return cityLandmarks['default'];
  };

  const filteredLocations = locations.filter(loc =>
    loc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    loc.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 font-sans animate-in fade-in">
      <div className="bg-[#f8f7fc] rounded-3xl max-w-xl w-full p-8 border border-[#e8e2f7] shadow-2xl relative">
        
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-400 hover:text-slate-700 transition"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-black text-[#120836] tracking-tight">
            Where do you need Tata Play Fiber?
          </h2>
          <p className="text-xs text-slate-500 mt-1">Select your regional hub to manage location inventory</p>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search for Delhi NCR, Mumbai Region, Bengaluru..."
            className="w-full bg-white border border-slate-300 rounded-2xl pl-4 pr-10 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#e20d65] focus:ring-1 focus:ring-[#e20d65] shadow-sm transition"
          />
          <Search className="w-5 h-5 text-slate-400 absolute right-3.5 top-3.5" />
        </div>

        {/* City Hub Cards Grid (Exact Tata Play Fiber website style) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {filteredLocations.map((loc) => {
            const isSelected = selectedLocationId === loc.location_id;
            return (
              <button
                key={loc.location_id}
                onClick={() => {
                  onSelectLocation(loc.location_id);
                  onClose();
                }}
                className={`p-4 rounded-2xl text-center transition relative flex flex-col items-center justify-between h-40 border ${
                  isSelected
                    ? 'bg-[#f0ebfa] border-[#e20d65] shadow-md'
                    : 'bg-[#f0ebfa]/60 border-transparent hover:bg-[#f0ebfa] hover:border-slate-300'
                }`}
              >
                <div className="py-2">
                  {getLandmarkIcon(loc.city)}
                </div>

                <div className="w-full">
                  <div className={`text-sm font-extrabold ${isSelected ? 'text-[#e20d65]' : 'text-slate-900'}`}>
                    {loc.city === 'Mumbai' ? 'Mumbai Region' : loc.city === 'Delhi' ? 'Delhi NCR' : loc.city}
                  </div>
                  {isSelected && (
                    <div className="w-12 h-1 bg-[#e20d65] rounded-full mx-auto mt-1.5" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-6 text-center text-xs text-slate-500 font-medium">
          Central Admin has full visibility across all regional hubs.
        </div>

      </div>
    </div>
  );
};
