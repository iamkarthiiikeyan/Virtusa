import { useState } from 'react';
import {
  BookOpen, FileText, Network, Layers, Boxes, DollarSign, AlertTriangle,
  Lightbulb, FileBarChart, Shield, ChevronRight, Zap, Search, Navigation,
  Pencil, GitBranch, Brain, GitCompare, ArrowRight, LayoutDashboard,
  Settings, CheckCircle, Star, Radio, Cable, MousePointer, MapPin, Lock,
} from 'lucide-react';

const sections = [
  { id: 'overview', title: 'What is ATLAS?', icon: BookOpen, color: 'cyan', badge: 'Platform',
    content: `ATLAS (Autonomous Telecom Layout & Analytics System) is an AI-powered platform that automates FTTP fiber deployment planning. It replaces manual Excel-based costing with 7 AI agents that analyze satellite imagery, compute optimal fiber routes, generate Bills of Quantities, assess risks, compare deployment scenarios, and explain decisions — all in under 60 seconds.`,
    highlights: [
      { icon: Zap, label: '7 AI Agents', desc: 'Geospatial, Cost, Risk, Scenario, Negotiation, Explainability, Route Comparison' },
      { icon: MapPin, label: '200M+ Buildings', desc: 'Google Earth Engine satellite detection across India' },
      { icon: DollarSign, label: 'Full BOQ', desc: '25+ line items with real Indian hardware pricing in ₹' },
      { icon: Shield, label: 'End-to-End', desc: 'From area selection to admin approval in one platform' },
    ],
  },
  { id: 'workflow', title: 'Complete Workflow', icon: ArrowRight, color: 'emerald', badge: '15 Steps',
    content: null,
    steps: [
      { num: 1, label: 'Dashboard', desc: 'View live stats, charts, recent activity', icon: LayoutDashboard },
      { num: 2, label: 'Build Requests', desc: 'Select area (draw/search/P2P) and run pipeline', icon: FileText },
      { num: 3, label: 'Network Planner', desc: 'View fiber routes on satellite map', icon: Network },
      { num: 4, label: 'Scenario Simulator', desc: 'Compare 5 strategies, pick for downstream', icon: Layers },
      { num: 5, label: 'Digital Twin', desc: 'Visualize phased deployment', icon: Boxes },
      { num: 6, label: 'Cost Intelligence', desc: 'Edit BOQ with live recalculation', icon: DollarSign },
      { num: 7, label: 'GPON Topology', desc: '5 topologies with terrain-based AI pick', icon: GitBranch },
      { num: 8, label: 'Risk Analytics', desc: '6 risk categories with mitigations', icon: AlertTriangle },
      { num: 9, label: 'Decision Insights', desc: 'AI explanation of recommendations', icon: Lightbulb },
      { num: 10, label: 'AI Analysis Chat', desc: 'Ask Claude about your results', icon: Brain },
      { num: 11, label: 'Reports', desc: 'Export PDF/JSON/CSV, view history', icon: FileBarChart },
      { num: 12, label: 'Compare', desc: 'Side-by-side past analyses', icon: GitCompare },
      { num: 13, label: 'Governance', desc: 'Admin approval workflow', icon: Shield },
      { num: 14, label: 'Guidelines', desc: 'This documentation', icon: BookOpen },
      { num: 15, label: 'Settings', desc: 'Backend configuration', icon: Settings },
    ],
  },
  { id: 'build', title: 'Build Requests', icon: FileText, color: 'cyan', badge: 'Input',
    content: `This is where every analysis starts. Three input modes let you define your deployment area in the way that suits your workflow best.`,
    modes: [
      { icon: Pencil, name: 'Draw Mode', desc: 'Click points on the satellite map to create a custom polygon. Auto-detects location name and terrain via reverse geocoding. Best for custom-shaped deployment zones.', color: 'cyan' },
      { icon: Search, name: 'Search Boundary', desc: 'Type a city or area name (e.g., "Salem, Tamil Nadu"). Fetches the actual administrative boundary polygon from OpenStreetMap. Best for city/district-level planning.', color: 'emerald' },
      { icon: Navigation, name: 'Origin → Destination', desc: 'Place two points on map or type addresses. System finds 5 different routes: shortest, main road, minimum turns, residential avoidance, balanced. All routes auto-populate downstream tabs.', color: 'purple' },
    ],
    extra: 'GPS locate button (crosshair icon, top-right) flies to your current position. "New Analysis" button clears everything for a fresh start. Set budget (₹ Lakhs), timeline, terrain type, and priority before running.',
  },
  { id: 'network', title: 'Network Planner', icon: Network, color: 'emerald', badge: 'Routes',
    content: `Displays optimized fiber routes on an Esri satellite map.\n\nArea Mode — Shows the Steiner Tree route computed on the real OSMnx road network. Central Office marked with red pin. Stats: distance, premises, terrain, segments.\n\nP2P Mode — All 5 routes in different colors with a comparison table showing distance, turns, splice points, fiber cost, civil cost, total cost, cost/km. Click any route in the legend to highlight. "Show All" to see all routes simultaneously.\n\nThree panels below: Route Analysis, Top Risks, Cost Summary.` },
  { id: 'scenarios', title: 'Scenario Simulator', icon: Layers, color: 'purple', badge: 'TOPSIS',
    content: `5 deployment scenarios ranked by TOPSIS multi-criteria algorithm. The AI recommendation changes based on your stated priority — not just speed.`,
    table: {
      headers: ['Scenario', 'Cost', 'Coverage', 'Timeline', 'Best When'],
      rows: [
        ['Lowest Cost', '0.8×', '85%', 'Extended', 'Priority = cost-optimization'],
        ['Fastest Deploy', '1.35×', '90%', 'Shortest', 'Priority = competitive-defense'],
        ['Balanced', '1.0×', '95%', 'Standard', 'Default / general use'],
        ['Max Coverage', '1.25×', '100%', 'Longer', 'Priority = market-expansion'],
        ['Phased Rollout', '0.92×', '95%', '3 phases', 'Priority = rural-connectivity'],
      ],
    },
    extra: 'Green checkbox = select 3 for Digital Twin. Blue radio = select 1 for Cost Intelligence.',
  },
  { id: 'twin', title: 'Digital Twin Lab', icon: Boxes, color: 'orange', badge: 'Simulation',
    content: `Visualizes 3 selected scenarios as deployment phases on satellite map.\n\nPhase 1 (cyan) — Priority high-density areas\nPhase 2 (green) — Expansion zone\nPhase 3 (amber) — Full coverage\n\nClick through phase buttons to simulate network building out. Summary shows individual metrics for the SELECTED phase only (cost, coverage, timeline, premises). P2P mode shows routes as colored overlays.` },
  { id: 'cost', title: 'Cost Intelligence', icon: DollarSign, color: 'emerald', badge: 'BOQ',
    content: `Full Bill of Quantities with 25+ line items. Click "Edit Prices" to enter negotiated vendor rates — the entire BOQ recalculates live.\n\nCategories: Fiber Cable, Active Equipment (OLT ₹3,20,000, ONT ₹2,800), Passive (Splitters, FDB), Civil (Duct ₹45,000/km, Trenching ₹1,80,000/km), Labor, Permits.\n\nEdited items show in cyan with original struck through. Subtotals, Contingency (12%), GST (18%), Grand Total all update instantly. Reset individual items or all.` },
  { id: 'topology', title: 'GPON Topology', icon: GitBranch, color: 'purple', badge: 'Network',
    content: `5 real network topologies compared with AI recommendation based on your terrain and premises count.`,
    table: {
      headers: ['Topology', 'Cost', 'Max Premises', 'Redundancy', 'Best Terrain'],
      rows: [
        ['Tree / PON', '1×', '4,096', 'None', 'Urban / Suburban'],
        ['Star / P2P', '3.5×', '256', 'None', 'Enterprise'],
        ['Ring', '2.5×', '64', 'Full', 'Mountainous'],
        ['Bus', '0.8×', '16', 'None', 'Rural linear'],
        ['Mesh', '5×', '32', 'Full', 'Core only'],
      ],
    },
    extra: 'No scores shown until analysis runs. AI factors in: terrain type, premises count, risk level, cost multiplier, scalability.',
  },
  { id: 'risk', title: 'Risk Analytics', icon: AlertTriangle, color: 'red', badge: '6 Factors',
    content: `Evaluates 6 risk categories with contextual scoring:\n\n• Construction — route complexity, terrain\n• Regulatory — permits, road cutting approvals\n• Environmental — weather, seasonal factors\n• Supply Chain — material availability\n• Financial — budget adequacy, cost overrun\n• Operational — splice complexity, maintenance\n\nEach shows severity (high/medium/low), score (0-100%), description, and recommended mitigation.` },
  { id: 'decision', title: 'Decision Insights', icon: Lightbulb, color: 'amber', badge: 'XAI',
    content: `Full AI transparency — 5-section explanation:\n\n1. Route Analysis — how and why this path\n2. Cost Justification — what drives cost\n3. Risk Assessment — key risks and impact\n4. Scenario Comparison — why recommended > alternatives\n5. Recommendation Rationale — final decision with confidence` },
  { id: 'aichat', title: 'AI Analysis Chat', icon: Brain, color: 'purple', badge: 'LLM',
    content: `Full-page LLM chat powered by Claude. Sends your ENTIRE analysis data as context — every BOQ item, risk score, scenario cost, hardware count.\n\nExample questions:\n• "Why is civil work so expensive?"\n• "Calculate ROI at ₹500/month per premise"\n• "What if I reduce coverage to 80%?"\n• "Compare fastest vs phased rollout"\n• "5-year TCO including OPEX"\n\n8 suggested questions. Clickable action buttons. Falls back to data-aware local answers.` },
  { id: 'reports', title: 'Reports & Export', icon: FileBarChart, color: 'blue', badge: 'Export',
    content: `PDF — Professional A4 report with executive summary, BOQ tables, scenarios, risks, AI reasoning.\nJSON — Complete raw data for system integration.\nCSV — Key metrics for spreadsheets.\n\nAnalysis History from database. Click "Open" to reload any past record into ALL tabs. Admins see all users' records.` },
  { id: 'compare', title: 'Compare', icon: GitCompare, color: 'cyan', badge: 'Diff',
    content: `Select 2 past analyses → side-by-side comparison. Table shows: CAPEX, cost/premise, cost/km, route length, premises, risk score — with green/red arrows and percentage difference.\n\nCost breakdown comparison, risk comparison, and AI recommendation comparison panels.` },
  { id: 'governance', title: 'Governance', icon: Shield, color: 'purple', badge: 'Approval',
    content: `Admin: sees all users' plans with metrics. Approve/Reject with comments.\nPlanner: sees own plans with approval status and admin's comment.\nNotification bell in header shows updates (polls every 30s).\n"View Full Analysis" loads result into all tabs for review.` },
  { id: 'auth', title: 'Authentication', icon: Lock, color: 'red', badge: 'Security',
    content: `3 roles: Admin (full + approve + manage users), Planner (create + edit + export), Viewer (read-only).\n\nLogin required every session. JWT token authenticates all API calls. Database stores users, planning_records, and audit_log.` },
];

