import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import Register from '../../pages/Register';
import api from '../../services/api';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({ login: vi.fn(), user: null })),
}));

const renderRegister = (initialEntries = ['/register']) => {
  let locationRef = {};
  function LocationCapture() {
    locationRef.current = useLocation();
    return null;
  }
  const utils = render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<LocationCapture />} />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>
  );
  return { ...utils, locationRef };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Register page', () => {
  it('renders username, email, password inputs and a submit button', () => {
    renderRegister();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument();
  });

  it('shows a validation error when username is empty on submit', async () => {
    const user = userEvent.setup();
    renderRegister();
    await user.click(screen.getByRole('button', { name: /register/i }));
    expect(await screen.findByText(/username is required/i)).toBeInTheDocument();
  });

  it('shows a validation error when email is empty on submit', async () => {
    const user = userEvent.setup();
    renderRegister();
    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.click(screen.getByRole('button', { name: /register/i }));
    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
  });

  it('shows a validation error when password is shorter than 8 characters', async () => {
    const user = userEvent.setup();
    renderRegister();
    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/email/i), 'test@test.com');
    await user.type(screen.getByLabelText(/password/i), 'short');
    await user.click(screen.getByRole('button', { name: /register/i }));
    expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument();
  });

  it('calls api.post with username, email, and password on valid submit', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValueOnce({
      data: { success: true, data: { token: 'jwt-token', user: { _id: '1', role: 'user' } } },
    });
    renderRegister();
    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/email/i), 'test@test.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /register/i }));
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/auth/register', {
        username: 'testuser',
        email: 'test@test.com',
        password: 'password123',
      });
    });
  });

  it('redirects to / after successful registration', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValueOnce({
      data: { success: true, data: { token: 'jwt-token', user: { _id: '1', role: 'user' } } },
    });
    const { locationRef } = renderRegister();
    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/email/i), 'test@test.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /register/i }));
    await waitFor(() => {
      expect(locationRef.current?.pathname).toBe('/');
    });
  });

  it('shows an error message when the API returns email already taken', async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValueOnce({
      response: { data: { success: false, error: { message: 'Email already in use' } } },
    });
    renderRegister();
    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/email/i), 'taken@test.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /register/i }));
    expect(await screen.findByText(/email already in use/i)).toBeInTheDocument();
  });

  it('disables the submit button while the request is in flight', async () => {
    const user = userEvent.setup();
    api.post.mockReturnValueOnce(new Promise(() => {}));
    renderRegister();
    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/email/i), 'test@test.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /register/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /register/i })).toBeDisabled();
    });
  });

  it('has a link to the login page', () => {
    renderRegister();
    expect(screen.getByRole('link', { name: /log in/i })).toBeInTheDocument();
  });
});
