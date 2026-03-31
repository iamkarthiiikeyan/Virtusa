import { useState, useEffect, useCallback } from 'react';
import DashboardCard from '../components/DashboardCard';
import DeploymentMap, { ROUTE_COLORS } from '../components/DeploymentMap';
import {
  Zap, MapPin, Calendar, Target, AlertTriangle, CheckCircle, Loader2,
  TrendingUp, Pencil, Trash2, IndianRupee, Search, Navigation,
  MousePointer, Star, RotateCcw,
} from 'lucide-react';
import { usePlanningStore } from '../stores/planningStore';
import { formatINR } from '../utils/formatINR';
import type { PlanningRequest } from '../services/api';

type InputMode = 'draw' | 'search' | 'p2p';

function calcAreaKm2(polygon: [number, number][]): number {
  if (polygon.length < 3) return 0;
  const cLat = polygon.reduce((s, p) => s + p[0], 0) / polygon.length;
  const cLon = polygon.reduce((s, p) => s + p[1], 0) / polygon.length;
  const lonKm = 111.32 * Math.cos((cLat * Math.PI) / 180);
  const km = polygon.map(p => [(p[1] - cLon) * lonKm, (p[0] - cLat) * 111.32]);
  let a = 0;
  for (let i = 0; i < km.length; i++) { const j = (i + 1) % km.length; a += km[i][0] * km[j][1] - km[j][0] * km[i][1]; }
  return Math.abs(a) / 2;
}

async function fetchBoundary(query: string) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&polygon_geojson=1&limit=1&countrycodes=in`, { headers: { 'User-Agent': 'ATLAS/1.0' } });
    const data = await res.json();
    if (!data.length) return null;
    const p = data[0]; const g = p.geojson; let coords: [number, number][] = [];
    if (g?.type === 'Polygon') coords = g.coordinates[0].map((c: number[]) => [c[1], c[0]] as [number, number]);
    else if (g?.type === 'MultiPolygon') { let m = 0; for (const poly of g.coordinates) { if (poly[0].length > m) { m = poly[0].length; coords = poly[0].map((c: number[]) => [c[1], c[0]] as [number, number]); } } }
    else if (p.boundingbox) { const [s, n, w, e] = p.boundingbox.map(Number); coords = [[s, w], [s, e], [n, e], [n, w]]; }
    return coords.length >= 3 ? { polygon: coords, name: p.display_name?.split(',').slice(0, 2).join(', ') || query, lat: parseFloat(p.lat), lon: parseFloat(p.lon) } : null;
  } catch { return null; }
}

async function reverseGeocode(lat: number, lon: number) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=18&addressdetails=1`, { headers: { 'User-Agent': 'ATLAS/1.0' } });
    const data = await res.json();
    return data.display_name?.split(',').slice(0, 3).join(', ') || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  } catch { return `${lat.toFixed(5)}, ${lon.toFixed(5)}`; }
}

interface RouteResult {
  id: string; name: string; description: string; pros: string; cons: string;
  edges: any[]; total_length_km: number; turn_count: number; splice_points: number;
  recommended: boolean; rank: number;
  cost: { total_cost: number; cost_per_km: number; fiber_cable: number; civil_work: number; splice_closures: number; testing_survey: number; permits: number; subtotal: number; contingency: number; gst: number; };
}

