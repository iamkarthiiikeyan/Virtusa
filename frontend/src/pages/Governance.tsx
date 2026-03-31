import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardCard from '../components/DashboardCard';
import { CheckCircle, XCircle, Clock, Lightbulb, Shield, ExternalLink, Loader2, MessageSquare } from 'lucide-react';
import { usePlanningStore } from '../stores/planningStore';
import { useAuthStore } from '../stores/authStore';
import { formatINR } from '../utils/formatINR';

const API = 'http://localhost:8000';

interface DBRecord {
  id: number; location: string; premises: number; total_cost: number;
  route_km: number; risk_score: number; recommended: string;
  building_source: string; detected_buildings: number;
  status: string; user_email: string; duration: number; created_at: string;
  approval_status: string; approved_by: string; approval_comment: string;
}

export default function Governance() {
  const { setCurrentResult } = usePlanningStore();
  const { user, token } = useAuthStore();
  const navigate = useNavigate();
  const [records, setRecords] = useState<DBRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingResult, setLoadingResult] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [commentId, setCommentId] = useState<number | null>(null);
  const [comment, setComment] = useState('');

  const isAdmin = user?.role === 'admin';

  const fetchRecords = () => {
    setLoading(true);
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // Admin uses /records/all to see everyone's plans, planner uses /records (auto-filtered)
    const endpoint = isAdmin ? `${API}/api/v1/records/all?limit=50` : `${API}/api/v1/records?limit=50`;

    fetch(endpoint, { headers })
      .then(res => res.json())
      .then(data => {
        setRecords(data.records || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchRecords(); }, [token, user]);

  const handleApproval = async (recordId: number, action: 'approve' | 'reject') => {
    setActionLoading(recordId);
    try {
      const res = await fetch(`${API}/api/v1/records/${recordId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ action, comment }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.detail || `${action} failed`);
      } else {
        setComment('');
        setCommentId(null);
        fetchRecords(); // Refresh the list
      }
    } catch {
      alert('Network error');
    }
    setActionLoading(null);
  };

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
    } catch {}
    setLoadingResult(null);
  };

  const pendingReview = records.filter(r => r.status === 'completed' && r.approval_status === 'pending_review');
  const approved = records.filter(r => r.approval_status === 'approved');
  const rejected = records.filter(r => r.approval_status === 'rejected');
  const failed = records.filter(r => r.status === 'failed');

  const approvalBadge = (status: string) => {
    if (status === 'approved') return <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-medium">Approved</span>;
    if (status === 'rejected') return <span className="px-2 py-1 bg-red-500/10 text-red-400 rounded-full text-xs font-medium">Rejected</span>;
    return <span className="px-2 py-1 bg-amber-500/10 text-amber-400 rounded-full text-xs font-medium">Pending Review</span>;
  };

  const renderCard = (rec: DBRecord, showActions: boolean) => (
    <div key={rec.id} className="p-5 bg-slate-800/30 rounded-lg border border-slate-700/50">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-sm font-semibold text-white">{rec.location || 'Unknown'}</span>
            <span className="text-xs text-slate-600">#{rec.id}</span>
            {approvalBadge(rec.approval_status)}
          </div>
          {isAdmin && rec.user_email && <p className="text-xs text-slate-400">Submitted by: {rec.user_email}</p>}
          <p className="text-xs text-slate-500 mt-1">
            {new Date(rec.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            {rec.duration && <span> • {rec.duration.toFixed(1)}s</span>}
          </p>
          {rec.approved_by && (
            <p className="text-xs text-slate-500 mt-1">
              {rec.approval_status === 'approved' ? 'Approved' : 'Rejected'} by: <span className="text-slate-300">{rec.approved_by}</span>
              {rec.approval_comment && <span> — "{rec.approval_comment}"</span>}
            </p>
          )}
        </div>
        <span className="px-3 py-1 bg-cyan-500/10 text-cyan-400 rounded-lg text-xs font-medium">
          REQ-{String(rec.id).padStart(4, '0')}
        </span>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-5 gap-3 mb-4 py-3 border-y border-slate-700/50">
        <div>
          <p className="text-xs text-slate-500 mb-1">CAPEX</p>
          <p className="text-sm font-semibold text-emerald-400">{rec.total_cost ? formatINR(rec.total_cost) : 'N/A'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Premises</p>
          <p className="text-sm font-semibold text-white">{rec.premises ? rec.premises.toLocaleString('en-IN') : 'N/A'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Route</p>
          <p className="text-sm font-semibold text-white">{rec.route_km ? `${rec.route_km} km` : 'N/A'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Buildings</p>
          <p className="text-sm font-semibold text-white">{rec.detected_buildings ? rec.detected_buildings.toLocaleString('en-IN') : 'N/A'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Risk</p>
          <p className={`text-sm font-semibold ${(rec.risk_score || 0) > 0.6 ? 'text-red-400' : (rec.risk_score || 0) > 0.3 ? 'text-orange-400' : 'text-emerald-400'}`}>
            {rec.risk_score ? `${(rec.risk_score * 100).toFixed(0)}/100` : 'N/A'}
          </p>
        </div>
      </div>

      {rec.recommended && (
        <div className="mb-4 p-3 bg-cyan-500/5 border border-cyan-500/10 rounded-lg">
          <div className="flex items-start space-x-2">
            <Lightbulb className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-slate-300">AI Recommendation: <span className="text-cyan-400 font-medium">{rec.recommended}</span></p>
          </div>
        </div>
      )}

      {/* Comment box (shown when admin clicks approve/reject) */}
      {commentId === rec.id && (
        <div className="mb-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
          <div className="flex items-center space-x-2 mb-2">
            <MessageSquare className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-400">Add a comment (optional)</span>
          </div>
          <input type="text" value={comment} onChange={e => setComment(e.target.value)}
            placeholder="Reason for approval/rejection..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center space-x-3">
        <button onClick={() => loadRecord(rec.id)} disabled={loadingResult === rec.id}
          className="flex-1 px-4 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-all flex items-center justify-center space-x-2 font-medium text-sm">
          {loadingResult === rec.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
          <span>View Full Analysis</span>
        </button>

        {isAdmin && showActions && (
          <>
            {commentId !== rec.id ? (
              <>
                <button onClick={() => { setCommentId(rec.id); setComment(''); }}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all flex items-center justify-center space-x-2 font-medium text-sm">
                  <CheckCircle className="w-4 h-4" /><span>Approve</span>
                </button>
                <button onClick={() => { setCommentId(rec.id); setComment(''); }}
                  className="px-4 py-2.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-700 transition-all flex items-center justify-center space-x-2 font-medium text-sm">
                  <XCircle className="w-4 h-4" /><span>Reject</span>
                </button>
              </>
            ) : (
              <>
                <button onClick={() => handleApproval(rec.id, 'approve')}
                  disabled={actionLoading === rec.id}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all flex items-center justify-center space-x-2 font-medium text-sm disabled:opacity-50">
                  {actionLoading === rec.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  <span>Confirm Approve</span>
                </button>
                <button onClick={() => handleApproval(rec.id, 'reject')}
                  disabled={actionLoading === rec.id}
                  className="px-4 py-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg hover:bg-red-500/20 transition-all flex items-center justify-center space-x-2 font-medium text-sm disabled:opacity-50">
                  {actionLoading === rec.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  <span>Confirm Reject</span>
                </button>
                <button onClick={() => { setCommentId(null); setComment(''); }}
                  className="px-3 py-2.5 text-slate-400 hover:text-white text-sm">Cancel</button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Governance</h1>
        <p className="text-slate-400">
          {isAdmin ? 'Review and approve deployment plans from all users' : 'Track your submitted plans and approval status'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Pending Review', count: pendingReview.length, color: 'amber', icon: Clock },
          { label: 'Approved', count: approved.length, color: 'emerald', icon: CheckCircle },
          { label: 'Rejected', count: rejected.length, color: 'red', icon: XCircle },
          { label: 'Failed', count: failed.length, color: 'slate', icon: XCircle },
        ].map((s, i) => (
          <div key={i} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 text-center">
            <s.icon className={`w-5 h-5 text-${s.color}-400 mx-auto mb-1`} />
            <p className="text-2xl font-bold text-white">{s.count}</p>
            <p className="text-xs text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Role badge */}
      <div className={`flex items-center space-x-2 px-4 py-2 rounded-lg border w-fit ${isAdmin ? 'bg-purple-500/10 border-purple-500/20' : 'bg-cyan-500/10 border-cyan-500/20'}`}>
        <Shield className={`w-4 h-4 ${isAdmin ? 'text-purple-400' : 'text-cyan-400'}`} />
        <span className={`text-sm font-medium ${isAdmin ? 'text-purple-400' : 'text-cyan-400'}`}>
          {isAdmin ? 'Admin — You can approve/reject plans' : `Planner — ${user?.email}`}
        </span>
      </div>

      {/* Pending Review */}
      {pendingReview.length > 0 && (
        <DashboardCard title={`Pending Review (${pendingReview.length})`}>
          {loading ? <div className="text-center py-8"><Loader2 className="w-6 h-6 text-slate-500 animate-spin mx-auto" /></div> : (
            <div className="space-y-4">{pendingReview.map(rec => renderCard(rec, true))}</div>
          )}
        </DashboardCard>
      )}

      {pendingReview.length === 0 && !loading && (
        <DashboardCard title="Pending Review">
          <div className="text-center py-8">
            <CheckCircle className="w-10 h-10 text-emerald-500/30 mx-auto mb-3" />
            <p className="text-slate-400">No plans pending review</p>
          </div>
        </DashboardCard>
      )}

      {/* Approved */}
      {approved.length > 0 && (
        <DashboardCard title={`Approved (${approved.length})`}>
          <div className="space-y-4">{approved.map(rec => renderCard(rec, false))}</div>
        </DashboardCard>
      )}

      {/* Rejected */}
      {rejected.length > 0 && (
        <DashboardCard title={`Rejected (${rejected.length})`}>
          <div className="space-y-4">{rejected.map(rec => renderCard(rec, false))}</div>
        </DashboardCard>
      )}
    </div>
  );
}
