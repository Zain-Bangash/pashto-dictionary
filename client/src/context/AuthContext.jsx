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
    // Backend creates the Cognito user (SignUp + AdminConfirm) and MongoDB profile.
    // Re-throw backend errors as Amplify-named exceptions so callers handle them uniformly.
    try {
      await api.post('/api/auth/register', { username, email, password, region, village });
    } catch (err) {
      const field = err?.response?.data?.error?.field ?? '';
      const msg = err?.response?.data?.error?.message ?? err?.message ?? 'Registration failed';
      if (field === 'email' || msg.toLowerCase().includes('email')) {
        throw Object.assign(new Error(msg), { name: 'UsernameExistsException' });
      }
      throw new Error(msg);
    }
    // Establish the local Amplify session so fetchAuthSession() works for API calls.
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
