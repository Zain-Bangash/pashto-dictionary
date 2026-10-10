/**
 * Admin promotes users to moderator and demotes moderators — DashboardUsers
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import { getUsers, changeUserRole } from '../../services/api';
import DashboardUsers from '../../pages/dashboard/DashboardUsers';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  getUsers: vi.fn(),
  changeUserRole: vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'me', role: 'admin' }, token: 'tok' }),
}));

const person = (overrides = {}) => ({ _id: 'u1', username: 'alice', email: 'a@x.test', role: 'user', ...overrides });

function mockPage(data, total = data.length) {
  getUsers.mockResolvedValue({ data: { success: true, data, meta: { page: 1, limit: 20, total } } });
}

const renderPage = () => render(<MemoryRouter><DashboardUsers /></MemoryRouter>);
const rowOf = async (name) => (await screen.findByText(name)).closest('li');

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Role buttons', () => {
  it('offers Make moderator for users and Remove moderator for moderators', async () => {
    mockPage([person(), person({ _id: 'u2', username: 'bob', role: 'moderator' })]);
    renderPage();

    expect(within(await rowOf('alice')).getByRole('button', { name: 'Make moderator' })).toBeInTheDocument();
    expect(within(await rowOf('bob')).getByRole('button', { name: 'Remove moderator' })).toBeInTheDocument();
  });

  it('shows no role button for admins or for yourself', async () => {
    mockPage([person({ _id: 'u3', username: 'root', role: 'admin' }), person({ _id: 'me', username: 'myself', role: 'user' })]);
    renderPage();

    expect(within(await rowOf('root')).queryByRole('button')).not.toBeInTheDocument();
    expect(within(await rowOf('myself')).queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('Confirming a role change', () => {
  it('promotes after confirmation, sends the optional note and updates the row', async () => {
    const user = userEvent.setup();
    mockPage([person()]);
    changeUserRole.mockResolvedValue({ data: { success: true, data: person({ role: 'moderator' }) } });
    renderPage();

    await user.click(within(await rowOf('alice')).getByRole('button', { name: 'Make moderator' }));
    const dialog = screen.getByRole('dialog', { name: 'Make moderator' });
    expect(changeUserRole).not.toHaveBeenCalled();
    await user.type(within(dialog).getByLabelText(/note/i), 'trusted reviewer');
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));

    expect(changeUserRole).toHaveBeenCalledWith('u1', { role: 'moderator', note: 'trusted reviewer' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(within(await rowOf('alice')).getByRole('button', { name: 'Remove moderator' })).toBeInTheDocument();
  });

  it('demotes without a note', async () => {
    const user = userEvent.setup();
    mockPage([person({ role: 'moderator' })]);
    changeUserRole.mockResolvedValue({ data: { success: true, data: person({ role: 'user' }) } });
    renderPage();

    await user.click(within(await rowOf('alice')).getByRole('button', { name: 'Remove moderator' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }));

    expect(changeUserRole).toHaveBeenCalledWith('u1', { role: 'user' });
  });

  it('cancelling does not call the API', async () => {
    const user = userEvent.setup();
    mockPage([person()]);
    renderPage();

    await user.click(within(await rowOf('alice')).getByRole('button', { name: 'Make moderator' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(changeUserRole).not.toHaveBeenCalled();
  });

  it('shows the server message and keeps the dialog open when the change fails', async () => {
    const user = userEvent.setup();
    mockPage([person()]);
    changeUserRole.mockRejectedValue({ response: { data: { error: { message: 'alice is already a moderator' } } } });
    renderPage();

    await user.click(within(await rowOf('alice')).getByRole('button', { name: 'Make moderator' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }));

    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent('alice is already a moderator');
  });
});

describe('Pagination', () => {
  it('loads the next page of users', async () => {
    const user = userEvent.setup();
    mockPage([person()], 45);
    renderPage();

    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(getUsers).toHaveBeenLastCalledWith({ page: 2, limit: 20 }));
  });

  it('hides pagination when everything fits on one page', async () => {
    mockPage([person()]);
    renderPage();

    await screen.findByText('alice');
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  });
});
