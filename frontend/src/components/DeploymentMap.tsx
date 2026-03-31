import { useEffect, useCallback, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Polyline, CircleMarker, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png', iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png' });

const makeIcon = (color: string) => new L.Icon({ iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`, shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });
const greenIcon = makeIcon('green');
const redIcon = makeIcon('red');

interface RouteEdge { from: { lat: number; lon: number }; to: { lat: number; lon: number }; length_m: number; road_type?: string; }
interface AreaAnalysis { area_sq_km: number; detected_buildings: number; building_source: string; }
interface OverlayPolygon { points: [number, number][]; color: string; label?: string; }
interface MarkerInfo { lat: number; lon: number; label: string; }
interface RouteOverlay { edges: RouteEdge[]; color: string; label: string; opacity: number; weight: number; }

interface DeploymentMapProps {
  center?: [number, number]; zoom?: number;
  polygon: [number, number][]; onPolygonChange: (pts: [number, number][]) => void;
  drawMode: boolean;
  routeEdges?: RouteEdge[]; sourceNode?: { lat: number; lon: number } | null;
  areaAnalysis?: AreaAnalysis | null; fitToPolygon?: boolean;
  overlays?: OverlayPolygon[];
  originMarker?: MarkerInfo | null; destMarker?: MarkerInfo | null;
  routeOverlays?: RouteOverlay[];
  pointClickMode?: 'origin' | 'dest' | null;
  onPointClick?: (lat: number, lon: number) => void;
  /** Callback when locate-me finds position */
  onLocate?: (lat: number, lon: number) => void;
}

function ClickHandler({ mode, onClick }: { mode: 'origin' | 'dest' | null; onClick?: (lat: number, lon: number) => void }) {
  useMapEvents({ click(e) { if (mode && onClick) onClick(e.latlng.lat, e.latlng.lng); } });
  return null;
}

function DrawHandler({ drawMode, onPointAdd }: { drawMode: boolean; onPointAdd: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { if (drawMode) onPointAdd(e.latlng.lat, e.latlng.lng); } });
  return null;
}

function FitAll({ polygon, fitToPolygon, overlays, routeOverlays, routeEdges, originMarker, destMarker }: any) {
  const map = useMap();
  useEffect(() => {
    const lats: number[] = []; const lons: number[] = [];
    if (fitToPolygon && polygon?.length >= 3) polygon.forEach((p: number[]) => { lats.push(p[0]); lons.push(p[1]); });
    overlays?.forEach((o: OverlayPolygon) => o.points.forEach((p: number[]) => { lats.push(p[0]); lons.push(p[1]); }));
    routeOverlays?.forEach((r: RouteOverlay) => r.edges.forEach((e: RouteEdge) => { lats.push(e.from.lat, e.to.lat); lons.push(e.from.lon, e.to.lon); }));
    if (originMarker) { lats.push(originMarker.lat); lons.push(originMarker.lon); }
    if (destMarker) { lats.push(destMarker.lat); lons.push(destMarker.lon); }
    if (lats.length === 0 && routeEdges?.length > 0) routeEdges.forEach((e: RouteEdge) => { lats.push(e.from.lat, e.to.lat); lons.push(e.from.lon, e.to.lon); });
    if (lats.length > 0) map.fitBounds([[Math.min(...lats) - 0.005, Math.min(...lons) - 0.005], [Math.max(...lats) + 0.005, Math.max(...lons) + 0.005]], { padding: [40, 40] });
  }, [polygon, fitToPolygon, overlays, routeOverlays, routeEdges, originMarker, destMarker, map]);
  return null;
}

/** Component to fly map to GPS location */
function LocateControl({ trigger, onLocated }: { trigger: number; onLocated: (lat: number, lon: number) => void }) {
  const map = useMap();
  useEffect(() => {
    if (trigger === 0) return;
    map.locate({ setView: true, maxZoom: 15 });
    map.once('locationfound', (e) => {
      onLocated(e.latlng.lat, e.latlng.lng);
    });
  }, [trigger, map, onLocated]);
  return null;
}

const ROUTE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function DeploymentMap({ center = [11.341, 77.717], zoom = 14, polygon, onPolygonChange, drawMode, routeEdges = [], sourceNode = null, areaAnalysis = null, fitToPolygon = false, overlays = [], originMarker = null, destMarker = null, routeOverlays = [], pointClickMode = null, onPointClick, onLocate }: DeploymentMapProps) {
  const handlePointAdd = useCallback((lat: number, lng: number) => { onPolygonChange([...polygon, [lat, lng]]); }, [polygon, onPolygonChange]);
  const [locateTrigger, setLocateTrigger] = useState(0);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);

  const handleLocate = () => {
    setLocating(true);
    setLocateTrigger(prev => prev + 1);
  };

  const handleLocated = useCallback((lat: number, lon: number) => {
    setUserLocation([lat, lon]);
    setLocating(false);
    if (onLocate) onLocate(lat, lon);
  }, [onLocate]);

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden">
      <MapContainer center={center} zoom={zoom} className="w-full h-full" style={{ minHeight: '400px', background: '#0f172a' }}>
        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="Esri" />
        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}" attribution="" opacity={0.5} />

        {!pointClickMode && <DrawHandler drawMode={drawMode} onPointAdd={handlePointAdd} />}
        {pointClickMode && <ClickHandler mode={pointClickMode} onClick={onPointClick} />}
        <FitAll polygon={polygon} fitToPolygon={fitToPolygon} overlays={overlays} routeOverlays={routeOverlays} routeEdges={routeEdges} originMarker={originMarker} destMarker={destMarker} />
        <LocateControl trigger={locateTrigger} onLocated={handleLocated} />

        {overlays.map((o, i) => o.points.length >= 3 && <Polygon key={`ov-${i}`} positions={o.points} pathOptions={{ color: o.color, fillColor: o.color, fillOpacity: 0.1, weight: 2.5, dashArray: '6,4' }} />)}
        {polygon.length >= 3 && <Polygon positions={polygon} pathOptions={{ color: '#06b6d4', fillColor: '#06b6d4', fillOpacity: 0.08, weight: 2, dashArray: '8,4' }} />}
        {drawMode && polygon.map(([lat, lng], i) => <CircleMarker key={`pt-${i}`} center={[lat, lng]} radius={5} pathOptions={{ color: '#fff', fillColor: '#06b6d4', fillOpacity: 1, weight: 2 }} />)}

        {routeOverlays.map((route, ri) => route.edges.map((e, ei) => (
          <Polyline key={`ro-${ri}-${ei}`} positions={[[e.from.lat, e.from.lon], [e.to.lat, e.to.lon]]}
            pathOptions={{ color: route.color || ROUTE_COLORS[ri % 5], weight: route.weight || 3, opacity: route.opacity || 0.8 }} />
        )))}

        {routeEdges.map((e, i) => <Polyline key={`re-${i}`} positions={[[e.from.lat, e.from.lon], [e.to.lat, e.to.lon]]} pathOptions={{ color: '#10b981', weight: 2.5, opacity: 0.8 }} />)}

        {originMarker && <Marker position={[originMarker.lat, originMarker.lon]} icon={greenIcon}><Popup><div style={{ color: '#000', fontSize: '13px' }}><strong>{originMarker.label}</strong><br />Origin</div></Popup></Marker>}
        {destMarker && <Marker position={[destMarker.lat, destMarker.lon]} icon={redIcon}><Popup><div style={{ color: '#000', fontSize: '13px' }}><strong>{destMarker.label}</strong><br />Destination</div></Popup></Marker>}
        {sourceNode && <Marker position={[sourceNode.lat, sourceNode.lon]} icon={redIcon}><Popup><div style={{ color: '#000', fontSize: '13px' }}><strong>Central Office</strong></div></Popup></Marker>}

        {/* User location marker */}
        {userLocation && (
          <CircleMarker center={userLocation} radius={8}
            pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.8, weight: 3 }}>
            <Popup><div style={{ color: '#000', fontSize: '13px' }}><strong>Your Location</strong><br />{userLocation[0].toFixed(5)}, {userLocation[1].toFixed(5)}</div></Popup>
          </CircleMarker>
        )}
        {userLocation && (
          <CircleMarker center={userLocation} radius={30}
            pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.1, weight: 1 }} />
        )}
      </MapContainer>

      {/* Locate me button */}
      <button onClick={handleLocate}
        className="absolute top-3 right-3 w-10 h-10 bg-slate-900/90 backdrop-blur-sm border border-slate-700 rounded-lg flex items-center justify-center z-[1000] hover:bg-slate-800 transition-all group"
        title="Go to my location">
        {locating ? (
          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className="w-5 h-5 text-blue-400 group-hover:text-blue-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        )}
      </button>

      {drawMode && <div className="absolute top-3 left-3 bg-cyan-500/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-sm font-medium z-[1000] pointer-events-none">Click to place points</div>}
      {pointClickMode && <div className={`absolute top-3 left-3 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-sm font-medium z-[1000] pointer-events-none ${pointClickMode === 'origin' ? 'bg-emerald-500/90' : 'bg-red-500/90'}`}>Click map to place {pointClickMode === 'origin' ? 'ORIGIN' : 'DESTINATION'}</div>}
      {areaAnalysis && <div className="absolute bottom-3 left-3 bg-slate-900/95 backdrop-blur-sm border border-emerald-500/30 rounded-lg px-3 py-2 z-[1000]"><p className="text-xs text-emerald-400 font-medium">Area Detected</p><div className="flex items-center space-x-3 mt-1 text-xs text-slate-300"><span>{areaAnalysis.area_sq_km.toFixed(3)} km²</span><span>•</span><span>{areaAnalysis.detected_buildings.toLocaleString('en-IN')} buildings</span></div></div>}
      {userLocation && <div className="absolute bottom-3 right-3 bg-slate-900/95 backdrop-blur-sm border border-blue-500/30 rounded-lg px-3 py-1.5 z-[1000]"><p className="text-xs text-blue-400">{userLocation[0].toFixed(4)}, {userLocation[1].toFixed(4)}</p></div>}
    </div>
  );
}

export { ROUTE_COLORS };
