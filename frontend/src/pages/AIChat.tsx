import { useState, useRef, useEffect } from 'react';
import DashboardCard from '../components/DashboardCard';
import { Brain, Send, Loader2, Sparkles, RotateCcw, ArrowRight, Zap } from 'lucide-react';
import { usePlanningStore } from '../stores/planningStore';
import { useNavigate } from 'react-router-dom';
import { formatINR } from '../utils/formatINR';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  actions?: { label: string; q: string }[];
}

function buildResultContext(r: any): string {
  if (!r) return '[No analysis loaded]';
  let ctx = `CURRENT ANALYSIS DATA:\n`;
  ctx += `Location: ${r.route?.strategy || 'N/A'}\n`;
  ctx += `Route: ${r.route?.route_length_km} km, ${r.route?.total_edges} edges, ${r.route?.premises_connected} premises\n`;
  ctx += `Total CAPEX: ₹${r.cost?.total_cost?.toLocaleString('en-IN')}\n`;
  ctx += `Cost/Premise: ₹${r.cost?.cost_per_premise?.toLocaleString('en-IN')}\n`;
  ctx += `Cost/km: ₹${r.cost?.cost_per_km?.toLocaleString('en-IN')}\n`;
  ctx += `Terrain: ${r.cost?.terrain_type}, Method: ${r.cost?.deployment_method}\n`;
  ctx += `Contingency: ${r.cost?.contingency_percent}%, GST: ${r.cost?.gst_percent}%\n`;
  ctx += `Annual OPEX: ₹${r.cost?.annual_opex?.toLocaleString('en-IN')}\n\n`;

  if (r.cost?.breakdown) {
    ctx += `COST BREAKDOWN:\n`;
    Object.entries(r.cost.breakdown).forEach(([k, v]) => {
      if (typeof v === 'number' && v > 0) ctx += `  ${k}: ₹${(v as number).toLocaleString('en-IN')}\n`;
    });
  }

  if (r.cost?.boq) {
    ctx += `\nBOQ (${r.cost.boq.length} items):\n`;
    r.cost.boq.forEach((item: any) => {
      ctx += `  ${item.item_name}: qty=${item.quantity} ${item.unit}, ₹${(item.unit_price_inr || item.unit_price || 0).toLocaleString('en-IN')}/unit, total=₹${(item.total_inr || item.total_price || 0).toLocaleString('en-IN')} [${item.category}]\n`;
    });
  }

  if (r.cost?.hardware_summary) {
    const hw = r.cost.hardware_summary;
    ctx += `\nHARDWARE: OLT=${hw.olt_count} (${hw.olt_model}), ONT=${hw.ont_count} (${hw.ont_model}), Splitter 1:32=${hw.splitter_1x32_count}, Splitter 1:8=${hw.splitter_1x8_count}, FDB=${hw.fdb_count}, Splice closures=${hw.splice_closure_count}\n`;
  }

  if (r.risk?.risks) {
    ctx += `\nRISK (overall: ${(r.risk.overall_risk_score * 100).toFixed(0)}/100, ${r.risk.overall_severity}):\n`;
    r.risk.risks.forEach((risk: any) => {
      ctx += `  ${risk.risk_type}: ${(risk.score * 100).toFixed(0)}% ${risk.severity} — ${risk.description}. Mitigation: ${risk.mitigation}\n`;
    });
  }

  if (r.decision?.all_rankings) {
    ctx += `\nSCENARIOS (ranked by TOPSIS):\n`;
    r.decision.all_rankings.forEach((s: any) => {
      ctx += `  #${s.rank} ${s.name}: ₹${s.estimated_cost?.toLocaleString('en-IN')}, ${s.estimated_months}mo, ${s.coverage_percent}% coverage, TOPSIS=${s.topsis_score?.toFixed(2)}${s.rank === 1 ? ' ★RECOMMENDED' : ''}\n`;
    });
    ctx += `Reasoning: ${r.decision.reasoning}\n`;
  }

  if (r.explanation?.sections) {
    ctx += `\nAI EXPLANATION:\n`;
    r.explanation.sections.forEach((s: any) => { ctx += `[${s.title}] ${s.content}\n`; });
  }

  if (r.route?.area_analysis) {
    const a = r.route.area_analysis;
    ctx += `\nAREA: ${a.area_sq_km} km², ${a.detected_buildings} buildings detected via ${a.building_source}\n`;
  }

  return ctx;
}

