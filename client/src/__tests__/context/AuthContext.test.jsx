import { useState } from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, beforeEach, describe, it, expect } from 'vitest';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  setToken: vi.fn(),
  clearToken: vi.fn(),
  getToken: vi.fn(),
  setLogoutHandler: vi.fn(),
}));

import api, { setToken, clearToken, getToken, setLogoutHandler } from '../../services/api';
import { AuthProvider, useAuth } from '../../context/AuthContext';

function AuthConsumer() {
  const { user, login, logout } = useAuth();
  return (
    <div>
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

beforeEach(() => {
  vi.resetAllMocks();
  getToken.mockReturnValue(null);
});

describe('AuthContext', () => {
  it('provides null user when not authenticated', async () => {
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('null'));
  });

  it('login() sets user in context', async () => {
    api.post.mockResolvedValue({ data: { data: { token: 'tok1', user: { _id: 'u1', role: 'user' } } } });
    renderProvider();
    await act(async () => {
      screen.getByRole('button', { name: /login/i }).click();
    });
    expect(screen.getByTestId('user')).toHaveTextContent('u1');
    expect(setToken).toHaveBeenCalledWith('tok1');
  });

  it('logout() clears user from context', async () => {
    api.post.mockResolvedValue({ data: { data: { token: 'tok1', user: { _id: 'u1', role: 'user' } } } });
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
      api.post.mockRejectedValue({ message: 'Request failed', response });
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

  it('restores user from existing session on mount', async () => {
    getToken.mockReturnValue('existing-token');
    api.get.mockResolvedValue({ data: { data: { user: { _id: 'u1', role: 'user' } } } });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('u1'));
  });

  it('stays unauthenticated when no session exists on mount', async () => {
    getToken.mockReturnValue(null);
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('null'));
  });
});
