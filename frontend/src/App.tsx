import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import BuildRequests from './pages/BuildRequests';
import NetworkPlanner from './pages/NetworkPlanner';
import ScenarioSimulator from './pages/ScenarioSimulator';
import DigitalTwinLab from './pages/DigitalTwinLab';
import CostIntelligence from './pages/CostIntelligence';
import RiskAnalytics from './pages/RiskAnalytics';
import DecisionInsights from './pages/DecisionInsights';
import Reports from './pages/Reports';
import Governance from './pages/Governance';
import Settings from './pages/Settings';
import Guidelines from './pages/Guidelines';
import Compare from './pages/Compare';
import Topology from './pages/Topology';
import AIChat from './pages/AIChat';
import Login from './pages/Login';
import { useAuthStore } from './stores/authStore';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { token, checked, checkAuth, logout } = useAuthStore();
  const location = useLocation();

  // Always require fresh login on app load
  useEffect(() => {
    if (!checked) {
      logout(); // Clear any existing token — force login every time
    }
  }, []);

  // Show loading while validating token
  if (!checked) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Verifying session...</p>
        </div>
      </div>
    );
  }

  // After check: no valid token → redirect to login
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={
          <AuthGuard>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/build-requests" element={<BuildRequests />} />
                <Route path="/network-planner" element={<NetworkPlanner />} />
                <Route path="/scenario-simulator" element={<ScenarioSimulator />} />
                <Route path="/digital-twin" element={<DigitalTwinLab />} />
                <Route path="/cost-intelligence" element={<CostIntelligence />} />
                <Route path="/risk-analytics" element={<RiskAnalytics />} />
                <Route path="/decision-insights" element={<DecisionInsights />} />
                <Route path="/topology" element={<Topology />} />
                <Route path="/ai-chat" element={<AIChat />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/compare" element={<Compare />} />
                <Route path="/governance" element={<Governance />} />
                <Route path="/guidelines" element={<Guidelines />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </Layout>
          </AuthGuard>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
