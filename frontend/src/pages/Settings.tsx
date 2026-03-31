import { useState, useEffect } from 'react';
import DashboardCard from '../components/DashboardCard';
import { Bell, Lock, Users, Zap, Download, Trash2, Activity, CheckCircle, XCircle } from 'lucide-react';
import { healthCheck } from '../services/api';
import { usePlanningStore } from '../stores/planningStore';

export default function Settings() {
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const { history, clearResult } = usePlanningStore();

  useEffect(() => {
    healthCheck().then(ok => setBackendStatus(ok ? 'online' : 'offline'));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-slate-400">Configure ATLAS platform settings and preferences</p>
      </div>

      {/* Backend Status */}
      <div className={`p-4 rounded-xl border flex items-center justify-between ${
        backendStatus === 'online' ? 'bg-emerald-500/5 border-emerald-500/20' :
        backendStatus === 'offline' ? 'bg-red-500/5 border-red-500/20' :
        'bg-slate-800/50 border-slate-700'
      }`}>
        <div className="flex items-center space-x-3">
          {backendStatus === 'online' ? (
            <><Activity className="w-5 h-5 text-emerald-400 animate-pulse" /><span className="text-sm font-medium text-emerald-400">Backend Connected</span></>
          ) : backendStatus === 'offline' ? (
            <><XCircle className="w-5 h-5 text-red-400" /><span className="text-sm font-medium text-red-400">Backend Offline — Run: uvicorn app.main:app --port 8000</span></>
          ) : (
            <><Activity className="w-5 h-5 text-slate-400 animate-spin" /><span className="text-sm text-slate-400">Checking connection...</span></>
          )}
        </div>
        <button onClick={() => { setBackendStatus('checking'); healthCheck().then(ok => setBackendStatus(ok ? 'online' : 'offline')); }} className="text-xs text-slate-400 hover:text-white transition-colors">Refresh</button>
      </div>

      <DashboardCard title="AI Engine Configuration">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">Decision Confidence Threshold</label>
            <div className="flex items-center space-x-4">
              <input type="range" min="0" max="100" defaultValue="75" className="flex-1 accent-cyan-500" />
              <span className="text-sm font-semibold text-cyan-400 w-12">75%</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">AI recommendations below this threshold will require manual review</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">Risk Tolerance Level</label>
            <div className="flex items-center space-x-4">
              <input type="range" min="0" max="100" defaultValue="40" className="flex-1 accent-cyan-500" />
              <span className="text-sm font-semibold text-cyan-400 w-12">40%</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">Higher values allow more aggressive deployment strategies</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">Optimization Priority</label>
            <select className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50">
              <option>Balanced (Cost + Speed + Risk)</option>
              <option>Cost Optimized</option>
              <option>Speed Optimized</option>
              <option>Risk Minimized</option>
            </select>
          </div>
        </div>
      </DashboardCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardCard title="Notification Settings">
          <div className="space-y-4">
            {[
              { label: 'High Risk Alerts', icon: Zap, enabled: true },
              { label: 'Deployment Updates', icon: Bell, enabled: true },
              { label: 'Approval Requests', icon: Users, enabled: true },
              { label: 'System Notifications', icon: Bell, enabled: false },
            ].map((notification, index) => (
              <label key={index} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg border border-slate-700/50 hover:border-slate-600 cursor-pointer transition-all">
                <div className="flex items-center space-x-3">
                  <notification.icon className="w-5 h-5 text-slate-400" />
                  <span className="text-sm text-slate-300">{notification.label}</span>
                </div>
                <input type="checkbox" defaultChecked={notification.enabled} className="w-4 h-4 rounded border-slate-600 text-cyan-500 focus:ring-cyan-500" />
              </label>
            ))}
          </div>
        </DashboardCard>

        <DashboardCard title="Security & Access">
          <div className="space-y-3">
            {[
              { icon: Lock, title: 'Change Password', desc: 'Update your account password' },
              { icon: Users, title: 'Manage Team Members', desc: 'Add or remove access permissions' },
              { icon: Zap, title: 'API Keys', desc: 'Manage integration credentials' },
            ].map((item, i) => (
              <button key={i} className="w-full flex items-center space-x-3 p-3 bg-slate-800/30 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-all group text-left">
                <item.icon className="w-5 h-5 text-slate-400 group-hover:text-cyan-400 transition-colors" />
                <div>
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <p className="text-xs text-slate-500">{item.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </DashboardCard>
      </div>

      <DashboardCard title="Data Management">
        <div className="space-y-3">
          <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-white">Analysis History</h4>
              <span className="text-xs text-slate-400">{history.length} analyses stored</span>
            </div>
            <p className="text-sm text-slate-400 mb-3">Clear all cached analyses from this session</p>
            <button onClick={() => { clearResult(); }} className="px-4 py-2 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-lg hover:bg-orange-500/20 transition-all text-sm font-medium">
              Clear Data
            </button>
          </div>
        </div>
      </DashboardCard>

      <DashboardCard title="About ATLAS">
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
            <span className="text-sm text-slate-300">Platform Version</span>
            <span className="text-sm font-semibold text-white">v2.0.0</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
            <span className="text-sm text-slate-300">AI Engine</span>
            <span className="text-sm font-semibold text-white">TOPSIS + Steiner Tree + Rule-based Risk</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
            <span className="text-sm text-slate-300">Backend Status</span>
            <span className={`text-sm font-semibold ${backendStatus === 'online' ? 'text-emerald-400' : 'text-red-400'}`}>
              {backendStatus === 'online' ? 'Connected' : backendStatus === 'offline' ? 'Offline' : 'Checking...'}
            </span>
          </div>
          <p className="text-xs text-slate-500 text-center mt-4">Autonomous Telecom Layout & Analytics System</p>
        </div>
      </DashboardCard>
    </div>
  );
}
