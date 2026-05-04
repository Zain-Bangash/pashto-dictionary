/**
 * Phase 8 — Admin Dashboard
 *
 * Tests for:
 *  - /dashboard          summary stats page
 *  - /dashboard/queue    moderation queue with approve/reject actions (Concepts + Variants tabs)
 *  - /dashboard/entries  all concepts with status filter
 *  - /dashboard/users    user list (admin only)
 *  - /dashboard/log      moderation audit log (admin only)
 *  - DashboardLayout     role-based nav items
 *  - Non-moderator redirect — users with role "user" are sent away from /dashboard/*
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import api from '../../services/api';
import DashboardLayout from '../../pages/dashboard/DashboardLayout';
import DashboardHome from '../../pages/dashboard/DashboardHome';
import DashboardQueue from '../../pages/dashboard/DashboardQueue';
import DashboardConcepts from '../../pages/dashboard/DashboardConcepts';
import DashboardUsers from '../../pages/dashboard/DashboardUsers';
import DashboardLog from '../../pages/dashboard/DashboardLog';

// ---------------------------------------------------------------------------
// Global mock for api service
// ---------------------------------------------------------------------------
vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

// ---------------------------------------------------------------------------
// AuthContext mock — overridden per describe block via mockReturnValue
// ---------------------------------------------------------------------------
const mockUseAuth = vi.fn();
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const asUser = () =>
  mockUseAuth.mockReturnValue({ user: { _id: 'u1', role: 'user' }, token: 'tok' });

const asModerator = () =>
  mockUseAuth.mockReturnValue({ user: { _id: 'u2', role: 'moderator' }, token: 'tok' });

const asAdmin = () =>
  mockUseAuth.mockReturnValue({ user: { _id: 'u3', role: 'admin' }, token: 'tok' });

const mockConcept = (overrides = {}) => ({
  _id: 'e1',
  englishGloss: 'house',
  partOfSpeech: 'noun',
  status: 'pending',
  submittedBy: { username: 'testuser' },
  createdAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

const mockVariant = (overrides = {}) => ({
  _id: 'v1',
  pashto: 'کور',
  definition: 'a dwelling place',
  region: 'Kohat',
  status: 'pending',
  submittedBy: { username: 'testuser' },
  createdAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

const mockUser = (overrides = {}) => ({
  _id: 'u10',
  username: 'alice',
  email: 'alice@test.com',
  role: 'user',
  createdAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

const mockLogEntry = (overrides = {}) => ({
  _id: 'log1',
  entry: { _id: 'e1', pashto: 'کور' },
  action: 'approved',
  performedBy: { username: 'mod1' },
  note: '',
  timestamp: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

// Helper: queue page mocks two API calls (concepts queue + variants queue)
function mockQueueBothEmpty() {
  api.get
    .mockResolvedValueOnce({ data: { success: true, data: [], meta: { page: 1, limit: 20, total: 0 } } })
    .mockResolvedValueOnce({ data: { success: true, data: [], meta: { page: 1, limit: 20, total: 0 } } });
}

function mockQueueWithConcepts(concepts = [], variants = []) {
  api.get
    .mockResolvedValueOnce({ data: { success: true, data: concepts, meta: { page: 1, limit: 20, total: concepts.length } } })
    .mockResolvedValueOnce({ data: { success: true, data: variants, meta: { page: 1, limit: 20, total: variants.length } } });
}

beforeEach(() => {
  vi.resetAllMocks();
});

// ===========================================================================
// 1.  DashboardLayout — role-based navigation
// ===========================================================================

describe('DashboardLayout — role-based navigation', () => {
  const renderLayout = () => {
    return render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <DashboardLayout>
          <div>child content</div>
        </DashboardLayout>
      </MemoryRouter>
    );
  };

  it('renders the queue nav link for a moderator', () => {
    asModerator();
    renderLayout();
    expect(screen.getByRole('link', { name: /queue/i })).toBeInTheDocument();
  });

  it('renders the concepts nav link for a moderator', () => {
    asModerator();
    renderLayout();
    expect(screen.getByRole('link', { name: /concepts/i })).toBeInTheDocument();
  });

  it('does NOT render the users nav link for a moderator', () => {
    asModerator();
    renderLayout();
    expect(screen.queryByRole('link', { name: /users/i })).not.toBeInTheDocument();
  });

  it('does NOT render the audit log nav link for a moderator', () => {
    asModerator();
    renderLayout();
    expect(screen.queryByRole('link', { name: /log/i })).not.toBeInTheDocument();
  });

  it('renders the users nav link for an admin', () => {
    asAdmin();
    renderLayout();
    expect(screen.getByRole('link', { name: /users/i })).toBeInTheDocument();
  });

  it('renders the audit log nav link for an admin', () => {
    asAdmin();
    renderLayout();
    expect(screen.getByRole('link', { name: /log/i })).toBeInTheDocument();
  });

  it('renders children inside the layout', () => {
    asModerator();
    renderLayout();
    expect(screen.getByText('child content')).toBeInTheDocument();
  });
});

// ===========================================================================
// 2.  Non-moderator redirect
// ===========================================================================

describe('Non-moderator redirect from dashboard routes', () => {
  const renderDashboard = (path = '/dashboard') => {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/dashboard/*"
            element={
              <DashboardLayout>
                <div>Dashboard content</div>
              </DashboardLayout>
            }
          />
          <Route path="/" element={<div>Home page</div>} />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('redirects a plain user away from /dashboard', () => {
    asUser();
    renderDashboard('/dashboard');
    expect(screen.queryByText('Dashboard content')).not.toBeInTheDocument();
  });

  it('redirects an unauthenticated visitor away from /dashboard', () => {
    mockUseAuth.mockReturnValue({ user: null, token: null });
    renderDashboard('/dashboard');
    expect(screen.queryByText('Dashboard content')).not.toBeInTheDocument();
  });

  it('allows a moderator to reach /dashboard', () => {
    asModerator();
    renderDashboard('/dashboard');
    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
  });

  it('allows an admin to reach /dashboard', () => {
    asAdmin();
    renderDashboard('/dashboard');
    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
  });
});

// ===========================================================================
// 3.  Dashboard summary stats page  /dashboard
// ===========================================================================

describe('Dashboard summary stats page', () => {
  const renderDashboardHome = () => {
    return render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <DashboardHome />
      </MemoryRouter>
    );
  };

  it('shows a loading state while fetching stats', () => {
    asModerator();
    api.get.mockReturnValueOnce(new Promise(() => {}));
    renderDashboardHome();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows an error state when the stats API call fails', async () => {
    asModerator();
    api.get.mockRejectedValueOnce(new Error('Network error'));
    renderDashboardHome();
    expect(await screen.findByText(/error|failed/i)).toBeInTheDocument();
  });

  it('displays a count of pending entries', async () => {
    asModerator();
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: { pending: 5, approved: 3, rejected: 1, published: 10 },
      },
    });
    renderDashboardHome();
    expect(await screen.findByText(/5/)).toBeInTheDocument();
    expect(await screen.findByText(/pending/i)).toBeInTheDocument();
  });

  it('calls the stats API endpoint', async () => {
    asModerator();
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: { pending: 0, approved: 0, rejected: 0, published: 0 },
      },
    });
    renderDashboardHome();
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/dashboard\/stats|\/api\/moderation\/stats/)
      );
    });
  });
});

// ===========================================================================
// 4.  Moderation queue page  /dashboard/queue
// ===========================================================================

describe('DashboardQueue page — moderation queue', () => {
  const renderQueue = () => {
    return render(
      <MemoryRouter initialEntries={['/dashboard/queue']}>
        <DashboardQueue />
      </MemoryRouter>
    );
  };

  it('shows a loading state while fetching the queue', () => {
    asModerator();
    api.get.mockReturnValue(new Promise(() => {}));
    renderQueue();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows an error state when the queue API call fails', async () => {
    asModerator();
    api.get.mockRejectedValue(new Error('Network error'));
    renderQueue();
    expect(await screen.findByText(/error|failed/i)).toBeInTheDocument();
  });

  it('shows an empty state when there are no pending items', async () => {
    asModerator();
    mockQueueBothEmpty();
    renderQueue();
    expect(await screen.findByText(/no entries|empty|nothing/i)).toBeInTheDocument();
  });

  it('renders concept englishGloss in the concepts tab', async () => {
    asModerator();
    mockQueueWithConcepts(
      [mockConcept({ englishGloss: 'house' }), mockConcept({ _id: 'e2', englishGloss: 'water' })],
      []
    );
    renderQueue();
    expect(await screen.findByText('house')).toBeInTheDocument();
    expect(screen.getByText('water')).toBeInTheDocument();
  });

  it('renders an Approve button for each pending item', async () => {
    asModerator();
    mockQueueWithConcepts([mockConcept()], []);
    renderQueue();
    expect(
      await screen.findByRole('button', { name: /approve/i })
    ).toBeInTheDocument();
  });

  it('renders a Reject button for each pending item', async () => {
    asModerator();
    mockQueueWithConcepts([mockConcept()], []);
    renderQueue();
    expect(
      await screen.findByRole('button', { name: /reject/i })
    ).toBeInTheDocument();
  });

  it('calls PATCH /api/concepts/:id/status when Approve is clicked in concepts tab', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueueWithConcepts([mockConcept({ _id: 'concept123' })], []);
    api.patch.mockResolvedValueOnce({
      data: { success: true, data: { _id: 'concept123', status: 'approved' } },
    });
    renderQueue();
    await user.click(await screen.findByRole('button', { name: /approve/i }));
    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/concepts\/concept123\/status/),
        expect.anything()
      );
    });
  });

  it('calls PATCH /api/concepts/:id/status when Reject is clicked in concepts tab', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueueWithConcepts([mockConcept({ _id: 'concept456' })], []);
    api.patch.mockResolvedValueOnce({
      data: { success: true, data: { _id: 'concept456', status: 'rejected' } },
    });
    renderQueue();
    await user.click(await screen.findByRole('button', { name: /reject/i }));
    // Rejection now requires a note via modal
    const textarea = document.querySelector('textarea');
    if (textarea) {
      await user.type(textarea, 'Test rejection reason');
      const confirmBtn = screen.queryByRole('button', { name: /confirm/i });
      if (confirmBtn) await user.click(confirmBtn);
    }
    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/concepts\/concept456\/status/),
        expect.anything()
      );
    });
  });

  it('removes an item from the queue after it is approved', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueueWithConcepts([mockConcept({ _id: 'concept789', englishGloss: 'fire' })], []);
    api.patch.mockResolvedValueOnce({
      data: { success: true, data: { _id: 'concept789', status: 'approved' } },
    });
    renderQueue();
    await screen.findByText('fire');
    await user.click(screen.getByRole('button', { name: /approve/i }));
    await waitFor(() => {
      expect(screen.queryByText('fire')).not.toBeInTheDocument();
    });
  });

  it('shows an error message when the approve action fails', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueueWithConcepts([mockConcept()], []);
    api.patch.mockRejectedValueOnce({
      response: { data: { success: false, error: { message: 'Action failed' } } },
    });
    renderQueue();
    await user.click(await screen.findByRole('button', { name: /approve/i }));
    expect(await screen.findByText(/action failed|error/i)).toBeInTheDocument();
  });

  it('calls /api/moderation/concepts/queue and /api/moderation/variants/queue to fetch queue', async () => {
    asModerator();
    mockQueueBothEmpty();
    renderQueue();
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/moderation\/concepts\/queue/)
      );
      expect(api.get).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/moderation\/variants\/queue/)
      );
    });
  });

  it('renders a Publish button for an admin user viewing approved items', async () => {
    asAdmin();
    mockQueueWithConcepts([mockConcept({ status: 'approved' })], []);
    render(
      <MemoryRouter initialEntries={['/dashboard/queue']}>
        <DashboardQueue />
      </MemoryRouter>
    );
    expect(
      await screen.findByRole('button', { name: /publish/i })
    ).toBeInTheDocument();
  });
});

// ===========================================================================
// 5.  Dashboard entries page  /dashboard/entries
// ===========================================================================

describe('DashboardConcepts page — all concepts with status filter', () => {
  const renderEntries = () => {
    return render(
      <MemoryRouter initialEntries={['/dashboard/entries']}>
        <DashboardConcepts />
      </MemoryRouter>
    );
  };

  it('shows a loading state while fetching entries', () => {
    asModerator();
    api.get.mockReturnValueOnce(new Promise(() => {}));
    renderEntries();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows an error state when the entries API call fails', async () => {
    asModerator();
    api.get.mockRejectedValueOnce(new Error('fail'));
    renderEntries();
    expect(await screen.findByText(/error|failed/i)).toBeInTheDocument();
  });

  it('renders concepts returned by the API', async () => {
    asModerator();
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: [
          mockConcept({ englishGloss: 'house', status: 'pending' }),
          mockConcept({ _id: 'e2', englishGloss: 'water', status: 'published' }),
        ],
        meta: { page: 1, limit: 20, total: 2 },
      },
    });
    renderEntries();
    expect(await screen.findByText('house')).toBeInTheDocument();
    expect(screen.getByText('water')).toBeInTheDocument();
  });

  it('renders a status filter control (select or set of buttons)', async () => {
    asModerator();
    api.get.mockResolvedValueOnce({
      data: { success: true, data: [], meta: { page: 1, limit: 20, total: 0 } },
    });
    renderEntries();
    await waitFor(() => {
      const filterEl =
        screen.queryByRole('combobox', { name: /status/i }) ||
        screen.queryByRole('group', { name: /status/i }) ||
        screen.queryByLabelText(/status/i) ||
        screen.queryByText(/filter/i);
      expect(filterEl).toBeInTheDocument();
    });
  });

  it('re-fetches entries when the status filter changes', async () => {
    const user = userEvent.setup();
    asModerator();
    api.get.mockResolvedValue({
      data: { success: true, data: [], meta: { page: 1, limit: 20, total: 0 } },
    });
    renderEntries();
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));

    const select = screen.queryByRole('combobox', { name: /status/i }) ||
      screen.queryByLabelText(/status/i);
    if (select) {
      await user.selectOptions(select, 'pending');
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledTimes(2);
        expect(api.get).toHaveBeenLastCalledWith(
          expect.stringMatching(/status=pending/)
        );
      });
    }
  });

  it('displays the status badge for each entry', async () => {
    asModerator();
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: [mockConcept({ status: 'pending' })],
        meta: { page: 1, limit: 20, total: 1 },
      },
    });
    renderEntries();
    expect(await screen.findByText(/pending/i)).toBeInTheDocument();
  });
});

// ===========================================================================
// 6.  Dashboard users page  /dashboard/users  (admin only)
// ===========================================================================

describe('DashboardUsers page — user list (admin only)', () => {
  const renderUsers = (role = 'admin') => {
    if (role === 'admin') asAdmin();
    else if (role === 'moderator') asModerator();
    else asUser();
    return render(
      <MemoryRouter initialEntries={['/dashboard/users']}>
        <Routes>
          <Route path="/dashboard/users" element={<DashboardUsers />} />
          <Route path="/dashboard" element={<div>Dashboard home</div>} />
          <Route path="/" element={<div>Home</div>} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('shows a loading state while fetching users', () => {
    api.get.mockReturnValueOnce(new Promise(() => {}));
    renderUsers('admin');
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows an error state when the users API call fails', async () => {
    api.get.mockRejectedValueOnce(new Error('fail'));
    renderUsers('admin');
    expect(await screen.findByText(/error|failed/i)).toBeInTheDocument();
  });

  it('renders each user username in the list', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: [mockUser({ username: 'alice' }), mockUser({ _id: 'u2', username: 'bob' })],
        meta: { page: 1, limit: 20, total: 2 },
      },
    });
    renderUsers('admin');
    expect(await screen.findByText('alice')).toBeInTheDocument();
    expect(screen.getByText('bob')).toBeInTheDocument();
  });

  it('renders each user role in the list', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: [mockUser({ role: 'moderator', username: 'mod1' })],
        meta: { page: 1, limit: 20, total: 1 },
      },
    });
    renderUsers('admin');
    expect(await screen.findByText(/moderator/i)).toBeInTheDocument();
  });

  it('redirects a moderator away from /dashboard/users', () => {
    asModerator();
    api.get.mockResolvedValueOnce({
      data: { success: true, data: [], meta: { page: 1, limit: 20, total: 0 } },
    });
    render(
      <MemoryRouter initialEntries={['/dashboard/users']}>
        <Routes>
          <Route path="/dashboard/users" element={<DashboardUsers />} />
          <Route path="/dashboard" element={<div>Dashboard home</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    expect(screen.getByText('Dashboard home')).toBeInTheDocument();
  });

  it('calls GET /api/users to fetch the user list for an admin', async () => {
    api.get.mockResolvedValueOnce({
      data: { success: true, data: [], meta: { page: 1, limit: 20, total: 0 } },
    });
    renderUsers('admin');
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/users/)
      );
    });
  });
});

// ===========================================================================
// 7.  Dashboard log page  /dashboard/log  (admin only)
// ===========================================================================

describe('DashboardLog page — audit log (admin only)', () => {
  const renderLog = (role = 'admin') => {
    if (role === 'admin') asAdmin();
    else asModerator();
    return render(
      <MemoryRouter initialEntries={['/dashboard/log']}>
        <Routes>
          <Route path="/dashboard/log" element={<DashboardLog />} />
          <Route path="/dashboard" element={<div>Dashboard home</div>} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('shows a loading state while fetching the log', () => {
    api.get.mockReturnValueOnce(new Promise(() => {}));
    renderLog('admin');
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows an error state when the log API call fails', async () => {
    api.get.mockRejectedValueOnce(new Error('fail'));
    renderLog('admin');
    expect(await screen.findByText(/error|failed/i)).toBeInTheDocument();
  });

  it('shows an empty state when there are no log entries', async () => {
    api.get.mockResolvedValueOnce({
      data: { success: true, data: [], meta: { page: 1, limit: 20, total: 0 } },
    });
    renderLog('admin');
    expect(await screen.findByText(/no log|empty|no entries/i)).toBeInTheDocument();
  });

  it('renders the action for each log entry', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: [mockLogEntry({ action: 'approved' })],
        meta: { page: 1, limit: 20, total: 1 },
      },
    });
    renderLog('admin');
    expect(await screen.findByText(/approved/i)).toBeInTheDocument();
  });

  it('renders the performer username for each log entry', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: [mockLogEntry({ performedBy: { username: 'moduser' } })],
        meta: { page: 1, limit: 20, total: 1 },
      },
    });
    renderLog('admin');
    expect(await screen.findByText(/moduser/i)).toBeInTheDocument();
  });

  it('renders the pashto word of the entry that was acted on', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: [mockLogEntry({ entry: { _id: 'e1', pashto: 'لرګی' } })],
        meta: { page: 1, limit: 20, total: 1 },
      },
    });
    renderLog('admin');
    expect(await screen.findByText(/لرګی/)).toBeInTheDocument();
  });

  it('redirects a moderator away from /dashboard/log', () => {
    asModerator();
    api.get.mockResolvedValueOnce({
      data: { success: true, data: [], meta: { page: 1, limit: 20, total: 0 } },
    });
    render(
      <MemoryRouter initialEntries={['/dashboard/log']}>
        <Routes>
          <Route path="/dashboard/log" element={<DashboardLog />} />
          <Route path="/dashboard" element={<div>Dashboard home</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Dashboard home')).toBeInTheDocument();
  });

  it('calls GET /api/moderation/log to fetch the audit log', async () => {
    api.get.mockResolvedValueOnce({
      data: { success: true, data: [], meta: { page: 1, limit: 20, total: 0 } },
    });
    renderLog('admin');
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/moderation\/log/)
      );
    });
  });
});
