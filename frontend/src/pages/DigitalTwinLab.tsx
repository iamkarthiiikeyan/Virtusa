import { useState } from 'react';
import DashboardCard from '../components/DashboardCard';
import RouteMap from '../components/RouteMap';
import DeploymentMap, { ROUTE_COLORS } from '../components/DeploymentMap';
import { Play, Zap, Clock, Target, MapPin, IndianRupee, ArrowLeft } from 'lucide-react';
import { usePlanningStore } from '../stores/planningStore';
import { useNavigate } from 'react-router-dom';
import { formatINR } from '../utils/formatINR';

const PHASE_COLORS = ['#06b6d4', '#10b981', '#f59e0b'];

export default function DigitalTwinLab() {
  const { currentResult: r, selectedPhaseScenarios, p2pRoutes, p2pMode } = usePlanningStore();
  const navigate = useNavigate();
  const [phase, setPhase] = useState(0);

  // P2P MODE: show selected routes as phases on map
  if (p2pMode && p2pRoutes && p2pRoutes.length > 0 && r) {
    const phaseScenarios = selectedPhaseScenarios.length > 0
      ? selectedPhaseScenarios
      : r.decision.all_rankings.slice(0, 3);

    // Match scenarios to their route edges
    const phaseRoutes = phaseScenarios.map(s => p2pRoutes.find((rt: any) => rt.id === s.id)).filter(Boolean);

    const phases = phaseScenarios.map((s, i) => ({
      name: `Route ${i + 1}`,
      scenario: s.name,
      cost: s.estimated_cost,
      months: s.estimated_months,
      coverage: s.coverage_percent,
      routeKm: s.route_length_km,
      risk: s.risk_tolerance,
      topsis: s.topsis_score || 0,
    }));

    // Build route overlays - show selected phase brightly, others dimmed
    const routeOverlays = phaseRoutes.map((rt: any, i: number) => ({
      edges: rt?.edges || [],
      color: PHASE_COLORS[i],
      label: rt?.name || `Route ${i + 1}`,
      opacity: i <= phase ? 0.9 : 0.2,
      weight: i === phase ? 5 : i < phase ? 3 : 2,
    }));

    const origin = r.route.source_node;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Digital Twin Lab — Route Visualization</h1>
            <p className="text-slate-400">
              Visualizing {phaseScenarios.length} selected routes • Click phases to compare
            </p>
          </div>
          <button onClick={() => navigate('/scenario-simulator')}
            className="px-4 py-2 bg-slate-800 text-slate-300 border border-slate-700 rounded-lg hover:bg-slate-700 text-sm">
            Change Selection
          </button>
        </div>

        {/* Phase selector */}
        <div className="flex items-center space-x-3">
          {phases.map((p, i) => (
            <button key={i} onClick={() => setPhase(i)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${phase === i ? 'bg-slate-800 border-2' : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-slate-600'
                }`}
              style={phase === i ? { borderColor: PHASE_COLORS[i], color: PHASE_COLORS[i] } : {}}>
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PHASE_COLORS[i] }} />
              <span>{p.scenario}</span>
              <span className="text-xs opacity-60">{formatINR(p.cost)}</span>
            </button>
          ))}
        </div>

        {/* Map with route overlays */}
        <DashboardCard title={`Route: ${phases[phase]?.scenario || 'Select'}`}>
          <div className="h-[450px] rounded-lg overflow-hidden">
            <DeploymentMap center={[11.0, 78.0]} zoom={12}
              polygon={[]} onPolygonChange={() => { }} drawMode={false}
              routeOverlays={routeOverlays}
              originMarker={origin ? { lat: origin.lat, lon: origin.lon, label: 'Origin' } : null}
              fitToPolygon={true} />
          </div>

          <div className="mt-3 px-4 py-3 bg-slate-800/50 rounded-lg border border-slate-700/30">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {phases.map((p, i) => (
                <div key={i} className="flex items-center space-x-2">
                  <div className="w-5 h-1.5 rounded-full" style={{ backgroundColor: PHASE_COLORS[i], opacity: i <= phase ? 1 : 0.2 }} />
                  <span className={`text-xs ${i <= phase ? 'text-slate-300' : 'text-slate-600'}`}>{p.scenario} ({p.routeKm?.toFixed(1)} km)</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">Bright lines = active route • Dim lines = other options</p>
          </div>
        </DashboardCard>

        {/* Phase comparison */}
        <div className="grid grid-cols-3 gap-4">
          {phases.map((p, i) => (
            <div key={i} onClick={() => setPhase(i)}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${phase === i ? 'bg-slate-800/50 border-2' : 'bg-slate-900/50 border-slate-800/50 hover:border-slate-700'
                }`}
              style={phase === i ? { borderColor: PHASE_COLORS[i] } : {}}>
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PHASE_COLORS[i] }} />
                <h3 className="text-sm font-semibold text-white">{p.scenario}</h3>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-slate-400">Cost</span><span className="text-emerald-400 font-semibold">{formatINR(p.cost)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Distance</span><span className="text-white">{p.routeKm?.toFixed(2)} km</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Timeline</span><span className="text-white">{p.months} months</span></div>
                <div className="flex justify-between"><span className="text-slate-400">TOPSIS Score</span><span className="text-cyan-400">{((p.topsis || 0) * 100).toFixed(0)}</span></div>
              </div>
            </div>
          ))}
        </div>

        {/* Individual summary for selected phase */}
        <DashboardCard title={`Selected: ${phases[phase]?.scenario || 'None'}`}>
          {phases[phase] && (
            <div className="grid grid-cols-4 gap-4">
              <div className="p-3 bg-slate-800/30 rounded-lg text-center">
                <IndianRupee className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                <p className="text-lg font-bold text-white">{formatINR(phases[phase].cost)}</p>
                <p className="text-xs text-slate-400">Estimated Cost</p>
              </div>
              <div className="p-3 bg-slate-800/30 rounded-lg text-center">
                <Target className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
                <p className="text-lg font-bold text-white">{phases[phase].routeKm?.toFixed(2)} km</p>
                <p className="text-xs text-slate-400">Route Distance</p>
              </div>
              <div className="p-3 bg-slate-800/30 rounded-lg text-center">
                <Clock className="w-5 h-5 text-orange-400 mx-auto mb-1" />
                <p className="text-lg font-bold text-white">{phases[phase].months} months</p>
                <p className="text-xs text-slate-400">Timeline</p>
              </div>
              <div className="p-3 bg-slate-800/30 rounded-lg text-center">
                <Zap className="w-5 h-5 text-purple-400 mx-auto mb-1" />
                <p className="text-lg font-bold text-white">{((phases[phase].topsis || 0) * 100).toFixed(0)}</p>
                <p className="text-xs text-slate-400">TOPSIS Score</p>
              </div>
            </div>
          )}
        </DashboardCard>
      </div>
    );
  }

  // AREA MODE: existing phased deployment view
  const phaseScenarios = selectedPhaseScenarios.length === 3
    ? selectedPhaseScenarios
    : r ? r.decision.all_rankings.slice(0, 3) : [];

  const phases = phaseScenarios.length > 0
    ? phaseScenarios.map((s, i) => ({
      name: `Phase ${i + 1}`, scenario: s.name, cost: s.estimated_cost,
      months: s.estimated_months, coverage: s.coverage_percent,
      premises: s.premises_connected, costPerPremise: s.cost_per_premise,
      routeKm: s.route_length_km, risk: s.risk_tolerance, topsis: s.topsis_score || 0,
    }))
    : [{ name: 'Phase 1', scenario: 'Select scenarios first', cost: 0, months: 0, coverage: 0, premises: 0, costPerPremise: 0, routeKm: 0, risk: '-', topsis: 0 }];

  const noSelection = phaseScenarios.length < 3;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Digital Twin Lab</h1>
          <p className="text-slate-400">{noSelection ? 'Select 3 scenarios in Scenario Simulator first' : `Simulating 3 phases: ${phaseScenarios.map(s => s.name).join(' → ')}`}</p>
        </div>
        {noSelection && <button onClick={() => navigate(r ? '/scenario-simulator' : '/build-requests')} className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg flex items-center space-x-2"><ArrowLeft className="w-5 h-5" /><span>{r ? 'Go to Scenarios' : 'Run Analysis'}</span></button>}
      </div>

      {!noSelection && (
        <div className="flex items-center space-x-3">
          {phases.map((p, i) => (
            <button key={i} onClick={() => setPhase(i)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${phase === i ? 'bg-slate-800 border-2' : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-slate-600'}`}
              style={phase === i ? { borderColor: PHASE_COLORS[i], color: PHASE_COLORS[i] } : {}}>
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PHASE_COLORS[i] }} />
              <span>{p.name}: {p.scenario}</span>
            </button>))}
        </div>
      )}

      <DashboardCard title={!noSelection ? `Network — Phase ${phase + 1}: ${phases[phase]?.scenario}` : 'Network Topology'}>
        {r && r.route.route_edges.length > 0 && !noSelection ? (
          <>
            <RouteMap routeEdges={r.route.route_edges} sourceNode={r.route.source_node} height="450px" phaseColors={PHASE_COLORS} activePhase={phase} />
            <div className="mt-3 px-4 py-3 bg-slate-800/50 rounded-lg border border-slate-700/30">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                {phases.map((p, i) => (<div key={i} className="flex items-center space-x-2"><div className="w-5 h-1.5 rounded-full" style={{ backgroundColor: PHASE_COLORS[i], opacity: i <= phase ? 1 : 0.2 }} /><span className={`text-xs ${i <= phase ? 'text-slate-300' : 'text-slate-600'}`}>Phase {i + 1}: {p.scenario}</span></div>))}
                <div className="flex items-center space-x-2"><div className="w-3 h-3 rounded-full bg-red-500" /><span className="text-xs text-slate-300">Central Office</span></div>
              </div>
              <p className="text-xs text-slate-500 mt-2">Bright lines = deployed • Dim lines = future phases</p>
            </div>
          </>
        ) : (
          <div className="h-[450px] flex items-center justify-center bg-slate-950 rounded-lg">
            <div className="text-center"><MapPin className="w-12 h-12 text-slate-600 mx-auto mb-3" /><p className="text-slate-400">{noSelection ? 'Select 3 scenarios first' : 'No route data'}</p></div>
          </div>
        )}
      </DashboardCard>

      {!noSelection && (
        <>
          <div className="grid grid-cols-3 gap-4">
            {phases.map((p, i) => (
              <div key={i} onClick={() => setPhase(i)} className={`p-4 rounded-xl border cursor-pointer transition-all ${phase === i ? 'bg-slate-800/50 border-2' : 'bg-slate-900/50 border-slate-800/50 hover:border-slate-700'}`} style={phase === i ? { borderColor: PHASE_COLORS[i] } : {}}>
                <div className="flex items-center space-x-2 mb-3"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: PHASE_COLORS[i] }} /><h3 className="text-sm font-semibold text-white">{p.scenario}</h3></div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-slate-400">Cost</span><span className="text-emerald-400 font-semibold">{formatINR(p.cost)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Coverage</span><span className="text-white">{p.coverage}%</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Timeline</span><span className="text-white">{p.months} months</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Premises</span><span className="text-white">{(p.premises || 0).toLocaleString('en-IN')}</span></div>
                </div>
              </div>))}
          </div>
          <DashboardCard title={`Selected: Phase ${phase + 1} — ${phases[phase]?.scenario}`}>
            {phases[phase] && (
              <div className="grid grid-cols-4 gap-4">
                <div className="p-3 bg-slate-800/30 rounded-lg text-center">
                  <IndianRupee className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-white">{formatINR(phases[phase].cost)}</p>
                  <p className="text-xs text-slate-400">Estimated Cost</p>
                </div>
                <div className="p-3 bg-slate-800/30 rounded-lg text-center">
                  <Target className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-white">{phases[phase].coverage}%</p>
                  <p className="text-xs text-slate-400">Coverage</p>
                </div>
                <div className="p-3 bg-slate-800/30 rounded-lg text-center">
                  <Clock className="w-5 h-5 text-orange-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-white">{phases[phase].months} months</p>
                  <p className="text-xs text-slate-400">Timeline</p>
                </div>
                <div className="p-3 bg-slate-800/30 rounded-lg text-center">
                  <IndianRupee className="w-5 h-5 text-purple-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-white">{(phases[phase].premises || 0).toLocaleString('en-IN')}</p>
                  <p className="text-xs text-slate-400">Premises</p>
                </div>
              </div>
            )}
          </DashboardCard>
        </>
      )}
    </div>
  );
}