import DashboardCard from '../components/DashboardCard';
import { Lightbulb, CheckCircle, Zap, MapPin, Shield, DollarSign, IndianRupee } from 'lucide-react';
import { usePlanningStore } from '../stores/planningStore';
import { useNavigate } from 'react-router-dom';
import { formatINR } from '../utils/formatINR';

export default function DecisionInsights() {
  const { currentResult: r } = usePlanningStore();
  const navigate = useNavigate();
  const icons: Record<string,any> = {'Route Analysis':MapPin,'Cost Estimation':IndianRupee,'Risk Assessment':Shield,'Scenario Comparison':Zap,'Recommendation Rationale':Lightbulb};
  const colors: Record<string,string> = {'Route Analysis':'cyan','Cost Estimation':'emerald','Risk Assessment':'orange','Scenario Comparison':'purple','Recommendation Rationale':'blue'};

  if (!r) return (<div className="space-y-6"><div><h1 className="text-3xl font-bold text-white mb-2">Decision Insights</h1></div>
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-12 text-center"><Lightbulb className="w-12 h-12 text-slate-600 mx-auto mb-4"/><h3 className="text-lg font-semibold text-white mb-2">No decision data yet</h3>
    <button onClick={() => navigate('/build-requests')} className="px-6 py-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/20 transition-all">Go to Build Requests</button></div></div>);

  const rec = r.decision.recommended_scenario;
  return (<div className="space-y-6">
    <div><h1 className="text-3xl font-bold text-white mb-2">Decision Insights</h1><p className="text-slate-400">AI reasoning and explainability</p></div>

    <div className="bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border border-cyan-500/20 rounded-xl p-6">
      <div className="flex items-start space-x-4">
        <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0"><Lightbulb className="w-6 h-6 text-white"/></div>
        <div className="flex-1"><h2 className="text-xl font-bold text-white mb-2">Recommended: {rec.name}</h2><p className="text-slate-300 mb-4">{r.explanation.summary}</p>
          <div className="grid grid-cols-4 gap-4">
            <div className="p-3 bg-slate-900/50 rounded-lg"><p className="text-xs text-slate-400 mb-1">CAPEX</p><p className="text-sm font-semibold text-emerald-400">{formatINR(rec.estimated_cost)}</p></div>
            <div className="p-3 bg-slate-900/50 rounded-lg"><p className="text-xs text-slate-400 mb-1">Timeline</p><p className="text-sm font-semibold text-cyan-400">{rec.estimated_months} months</p></div>
            <div className="p-3 bg-slate-900/50 rounded-lg"><p className="text-xs text-slate-400 mb-1">Coverage</p><p className="text-sm font-semibold text-white">{rec.coverage_percent}%</p></div>
            <div className="p-3 bg-slate-900/50 rounded-lg"><p className="text-xs text-slate-400 mb-1">Confidence</p><p className={`text-sm font-semibold ${r.explanation.confidence==='high'?'text-emerald-400':'text-orange-400'}`}>{r.explanation.confidence.charAt(0).toUpperCase()+r.explanation.confidence.slice(1)}</p></div>
          </div>
        </div>
      </div>
    </div>

    <DashboardCard title="Decision Explanation"><div className="space-y-4">
      {r.explanation.sections.map((s, i) => { const Icon = icons[s.title]||Zap; const c = colors[s.title]||'cyan'; return (
        <div key={i} className="p-4 bg-slate-800/30 rounded-lg border border-slate-700/50"><div className="flex items-start space-x-4">
          <div className={`w-10 h-10 bg-gradient-to-br from-${c}-500 to-${c}-600 rounded-lg flex items-center justify-center flex-shrink-0`}><Icon className="w-5 h-5 text-white"/></div>
          <div className="flex-1"><h3 className="text-sm font-semibold text-white mb-2">{s.title}</h3><p className="text-sm text-slate-400 leading-relaxed">{s.content}</p></div>
        </div></div>);
      })}
    </div></DashboardCard>

    <DashboardCard title="Agent Contributions"><div className="grid grid-cols-2 gap-4">
      {[
        {agent:'Geospatial',contrib:`Steiner tree: ${r.route.route_length_km} km`,metric:r.route.total_edges>0?'Complete':'Fallback'},
        {agent:'Cost Estimation',contrib:`BOQ: ${r.cost.terrain_type} terrain`,metric:formatINR(r.cost.total_cost)},
        {agent:'Risk Prediction',contrib:`${r.risk.risks.length} factors`,metric:`${(r.risk.overall_risk_score*100).toFixed(0)}/100`},
        {agent:'Scenario Sim',contrib:`${r.scenarios.total_generated} scenarios`,metric:r.scenarios.recommended},
        {agent:'TOPSIS',contrib:`Priority: ${r.decision.priority}`,metric:`Score: ${((rec.topsis_score||0)*100).toFixed(0)}`},
        {agent:'Explainability',contrib:`${r.explanation.sections.length} sections`,metric:`Conf: ${r.explanation.confidence}`},
      ].map((a,i)=>(<div key={i} className="p-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
        <div className="flex items-center justify-between mb-2"><h3 className="text-sm font-semibold text-white">{a.agent}</h3><div className="flex items-center space-x-1"><CheckCircle className="w-4 h-4 text-emerald-400"/><span className="text-xs font-semibold text-emerald-400">{a.metric}</span></div></div>
        <p className="text-xs text-slate-400">{a.contrib}</p></div>))}
    </div></DashboardCard>

    <div className="p-4 bg-slate-900/50 border border-slate-800/50 rounded-xl flex items-center justify-between">
      <span className="text-sm text-slate-400">Pipeline duration</span><span className="text-sm font-medium text-cyan-400">{r.pipeline_duration_seconds}s</span>
    </div>
  </div>);
}
