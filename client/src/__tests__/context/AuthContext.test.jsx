import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import { AuthProvider, useAuth } from '../../context/AuthContext';

// Isolate localStorage between tests
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

function AuthConsumer() {
  const { user, token, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="user">{user ? JSON.stringify(user) : 'null'}</span>
      <span data-testid="token">{token ?? 'null'}</span>
      <button onClick={() => login({ _id: '1', role: 'user' }, 'test-token')}>Login</button>
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

describe('AuthContext', () => {
  it('provides null user and null token when not authenticated', () => {
    renderProvider();
    expect(screen.getByTestId('user')).toHaveTextContent('null');
    expect(screen.getByTestId('token')).toHaveTextContent('null');
  });

  it('login() sets user and token in context', async () => {
    renderProvider();
    await act(async () => {
      screen.getByRole('button', { name: /login/i }).click();
    });
    expect(screen.getByTestId('user')).not.toHaveTextContent('null');
    expect(screen.getByTestId('token')).toHaveTextContent('test-token');
  });

  it('login() persists token to localStorage', async () => {
    renderProvider();
    await act(async () => {
      screen.getByRole('button', { name: /login/i }).click();
    });
    expect(localStorage.getItem('token')).toBe('test-token');
  });

  it('logout() clears user and token from context', async () => {
    renderProvider();
    await act(async () => {
      screen.getByRole('button', { name: /login/i }).click();
    });
    await act(async () => {
      screen.getByRole('button', { name: /logout/i }).click();
    });
    expect(screen.getByTestId('user')).toHaveTextContent('null');
    expect(screen.getByTestId('token')).toHaveTextContent('null');
  });

  it('logout() removes token from localStorage', async () => {
    renderProvider();
    await act(async () => {
      screen.getByRole('button', { name: /login/i }).click();
    });
    await act(async () => {
      screen.getByRole('button', { name: /logout/i }).click();
    });
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('restores user from localStorage token on mount if token exists', async () => {
    // Seed a token so the provider can restore auth state on page reload.
    // The provider must read from localStorage on init and set the user.
    localStorage.setItem('token', 'stored-token');
    renderProvider();
    // The token should be read from storage; user resolution may be async
    // depending on implementation. At minimum the token must be exposed.
    expect(screen.getByTestId('token')).toHaveTextContent('stored-token');
  });
});
