import { useState, useMemo } from 'react';
import DashboardCard from '../components/DashboardCard';
import { GitBranch, Star, CheckCircle, AlertTriangle, ArrowLeft, Zap, IndianRupee, Users, Shield, MapPin } from 'lucide-react';
import { usePlanningStore } from '../stores/planningStore';
import { useNavigate } from 'react-router-dom';
import { formatINR } from '../utils/formatINR';

interface TopoType {
  id: string; name: string; description: string; howItWorks: string; diagram: string;
  pros: string[]; cons: string[]; bestFor: string; fttpUse: string;
  costMultiplier: number; redundancy: 'none' | 'partial' | 'full';
  scalability: 'low' | 'medium' | 'high'; maxPremises: number; complexity: 'low' | 'medium' | 'high';
}

const TOPOLOGIES: TopoType[] = [
  {
    id: 'tree', name: 'Tree / PON',
    description: 'Passive Optical Network — OLT connects to splitters that fan out to ONTs. Standard GPON/XGS-PON architecture used by 95% of FTTP deployments worldwide.',
    howItWorks: 'A single fiber from the OLT feeds into a primary splitter (1:8), which fans out to secondary splitters (1:32), each serving multiple ONTs. Total split ratio up to 1:128. Passive — no powered equipment between CO and customer.',
    diagram: 'CO ─── OLT ─── Splitter 1:8 ──┬── Splitter 1:32 ──┬── ONT 1\n                               │                    ├── ONT 2\n                               │                    └── ONT 3\n                               ├── Splitter 1:32 ──┬── ONT 4\n                               │                    └── ONT 5\n                               └── Splitter 1:32 ──┬── ONT 6\n                                                    └── ONT 7',
    pros: ['Lowest cost per premise — shared fiber infrastructure', 'No powered equipment in the field (passive splitters)', 'Proven: GPON 2.5G / XGS-PON 10G standards', 'Low maintenance and high reliability', 'Scales to 4,096 subscribers per OLT'],
    cons: ['Shared bandwidth (2.5G split across 32-128 users)', 'Single point of failure at each splitter', 'No built-in redundancy path', 'Max 20km reach from OLT to ONT'],
    bestFor: 'Residential FTTP with 100+ premises in urban/suburban areas',
    fttpUse: 'Standard FTTP topology. Used by Jio Fiber, Airtel Xstream, BSNL FTTH, BT Openreach. 95% of global FTTP deployments.',
    costMultiplier: 1.0, redundancy: 'none', scalability: 'high', maxPremises: 4096, complexity: 'low',
  },
  {
    id: 'star', name: 'Star / P2P',
    description: 'Point-to-Point — each ONT gets a dedicated fiber all the way back to the OLT. No sharing, no splitting. Full bandwidth per customer.',
    howItWorks: 'Every customer gets their own fiber from the Central Office. The OLT has one port per customer. No splitters — full dedicated bandwidth (1G-10G per user). Requires high fiber count in feeder cables.',
    diagram: 'CO ─── OLT Port 1 ──────────── ONT (Customer A)  [1 Gbps dedicated]\n       OLT Port 2 ──────────── ONT (Customer B)  [1 Gbps dedicated]\n       OLT Port 3 ──────────── ONT (Customer C)  [1 Gbps dedicated]\n       OLT Port 4 ──────────── ONT (Customer D)  [1 Gbps dedicated]\n          ... one dedicated fiber per customer ...',
    pros: ['Dedicated bandwidth per customer (1G-10G each)', 'Maximum security — no shared medium', 'Easy fault isolation — one fiber per customer', 'Each customer upgradeable independently', 'Best QoS — no contention'],
    cons: ['3-4x cost of Tree/PON per premise', 'Requires massive fiber count cables (96-288 core)', 'More OLT ports and power needed', 'Impractical for >250 premises', 'Higher duct space requirements'],
    bestFor: 'Enterprise FTTO, data centres, business parks with <50 high-value connections',
    fttpUse: 'Used for business FTTP (FTTO). Telcos offer P2P for enterprise SLA customers willing to pay premium.',
    costMultiplier: 3.5, redundancy: 'none', scalability: 'low', maxPremises: 256, complexity: 'low',
  },
  {
    id: 'ring', name: 'Ring',
    description: 'Fiber ring with add/drop nodes. Traffic flows bidirectionally — if one link breaks, traffic reroutes the other way within 50ms. Used for metro/backbone.',
    howItWorks: 'Nodes connect in a closed loop with dual fiber paths. Each node can add/drop traffic. If a fiber cut occurs, ERPS/G.8032 protocol reroutes traffic within 50ms. Dual-ring provides full redundancy.',
    diagram: '            ┌──── Node A (CO) ────┐\n            │                      │\n       Node D (OLT)          Node B (OLT)\n            │                      │\n            └──── Node C (OLT) ────┘\n       (bidirectional — self-healing on cut)',
    pros: ['Self-healing — automatic failover in <50ms', 'Full redundancy — survives single fiber cut', 'Predictable latency', 'Standard for metro networks (ERPS/G.8032)'],
    cons: ['2-3x cost — needs dual fiber ring', 'Adding nodes disrupts ring temporarily', 'Limited last-mile use — better for backhaul', 'Complex management protocols', 'Bandwidth shared around ring'],
    bestFor: 'Metro backbone connecting COs, mountainous terrain needing redundancy, critical infrastructure',
    fttpUse: 'Used for BACKHAUL between Central Offices. Your OLTs connect to metro ring → core network. Critical where fiber cuts are common (mountains, floods).',
    costMultiplier: 2.5, redundancy: 'full', scalability: 'medium', maxPremises: 64, complexity: 'high',
  },
  {
    id: 'bus', name: 'Bus',
    description: 'Single shared fiber with taps/couplers. Each customer taps off the main fiber. Legacy technology — signal degrades with each tap.',
    howItWorks: 'One fiber runs through the area. At each customer location, an optical coupler taps ~3dB. Signal degrades cumulatively — last customer gets weakest signal. Simple but limited.',
    diagram: 'CO ═══╤════╤════╤════╤═══ (terminated)\n      │    │    │    │\n     ONT  ONT  ONT  ONT\n  (-3dB) (-6dB)(-9dB)(-12dB)\n  each tap reduces signal strength',
    pros: ['Simplest layout — single fiber run', 'Lowest fiber material cost', 'Good for linear deployments (roads, railways)', 'Easy initial deployment'],
    cons: ['Signal degrades with each tap (max ~8-16 customers)', 'Single point of failure — break kills all downstream', 'Cannot add customers mid-bus easily', 'Legacy — no modern FTTP standard supports this', 'Worst customer experience at end of bus'],
    bestFor: 'Very small linear deployments (<16 premises), rural highways, legacy retrofit',
    fttpUse: 'Rarely used in modern FTTP. Was used in early CATV over fiber. Tree/PON is strictly superior for access. Only consider for remote linear routes.',
    costMultiplier: 0.8, redundancy: 'none', scalability: 'low', maxPremises: 16, complexity: 'low',
  },
  {
    id: 'mesh', name: 'Mesh',
    description: 'Every node connects to multiple others. Maximum redundancy — multiple paths between any two points. Survives multiple simultaneous failures.',
    howItWorks: 'Each node has fiber connections to several other nodes. OSPF/MPLS routing chooses optimal path. Multiple simultaneous link failures are survivable. Full mesh = n(n-1)/2 connections.',
    diagram: '     Node A ════ Node B\n      ║ ╲          ║ ╲\n      ║   ╲        ║   ╲\n     Node C ════ Node D\n  (every node connected to every other)\n  n nodes = n(n-1)/2 fiber links',
    pros: ['Maximum redundancy — survives multiple failures', 'Load balancing across multiple paths', 'No single point of failure', 'Self-healing with dynamic routing'],
    cons: ['Extremely expensive — O(n²) connections', 'Complex routing and management', 'Massive duct and fiber requirements', 'Impractical beyond ~10-15 nodes', 'Overkill for access networks'],
    bestFor: 'Core backbone, data centre interconnect, military/government critical networks',
    fttpUse: 'CORE level only — connecting national data centres and major cities. Never used for last-mile. Cost prohibitive for access.',
    costMultiplier: 5.0, redundancy: 'full', scalability: 'medium', maxPremises: 32, complexity: 'high',
  },
];

