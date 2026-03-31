import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardCard from '../components/DashboardCard';
import { Download, FileText, BarChart3, FileDown, Clock, CheckCircle, XCircle, Loader2, ExternalLink } from 'lucide-react';
import { usePlanningStore } from '../stores/planningStore';
import { useAuthStore } from '../stores/authStore';
import { formatINR } from '../utils/formatINR';

const API = 'http://localhost:8000';

interface DBRecord {
  id: number; location: string; premises: number; total_cost: number;
  route_km: number; risk_score: number; recommended: string;
  building_source: string; detected_buildings: number;
  status: string; user_email: string; duration: number; created_at: string;
}

export default function Reports() {
  const { currentResult: r, setCurrentResult } = usePlanningStore();
  const { token, user } = useAuthStore();
  const navigate = useNavigate();
  const [records, setRecords] = useState<DBRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState<number | null>(null);
  const [loadingResult, setLoadingResult] = useState<number | null>(null);

  // Fetch records - backend filters by user automatically
  useEffect(() => {
    setLoadingRecords(true);
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch(`${API}/api/v1/records?limit=50`, { headers })
      .then(res => res.json())
      .then(data => {
        setRecords(data.records || []);
        setLoadingRecords(false);
      })
      .catch(() => setLoadingRecords(false));
  }, [r, token]);

  const exportJSON = () => {
    if (!r) return;
    const b = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' });
    const u = URL.createObjectURL(b); const a = document.createElement('a');
    a.href = u; a.download = `atlas-report-${Date.now()}.json`; a.click(); URL.revokeObjectURL(u);
  };

  const exportCSV = () => {
    if (!r) return;
    const rows = [['Metric', 'Value'], ['Route (km)', r.route.route_length_km], ['Premises', r.route.premises_connected],
      ['Total Cost (INR)', r.cost.total_cost], ['Cost/Premise (INR)', r.cost.cost_per_premise],
      ['Risk Score', r.risk.overall_risk_score], ['Recommended', r.decision.recommended_scenario.name],
      ...r.risk.risks.map(rk => [`Risk: ${rk.risk_type}`, rk.score])];
    const csv = rows.map(r => r.join(',')).join('\n');
    const b = new Blob([csv], { type: 'text/csv' }); const u = URL.createObjectURL(b);
    const a = document.createElement('a'); a.href = u; a.download = `atlas-data-${Date.now()}.csv`; a.click(); URL.revokeObjectURL(u);
  };

  const downloadPDF = async (recordId: number) => {
    setDownloadingPdf(recordId);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API}/api/v1/report/${recordId}/pdf`, { headers });
      if (!res.ok) throw new Error('Failed');
      const blob = await res.blob(); const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `ATLAS_Report_${recordId}.pdf`; a.click(); URL.revokeObjectURL(url);
    } catch { alert('PDF download failed. Ensure reportlab is installed.'); }
    setDownloadingPdf(null);
  };

  const downloadCurrentPDF = async () => {
    if (!r) return;
    const recordId = (r as any).record_id;
    if (recordId) { await downloadPDF(recordId); return; }
    setDownloadingPdf(-1);
    try {
      const res = await fetch(`${API}/api/v1/report/pdf`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r) });
      if (!res.ok) throw new Error('Failed');
      const blob = await res.blob(); const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'ATLAS_Report.pdf'; a.click(); URL.revokeObjectURL(url);
    } catch { alert('PDF generation failed'); }
    setDownloadingPdf(null);
  };

  // Load a past record's full result into all tabs
  const loadRecord = async (recordId: number) => {
    setLoadingResult(recordId);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API}/api/v1/records/${recordId}`, { headers });
      const data = await res.json();
      if (data.result) {
        setCurrentResult(data.result);
        navigate('/');
      }
    } catch { alert('Failed to load record'); }
    setLoadingResult(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Reports & Export</h1>
        <p className="text-slate-400">
          {user?.role === 'admin' ? 'All user records (admin view)' : 'Your analysis history and exports'}
        </p>
      </div>

      {/* Export cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {[
          { icon: FileDown, title: 'PDF Report', desc: r ? 'Full planning report' : 'Run analysis first', color: 'red', fn: downloadCurrentPDF, loading: downloadingPdf === -1 },
          { icon: FileText, title: 'JSON Export', desc: r ? 'Complete data' : 'Run analysis', color: 'cyan', fn: exportJSON, loading: false },
          { icon: BarChart3, title: 'CSV Export', desc: r ? 'Key metrics' : 'Run analysis', color: 'emerald', fn: exportCSV, loading: false },
          { icon: Download, title: 'BOQ Export', desc: r ? `${r.cost.boq?.length || 0} items` : 'Run analysis', color: 'purple', fn: exportCSV, loading: false },
        ].map((t, i) => (
          <div key={i} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
            <div className={`w-10 h-10 bg-${t.color}-500/10 rounded-lg flex items-center justify-center mb-3`}>
              <t.icon className={`w-5 h-5 text-${t.color}-400`} /></div>
            <h3 className="text-sm font-semibold text-white mb-1">{t.title}</h3>
            <p className="text-xs text-slate-400 mb-3">{t.desc}</p>
            <button onClick={t.fn} disabled={!r || t.loading}
              className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center space-x-1.5 ${r ? 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-800/30 border border-slate-800 text-slate-600 cursor-not-allowed'}`}>
              {t.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{t.loading ? 'Generating...' : 'Download'}</span></button>
          </div>))}
      </div>

      {/* History */}
      <DashboardCard title={`Analysis History${user?.role === 'admin' ? ' (All Users)' : ''}`}>
        {loadingRecords ? (
          <div className="text-center py-8"><Loader2 className="w-6 h-6 text-slate-500 animate-spin mx-auto mb-2" /><p className="text-sm text-slate-500">Loading...</p></div>
        ) : records.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">No analyses yet.</p>
        ) : (
          <div className="space-y-2">
            {records.map((rec) => (
              <div key={rec.id} className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-all group">
                <div className="flex-1 cursor-pointer" onClick={() => loadRecord(rec.id)}>
                  <div className="flex items-center space-x-2 mb-1">
                    {rec.status === 'completed' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : rec.status === 'failed' ? <XCircle className="w-4 h-4 text-red-400" /> : <Clock className="w-4 h-4 text-amber-400" />}
                    <span className="text-sm font-medium text-white group-hover:text-cyan-400">{rec.location || 'Unknown'}</span>
                    <span className="text-xs text-slate-600">#{rec.id}</span>
                  </div>
                  <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                    {rec.total_cost && <span>{formatINR(rec.total_cost)}</span>}
                    {rec.premises && <span>{rec.premises.toLocaleString('en-IN')} premises</span>}
                    {rec.route_km && <span>{rec.route_km} km</span>}
                    {rec.detected_buildings && <span>{rec.detected_buildings.toLocaleString('en-IN')} buildings</span>}
                    {rec.duration && <span>{rec.duration.toFixed(1)}s</span>}
                    <span>{new Date(rec.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    {user?.role === 'admin' && rec.user_email && <span className="text-cyan-400/50">{rec.user_email}</span>}
                  </div>
                  {rec.recommended && <p className="text-xs text-cyan-400 mt-1">Recommended: {rec.recommended}</p>}
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  {/* Load into dashboard */}
                  <button onClick={() => loadRecord(rec.id)} disabled={loadingResult === rec.id}
                    className="px-3 py-1.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-lg text-xs hover:bg-cyan-500/20 transition-all flex items-center space-x-1">
                    {loadingResult === rec.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
                    <span>Open</span>
                  </button>
                  {/* PDF */}
                  {rec.status === 'completed' && (
                    <button onClick={() => downloadPDF(rec.id)} disabled={downloadingPdf === rec.id}
                      className="px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs hover:bg-red-500/20 transition-all flex items-center space-x-1">
                      {downloadingPdf === rec.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3" />}
                      <span>PDF</span>
                    </button>
                  )}
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${rec.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : rec.status === 'failed' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>{rec.status}</span>
                </div>
              </div>))}
          </div>
        )}
      </DashboardCard>
    </div>
  );
}
