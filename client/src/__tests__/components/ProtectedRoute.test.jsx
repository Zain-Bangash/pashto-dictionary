import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import ProtectedRoute from '../../components/ProtectedRoute';

// AuthContext must be created by the coder. Tests mock it to control auth state.
const mockUseAuth = vi.fn();

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const renderWithAuth = (authValue, initialEntries = ['/protected']) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route
          path="/protected"
          element={
            <ProtectedRoute>
              <div>Protected content</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProtectedRoute component', () => {
  it('renders children when user is authenticated', () => {
    mockUseAuth.mockReturnValue({ user: { _id: '1', role: 'user' }, token: 'jwt-token' });
    renderWithAuth({ user: { _id: '1', role: 'user' }, token: 'jwt-token' });
    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it('redirects to /login when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, token: null });
    renderWithAuth({ user: null, token: null });
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('does not render children when token is absent', () => {
    mockUseAuth.mockReturnValue({ user: null, token: undefined });
    renderWithAuth({ user: null, token: undefined });
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('preserves the attempted URL so login can redirect back', () => {
    // After redirect to /login the login page should know where to go back to.
    // The ProtectedRoute must pass state={{ from: location }} to the Navigate.
    mockUseAuth.mockReturnValue({ user: null, token: null });
    const { container } = render(
      <MemoryRouter initialEntries={['/submit']}>
        <Routes>
          <Route
            path="/submit"
            element={
              <ProtectedRoute>
                <div>Submit page</div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/login"
            element={<LoginCapture />}
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId('from-path')).toHaveTextContent('/submit');
  });
});

function LoginCapture() {
  // Reads the location state set by ProtectedRoute's Navigate
  const { useLocation } = require('react-router-dom');
  const location = useLocation();
  return <div data-testid="from-path">{location.state?.from?.pathname ?? ''}</div>;
}
