import { useState } from 'react';
import DashboardCard from '../components/DashboardCard';
import DeploymentMap, { ROUTE_COLORS } from '../components/DeploymentMap';
import { Route, Users, Mountain, Building2, MapPin, Star } from 'lucide-react';
import { usePlanningStore } from '../stores/planningStore';
import { useNavigate } from 'react-router-dom';
import { formatINR } from '../utils/formatINR';

export default function NetworkPlanner() {
  const { currentResult: r, p2pRoutes, p2pMode } = usePlanningStore();
  const navigate = useNavigate();
  const [selectedP2pRoute, setSelectedP2pRoute] = useState<string | null>(null);

  // P2P mode: show all 5 routes
  if (p2pMode && p2pRoutes && p2pRoutes.length > 0 && r) {
    const activeId = selectedP2pRoute || p2pRoutes[0]?.id;
    const routeOverlays = p2pRoutes.map((rt: any, i: number) => ({
      edges: rt.edges,
      color: ROUTE_COLORS[i % 5],
      label: rt.name,
      opacity: !selectedP2pRoute ? 0.6 : rt.id === activeId ? 0.9 : 0.15,
      weight: !selectedP2pRoute ? 3 : rt.id === activeId ? 5 : 2,
    }));

    const origin = r.route.source_node;

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Network Planner — Route Comparison</h1>
          <p className="text-slate-400">{p2pRoutes.length} routes found • Click a route to highlight • Shortest = recommended</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { icon: Route, label: 'Routes Found', value: `${p2pRoutes.length}`, color: 'cyan' },
            { icon: Route, label: 'Shortest', value: `${p2pRoutes[0]?.total_length_km?.toFixed(2)} km`, color: 'emerald' },
            { icon: Route, label: 'Longest', value: `${p2pRoutes[p2pRoutes.length - 1]?.total_length_km?.toFixed(2)} km`, color: 'orange' },
            { icon: Building2, label: 'Cost Range', value: `${formatINR(p2pRoutes[0]?.cost?.total_cost)} - ${formatINR(p2pRoutes[p2pRoutes.length - 1]?.cost?.total_cost)}`, color: 'purple' },
          ].map((s, i) => (
            <div key={i} className="bg-slate-900/50 border border-slate-800/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <s.icon className={`w-5 h-5 text-${s.color}-400`} />
                <span className="text-lg font-bold text-white">{s.value}</span>
              </div>
              <p className="text-sm text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Map with all routes */}
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
          <div className="h-[500px]">
            <DeploymentMap
              center={[11.0, 78.0]} zoom={12}
              polygon={[]} onPolygonChange={() => {}} drawMode={false}
              routeOverlays={routeOverlays}
              originMarker={origin ? { lat: origin.lat, lon: origin.lon, label: 'Origin' } : null}
              fitToPolygon={true}
            />
          </div>

          {/* Route legend */}
          <div className="px-4 py-3 bg-slate-900/80 border-t border-slate-800">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <button onClick={() => setSelectedP2pRoute(null)}
                className={`px-3 py-1 rounded text-xs transition-all ${!selectedP2pRoute ? 'bg-slate-700 text-white font-medium' : 'text-slate-400 hover:text-white'}`}>
                Show All
              </button>
              {p2pRoutes.map((rt: any, i: number) => (
                <button key={rt.id} onClick={() => setSelectedP2pRoute(rt.id)}
                  className={`flex items-center space-x-1.5 px-2 py-1 rounded text-xs transition-all ${
                    activeId === rt.id && selectedP2pRoute ? 'bg-slate-700 text-white font-medium' : 'text-slate-400 hover:text-white'
                  }`}>
                  <div className="w-4 h-1.5 rounded-full" style={{ backgroundColor: ROUTE_COLORS[i % 5] }} />
                  <span>{rt.name}</span>
                  <span className="text-slate-500">{rt.total_length_km?.toFixed(1)}km</span>
                  {rt.recommended && <Star className="w-3 h-3 text-amber-400" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Route details table */}
        <DashboardCard title="Route Details">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400">Route</th>
                  <th className="text-right py-3 px-3 text-xs font-semibold text-slate-400">Distance</th>
                  <th className="text-right py-3 px-3 text-xs font-semibold text-slate-400">Turns</th>
                  <th className="text-right py-3 px-3 text-xs font-semibold text-slate-400">Splices</th>
                  <th className="text-right py-3 px-3 text-xs font-semibold text-slate-400">Fiber Cost</th>
                  <th className="text-right py-3 px-3 text-xs font-semibold text-slate-400">Civil Cost</th>
                  <th className="text-right py-3 px-3 text-xs font-semibold text-slate-400">Total Cost</th>
                  <th className="text-right py-3 px-3 text-xs font-semibold text-slate-400">Cost/km</th>
                </tr>
              </thead>
              <tbody>
                {p2pRoutes.map((rt: any, i: number) => (
                  <tr key={rt.id}
                    onClick={() => setSelectedP2pRoute(rt.id)}
                    className={`border-b border-slate-800/30 cursor-pointer transition-all ${
                      activeId === rt.id && selectedP2pRoute ? 'bg-cyan-500/5' : 'hover:bg-slate-800/20'
                    }`}>
                    <td className="py-3 px-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ROUTE_COLORS[i % 5] }} />
                        <span className="text-sm font-medium text-white">{rt.name}</span>
                        {rt.recommended && <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[10px] font-bold">REC</span>}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right text-sm text-slate-300">{rt.total_length_km?.toFixed(2)} km</td>
                    <td className="py-3 px-3 text-right text-sm text-slate-300">{rt.turn_count}</td>
                    <td className="py-3 px-3 text-right text-sm text-slate-300">{rt.splice_points}</td>
                    <td className="py-3 px-3 text-right text-sm text-slate-300">{formatINR(rt.cost?.fiber_cable)}</td>
                    <td className="py-3 px-3 text-right text-sm text-slate-300">{formatINR(rt.cost?.civil_work)}</td>
                    <td className="py-3 px-3 text-right text-sm font-semibold text-emerald-400">{formatINR(rt.cost?.total_cost)}</td>
                    <td className="py-3 px-3 text-right text-sm text-cyan-400">{formatINR(rt.cost?.cost_per_km)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardCard>
      </div>
    );
  }

  // Area-based mode: existing single-route view
  const stats = r
    ? [
        { icon: Route, label: 'Fiber Route', value: `${r.route.route_length_km} km`, color: 'cyan' },
        { icon: Users, label: 'Premises', value: r.route.premises_connected.toLocaleString('en-IN'), color: 'emerald' },
        { icon: Mountain, label: 'Terrain', value: r.cost.terrain_type, color: 'orange' },
        { icon: Building2, label: 'Segments', value: `${r.route.total_edges}`, color: 'purple' },
      ]
    : [
        { icon: Route, label: 'Routes', value: '--', color: 'cyan' },
        { icon: Users, label: 'Premises', value: '--', color: 'emerald' },
        { icon: Mountain, label: 'Terrain', value: '--', color: 'orange' },
        { icon: Building2, label: 'Nodes', value: '--', color: 'purple' },
      ];

  const routeInfo = r
    ? [
        { label: 'Distance', value: `${r.route.route_length_km} km`, color: 'cyan' },
        { label: 'Fiber Cost', value: formatINR(r.cost.breakdown.fiber_materials), color: 'emerald' },
        { label: 'Strategy', value: r.route.strategy.replace(/_/g, ' '), color: 'orange' },
        { label: 'Risk', value: r.risk.overall_severity, color: r.risk.overall_severity === 'low' ? 'emerald' : 'orange' },
      ]
    : [
        { label: 'Distance', value: '--', color: 'cyan' },
        { label: 'Cost', value: '--', color: 'emerald' },
        { label: 'Strategy', value: '--', color: 'orange' },
        { label: 'Risk', value: '--', color: 'emerald' },
      ];

  const costInfo = r
    ? [
        { label: 'Total', value: formatINR(r.cost.total_cost), color: 'white' },
        { label: 'Per Premise', value: formatINR(r.cost.cost_per_premise), color: 'emerald' },
        { label: 'Per km', value: formatINR(r.cost.cost_per_km), color: 'cyan' },
        { label: 'Terrain Factor', value: `${r.cost.terrain_multiplier}x`, color: 'orange' },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Network Planner</h1>
          <p className="text-slate-400">{r ? `Optimized route for ${r.route.premises_connected.toLocaleString('en-IN')} premises` : 'Fiber route optimization and topology planning'}</p>
        </div>
        {!r && <button onClick={() => navigate('/build-requests')} className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg flex items-center space-x-2"><Route className="w-4 h-4" /><span>Run Planning</span></button>}
      </div>

      <div className="grid grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div key={i} className="bg-slate-900/50 border border-slate-800/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2"><s.icon className={`w-5 h-5 text-${s.color}-400`} /><span className="text-xl font-bold text-white">{s.value}</span></div>
            <p className="text-sm text-slate-400">{s.label}</p>
          </div>))}
      </div>

      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
        {r && r.route.route_edges.length > 0 ? (
          <div className="h-[500px]">
            <DeploymentMap center={[11.0, 78.0]} zoom={14} polygon={[]} onPolygonChange={() => {}} drawMode={false}
              routeEdges={r.route.route_edges} sourceNode={r.route.source_node} fitToPolygon={true} />
          </div>
        ) : (
          <div className="h-[500px] flex items-center justify-center bg-slate-950">
            <div className="text-center"><MapPin className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">{r ? 'No route edges available' : 'Run a planning analysis to see fiber routes'}</p>
              {!r && <button onClick={() => navigate('/build-requests')} className="mt-4 px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-lg text-sm">Go to Build Requests</button>}
            </div>
          </div>
        )}
        {r && r.route.route_edges.length > 0 && (
          <div className="px-4 py-3 bg-slate-900/80 border-t border-slate-800 flex items-center space-x-6">
            <div className="flex items-center space-x-2"><div className="w-4 h-1 bg-emerald-500 rounded" /><span className="text-xs text-slate-400">Fiber route</span></div>
            <div className="flex items-center space-x-2"><div className="w-3 h-3 rounded-full bg-red-500" /><span className="text-xs text-slate-400">Central Office</span></div>
            <span className="text-xs text-slate-500">{r.route.total_edges} segments • {r.route.route_length_km} km</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Route Analysis</h3>
          <div className="space-y-4">{routeInfo.map((item, idx) => (<div key={idx} className="flex justify-between"><span className="text-sm text-slate-400">{item.label}</span><span className={`text-sm font-semibold text-${item.color}-400`}>{item.value}</span></div>))}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Top Risks</h3>
          <div className="space-y-3">{r ? r.risk.risks.slice(0, 4).map((risk, i) => (
            <div key={i} className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg">
              <div className="flex items-center space-x-2"><div className={`w-2 h-2 rounded-full ${risk.severity === 'high' ? 'bg-red-500' : risk.severity === 'medium' ? 'bg-orange-500' : 'bg-emerald-500'}`} /><span className="text-sm text-slate-300">{risk.risk_type.replace(/_/g, ' ')}</span></div>
              <span className="text-xs text-slate-400">{(risk.score * 100).toFixed(0)}%</span>
            </div>)) : <p className="text-sm text-slate-500 text-center">No data</p>}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Cost Summary</h3>
          <div className="space-y-3">{costInfo.length > 0 ? costInfo.map((item, idx) => (
            <div key={idx} className="flex justify-between"><span className="text-sm text-slate-400">{item.label}</span><span className={`text-sm font-semibold text-${item.color}-400`}>{item.value}</span></div>
          )) : <p className="text-sm text-slate-500 text-center">No data</p>}</div>
        </div>
      </div>
    </div>
  );
}
