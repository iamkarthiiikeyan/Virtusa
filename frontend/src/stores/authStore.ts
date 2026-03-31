import { create } from 'zustand';

const API = 'http://localhost:8000';

interface AuthUser {
  email: string;
  name: string;
  role: string;
}

interface AuthStore {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  checked: boolean; // true after initial token validation

  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, name: string, password: string, role?: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  token: localStorage.getItem('atlas_token'),
  isLoading: false,
  error: null,
  checked: false,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const err = await res.json();
        set({ isLoading: false, error: err.detail || 'Login failed' });
        return false;
      }
      const data = await res.json();
      localStorage.setItem('atlas_token', data.token);
      set({ user: data.user, token: data.token, isLoading: false, checked: true });
      return true;
    } catch {
      set({ isLoading: false, error: 'Cannot reach server' });
      return false;
    }
  },

  register: async (email, name, password, role = 'planner') => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, password, role }),
      });
      if (!res.ok) {
        const err = await res.json();
        set({ isLoading: false, error: err.detail || 'Registration failed' });
        return false;
      }
      const data = await res.json();
      localStorage.setItem('atlas_token', data.token);
      set({ user: data.user, token: data.token, isLoading: false, checked: true });
      return true;
    } catch {
      set({ isLoading: false, error: 'Cannot reach server' });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('atlas_token');
    set({ user: null, token: null, checked: true });
  },

  checkAuth: async () => {
    const token = get().token;
    if (!token) {
      set({ checked: true });
      return;
    }
    try {
      const res = await fetch(`${API}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated) {
          set({ user: data.user, checked: true });
        } else {
          // Token valid but user not found
          localStorage.removeItem('atlas_token');
          set({ user: null, token: null, checked: true });
        }
      } else {
        // 401 or any error — token is invalid, clear it
        localStorage.removeItem('atlas_token');
        set({ user: null, token: null, checked: true });
      }
    } catch {
      // Backend unreachable — clear token so user can re-login when backend is back
      localStorage.removeItem('atlas_token');
      set({ user: null, token: null, checked: true });
    }
  },
}));
