import DashboardCard from '../components/DashboardCard';
import BarChart from '../components/BarChart';
import {
  RefreshCw, Clock, Target, CheckCircle, IndianRupee, AlertTriangle,
  ArrowRight, Layers, DollarSign, Shield,
} from 'lucide-react';
import { usePlanningStore } from '../stores/planningStore';
import { useNavigate } from 'react-router-dom';
import { formatINR } from '../utils/formatINR';

export default function ScenarioSimulator() {
  const {
    currentResult: r,
    selectedPhaseScenarios,
    selectedCostScenario,
    togglePhaseScenario,
    setCostScenario,
  } = usePlanningStore();
  const navigate = useNavigate();

  const scenarios = r ? r.decision.all_rankings : [];
  const rec = r?.decision.recommended_scenario;

  const isPhaseSelected = (id: string) => selectedPhaseScenarios.some(s => s.id === id);
  const isCostSelected = (id: string) => selectedCostScenario?.id === id;

  // Comparison chart data
  const costCompare = scenarios.map(s => ({
    label: s.name.split(' ').slice(0, 2).join(' '),
    value: s.estimated_cost,
    color: s.rank === 1 ? '#06b6d4' : isPhaseSelected(s.id) ? '#10b981' : '#475569',
  }));
  const timeCompare = scenarios.map(s => ({
    label: s.name.split(' ').slice(0, 2).join(' '),
    value: s.estimated_months,
    color: s.rank === 1 ? '#06b6d4' : isPhaseSelected(s.id) ? '#10b981' : '#475569',
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Scenario Simulator</h1>
          <p className="text-slate-400">
            {r ? `${r.scenarios.total_generated} scenarios • Select 3 for Digital Twin, 1 for Cost Analysis` : 'What-if analysis and deployment strategy comparison'}
          </p>
        </div>
        <button
          onClick={() => navigate('/build-requests')}
          className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg hover:from-cyan-600 hover:to-blue-700 transition-all flex items-center space-x-2"
        >
          <RefreshCw className="w-5 h-5" />
          <span>{r ? 'New Analysis' : 'Run Scenarios'}</span>
        </button>
      </div>

      {!r && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-12 text-center">
          <Target className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No scenarios yet</h3>
          <button onClick={() => navigate('/build-requests')} className="px-6 py-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/20 transition-all">
            Go to Build Requests
          </button>
        </div>
      )}

      {r && rec && (
        <>
          {/* Selection Status Bar */}
          <div className="flex items-center justify-between p-4 bg-slate-900/50 border border-slate-800/50 rounded-xl">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-slate-300">
                  Digital Twin Phases: <span className="font-semibold text-emerald-400">{selectedPhaseScenarios.length}/3</span>
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <DollarSign className="w-4 h-4 text-cyan-400" />
                <span className="text-sm text-slate-300">
                  Cost Deep-dive: <span className="font-semibold text-cyan-400">{selectedCostScenario?.name || 'None'}</span>
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {selectedPhaseScenarios.length === 3 && (
                <button
                  onClick={() => navigate('/digital-twin')}
                  className="flex items-center space-x-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/30 text-sm transition-all"
                >
                  <span>Open Digital Twin</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
              {selectedCostScenario && (
                <button
                  onClick={() => navigate('/cost-intelligence')}
                  className="flex items-center space-x-2 px-4 py-2 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/30 text-sm transition-all"
                >
                  <span>Open Cost Analysis</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* AI Recommended */}
          <DashboardCard title="AI Recommended Scenario">
            <div className="p-4 bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border border-cyan-500/20 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-cyan-400" />
                  <span className="text-sm font-semibold text-white">{rec.name}</span>
                  <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded-full text-xs font-bold">
                    TOPSIS: {((rec.topsis_score || 0) * 100).toFixed(0)}
                  </span>
                </div>
                <span className="px-3 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full text-xs font-semibold">
                  Recommended
                </span>
              </div>
              <p className="text-sm text-slate-400 mb-4">{rec.description}</p>
              <div className="grid grid-cols-5 gap-3">
                <div className="text-center p-2 bg-slate-900/50 rounded-lg">
                  <p className="text-lg font-bold text-white">{formatINR(rec.estimated_cost)}</p>
                  <p className="text-xs text-slate-400">Cost</p>
                </div>
                <div className="text-center p-2 bg-slate-900/50 rounded-lg">
                  <p className="text-lg font-bold text-white">{rec.estimated_months}mo</p>
                  <p className="text-xs text-slate-400">Timeline</p>
                </div>
                <div className="text-center p-2 bg-slate-900/50 rounded-lg">
                  <p className="text-lg font-bold text-white">{rec.coverage_percent}%</p>
                  <p className="text-xs text-slate-400">Coverage</p>
                </div>
                <div className="text-center p-2 bg-slate-900/50 rounded-lg">
                  <p className="text-lg font-bold text-white">{rec.premises_connected.toLocaleString('en-IN')}</p>
                  <p className="text-xs text-slate-400">Premises</p>
                </div>
                <div className="text-center p-2 bg-slate-900/50 rounded-lg">
                  <p className="text-lg font-bold text-white">{formatINR(rec.cost_per_premise)}</p>
                  <p className="text-xs text-slate-400">Per Premise</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-3">{r.decision.reasoning}</p>
            </div>
          </DashboardCard>

          {/* Detailed Comparison Table */}
          <DashboardCard title="Detailed Scenario Comparison — Select 3 for Digital Twin, 1 for Cost">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400">Scenario</th>
                    <th className="text-right py-3 px-3 text-xs font-semibold text-slate-400">Cost</th>
                    <th className="text-right py-3 px-3 text-xs font-semibold text-slate-400">Per Premise</th>
                    <th className="text-center py-3 px-3 text-xs font-semibold text-slate-400">Time</th>
                    <th className="text-center py-3 px-3 text-xs font-semibold text-slate-400">Coverage</th>
                    <th className="text-center py-3 px-3 text-xs font-semibold text-slate-400">Risk</th>
                    <th className="text-center py-3 px-3 text-xs font-semibold text-slate-400">Budget</th>
                    <th className="text-center py-3 px-3 text-xs font-semibold text-slate-400">Score</th>
                    <th className="text-center py-3 px-3 text-xs font-semibold text-emerald-400">Twin</th>
                    <th className="text-center py-3 px-3 text-xs font-semibold text-cyan-400">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map((s) => {
                    const phaseOn = isPhaseSelected(s.id);
                    const costOn = isCostSelected(s.id);
                    return (
                      <tr key={s.id} className={`border-b border-slate-800/50 transition-colors ${
                        s.rank === 1 ? 'bg-cyan-500/5' : phaseOn ? 'bg-emerald-500/5' : 'hover:bg-slate-800/30'
                      }`}>
                        <td className="py-3 px-3">
                          <div className="flex items-center space-x-2">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              s.rank === 1 ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-700 text-slate-400'
                            }`}>{s.rank}</span>
                            <div>
                              <div className="flex items-center space-x-1.5">
                                <span className="text-sm font-medium text-white">{s.name}</span>
                                {s.rank === 1 && <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 rounded text-[10px] font-bold">REC</span>}
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5 max-w-[200px]">{s.description}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className={`text-sm font-semibold ${s.within_budget ? 'text-emerald-400' : 'text-red-400'}`}>{formatINR(s.estimated_cost)}</span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className="text-sm text-slate-300">{formatINR(s.cost_per_premise)}</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="text-sm text-slate-300">{s.estimated_months}mo</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="text-sm text-slate-300">{s.coverage_percent}%</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            s.risk_tolerance === 'low' ? 'bg-emerald-500/10 text-emerald-400' :
                            s.risk_tolerance === 'medium' ? 'bg-orange-500/10 text-orange-400' :
                            'bg-red-500/10 text-red-400'
                          }`}>{s.risk_tolerance}</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {s.within_budget
                            ? <CheckCircle className="w-4 h-4 text-emerald-400 mx-auto" />
                            : <AlertTriangle className="w-4 h-4 text-red-400 mx-auto" />}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            <div className="w-10 bg-slate-700/50 rounded-full h-1.5 overflow-hidden">
                              <div className={`h-full rounded-full ${s.rank === 1 ? 'bg-cyan-500' : 'bg-slate-500'}`}
                                style={{ width: `${(s.topsis_score || 0) * 100}%` }} />
                            </div>
                            <span className="text-xs font-mono text-slate-400">{((s.topsis_score || 0) * 100).toFixed(0)}</span>
                          </div>
                        </td>
                        {/* Digital Twin selection */}
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => togglePhaseScenario(s)}
                            className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${
                              phaseOn
                                ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                                : selectedPhaseScenarios.length >= 3
                                  ? 'border-slate-700 text-slate-700 cursor-not-allowed'
                                  : 'border-slate-600 text-slate-600 hover:border-emerald-500'
                            }`}
                            disabled={!phaseOn && selectedPhaseScenarios.length >= 3}
                            title={phaseOn ? 'Remove from Digital Twin' : selectedPhaseScenarios.length >= 3 ? 'Deselect one first' : 'Add to Digital Twin'}
                          >
                            {phaseOn && <CheckCircle className="w-4 h-4" />}
                          </button>
                        </td>
                        {/* Cost Intelligence selection */}
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => setCostScenario(s)}
                            className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
                              costOn
                                ? 'border-cyan-500 bg-cyan-500/20 text-cyan-400'
                                : 'border-slate-600 text-slate-600 hover:border-cyan-500'
                            }`}
                            title="Select for Cost Analysis"
                          >
                            {costOn && <IndianRupee className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Selection summary */}
            <div className="mt-4 p-3 bg-slate-800/30 rounded-lg flex items-center justify-between">
              <div className="flex items-center space-x-4 text-xs text-slate-500">
                <span>Click <span className="text-emerald-400">green checkbox</span> to select 3 phases for Digital Twin</span>
                <span>•</span>
                <span>Click <span className="text-cyan-400">blue circle</span> to pick 1 scenario for Cost breakdown</span>
              </div>
              <div className="flex items-center space-x-2">
                {selectedPhaseScenarios.map((s, i) => (
                  <span key={s.id} className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded text-xs">
                    P{i + 1}: {s.name.split(' ')[0]}
                  </span>
                ))}
              </div>
            </div>
          </DashboardCard>

          {/* Visual Comparisons */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DashboardCard title="Cost Comparison">
              <BarChart data={costCompare} height={220} />
              <p className="text-xs text-slate-500 mt-2 text-center">Cyan = recommended • Green = selected for Digital Twin</p>
            </DashboardCard>

            <DashboardCard title="Timeline Comparison (months)">
              <BarChart data={timeCompare} height={220} />
            </DashboardCard>
          </div>

          {/* Decision Weights */}
          <DashboardCard title="Decision Weights & Reasoning">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                {Object.entries(r.decision.decision_weights).map(([k, w]) => (
                  <div key={k}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-slate-300 capitalize">{k}</span>
                      <span className="text-sm font-semibold text-cyan-400">{(w * 100).toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full" style={{ width: `${w * 100}%` }} />
                    </div>
                  </div>
                ))}
                <p className="text-xs text-slate-500 mt-2">Priority: {r.decision.priority.replace(/-/g, ' ')}</p>
              </div>
              <div className="p-4 bg-slate-800/30 rounded-lg">
                <h4 className="text-sm font-semibold text-white mb-2">AI Reasoning</h4>
                <p className="text-sm text-slate-400 leading-relaxed">{r.decision.reasoning}</p>
              </div>
            </div>
          </DashboardCard>
        </>
      )}
    </div>
  );
}
