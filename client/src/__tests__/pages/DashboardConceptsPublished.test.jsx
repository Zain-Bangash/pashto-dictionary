/**
 * Admin edit/reject of published concepts and variants — DashboardConcepts
 *
 * Tests for:
 *  - Only admins can expand a published concept row (row click or Manage button)
 *  - Panel loading / error / variant list
 *  - Reject concept (with cascade warning) and reject variant
 *  - Edit concept and edit variant
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import api, { getConcept, transitionConceptStatus, transitionVariantStatus } from '../../services/api';
import DashboardConcepts from '../../pages/dashboard/DashboardConcepts';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  getConcept: vi.fn(),
  transitionConceptStatus: vi.fn(),
  transitionVariantStatus: vi.fn(),
}));

const mockUseAuth = vi.fn();
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const asModerator = () =>
  mockUseAuth.mockReturnValue({ user: { _id: 'u2', role: 'moderator' }, token: 'tok' });

const asAdmin = () =>
  mockUseAuth.mockReturnValue({ user: { _id: 'u3', role: 'admin' }, token: 'tok' });

const listConcept = (overrides = {}) => ({
  _id: 'c1',
  englishGloss: 'water',
  partOfSpeech: 'noun',
  status: 'published',
  ...overrides,
});

const publishedVariant = (overrides = {}) => ({
  _id: 'v1',
  concept: 'c1',
  pashto: 'اوبه',
  phonetic: 'oba',
  region: 'Kohat',
  definition: 'clear liquid',
  status: 'published',
  submittedBy: { username: 'zarmina' },
  ...overrides,
});

function mockList(concepts) {
  api.get.mockResolvedValue({ data: { success: true, data: concepts, meta: { page: 1, limit: 20, total: concepts.length } } });
}

function mockDetail(variants = [publishedVariant()], concept = listConcept()) {
  getConcept.mockResolvedValue({ data: { success: true, data: { ...concept, variants } } });
}

const listCalls = () => api.get.mock.calls.filter(([url]) => url.startsWith('/api/concepts?'));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/dashboard/concepts']}>
      <DashboardConcepts />
    </MemoryRouter>
  );

async function openPanel(user, gloss = 'water') {
  await user.click(await screen.findByText(gloss));
  return screen.findByRole('region', { name: new RegExp(`manage ${gloss}`, 'i') });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Expanding published concepts', () => {
  it('admin can expand a published concept by clicking its row', async () => {
    const user = userEvent.setup();
    asAdmin();
    mockList([listConcept()]);
    mockDetail();

    renderPage();
    const panel = await openPanel(user);

    expect(getConcept).toHaveBeenCalledWith('c1');
    expect(await within(panel).findByText('اوبه')).toBeInTheDocument();
    expect(within(panel).getByText('Kohat')).toBeInTheDocument();
    expect(within(panel).getByText('clear liquid')).toBeInTheDocument();
  });

  it('admin can toggle the panel with the Manage button', async () => {
    const user = userEvent.setup();
    asAdmin();
    mockList([listConcept()]);
    mockDetail();

    renderPage();
    const manage = await screen.findByRole('button', { name: /manage/i });
    expect(manage).toHaveAttribute('aria-expanded', 'false');

    await user.click(manage);
    expect(manage).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region', { name: /manage water/i })).toBeInTheDocument();

    await user.click(manage);
    expect(screen.queryByRole('region', { name: /manage water/i })).not.toBeInTheDocument();
  });

  it('admin cannot expand a concept that is not published', async () => {
    const user = userEvent.setup();
    asAdmin();
    mockList([listConcept({ status: 'pending' })]);

    renderPage();
    await user.click(await screen.findByText('water'));

    expect(screen.queryByRole('button', { name: /manage/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /manage water/i })).not.toBeInTheDocument();
    expect(getConcept).not.toHaveBeenCalled();
  });

  it('moderator cannot expand a published concept', async () => {
    const user = userEvent.setup();
    asModerator();
    mockList([listConcept()]);

    renderPage();
    await user.click(await screen.findByText('water'));

    expect(screen.queryByRole('button', { name: /manage/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /manage water/i })).not.toBeInTheDocument();
    expect(getConcept).not.toHaveBeenCalled();
  });

  it('shows a loading state while variants load', async () => {
    const user = userEvent.setup();
    asAdmin();
    mockList([listConcept()]);
    getConcept.mockReturnValue(new Promise(() => {}));

    renderPage();
    const panel = await openPanel(user);
    expect(within(panel).getByText(/loading variants/i)).toBeInTheDocument();
  });

  it('shows an error state when variants fail to load', async () => {
    const user = userEvent.setup();
    asAdmin();
    mockList([listConcept()]);
    getConcept.mockRejectedValue(new Error('fail'));

    renderPage();
    const panel = await openPanel(user);
    expect(await within(panel).findByText(/failed to load variants/i)).toBeInTheDocument();
  });

  it('shows a message when the concept has no published variants', async () => {
    const user = userEvent.setup();
    asAdmin();
    mockList([listConcept()]);
    mockDetail([]);

    renderPage();
    const panel = await openPanel(user);
    expect(await within(panel).findByText(/no published variants/i)).toBeInTheDocument();
  });
});

describe('Rejecting published entries', () => {
  it('rejecting the concept warns about the cascade, sends the note and refetches the list', async () => {
    const user = userEvent.setup();
    asAdmin();
    mockList([listConcept()]);
    mockDetail([publishedVariant(), publishedVariant({ _id: 'v2', region: 'Hangu' })]);
    transitionConceptStatus.mockResolvedValue({ data: { success: true, data: listConcept({ status: 'rejected' }) } });

    renderPage();
    const panel = await openPanel(user);
    await within(panel).findAllByText('اوبه');
    await user.click(within(panel).getByRole('button', { name: /reject concept/i }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/all 2 variants will also be rejected/i)).toBeInTheDocument();
    const confirm = within(dialog).getByRole('button', { name: /confirm/i });
    expect(confirm).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/reason for rejection/i), 'wrong gloss');
    await user.click(confirm);

    expect(transitionConceptStatus).toHaveBeenCalledWith('c1', { status: 'rejected', moderatorNote: 'wrong gloss' });
    await waitFor(() => expect(listCalls()).toHaveLength(2));
  });

  it('rejecting a variant sends the note and removes it from the panel', async () => {
    const user = userEvent.setup();
    asAdmin();
    mockList([listConcept()]);
    mockDetail([publishedVariant(), publishedVariant({ _id: 'v2', pashto: 'اوبو', region: 'Hangu' })]);
    transitionVariantStatus.mockResolvedValue({ data: { success: true, data: publishedVariant({ status: 'rejected' }) } });

    renderPage();
    const panel = await openPanel(user);
    await within(panel).findByText('اوبه');
    const [firstReject] = within(panel).getAllByRole('button', { name: /reject variant/i });
    await user.click(firstReject);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByText(/will also be rejected/i)).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/reason for rejection/i), 'wrong region');
    await user.click(within(dialog).getByRole('button', { name: /confirm/i }));

    expect(transitionVariantStatus).toHaveBeenCalledWith('v1', { status: 'rejected', moderatorNote: 'wrong region' });
    await waitFor(() => expect(within(panel).queryByText('اوبه')).not.toBeInTheDocument());
    expect(within(panel).getByText('اوبو')).toBeInTheDocument();
  });

  it('shows the server error when a reject fails', async () => {
    const user = userEvent.setup();
    asAdmin();
    mockList([listConcept()]);
    mockDetail();
    transitionVariantStatus.mockRejectedValue({ response: { data: { error: { message: 'Only admins can reject published entries' } } } });

    renderPage();
    const panel = await openPanel(user);
    await within(panel).findByText('اوبه');
    await user.click(within(panel).getByRole('button', { name: /reject variant/i }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/reason for rejection/i), 'x');
    await user.click(within(dialog).getByRole('button', { name: /confirm/i }));

    expect(await within(panel).findByText('Only admins can reject published entries')).toBeInTheDocument();
    expect(within(panel).getByText('اوبه')).toBeInTheDocument();
  });

  it('cancelling the reject modal does not call the API', async () => {
    const user = userEvent.setup();
    asAdmin();
    mockList([listConcept()]);
    mockDetail();

    renderPage();
    const panel = await openPanel(user);
    await within(panel).findByText('اوبه');
    await user.click(within(panel).getByRole('button', { name: /reject concept/i }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /cancel/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(transitionConceptStatus).not.toHaveBeenCalled();
  });
});

describe('Editing published entries', () => {
  it('admin can edit the published concept and the row updates', async () => {
    const user = userEvent.setup();
    asAdmin();
    mockList([listConcept()]);
    mockDetail();
    api.patch.mockResolvedValue({ data: { success: true, data: listConcept({ englishGloss: 'fresh water' }) } });

    renderPage();
    const panel = await openPanel(user);
    await within(panel).findByText('اوبه');
    await user.click(within(panel).getByRole('button', { name: /edit concept/i }));

    const form = within(panel).getByRole('form', { name: /edit concept/i });
    await user.clear(within(form).getByLabelText(/english gloss/i));
    await user.type(within(form).getByLabelText(/english gloss/i), 'fresh water');
    await user.type(within(form).getByLabelText(/^note$/i), 'typo');
    await user.click(within(form).getByRole('button', { name: /save/i }));

    expect(api.patch).toHaveBeenCalledWith('/api/concepts/c1/edit', expect.objectContaining({ englishGloss: 'fresh water', note: 'typo' }));
    expect(await screen.findByText('fresh water')).toBeInTheDocument();
    expect(within(panel).queryByRole('form', { name: /edit concept/i })).not.toBeInTheDocument();
  });

  it('admin can edit a published variant and it updates in place', async () => {
    const user = userEvent.setup();
    asAdmin();
    mockList([listConcept()]);
    mockDetail();
    api.patch.mockResolvedValue({ data: { success: true, data: publishedVariant({ definition: 'drinking water' }) } });

    renderPage();
    const panel = await openPanel(user);
    await within(panel).findByText('اوبه');
    await user.click(within(panel).getByRole('button', { name: /edit variant/i }));

    const form = within(panel).getByRole('form', { name: /edit variant/i });
    await user.clear(within(form).getByLabelText(/definition/i));
    await user.type(within(form).getByLabelText(/definition/i), 'drinking water');
    await user.type(within(form).getByLabelText(/^note$/i), 'clarify');
    await user.click(within(form).getByRole('button', { name: /save/i }));

    expect(api.patch).toHaveBeenCalledWith('/api/variants/v1/edit', expect.objectContaining({ definition: 'drinking water', note: 'clarify' }));
    expect(await within(panel).findByText('drinking water')).toBeInTheDocument();
  });

  it('a variant reassigned to another concept leaves the panel', async () => {
    const user = userEvent.setup();
    asAdmin();
    mockList([listConcept()]);
    mockDetail();
    api.patch.mockResolvedValue({ data: { success: true, data: publishedVariant({ concept: 'c9' }) } });

    renderPage();
    const panel = await openPanel(user);
    await within(panel).findByText('اوبه');
    await user.click(within(panel).getByRole('button', { name: /edit variant/i }));
    const form = within(panel).getByRole('form', { name: /edit variant/i });
    await user.type(within(form).getByLabelText(/^note$/i), 'move');
    await user.click(within(form).getByRole('button', { name: /save/i }));

    await waitFor(() => expect(within(panel).queryByText('اوبه')).not.toBeInTheDocument());
  });
});
