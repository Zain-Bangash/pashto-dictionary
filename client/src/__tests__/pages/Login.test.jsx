import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import Login from '../../pages/Login';
import { useAuth } from '../../context/AuthContext';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockLogin = vi.fn();

const renderLogin = (initialEntries = ['/login']) => {
  let locationRef = {};
  function LocationCapture() {
    locationRef.current = useLocation();
    return null;
  }
  const utils = render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<LocationCapture />} />
        <Route path="/register" element={<div>Register page</div>} />
      </Routes>
    </MemoryRouter>
  );
  return { ...utils, locationRef };
};

beforeEach(() => {
  vi.clearAllMocks();
  mockLogin.mockReset();
  useAuth.mockReturnValue({ login: mockLogin, user: null });
});

describe('Login page', () => {
  it('renders email and password inputs and a submit button', () => {
    renderLogin();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('shows a validation error when email field is empty on submit', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
  });

  it('shows a validation error when password field is empty on submit', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText(/email/i), 'test@test.com');
    await user.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
  });

  it('calls context login() with email and password on valid submit', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue(undefined);
    renderLogin();
    await user.type(screen.getByLabelText(/email/i), 'test@test.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /log in/i }));
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@test.com', 'password123');
    });
  });

  it('redirects to / after successful login', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue(undefined);
    const { locationRef } = renderLogin();
    await user.type(screen.getByLabelText(/email/i), 'test@test.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /log in/i }));
    await waitFor(() => {
      expect(locationRef.current?.pathname).toBe('/');
    });
  });

  it('shows an error message when credentials are invalid', async () => {
    const user = userEvent.setup();
    const err = Object.assign(new Error('Incorrect username or password.'), {
      name: 'NotAuthorizedException',
    });
    mockLogin.mockRejectedValue(err);
    renderLogin();
    await user.type(screen.getByLabelText(/email/i), 'wrong@test.com');
    await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument();
  });

  it('shows a loading/disabled state on the submit button while the request is in flight', async () => {
    const user = userEvent.setup();
    mockLogin.mockReturnValue(new Promise(() => {}));
    renderLogin();
    await user.type(screen.getByLabelText(/email/i), 'test@test.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /log in/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /log in/i })).toBeDisabled();
    });
  });

  it('has a link to the register page', () => {
    renderLogin();
    expect(screen.getByRole('link', { name: /register/i })).toBeInTheDocument();
  });
});
