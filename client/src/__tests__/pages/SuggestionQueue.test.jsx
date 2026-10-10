import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import DashboardQueue from '../../pages/dashboard/DashboardQueue';
import DashboardLog from '../../pages/dashboard/DashboardLog';
import VariantEditForm from '../../components/moderation/VariantEditForm';
import ManagedVariantRow from '../../components/moderation/ManagedVariantRow';
import api, { getSuggestionQueue, transitionSuggestion, editSuggestion } from '../../services/api';
import { LookupsWrapper } from '../helpers/lookups';
import { FieldsWrapper } from '../helpers/fields';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  checkCrossConceptPashto: vi.fn(),
  getSuggestionQueue: vi.fn(),
  transitionSuggestion: vi.fn(),
  editSuggestion: vi.fn(),
}));

const mockUseAuth = vi.fn();
vi.mock('../../context/AuthContext', () => ({ useAuth: () => mockUseAuth() }));
const asModerator = () => mockUseAuth.mockReturnValue({ user: { id: 'm1', role: 'moderator' }, token: 't' });
const asAdmin = () => mockUseAuth.mockReturnValue({ user: { id: 'a1', role: 'admin' }, token: 't' });

const suggestion = (overrides = {}) => ({
  _id: 's1',
  status: 'pending',
  proposed: {
    phonetic: 'lmar',
    extra: { register: 'Formal' },
    forms: [{ kind: 'noun', gender: 'masculine', number: 'plural', case: 'direct', pashto: 'لمرونه' }],
  },
  submittedBy: { _id: 'u1', username: 'zain' },
  variant: {
    _id: 'v1', pashto: 'لمر', region: 'Kohat', definition: 'sun', forms: [],
    concept: { _id: 'c1', englishGloss: 'Sun', partOfSpeech: 'noun' },
  },
  ...overrides,
});

// The queue is grouped by word; each suggestion here becomes its own group
function mockQueue(items, meta = {}) {
  const groups = items.map(({ variant, ...s }) => ({ variant, suggestions: [s] }));
  getSuggestionQueue.mockResolvedValue({
    data: { data: groups, meta: { page: 1, limit: 20, total: groups.length, pendingCount: items.length, approvedCount: 0, ...meta } },
  });
}

const renderQueue = (url = '/dashboard/queue?view=suggestions') => render(
  <LookupsWrapper>
    <FieldsWrapper>
      <MemoryRouter initialEntries={[url]}>
        <DashboardQueue />
      </MemoryRouter>
    </FieldsWrapper>
  </LookupsWrapper>
);

beforeEach(() => {
  vi.resetAllMocks();
  asModerator();
});

