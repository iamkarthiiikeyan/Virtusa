import { useState, useEffect } from 'react';
import DashboardCard from '../components/DashboardCard';
import DeploymentMap from '../components/DeploymentMap';
import { Cable, Search, Loader2, MapPin, Layers, CheckCircle, AlertTriangle, Zap } from 'lucide-react';
import { usePlanningStore } from '../stores/planningStore';
import { useNavigate } from 'react-router-dom';
import { formatINR } from '../utils/formatINR';

const API_OVERPASS = 'https://overpass-api.de/api/interpreter';

interface InfraItem {
  id: number; type: string; name: string;
  lat: number; lon: number; tags: Record<string, string>;
}

interface InfraLine {
  type: string; nodes: [number, number][]; tags: Record<string, string>;
}

async function fetchExistingInfra(lat: number, lon: number, radiusM: number = 3000): Promise<{ points: InfraItem[]; lines: InfraLine[] }> {
  // Overpass QL query for telecom and utility infrastructure
  const query = `
    [out:json][timeout:25];
    (
      node["telecom"](around:${radiusM},${lat},${lon});
      way["telecom"](around:${radiusM},${lat},${lon});
      node["man_made"="street_cabinet"]["utility"="telecom"](around:${radiusM},${lat},${lon});
      node["utility"="telecom"](around:${radiusM},${lat},${lon});
      way["utility"="underground"]["location"="underground"](around:${radiusM},${lat},${lon});
      node["communication"](around:${radiusM},${lat},${lon});
      way["communication"](around:${radiusM},${lat},${lon});
      node["man_made"="tower"]["tower:type"="communication"](around:${radiusM},${lat},${lon});
      node["man_made"="mast"](around:${radiusM},${lat},${lon});
      way["power"="line"](around:${radiusM},${lat},${lon});
      node["power"="pole"](around:${radiusM},${lat},${lon});
    );
    out body geom;
  `;

  try {
    const res = await fetch(API_OVERPASS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });
    const data = await res.json();

    const points: InfraItem[] = [];
    const lines: InfraLine[] = [];

    for (const el of data.elements || []) {
      if (el.type === 'node' && el.lat && el.lon) {
        const infraType = el.tags?.telecom || el.tags?.man_made || el.tags?.communication || el.tags?.power || el.tags?.utility || 'infrastructure';
        points.push({
          id: el.id, type: infraType,
          name: el.tags?.name || el.tags?.operator || infraType,
          lat: el.lat, lon: el.lon, tags: el.tags || {},
        });
      } else if (el.type === 'way' && el.geometry) {
        const infraType = el.tags?.telecom || el.tags?.utility || el.tags?.communication || el.tags?.power || 'line';
        lines.push({
          type: infraType,
          nodes: el.geometry.map((g: any) => [g.lat, g.lon] as [number, number]),
          tags: el.tags || {},
        });
      }
    }

    return { points, lines };
  } catch (e) {
    console.error('Overpass API failed:', e);
    return { points: [], lines: [] };
  }
}

const INFRA_COLORS: Record<string, string> = {
  'exchange': '#ef4444',
  'data_centre': '#3b82f6',
  'connection_point': '#f59e0b',
  'street_cabinet': '#8b5cf6',
  'tower': '#ec4899',
  'mast': '#ec4899',
  'communication': '#06b6d4',
  'pole': '#64748b',
  'line': '#f59e0b',
  'underground': '#10b981',
  'telecom': '#06b6d4',
  'power': '#f59e0b',
};