/** Transform 5 route results into a full PlanningResponse so all tabs work */
function routesToPlanningResult(routes: RouteResult[], originPt: any, destPt: any, terrain: string) {
  const recommended = routes[0]; // sorted by cost, cheapest first
  const allEdges = recommended.edges;

  // Build scenarios from routes
  const scenarios = routes.map((rt, i) => ({
    id: rt.id, name: rt.name, description: rt.description,
    estimated_cost: rt.cost.total_cost,
    cost_per_premise: rt.cost.cost_per_km,
    premises_connected: 2, // point-to-point
    coverage_percent: 100,
    estimated_months: Math.max(1, Math.ceil(rt.total_length_km / 2)),
    risk_tolerance: rt.recommended ? 'low' : i < 3 ? 'medium' : 'high',
    within_budget: true,
    priority_score: 100 - i * 15,
    route_length_km: rt.total_length_km,
    topsis_score: 1 - i * 0.15,
    rank: i + 1,
  }));

  // Build BOQ from recommended route's cost breakdown
  const rc = recommended.cost;
  const boq = [
    { item_name: 'Single-mode Fiber Cable 24-core', quantity: Math.ceil(recommended.total_length_km), unit: 'km', unit_price_inr: Math.round(rc.fiber_cable / Math.max(recommended.total_length_km, 0.1)), total_inr: rc.fiber_cable, category: 'fiber_cable', note: 'G.652D ITU-T compliant', model: 'Sterlite 24F' },
    { item_name: 'Drop Cable', quantity: 2, unit: 'nos', unit_price_inr: 450, total_inr: 900, category: 'fiber_cable', note: 'Origin + destination', model: '' },
    { item_name: 'HDPE Duct 40mm', quantity: Math.ceil(recommended.total_length_km), unit: 'km', unit_price_inr: Math.round(rc.civil_work * 0.3 / Math.max(recommended.total_length_km, 0.1)), total_inr: Math.round(rc.civil_work * 0.3), category: 'civil_infrastructure', note: '', model: '' },
    { item_name: 'Trenching & Civil Work', quantity: Math.ceil(recommended.total_length_km), unit: 'km', unit_price_inr: Math.round(rc.civil_work * 0.7 / Math.max(recommended.total_length_km, 0.1)), total_inr: Math.round(rc.civil_work * 0.7), category: 'labor', note: terrain + ' terrain', model: '' },
    { item_name: 'Splice Closures', quantity: recommended.splice_points, unit: 'nos', unit_price_inr: Math.round(rc.splice_closures / Math.max(recommended.splice_points, 1)), total_inr: rc.splice_closures, category: 'passive_equipment', note: '', model: '' },
    { item_name: 'OTDR Testing', quantity: Math.ceil(recommended.total_length_km), unit: 'km', unit_price_inr: Math.round(rc.testing_survey * 0.6 / Math.max(recommended.total_length_km, 0.1)), total_inr: Math.round(rc.testing_survey * 0.6), category: 'labor', note: '', model: '' },
    { item_name: 'Survey & Design', quantity: Math.ceil(recommended.total_length_km), unit: 'km', unit_price_inr: Math.round(rc.testing_survey * 0.4 / Math.max(recommended.total_length_km, 0.1)), total_inr: Math.round(rc.testing_survey * 0.4), category: 'labor', note: '', model: '' },
    { item_name: 'Road Cutting Permit', quantity: Math.ceil(recommended.total_length_km), unit: 'km', unit_price_inr: Math.round(rc.permits / Math.max(recommended.total_length_km, 0.1)), total_inr: rc.permits, category: 'permits_regulatory', note: '', model: '' },
  ];

  // Risk assessment based on route characteristics
  const riskScore = Math.min(0.8, 0.2 + recommended.turn_count * 0.02 + recommended.total_length_km * 0.01);
  const risks = [
    { risk_type: 'construction', score: Math.min(0.9, 0.3 + recommended.total_length_km * 0.02), severity: recommended.total_length_km > 5 ? 'high' : 'medium' as any, description: `${recommended.total_length_km.toFixed(1)} km route through ${terrain} terrain`, mitigation: 'Phase construction, use trenchless tech where possible' },
    { risk_type: 'regulatory', score: 0.3, severity: 'low' as any, description: 'Road cutting permits required', mitigation: 'Pre-apply permits, coordinate with local authorities' },
    { risk_type: 'supply_chain', score: 0.25, severity: 'low' as any, description: 'Standard fiber and duct materials', mitigation: 'Pre-order materials, maintain buffer stock' },
    { risk_type: 'environmental', score: terrain === 'mountainous' ? 0.7 : terrain === 'rural' ? 0.4 : 0.2, severity: terrain === 'mountainous' ? 'high' : 'low' as any, description: `${terrain} terrain conditions`, mitigation: 'Weather-adjusted schedule, seasonal planning' },
    { risk_type: 'financial', score: 0.2, severity: 'low' as any, description: 'Cost estimates within standard variance', mitigation: '12% contingency included' },
    { risk_type: 'operational', score: Math.min(0.6, recommended.turn_count * 0.03), severity: recommended.turn_count > 15 ? 'medium' : 'low' as any, description: `${recommended.turn_count} turns = ${recommended.splice_points} splice points`, mitigation: 'Experienced splicing crew, OTDR testing at each point' },
  ];

  return {
    status: 'completed',
    pipeline_duration_seconds: 0,
    route: {
      route_length_km: recommended.total_length_km,
      sampled_route_km: recommended.total_length_km,
      total_edges: recommended.edges.length,
      total_nodes: recommended.edges.length + 1,
      premises_connected: 2,
      premises_sampled: 2,
      source_node: { lat: originPt.lat, lon: originPt.lon },
      route_edges: recommended.edges,
      strategy: 'point_to_point',
      area_analysis: null,
    },
    cost: {
      currency: 'INR', total_cost: rc.total_cost, cost_per_premise: rc.total_cost / 2,
      cost_per_km: rc.cost_per_km,
      breakdown: { fiber_materials: rc.fiber_cable, active_equipment: 0, passive_equipment: rc.splice_closures, civil_infrastructure: rc.civil_work, labor: rc.testing_survey, permits: rc.permits, contingency: rc.contingency, gst: rc.gst, timeline_adjustment: 'none' },
      boq, hardware_summary: { olt_count: 0, olt_model: '', ont_count: 0, ont_model: '', splitter_1x32_count: 0, splitter_1x8_count: 0, fdb_count: 0, splice_closure_count: recommended.splice_points, l3_switch_count: 0, core_router_count: 0, cabinet_count: 0, total_hardware_items: recommended.splice_points },
      capex_subtotal: rc.subtotal, contingency_percent: 12, gst_percent: 18,
      annual_opex: Math.round(rc.total_cost * 0.05),
      terrain_type: terrain, terrain_multiplier: 1.0, timeline_multiplier: 1.0,
      deployment_method: terrain === 'rural' ? 'aerial' : 'underground',
    },
    risk: {
      overall_risk_score: riskScore,
      overall_severity: riskScore > 0.5 ? 'high' : riskScore > 0.3 ? 'medium' : 'low',
      risk_count: { high: risks.filter(r => r.severity === 'high').length, medium: risks.filter(r => r.severity === 'medium').length, low: risks.filter(r => r.severity === 'low').length },
      risks,
    },
    scenarios: { scenarios, recommended: recommended.id, total_generated: routes.length },
    decision: {
      recommended_scenario: scenarios[0],
      all_rankings: scenarios,
      decision_weights: { cost: 0.35, distance: 0.25, complexity: 0.2, risk: 0.2 },
      priority: 'cost-optimized',
      reasoning: `Recommended "${recommended.name}" as it offers the lowest total cost of ${formatINR(rc.total_cost)} over ${recommended.total_length_km.toFixed(2)} km with ${recommended.splice_points} splice points. Compared ${routes.length} alternative routes with costs ranging from ${formatINR(routes[0].cost.total_cost)} to ${formatINR(routes[routes.length - 1].cost.total_cost)}.`,
    },
    explanation: {
      summary: `Point-to-point analysis found ${routes.length} routes between origin and destination. The ${recommended.name} route at ${recommended.total_length_km.toFixed(2)} km is recommended with total CAPEX of ${formatINR(rc.total_cost)}.`,
      sections: [
        { title: 'Route Analysis', content: `${routes.length} distinct routes were computed using different optimization criteria: shortest distance, main road priority, minimum turns, residential avoidance, and balanced approach. Routes range from ${routes[0].total_length_km.toFixed(2)} km to ${routes[routes.length - 1].total_length_km.toFixed(2)} km.` },
        { title: 'Cost Comparison', content: `Total costs range from ${formatINR(routes[0].cost.total_cost)} (${routes[0].name}) to ${formatINR(routes[routes.length - 1].cost.total_cost)} (${routes[routes.length - 1].name}). Key cost drivers: fiber cable (${formatINR(rc.fiber_cable)}), civil work (${formatINR(rc.civil_work)}), and splicing (${formatINR(rc.splice_closures)}).` },
        { title: 'Risk Assessment', content: `Overall risk score: ${(riskScore * 100).toFixed(0)}/100. Main risks: construction complexity (${recommended.turn_count} turns), ${terrain} terrain conditions. All routes include 12% contingency and 18% GST.` },
        { title: 'Recommendation', content: `"${recommended.name}" is recommended. ${recommended.pros}. Trade-off: ${recommended.cons}. This route has ${recommended.splice_points} splice points and costs ${formatINR(rc.cost_per_km)}/km.` },
      ],
      confidence: routes.length >= 3 ? 'high' : 'medium',
      recommended_scenario: recommended.name,
    },
  };
}

