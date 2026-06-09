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