export default function Infrastructure() {
  const { currentResult: r } = usePlanningStore();
  const navigate = useNavigate();
  const [infraPoints, setInfraPoints] = useState<InfraItem[]>([]);
  const [infraLines, setInfraLines] = useState<InfraLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchLat, setSearchLat] = useState('');
  const [searchLon, setSearchLon] = useState('');
  const [searchRadius, setSearchRadius] = useState(3000);
  const [searchName, setSearchName] = useState('');

  // Auto-detect from current analysis
  useEffect(() => {
    if (r?.route?.source_node) {
      setSearchLat(r.route.source_node.lat.toFixed(5));
      setSearchLon(r.route.source_node.lon.toFixed(5));
    }
  }, [r]);

  const handleSearch = async () => {
    let lat = parseFloat(searchLat);
    let lon = parseFloat(searchLon);

    // If name given, geocode it
    if (searchName.trim() && (!lat || !lon)) {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchName)}&format=json&limit=1`, { headers: { 'User-Agent': 'ATLAS/1.0' } });
        const data = await res.json();
        if (data.length) {
          lat = parseFloat(data[0].lat);
          lon = parseFloat(data[0].lon);
          setSearchLat(lat.toFixed(5));
          setSearchLon(lon.toFixed(5));
        }
      } catch {}
    }

    if (!lat || !lon) return;
    setLoading(true);
    const result = await fetchExistingInfra(lat, lon, searchRadius);
    setInfraPoints(result.points);
    setInfraLines(result.lines);
    setSearched(true);
    setLoading(false);
  };

  // Build overlays for map
  const routeOverlays = infraLines.map((line, i) => ({
    edges: line.nodes.slice(0, -1).map((n, j) => ({
      from: { lat: n[0], lon: n[1] },
      to: { lat: line.nodes[j + 1][0], lon: line.nodes[j + 1][1] },
      length_m: 0,
    })),
    color: INFRA_COLORS[line.type] || '#f59e0b',
    label: line.type,
    opacity: 0.7,
    weight: 3,
  }));

  // Also show the analysis route if available
  if (r?.route?.route_edges) {
    routeOverlays.push({
      edges: r.route.route_edges,
      color: '#10b981',
      label: 'Planned fiber route',
      opacity: 0.8,
      weight: 3,
    });
  }

  const originMarker = searchLat && searchLon ? { lat: parseFloat(searchLat), lon: parseFloat(searchLon), label: searchName || 'Search center' } : null;

  // Categorize infrastructure
  const categories = infraPoints.reduce((acc, p) => {
    const cat = p.type; acc[cat] = (acc[cat] || 0) + 1; return acc;
  }, {} as Record<string, number>);

  // Calculate potential savings
  const overlappingKm = infraLines.reduce((s, l) => {
    let len = 0;
    for (let i = 0; i < l.nodes.length - 1; i++) {
      const [lat1, lon1] = l.nodes[i];
      const [lat2, lon2] = l.nodes[i + 1];
      const dlat = (lat2 - lat1) * 111.32;
      const dlon = (lon2 - lon1) * 111.32 * Math.cos(lat1 * Math.PI / 180);
      len += Math.sqrt(dlat * dlat + dlon * dlon);
    }
    return s + len;
  }, 0);

  const potentialSaving = overlappingKm * 45000; // ₹45,000/km duct reuse saving

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Existing Infrastructure</h1>
        <p className="text-slate-400">Detect existing telecom and utility infrastructure from OpenStreetMap</p>
      </div>

      {/* Search controls */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
        <div className="flex items-end space-x-3">
          <div className="flex-1">
            <label className="block text-xs text-slate-400 mb-1">Location name</label>
            <input type="text" value={searchName} onChange={e => setSearchName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
              placeholder='e.g. "Salem, Tamil Nadu"'
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
          </div>
          <div className="w-28">
            <label className="block text-xs text-slate-400 mb-1">Latitude</label>
            <input type="text" value={searchLat} onChange={e => setSearchLat(e.target.value)} placeholder="11.664"
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none" />
          </div>
          <div className="w-28">
            <label className="block text-xs text-slate-400 mb-1">Longitude</label>
            <input type="text" value={searchLon} onChange={e => setSearchLon(e.target.value)} placeholder="78.146"
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none" />
          </div>
          <div className="w-28">
            <label className="block text-xs text-slate-400 mb-1">Radius (m)</label>
            <input type="number" value={searchRadius} onChange={e => setSearchRadius(Number(e.target.value))}
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none" />
          </div>
          <button onClick={handleSearch} disabled={loading}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center space-x-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>Detect</span>
          </button>
        </div>
      </div>

      {/* Results summary */}
      {searched && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 text-center">
            <Cable className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-white">{infraPoints.length}</p>
            <p className="text-xs text-slate-400">Infrastructure points</p>
          </div>
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 text-center">
            <Layers className="w-5 h-5 text-amber-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-white">{infraLines.length}</p>
            <p className="text-xs text-slate-400">Utility lines</p>
          </div>
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 text-center">
            <MapPin className="w-5 h-5 text-purple-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-white">{overlappingKm.toFixed(1)} km</p>
            <p className="text-xs text-slate-400">Existing routes</p>
          </div>
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 text-center">
            <Zap className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-emerald-400">{formatINR(potentialSaving)}</p>
            <p className="text-xs text-slate-400">Potential duct reuse saving</p>
          </div>
        </div>
      )}

      {/* Map */}
      <DashboardCard title={searched ? `Infrastructure Map — ${infraPoints.length} points, ${infraLines.length} lines` : 'Infrastructure Map'}>
        <div className="h-[450px] rounded-lg overflow-hidden">
          <DeploymentMap
            center={searchLat && searchLon ? [parseFloat(searchLat), parseFloat(searchLon)] : [11.0, 78.0]}
            zoom={searched ? 14 : 7}
            polygon={[]} onPolygonChange={() => {}} drawMode={false}
            routeOverlays={routeOverlays}
            originMarker={originMarker}
            fitToPolygon={searched}
          />
        </div>
        {searched && (
          <div className="mt-3 px-4 py-2 bg-slate-800/50 rounded-lg">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              {r?.route?.route_edges && <div className="flex items-center space-x-1.5"><div className="w-4 h-1.5 rounded-full bg-emerald-500" /><span className="text-slate-300">Planned route</span></div>}
              <div className="flex items-center space-x-1.5"><div className="w-4 h-1.5 rounded-full bg-amber-500" /><span className="text-slate-300">Power lines</span></div>
              <div className="flex items-center space-x-1.5"><div className="w-4 h-1.5 rounded-full bg-cyan-500" /><span className="text-slate-300">Telecom</span></div>
              <div className="flex items-center space-x-1.5"><div className="w-4 h-1.5 rounded-full bg-emerald-500" /><span className="text-slate-300">Underground utility</span></div>
              <div className="flex items-center space-x-1.5"><div className="w-3 h-3 rounded-full bg-red-500" /><span className="text-slate-300">Exchange</span></div>
            </div>
          </div>
        )}
      </DashboardCard>

      {/* Infrastructure details */}
      {searched && infraPoints.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DashboardCard title="Infrastructure by Category">
            <div className="space-y-2">
              {Object.entries(categories).sort(([, a], [, b]) => b - a).map(([cat, count]) => (
                <div key={cat} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: INFRA_COLORS[cat] || '#64748b' }} />
                    <span className="text-sm text-slate-300 capitalize">{cat.replace(/_/g, ' ')}</span>
                  </div>
                  <span className="text-sm font-semibold text-white">{count}</span>
                </div>
              ))}
            </div>
          </DashboardCard>

          <DashboardCard title="Nearby Infrastructure Points">
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {infraPoints.slice(0, 20).map((p, i) => (
                <div key={p.id} className="p-3 bg-slate-800/30 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-white">{p.name}</span>
                    <span className="text-xs text-slate-500 capitalize">{p.type.replace(/_/g, ' ')}</span>
                  </div>
                  <p className="text-xs text-slate-500">{p.lat.toFixed(5)}, {p.lon.toFixed(5)}</p>
                  {p.tags.operator && <p className="text-xs text-slate-400">Operator: {p.tags.operator}</p>}
                </div>
              ))}
              {infraPoints.length > 20 && <p className="text-xs text-slate-500 text-center py-2">+{infraPoints.length - 20} more points</p>}
            </div>
          </DashboardCard>
        </div>
      )}

      {/* Savings recommendation */}
      {searched && overlappingKm > 0 && (
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5">
          <div className="flex items-start space-x-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-emerald-400 mb-1">Infrastructure Reuse Opportunity</h3>
              <p className="text-sm text-slate-300">{overlappingKm.toFixed(1)} km of existing utility routes detected. If existing ducts can be reused, estimated saving of {formatINR(potentialSaving)} on civil work (duct installation at ₹45,000/km). Recommend site survey to verify duct availability and condition.</p>
            </div>
          </div>
        </div>
      )}

      {searched && infraPoints.length === 0 && infraLines.length === 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-amber-400 mb-1">No Infrastructure Detected</h3>
              <p className="text-sm text-slate-300">No existing telecom or utility infrastructure found in this area on OpenStreetMap. This could mean: greenfield deployment required, or infrastructure exists but isn't mapped in OSM. Recommend physical survey.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
