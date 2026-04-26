import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  function validate() {
    const errs = {};
    if (!username.trim()) errs.username = 'Username is required';
    if (!email.trim()) errs.email = 'Email is required';
    if (!password || password.length < 8) errs.password = 'Password must be at least 8 characters';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setApiError('');
    setLoading(true);
    try {
      const res = await api.post('/api/auth/register', { username, email, password });
      const { token, user } = res.data.data;
      login(user, token);
      navigate(location.state?.from?.pathname || '/');
    } catch (err) {
      const message = err?.response?.data?.error?.message ?? 'Registration failed';
      setApiError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white/[0.035] backdrop-blur-[24px] border border-white/[0.08] rounded-[20px] p-8 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-display text-warm">Create Account</h1>
          <p className="text-sm font-ui text-muted">Join the پښتو Dictionary community</p>
        </div>

        {apiError && <p className="text-red-400 text-sm font-ui">{apiError}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-xs font-ui font-medium text-muted mb-1.5 uppercase tracking-wider">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-black/40 border border-white/[0.08] rounded-[12px] px-3.5 py-2.5 text-warm text-sm font-ui outline-none focus:border-mint/50 transition-all"
            />
            {errors.username && <p className="text-red-400 text-xs font-ui mt-1">{errors.username}</p>}
          </div>

          <div>
            <label htmlFor="email" className="block text-xs font-ui font-medium text-muted mb-1.5 uppercase tracking-wider">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/40 border border-white/[0.08] rounded-[12px] px-3.5 py-2.5 text-warm text-sm font-ui outline-none focus:border-mint/50 transition-all"
            />
            {errors.email && <p className="text-red-400 text-xs font-ui mt-1">{errors.email}</p>}
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-ui font-medium text-muted mb-1.5 uppercase tracking-wider">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/40 border border-white/[0.08] rounded-[12px] px-3.5 py-2.5 text-warm text-sm font-ui outline-none focus:border-mint/50 transition-all"
            />
            {errors.password && <p className="text-red-400 text-xs font-ui mt-1">{errors.password}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-mint text-charcoal py-2.5 rounded-[12px] text-sm font-ui font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
            style={{ boxShadow: '0 4px 20px rgba(0,245,180,0.3)' }}
          >
            {loading ? 'Register…' : 'Register'}
          </button>
        </form>

        <p className="text-sm font-ui text-center text-muted">
          Already have an account?{' '}
          <Link to="/login" className="text-mint hover:underline">Log In</Link>
        </p>
      </div>
    </div>
  );
}
