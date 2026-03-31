import { useState, useMemo } from 'react';
import DashboardCard from '../components/DashboardCard';
import {
  IndianRupee, Package, Cpu, Wrench, ArrowLeft, CheckCircle,
  TrendingUp, Building2, Zap, Pencil, RotateCcw, Save,
} from 'lucide-react';
import { usePlanningStore } from '../stores/planningStore';
import { useNavigate } from 'react-router-dom';

function formatINR(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) return '₹0';
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${value.toLocaleString('en-IN')}`;
}

interface EditableItem {
  item_name: string;
  quantity: number;
  unit: string;
  original_price: number;
  edited_price: number;
  category: string;
  note: string;
  model?: string;
  isEdited: boolean;
}

export default function CostIntelligence() {
  const { currentResult: r, selectedCostScenario } = usePlanningStore();
  const navigate = useNavigate();
  const [editMode, setEditMode] = useState(false);
  const scenario = selectedCostScenario;

  // Build editable BOQ from result — handle both field name variants
  const [editableBoq, setEditableBoq] = useState<EditableItem[]>([]);
  const [initialized, setInitialized] = useState<string | null>(null);

  // Compute scenario cost multiplier
  // Scenario estimated_cost = base BOQ total × cost_mult
  // So cost_mult = scenario.estimated_cost / pipeline total_cost
  const scenarioMultiplier = useMemo(() => {
    if (!scenario || !r) return 1.0;
    const pipelineTotal = r.cost.total_cost;
    if (!pipelineTotal || pipelineTotal === 0) return 1.0;
    return scenario.estimated_cost / pipelineTotal;
  }, [scenario, r]);

  // Re-initialize when scenario changes
  const scenarioId = scenario?.id || null;
  if (r?.cost.boq && initialized !== scenarioId) {
    const items: EditableItem[] = r.cost.boq.map((item: any) => {
      const basePrice = item.unit_price_inr || item.unit_price || 0;
      const scaledPrice = Math.round(basePrice * scenarioMultiplier);
      return {
        item_name: item.item_name || '',
        quantity: item.quantity || 0,
        unit: item.unit || '',
        original_price: scaledPrice,
        edited_price: scaledPrice,
        category: item.category || 'Other',
        note: item.note || '',
        model: item.model || '',
        isEdited: false,
      };
    });
    setEditableBoq(items);
    setInitialized(scenarioId);
  }

  // Recalculate totals from edited prices
  const calculated = useMemo(() => {
    if (!r || editableBoq.length === 0) return null;

    const capexSub = editableBoq.reduce((s, it) => s + it.edited_price * it.quantity, 0);
    const contingency = capexSub * (r.cost.contingency_percent || 12) / 100;
    const gst = capexSub * (r.cost.gst_percent || 18) / 100;
    const timelineMult = r.cost.timeline_multiplier || 1.0;
    const totalCapex = Math.round((capexSub + contingency + gst) * timelineMult);
    const premises = r.route?.premises_connected || 1;

    // Group by category
    const groups: Record<string, EditableItem[]> = {};
    for (const item of editableBoq) {
      const cat = item.category || 'Other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }

    // Category subtotals
    const catTotals: Record<string, number> = {};
    for (const [cat, items] of Object.entries(groups)) {
      catTotals[cat] = items.reduce((s, it) => s + it.edited_price * it.quantity, 0);
    }

    const editedCount = editableBoq.filter(it => it.isEdited).length;
    const savingsVsOriginal = r.cost.total_cost - totalCapex;

    return {
      capexSub, contingency, gst, totalCapex, timelineMult, premises,
      groups, catTotals, editedCount, savingsVsOriginal,
      costPerPremise: Math.round(totalCapex / premises),
      costPerKm: Math.round(totalCapex / Math.max(r.route?.route_length_km || 1, 0.1)),
      annualOpex: r.cost.annual_opex || 0,
    };
  }, [editableBoq, r]);

  const updatePrice = (index: number, newPrice: number) => {
    setEditableBoq(prev => prev.map((item, i) => {
      if (i !== index) return item;
      return { ...item, edited_price: newPrice, isEdited: newPrice !== item.original_price };
    }));
  };

  const resetAllPrices = () => {
    setEditableBoq(prev => prev.map(item => ({
      ...item, edited_price: item.original_price, isEdited: false,
    })));
  };

  const resetItemPrice = (index: number) => {
    setEditableBoq(prev => prev.map((item, i) => {
      if (i !== index) return item;
      return { ...item, edited_price: item.original_price, isEdited: false };
    }));
  };



  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Cost Intelligence</h1>
          <p className="text-slate-400">
            {scenario
              ? `BOQ for "${scenario.name}" • ${(r?.route?.premises_connected || 0).toLocaleString('en-IN')} premises • All prices in ₹`
              : 'Select a scenario for detailed cost breakdown'}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {r && (
            <button
              onClick={() => { setEditMode(!editMode); }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${editMode
                ? 'bg-cyan-500 text-white'
                : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
                }`}
            >
              <Pencil className="w-4 h-4" />
              <span>{editMode ? 'Editing Prices' : 'Edit Prices'}</span>
            </button>
          )}
          {editMode && calculated && calculated.editedCount > 0 && (
            <button
              onClick={resetAllPrices}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-800 text-orange-400 border border-slate-700 rounded-lg hover:bg-slate-700 text-sm transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset All</span>
            </button>
          )}
          {!r && (
            <button
              onClick={() => navigate('/build-requests')}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg transition-all flex items-center space-x-2"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Run Analysis</span>
            </button>
          )}
        </div>
      </div>

      {/* Selected scenario info */}
      {scenario && (
        <div className="bg-gradient-to-r from-cyan-500/10 to-blue-600/10 border border-cyan-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-5 h-5 text-cyan-400" />
              <div>
                <h3 className="text-sm font-semibold text-white">{scenario.name}</h3>
                <p className="text-xs text-slate-400">{scenario.description}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4 text-xs">
              <div className="text-center">
                <p className="font-semibold text-emerald-400">{formatINR(scenario.estimated_cost)}</p>
                <p className="text-slate-500">Original</p>
              </div>
              {calculated && calculated.editedCount > 0 && (
                <div className="text-center">
                  <p className={`font-semibold ${calculated.savingsVsOriginal > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatINR(calculated.totalCapex)}
                  </p>
                  <p className="text-slate-500">Adjusted</p>
                </div>
              )}
              <button
                onClick={() => navigate('/scenario-simulator')}
                className="px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-700 text-xs transition-all"
              >
                Change
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No data states */}
      {!r && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-12 text-center">
          <IndianRupee className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No cost data available</h3>
          <button onClick={() => navigate('/build-requests')} className="px-6 py-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/20 transition-all">
            Go to Build Requests
          </button>
        </div>
      )}

      {r && calculated && (
        <>
          {/* Edit mode banner */}
          {editMode && (
            <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Pencil className="w-4 h-4 text-cyan-400" />
                <span className="text-sm text-cyan-400">
                  Click any unit price to edit • {calculated.editedCount} items modified
                </span>
              </div>
              {calculated.editedCount > 0 && (
                <span className={`text-sm font-semibold ${calculated.savingsVsOriginal > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {calculated.savingsVsOriginal > 0 ? 'Saving' : 'Increase'}: {formatINR(Math.abs(calculated.savingsVsOriginal))}
                </span>
              )}
            </div>
          )}

          {/* Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: IndianRupee, label: 'Total CAPEX', value: formatINR(calculated.totalCapex), sub: calculated.editedCount > 0 ? `${calculated.editedCount} prices adjusted` : 'Default catalog prices', color: 'emerald' },
              { icon: Package, label: 'Cost per Premise', value: formatINR(calculated.costPerPremise), sub: `${calculated.premises.toLocaleString('en-IN')} premises`, color: 'cyan' },
              { icon: Cpu, label: 'Hardware Items', value: `${r.cost.hardware_summary?.total_hardware_items || 0}`, sub: `${editableBoq.length} BOQ lines`, color: 'purple' },
              { icon: Wrench, label: 'Deployment', value: (r.cost.deployment_method || 'underground').charAt(0).toUpperCase() + (r.cost.deployment_method || '').slice(1), sub: `${r.cost.terrain_type} terrain`, color: 'orange' },
            ].map((m, i) => (
              <div key={i} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
                <div className="flex items-center space-x-3 mb-2">
                  <div className={`w-10 h-10 rounded-lg bg-${m.color}-500/10 flex items-center justify-center`}>
                    <m.icon className={`w-5 h-5 text-${m.color}-400`} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">{m.label}</p>
                    <p className="text-lg font-bold text-white">{m.value}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500">{m.sub}</p>
              </div>
            ))}
          </div>

          {/* Cost Breakdown Summary */}
          <DashboardCard title="Cost Breakdown">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {Object.entries(calculated.catTotals).map(([key, value], i) => (
                <div key={i} className="p-3 bg-slate-800/30 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1 capitalize">{key.replace(/_/g, ' ')}</p>
                  <p className="text-sm font-semibold text-white">{formatINR(value)}</p>
                  <p className="text-xs text-slate-600">{(value / calculated.capexSub * 100).toFixed(1)}%</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-4 gap-4 p-3 bg-slate-800/20 rounded-lg">
              <div>
                <p className="text-xs text-slate-500">Subtotal</p>
                <p className="text-sm font-semibold text-white">{formatINR(calculated.capexSub)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Contingency ({r.cost.contingency_percent}%)</p>
                <p className="text-sm font-semibold text-orange-400">{formatINR(calculated.contingency)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">GST ({r.cost.gst_percent}%)</p>
                <p className="text-sm font-semibold text-orange-400">{formatINR(calculated.gst)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Annual OPEX</p>
                <p className="text-sm font-semibold text-purple-400">{formatINR(calculated.annualOpex)}</p>
              </div>
            </div>
          </DashboardCard>

          {/* Full BOQ Table with Editable Prices */}
          <DashboardCard title={`Bill of Quantities (BOQ)${editMode ? ' — Click unit price to edit' : ''}`}>
            {Object.entries(calculated.groups).map(([category, items]) => {
              // Find global index for each item
              let globalStartIdx = 0;
              for (const [cat, catItems] of Object.entries(calculated.groups)) {
                if (cat === category) break;
                globalStartIdx += catItems.length;
              }

              return (
                <div key={category} className="mb-6 last:mb-0">
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="w-1 h-5 bg-cyan-500 rounded-full" />
                    <h3 className="text-sm font-semibold text-white capitalize">
                      {category.replace(/_/g, ' ')}
                    </h3>
                    <span className="text-xs text-slate-500">
                      ({items.length} items • {formatINR(calculated.catTotals[category])})
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-800">
                          <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400">Item</th>
                          <th className="text-right py-2 px-3 text-xs font-semibold text-slate-400">Qty</th>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400">Unit</th>
                          <th className="text-right py-2 px-3 text-xs font-semibold text-slate-400">
                            Unit Price {editMode && <span className="text-cyan-400">(click to edit)</span>}
                          </th>
                          <th className="text-right py-2 px-3 text-xs font-semibold text-slate-400">Total</th>
                          {editMode && <th className="w-8"></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, j) => {
                          const globalIdx = globalStartIdx + j;
                          const lineTotal = item.edited_price * item.quantity;

                          return (
                            <tr
                              key={j}
                              className={`border-b border-slate-800/30 transition-colors ${item.isEdited ? 'bg-cyan-500/5' : 'hover:bg-slate-800/20'
                                }`}
                            >
                              <td className="py-2 px-3">
                                <span className="text-sm text-slate-200">{item.item_name}</span>
                                {item.model && (
                                  <span className="text-xs text-slate-500 ml-2">({item.model})</span>
                                )}
                                {item.isEdited && (
                                  <span className="text-xs text-cyan-400 ml-2">• edited</span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-right text-sm text-slate-300">
                                {item.quantity.toLocaleString('en-IN')}
                              </td>
                              <td className="py-2 px-3 text-sm text-slate-400">{item.unit}</td>
                              <td className="py-2 px-3 text-right">
                                {editMode ? (
                                  <div className="flex items-center justify-end space-x-1">
                                    <span className="text-xs text-slate-500">₹</span>
                                    <input
                                      type="number"
                                      value={item.edited_price}
                                      onChange={(e) => updatePrice(globalIdx, Number(e.target.value) || 0)}
                                      className={`w-24 bg-slate-800 border rounded px-2 py-1 text-right text-sm transition-all ${item.isEdited
                                        ? 'border-cyan-500 text-cyan-400'
                                        : 'border-slate-700 text-slate-300'
                                        }`}
                                    />
                                  </div>
                                ) : (
                                  <span className={`text-sm ${item.isEdited ? 'text-cyan-400 font-semibold' : 'text-slate-300'}`}>
                                    {formatINR(item.edited_price)}
                                    {item.isEdited && (
                                      <span className="text-xs text-slate-500 ml-1 line-through">
                                        {formatINR(item.original_price)}
                                      </span>
                                    )}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-right text-sm font-semibold text-emerald-400">
                                {formatINR(lineTotal)}
                              </td>
                              {editMode && (
                                <td className="py-2 px-1">
                                  {item.isEdited && (
                                    <button
                                      onClick={() => resetItemPrice(globalIdx)}
                                      className="p-1 text-slate-500 hover:text-orange-400 transition-colors"
                                      title="Reset to original"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                        <tr className="border-t border-slate-700">
                          <td colSpan={editMode ? 4 : 4} className="py-2 px-3 text-right text-xs font-semibold text-slate-400">
                            Category subtotal
                          </td>
                          <td className="py-2 px-3 text-right text-sm font-bold text-white">
                            {formatINR(items.reduce((s, it) => s + it.edited_price * it.quantity, 0))}
                          </td>
                          {editMode && <td></td>}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}

            {/* Grand total */}
            <div className="mt-4 p-4 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <IndianRupee className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm font-semibold text-white">
                    Grand Total (incl. {r.cost.contingency_percent}% contingency + {r.cost.gst_percent}% GST)
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold text-emerald-400">{formatINR(calculated.totalCapex)}</span>
                  {calculated.editedCount > 0 && (
                    <p className="text-xs text-slate-500">
                      Original: {formatINR(r.cost.total_cost)} •
                      <span className={calculated.savingsVsOriginal > 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {' '}{calculated.savingsVsOriginal > 0 ? 'Saved' : 'Added'} {formatINR(Math.abs(calculated.savingsVsOriginal))}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </DashboardCard>

          {/* Hardware Summary */}
          {r.cost.hardware_summary && (
            <DashboardCard title="Hardware Summary">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'OLT', value: r.cost.hardware_summary.olt_count, model: r.cost.hardware_summary.olt_model, icon: Building2 },
                  { label: 'ONT', value: r.cost.hardware_summary.ont_count, model: r.cost.hardware_summary.ont_model, icon: Cpu },
                  { label: 'Splitters 1:32', value: r.cost.hardware_summary.splitter_1x32_count, model: '', icon: Zap },
                  { label: 'Splitters 1:8', value: r.cost.hardware_summary.splitter_1x8_count, model: '', icon: Zap },
                  { label: 'FDB', value: r.cost.hardware_summary.fdb_count, model: '', icon: Package },
                  { label: 'Splice Closures', value: r.cost.hardware_summary.splice_closure_count, model: '', icon: Package },
                  { label: 'L3 Switches', value: r.cost.hardware_summary.l3_switch_count, model: '', icon: TrendingUp },
                  { label: 'Cabinets', value: r.cost.hardware_summary.cabinet_count, model: '', icon: Building2 },
                ].map((hw, i) => (
                  <div key={i} className="p-3 bg-slate-800/30 rounded-lg border border-slate-700/30">
                    <div className="flex items-center space-x-2 mb-1">
                      <hw.icon className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs text-slate-400">{hw.label}</span>
                    </div>
                    <p className="text-lg font-bold text-white">{(hw.value || 0).toLocaleString('en-IN')}</p>
                    {hw.model && <p className="text-xs text-slate-500">{hw.model}</p>}
                  </div>
                ))}
              </div>
            </DashboardCard>
          )}
        </>
      )}
    </div>
  );
}