export default function BuildRequests() {
  const { submitPlan, isLoading, currentResult, error, clearError, setCurrentResult, setP2pRoutes } = usePlanningStore();
  const [formData, setFormData] = useState({ location: '', premises: '', budgetMin: '', budgetMax: '', timeline: 'standard' as PlanningRequest['timeline'], priority: 'market-expansion' as PlanningRequest['priority'], terrain_type: 'urban' as PlanningRequest['terrain_type'] });
  const [polygon, setPolygon] = useState<[number, number][]>([]);
  const [drawMode, setDrawMode] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>('draw');
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState('');
  const [fitToPolygon, setFitToPolygon] = useState(false);
  const [polygonArea, setPolygonArea] = useState(0);
  const [overlays, setOverlays] = useState<any[]>([]);

  const [p2pStep, setP2pStep] = useState<'origin' | 'dest' | 'done'>('origin');
  const [originAddr, setOriginAddr] = useState('');
  const [destAddr, setDestAddr] = useState('');
  const [originPt, setOriginPt] = useState<{ lat: number; lon: number; label: string } | null>(null);
  const [destPt, setDestPt] = useState<{ lat: number; lon: number; label: string } | null>(null);
  const [routeResults, setRouteResults] = useState<RouteResult[]>([]);
  const [routeOverlays, setRouteOverlays] = useState<any[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [comparingRoutes, setComparingRoutes] = useState(false);

  const r = currentResult;
  const area = r?.route?.area_analysis;

  useEffect(() => {
    if (polygon.length >= 3 && inputMode === 'draw') {
      const cLat = polygon.reduce((s, p) => s + p[0], 0) / polygon.length;
      const cLon = polygon.reduce((s, p) => s + p[1], 0) / polygon.length;
      setPolygonArea(calcAreaKm2(polygon));
      reverseGeocode(cLat, cLon).then(loc => setFormData(prev => ({ ...prev, location: loc })));
    }
  }, [polygon.length]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true); setSearchStatus('Searching...');
    const result = await fetchBoundary(searchQuery.trim());
    if (result) { setPolygon(result.polygon); setFitToPolygon(true); setPolygonArea(calcAreaKm2(result.polygon)); setFormData(prev => ({ ...prev, location: result.name })); setSearchStatus(`Found: ${result.name}`); }
    else setSearchStatus('Not found');
    setSearching(false);
  };

  const handleP2pClick = useCallback(async (lat: number, lon: number) => {
    const label = await reverseGeocode(lat, lon);
    if (p2pStep === 'origin') { setOriginPt({ lat, lon, label }); setOriginAddr(label); setP2pStep('dest'); }
    else if (p2pStep === 'dest') { setDestPt({ lat, lon, label }); setDestAddr(label); setP2pStep('done'); }
  }, [p2pStep]);

  const handleP2pSearch = async (which: 'origin' | 'dest') => {
    const query = which === 'origin' ? originAddr : destAddr;
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=in`, { headers: { 'User-Agent': 'ATLAS/1.0' } });
      const data = await res.json();
      if (data.length) {
        const pt = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), label: data[0].display_name?.split(',').slice(0, 3).join(', ') || query };
        if (which === 'origin') { setOriginPt(pt); setOriginAddr(pt.label); if (!destPt) setP2pStep('dest'); else setP2pStep('done'); }
        else { setDestPt(pt); setDestAddr(pt.label); setP2pStep('done'); }
        setFitToPolygon(true);
      }
    } catch { }
    setSearching(false);
  };

  // Find 5 routes AND populate all tabs
  const handleFindRoutes = async () => {
    if (!originPt || !destPt) return;
    setComparingRoutes(true); setSearchStatus('Finding 5 routes...');
    try {
      const res = await fetch('http://localhost:8000/api/v1/routes/compare', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin_lat: originPt.lat, origin_lon: originPt.lon, dest_lat: destPt.lat, dest_lon: destPt.lon, terrain_type: formData.terrain_type }),
      });
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        setRouteResults(data.routes);
        setSelectedRoute(data.recommended_route);
        setRouteOverlays(data.routes.map((r: any, i: number) => ({
          edges: r.edges, color: ROUTE_COLORS[i % 5], label: r.name,
          opacity: r.recommended ? 0.9 : 0.4, weight: r.recommended ? 4 : 2.5,
        })));
        setFormData(prev => ({ ...prev, location: `${originPt!.label} → ${destPt!.label}` }));
        setSearchStatus(`Found ${data.routes.length} routes • Straight line: ${data.straight_line_km} km • All tabs populated`);
        setFitToPolygon(true);

        // Transform routes into full PlanningResponse and push to all tabs
        const fullResult = routesToPlanningResult(data.routes, originPt, destPt, formData.terrain_type);
        setCurrentResult(fullResult);
        // Also store raw P2P routes for Network Planner and Digital Twin
        setP2pRoutes(data.routes);
      }
    } catch { setSearchStatus('Route comparison failed'); }
    setComparingRoutes(false);
  };

  const selectRoute = (id: string) => {
    setSelectedRoute(id);
    setRouteOverlays(routeResults.map((r, i) => ({
      edges: r.edges, color: ROUTE_COLORS[i % 5], label: r.name,
      opacity: r.id === id ? 0.9 : 0.15, weight: r.id === id ? 5 : 2,
    })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); clearError();
    if (!formData.location.trim() && polygon.length < 3) { alert('Select an area first'); return; }
    const request: PlanningRequest = { location: formData.location.trim() || 'Custom Area', budget: Number(formData.budgetMax || formData.budgetMin || 50) * 100000, timeline: formData.timeline, priority: formData.priority, terrain_type: formData.terrain_type };
    if (polygon.length >= 3) request.polygon = polygon;
    else request.premises = Number(formData.premises) || 1000;
    setFitToPolygon(false); await submitPlan(request);
  };

  const clearAll = () => {
    setPolygon([]); setFitToPolygon(false); setSearchStatus(''); setSearchQuery('');
    setPolygonArea(0); setOverlays([]); setOriginPt(null); setDestPt(null);
    setOriginAddr(''); setDestAddr(''); setRouteResults([]); setRouteOverlays([]);
    setSelectedRoute(null); setP2pStep('origin');
    setFormData(prev => ({ ...prev, location: '' }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">New Build Request</h1>
          <p className="text-slate-400">Draw area, search boundary, or compare routes between origin and destination</p>
        </div>
        {(r || routeResults.length > 0) && (
          <button onClick={() => {
            clearAll();
            clearError();
            usePlanningStore.getState().clearResult();
            usePlanningStore.getState().clearP2p();
          }}
            className="px-5 py-2.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-700 hover:text-white transition-all flex items-center space-x-2 text-sm font-medium">
            <RotateCcw className="w-4 h-4" />
            <span>New Analysis</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardCard title="Select Deployment Area">
          <div className="flex items-center space-x-1 mb-3 p-1 bg-slate-800/50 rounded-lg">
            {([
              { mode: 'draw' as InputMode, icon: Pencil, label: 'Draw' },
              { mode: 'search' as InputMode, icon: Search, label: 'Search Boundary' },
              { mode: 'p2p' as InputMode, icon: Navigation, label: 'Origin → Destination' },
            ]).map(({ mode, icon: Icon, label }) => (
              <button key={mode} onClick={() => { setInputMode(mode); setDrawMode(false); clearAll(); }}
                className={`flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${inputMode === mode ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-white'}`}>
                <Icon className="w-3.5 h-3.5" /><span>{label}</span></button>))}
          </div>

          {inputMode === 'draw' && (
            <div className="flex items-center space-x-2 mb-3">
              <button onClick={() => { setDrawMode(!drawMode); if (!drawMode) { setPolygon([]); setFitToPolygon(false); } }} className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${drawMode ? 'bg-cyan-500 text-white' : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'}`}><Pencil className="w-4 h-4" /><span>{drawMode ? 'Drawing...' : 'Start Drawing'}</span></button>
              {polygon.length > 0 && <button onClick={clearAll} className="flex items-center space-x-2 px-3 py-2 bg-slate-800 text-red-400 border border-slate-700 rounded-lg text-sm"><Trash2 className="w-4 h-4" /><span>Clear</span></button>}
              {drawMode && polygon.length >= 3 && <button onClick={() => setDrawMode(false)} className="flex items-center space-x-2 px-3 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm"><CheckCircle className="w-4 h-4" /><span>Done</span></button>}
            </div>)}

          {inputMode === 'search' && (
            <div className="flex items-center space-x-2 mb-3">
              <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }} placeholder='City name, e.g. "Salem"'
                className="flex-1 bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
              <button onClick={handleSearch} disabled={searching} className="px-4 py-2.5 bg-cyan-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center space-x-1.5">{searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}<span>Find</span></button>
              {polygon.length > 0 && <button onClick={clearAll} className="px-3 py-2.5 bg-slate-800 text-red-400 border border-slate-700 rounded-lg"><Trash2 className="w-4 h-4" /></button>}
            </div>)}

          {inputMode === 'p2p' && (
            <div className="space-y-2 mb-3">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500 flex-shrink-0" />
                <input type="text" value={originAddr} onChange={e => setOriginAddr(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleP2pSearch('origin'); }}
                  placeholder="Origin address / location" className="flex-1 bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
                <button onClick={() => handleP2pSearch('origin')} disabled={searching || !originAddr.trim()} className="px-3 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs disabled:opacity-50">Search</button>
                <button onClick={() => setP2pStep('origin')} className={`px-3 py-2 rounded-lg text-xs ${p2pStep === 'origin' ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}><MousePointer className="w-3.5 h-3.5" /></button>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
                <input type="text" value={destAddr} onChange={e => setDestAddr(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleP2pSearch('dest'); }}
                  placeholder="Destination address / location" className="flex-1 bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
                <button onClick={() => handleP2pSearch('dest')} disabled={searching || !destAddr.trim()} className="px-3 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs disabled:opacity-50">Search</button>
                <button onClick={() => setP2pStep('dest')} className={`px-3 py-2 rounded-lg text-xs ${p2pStep === 'dest' ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}><MousePointer className="w-3.5 h-3.5" /></button>
              </div>
              <div className="flex items-center space-x-2">
                <button onClick={handleFindRoutes} disabled={!originPt || !destPt || comparingRoutes}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center space-x-2">
                  {comparingRoutes ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                  <span>{comparingRoutes ? 'Finding routes...' : 'Find 5 Routes & Analyze'}</span>
                </button>
                {(originPt || destPt) && <button onClick={clearAll} className="px-3 py-2.5 bg-slate-800 text-red-400 border border-slate-700 rounded-lg"><Trash2 className="w-4 h-4" /></button>}
              </div>
              <p className="text-xs text-slate-500">Routes auto-populate Scenario Simulator, Digital Twin, and Cost Intelligence tabs</p>
            </div>)}

          {searchStatus && <div className={`mb-2 px-3 py-1.5 rounded-lg text-xs ${searchStatus.includes('not found') || searchStatus.includes('failed') ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'}`}>{searchStatus}</div>}

          <div className="h-[400px] rounded-lg overflow-hidden border border-slate-800">
            <DeploymentMap center={[11.0, 78.0]} zoom={7}
              polygon={polygon} onPolygonChange={setPolygon} drawMode={drawMode}
              routeEdges={!routeResults.length ? (r?.route.route_edges || []) : []}
              sourceNode={!routeResults.length ? (r?.route.source_node || null) : null}
              areaAnalysis={area || null} fitToPolygon={fitToPolygon}
              overlays={overlays} originMarker={originPt} destMarker={destPt}
              routeOverlays={routeOverlays}
              pointClickMode={inputMode === 'p2p' && p2pStep !== 'done' ? p2pStep : null}
              onPointClick={inputMode === 'p2p' ? handleP2pClick : undefined}
              onLocate={(lat, lon) => {
                reverseGeocode(lat, lon).then(loc => setFormData(prev => ({ ...prev, location: loc })));
              }} />
          </div>

          {routeResults.length > 0 && (
            <div className="mt-2 px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/30">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                {routeResults.map((rt, i) => (
                  <button key={rt.id} onClick={() => selectRoute(rt.id)}
                    className={`flex items-center space-x-1.5 px-2 py-1 rounded transition-all ${selectedRoute === rt.id ? 'bg-slate-700' : 'hover:bg-slate-800'}`}>
                    <div className="w-4 h-1.5 rounded-full" style={{ backgroundColor: ROUTE_COLORS[i % 5] }} />
                    <span className={selectedRoute === rt.id ? 'text-white font-medium' : 'text-slate-400'}>{rt.name}</span>
                    {rt.recommended && <Star className="w-3 h-3 text-amber-400" />}
                  </button>))}
              </div>
            </div>)}

          {area && <div className="mt-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg"><p className="text-sm text-emerald-400 font-medium mb-1">Area Analysis</p><div className="grid grid-cols-3 gap-2 text-xs text-slate-300"><span>{area.area_sq_km.toFixed(3)} km²</span><span>{area.detected_buildings.toLocaleString('en-IN')} buildings</span><span>{area.building_source === 'google_earth_engine' ? 'GEE' : area.building_source}</span></div></div>}
        </DashboardCard>

        {/* Right: Route cards OR form */}
        {routeResults.length > 0 ? (
          <DashboardCard title="5 Routes — All Tabs Updated">
            <p className="text-xs text-slate-400 mb-3">Shortest route is pre-selected as recommended. Go to Scenario Simulator, Digital Twin, or Cost Intelligence to explore further.</p>
            <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
              {routeResults.map((rt, i) => (
                <div key={rt.id} onClick={() => selectRoute(rt.id)}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedRoute === rt.id ? 'border-cyan-500/50 bg-cyan-500/5' : rt.recommended ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: ROUTE_COLORS[i % 5] }}>{rt.rank}</div>
                      <span className="text-sm font-semibold text-white">{rt.name}</span>
                      {rt.recommended && <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[10px] font-bold">RECOMMENDED</span>}
                    </div>
                    <span className="text-lg font-bold text-emerald-400">{formatINR(rt.cost.total_cost)}</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">{rt.description}</p>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div><span className="text-slate-500">Distance</span><p className="font-semibold text-white">{rt.total_length_km.toFixed(2)} km</p></div>
                    <div><span className="text-slate-500">Splices</span><p className="font-semibold text-white">{rt.splice_points}</p></div>
                    <div><span className="text-slate-500">Cost/km</span><p className="font-semibold text-cyan-400">{formatINR(rt.cost.cost_per_km)}</p></div>
                    <div><span className="text-slate-500">Turns</span><p className="font-semibold text-white">{rt.turn_count}</p></div>
                  </div>
                  {selectedRoute === rt.id && (
                    <div className="mt-3 pt-3 border-t border-slate-700/50 grid grid-cols-3 gap-2 text-xs">
                      {[{ l: 'Fiber', v: rt.cost.fiber_cable }, { l: 'Civil', v: rt.cost.civil_work }, { l: 'Splicing', v: rt.cost.splice_closures },
                      { l: 'Testing', v: rt.cost.testing_survey }, { l: 'Permits', v: rt.cost.permits }, { l: 'GST+Cont.', v: rt.cost.contingency + rt.cost.gst },
                      ].map((c, ci) => (
                        <div key={ci} className="p-1.5 bg-slate-900/50 rounded"><p className="text-slate-500 text-[10px]">{c.l}</p><p className="font-semibold text-white">{formatINR(c.v)}</p></div>))}
                    </div>
                  )}
                </div>))}
            </div>
          </DashboardCard>
        ) : (
          <DashboardCard title="Deployment Parameters">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="block text-sm font-medium text-slate-300 mb-1">Location</label>
                <input type="text" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} placeholder="Auto-fills from map" className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50" /></div>
              {polygon.length >= 3 && <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg"><p className="text-sm text-cyan-400 font-medium">{inputMode === 'search' ? 'Boundary' : 'Polygon'} • {polygonArea.toFixed(3)} km²</p></div>}
              {polygon.length < 3 && <div><label className="block text-sm font-medium text-slate-300 mb-1">Premises</label><input type="number" value={formData.premises} onChange={e => setFormData({ ...formData, premises: e.target.value })} placeholder="Auto-detected" className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50" /></div>}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-slate-300 mb-1">Budget Min (₹L)</label><input type="number" value={formData.budgetMin} onChange={e => setFormData({ ...formData, budgetMin: e.target.value })} placeholder="25" className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50" /></div>
                <div><label className="block text-sm font-medium text-slate-300 mb-1">Budget Max (₹L)</label><input type="number" value={formData.budgetMax} onChange={e => setFormData({ ...formData, budgetMax: e.target.value })} placeholder="500" className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50" /></div>
              </div>
              <div><label className="block text-sm font-medium text-slate-300 mb-1">Timeline</label>
                <div className="grid grid-cols-3 gap-2">{([{ v: 'urgent' as const, l: 'Urgent', i: Zap }, { v: 'standard' as const, l: 'Standard', i: Calendar }, { v: 'long-term' as const, l: 'Long-term', i: Target }]).map(o => (
                  <button key={o.v} type="button" onClick={() => setFormData({ ...formData, timeline: o.v })} className={`p-2.5 rounded-lg border-2 text-center transition-all ${formData.timeline === o.v ? 'border-cyan-500 bg-cyan-500/10' : 'border-slate-700 bg-slate-800/50'}`}>
                    <o.i className={`w-4 h-4 mx-auto mb-1 ${formData.timeline === o.v ? 'text-cyan-400' : 'text-slate-400'}`} /><span className={`text-xs ${formData.timeline === o.v ? 'text-white' : 'text-slate-400'}`}>{o.l}</span></button>))}</div></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-slate-300 mb-1">Terrain</label><select value={formData.terrain_type} onChange={e => setFormData({ ...formData, terrain_type: e.target.value as any })} className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-200 text-sm"><option value="urban">Urban</option><option value="suburban">Suburban</option><option value="rural">Rural</option><option value="mountainous">Mountainous</option></select></div>
                <div><label className="block text-sm font-medium text-slate-300 mb-1">Priority</label><select value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value as any })} className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-200 text-sm"><option value="market-expansion">Market Expansion</option><option value="rural-connectivity">Rural Connectivity</option><option value="competitive-defense">Competitive Defense</option></select></div>
              </div>
              <button type="submit" disabled={isLoading} className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center space-x-2">
                {isLoading ? <><Loader2 className="w-5 h-5 animate-spin" /><span>Working...</span></> : <><Zap className="w-5 h-5" /><span>Start Planning</span></>}</button>
            </form>
          </DashboardCard>)}
      </div>

      {error && <DashboardCard title="Error"><div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start space-x-3"><AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" /><div><p className="text-red-400 text-sm font-medium">Failed</p><p className="text-red-300/70 text-sm mt-1">{error}</p></div></div></DashboardCard>}

      {r && !isLoading && (<>
        <div className="bg-gradient-to-r from-cyan-500/10 to-blue-600/10 border border-cyan-500/20 rounded-xl p-5"><div className="flex items-start space-x-3"><CheckCircle className="w-5 h-5 text-cyan-400 mt-0.5" /><div><h3 className="text-sm font-semibold text-white mb-1">{r.decision.recommended_scenario.name}</h3><p className="text-sm text-slate-300">{r.explanation.summary}</p></div></div></div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[{ i: IndianRupee, v: formatINR(r.cost.total_cost), l: 'CAPEX', c: 'emerald' }, { i: TrendingUp, v: `${r.route.route_length_km} km`, l: 'Route', c: 'cyan' }, { i: MapPin, v: r.route.premises_connected.toLocaleString('en-IN'), l: 'Premises', c: 'purple' }, { i: AlertTriangle, v: `${(r.risk.overall_risk_score * 100).toFixed(0)}/100`, l: 'Risk', c: 'orange' }].map((m, idx) => (
          <div key={idx} className="p-4 bg-slate-900/50 border border-slate-800/50 rounded-xl text-center"><m.i className={`w-5 h-5 text-${m.c}-400 mx-auto mb-1`} /><p className="text-xl font-bold text-white">{m.v}</p><p className="text-xs text-slate-400">{m.l}</p></div>))}</div>
      </>)}
    </div>
  );
}