const SYSTEM = `You are an expert telecom network planning analyst embedded in the ATLAS platform. The user has run a fiber deployment analysis and wants to understand the results deeply.

You have access to their FULL analysis data (provided below). Answer questions with specific numbers from their data. Use ₹ for all costs. Be concise but precise.

You can:
- Explain why costs are high/low with specific line items
- Compare scenarios with actual numbers
- Suggest optimizations (e.g., "switch to aerial deployment to save ₹X on trenching")
- Calculate what-if scenarios (e.g., "if coverage drops to 80%, cost reduces by ~20%")
- Explain risk mitigations with context
- Recommend vendor alternatives
- Explain GPON architecture decisions
- Calculate ROI and payback periods

Always cite specific numbers from the data. Don't say "the data shows" — say the actual number.`;

export default function AIChat() {
  const { currentResult: r } = usePlanningStore();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Welcome message
  useEffect(() => {
    if (r && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: `I've loaded your analysis — ${r.route?.premises_connected?.toLocaleString('en-IN')} premises, ${formatINR(r.cost?.total_cost)} CAPEX, ${r.route?.route_length_km} km route. What would you like to understand?`,
        actions: [
          { label: 'Why is it this expensive?', q: 'Break down why the total cost is so high and which components cost the most' },
          { label: 'How to reduce cost?', q: 'What are the top 3 ways I could reduce the total CAPEX?' },
          { label: 'Compare scenarios', q: 'Compare all 5 scenarios and explain why the recommended one is best' },
          { label: 'Calculate ROI', q: 'If average revenue per premise is ₹500/month, what is the payback period?' },
        ],
      }]);
    }
  }, [r]);

  const sendMessage = async (override?: string) => {
    const msg = (override || input).trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setLoading(true);

    const context = buildResultContext(r);

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: SYSTEM + '\n\n' + context,
          messages: [
            ...messages.slice(-8).map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: msg },
          ],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const reply = data.content?.map((c: any) => c.text).join('') || 'Could not generate response.';
        setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: getLocalAnswer(msg, r) }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: getLocalAnswer(msg, r) }]);
    }
    setLoading(false);
  };

  if (!r) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-white mb-2">AI Analysis Chat</h1>
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-12 text-center">
          <Brain className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 mb-4">Run an analysis first to ask AI questions about your results</p>
          <button onClick={() => navigate('/build-requests')} className="px-6 py-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-lg">Go to Build Requests</button>
        </div>
      </div>
    );
  }

  const suggestedQuestions = [
    'What is the biggest cost driver?',
    'Is the risk score acceptable?',
    'What if I use aerial deployment?',
    'Explain the TOPSIS ranking',
    'What hardware could I downgrade to save money?',
    'Calculate 5-year TCO including OPEX',
    'Which risk needs immediate attention?',
    'What if I deploy in 2 phases instead?',
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">AI Analysis Chat</h1>
          <p className="text-slate-400">Ask Claude about your analysis — costs, risks, optimization, what-if scenarios</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 text-xs rounded-lg font-medium flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5" /><span>Powered by Claude</span>
          </span>
        </div>
      </div>

      {/* Quick data cards */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { l: 'CAPEX', v: formatINR(r.cost.total_cost), c: 'emerald' },
          { l: 'Route', v: `${r.route.route_length_km} km`, c: 'cyan' },
          { l: 'Premises', v: r.route.premises_connected.toLocaleString('en-IN'), c: 'purple' },
          { l: 'Risk', v: `${(r.risk.overall_risk_score * 100).toFixed(0)}/100`, c: 'orange' },
          { l: 'Recommended', v: r.decision.recommended_scenario?.name?.split(' ').slice(0, 2).join(' '), c: 'cyan' },
        ].map((m, i) => (
          <div key={i} className="bg-slate-900/50 border border-slate-800/50 rounded-lg p-3 text-center">
            <p className={`text-sm font-bold text-${m.c}-400`}>{m.v}</p>
            <p className="text-[10px] text-slate-500">{m.l}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Chat area */}
        <div className="lg:col-span-3">
          <DashboardCard title="">
            <div className="h-[450px] overflow-y-auto space-y-3 mb-4 pr-2">
              {messages.map((msg, i) => (
                <div key={i}>
                  <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] px-4 py-3 rounded-xl text-sm leading-relaxed whitespace-pre-line ${
                      msg.role === 'user' ? 'bg-cyan-500/15 text-cyan-100 rounded-br-sm' : 'bg-slate-800/50 text-slate-300 rounded-bl-sm'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                  {msg.actions && (
                    <div className="flex flex-wrap gap-1.5 mt-2 ml-1">
                      {msg.actions.map((a, j) => (
                        <button key={j} onClick={() => sendMessage(a.q)}
                          className="px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-xs hover:bg-slate-700 flex items-center space-x-1">
                          <ArrowRight className="w-3 h-3" /><span>{a.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-slate-800/50 px-4 py-3 rounded-xl rounded-bl-sm flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-xs text-slate-500">Analyzing your data...</span>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            <div className="flex items-center space-x-2 pt-3 border-t border-slate-800">
              <input ref={inputRef} type="text" value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
                placeholder="Ask about costs, risks, optimization..."
                className="flex-1 bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
              <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
                className="p-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50 transition-all">
                <Send className="w-4 h-4" />
              </button>
              <button onClick={() => setMessages([])} className="p-3 text-slate-400 hover:text-white bg-slate-800 border border-slate-700 rounded-lg">
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </DashboardCard>
        </div>

        {/* Suggested questions */}
        <div>
          <DashboardCard title="Try asking">
            <div className="space-y-2">
              {suggestedQuestions.map((q, i) => (
                <button key={i} onClick={() => sendMessage(q)}
                  className="w-full text-left px-3 py-2.5 bg-slate-800/30 border border-slate-700/30 rounded-lg text-xs text-slate-300 hover:bg-slate-800/50 hover:text-white transition-all">
                  {q}
                </button>
              ))}
            </div>
          </DashboardCard>
        </div>
      </div>
    </div>
  );
}

/** Offline fallback answers using actual data */
function getLocalAnswer(q: string, r: any): string {
  const ql = q.toLowerCase();
  if (!r) return 'No analysis loaded. Run a planning request first.';

  if (ql.includes('expensive') || ql.includes('cost driver') || ql.includes('biggest cost')) {
    const b = r.cost?.breakdown || {};
    const sorted = Object.entries(b).filter(([, v]) => typeof v === 'number' && (v as number) > 0).sort(([, a], [, b]) => (b as number) - (a as number));
    return `Top cost drivers:\n${sorted.slice(0, 5).map(([k, v], i) => `${i + 1}. ${k.replace(/_/g, ' ')}: ${formatINR(v as number)} (${(((v as number) / r.cost.total_cost) * 100).toFixed(1)}%)`).join('\n')}\n\nTotal CAPEX: ${formatINR(r.cost.total_cost)}`;
  }

  if (ql.includes('reduce') || ql.includes('save') || ql.includes('optimize')) {
    return `Ways to reduce cost:\n1. Switch to aerial deployment (saves ~40% on civil work)\n2. Reduce coverage to 85% (saves ~${formatINR(r.cost.total_cost * 0.15)})\n3. Use lower-spec ONTs (₹1,800 vs ₹2,800 — saves ₹${(r.route.premises_connected * 1000).toLocaleString('en-IN')})\n4. Negotiate bulk pricing with vendors\n5. Phase deployment to spread CAPEX over 2-3 years`;
  }

  if (ql.includes('roi') || ql.includes('payback')) {
    const monthlyRevPerPremise = 500;
    const annualRevenue = r.route.premises_connected * monthlyRevPerPremise * 12;
    const paybackYears = r.cost.total_cost / annualRevenue;
    return `At ₹500/premise/month:\nAnnual revenue: ${formatINR(annualRevenue)}\nCAPEX: ${formatINR(r.cost.total_cost)}\nPayback: ${paybackYears.toFixed(1)} years\n5-year ROI: ${formatINR(annualRevenue * 5 - r.cost.total_cost)}`;
  }

  if (ql.includes('scenario') || ql.includes('compare')) {
    return r.decision.all_rankings.map((s: any) => `#${s.rank} ${s.name}: ${formatINR(s.estimated_cost)} • ${s.estimated_months}mo • ${s.coverage_percent}% coverage${s.rank === 1 ? ' ★' : ''}`).join('\n');
  }

  if (ql.includes('risk')) {
    return r.risk.risks.map((risk: any) => `${risk.severity === 'high' ? '🔴' : risk.severity === 'medium' ? '🟡' : '🟢'} ${risk.risk_type.replace(/_/g, ' ')}: ${(risk.score * 100).toFixed(0)}% — ${risk.mitigation}`).join('\n');
  }

  return `Your analysis: ${formatINR(r.cost.total_cost)} CAPEX, ${r.route.route_length_km} km route, ${r.route.premises_connected} premises, risk ${(r.risk.overall_risk_score * 100).toFixed(0)}/100. Try asking about specific costs, risks, scenarios, or optimization strategies.`;
}
