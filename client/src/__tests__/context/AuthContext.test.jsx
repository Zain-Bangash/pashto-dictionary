import { useState } from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, beforeEach, describe, it, expect } from 'vitest';

vi.mock('../../services/api', () => ({
  loginRequest: vi.fn(),
  registerRequest: vi.fn(),
  logoutRequest: vi.fn(),
  refreshSession: vi.fn(),
  setToken: vi.fn(),
  clearToken: vi.fn(),
  setLogoutHandler: vi.fn(),
}));

let broadcastListener = null;
vi.mock('../../services/sessionSync', () => ({
  broadcastLogout: vi.fn(),
  onLogoutBroadcast: vi.fn((fn) => {
    broadcastListener = fn;
    return () => { broadcastListener = null; };
  }),
}));

import {
  loginRequest, logoutRequest, refreshSession, setToken, clearToken,
} from '../../services/api';
import { broadcastLogout } from '../../services/sessionSync';
import { AuthProvider, useAuth } from '../../context/AuthContext';

function AuthConsumer() {
  const { user, login, logout, initializing } = useAuth();
  return (
    <div>
      <span data-testid="init">{initializing ? 'loading' : 'ready'}</span>
      <span data-testid="user">{user ? user._id : 'null'}</span>
      <button onClick={() => login('test@test.com', 'password123')}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

const renderProvider = () =>
  render(
    <MemoryRouter>
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    </MemoryRouter>
  );

const noSession = () => Promise.reject(Object.assign(new Error('401'), { response: { status: 401 } }));

beforeEach(() => {
  vi.clearAllMocks();
  refreshSession.mockImplementation(noSession);
  logoutRequest.mockResolvedValue({});
});

describe('AuthContext', () => {
  it('provides null user when not authenticated', async () => {
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('null'));
  });

  it('login() sets user in context', async () => {
    loginRequest.mockResolvedValue({ data: { data: { token: 'tok1', user: { _id: 'u1', role: 'user' } } } });
    renderProvider();
    await act(async () => {
      screen.getByRole('button', { name: /login/i }).click();
    });
    expect(screen.getByTestId('user')).toHaveTextContent('u1');
    expect(setToken).toHaveBeenCalledWith('tok1');
  });

  it('logout() clears user from context', async () => {
    loginRequest.mockResolvedValue({ data: { data: { token: 'tok1', user: { _id: 'u1', role: 'user' } } } });
    renderProvider();
    await act(async () => { screen.getByRole('button', { name: /login/i }).click(); });
    await act(async () => { screen.getByRole('button', { name: /logout/i }).click(); });
    expect(screen.getByTestId('user')).toHaveTextContent('null');
    expect(clearToken).toHaveBeenCalled();
  });

  describe('login() errors', () => {
    function ErrorConsumer() {
      const { login } = useAuth();
      const [msg, setMsg] = useState('');
      return (
        <div>
          <button onClick={() => login('a@b.com', 'pw').catch((e) => setMsg(e.message))}>Go</button>
          <span data-testid="msg">{msg}</span>
        </div>
      );
    }

    const loginWith = async (response) => {
      loginRequest.mockRejectedValue({ message: 'Request failed', response });
      render(
        <MemoryRouter>
          <AuthProvider>
            <ErrorConsumer />
          </AuthProvider>
        </MemoryRouter>
      );
      await act(async () => { screen.getByRole('button', { name: /go/i }).click(); });
    };

    it('throws "Invalid email or password" on a 401', async () => {
      await loginWith({ status: 401, data: { error: { message: 'Invalid credentials' } } });
      expect(screen.getByTestId('msg')).toHaveTextContent('Invalid email or password');
      expect(setToken).not.toHaveBeenCalled();
    });

    it('throws the server message on a 429', async () => {
      await loginWith({ status: 429, data: { error: { message: 'Too many requests, please try again later.' } } });
      expect(screen.getByTestId('msg')).toHaveTextContent('Too many requests, please try again later.');
    });

    it('throws the server message on a 400', async () => {
      await loginWith({ status: 400, data: { error: { message: 'valid email is required', field: 'email' } } });
      expect(screen.getByTestId('msg')).toHaveTextContent('valid email is required');
    });
  });

  it('logout() calls the logout endpoint and tells other tabs', async () => {
    loginRequest.mockResolvedValue({ data: { data: { token: 'tok1', user: { _id: 'u1', role: 'user' } } } });
    renderProvider();
    await act(async () => { screen.getByRole('button', { name: /login/i }).click(); });
    await act(async () => { screen.getByRole('button', { name: /logout/i }).click(); });
    expect(logoutRequest).toHaveBeenCalledTimes(1);
    expect(broadcastLogout).toHaveBeenCalledTimes(1);
  });

  it('logout() still clears the user when the logout request fails', async () => {
    loginRequest.mockResolvedValue({ data: { data: { token: 'tok1', user: { _id: 'u1', role: 'user' } } } });
    logoutRequest.mockRejectedValue(new Error('network'));
    renderProvider();
    await act(async () => { screen.getByRole('button', { name: /login/i }).click(); });
    await act(async () => { screen.getByRole('button', { name: /logout/i }).click(); });
    expect(screen.getByTestId('user')).toHaveTextContent('null');
  });

  it('restores user from the refresh cookie on mount', async () => {
    refreshSession.mockResolvedValue({ token: 'tok', user: { _id: 'u1', role: 'user' } });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('u1'));
    expect(refreshSession).toHaveBeenCalled();
  });

  it('stays initializing until the session check settles, so protected routes do not redirect early', async () => {
    let resolve;
    refreshSession.mockReturnValue(new Promise((r) => { resolve = r; }));
    renderProvider();
    expect(screen.getByTestId('init')).toHaveTextContent('loading');
    await act(async () => { resolve({ token: 'tok', user: { _id: 'u1' } }); });
    expect(screen.getByTestId('init')).toHaveTextContent('ready');
    expect(screen.getByTestId('user')).toHaveTextContent('u1');
  });

  it('stays unauthenticated when no session exists on mount', async () => {
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('init')).toHaveTextContent('ready'));
    expect(screen.getByTestId('user')).toHaveTextContent('null');
    expect(clearToken).toHaveBeenCalled();
  });

  it('logs out when another tab broadcasts a logout', async () => {
    refreshSession.mockResolvedValue({ token: 'tok', user: { _id: 'u1', role: 'user' } });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('u1'));
    await act(async () => { broadcastListener(); });
    expect(screen.getByTestId('user')).toHaveTextContent('null');
    expect(clearToken).toHaveBeenCalled();
    expect(logoutRequest).not.toHaveBeenCalled();
  });
});
