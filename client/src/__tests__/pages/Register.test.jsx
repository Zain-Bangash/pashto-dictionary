import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import Register from '../../pages/Register';
import { useAuth } from '../../context/AuthContext';
import { LookupsWrapper, LOOKUP_ROWS } from '../helpers/lookups';

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

describe('Register region list', () => {
  it('uses the shared admin-maintained region list: active values only, labels shown, key submitted', async () => {
    const user = userEvent.setup();
    mockRegister.mockResolvedValue();
    const rows = [
      ...LOOKUP_ROWS,
      { _id: 'r5', type: 'region', key: 'Kurram', label: 'Kurram Valley', order: 5, active: true, isSystem: false },
      { _id: 'r6', type: 'region', key: 'Bajaur', label: 'Bajaur', order: 6, active: false, isSystem: false },
    ];
    render(
      <LookupsWrapper rows={rows}>
        <MemoryRouter initialEntries={['/register']}>
          <Routes>
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<div>home</div>} />
          </Routes>
        </MemoryRouter>
      </LookupsWrapper>
    );
    const select = screen.getByLabelText(/region/i);
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
    expect(options).toEqual(['Select your region…', 'Kohat', 'Hangu', 'Tirah', 'Thal', 'Parachinar', 'Kurram Valley']);

    await user.type(screen.getByLabelText(/username/i), 'zain');
    await user.type(screen.getByLabelText(/email/i), 'z@test.local');
    await user.type(screen.getByLabelText(/password/i), 'Password1!');
    await user.selectOptions(select, 'Kurram Valley');
    await user.click(screen.getByRole('button', { name: /create account|register|sign up/i }));
    await waitFor(() => expect(mockRegister).toHaveBeenCalledWith('zain', 'z@test.local', 'Password1!', 'Kurram', undefined));
  });
});
