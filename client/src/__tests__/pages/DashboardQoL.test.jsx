/**
 * Dashboard quality-of-life
 *  - Queue filters (search, region, submitter) kept in the URL; clicking a submitter filters to them
 *  - Bulk approve / reject with per-item failures kept selected
 *  - Toasts after actions
 *  - Overview to-do cards and the Queue badge
 *  - Concepts page: search keeps focus while loading, pagination
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import api, { checkCrossConceptPashto, getSuggestionQueue } from '../../services/api';
import DashboardQueue from '../../pages/dashboard/DashboardQueue';
import DashboardHome from '../../pages/dashboard/DashboardHome';
import DashboardLayout from '../../pages/dashboard/DashboardLayout';
import DashboardConcepts from '../../pages/dashboard/DashboardConcepts';
import { ToastProvider } from '../../context/ToastContext';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  checkCrossConceptPashto: vi.fn(),
  getSuggestionQueue: vi.fn(),
}));

const mockUseAuth = vi.fn();
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const asModerator = () => mockUseAuth.mockReturnValue({ user: { _id: 'u2', role: 'moderator' }, initializing: false });
const asAdmin = () => mockUseAuth.mockReturnValue({ user: { _id: 'u3', role: 'admin' }, initializing: false });

const variant = (overrides = {}) => ({
  _id: 'v1', pashto: 'کور', region: 'Kohat', definition: 'd', status: 'pending', concept: 'c1',
  submittedBy: { username: 'spammy' }, ...overrides,
});
const group = (overrides = {}, variants = []) => ({
  _id: 'c1', englishGloss: 'house', partOfSpeech: 'noun', status: 'pending', matched: true,
  submittedBy: { username: 'spammy' }, variants, ...overrides,
});
const page = (data, meta = {}) => ({ data: { success: true, data, meta: { page: 1, limit: 20, total: data.length, pendingCount: data.length, approvedCount: 0, ...meta } } });

let queueData = [];
function routeGet(url) {
  if (url.startsWith('/api/concepts/suggest')) return Promise.resolve({ data: { data: [] } });
  if (url.startsWith('/api/moderation/stats')) return Promise.resolve({ data: { data: STATS } });
  return Promise.resolve(page(queueData));
}

const STATS = {
  pending: 4, approved: 2, rejected: 1, published: 9,
  queue: { entries: { pending: 3, approved: 2 }, suggestions: { pending: 1, approved: 0 }, audio: { pending: 0, approved: 0 } },
};

function Location() {
  const { search } = useLocation();
  return <span data-testid="search">{search}</span>;
}

const renderQueue = (url = '/dashboard/queue') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <ToastProvider>
        <Routes><Route path="/dashboard/queue" element={<><DashboardQueue /><Location /></>} /></Routes>
      </ToastProvider>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.resetAllMocks();
  queueData = [];
  api.get.mockImplementation(routeGet);
  checkCrossConceptPashto.mockResolvedValue({ data: { data: { conflicts: [] } } });
  getSuggestionQueue.mockResolvedValue({ data: { data: [], meta: {} } });
});

describe('queue filters', () => {
  it('reads filters from the URL and sends them to the server', async () => {
    asModerator();
    renderQueue('/dashboard/queue?q=kor&region=Kohat&user=spammy');
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/moderation/queue?status=pending&page=1&q=kor&region=Kohat&user=spammy'));
    expect(screen.getByLabelText('Submitter username')).toHaveValue('spammy');
    expect(await screen.findByText('Nothing matches these filters.')).toBeInTheDocument();
  });

  it('clicking a submitter name filters the queue to them and Clear filters resets it', async () => {
    const user = userEvent.setup();
    asModerator();
    queueData = [group()];
    renderQueue();
    await user.click(await screen.findByRole('button', { name: 'spammy' }));
    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent('user=spammy'));
    expect(screen.getByLabelText('Submitter username')).toHaveValue('spammy');
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent(/^$/));
    expect(screen.getByLabelText('Submitter username')).toHaveValue('');
  });

  it('switching tab keeps the filters but drops status and page', async () => {
    const user = userEvent.setup();
    asAdmin();
    renderQueue('/dashboard/queue?user=spammy&status=approved&page=2');
    await user.click(await screen.findByRole('tab', { name: /suggestions/i }));
    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent('?user=spammy&view=suggestions'));
  });
});

describe('bulk actions', () => {
  it('approves the selected concept before its word and toasts the result', async () => {
    const user = userEvent.setup();
    asModerator();
    queueData = [group({}, [variant()])];
    api.patch.mockResolvedValue({ data: { success: true } });
    renderQueue();
    await user.click(await screen.findByLabelText('Select all on this page'));
    await user.click(screen.getByRole('button', { name: 'Approve selected' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(2));
    expect(api.patch.mock.calls.map(([url]) => url)).toEqual(['/api/concepts/c1/status', '/api/variants/v1/status']);
    expect(await screen.findByRole('status')).toHaveTextContent('Approved 2 items');
  });

  it('keeps failed items selected with the reason', async () => {
    const user = userEvent.setup();
    asModerator();
    queueData = [group({ matched: false, status: 'published' }, [variant(), variant({ _id: 'v2', pashto: 'اوبه' })])];
    api.patch.mockImplementation((url) => (url.includes('v2')
      ? Promise.reject({ response: { data: { error: { message: 'You cannot review your own submission' } } } })
      : Promise.resolve({ data: { success: true } })));
    renderQueue();
    await user.click(await screen.findByLabelText('Select all on this page'));
    await user.click(screen.getByRole('button', { name: 'Approve selected' }));
    const bar = await screen.findByRole('region', { name: 'Bulk actions' });
    expect(await within(bar).findByText(/1 could not be changed/)).toBeInTheDocument();
    expect(within(bar).getByText(/You cannot review your own submission/)).toBeInTheDocument();
    expect(within(bar).getByText('1 selected')).toBeInTheDocument();
  });

  it('a concept listed only for its words cannot be selected', async () => {
    asModerator();
    queueData = [group({ matched: false }, [variant()])];
    renderQueue();
    await screen.findByText('house');
    expect(screen.queryByLabelText('Select house')).not.toBeInTheDocument();
  });

  it('bulk reject sends one note to each item and skips words cascaded by their concept', async () => {
    const user = userEvent.setup();
    asModerator();
    queueData = [group({}, [variant()])];
    api.patch.mockResolvedValue({ data: { success: true } });
    renderQueue();
    await user.click(await screen.findByLabelText('Select all on this page'));
    await user.click(screen.getByRole('button', { name: 'Reject selected…' }));
    await user.type(screen.getByLabelText(/reason for rejection/i), 'spam');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /reject|confirm/i }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
    expect(api.patch).toHaveBeenCalledWith('/api/concepts/c1/status', { status: 'rejected', moderatorNote: 'spam' });
  });
});

describe('toasts', () => {
  it('a single approve shows a toast naming the item', async () => {
    const user = userEvent.setup();
    asModerator();
    queueData = [group()];
    api.patch.mockResolvedValue({ data: { success: true } });
    renderQueue();
    await user.click(await screen.findByRole('button', { name: 'Approve' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Approved “house”');
  });
});

describe('Overview and layout', () => {
  const renderWithLayout = (ui, url = '/dashboard') =>
    render(<MemoryRouter initialEntries={[url]}><DashboardLayout>{ui}</DashboardLayout></MemoryRouter>);

  it('lists what is waiting, linking to the filtered queue', async () => {
    asAdmin();
    renderWithLayout(<DashboardHome />);
    const publish = await screen.findByRole('link', { name: /entries to publish/i });
    expect(publish).toHaveAttribute('href', '/dashboard/queue?status=approved');
    expect(publish).toHaveTextContent('2');
    expect(screen.getByRole('link', { name: /suggestions to review/i })).toHaveAttribute('href', '/dashboard/queue?view=suggestions');
  });

  it('moderators see only review tasks and a badge counting pending items', async () => {
    asModerator();
    renderWithLayout(<DashboardHome />);
    expect(await screen.findByRole('link', { name: /entries to review/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /to publish/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /queue/i })).toHaveTextContent('4');
  });

  it('the stats are fetched once for the layout and the page', async () => {
    asAdmin();
    renderWithLayout(<DashboardHome />);
    await screen.findByRole('link', { name: /entries to review/i });
    expect(api.get.mock.calls.filter(([url]) => url === '/api/moderation/stats')).toHaveLength(1);
  });
});

describe('Concepts page', () => {
  it('keeps the search box while results load and pages through results', async () => {
    const user = userEvent.setup();
    asAdmin();
    let resolveSearch;
    api.get.mockImplementation((url) => {
      if (url.includes('q=wat')) return new Promise((r) => { resolveSearch = r; });
      return Promise.resolve(page([group({ englishGloss: 'house', status: 'published' })], { total: 45 }));
    });
    render(<MemoryRouter><DashboardConcepts /></MemoryRouter>);
    expect(await screen.findByText('house')).toBeInTheDocument();
    const box = screen.getByLabelText('Search concepts');
    await user.type(box, 'wat');
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith(expect.stringContaining('q=wat')));
    expect(screen.getByLabelText('Search concepts')).toBe(box);
    expect(box).toHaveFocus();
    resolveSearch(page([]));
    expect(await screen.findByText('No concepts found.')).toBeInTheDocument();
  });

  it('shows pagination and requests the next page', async () => {
    const user = userEvent.setup();
    asAdmin();
    api.get.mockResolvedValue(page([group({ status: 'published' })], { total: 45 }));
    render(<MemoryRouter><DashboardConcepts /></MemoryRouter>);
    await screen.findByText('house');
    await user.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith(expect.stringContaining('page=2')));
  });
});
