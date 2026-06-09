import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import Register from '../../pages/Register';
import { useAuth } from '../../context/AuthContext';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockRegister = vi.fn();

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
  mockRegister.mockReset();
  useAuth.mockReturnValue({ register: mockRegister, user: null });
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

  it('calls context register() with username, email, and password on valid submit', async () => {
    const user = userEvent.setup();
    mockRegister.mockResolvedValue(undefined);
    renderRegister();
    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/email/i), 'test@test.com');
    await user.type(screen.getByLabelText(/password/i), 'Password1!');
    await user.click(screen.getByRole('button', { name: /register/i }));
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(
        'testuser', 'test@test.com', 'Password1!', undefined, undefined
      );
    });
  });

  it('redirects to / after successful registration', async () => {
    const user = userEvent.setup();
    mockRegister.mockResolvedValue(undefined);
    const { locationRef } = renderRegister();
    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/email/i), 'test@test.com');
    await user.type(screen.getByLabelText(/password/i), 'Password1!');
    await user.click(screen.getByRole('button', { name: /register/i }));
    await waitFor(() => {
      expect(locationRef.current?.pathname).toBe('/');
    });
  });

  it('shows an error message when the email is already taken', async () => {
    const user = userEvent.setup();
    const err = Object.assign(new Error('An account with the given email already exists.'), {
      name: 'UsernameExistsException',
    });
    mockRegister.mockRejectedValue(err);
    renderRegister();
    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/email/i), 'taken@test.com');
    await user.type(screen.getByLabelText(/password/i), 'Password1!');
    await user.click(screen.getByRole('button', { name: /register/i }));
    expect(await screen.findByText(/an account with this email already exists/i)).toBeInTheDocument();
  });

  it('disables the submit button while the request is in flight', async () => {
    const user = userEvent.setup();
    mockRegister.mockReturnValue(new Promise(() => {}));
    renderRegister();
    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/email/i), 'test@test.com');
    await user.type(screen.getByLabelText(/password/i), 'Password1!');
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