const COLORS: Record<string, string> = { tree: 'cyan', star: 'emerald', ring: 'purple', bus: 'amber', mesh: 'red' };

export default function Topology() {
  const { currentResult: r } = usePlanningStore();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string>('tree');

  const recommendation = useMemo(() => {
    // No analysis → no recommendation
    if (!r) return null;

    const premises = r.route?.premises_connected || 0;
    const routeKm = r.route?.route_length_km || 0;
    const terrain = (r.cost?.terrain_type || 'urban').toLowerCase();
    const baseCost = r.cost?.total_cost || 0;
    const riskScore = r.risk?.overall_risk_score || 0.3;

    const scores: Record<string, { score: number; reasons: string[]; cost: number }> = {};

    TOPOLOGIES.forEach(t => {
      let score = 0;
      const reasons: string[] = [];
      const cost = Math.round(baseCost * t.costMultiplier);

      // ─── PREMISES FIT (0-25 pts) ───
      if (premises <= t.maxPremises * 0.5) { score += 25; reasons.push(`well within ${t.maxPremises} capacity`); }
      else if (premises <= t.maxPremises * 0.8) { score += 15; reasons.push('good capacity fit'); }
      else if (premises <= t.maxPremises) { score += 5; reasons.push('near capacity limit'); }
      else { score -= 25; reasons.push(`exceeds max ${t.maxPremises} premises`); }

      // ─── COST EFFICIENCY (0-20 pts) ───
      if (t.costMultiplier <= 0.9) { score += 20; reasons.push('lowest cost option'); }
      else if (t.costMultiplier <= 1.1) { score += 15; reasons.push('cost-effective'); }
      else if (t.costMultiplier <= 2.0) { score += 5; }
      else { score -= 10; reasons.push(`${t.costMultiplier}x cost premium`); }

      // ─── TERRAIN / LOCATION ADAPTATION (0-25 pts) ───
      if (terrain === 'urban') {
        // Urban: high density → Tree/PON ideal, Star for enterprise
        if (t.id === 'tree') { score += 25; reasons.push('ideal for urban high-density FTTP'); }
        else if (t.id === 'star' && premises < 50) { score += 18; reasons.push('good for urban enterprise P2P'); }
        else if (t.id === 'ring') { score += 5; reasons.push('urban has low fiber cut risk — ring redundancy unnecessary'); }
        else if (t.id === 'bus') { score -= 5; reasons.push('bus impractical in urban density'); }
        else if (t.id === 'mesh') { score -= 10; reasons.push('mesh overkill for urban access'); }
      }
      else if (terrain === 'suburban') {
        // Suburban: moderate density → Tree best, Phased/Star possible
        if (t.id === 'tree') { score += 22; reasons.push('suburban density suits Tree/PON well'); }
        else if (t.id === 'star' && premises < 80) { score += 12; reasons.push('feasible for suburban mixed-use'); }
        else if (t.id === 'bus' && premises < 16) { score += 8; reasons.push('bus works for small suburban strips'); }
      }
      else if (terrain === 'rural') {
        // Rural: long distances, sparse → Bus/Phased Tree viable, Ring for backhaul
        if (t.id === 'tree') { score += 15; reasons.push('Tree works but long feeder distances'); }
        else if (t.id === 'bus' && premises <= 16) { score += 20; reasons.push('bus suits linear rural deployment along roads'); }
        else if (t.id === 'star') { score -= 10; reasons.push('P2P too expensive for sparse rural'); }
        else if (t.id === 'ring') { score += 10; reasons.push('ring useful for rural CO backhaul redundancy'); }
      }
      else if (terrain === 'mountainous') {
        // Mountainous: high fiber cut risk → Ring for redundancy, Tree for access
        if (t.id === 'ring') { score += 25; reasons.push('mountainous terrain needs ring redundancy — frequent fiber cuts'); }
        else if (t.id === 'tree') { score += 12; reasons.push('Tree for access but add ring backhaul'); }
        else if (t.id === 'mesh') { score += 8; reasons.push('mesh provides max redundancy in harsh terrain'); }
        else if (t.id === 'bus') { score -= 15; reasons.push('single fiber bus too risky in mountains'); }
        else if (t.id === 'star') { score -= 5; reasons.push('P2P expensive in difficult terrain'); }
      }

      // ─── SCALABILITY MATCH (0-10 pts) ───
      if (t.scalability === 'high' && premises > 200) { score += 10; reasons.push('scales for large deployment'); }
      else if (t.scalability === 'low' && premises > 100) { score -= 10; reasons.push('poor scalability for this size'); }

      // ─── RISK MATCH (0-10 pts) ───
      if (riskScore > 0.6 && t.redundancy === 'full') { score += 10; reasons.push('redundancy matches high-risk area'); }
      if (riskScore < 0.3 && t.redundancy === 'none') { score += 5; reasons.push('low risk — redundancy not required'); }

      // ─── FTTP STANDARD BONUS (0-10 pts) ───
      if (t.id === 'tree') { score += 10; reasons.push('industry standard for FTTP access'); }

      scores[t.id] = { score: Math.max(0, Math.min(100, score)), reasons, cost };
    });

    return scores;
  }, [r]);

  const ranked = recommendation ? Object.entries(recommendation).sort(([, a], [, b]) => b.score - a.score) : [];
  const recommended = ranked[0]?.[0] || null;
  const activeTopology = TOPOLOGIES.find(t => t.id === selected) || TOPOLOGIES[0];
  const terrain = (r?.cost?.terrain_type || '').toLowerCase();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Network Topology</h1>
          <p className="text-slate-400">5 topologies compared — AI recommends based on your location, terrain, and premises</p>
        </div>
        {!r && <button onClick={() => navigate('/build-requests')} className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg text-sm flex items-center space-x-2"><ArrowLeft className="w-4 h-4" /><span>Run Analysis</span></button>}
      </div>

      {/* Location context */}
      {r && (
        <div className="flex items-center space-x-4 p-3 bg-slate-900/50 border border-slate-800/50 rounded-lg text-xs">
          <MapPin className="w-4 h-4 text-cyan-400" />
          <span className="text-slate-300">Terrain: <span className="text-white font-medium capitalize">{terrain}</span></span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-300">Premises: <span className="text-white font-medium">{r.route.premises_connected.toLocaleString('en-IN')}</span></span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-300">Route: <span className="text-white font-medium">{r.route.route_length_km} km</span></span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-300">Risk: <span className="text-white font-medium">{(r.risk.overall_risk_score * 100).toFixed(0)}/100</span></span>
        </div>
      )}

      {/* 5 topology cards */}
      <div className="grid grid-cols-5 gap-3">
        {TOPOLOGIES.map(t => {
          const score = recommendation?.[t.id]?.score ?? null;
          const isRec = t.id === recommended;
          const color = COLORS[t.id];
          return (
            <button key={t.id} onClick={() => setSelected(t.id)}
              className={`p-4 rounded-xl border text-left transition-all ${selected === t.id ? `bg-${color}-500/10 border-${color}-500/30` : 'bg-slate-900/50 border-slate-800/50 hover:border-slate-700'}`}>
              <div className="flex items-center justify-between mb-2">
                <GitBranch className={`w-5 h-5 text-${color}-400`} />
                {isRec && <Star className="w-4 h-4 text-amber-400" />}
              </div>
              <p className="text-sm font-semibold text-white mb-1">{t.name}</p>
              {score !== null ? (
                <>
                  <div className="flex items-center space-x-1 mb-2">
                    <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full bg-${color}-500 rounded-full`} style={{ width: `${score}%` }} />
                    </div>
                    <span className="text-xs text-slate-400">{score}</span>
                  </div>
                  <p className="text-xs text-slate-500">{formatINR(recommendation![t.id]?.cost || 0)}</p>
                  {isRec && <span className="mt-1 inline-block px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[10px] font-bold">BEST FIT</span>}
                </>
              ) : (
                <p className="text-xs text-slate-500 mt-2">Run analysis to score</p>
              )}
            </button>
          );
        })}
      </div>

      {/* AI recommendation */}
      {r && recommendation && recommended && (
        <div className={`p-4 rounded-xl border bg-${COLORS[recommended]}-500/5 border-${COLORS[recommended]}-500/20`}>
          <div className="flex items-start space-x-3">
            <CheckCircle className={`w-5 h-5 text-${COLORS[recommended]}-400 mt-0.5`} />
            <div>
              <p className="text-sm font-semibold text-white">
                AI Recommendation: <span className={`text-${COLORS[recommended]}-400`}>{TOPOLOGIES.find(t => t.id === recommended)?.name}</span>
                {' '}for {terrain} terrain with {r.route.premises_connected.toLocaleString('en-IN')} premises
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {recommendation[recommended]?.reasons?.slice(0, 4).join(' • ')}
              </p>
              {recommended !== 'tree' && terrain === 'mountainous' && (
                <p className="text-xs text-amber-400 mt-2">Note: Use Ring topology for CO-to-CO backhaul. For last-mile access to customers, combine with Tree/PON at each node.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {!r && (
        <div className="p-4 rounded-xl border border-slate-800/50 bg-slate-900/30">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-slate-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-slate-400">No analysis loaded</p>
              <p className="text-xs text-slate-500 mt-1">Run a planning analysis in Build Requests first. The AI will then recommend the best topology based on your location, terrain, premises count, and risk profile.</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <DashboardCard title={`${activeTopology.name} — Layout`}>
            <pre className="font-mono text-sm text-cyan-400 bg-slate-950 p-4 rounded-lg overflow-x-auto leading-relaxed whitespace-pre">{activeTopology.diagram}</pre>
            <p className="text-sm text-slate-300 mt-3">{activeTopology.howItWorks}</p>
          </DashboardCard>

          <div className="grid grid-cols-2 gap-4">
            <DashboardCard title="Advantages">
              <div className="space-y-2">{activeTopology.pros.map((p, i) => (
                <div key={i} className="flex items-start space-x-2"><CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" /><span className="text-sm text-slate-300">{p}</span></div>
              ))}</div>
            </DashboardCard>
            <DashboardCard title="Disadvantages">
              <div className="space-y-2">{activeTopology.cons.map((c, i) => (
                <div key={i} className="flex items-start space-x-2"><AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" /><span className="text-sm text-slate-300">{c}</span></div>
              ))}</div>
            </DashboardCard>
          </div>

          <DashboardCard title="FTTP Usage in Industry">
            <p className="text-sm text-slate-300 mb-3">{activeTopology.fttpUse}</p>
            <div className="p-3 bg-slate-800/30 rounded-lg">
              <p className="text-xs text-slate-400 font-medium mb-1">Best suited for:</p>
              <p className="text-sm text-white">{activeTopology.bestFor}</p>
            </div>
          </DashboardCard>
        </div>

        <div className="space-y-4">
          <DashboardCard title="Specifications">
            <div className="space-y-3">
              {[
                { label: 'Cost Multiplier', value: `${activeTopology.costMultiplier}×`, color: activeTopology.costMultiplier <= 1 ? 'emerald' : activeTopology.costMultiplier <= 2 ? 'amber' : 'red' },
                { label: 'Estimated Cost', value: recommendation ? formatINR(recommendation[activeTopology.id]?.cost || 0) : 'Run analysis', color: 'emerald' },
                { label: 'Max Premises', value: activeTopology.maxPremises.toLocaleString('en-IN'), color: 'cyan' },
                { label: 'Redundancy', value: activeTopology.redundancy, color: activeTopology.redundancy === 'full' ? 'emerald' : 'red' },
                { label: 'Scalability', value: activeTopology.scalability, color: activeTopology.scalability === 'high' ? 'emerald' : activeTopology.scalability === 'medium' ? 'amber' : 'red' },
                { label: 'Complexity', value: activeTopology.complexity, color: activeTopology.complexity === 'low' ? 'emerald' : 'red' },
                { label: 'Match Score', value: recommendation ? `${recommendation[activeTopology.id]?.score || 0}/100` : 'N/A', color: (recommendation?.[activeTopology.id]?.score || 0) > 60 ? 'emerald' : 'amber' },
              ].map((s, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                  <span className="text-sm text-slate-400">{s.label}</span>
                  <span className={`text-sm font-semibold text-${s.color}-400 capitalize`}>{s.value}</span>
                </div>
              ))}
            </div>
          </DashboardCard>

          <DashboardCard title="AI Assessment">
            {recommendation ? (
              <>
                <div className="space-y-2">
                  {recommendation[activeTopology.id]?.reasons?.map((reason, i) => (
                    <div key={i} className="flex items-start space-x-2 text-xs">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${reason.includes('ideal') || reason.includes('suits') || reason.includes('good') || reason.includes('standard') || reason.includes('cost-effective') || reason.includes('well within') || reason.includes('scales') ? 'bg-emerald-500' : reason.includes('exceeds') || reason.includes('impractical') || reason.includes('overkill') || reason.includes('expensive') || reason.includes('risky') || reason.includes('poor') ? 'bg-red-500' : 'bg-amber-500'}`} />
                      <span className="text-slate-300">{reason}</span>
                    </div>
                  ))}
                </div>
                {activeTopology.id === recommended ? (
                  <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <p className="text-xs text-emerald-400 font-medium">Best match for your {terrain} deployment</p>
                  </div>
                ) : (
                  <div className="mt-3 p-3 bg-slate-800/50 rounded-lg">
                    <p className="text-xs text-slate-500">Consider {TOPOLOGIES.find(t => t.id === recommended)?.name} — scored {recommendation[recommended!]?.score} vs {recommendation[activeTopology.id]?.score}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-slate-500">Run an analysis to get AI-powered topology assessment based on your terrain, premises, and risk profile.</p>
              </div>
            )}
          </DashboardCard>
        </div>
      </div>

      {/* Comparison matrix */}
      <DashboardCard title="Topology Comparison Matrix">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400">Topology</th>
                <th className="text-center py-3 px-3 text-xs font-semibold text-slate-400">Cost</th>
                <th className="text-center py-3 px-3 text-xs font-semibold text-slate-400">Premises</th>
                <th className="text-center py-3 px-3 text-xs font-semibold text-slate-400">Redundancy</th>
                <th className="text-center py-3 px-3 text-xs font-semibold text-slate-400">Scalability</th>
                <th className="text-center py-3 px-3 text-xs font-semibold text-slate-400">Complexity</th>
                <th className="text-center py-3 px-3 text-xs font-semibold text-slate-400">Score</th>
              </tr>
            </thead>
            <tbody>
              {(ranked.length > 0 ? ranked.map(([id]) => TOPOLOGIES.find(tp => tp.id === id)!) : TOPOLOGIES).map(t => {
                const score = recommendation?.[t.id]?.score ?? null;
                const isRec = t.id === recommended;
                return (
                  <tr key={t.id} onClick={() => setSelected(t.id)}
                    className={`border-b border-slate-800/30 cursor-pointer transition-all ${selected === t.id ? 'bg-cyan-500/5' : 'hover:bg-slate-800/20'}`}>
                    <td className="py-3 px-3"><div className="flex items-center space-x-2"><span className="text-sm font-medium text-white">{t.name}</span>{isRec && <Star className="w-3 h-3 text-amber-400" />}</div></td>
                    <td className="py-3 px-3 text-center text-sm text-slate-300">{t.costMultiplier}×</td>
                    <td className="py-3 px-3 text-center text-sm text-slate-300">{t.maxPremises.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-3 text-center"><span className={`px-2 py-0.5 rounded text-xs ${t.redundancy === 'full' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{t.redundancy}</span></td>
                    <td className="py-3 px-3 text-center"><span className={`px-2 py-0.5 rounded text-xs ${t.scalability === 'high' ? 'bg-emerald-500/10 text-emerald-400' : t.scalability === 'medium' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>{t.scalability}</span></td>
                    <td className="py-3 px-3 text-center"><span className={`px-2 py-0.5 rounded text-xs ${t.complexity === 'low' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{t.complexity}</span></td>
                    <td className="py-3 px-3 text-center">{score !== null ? <div className="flex items-center justify-center space-x-1"><div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full rounded-full ${score > 60 ? 'bg-emerald-500' : score > 35 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${score}%` }} /></div><span className="text-xs text-slate-400">{score}</span></div> : <span className="text-xs text-slate-600">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DashboardCard>
    </div>
  );
}