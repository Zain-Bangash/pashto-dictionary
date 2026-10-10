/**
 * Grouped moderation queue — concept rows with variant dropdowns
 *
 * Tests for:
 *  - Single /api/moderation/queue fetch, no Concepts/Variants tabs
 *  - Variant dropdown toggle per concept
 *  - Variant Approve gated on concept approved/published, Publish gated on concept published
 *  - Admin Pending/Approved filter with item counts
 *  - Pagination over concept groups
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import api, { checkCrossConceptPashto } from '../../services/api';
import DashboardQueue from '../../pages/dashboard/DashboardQueue';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  checkCrossConceptPashto: vi.fn(),
}));

const mockUseAuth = vi.fn();
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const asModerator = () =>
  mockUseAuth.mockReturnValue({ user: { _id: 'u2', role: 'moderator' }, token: 'tok' });

const asAdmin = () =>
  mockUseAuth.mockReturnValue({ user: { _id: 'u3', role: 'admin' }, token: 'tok' });

const mockVariant = (overrides = {}) => ({
  _id: 'v1',
  pashto: 'کور',
  phonetic: 'kor',
  region: 'Kohat',
  definition: 'a dwelling place',
  status: 'pending',
  concept: 'c1',
  submittedBy: { username: 'testuser' },
  ...overrides,
});

const mockGroup = (overrides = {}, variants = []) => ({
  _id: 'c1',
  englishGloss: 'house',
  partOfSpeech: 'noun',
  status: 'pending',
  submittedBy: { username: 'testuser' },
  variants,
  ...overrides,
});

// Queue responses are served in order; suggest calls (Similar concepts panel) always get an empty list
let queueResponses = [];
function mockQueue(groups = [], meta = {}) {
  queueResponses.push({
    data: { success: true, data: groups, meta: { page: 1, limit: 20, total: groups.length, pendingCount: 0, approvedCount: 0, ...meta } },
  });
}

function routeGet(url) {
  if (url.startsWith('/api/concepts/suggest')) return Promise.resolve({ data: { success: true, data: [] } });
  const next = queueResponses.shift();
  return next ? Promise.resolve(next) : Promise.reject(new Error(`unmocked GET ${url}`));
}

const queueCalls = () => api.get.mock.calls.filter(([url]) => url.startsWith('/api/moderation/queue'));

const renderQueue = () =>
  render(
    <MemoryRouter initialEntries={['/dashboard/queue']}>
      <DashboardQueue />
    </MemoryRouter>
  );

async function expandVariants(user) {
  await user.click(await screen.findByRole('button', { name: /variants? waiting/i }));
  return screen.getByRole('region', { name: /variants of/i });
}

beforeEach(() => {
  vi.resetAllMocks();
  queueResponses = [];
  api.get.mockImplementation(routeGet);
  checkCrossConceptPashto.mockResolvedValue({ data: { data: { conflicts: [] } } });
});

describe('Grouped queue — concept rows with variant dropdowns', () => {
  it('fetches the grouped queue endpoint and shows no Concepts/Variants tabs', async () => {
    asModerator();
    mockQueue([mockGroup()]);

    renderQueue();
    await screen.findByText('house');

    expect(api.get).toHaveBeenCalledWith('/api/moderation/queue?status=pending&page=1');
    expect(api.get).not.toHaveBeenCalledWith(expect.stringMatching(/\/(concepts|variants)\/queue/));
    expect(screen.queryByRole('button', { name: /^concepts/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^variants/i })).not.toBeInTheDocument();
  });

  it('shows a loading state, then the error state when the queue fails to load', async () => {
    asModerator();

    renderQueue();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(await screen.findByText(/failed to load queue/i)).toBeInTheDocument();
  });

  it('hides variants until the toggle is clicked and flips aria-expanded', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueue([mockGroup({}, [
      mockVariant({ _id: 'v1', pashto: 'کور' }),
      mockVariant({ _id: 'v2', pashto: 'کوټه', region: 'Hangu' }),
    ])]);

    renderQueue();
    const toggle = await screen.findByRole('button', { name: /2 variants waiting/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('کور')).not.toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('کور')).toBeInTheDocument();
    expect(screen.getByText('کوټه')).toBeInTheDocument();
  });

  it('expands and collapses when the concept row itself is clicked', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueue([mockGroup({}, [mockVariant({ _id: 'v1', pashto: 'کور' })])]);

    renderQueue();
    await user.click(await screen.findByText('house'));
    const toggle = screen.getByRole('button', { name: /1 variant waiting/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('کور')).toBeInTheDocument();

    await user.click(screen.getByText('noun'));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('کور')).not.toBeInTheDocument();
  });

  it('does not toggle the row when a concept action button is clicked', async () => {
    const user = userEvent.setup();
    asAdmin();
    mockQueue([mockGroup({}, [mockVariant({ _id: 'v1', pashto: 'کور' })])]);

    renderQueue();
    const toggle = await screen.findByRole('button', { name: /1 variant waiting/i });
    await user.click(screen.getByRole('button', { name: /^edit$/i }));

    expect(screen.getByRole('form', { name: /edit concept/i })).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('کور')).not.toBeInTheDocument();
  });

  it('does not open a dropdown when a row without waiting variants is clicked', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueue([mockGroup()]);

    renderQueue();
    await user.click(await screen.findByText('house'));
    expect(screen.queryByRole('region', { name: /variants of/i })).not.toBeInTheDocument();
  });

  it('shows "No variants waiting" for a concept without waiting variants', async () => {
    asModerator();
    mockQueue([mockGroup()]);

    renderQueue();
    expect(await screen.findByText(/no variants waiting/i)).toBeInTheDocument();
  });

  it('approving a pending concept PATCHes the concept status and refetches', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueue([mockGroup({ _id: 'cA' })]);
    api.patch.mockResolvedValueOnce({ data: { success: true, data: { _id: 'cA', status: 'approved' } } });
    mockQueue([]);

    renderQueue();
    await user.click(await screen.findByRole('button', { name: /^approve$/i }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/api/concepts/cA/status', { status: 'approved' });
    });
    expect(await screen.findByText(/nothing in the queue/i)).toBeInTheDocument();
  });

  it('disables variant Approve with a hint while the concept is pending', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueue([mockGroup({ status: 'pending' }, [mockVariant()])]);

    renderQueue();
    const region = await expandVariants(user);

    expect(within(region).getByRole('button', { name: /^approve$/i })).toBeDisabled();
    expect(within(region).getByText(/approve the concept first/i)).toBeInTheDocument();
    expect(within(region).getByRole('button', { name: /reject/i })).toBeEnabled();
  });

  it.each(['approved', 'published'])('enables variant Approve when the concept is %s', async (status) => {
    const user = userEvent.setup();
    asModerator();
    mockQueue([mockGroup({ _id: 'cP', status }, [mockVariant({ _id: 'vP', concept: 'cP' })])]);
    api.patch.mockResolvedValueOnce({ data: { success: true, data: { _id: 'vP', status: 'approved' } } });
    mockQueue([]);

    renderQueue();
    const region = await expandVariants(user);
    const approve = within(region).getByRole('button', { name: /^approve$/i });
    expect(approve).toBeEnabled();

    await user.click(approve);
    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/api/variants/vP/status', { status: 'approved' });
    });
    await waitFor(() => expect(queueCalls()).toHaveLength(2));
  });

  it('a published concept row has no status actions but its variant is actionable', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueue([mockGroup({ status: 'published' }, [mockVariant()])]);

    renderQueue();
    await screen.findByText('house');
    expect(screen.queryByRole('button', { name: /approve|reject|publish/i })).not.toBeInTheDocument();

    const region = await expandVariants(user);
    expect(within(region).getByRole('button', { name: /^approve$/i })).toBeEnabled();
    expect(within(region).getByRole('button', { name: /reject/i })).toBeInTheDocument();
  });

  it('rejecting a variant opens the modal and PATCHes with moderatorNote', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueue([mockGroup({ status: 'approved' }, [mockVariant({ _id: 'vR' })])]);
    api.patch.mockResolvedValueOnce({ data: { success: true, data: {} } });
    mockQueue([]);

    renderQueue();
    const region = await expandVariants(user);
    await user.click(within(region).getByRole('button', { name: /reject/i }));
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled();
    await user.type(screen.getByLabelText(/reason for rejection/i), 'Misspelt');
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/api/variants/vR/status', { status: 'rejected', moderatorNote: 'Misspelt' });
    });
  });

  it('shows the server error message when an action fails', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueue([mockGroup()]);
    api.patch.mockRejectedValueOnce({
      response: { data: { success: false, error: { message: 'Cannot approve a variant whose concept has not been approved yet.' } } },
    });

    renderQueue();
    await user.click(await screen.findByRole('button', { name: /^approve$/i }));
    expect(await screen.findByText(/has not been approved yet/i)).toBeInTheDocument();
  });

  it('renders the cross-concept warning chip on a variant row', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueue([mockGroup({ status: 'approved' }, [mockVariant()])]);
    checkCrossConceptPashto.mockResolvedValue({
      data: { data: { conflicts: [{ conceptId: 'cX', englishGloss: 'home', status: 'published' }] } },
    });

    renderQueue();
    const region = await expandVariants(user);
    expect(await within(region).findByText(/also under: home \(published\)/i)).toBeInTheDocument();
    expect(checkCrossConceptPashto).toHaveBeenCalledWith('کور', 'c1');
  });

  it('keeps an expanded dropdown open after an action refetches', async () => {
    const user = userEvent.setup();
    asModerator();
    const group = mockGroup({ status: 'approved' }, [mockVariant({ _id: 'v1' }), mockVariant({ _id: 'v2', pashto: 'کوټه' })]);
    mockQueue([group]);
    api.patch.mockResolvedValueOnce({ data: { success: true, data: {} } });
    mockQueue([{ ...group, variants: [group.variants[1]] }]);

    renderQueue();
    const region = await expandVariants(user);
    await user.click(within(region).getAllByRole('button', { name: /^approve$/i })[0]);

    await waitFor(() => expect(screen.queryByText('کور')).not.toBeInTheDocument());
    expect(screen.getByText('کوټه')).toBeInTheDocument();
  });

  it('moderators do not see the Pending/Approved filter', async () => {
    asModerator();
    mockQueue([mockGroup()]);

    renderQueue();
    await screen.findByText('house');
    expect(screen.queryByRole('button', { name: /^approved \(/i })).not.toBeInTheDocument();
  });

  it('pagination requests the next page of concept groups', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueue([mockGroup()], { total: 45 });
    mockQueue([mockGroup({ _id: 'c2', englishGloss: 'water' })], { total: 45, page: 2 });

    renderQueue();
    await screen.findByText(/page 1 of 3/i);
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/moderation/queue?status=pending&page=2');
    });
    expect(await screen.findByText('water')).toBeInTheDocument();
  });
});

describe('Grouped queue — admin filter and publishing', () => {
  it('shows item counts on the filter and refetches with status=approved', async () => {
    const user = userEvent.setup();
    asAdmin();
    mockQueue([mockGroup()], { pendingCount: 3, approvedCount: 4 });
    mockQueue([mockGroup({ status: 'approved' })], { pendingCount: 3, approvedCount: 4 });

    renderQueue();
    await screen.findByRole('button', { name: /pending \(3\)/i });
    await user.click(screen.getByRole('button', { name: /approved \(4\)/i }));

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/moderation/queue?status=approved&page=1');
    });
  });

  it('publishing an approved concept PATCHes the concept status', async () => {
    const user = userEvent.setup();
    asAdmin();
    mockQueue([mockGroup({ _id: 'cPub', status: 'approved' })]);
    api.patch.mockResolvedValueOnce({ data: { success: true, data: {} } });
    mockQueue([]);

    renderQueue();
    await user.click(await screen.findByRole('button', { name: /^publish$/i }));
    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/api/concepts/cPub/status', { status: 'published' });
    });
  });

  it('disables variant Publish until the concept is published', async () => {
    const user = userEvent.setup();
    asAdmin();
    mockQueue([mockGroup({ status: 'approved' }, [mockVariant({ status: 'approved' })])]);

    renderQueue();
    const region = await expandVariants(user);
    expect(within(region).getByRole('button', { name: /^publish$/i })).toBeDisabled();
    expect(within(region).getByText(/publish the concept first/i)).toBeInTheDocument();
  });

  it('lets an admin reject an approved variant with a note', async () => {
    const user = userEvent.setup();
    asAdmin();
    mockQueue([mockGroup({ status: 'published' }, [mockVariant({ _id: 'vApp', status: 'approved' })])]);
    api.patch.mockResolvedValueOnce({ data: { success: true, data: {} } });
    mockQueue([]);

    renderQueue();
    const region = await expandVariants(user);
    await user.click(within(region).getByRole('button', { name: /^reject$/i }));
    await user.type(screen.getByLabelText(/reason for rejection/i), 'Not this region');
    await user.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/api/variants/vApp/status', { status: 'rejected', moderatorNote: 'Not this region' });
    });
  });

  it('lets an admin reject an approved concept', async () => {
    asAdmin();
    mockQueue([mockGroup({ _id: 'cApp', status: 'approved' })]);
    renderQueue();
    await screen.findByText('house');
    expect(screen.getByRole('button', { name: /^publish$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^reject$/i })).toBeInTheDocument();
  });

  it('enables variant Publish under a published concept', async () => {
    const user = userEvent.setup();
    asAdmin();
    mockQueue([mockGroup({ _id: 'cDone', status: 'published' }, [mockVariant({ _id: 'vPub', status: 'approved', concept: 'cDone' })])]);
    api.patch.mockResolvedValueOnce({ data: { success: true, data: {} } });
    mockQueue([]);

    renderQueue();
    const region = await expandVariants(user);
    await user.click(within(region).getByRole('button', { name: /^publish$/i }));
    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/api/variants/vPub/status', { status: 'published' });
    });
  });
});