describe('Moderation queue — Suggestions view', () => {
  it('switches between Entries and Suggestions without touching the entries queue', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue({ data: { data: [], meta: { total: 0 } } });
    mockQueue([]);
    renderQueue('/dashboard/queue');
    expect(await screen.findByText('Nothing in the queue.')).toBeInTheDocument();
    expect(getSuggestionQueue).not.toHaveBeenCalled();

    await user.click(screen.getByRole('tab', { name: 'Suggestions' }));
    expect(await screen.findByText('No suggestions waiting.')).toBeInTheDocument();
    expect(getSuggestionQueue).toHaveBeenCalledWith({ status: 'pending', page: 1 });
  });

  it('shows the live word next to each proposed value', async () => {
    mockQueue([suggestion()]);
    renderQueue();
    expect(await screen.findByText('Sun')).toBeInTheDocument();
    const proposed = screen.getByRole('region', { name: 'Proposed details' });
    expect(within(proposed).getByText('lmar')).toBeInTheDocument();
    expect(within(proposed).getByText(/^Register/)).toBeInTheDocument();
    expect(within(proposed).getByText('Formal')).toBeInTheDocument();
    expect(within(proposed).getByText(/Form \(Masculine plural, direct\)/)).toBeInTheDocument();
    expect(within(proposed).getByText(/Proposed by zain/)).toBeInTheDocument();
  });

  it('moderator approves a pending suggestion and the list refreshes', async () => {
    const user = userEvent.setup();
    mockQueue([suggestion()]);
    transitionSuggestion.mockResolvedValue({ data: { data: {} } });
    renderQueue();
    await user.click(await screen.findByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(transitionSuggestion).toHaveBeenCalledWith('s1', { status: 'approved' }));
    await waitFor(() => expect(getSuggestionQueue).toHaveBeenCalledTimes(2));
  });

  it('rejecting requires a note in the modal', async () => {
    const user = userEvent.setup();
    mockQueue([suggestion()]);
    transitionSuggestion.mockResolvedValue({ data: { data: {} } });
    renderQueue();
    await user.click(await screen.findByRole('button', { name: 'Reject' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Confirm' })).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/reason/i), 'Wrong spelling');
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(transitionSuggestion).toHaveBeenCalledWith('s1', { status: 'rejected', moderatorNote: 'Wrong spelling' }));
  });

  it('moderators see no status filter, no Publish and no Edit on their own suggestion', async () => {
    mockQueue([suggestion({ submittedBy: { _id: 'm1', username: 'me' } })]);
    renderQueue();
    await screen.findByText('Sun');
    expect(screen.queryByRole('button', { name: /^approved/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('admin switches to Approved, publishes, and sees a publish-time conflict', async () => {
    const user = userEvent.setup();
    asAdmin();
    mockQueue([suggestion({ status: 'approved' })], { pendingCount: 0, approvedCount: 1 });
    transitionSuggestion.mockRejectedValue({
      response: { data: { error: { message: 'Cannot publish: Phonetic is already filled and cannot be changed. Edit or reject the suggestion.' } } },
    });
    renderQueue();
    await user.click(await screen.findByRole('button', { name: 'approved (1)' }));
    await waitFor(() => expect(getSuggestionQueue).toHaveBeenLastCalledWith({ status: 'approved', page: 1 }));

    await user.click(await screen.findByRole('button', { name: 'Publish' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot publish: phonetic is already filled/i);
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('staff edit sends the corrected proposal with a required note', async () => {
    const user = userEvent.setup();
    asAdmin();
    mockQueue([suggestion({ proposed: { example: 'tpyo' } })]);
    editSuggestion.mockResolvedValue({ data: { data: {} } });
    renderQueue();
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit suggestion' });
    const save = within(form).getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();
    await user.clear(within(form).getByLabelText('Example'));
    await user.type(within(form).getByLabelText('Example'), 'typo');
    await user.type(within(form).getByLabelText(/note/i), 'fixed spelling');
    await user.click(save);
    await waitFor(() => expect(editSuggestion).toHaveBeenCalledWith('s1', { example: 'typo', note: 'fixed spelling' }));
  });
});

describe('Admin published panel — open suggestion lock', () => {
  const variant = { _id: 'v1', pashto: 'لمر', region: 'Kohat', definition: 'sun', extra: {}, forms: [] };
  const concept = { _id: 'c1', englishGloss: 'Sun', partOfSpeech: 'noun' };

  it('shows a badge linking to Suggestions', () => {
    render(
      <LookupsWrapper>
        <MemoryRouter>
          <ManagedVariantRow variant={variant} concept={concept} openSuggestions={[suggestion()]} onReject={() => {}} onSave={() => {}} />
        </MemoryRouter>
      </LookupsWrapper>
    );
    expect(screen.getByText(/suggestion pending — the fields they propose are locked/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /review it in suggestions/i })).toHaveAttribute('href', '/dashboard/queue?view=suggestions');
  });

  it('locks proposed fields in the edit form and hides proposed form slots', async () => {
    const user = userEvent.setup();
    render(
      <LookupsWrapper>
        <FieldsWrapper>
          <MemoryRouter>
            <VariantEditForm
              item={{ ...variant, concept }}
              lockedFields={['phonetic', 'extra.register', 'forms.masculine.singular.direct']}
              onSave={() => {}}
              onCancel={() => {}}
            />
          </MemoryRouter>
        </FieldsWrapper>
      </LookupsWrapper>
    );
    expect(screen.getByLabelText('Phonetic')).toBeDisabled();
    expect(screen.getByLabelText('Example')).toBeEnabled();
    expect(screen.getByLabelText(/register/i)).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '+ Add form' }));
    const options = within(screen.getByLabelText('Form')).getAllByRole('option').map((o) => o.value);
    expect(options).not.toContain('masculine.singular.direct');
  });
});

describe('Audit log — suggestion entries', () => {
  it('labels suggestion targets, shows suggestion_applied diffs and offers the new filters', async () => {
    asAdmin();
    api.get.mockResolvedValue({
      data: {
        data: [
          { _id: 'l1', action: 'suggestion_applied', targetModel: 'Variant', target: { pashto: 'لمر', region: 'Kohat' },
            performedBy: { username: 'boss' }, timestamp: '2026-10-01T00:00:00Z',
            changes: { phonetic: { from: '', to: 'lmar' }, suggestionId: 's1' } },
          { _id: 'l2', action: 'approved', targetModel: 'VariantSuggestion', target: { pashto: 'لمر', region: 'Kohat' },
            performedBy: { username: 'mod' }, timestamp: '2026-10-01T00:00:00Z' },
        ],
        meta: { page: 1, limit: 20, total: 2 },
      },
    });
    render(
      <LookupsWrapper>
        <FieldsWrapper>
          <MemoryRouter>
            <DashboardLog />
          </MemoryRouter>
        </FieldsWrapper>
      </LookupsWrapper>
    );
    expect(await screen.findByText('suggestion_applied', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('lmar')).toBeInTheDocument();
    expect(screen.getByText('Suggestion', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Suggestion' })).toHaveValue('VariantSuggestion');
    expect(screen.getByRole('option', { name: 'suggestion_applied' })).toBeInTheDocument();
  });
});
