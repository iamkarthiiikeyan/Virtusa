import { useState, useMemo } from 'react';
import DashboardCard from '../components/DashboardCard';
import { Radio, Zap, AlertTriangle, CheckCircle, ArrowRight, Settings2 } from 'lucide-react';
import { usePlanningStore } from '../stores/planningStore';
import { useNavigate } from 'react-router-dom';

// ITU-T G.984 GPON standard values
const DEFAULTS = {
  txPower: 5.0,       // OLT transmit power (dBm) — Class B+
  rxSensitivity: -28,  // ONT receiver sensitivity (dBm)
  fiberLoss: 0.35,     // dB/km at 1310nm
  spliceLoss: 0.1,     // dB per splice
  connectorLoss: 0.5,  // dB per connector pair
  splitter1x8: 10.5,   // dB loss for 1:8 splitter
  splitter1x32: 17.5,  // dB loss for 1:32 splitter
  systemMargin: 3.0,   // dB safety margin
};

export default function SignalLoss() {
  const { currentResult: r } = usePlanningStore();
  const navigate = useNavigate();

  // Get values from analysis or use defaults
  const routeKm = r?.route?.route_length_km || 5;
  const hw = r?.cost?.hardware_summary;
  const spliceCount = hw?.splice_closure_count || Math.ceil(routeKm * 2);

  // Editable parameters
  const [txPower, setTxPower] = useState(DEFAULTS.txPower);
  const [rxSensitivity, setRxSensitivity] = useState(DEFAULTS.rxSensitivity);
  const [fiberLength, setFiberLength] = useState(routeKm);
  const [fiberLoss, setFiberLoss] = useState(DEFAULTS.fiberLoss);
  const [splices, setSplices] = useState(spliceCount);
  const [spliceLoss, setSpliceLoss] = useState(DEFAULTS.spliceLoss);
  const [connectors, setConnectors] = useState(4); // OLT + splitter in + splitter out + ONT
  const [connectorLoss, setConnectorLoss] = useState(DEFAULTS.connectorLoss);
  const [useSplitter8, setUseSplitter8] = useState(true);
  const [useSplitter32, setUseSplitter32] = useState(true);
  const [systemMargin, setSystemMargin] = useState(DEFAULTS.systemMargin);

  const calc = useMemo(() => {
    const fiberTotal = fiberLength * fiberLoss;
    const spliceTotal = splices * spliceLoss;
    const connectorTotal = connectors * connectorLoss;
    const splitterTotal = (useSplitter8 ? DEFAULTS.splitter1x8 : 0) + (useSplitter32 ? DEFAULTS.splitter1x32 : 0);

    const totalLoss = fiberTotal + spliceTotal + connectorTotal + splitterTotal;
    const availableBudget = txPower - rxSensitivity;
    const remainingMargin = availableBudget - totalLoss;
    const pass = remainingMargin >= systemMargin;
    const maxReach = availableBudget > splitterTotal ? (availableBudget - splitterTotal - spliceTotal - connectorTotal - systemMargin) / Math.max(fiberLoss, 0.01) : 0;

    return {
      fiberTotal: fiberTotal.toFixed(2),
      spliceTotal: spliceTotal.toFixed(2),
      connectorTotal: connectorTotal.toFixed(2),
      splitterTotal: splitterTotal.toFixed(1),
      totalLoss: totalLoss.toFixed(2),
      availableBudget: availableBudget.toFixed(1),
      remainingMargin: remainingMargin.toFixed(2),
      rxPower: (txPower - totalLoss).toFixed(2),
      pass,
      maxReach: maxReach.toFixed(1),
    };
  }, [txPower, rxSensitivity, fiberLength, fiberLoss, splices, spliceLoss, connectors, connectorLoss, useSplitter8, useSplitter32, systemMargin]);

  const lossBreakdown = [
    { label: 'Fiber attenuation', value: parseFloat(calc.fiberTotal), detail: `${fiberLength} km × ${fiberLoss} dB/km`, color: 'cyan' },
    { label: 'Splice loss', value: parseFloat(calc.spliceTotal), detail: `${splices} × ${spliceLoss} dB`, color: 'purple' },
    { label: 'Connector loss', value: parseFloat(calc.connectorTotal), detail: `${connectors} × ${connectorLoss} dB`, color: 'amber' },
    { label: 'Splitter loss', value: parseFloat(calc.splitterTotal), detail: `${useSplitter8 ? '1:8' : ''}${useSplitter8 && useSplitter32 ? ' + ' : ''}${useSplitter32 ? '1:32' : ''}`, color: 'red' },
  ];
  const totalLossNum = parseFloat(calc.totalLoss);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Optical Power Budget</h1>
        <p className="text-slate-400">GPON signal loss calculator — ITU-T G.984 compliant</p>
      </div>

      {/* Pass/Fail indicator */}
      <div className={`p-4 rounded-xl border flex items-center justify-between ${calc.pass ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
        <div className="flex items-center space-x-3">
          {calc.pass ? <CheckCircle className="w-6 h-6 text-emerald-400" /> : <AlertTriangle className="w-6 h-6 text-red-400" />}
          <div>
            <p className={`text-lg font-bold ${calc.pass ? 'text-emerald-400' : 'text-red-400'}`}>{calc.pass ? 'LINK BUDGET PASS' : 'LINK BUDGET FAIL'}</p>
            <p className="text-sm text-slate-400">Remaining margin: {calc.remainingMargin} dB (need {systemMargin} dB minimum) • Max reach: {calc.maxReach} km</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white">{calc.totalLoss} dB</p>
          <p className="text-xs text-slate-400">Total loss</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Signal path visualization */}
        <div className="lg:col-span-2 space-y-6">
          {/* Power level diagram */}
          <DashboardCard title="Signal Path">
            <div className="space-y-3">
              {/* TX Power bar */}
              <div className="flex items-center space-x-3">
                <span className="text-xs text-slate-400 w-20 text-right">TX Power</span>
                <div className="flex-1 h-8 bg-slate-800/50 rounded-lg overflow-hidden relative">
                  <div className="h-full bg-gradient-to-r from-cyan-500/60 to-cyan-500/30 rounded-lg" style={{ width: '100%' }} />
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white">{txPower} dBm</span>
                </div>
              </div>

              {/* Loss bars */}
              {lossBreakdown.map((item, i) => {
                const pct = (item.value / totalLossNum) * 100;
                return (
                  <div key={i} className="flex items-center space-x-3">
                    <span className="text-xs text-slate-400 w-20 text-right">{item.label}</span>
                    <div className="flex-1 h-6 bg-slate-800/50 rounded-lg overflow-hidden relative">
                      <div className={`h-full bg-${item.color}-500/40 rounded-lg`} style={{ width: `${Math.max(pct, 2)}%` }} />
                      <span className="absolute inset-0 flex items-center px-3 text-xs text-slate-300">{item.value.toFixed(2)} dB — {item.detail}</span>
                    </div>
                  </div>
                );
              })}

              {/* RX Power bar */}
              <div className="flex items-center space-x-3">
                <span className="text-xs text-slate-400 w-20 text-right">RX Power</span>
                <div className="flex-1 h-8 bg-slate-800/50 rounded-lg overflow-hidden relative">
                  <div className={`h-full rounded-lg ${calc.pass ? 'bg-gradient-to-r from-emerald-500/60 to-emerald-500/30' : 'bg-gradient-to-r from-red-500/60 to-red-500/30'}`}
                    style={{ width: `${Math.max(((parseFloat(calc.rxPower) - rxSensitivity) / (txPower - rxSensitivity)) * 100, 5)}%` }} />
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white">{calc.rxPower} dBm</span>
                </div>
              </div>

              {/* Sensitivity line */}
              <div className="flex items-center space-x-3">
                <span className="text-xs text-slate-400 w-20 text-right">Sensitivity</span>
                <div className="flex-1 h-4 relative">
                  <div className="absolute inset-x-0 top-1/2 h-px bg-red-500/50 border-dashed" />
                  <span className="absolute right-0 -top-1 text-xs text-red-400">{rxSensitivity} dBm</span>
                </div>
              </div>
            </div>

            {/* Summary metrics */}
            <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800/50">
              <div className="text-center"><p className="text-xs text-slate-500">Budget</p><p className="text-sm font-bold text-white">{calc.availableBudget} dB</p></div>
              <div className="text-center"><p className="text-xs text-slate-500">Total Loss</p><p className="text-sm font-bold text-red-400">{calc.totalLoss} dB</p></div>
              <div className="text-center"><p className="text-xs text-slate-500">Margin</p><p className={`text-sm font-bold ${calc.pass ? 'text-emerald-400' : 'text-red-400'}`}>{calc.remainingMargin} dB</p></div>
              <div className="text-center"><p className="text-xs text-slate-500">Max Reach</p><p className="text-sm font-bold text-cyan-400">{calc.maxReach} km</p></div>
            </div>
          </DashboardCard>

          {/* Loss pie breakdown */}
          <DashboardCard title="Loss Distribution">
            <div className="flex items-center space-x-6">
              {lossBreakdown.map((item, i) => (
                <div key={i} className="flex-1 text-center">
                  <div className={`w-full h-3 bg-slate-800 rounded-full overflow-hidden mb-2`}>
                    <div className={`h-full bg-${item.color}-500 rounded-full`} style={{ width: `${(item.value / totalLossNum) * 100}%` }} />
                  </div>
                  <p className="text-xs text-slate-400">{item.label}</p>
                  <p className={`text-sm font-bold text-${item.color}-400`}>{item.value.toFixed(2)} dB</p>
                  <p className="text-xs text-slate-500">{((item.value / totalLossNum) * 100).toFixed(0)}%</p>
                </div>
              ))}
            </div>
          </DashboardCard>
        </div>

        {/* Right: Parameters */}
        <div>
          <DashboardCard title="Parameters">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1"><span className="text-xs text-slate-400">OLT TX Power</span><span className="text-xs text-cyan-400">{txPower} dBm</span></div>
                <input type="range" min="1" max="7" step="0.5" value={txPower} onChange={e => setTxPower(Number(e.target.value))} className="w-full" />
              </div>
              <div>
                <div className="flex justify-between mb-1"><span className="text-xs text-slate-400">ONT RX Sensitivity</span><span className="text-xs text-cyan-400">{rxSensitivity} dBm</span></div>
                <input type="range" min="-32" max="-20" step="1" value={rxSensitivity} onChange={e => setRxSensitivity(Number(e.target.value))} className="w-full" />
              </div>
              <div>
                <div className="flex justify-between mb-1"><span className="text-xs text-slate-400">Fiber Length</span><span className="text-xs text-cyan-400">{fiberLength} km</span></div>
                <input type="range" min="0.1" max="20" step="0.1" value={fiberLength} onChange={e => setFiberLength(Number(e.target.value))} className="w-full" />
              </div>
              <div>
                <div className="flex justify-between mb-1"><span className="text-xs text-slate-400">Fiber Loss</span><span className="text-xs text-cyan-400">{fiberLoss} dB/km</span></div>
                <input type="range" min="0.2" max="0.5" step="0.01" value={fiberLoss} onChange={e => setFiberLoss(Number(e.target.value))} className="w-full" />
              </div>
              <div>
                <div className="flex justify-between mb-1"><span className="text-xs text-slate-400">Splice Points</span><span className="text-xs text-cyan-400">{splices}</span></div>
                <input type="range" min="0" max="30" step="1" value={splices} onChange={e => setSplices(Number(e.target.value))} className="w-full" />
              </div>
              <div>
                <div className="flex justify-between mb-1"><span className="text-xs text-slate-400">Connectors</span><span className="text-xs text-cyan-400">{connectors}</span></div>
                <input type="range" min="2" max="10" step="1" value={connectors} onChange={e => setConnectors(Number(e.target.value))} className="w-full" />
              </div>
              <div>
                <div className="flex justify-between mb-1"><span className="text-xs text-slate-400">System Margin</span><span className="text-xs text-cyan-400">{systemMargin} dB</span></div>
                <input type="range" min="1" max="5" step="0.5" value={systemMargin} onChange={e => setSystemMargin(Number(e.target.value))} className="w-full" />
              </div>

              {/* Splitter toggles */}
              <div className="space-y-2 pt-2 border-t border-slate-800/50">
                <p className="text-xs text-slate-500 font-medium">Splitter Configuration</p>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs text-slate-300">Primary 1:8 (10.5 dB)</span>
                  <input type="checkbox" checked={useSplitter8} onChange={e => setUseSplitter8(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-cyan-500 focus:ring-cyan-500" />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs text-slate-300">Secondary 1:32 (17.5 dB)</span>
                  <input type="checkbox" checked={useSplitter32} onChange={e => setUseSplitter32(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-cyan-500 focus:ring-cyan-500" />
                </label>
              </div>

              {/* Reset */}
              <button onClick={() => {
                setTxPower(DEFAULTS.txPower); setRxSensitivity(DEFAULTS.rxSensitivity);
                setFiberLength(routeKm); setFiberLoss(DEFAULTS.fiberLoss);
                setSplices(spliceCount); setSpliceLoss(DEFAULTS.spliceLoss);
                setConnectors(4); setConnectorLoss(DEFAULTS.connectorLoss);
                setUseSplitter8(true); setUseSplitter32(true); setSystemMargin(DEFAULTS.systemMargin);
              }} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-xs hover:bg-slate-700">
                Reset to Defaults
              </button>
            </div>
          </DashboardCard>
        </div>
      </div>
    </div>
  );
}
