import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Truck, Info } from 'lucide-react';

// Fix default marker icon assets for Leaflet in bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/**
 * DeliveryMap Component
 * Displays a Leaflet.js OpenStreetMap route map with hub markers and animated vehicle position.
 * 
 * NOTE: This is a calculated position estimate based on elapsed dispatch time vs ETA, 
 * not live GPS tracking (since there is no real courier GPS hardware feed integrated).
 */
export const DeliveryMap = ({
  sourceName = "Central Admin Main Hub (Delhi)",
  sourceCoords = [28.6139, 77.2090],
  destName = "Destination Regional Hub",
  destCoords = [19.0760, 72.8777],
  dispatchedAt = null,
  estimatedDelivery = "2 Business Days",
  status = "PENDING",
  orderId = 1
}) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  // Default coordinate fallbacks if invalid
  const source = Array.isArray(sourceCoords) && sourceCoords.length === 2 ? sourceCoords : [28.6139, 77.2090];
  const dest = Array.isArray(destCoords) && destCoords.length === 2 ? destCoords : [19.0760, 72.8777];

  // Calculate 0 to 1 route progress fraction based on elapsed time vs ETA
  let progress = 0;
  if (status === 'FULFILLED') {
    progress = 1.0;
  } else if (status === 'IN_TRANSIT') {
    const startMs = dispatchedAt ? new Date(dispatchedAt).getTime() : (Date.now() - 3600000);
    const totalMs = 3 * 3600 * 1000; // Simulated 3-hour transit duration window
    const elapsed = Date.now() - startMs;
    progress = Math.min(1.0, Math.max(0.1, elapsed / totalMs));
  } else {
    progress = 0.0; // PENDING or APPROVED sits at source hub
  }

  // Linear interpolation for vehicle lat/lng coordinates along route
  const currentLat = source[0] + (dest[0] - source[0]) * progress;
  const currentLng = source[1] + (dest[1] - source[1]) * progress;
  const currentCoords = [currentLat, currentLng];

  useEffect(() => {
    if (!mapRef.current) return;

    // Clean up existing map instance on re-render or order change
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Initialize Leaflet Map instance
    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false
    });
    mapInstanceRef.current = map;

    // Add CartoDB Light Tile Layer (Free, clean light styling, no API key needed)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 18,
      subdomains: 'abcd',
    }).addTo(map);

    // Zoom controls in top right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Plot Source Circle Marker (Purple)
    const sourceMarker = L.circleMarker(source, {
      color: '#6700ce',
      fillColor: '#6700ce',
      fillOpacity: 0.95,
      radius: 9,
      weight: 3
    }).addTo(map);

    sourceMarker.bindTooltip(
      `<div style="font-weight: 800; font-size: 11px; color: #1c023d; padding: 2px 4px;">🏢 ${sourceName}</div>`,
      { permanent: true, direction: 'top', className: 'custom-map-tooltip' }
    );

    // Plot Destination Circle Marker (Pink)
    const destMarker = L.circleMarker(dest, {
      color: '#e20d65',
      fillColor: '#e20d65',
      fillOpacity: 0.95,
      radius: 9,
      weight: 3
    }).addTo(map);

    destMarker.bindTooltip(
      `<div style="font-weight: 800; font-size: 11px; color: #1c023d; padding: 2px 4px;">📍 ${destName}</div>`,
      { permanent: true, direction: 'bottom', className: 'custom-map-tooltip' }
    );

    // Draw Dashed Polyline Route between Source & Destination
    L.polyline([source, dest], {
      color: '#e20d65',
      weight: 3.5,
      dashArray: '8, 8',
      opacity: 0.85
    }).addTo(map);

    // Custom Animated Truck/Package Marker Icon
    const truckHtml = `
      <div style="
        background: #1c023d;
        color: #ffffff;
        border: 2px solid #e20d65;
        border-radius: 50%;
        width: 38px;
        height: 38px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 15px rgba(226, 13, 101, 0.4);
        transform: translate(-50%, -50%);
        font-size: 18px;
      ">
        🚚
      </div>
    `;

    const truckIcon = L.divIcon({
      html: truckHtml,
      className: 'truck-div-icon',
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });

    const truckMarker = L.marker(currentCoords, { icon: truckIcon }).addTo(map);
    truckMarker.bindTooltip(
      `<div style="font-weight: 900; font-size: 11px; color: #1c023d;">Estimated Progress: ${Math.round(progress * 100)}%</div>`,
      { permanent: false, direction: 'top' }
    );

    // Fit map bounds to show both source and destination markers
    const bounds = L.latLngBounds([source, dest]);
    map.fitBounds(bounds, { padding: [45, 45] });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [sourceName, sourceCoords, destName, destCoords, status, progress]);

  return (
    <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-sm space-y-3 font-sans w-full">
      
      {/* Map Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-base font-black text-[#1c023d] flex items-center gap-2">
            <Navigation className="w-5 h-5 text-[#e20d65]" />
            <span>Interactive Shipment Route Map</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Leaflet OpenStreetMap visual tracking from source warehouse to regional hub destination.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-extrabold px-3 py-1 rounded bg-purple-50 text-[#6700ce] border border-purple-200 font-mono">
            Estimated Route Progress ({Math.round(progress * 100)}%)
          </span>
        </div>
      </div>

      {/* Leaflet Map Canvas */}
      <div className="relative w-full h-[320px] rounded-lg overflow-hidden border border-slate-200 shadow-inner">
        <div ref={mapRef} className="w-full h-full z-10" />

        {/* Map Legend Overlay */}
        <div className="absolute bottom-3 left-3 z-[400] bg-white/95 backdrop-blur-sm p-3 rounded-lg border border-slate-200 shadow-md text-xs space-y-1.5 font-semibold text-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#6700ce]" />
            <span>Origin: <strong className="text-[#1c023d]">{sourceName}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#e20d65]" />
            <span>Destination: <strong className="text-[#1c023d]">{destName}</strong></span>
          </div>
        </div>
      </div>

      {/* Mandatory Transparent Disclaimer Notice */}
      <div className="p-3 rounded-lg bg-amber-50/80 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center gap-2">
        <Info className="w-4 h-4 text-amber-600 shrink-0" />
        <span>
          <strong>Estimated Route Progress</strong>: Position marker location is calculated from elapsed transit time vs ETA schedule (OpenStreetMap view), not live hardware GPS.
        </span>
      </div>

    </div>
  );
};
