import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Network, Mail, Lock, User, Loader2, ArrowRight } from 'lucide-react';

export default function Login() {
  const { login, register, isLoading, error, token } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const from = (location.state as any)?.from?.pathname || '/';
  useEffect(() => { if (token) navigate(from, { replace: true }); }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = mode === 'login' ? await login(email, password) : await register(email, name, password);
    if (success) navigate(from, { replace: true });
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a1628', display: 'flex', position: 'relative', overflow: 'hidden' }}>

      {/* Background orbs */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-10%', left: '5%', width: 500, height: 500, background: 'rgba(6,182,212,0.04)', borderRadius: '50%', filter: 'blur(120px)' }} />
        <div style={{ position: 'absolute', bottom: '-10%', right: '0%', width: 500, height: 500, background: 'rgba(59,130,246,0.04)', borderRadius: '50%', filter: 'blur(120px)' }} />

        {/* Animated SVG network */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
          <defs><radialGradient id="ng" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#06b6d4" stopOpacity="0.5"/><stop offset="100%" stopColor="#06b6d4" stopOpacity="0"/></radialGradient></defs>
          <g opacity="0.05" stroke="#06b6d4" strokeWidth="0.5" fill="none">
            <line x1="100" y1="200" x2="350" y2="150"><animate attributeName="opacity" values="0.3;0.8;0.3" dur="4s" repeatCount="indefinite"/></line>
            <line x1="350" y1="150" x2="600" y2="250"><animate attributeName="opacity" values="0.5;1;0.5" dur="3s" repeatCount="indefinite"/></line>
            <line x1="600" y1="250" x2="850" y2="180"><animate attributeName="opacity" values="0.3;0.7;0.3" dur="5s" repeatCount="indefinite"/></line>
            <line x1="850" y1="180" x2="1100" y2="300"><animate attributeName="opacity" values="0.4;0.9;0.4" dur="3.5s" repeatCount="indefinite"/></line>
            <line x1="200" y1="550" x2="450" y2="500"><animate attributeName="opacity" values="0.4;0.8;0.4" dur="3s" repeatCount="indefinite"/></line>
            <line x1="450" y1="500" x2="700" y2="600"><animate attributeName="opacity" values="0.3;0.7;0.3" dur="4s" repeatCount="indefinite"/></line>
            <line x1="700" y1="600" x2="950" y2="530"><animate attributeName="opacity" values="0.5;0.9;0.5" dur="3.5s" repeatCount="indefinite"/></line>
            <line x1="350" y1="150" x2="450" y2="500"><animate attributeName="opacity" values="0.2;0.4;0.2" dur="6s" repeatCount="indefinite"/></line>
            <line x1="600" y1="250" x2="700" y2="600"><animate attributeName="opacity" values="0.2;0.4;0.2" dur="5s" repeatCount="indefinite"/></line>
          </g>
          {[[100,200],[350,150],[600,250],[850,180],[1100,300],[200,550],[450,500],[700,600],[950,530],[300,750],[750,800]].map(([cx,cy],i) => (
            <g key={i}><circle cx={cx} cy={cy} r="10" fill="url(#ng)"><animate attributeName="r" values="6;14;6" dur={`${3+i%3}s`} repeatCount="indefinite"/></circle>
            <circle cx={cx} cy={cy} r="2" fill="#06b6d4" opacity="0.5"><animate attributeName="opacity" values="0.3;0.8;0.3" dur={`${2+i%3}s`} repeatCount="indefinite"/></circle></g>
          ))}
          <circle r="2.5" fill="#06b6d4" opacity="0.7"><animateMotion dur="3s" repeatCount="indefinite" path="M100,200 L350,150 L600,250 L850,180"/></circle>
          <circle r="2" fill="#3b82f6" opacity="0.5"><animateMotion dur="4s" repeatCount="indefinite" path="M200,550 L450,500 L700,600 L950,530"/></circle>
        </svg>
      </div>

      {/* ── Left side ── */}
      <div style={{ display: 'none', position: 'relative', width: '50%', alignItems: 'center', justifyContent: 'center', padding: '80px' }}
        className="lg:!flex">
        <div style={{ position: 'relative', zIndex: 10, maxWidth: 480 }}>

          {/* Badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 999, marginBottom: 40 }}>
            <Network style={{ width: 16, height: 16, color: '#06b6d4' }} />
            <span style={{ fontSize: 13, color: '#94a3b8' }}>Autonomous Fiber Planning v2.0</span>
          </div>

          {/* Brand name */}
          <p style={{ fontSize: 14, fontWeight: 700, color: '#06b6d4', letterSpacing: 4, marginBottom: 12, textTransform: 'uppercase' }}>ATLAS</p>

          {/* Headline */}
          <h1 style={{ fontSize: 56, fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: 24 }}>
            Fiber Network<br />Planning<br />
            <span style={{ color: '#06b6d4' }}>Reimagined.</span>
          </h1>

          {/* Subtitle */}
          <p style={{ fontSize: 16, color: '#64748b', lineHeight: 1.7, maxWidth: 420, marginBottom: 48 }}>
            ATLAS transforms complex FTTP deployment into clear, AI-driven decisions. From satellite detection to cost estimation in 60 seconds.
          </p>

          {/* Divider */}
          <div style={{ width: 48, height: 1, background: '#334155', marginBottom: 32 }} />

          {/* Stats */}
          <div style={{ display: 'flex', gap: 48 }}>
            {[{ v: '7', l: 'AI AGENTS' }, { v: '15', l: 'FEATURES' }, { v: '<60s', l: 'ANALYSIS' }].map((s, i) => (
              <div key={i}>
                <p style={{ fontSize: 28, fontWeight: 700, color: '#fff', margin: 0 }}>{s.v}</p>
                <p style={{ fontSize: 10, color: '#475569', letterSpacing: 2, marginTop: 4 }}>{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right side ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', zIndex: 10 }}>
        <div style={{ width: '100%', maxWidth: 440 }}>

          {/* Card */}
          <div style={{ background: 'rgba(15,29,50,0.85)', backdropFilter: 'blur(24px)', border: '1px solid rgba(71,85,105,0.25)', borderRadius: 24, padding: '44px 40px' }}>

            {/* Centered icon */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
              <div style={{ width: 56, height: 56, background: 'linear-gradient(135deg, #06b6d4, #3b82f6)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(6,182,212,0.2)' }}>
                <Network style={{ width: 28, height: 28, color: '#fff' }} />
              </div>
            </div>

            <h2 style={{ fontSize: 24, fontWeight: 700, color: '#fff', textAlign: 'center', marginBottom: 4 }}>
              {mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p style={{ fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 32 }}>
              {mode === 'login' ? 'Securely access your planning dashboard' : 'Set up your ATLAS account'}
            </p>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                {mode === 'register' && (
                  <div style={{ position: 'relative' }}>
                    <User style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: '#475569' }} />
                    <input type="text" value={name} onChange={e => setName(e.target.value)}
                      placeholder="Full Name" required
                      style={{ width: '100%', background: 'rgba(10,22,40,0.6)', border: '1px solid rgba(71,85,105,0.3)', borderRadius: 14, padding: '14px 14px 14px 42px', fontSize: 14, color: '#e2e8f0', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                )}

                <div style={{ position: 'relative' }}>
                  <Mail style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: '#475569' }} />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="Email" required
                    style={{ width: '100%', background: 'rgba(10,22,40,0.6)', border: '1px solid rgba(71,85,105,0.3)', borderRadius: 14, padding: '14px 14px 14px 42px', fontSize: 14, color: '#e2e8f0', outline: 'none', boxSizing: 'border-box' }} />
                </div>

                <div style={{ position: 'relative' }}>
                  <Lock style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: '#475569' }} />
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Password" required minLength={4}
                    style={{ width: '100%', background: 'rgba(10,22,40,0.6)', border: '1px solid rgba(71,85,105,0.3)', borderRadius: 14, padding: '14px 14px 14px 42px', fontSize: 14, color: '#e2e8f0', outline: 'none', boxSizing: 'border-box' }} />
                </div>

                {error && (
                  <div style={{ padding: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 14, fontSize: 13, color: '#f87171', textAlign: 'center' }}>{error}</div>
                )}

                <button type="submit" disabled={isLoading}
                  style={{ width: '100%', padding: 16, background: '#fff', color: '#0a1628', borderRadius: 14, fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8, opacity: isLoading ? 0.5 : 1 }}>
                  {isLoading ? <Loader2 style={{ width: 20, height: 20, animation: 'spin 1s linear infinite' }} /> : <><span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span><ArrowRight style={{ width: 16, height: 16 }} /></>}
                </button>
              </div>
            </form>

            <p style={{ textAlign: 'center', fontSize: 13, color: '#475569', marginTop: 24 }}>
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                style={{ color: '#06b6d4', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                {mode === 'login' ? 'Sign Up' : 'Sign In'}
              </button>
            </p>
          </div>

        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}} input::placeholder{color:#475569!important} input:focus{border-color:rgba(6,182,212,0.4)!important} @media(min-width:1024px){.lg\\:!flex{display:flex!important}}`}</style>
    </div>
  );
}