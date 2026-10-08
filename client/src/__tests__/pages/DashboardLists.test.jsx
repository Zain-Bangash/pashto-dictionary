import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import DashboardLists from '../../pages/dashboard/DashboardLists';
import { createLookup, updateLookup, reorderLookups, deactivateLookup, reactivateLookup } from '../../services/api';
import { LookupsWrapper, LOOKUP_ROWS } from '../helpers/lookups';

vi.mock('../../services/api', () => ({
  createLookup: vi.fn(),
  updateLookup: vi.fn(),
  reorderLookups: vi.fn(),
  deactivateLookup: vi.fn(),
  reactivateLookup: vi.fn(),
}));

const mockUseAuth = vi.fn();
vi.mock('../../context/AuthContext', () => ({ useAuth: () => mockUseAuth() }));

const rows = [
  ...LOOKUP_ROWS,
  { _id: 'r5', type: 'region', key: 'Kurram', label: 'Kurram', order: 5, active: true, isSystem: false },
  { _id: 'r6', type: 'region', key: 'Bajaur', label: 'Bajaur', order: 6, active: false, isSystem: false },
];

const reload = vi.fn(() => Promise.resolve());

const renderPage = (role = 'admin', ctx = {}) => {
  mockUseAuth.mockReturnValue({ user: { _id: 'u1', role } });
  return render(
    <LookupsWrapper rows={rows} reload={reload} {...ctx}>
      <MemoryRouter initialEntries={['/dashboard/lists']}>
        <Routes>
          <Route path="/dashboard/lists" element={<DashboardLists />} />
          <Route path="/dashboard" element={<div>Dashboard home</div>} />
        </Routes>
      </MemoryRouter>
    </LookupsWrapper>
  );
};

const regions = () => screen.getByRole('region', { name: 'Regions' });
const rowFor = (label) => within(regions()).getByText(label).closest('li');

beforeEach(() => vi.clearAllMocks());

describe('DashboardLists page', () => {
  it.each(['moderator', 'user'])('redirects a %s to the dashboard', (role) => {
    renderPage(role);
    expect(screen.getByText('Dashboard home')).toBeInTheDocument();
  });

  it('shows a loading state, and an error state with retry', async () => {
    const user = userEvent.setup();
    const { unmount } = renderPage('admin', { rows: [], loading: true });
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    unmount();
    renderPage('admin', { rows: [], error: 'Could not load list options' });
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(reload).toHaveBeenCalled();
  });

  it('renders both lists including inactive values', () => {
    renderPage();
    expect(within(regions()).getAllByRole('listitem')).toHaveLength(7);
    expect(within(screen.getByRole('region', { name: 'Parts of speech' })).getAllByRole('listitem')).toHaveLength(6);
    expect(within(rowFor('Bajaur')).getByText(/inactive/i)).toBeInTheDocument();
  });

  it('built-in values can be renamed but have no deactivate button', () => {
    renderPage();
    const kohat = rowFor('Kohat');
    expect(within(kohat).getByText(/built-in/i)).toBeInTheDocument();
    expect(within(kohat).getByRole('button', { name: 'Rename' })).toBeInTheDocument();
    expect(within(kohat).queryByRole('button', { name: /deactivate/i })).not.toBeInTheDocument();
  });

  it('renames a label and reloads the lists', async () => {
    const user = userEvent.setup();
    updateLookup.mockResolvedValue({ data: { data: {} } });
    renderPage();
    await user.click(within(rowFor('Kohat')).getByRole('button', { name: 'Rename' }));
    const input = screen.getByLabelText('Label for Kohat');
    await user.clear(input);
    await user.type(input, 'Kohat District');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(updateLookup).toHaveBeenCalledWith('r0', { label: 'Kohat District' });
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });

  it('deactivates an active admin-added value and reactivates an inactive one', async () => {
    const user = userEvent.setup();
    deactivateLookup.mockResolvedValue({});
    reactivateLookup.mockResolvedValue({});
    renderPage();
    await user.click(within(rowFor('Kurram')).getByRole('button', { name: 'Deactivate' }));
    expect(deactivateLookup).toHaveBeenCalledWith('r5');
    await user.click(within(rowFor('Bajaur')).getByRole('button', { name: 'Reactivate' }));
    expect(reactivateLookup).toHaveBeenCalledWith('r6');
  });

  it('moves a value down by sending the full reordered id list', async () => {
    const user = userEvent.setup();
    reorderLookups.mockResolvedValue({});
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Move Kohat down' }));
    expect(reorderLookups).toHaveBeenCalledWith('region', ['r1', 'r0', 'r2', 'r3', 'r4', 'r5', 'r6']);
    expect(screen.getByRole('button', { name: 'Move Kohat up' })).toBeDisabled();
  });

  it('adds a trimmed value and clears the input', async () => {
    const user = userEvent.setup();
    createLookup.mockResolvedValue({ data: { data: {} } });
    renderPage();
    const input = screen.getByLabelText('New regions value');
    await user.type(input, '  Swat  ');
    await user.click(within(regions()).getByRole('button', { name: 'Add' }));
    expect(createLookup).toHaveBeenCalledWith({ type: 'region', label: 'Swat' });
    await waitFor(() => expect(input).toHaveValue(''));
  });

  it('validates an empty value and caps input at 50 characters', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(within(regions()).getByRole('button', { name: 'Add' }));
    expect(within(regions()).getByRole('alert')).toHaveTextContent(/enter a value/i);
    expect(createLookup).not.toHaveBeenCalled();
    expect(screen.getByLabelText('New regions value')).toHaveAttribute('maxLength', '50');
  });

  it('shows the server error message when a change fails', async () => {
    const user = userEvent.setup();
    createLookup.mockRejectedValue({ response: { data: { error: { message: 'That value already exists in this list' } } } });
    renderPage();
    await user.type(screen.getByLabelText('New regions value'), 'kohat');
    await user.click(within(regions()).getByRole('button', { name: 'Add' }));
    expect(await within(regions()).findByRole('alert')).toHaveTextContent('That value already exists in this list');
    expect(reload).not.toHaveBeenCalled();
  });
});
