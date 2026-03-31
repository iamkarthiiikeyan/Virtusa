import { useState, useEffect } from 'react';
import DashboardCard from '../components/DashboardCard';
import AreaChart from '../components/AreaChart';
import DonutChart from '../components/DonutChart';
import { FileText, Zap, MapPin, IndianRupee, Users, Clock, CheckCircle, XCircle, Activity, TrendingUp } from 'lucide-react';
import { usePlanningStore } from '../stores/planningStore';
import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';
import { formatINR } from '../utils/formatINR';

const API = 'http://localhost:8000';

interface DBRecord {
  id: number; location: string; total_cost: number; route_km: number;
  risk_score: number; recommended: string; premises: number;
  detected_buildings: number; status: string; user_email: string;
  duration: number; created_at: string; approval_status: string;
}

export default function Dashboard() {
  const { currentResult: r } = usePlanningStore();
  const { token, user } = useAuthStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ pending: 0, running: 0, completed: 0, failed: 0, total: 0 });
  const [records, setRecords] = useState<DBRecord[]>([]);
  const [userCount, setUserCount] = useState(0);

  useEffect(() => {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    fetch(`${API}/api/v1/queue/status`, { headers }).then(r => r.json()).then(setStats).catch(() => {});
    const endpoint = user?.role === 'admin' ? `${API}/api/v1/records/all?limit=20` : `${API}/api/v1/records?limit=20`;
    fetch(endpoint, { headers }).then(r => r.json()).then(d => setRecords(d.records || [])).catch(() => {});
    if (user?.role === 'admin') fetch(`${API}/api/v1/auth/users`, { headers }).then(r => r.json()).then(d => setUserCount(d.users?.length || 0)).catch(() => {});
  }, [token, r]);

  const completed = records.filter(r => r.total_cost);
  const totalCapex = completed.reduce((s, r) => s + r.total_cost, 0);
  const avgDuration = records.filter(r => r.duration).reduce((s, r, _, a) => s + r.duration / a.length, 0);
  const totalBuildings = records.filter(r => r.detected_buildings).reduce((s, r) => s + r.detected_buildings, 0);
  const totalPremises = records.filter(r => r.premises).reduce((s, r) => s + r.premises, 0);

  // Chart data
  const capexTrend = completed.slice().reverse().map(r => ({ label: r.location?.split(',')[0]?.slice(0, 8) || `#${r.id}`, value: r.total_cost }));
  const premisesTrend = records.filter(r => r.premises).slice().reverse().map(r => ({ label: r.location?.split(',')[0]?.slice(0, 8) || `#${r.id}`, value: r.premises }));

  // Donut: cost breakdown from current result
  const costDonut = r?.cost?.breakdown ? Object.entries(r.cost.breakdown)
    .filter(([, v]) => typeof v === 'number' && (v as number) > 0)
    .map(([k, v], i) => ({ label: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), value: v as number,
      color: ['#06b6d4', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6', '#64748b'][i % 8] }))
    : [];

  // Donut: queue status
  const queueDonut = [
    { label: 'Completed', value: stats.completed, color: '#10b981' },
    { label: 'Running', value: stats.running, color: '#06b6d4' },
    { label: 'Pending', value: stats.pending, color: '#f59e0b' },
    { label: 'Failed', value: stats.failed, color: '#ef4444' },
  ];

  // Donut: approval status
  const approvalCounts = records.reduce((acc, r) => {
    const s = r.approval_status || 'pending_review';
    acc[s] = (acc[s] || 0) + 1; return acc;
  }, {} as Record<string, number>);
  const approvalDonut = [
    { label: 'Approved', value: approvalCounts['approved'] || 0, color: '#10b981' },
    { label: 'Rejected', value: approvalCounts['rejected'] || 0, color: '#ef4444' },
    { label: 'Pending', value: approvalCounts['pending_review'] || 0, color: '#f59e0b' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Network Operations Dashboard</h1>
          <p className="text-slate-400">{stats.total > 0 ? `${stats.total} analyses • ${stats.completed} completed • Live database` : 'AI-driven fiber deployment planning'}</p>
        </div>
        <button onClick={() => navigate('/build-requests')} className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg font-medium hover:from-cyan-600 hover:to-blue-700 transition-all flex items-center space-x-2">
          <Zap className="w-5 h-5" /><span>New Analysis</span>
        </button>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: FileText, label: 'Total Analyses', value: `${stats.total}`, sub: `${stats.completed} completed`, color: 'cyan' },
          { icon: IndianRupee, label: 'Total CAPEX', value: totalCapex > 0 ? formatINR(totalCapex) : '--', sub: completed.length > 0 ? `Avg: ${formatINR(totalCapex / completed.length)}` : 'No data', color: 'emerald' },
          { icon: MapPin, label: 'Buildings Detected', value: totalBuildings > 0 ? totalBuildings.toLocaleString('en-IN') : '--', sub: `${totalPremises.toLocaleString('en-IN')} premises`, color: 'purple' },
          { icon: Clock, label: 'Avg Processing', value: avgDuration > 0 ? `${avgDuration.toFixed(1)}s` : '--', sub: stats.running > 0 ? `${stats.running} running` : 'Idle', color: 'orange' },
        ].map((m, i) => (
          <div key={i} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 bg-${m.color}-500/10 rounded-lg flex items-center justify-center`}><m.icon className={`w-5 h-5 text-${m.color}-400`} /></div>
              {i === 0 && stats.running > 0 && <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />}
            </div>
            <p className="text-2xl font-bold text-white mb-1">{m.value}</p>
            <p className="text-xs text-slate-400">{m.label}</p>
            <p className="text-xs text-slate-500 mt-1">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Queue bar */}
      {stats.total > 0 && (
        <div className="flex items-center space-x-4 p-3 bg-slate-900/50 border border-slate-800/50 rounded-lg">
          <span className="text-xs text-slate-400 font-medium">Queue:</span>
          {[{ l: 'Completed', c: stats.completed, cl: 'emerald' }, { l: 'Running', c: stats.running, cl: 'cyan' }, { l: 'Pending', c: stats.pending, cl: 'amber' }, { l: 'Failed', c: stats.failed, cl: 'red' }].map((s, i) => (
            <div key={i} className="flex items-center space-x-1.5"><div className={`w-2 h-2 rounded-full bg-${s.cl}-500 ${s.l === 'Running' && s.c > 0 ? 'animate-pulse' : ''}`} /><span className="text-xs text-slate-300">{s.c} {s.l}</span></div>
          ))}
          {user?.role === 'admin' && <div className="ml-auto flex items-center space-x-1.5"><Users className="w-3.5 h-3.5 text-slate-500" /><span className="text-xs text-slate-500">{userCount} users</span></div>}
        </div>
      )}

      {/* AI recommendation */}
      {r && (
        <div className="bg-gradient-to-r from-cyan-500/10 to-blue-600/10 border border-cyan-500/20 rounded-xl p-5">
          <div className="flex items-start space-x-3"><Zap className="w-5 h-5 text-cyan-400 mt-0.5" /><div><h3 className="text-sm font-semibold text-white mb-1">Latest AI Recommendation</h3><p className="text-sm text-slate-300">{r.explanation.summary}</p></div></div>
        </div>
      )}

      {/* Charts row 1: Donut charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Queue donut */}
        <DashboardCard title="Queue Status">
          {stats.total > 0 ? (
            <DonutChart data={queueDonut} size={160} />
          ) : (
            <div className="h-[160px] flex items-center justify-center"><p className="text-sm text-slate-500">No analyses yet</p></div>
          )}
        </DashboardCard>

        {/* Cost breakdown donut */}
        <DashboardCard title="Cost Distribution">
          {costDonut.length > 0 ? (
            <DonutChart data={costDonut} size={160} />
          ) : (
            <div className="h-[160px] flex items-center justify-center"><p className="text-sm text-slate-500">Run analysis to see breakdown</p></div>
          )}
        </DashboardCard>

        {/* Approval donut */}
        <DashboardCard title="Approval Status">
          {records.length > 0 ? (
            <DonutChart data={approvalDonut} size={160} />
          ) : (
            <div className="h-[160px] flex items-center justify-center"><p className="text-sm text-slate-500">No records yet</p></div>
          )}
        </DashboardCard>
      </div>

      {/* Charts row 2: Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardCard title={capexTrend.length > 0 ? 'CAPEX Trend' : 'CAPEX Trend'}>
          {capexTrend.length > 0 ? (
            <AreaChart data={capexTrend} color="#10b981" height={200} />
          ) : (
            <div className="h-[200px] flex items-center justify-center"><p className="text-sm text-slate-500">Run analyses to see trends</p></div>
          )}
        </DashboardCard>
        <DashboardCard title={premisesTrend.length > 0 ? 'Premises Connected' : 'Premises Trend'}>
          {premisesTrend.length > 0 ? (
            <AreaChart data={premisesTrend} color="#06b6d4" height={200} />
          ) : (
            <div className="h-[200px] flex items-center justify-center"><p className="text-sm text-slate-500">Run analyses to see progress</p></div>
          )}
        </DashboardCard>
      </div>

      {/* CAPEX bar chart */}
      {completed.length > 0 && (
        <DashboardCard title="CAPEX by Analysis">
          <div className="space-y-2">
            {completed.slice(0, 8).map(rec => {
              const maxCost = Math.max(...completed.map(r => r.total_cost));
              const pct = (rec.total_cost / maxCost) * 100;
              return (
                <div key={rec.id} className="flex items-center space-x-3">
                  <span className="text-xs text-slate-400 w-24 truncate">{rec.location?.split(',')[0] || `#${rec.id}`}</span>
                  <div className="flex-1 h-7 bg-slate-800/50 rounded overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500/60 to-cyan-500/60 rounded flex items-center px-2" style={{ width: `${Math.max(pct, 5)}%` }}>
                      <span className="text-[10px] text-white font-medium whitespace-nowrap">{formatINR(rec.total_cost)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </DashboardCard>
      )}

      {/* Risk overview from current result */}
      {r && (
        <DashboardCard title="Active Risk Profile">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {r.risk.risks.slice(0, 6).map((risk, i) => (
              <div key={i} className="p-3 bg-slate-800/30 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-white capitalize">{risk.risk_type.replace(/_/g, ' ')}</span>
                  <div className={`w-2 h-2 rounded-full ${risk.severity === 'high' ? 'bg-red-500' : risk.severity === 'medium' ? 'bg-orange-500' : 'bg-emerald-500'}`} />
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${risk.severity === 'high' ? 'bg-red-500' : risk.severity === 'medium' ? 'bg-orange-500' : 'bg-emerald-500'}`}
                    style={{ width: `${risk.score * 100}%` }} />
                </div>
                <p className="text-xs text-slate-500 mt-1">{(risk.score * 100).toFixed(0)}%</p>
              </div>
            ))}
          </div>
        </DashboardCard>
      )}

      {/* Recent activity */}
      <DashboardCard title="Recent Activity">
        {records.length === 0 ? (
          <div className="text-center py-8"><FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" /><p className="text-slate-400">No analyses yet</p></div>
        ) : (
          <div className="space-y-2">
            {records.slice(0, 6).map(rec => (
              <div key={rec.id} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg border border-slate-700/30 hover:border-slate-600 transition-all cursor-pointer" onClick={() => navigate('/reports')}>
                <div className="flex items-center space-x-3">
                  {rec.status === 'completed' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : rec.status === 'failed' ? <XCircle className="w-4 h-4 text-red-400" /> : <Clock className="w-4 h-4 text-amber-400 animate-pulse" />}
                  <div>
                    <p className="text-sm text-white">{rec.location || 'Unknown'} <span className="text-slate-600">#{rec.id}</span></p>
                    <div className="flex items-center space-x-2 text-xs text-slate-500">
                      {rec.total_cost && <span>{formatINR(rec.total_cost)}</span>}
                      {rec.premises && <span>{rec.premises.toLocaleString('en-IN')} premises</span>}
                      <span>{new Date(rec.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {rec.approval_status === 'approved' && <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs rounded-full">Approved</span>}
                  {rec.approval_status === 'rejected' && <span className="px-2 py-0.5 bg-red-500/10 text-red-400 text-xs rounded-full">Rejected</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </DashboardCard>
    </div>
  );
}
