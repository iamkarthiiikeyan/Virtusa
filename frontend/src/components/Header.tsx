import { useState, useEffect, useRef } from 'react';
import { Search, Bell, Activity, LogOut, User, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const API = 'http://localhost:8000';

interface Notification {
  id: number; location: string; status: string; approval_status: string;
  approved_by: string; created_at: string;
}

export default function Header() {
  const { user, token, logout } = useAuthStore();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [seen, setSeen] = useState<Set<number>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);

  // Poll for notification-worthy records
  useEffect(() => {
    if (!token) return;
    const fetchNotifs = () => {
      const headers: Record<string, string> = { 'Authorization': `Bearer ${token}` };
      fetch(`${API}/api/v1/records?limit=20`, { headers })
        .then(r => r.json())
        .then(data => {
          const recs = data.records || [];
          // For planners: show approved/rejected items
          // For admins: show newly completed items pending review
          const notifItems = recs.filter((r: any) => {
            if (user?.role === 'admin') return r.status === 'completed' && r.approval_status === 'pending_review';
            return r.approval_status === 'approved' || r.approval_status === 'rejected';
          }).map((r: any) => ({
            id: r.id, location: r.location, status: r.status,
            approval_status: r.approval_status, approved_by: r.approved_by || '',
            created_at: r.created_at,
          }));
          setNotifications(notifItems);
        })
        .catch(() => {});
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, [token, user]);

  // Close panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setShowNotifs(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unseenCount = notifications.filter(n => !seen.has(n.id)).length;

  const handleLogout = () => { logout(); navigate('/login'); };

  const openNotif = (n: Notification) => {
    setSeen(prev => new Set([...prev, n.id]));
    setShowNotifs(false);
    navigate('/governance');
  };

  return (
    <header className="bg-slate-950/80 backdrop-blur-xl border-b border-slate-800 fixed top-0 right-0 left-64 z-20 h-16">
      <div className="h-full px-6 flex items-center justify-between">
        <div className="flex-1 max-w-lg">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input type="text" placeholder="Search deployments, scenarios..."
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-11 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all" />
          </div>
        </div>

        <div className="flex items-center space-x-3 ml-4">
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-emerald-400">AI Active</span>
          </div>

          {/* Notification bell */}
          <div className="relative" ref={panelRef}>
            <button onClick={() => { setShowNotifs(!showNotifs); if (!showNotifs) setSeen(new Set(notifications.map(n => n.id))); }}
              className="relative p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-lg transition-all">
              <Bell className="w-5 h-5" />
              {unseenCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white">
                  {unseenCount > 9 ? '9+' : unseenCount}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className="absolute right-0 top-12 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-slate-800">
                  <h3 className="text-sm font-semibold text-white">Notifications</h3>
                  <p className="text-xs text-slate-500">{notifications.length > 0 ? `${notifications.length} items` : 'No notifications'}</p>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center"><Bell className="w-8 h-8 text-slate-700 mx-auto mb-2" /><p className="text-xs text-slate-500">All caught up</p></div>
                  ) : notifications.map(n => (
                    <div key={n.id} onClick={() => openNotif(n)}
                      className="px-4 py-3 border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer transition-all">
                      <div className="flex items-start space-x-2">
                        {n.approval_status === 'approved' ? <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" /> :
                         n.approval_status === 'rejected' ? <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" /> :
                         <Clock className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />}
                        <div>
                          <p className="text-xs text-white font-medium">{n.location || 'Analysis'} #{n.id}</p>
                          <p className="text-xs text-slate-400">
                            {n.approval_status === 'approved' ? `Approved by ${n.approved_by}` :
                             n.approval_status === 'rejected' ? `Rejected by ${n.approved_by}` :
                             'Pending your review'}
                          </p>
                          <p className="text-[10px] text-slate-600 mt-0.5">{new Date(n.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {notifications.length > 0 && (
                  <div className="px-4 py-2 border-t border-slate-800">
                    <button onClick={() => { setShowNotifs(false); navigate('/governance'); }}
                      className="w-full text-xs text-cyan-400 hover:text-cyan-300 text-center py-1">View all in Governance</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {user && (
            <>
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                <div className="w-7 h-7 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-medium text-white leading-tight">{user.name}</p>
                  <p className="text-[10px] text-slate-500 leading-tight capitalize">{user.role}</p>
                </div>
              </div>
              <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800/50 rounded-lg transition-all" title="Logout">
                <LogOut className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
