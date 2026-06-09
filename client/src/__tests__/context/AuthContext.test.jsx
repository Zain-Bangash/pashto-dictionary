import { render, screen, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, beforeEach, describe, it, expect } from 'vitest';

vi.mock('@aws-amplify/auth', () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

import { signIn, signOut, getCurrentUser } from '@aws-amplify/auth';
import api from '../../services/api';
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
  getCurrentUser.mockRejectedValue(new Error('No current user'));
});

describe('AuthContext', () => {
  it('provides null user when not authenticated', async () => {
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('null'));
  });

  it('login() sets user in context', async () => {
    signIn.mockResolvedValue({});
    api.get.mockResolvedValue({ data: { data: { user: { _id: 'u1', role: 'user' } } } });
    renderProvider();
    await act(async () => {
      screen.getByRole('button', { name: /login/i }).click();
    });
    expect(screen.getByTestId('user')).toHaveTextContent('u1');
  });

  it('logout() clears user from context', async () => {
    signIn.mockResolvedValue({});
    api.get.mockResolvedValue({ data: { data: { user: { _id: 'u1', role: 'user' } } } });
    signOut.mockResolvedValue({});
    renderProvider();
    await act(async () => { screen.getByRole('button', { name: /login/i }).click(); });
    await act(async () => { screen.getByRole('button', { name: /logout/i }).click(); });
    expect(screen.getByTestId('user')).toHaveTextContent('null');
  });

  it('restores user from existing Cognito session on mount', async () => {
    getCurrentUser.mockResolvedValue({ username: 'test@test.com' });
    api.get.mockResolvedValue({ data: { data: { user: { _id: 'u1', role: 'user' } } } });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('u1'));
  });

  it('stays unauthenticated when no Cognito session exists on mount', async () => {
    getCurrentUser.mockRejectedValue(new Error('No session'));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('null'));
  });
});
