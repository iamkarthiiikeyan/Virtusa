import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Network, Layers, Boxes, DollarSign,
  AlertTriangle, Lightbulb, FileBarChart, Shield, Settings,
  BookOpen, GitCompare, GitBranch, Brain,
} from 'lucide-react';

const navGroups = [
  {
    label: 'Planning',
    items: [
      { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { path: '/build-requests', icon: FileText, label: 'Build Requests' },
      { path: '/network-planner', icon: Network, label: 'Network Planner' },
    ],
  },
  {
    label: 'Analysis',
    items: [
      { path: '/scenario-simulator', icon: Layers, label: 'Scenario Simulator' },
      { path: '/digital-twin', icon: Boxes, label: 'Digital Twin Lab' },
      { path: '/cost-intelligence', icon: DollarSign, label: 'Cost Intelligence' },
      { path: '/topology', icon: GitBranch, label: 'GPON Topology' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { path: '/risk-analytics', icon: AlertTriangle, label: 'Risk Analytics' },
      { path: '/decision-insights', icon: Lightbulb, label: 'Decision Insights' },
      { path: '/ai-chat', icon: Brain, label: 'AI Analysis Chat' },
    ],
  },
  {
    label: 'Management',
    items: [
      { path: '/reports', icon: FileBarChart, label: 'Reports' },
      { path: '/compare', icon: GitCompare, label: 'Compare' },
      { path: '/governance', icon: Shield, label: 'Governance' },
      { path: '/guidelines', icon: BookOpen, label: 'Guidelines' },
      { path: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-800/50 flex flex-col fixed left-0 top-0 h-full z-10">
      {/* Logo */}
      <div className="p-5 border-b border-slate-800/50">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Network className="w-5 h-5 text-white" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-950" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">ATLAS</h1>
            <p className="text-[10px] text-slate-500 tracking-wide">TELECOM AI PLATFORM</p>
          </div>
        </div>
      </div>

      {/* Navigation groups */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                      isActive
                        ? 'bg-gradient-to-r from-cyan-500/15 to-blue-600/10 text-white border border-cyan-500/20 shadow-sm shadow-cyan-500/5'
                        : 'text-slate-500 hover:bg-slate-800/40 hover:text-slate-300'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                        isActive
                          ? 'bg-cyan-500/20'
                          : 'bg-slate-800/50 group-hover:bg-slate-800'
                      }`}>
                        <item.icon className={`w-4 h-4 transition-colors ${isActive ? 'text-cyan-400' : ''}`} />
                      </div>
                      <span className="text-sm font-medium">{item.label}</span>
                      {isActive && (
                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50" />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-4 border-t border-slate-800/50">
        <div className="flex items-center space-x-2 px-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] text-slate-600">7 Agents Active</span>
        </div>
      </div>
    </aside>
  );
}
