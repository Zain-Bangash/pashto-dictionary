import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken]           = useState(() => localStorage.getItem('token'));
  const [user, setUser]             = useState(null);
  const [initializing, setInitializing] = useState(!!localStorage.getItem('token'));

  useEffect(() => {
    if (!token) { setInitializing(false); return; }
    api.get('/api/auth/me')
      .then((res) => setUser(res.data.data.user))
      .catch(() => {
        // Token expired or invalid — clear it
        localStorage.removeItem('token');
        setToken(null);
      })
      .finally(() => setInitializing(false));
  }, []); // intentionally runs once on mount only

  function login(userData, jwt) {
    setUser(userData);
    setToken(jwt);
    localStorage.setItem('token', jwt);
  }

  function logout() {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, initializing }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
