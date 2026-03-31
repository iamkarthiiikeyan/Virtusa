import DashboardCard from '../components/DashboardCard';
import { AlertTriangle, Shield, FileText, Cloud, TrendingUp } from 'lucide-react';
import { usePlanningStore } from '../stores/planningStore';
import { useNavigate } from 'react-router-dom';

export default function RiskAnalytics() {
  const { currentResult: r } = usePlanningStore();
  const navigate = useNavigate();

  const topMetrics = r
    ? [
        { icon: AlertTriangle, label: 'High Risk Items', value: `${r.risk.risk_count.high}`, color: 'red' },
        { icon: Shield, label: 'Risk Score', value: `${(r.risk.overall_risk_score * 100).toFixed(0)}/100`, color: 'orange' },
        { icon: FileText, label: 'Total Risks', value: `${r.risk.risks.length}`, color: 'yellow' },
        { icon: Cloud, label: 'Overall Level', value: r.risk.overall_severity.charAt(0).toUpperCase() + r.risk.overall_severity.slice(1), color: 'cyan' },
      ]
    : [
        { icon: AlertTriangle, label: 'High Risk Zones', value: '--', color: 'red' },
        { icon: Shield, label: 'Risk Score', value: '--', color: 'orange' },
        { icon: FileText, label: 'Permit Delays', value: '--', color: 'yellow' },
        { icon: Cloud, label: 'Weather Impact', value: '--', color: 'cyan' },
      ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Risk Analytics</h1>
        <p className="text-slate-400">
          {r ? `Risk assessment for ${r.route.premises_connected.toLocaleString()} premises deployment` : 'Deployment risk assessment and mitigation strategies'}
        </p>
      </div>

      {!r && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-8 text-center">
          <Shield className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 mb-3">Run a planning analysis to see real risk data</p>
          <button onClick={() => navigate('/build-requests')} className="px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/20 transition-all text-sm">Go to Build Requests</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {topMetrics.map((metric, index) => (
          <div key={index} className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-6">
            <div className={`w-12 h-12 bg-gradient-to-br from-${metric.color}-500 to-${metric.color}-600 rounded-lg flex items-center justify-center mb-4`}>
              <metric.icon className="w-6 h-6 text-white" />
            </div>
            <p className="text-sm text-slate-400 mb-1">{metric.label}</p>
            <p className="text-2xl font-bold text-white">{metric.value}</p>
          </div>
        ))}
      </div>

      {r && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Risk Alerts */}
            <DashboardCard title="Risk Assessment Details">
              <div className="space-y-3">
                {r.risk.risks.map((risk, index) => (
                  <div key={index} className="p-4 bg-slate-800/30 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-all">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${
                          risk.severity === 'high' ? 'bg-red-500 animate-pulse' : risk.severity === 'medium' ? 'bg-orange-500' : 'bg-emerald-500'
                        }`} />
                        <h3 className="text-sm font-semibold text-white">
                          {risk.risk_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </h3>
                      </div>
                      <span className={`text-sm font-semibold ${
                        risk.severity === 'high' ? 'text-red-400' : risk.severity === 'medium' ? 'text-orange-400' : 'text-emerald-400'
                      }`}>{(risk.score * 100).toFixed(0)}%</span>
                    </div>
                    <p className="text-sm text-slate-400 mb-2">{risk.description}</p>
                    <div className="p-2 bg-slate-900/50 rounded">
                      <p className="text-xs text-slate-500"><span className="text-slate-400 font-medium">Mitigation:</span> {risk.mitigation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </DashboardCard>

            {/* Risk Distribution */}
            <DashboardCard title="Risk Score Distribution">
              <div className="space-y-4">
                {r.risk.risks.map((risk, index) => (
                  <div key={index}>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-slate-300">
                        {risk.risk_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </span>
                      <span className="text-sm font-semibold text-slate-300">{(risk.score * 100).toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          risk.severity === 'high' ? 'bg-red-500' : risk.severity === 'medium' ? 'bg-orange-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${risk.score * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-slate-800">
                <h4 className="text-sm font-semibold text-white mb-3">Overall Risk Assessment</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Composite Risk Score</p>
                    <p className={`text-2xl font-bold ${
                      r.risk.overall_severity === 'high' ? 'text-red-400' : r.risk.overall_severity === 'medium' ? 'text-orange-400' : 'text-emerald-400'
                    }`}>{(r.risk.overall_risk_score * 100).toFixed(0)}/100</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 mb-1">Risk Level</p>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      r.risk.overall_severity === 'high' ? 'bg-red-500/10 text-red-400' :
                      r.risk.overall_severity === 'medium' ? 'bg-orange-500/10 text-orange-400' :
                      'bg-emerald-500/10 text-emerald-400'
                    }`}>{r.risk.overall_severity.charAt(0).toUpperCase() + r.risk.overall_severity.slice(1)}</span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="text-center p-2 bg-red-500/5 rounded-lg border border-red-500/10">
                    <p className="text-lg font-bold text-red-400">{r.risk.risk_count.high}</p>
                    <p className="text-xs text-slate-500">High</p>
                  </div>
                  <div className="text-center p-2 bg-orange-500/5 rounded-lg border border-orange-500/10">
                    <p className="text-lg font-bold text-orange-400">{r.risk.risk_count.medium}</p>
                    <p className="text-xs text-slate-500">Medium</p>
                  </div>
                  <div className="text-center p-2 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
                    <p className="text-lg font-bold text-emerald-400">{r.risk.risk_count.low}</p>
                    <p className="text-xs text-slate-500">Low</p>
                  </div>
                </div>
              </div>
            </DashboardCard>
          </div>
        </>
      )}
    </div>
  );
}
