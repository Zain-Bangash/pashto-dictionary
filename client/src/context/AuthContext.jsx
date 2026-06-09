import { signIn, signUp, signOut, getCurrentUser } from '@aws-amplify/auth';
import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    getCurrentUser()
      .then(() => api.get('/api/auth/me').then((res) => setUser(res.data.data.user)))
      .catch(() => {})
      .finally(() => setInitializing(false));
  }, []);

  async function login(email, password) {
    await signIn({ username: email.toLowerCase(), password });
    const res = await api.get('/api/auth/me');
    setUser(res.data.data.user);
  }

  async function register(username, email, password, region, village) {
    await signUp({
      username: email.toLowerCase(),
      password,
      options: {
        userAttributes: {
          email: email.toLowerCase(),
          preferred_username: username,
        },
      },
    });
    await signIn({ username: email.toLowerCase(), password });
    const res = await api.get('/api/auth/me');
    setUser(res.data.data.user);
  }

  async function logout() {
    await signOut();
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
