import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, X, Send, Bot, Sparkles, ArrowRight, RotateCcw, Minimize2, ChevronUp } from 'lucide-react';
import { usePlanningStore } from '../stores/planningStore';
import { formatINR } from '../utils/formatINR';

interface Message { role: 'user' | 'assistant'; content: string; actions?: { label: string; action: string }[]; }

const SYSTEM = `You are ATLAS Assistant embedded in an AI-powered FTTP fiber deployment platform. 15 tabs, 7 agents.
TABS: Dashboard (live DB stats, donut/area/bar charts), Build Requests (Draw/Search/P2P 5 routes, GPS locate, New Analysis), Network Planner (satellite map, P2P comparison), Scenario Simulator (5 scenarios TOPSIS-ranked, priority-adaptive: market→MaxCoverage, rural→Phased, competitive→Fastest, cost→LowestCost), Digital Twin (3 phases individual summary), Cost Intelligence (25+ BOQ editable, GST 18%, contingency 12%), GPON Topology (5 topologies: Tree/Star/Ring/Bus/Mesh terrain-based AI), Risk Analytics (6 categories), Decision Insights (5-section XAI), AI Analysis Chat (full result→Claude), Reports (PDF/JSON/CSV), Compare (2 side-by-side), Governance (admin approve/reject bell), Guidelines (docs), Settings.
7 AGENTS: Geospatial (GEE+Steiner), Cost (BOQ), Risk (6), Scenario (5), Negotiation (TOPSIS), Explainability, Route Comparison (5 P2P).
HARDWARE: OLT MA5800-X7 ₹3,20,000 | ONT ₹2,800 | Splitter 1:32 ₹1,200 | FDB ₹2,500 | Fiber ₹18,000/km | Duct ₹45,000/km | Trenching ₹1,80,000/km
TOPOLOGIES: Tree/PON=urban, Star/P2P=enterprise, Ring=mountainous, Bus=rural, Mesh=core. Scores only after analysis.
Keep answers concise. Use ₹ for prices.`;

const PAGE_LABELS: Record<string, string> = {
  '/': 'Dashboard', '/build-requests': 'Build Requests', '/network-planner': 'Network Planner',
  '/scenario-simulator': 'Scenarios', '/digital-twin': 'Digital Twin', '/cost-intelligence': 'Cost Intelligence',
  '/topology': 'Topology', '/risk-analytics': 'Risk', '/decision-insights': 'Decisions',
  '/ai-chat': 'AI Chat', '/reports': 'Reports', '/compare': 'Compare',
  '/governance': 'Governance', '/guidelines': 'Guidelines', '/settings': 'Settings',
};

