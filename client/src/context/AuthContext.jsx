import { createContext, useContext, useState, useEffect } from 'react';
import api, { setToken, clearToken, getToken, setLogoutHandler } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    setLogoutHandler(() => setUser(null));

    if (!getToken()) {
      setInitializing(false);
      return;
    }
    api.get('/api/auth/me')
      .then((res) => setUser(res.data.data.user))
      .catch(() => clearToken())
      .finally(() => setInitializing(false));
  }, []);

  async function login(email, password) {
    const res = await api.post('/api/auth/login', { email, password });
    setToken(res.data.data.token);
    setUser(res.data.data.user);
  }

  async function register(username, email, password, region, village) {
    try {
      const res = await api.post('/api/auth/register', { username, email, password, region, village });
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