const SECTION_COLORS: Record<string, string> = {
  cyan: 'from-cyan-500/20 to-cyan-600/5', emerald: 'from-emerald-500/20 to-emerald-600/5',
  purple: 'from-purple-500/20 to-purple-600/5', orange: 'from-orange-500/20 to-orange-600/5',
  red: 'from-red-500/20 to-red-600/5', amber: 'from-amber-500/20 to-amber-600/5',
  blue: 'from-blue-500/20 to-blue-600/5',
};

export default function Guidelines() {
  const [active, setActive] = useState('overview');
  const sec = sections.find(s => s.id === active) || sections[0];

  return (
    <div className="space-y-6">
      {/* Header with gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-cyan-950/30 to-slate-900 border border-cyan-500/10 p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/25">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">ATLAS Guidelines</h1>
              <p className="text-sm text-cyan-400/80">Complete documentation • 15 features • 7 AI agents</p>
            </div>
          </div>
          <p className="text-slate-400 max-w-2xl">Everything you need to know about the Autonomous Telecom Layout & Analytics System. Click any section on the left to explore.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar nav */}
        <div className="space-y-1 max-h-[650px] overflow-y-auto pr-1 scrollbar-thin">
          {sections.map((s, i) => (
            <button key={s.id} onClick={() => setActive(s.id)}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-left transition-all group ${
                active === s.id
                  ? `bg-gradient-to-r ${SECTION_COLORS[s.color] || SECTION_COLORS.cyan} border border-${s.color}-500/30 text-white`
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
              }`}>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                active === s.id ? `bg-${s.color}-500/20` : 'bg-slate-800/50 group-hover:bg-slate-800'
              }`}>
                <s.icon className={`w-3.5 h-3.5 ${active === s.id ? `text-${s.color}-400` : ''}`} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium block truncate">{s.title}</span>
              </div>
              {s.badge && active === s.id && (
                <span className={`px-1.5 py-0.5 bg-${s.color}-500/20 text-${s.color}-400 text-[9px] rounded font-bold flex-shrink-0`}>{s.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Section header */}
          <div className={`bg-gradient-to-r ${SECTION_COLORS[sec.color] || SECTION_COLORS.cyan} border border-${sec.color}-500/20 rounded-xl p-6`}>
            <div className="flex items-center space-x-3 mb-2">
              <div className={`w-10 h-10 bg-${sec.color}-500/20 rounded-xl flex items-center justify-center`}>
                <sec.icon className={`w-5 h-5 text-${sec.color}-400`} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">{sec.title}</h2>
                {sec.badge && <span className={`text-xs text-${sec.color}-400/70`}>{sec.badge}</span>}
              </div>
            </div>
            {sec.content && <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line mt-3">{sec.content}</p>}
          </div>

          {/* Highlights grid (overview) */}
          {'highlights' in sec && sec.highlights && (
            <div className="grid grid-cols-2 gap-4">
              {sec.highlights.map((h: any, i: number) => (
                <div key={i} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5 hover:border-cyan-500/20 transition-all group">
                  <div className="w-9 h-9 bg-cyan-500/10 rounded-lg flex items-center justify-center mb-3 group-hover:bg-cyan-500/20 transition-all">
                    <h.icon className="w-4 h-4 text-cyan-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1">{h.label}</h3>
                  <p className="text-xs text-slate-400">{h.desc}</p>
                </div>
              ))}
            </div>
          )}

          {/* Steps (workflow) */}
          {'steps' in sec && sec.steps && (
            <div className="grid grid-cols-3 gap-3">
              {sec.steps.map((s: any) => (
                <div key={s.num} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 hover:border-emerald-500/20 transition-all group cursor-pointer"
                  onClick={() => {
                    const target = sections.find(sec => sec.title.includes(s.label));
                    if (target) setActive(target.id);
                  }}>
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="w-7 h-7 bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 rounded-lg flex items-center justify-center">
                      <span className="text-xs font-bold text-emerald-400">{s.num}</span>
                    </div>
                    <s.icon className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                  </div>
                  <h3 className="text-sm font-medium text-white mb-0.5">{s.label}</h3>
                  <p className="text-[11px] text-slate-500">{s.desc}</p>
                </div>
              ))}
            </div>
          )}

          {/* Input modes (build requests) */}
          {'modes' in sec && sec.modes && (
            <div className="space-y-3">
              {sec.modes.map((m: any, i: number) => (
                <div key={i} className={`bg-slate-900/50 border border-slate-800/50 rounded-xl p-5 hover:border-${m.color}-500/20 transition-all`}>
                  <div className="flex items-start space-x-4">
                    <div className={`w-10 h-10 bg-${m.color}-500/10 rounded-xl flex items-center justify-center flex-shrink-0`}>
                      <m.icon className={`w-5 h-5 text-${m.color}-400`} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white mb-1">{m.name}</h3>
                      <p className="text-xs text-slate-400 leading-relaxed">{m.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
              {sec.extra && <p className="text-xs text-slate-500 px-2">{sec.extra}</p>}
            </div>
          )}

          {/* Table (scenarios, topology) */}
          {'table' in sec && sec.table && (
            <>
              <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-800/30">
                      {sec.table.headers.map((h: string, i: number) => (
                        <th key={i} className={`py-3 px-4 text-xs font-semibold text-slate-400 ${i === 0 ? 'text-left' : 'text-center'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sec.table.rows.map((row: string[], i: number) => (
                      <tr key={i} className="border-t border-slate-800/30 hover:bg-slate-800/20">
                        {row.map((cell, j) => (
                          <td key={j} className={`py-3 px-4 text-sm ${j === 0 ? 'text-left font-medium text-white' : 'text-center text-slate-300'}`}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {sec.extra && <p className="text-xs text-slate-500 px-2">{sec.extra}</p>}
            </>
          )}
        </div>
      </div>

      {/* Bottom quick cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { icon: Pencil, t: 'Draw Mode', d: 'Click points on satellite map', c: 'cyan' },
          { icon: Search, t: 'Search', d: 'Type city for auto-boundary', c: 'emerald' },
          { icon: Navigation, t: 'P2P Routes', d: '5 routes between two points', c: 'purple' },
          { icon: Zap, t: 'AI Pipeline', d: '7 agents in under 60s', c: 'amber' },
        ].map((c, i) => (
          <div key={i} className={`bg-gradient-to-br from-${c.c}-500/5 to-transparent border border-${c.c}-500/10 rounded-xl p-4 hover:border-${c.c}-500/30 transition-all`}>
            <c.icon className={`w-5 h-5 text-${c.c}-400 mb-2`} />
            <h3 className="text-xs font-semibold text-white mb-1">{c.t}</h3>
            <p className="text-[11px] text-slate-500">{c.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