const PAGE_QS: Record<string, { label: string; q: string }[]> = {
  '/': [{ label: 'What are the charts?', q: 'What do the dashboard charts show?' }, { label: 'How to start?', q: 'How do I start a new analysis?' }, { label: 'Explain agents', q: 'What are the 7 AI agents?' }],
  '/build-requests': [{ label: 'Which mode?', q: 'Which input mode should I use?' }, { label: 'How does P2P work?', q: 'How does Origin to Destination work?' }, { label: 'After clicking Start?', q: 'What happens when I click Start Planning?' }],
  '/network-planner': [{ label: 'What are the lines?', q: 'What do the colored lines on the map mean?' }, { label: 'Steiner Tree?', q: 'What is the Steiner Tree algorithm?' }],
  '/scenario-simulator': [{ label: 'What is TOPSIS?', q: 'What is TOPSIS ranking?' }, { label: 'Why this one?', q: 'Why is this scenario recommended over others?' }, { label: 'How to pick?', q: 'How do I choose which scenarios to select?' }],
  '/digital-twin': [{ label: 'Phase colors?', q: 'What do the cyan, green, and amber colors mean?' }, { label: 'Individual vs total?', q: 'Why does it show individual phase summary?' }],
  '/cost-intelligence': [{ label: 'Edit prices?', q: 'How do I edit unit prices in the BOQ?' }, { label: 'What is GST?', q: 'How is 18% GST calculated?' }, { label: 'Contingency?', q: 'What is the 12% contingency?' }],
  '/topology': [{ label: 'Which topology?', q: 'Which topology is best for my deployment?' }, { label: 'Tree vs Star?', q: 'Difference between Tree/PON and Star/P2P?' }, { label: 'Why Ring?', q: 'When should I use Ring topology?' }],
  '/risk-analytics': [{ label: 'Biggest risk?', q: 'Which risk is most critical for my deployment?' }, { label: 'Reduce risk?', q: 'How can I mitigate the high-severity risks?' }],
  '/decision-insights': [{ label: 'Why recommended?', q: 'Why did the AI recommend this scenario?' }],
  '/ai-chat': [{ label: 'What to ask?', q: 'What kind of questions can AI Analysis Chat answer?' }],
  '/reports': [{ label: 'Download PDF?', q: 'How do I download a PDF report?' }, { label: 'Past analyses?', q: 'Where can I see all my past analyses?' }],
  '/compare': [{ label: 'How to compare?', q: 'How do I compare two past analyses?' }],
  '/governance': [{ label: 'Approval flow?', q: 'How does admin approval work?' }],
  '/guidelines': [{ label: 'Quick start', q: 'Give me a 5-step quick start guide' }, { label: 'All features', q: 'List all 15 features briefly' }],
  '/settings': [{ label: 'Backend?', q: 'How do I check if the backend is running?' }],
};

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [mini, setMini] = useState(false);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pulse, setPulse] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const inRef = useRef<HTMLInputElement>(null);
  const loc = useLocation();
  const nav = useNavigate();
  const { currentResult: r, p2pRoutes } = usePlanningStore();

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);
  useEffect(() => { if (open && inRef.current) setTimeout(() => inRef.current?.focus(), 100); }, [open, mini]);
  useEffect(() => { if (open) setPulse(false); }, [open]);

  useEffect(() => {
    if (open && msgs.length === 0) {
      const page = PAGE_LABELS[loc.pathname] || 'this page';
      setMsgs([{ role: 'assistant',
        content: `Hey there! You're on ${page}. I know everything about ATLAS — all 15 tabs, 7 agents, 5 topologies, and your analysis data. How can I help?`,
        actions: [
          { label: '🚀 Quick start', action: 'Give me a 5-step quick start guide' },
          { label: '💡 What can I do here?', action: `What can I do on the ${page} page?` },
          { label: '🤖 About agents', action: 'Explain all 7 AI agents briefly' },
        ],
      }]);
    }
  }, [open]);

  const ctx = () => {
    let c = `[Page:${loc.pathname}]`;
    if (r) c += `[₹${r.cost?.total_cost?.toLocaleString('en-IN')},${r.route?.route_length_km}km,${r.route?.premises_connected}prem,${r.cost?.terrain_type},risk:${(r.risk?.overall_risk_score*100).toFixed(0)},rec:${r.decision?.recommended_scenario?.name}]`;
    if (p2pRoutes) c += `[P2P:${p2pRoutes.length}]`;
    return c;
  };

  const tryNav = (q: string): string | null => {
    const ql = q.toLowerCase();
    if (!(ql.includes('take me') || ql.includes('go to') || ql.includes('navigate') || ql.includes('open'))) return null;
    const m: Record<string, [string, string]> = {
      dashboard: ['/', 'Dashboard'], build: ['/build-requests', 'Build Requests'], network: ['/network-planner', 'Network Planner'],
      scenario: ['/scenario-simulator', 'Scenarios'], 'digital twin': ['/digital-twin', 'Digital Twin'], cost: ['/cost-intelligence', 'Cost Intelligence'],
      topology: ['/topology', 'Topology'], risk: ['/risk-analytics', 'Risk Analytics'], decision: ['/decision-insights', 'Decision Insights'],
      'ai chat': ['/ai-chat', 'AI Chat'], 'analysis chat': ['/ai-chat', 'AI Chat'], report: ['/reports', 'Reports'],
      compare: ['/compare', 'Compare'], governance: ['/governance', 'Governance'], guideline: ['/guidelines', 'Guidelines'], setting: ['/settings', 'Settings'],
    };
    for (const [k, [p, n]] of Object.entries(m)) { if (ql.includes(k)) { nav(p); return `✅ Navigated to ${n}!`; } }
    return null;
  };

  const send = async (ov?: string) => {
    const msg = (ov || input).trim();
    if (!msg || loading) return;
    setInput('');
    setMsgs(p => [...p, { role: 'user', content: msg }]);
    setLoading(true);
    const n = tryNav(msg);
    if (n) { setMsgs(p => [...p, { role: 'assistant', content: n }]); setLoading(false); return; }
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 500, system: SYSTEM,
          messages: [...msgs.slice(-8).map(m => ({ role: m.role, content: m.content })), { role: 'user', content: `${ctx()}\n${msg}` }] }) });
      if (res.ok) { const d = await res.json(); setMsgs(p => [...p, { role: 'assistant', content: d.content?.map((c: any) => c.text).join('') || 'No response.' }]); }
      else setMsgs(p => [...p, local(msg)]);
    } catch { setMsgs(p => [...p, local(msg)]); }
    setLoading(false);
  };

  const qs = PAGE_QS[loc.pathname] || PAGE_QS['/'];

  return (<>
    {/* Floating button with pulse */}
    {!open && (
      <button onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full shadow-lg shadow-cyan-500/30 flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50 group">
        <MessageCircle className="w-6 h-6 text-white group-hover:rotate-12 transition-transform" />
        {pulse && <span className="absolute inset-0 rounded-full bg-cyan-500/40 animate-ping" />}
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center shadow-sm">
          <Sparkles className="w-3 h-3 text-white" />
        </span>
      </button>
    )}

    {/* Chat panel */}
    {open && (
      <div className={`fixed bottom-6 right-6 w-[420px] bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl shadow-black/40 flex flex-col z-50 overflow-hidden transition-all duration-300 ${mini ? 'h-14' : 'h-[540px]'}`}>
        {/* Gradient header */}
        <div className="relative flex items-center justify-between px-4 py-3 bg-gradient-to-r from-cyan-500/15 via-blue-600/10 to-purple-500/10 border-b border-slate-800/50 cursor-pointer"
          onClick={() => mini && setMini(false)}>
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-transparent" />
          <div className="relative flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm shadow-cyan-500/25">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-semibold text-white">ATLAS Assistant</span>
                <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] rounded-full font-bold tracking-wide">AI POWERED</span>
              </div>
              {!mini && <p className="text-[10px] text-slate-500">{PAGE_LABELS[loc.pathname] || 'ATLAS'} • {r ? 'Analysis loaded' : 'No analysis'}</p>}
            </div>
          </div>
          <div className="relative flex items-center space-x-0.5">
            <button onClick={e => { e.stopPropagation(); setMsgs([]); }} className="p-2 text-slate-500 hover:text-white rounded-lg hover:bg-white/5 transition-all" title="Clear">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button onClick={e => { e.stopPropagation(); setMini(!mini); }} className="p-2 text-slate-500 hover:text-white rounded-lg hover:bg-white/5 transition-all">
              {mini ? <ChevronUp className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => setOpen(false)} className="p-2 text-slate-500 hover:text-red-400 rounded-lg hover:bg-white/5 transition-all">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {!mini && (<>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {msgs.map((m, i) => (
              <div key={i} className="animate-fadeIn">
                <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'assistant' && (
                    <div className="w-6 h-6 bg-gradient-to-br from-cyan-500/20 to-blue-600/10 rounded-lg flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">
                      <Bot className="w-3 h-3 text-cyan-400" />
                    </div>
                  )}
                  <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
                    m.role === 'user'
                      ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/15 text-cyan-50 rounded-br-md border border-cyan-500/10'
                      : 'bg-slate-800/60 text-slate-300 rounded-bl-md border border-slate-700/30'
                  }`}>
                    {m.content}
                  </div>
                </div>
                {m.actions && (
                  <div className="flex flex-wrap gap-1.5 mt-2 ml-8">
                    {m.actions.map((a, j) => (
                      <button key={j} onClick={() => send(a.action)}
                        className="px-3 py-1.5 bg-slate-800/50 border border-slate-700/50 text-slate-300 rounded-xl text-xs hover:bg-slate-700/50 hover:border-slate-600 hover:text-white transition-all flex items-center space-x-1.5">
                        <span>{a.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex justify-start animate-fadeIn">
                <div className="w-6 h-6 bg-cyan-500/10 rounded-lg flex items-center justify-center mr-2 mt-0.5"><Bot className="w-3 h-3 text-cyan-400" /></div>
                <div className="bg-slate-800/60 px-4 py-3 rounded-2xl rounded-bl-md border border-slate-700/30">
                  <div className="flex items-center space-x-1.5">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    <span className="text-xs text-slate-600 ml-1">thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Quick suggestions */}
          {msgs.length <= 2 && (
            <div className="px-4 py-2.5 border-t border-slate-800/30 bg-slate-900/50">
              <p className="text-[10px] text-slate-600 mb-2 font-medium tracking-wide uppercase">Suggested for {PAGE_LABELS[loc.pathname] || 'this page'}</p>
              <div className="flex flex-wrap gap-1.5">
                {qs.map((q, i) => (
                  <button key={i} onClick={() => send(q.q)}
                    className="px-3 py-1.5 bg-gradient-to-r from-cyan-500/10 to-blue-500/5 border border-cyan-500/15 text-cyan-400 rounded-xl text-xs hover:from-cyan-500/20 hover:to-blue-500/10 hover:border-cyan-500/30 transition-all">
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="px-4 py-3 border-t border-slate-800/50 bg-slate-950/30">
            <div className="flex items-center space-x-2">
              <input ref={inRef} type="text" value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') send(); }}
                placeholder="Ask about ATLAS..."
                className="flex-1 bg-slate-800/40 border border-slate-700/40 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/30 transition-all" />
              <button onClick={() => send()} disabled={!input.trim() || loading}
                className="p-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl hover:from-cyan-600 hover:to-blue-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm shadow-cyan-500/20">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>)}
      </div>
    )}

    <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } } .animate-fadeIn { animation: fadeIn 0.3s ease-out; }`}</style>
  </>);
}

function local(q: string): Message {
  const l = q.toLowerCase();
  if (l.match(/^(hi|hello|hey)/)) return { role: 'assistant', content: 'Hey! Ask about any of the 15 ATLAS features, 7 agents, 5 topologies, costs, or say "take me to [tab]" to navigate.' };
  if (l.includes('what is atlas')) return { role: 'assistant', content: 'ATLAS is an AI-powered FTTP fiber deployment platform — 15 tabs, 7 agents. Automates cost estimation, routing, scenarios, risk, approval. Replaces manual Excel.' };
  if (l.includes('quick start') || l.includes('5 step') || l.includes('how do i start'))
    return { role: 'assistant', content: '🚀 5-step guide:\n1️⃣ Build Requests → Draw/Search/P2P\n2️⃣ Click "Start Autonomous Planning"\n3️⃣ Scenario Simulator → pick 3 for Twin, 1 for Cost\n4️⃣ Cost Intelligence → edit vendor prices\n5️⃣ Reports → export PDF' };
  if (l.includes('dashboard') && (l.includes('chart') || l.includes('show')))
    return { role: 'assistant', content: '📊 Dashboard has: 3 donut charts (queue/cost/approval), 2 area charts (CAPEX+premises trends), CAPEX bar chart, risk profile bars, activity feed. All from real DB.' };
  if (l.includes('build request') || l.includes('input mode'))
    return { role: 'assistant', content: '3 modes:\n✏️ Draw — points on satellite map\n🔍 Search — city name auto-boundary\n📍 P2P — 5 routes with costs\n\nGPS locate top-right. "New Analysis" clears previous.' };
  if (l.includes('origin') || l.includes('destination') || l.includes('p2p') || l.includes('5 route'))
    return { role: 'assistant', content: '5 routes: shortest, main road, min turns, residential avoidance, balanced. All populate Scenarios, Twin, and Cost tabs.' };
  if (l.includes('scenario') && !l.includes('topology'))
    return { role: 'assistant', content: '5 scenarios TOPSIS-ranked. Priority matters:\n🏆 Market → Max Coverage\n💰 Rural → Phased/Lowest\n⚡ Competitive → Fastest\n📉 Cost → Lowest Cost\n\n✅ = 3 for Twin, 🔵 = 1 for Cost' };
  if (l.includes('topsis'))
    return { role: 'assistant', content: 'TOPSIS ranks by distance from ideal+anti-ideal. Weights adapt to priority — that\'s why different priorities give different winners.' };
  if (l.includes('digital twin') || l.includes('phase'))
    return { role: 'assistant', content: '3 phases: 🔵cyan, 🟢green, 🟠amber. Individual summary per selected phase (not cumulative).' };
  if (l.includes('cost intelligence') || l.includes('boq') || l.includes('edit price'))
    return { role: 'assistant', content: '25+ BOQ items. "Edit Prices" → live recalc. 18% GST + 12% contingency. Cyan = edited.' };
  if (l.includes('topology') || l.includes('star') || l.includes('ring') || l.includes('mesh') || l.includes('bus'))
    return { role: 'assistant', content: '5 topologies:\n🌳 Tree/PON — urban FTTP (95% global)\n⭐ Star/P2P — enterprise\n🔄 Ring — mountainous (self-healing)\n📏 Bus — rural linear\n🕸️ Mesh — core only\n\nScores shown after analysis.' };
  if (l.includes('risk'))
    return { role: 'assistant', content: '6 risks: construction, regulatory, environmental, supply chain, financial, operational. Each scored 0-100% with mitigation.' };
  if (l.includes('decision') || l.includes('explain'))
    return { role: 'assistant', content: '5-section AI explanation: route, cost, risk, scenarios, recommendation. Full transparency.' };
  if (l.includes('ai chat') || l.includes('analysis chat'))
    return { role: 'assistant', content: 'Sends full result to Claude. Ask: "Why expensive?", "ROI?", "5-year TCO?", "What if aerial?"' };
  if (l.includes('report') || l.includes('pdf'))
    return { role: 'assistant', content: 'PDF/JSON/CSV. DB history — "Open" reloads into all tabs.' };
  if (l.includes('compare'))
    return { role: 'assistant', content: '2 analyses side-by-side with ↑↓ arrows and % difference.' };
  if (l.includes('governance') || l.includes('approv'))
    return { role: 'assistant', content: 'Admin approves/rejects with comments. Bell notifies planners.' };
  if (l.includes('agent'))
    return { role: 'assistant', content: '🤖 7 agents:\n1. Geospatial (GEE+Steiner)\n2. Cost (BOQ ₹)\n3. Risk (6 factors)\n4. Scenario (5 strategies)\n5. Negotiation (TOPSIS)\n6. Explainability (XAI)\n7. Route Comparison (5 P2P)' };
  if (l.includes('gee') || l.includes('satellite'))
    return { role: 'assistant', content: 'GEE Open Buildings V3: 200M+ footprints, 50cm satellite imagery. Exact building count inside your polygon.' };
  if (l.includes('steiner'))
    return { role: 'assistant', content: 'Steiner Tree: minimum-cost route connecting all buildings to CO on real road network (OSMnx+NetworkX).' };
  if (l.includes('olt') || l.includes('ont') || l.includes('hardware') || l.includes('price'))
    return { role: 'assistant', content: '💰 OLT: ₹3,20,000 | ONT: ₹2,800 | Splitter 1:32: ₹1,200 | FDB: ₹2,500 | Fiber: ₹18K/km | Duct: ₹45K/km | Trenching: ₹1.8L/km' };
  if (l.includes('terrain'))
    return { role: 'assistant', content: 'Urban→Tree, Suburban→Tree, Rural→Bus/Tree, Mountainous→Ring. Auto-detected from location.' };
  if (l.includes('locate') || l.includes('gps'))
    return { role: 'assistant', content: '📍 Crosshair button (top-right of map) → browser GPS → blue dot + auto-fill location name.' };
  if (l.includes('login') || l.includes('role'))
    return { role: 'assistant', content: '👑 Admin (full+approve), 👷 Planner (create+edit), 👁️ Viewer (read-only). Login every session.' };
  if (l.includes('signal') || l.includes('optical') || l.includes('power budget'))
    return { role: 'assistant', content: 'GPON G.984: TX 5dBm, RX -28dBm = 33dB budget. Fiber 0.35dB/km, splice 0.1dB, 1:32 splitter 17.5dB, max ~20km.' };
  if (l.includes('15 feature') || l.includes('all feature') || l.includes('list'))
    return { role: 'assistant', content: '15 tabs: Dashboard, Build Requests, Network Planner, Scenario Simulator, Digital Twin, Cost Intelligence, GPON Topology, Risk Analytics, Decision Insights, AI Chat, Reports, Compare, Governance, Guidelines, Settings' };
  if (l.includes('thank')) return { role: 'assistant', content: "Happy to help! Good luck with your deployment! 🚀" };
  return { role: 'assistant', content: "I can help with all 15 ATLAS features. Try asking about any tab, topology, scenario scoring, hardware prices, or say \"take me to [tab]\".",
    actions: [{ label: '🚀 Quick start', action: '5-step guide' }, { label: '🌳 Topologies', action: 'Explain 5 network topologies' }, { label: '🤖 Agents', action: 'What are the 7 agents?' }] };
}
