import { createContext, useContext, useState, useEffect } from 'react';
import {
  loginRequest,
  registerRequest,
  logoutRequest,
  refreshSession,
  setToken,
  clearToken,
  setLogoutHandler,
} from '../services/api';
import { broadcastLogout, onLogoutBroadcast } from '../services/sessionSync';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    setLogoutHandler(() => setUser(null));
    const unsubscribe = onLogoutBroadcast(() => {
      clearToken();
      setUser(null);
    });

    refreshSession()
      .then(({ user: restored }) => setUser(restored))
      .catch(() => clearToken())
      .finally(() => setInitializing(false));

    return unsubscribe;
  }, []);

  async function login(email, password) {
    try {
      const res = await loginRequest({ email, password });
      setToken(res.data.data.token);
      setUser(res.data.data.user);
    } catch (err) {
      if (err?.response?.status === 401) throw new Error('Invalid email or password');
      throw new Error(err?.response?.data?.error?.message ?? err?.message ?? 'Login failed');
    }
  }

  async function register(username, email, password, region, village) {
    try {
      const res = await registerRequest({ username, email, password, region, village });
      setToken(res.data.data.token);
      setUser(res.data.data.user);
    } catch (err) {
      const field = err?.response?.data?.error?.field ?? '';
      const msg = err?.response?.data?.error?.message ?? err?.message ?? 'Registration failed';
      if (field === 'email' || msg.toLowerCase().includes('email')) {
        throw Object.assign(new Error(msg), { name: 'UsernameExistsException' });
      }
      throw new Error(msg);
    }
  }

  async function logout() {
    clearToken();
    setUser(null);
    broadcastLogout();
    await logoutRequest().catch(() => {});
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, initializing }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
