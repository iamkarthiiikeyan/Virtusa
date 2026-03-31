import { useState, useEffect } from 'react';
import DashboardCard from '../components/DashboardCard';
import { GitCompare, Loader2, ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { formatINR } from '../utils/formatINR';

const API = 'http://localhost:8000';

interface DBRecord {
  id: number; location: string; total_cost: number; route_km: number;
  risk_score: number; recommended: string; premises: number;
  detected_buildings: number; status: string; duration: number; created_at: string;
}

interface FullResult {
  cost: any; route: any; risk: any; decision: any; explanation: any;
}

function Diff({ a, b, format = 'number', inverse = false }: { a: number; b: number; format?: string; inverse?: boolean }) {
  const diff = b - a;
  const pct = a > 0 ? ((diff / a) * 100).toFixed(1) : '0';
  const better = inverse ? diff < 0 : diff > 0;
  const worse = inverse ? diff > 0 : diff < 0;

  return (
    <span className={`text-xs font-medium ${better ? 'text-emerald-400' : worse ? 'text-red-400' : 'text-slate-500'}`}>
      {diff === 0 ? <Minus className="w-3 h-3 inline" /> : better ? <TrendingUp className="w-3 h-3 inline" /> : <TrendingDown className="w-3 h-3 inline" />}
      {' '}{diff > 0 ? '+' : ''}{format === 'inr' ? formatINR(diff) : format === 'pct' ? `${(diff * 100).toFixed(0)}%` : diff.toFixed(1)} ({pct}%)
    </span>
  );
}

export default function Compare() {
  const { token, user } = useAuthStore();
  const [records, setRecords] = useState<DBRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selA, setSelA] = useState<number | null>(null);
  const [selB, setSelB] = useState<number | null>(null);
  const [resultA, setResultA] = useState<FullResult | null>(null);
  const [resultB, setResultB] = useState<FullResult | null>(null);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    setLoading(true);
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const endpoint = user?.role === 'admin' ? `${API}/api/v1/records/all?limit=50` : `${API}/api/v1/records?limit=50`;
    fetch(endpoint, { headers }).then(r => r.json()).then(d => {
      setRecords((d.records || []).filter((r: DBRecord) => r.status === 'completed'));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [token]);

  const runCompare = async () => {
    if (!selA || !selB) return;
    setComparing(true);
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const [resA, resB] = await Promise.all([
      fetch(`${API}/api/v1/records/${selA}`, { headers }).then(r => r.json()),
      fetch(`${API}/api/v1/records/${selB}`, { headers }).then(r => r.json()),
    ]);
    setResultA(resA.result);
    setResultB(resB.result);
    setComparing(false);
  };

  const recA = records.find(r => r.id === selA);
  const recB = records.find(r => r.id === selB);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Compare Analyses</h1>
        <p className="text-slate-400">Select two past analyses to compare side-by-side</p>
      </div>

      {/* Selection */}
      <div className="flex items-center space-x-4">
        <div className="flex-1">
          <label className="block text-xs text-slate-400 mb-1">Analysis A</label>
          <select value={selA || ''} onChange={e => { setSelA(Number(e.target.value)); setResultA(null); }}
            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50">
            <option value="">Select analysis...</option>
            {records.map(r => <option key={r.id} value={r.id}>#{r.id} — {r.location} ({formatINR(r.total_cost)})</option>)}
          </select>
        </div>
        <ArrowRight className="w-5 h-5 text-slate-500 mt-5" />
        <div className="flex-1">
          <label className="block text-xs text-slate-400 mb-1">Analysis B</label>
          <select value={selB || ''} onChange={e => { setSelB(Number(e.target.value)); setResultB(null); }}
            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50">
            <option value="">Select analysis...</option>
            {records.filter(r => r.id !== selA).map(r => <option key={r.id} value={r.id}>#{r.id} — {r.location} ({formatINR(r.total_cost)})</option>)}
          </select>
        </div>
        <button onClick={runCompare} disabled={!selA || !selB || comparing}
          className="mt-5 px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center space-x-2">
          {comparing ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCompare className="w-4 h-4" />}
          <span>Compare</span>
        </button>
      </div>

      {/* Comparison results */}
      {resultA && resultB && recA && recB && (
        <>
          {/* Summary comparison */}
          <DashboardCard title="Side-by-Side Comparison">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 w-40">Metric</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-cyan-400">#{recA.id} — {recA.location?.split(',')[0]}</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-purple-400">#{recB.id} — {recB.location?.split(',')[0]}</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Total CAPEX', a: resultA.cost?.total_cost || 0, b: resultB.cost?.total_cost || 0, fmt: 'inr', inv: true },
                    { label: 'Cost per Premise', a: resultA.cost?.cost_per_premise || 0, b: resultB.cost?.cost_per_premise || 0, fmt: 'inr', inv: true },
                    { label: 'Cost per km', a: resultA.cost?.cost_per_km || 0, b: resultB.cost?.cost_per_km || 0, fmt: 'inr', inv: true },
                    { label: 'Route Length (km)', a: resultA.route?.route_length_km || 0, b: resultB.route?.route_length_km || 0, fmt: 'number', inv: true },
                    { label: 'Premises Connected', a: resultA.route?.premises_connected || 0, b: resultB.route?.premises_connected || 0, fmt: 'number', inv: false },
                    { label: 'Risk Score', a: resultA.risk?.overall_risk_score || 0, b: resultB.risk?.overall_risk_score || 0, fmt: 'pct', inv: true },
                    { label: 'Processing Time (s)', a: recA.duration || 0, b: recB.duration || 0, fmt: 'number', inv: true },
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-slate-800/30 hover:bg-slate-800/20">
                      <td className="py-3 px-4 text-sm text-slate-300">{row.label}</td>
                      <td className="py-3 px-4 text-right text-sm font-semibold text-white">
                        {row.fmt === 'inr' ? formatINR(row.a) : row.fmt === 'pct' ? `${(row.a * 100).toFixed(0)}/100` : row.a.toFixed(1)}
                      </td>
                      <td className="py-3 px-4 text-right text-sm font-semibold text-white">
                        {row.fmt === 'inr' ? formatINR(row.b) : row.fmt === 'pct' ? `${(row.b * 100).toFixed(0)}/100` : row.b.toFixed(1)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Diff a={row.a} b={row.b} format={row.fmt} inverse={row.inv} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DashboardCard>

          {/* Cost breakdown comparison */}
          <DashboardCard title="Cost Breakdown Comparison">
            <div className="grid grid-cols-2 gap-6">
              {[{ label: `#${recA.id} — ${recA.location?.split(',')[0]}`, data: resultA.cost?.breakdown, color: 'cyan' },
                { label: `#${recB.id} — ${recB.location?.split(',')[0]}`, data: resultB.cost?.breakdown, color: 'purple' },
              ].map((side, si) => (
                <div key={si}>
                  <h4 className={`text-sm font-semibold text-${side.color}-400 mb-3`}>{side.label}</h4>
                  {side.data && Object.entries(side.data).filter(([, v]) => typeof v === 'number' && (v as number) > 0).map(([key, val], i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-800/30">
                      <span className="text-xs text-slate-400 capitalize">{key.replace(/_/g, ' ')}</span>
                      <span className="text-xs font-semibold text-white">{formatINR(val as number)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </DashboardCard>

          {/* Risk comparison */}
          <DashboardCard title="Risk Comparison">
            <div className="grid grid-cols-2 gap-6">
              {[{ label: `#${recA.id}`, risks: resultA.risk?.risks || [], color: 'cyan' },
                { label: `#${recB.id}`, risks: resultB.risk?.risks || [], color: 'purple' },
              ].map((side, si) => (
                <div key={si}>
                  <h4 className={`text-sm font-semibold text-${side.color}-400 mb-3`}>{side.label} — {((si === 0 ? resultA : resultB).risk?.overall_severity || 'N/A')}</h4>
                  {side.risks.map((risk: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-800/30">
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${risk.severity === 'high' ? 'bg-red-500' : risk.severity === 'medium' ? 'bg-orange-500' : 'bg-emerald-500'}`} />
                        <span className="text-xs text-slate-400 capitalize">{risk.risk_type?.replace(/_/g, ' ')}</span>
                      </div>
                      <span className="text-xs font-semibold text-white">{(risk.score * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </DashboardCard>

          {/* Recommendation comparison */}
          <div className="grid grid-cols-2 gap-6">
            {[{ id: recA.id, loc: recA.location, result: resultA, color: 'cyan' },
              { id: recB.id, loc: recB.location, result: resultB, color: 'purple' },
            ].map((side, si) => (
              <DashboardCard key={si} title={`#${side.id} — AI Recommendation`}>
                <p className={`text-sm font-semibold text-${side.color}-400 mb-2`}>{side.result.decision?.recommended_scenario?.name}</p>
                <p className="text-xs text-slate-300">{side.result.explanation?.summary}</p>
              </DashboardCard>
            ))}
          </div>
        </>
      )}

      {records.length === 0 && !loading && (
        <div className="text-center py-12">
          <GitCompare className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">Run at least 2 analyses to use the comparison feature</p>
        </div>
      )}
    </div>
  );
}
