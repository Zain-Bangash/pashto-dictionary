/**
 * Community form suggestions — anyone suggests forms on the concept page, contributors are credited,
 * moderators compare competing proposals per slot, and contributors track their suggestions.
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import { createSuggestion, getMySuggestions, resubmitSuggestion } from '../../services/api';
import SuggestFormsPanel from '../../components/concept/SuggestFormsPanel';
import FormsDisplay from '../../components/forms/FormsDisplay';
import SuggestionGroup from '../../components/moderation/SuggestionGroup';
import MySuggestions from '../../components/submissions/MySuggestions';
import { LookupsWrapper } from '../helpers/lookups';
import { FieldsWrapper } from '../helpers/fields';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })), post: vi.fn(), patch: vi.fn() },
  createSuggestion: vi.fn(),
  getMySuggestions: vi.fn(),
  resubmitSuggestion: vi.fn(),
}));

const mockUseAuth = vi.fn();
vi.mock('../../context/AuthContext', () => ({ useAuth: () => mockUseAuth() }));

const singular = { kind: 'noun', gender: 'masculine', number: 'singular', case: 'direct', pashto: 'کور' };
const plural = { kind: 'noun', gender: 'masculine', number: 'plural', case: 'direct', pashto: 'کورونه' };
const word = (overrides = {}) => ({ _id: 'v1', pashto: 'کور', region: 'Kohat', definition: 'house', forms: [singular], ...overrides });

const wrap = (ui, path = '/concepts/c1') => render(
  <LookupsWrapper>
    <FieldsWrapper>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/concepts/:id" element={ui} />
          <Route path="/login" element={<p>Login page</p>} />
          <Route path="*" element={ui} />
        </Routes>
      </MemoryRouter>
    </FieldsWrapper>
  </LookupsWrapper>
);

beforeEach(() => {
  vi.resetAllMocks();
  mockUseAuth.mockReturnValue({ user: { id: 'u9', role: 'user' } });
});

describe('Suggest forms on the concept page', () => {
  it('a signed-in user suggests a missing form; filled slots cannot be picked', async () => {
    const user = userEvent.setup();
    const onSent = vi.fn();
    createSuggestion.mockResolvedValue({ data: { data: { _id: 's1' } } });
    wrap(<SuggestFormsPanel variant={word()} partOfSpeech="noun" onSent={onSent} />);

    await user.click(screen.getByRole('button', { name: '+ Suggest forms' }));
    const form = screen.getByRole('form', { name: 'Suggest forms' });
    await user.click(within(form).getByRole('button', { name: '+ Add form' }));
    const slots = within(within(form).getByLabelText('Form')).getAllByRole('option').map((o) => o.value);
    expect(slots).not.toContain('masculine.singular.direct');

    await user.selectOptions(within(form).getByLabelText('Form'), 'masculine.plural.direct');
    await user.type(within(form).getByLabelText('Pashto'), 'کورونه');
    await user.click(within(form).getByRole('button', { name: 'Send suggestion' }));

    expect(createSuggestion).toHaveBeenCalledWith('v1', { forms: [{ ...plural }] });
    expect(await screen.findByText(/your forms will appear here once they are reviewed/i)).toBeInTheDocument();
    expect(onSent).toHaveBeenCalledWith('v1');
  });

  it('shows the server message when the suggestion is refused', async () => {
    const user = userEvent.setup();
    createSuggestion.mockRejectedValue({ response: { data: { error: { message: 'You already have an open suggestion for this word' } } } });
    wrap(<SuggestFormsPanel variant={word()} partOfSpeech="noun" />);

    await user.click(screen.getByRole('button', { name: '+ Suggest forms' }));
    await user.click(screen.getByRole('button', { name: '+ Add form' }));
    await user.type(screen.getByLabelText('Pashto'), 'کورونه');
    await user.click(screen.getByRole('button', { name: 'Send suggestion' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('You already have an open suggestion for this word');
  });

  it('sends a guest to log in', async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ user: null });
    wrap(<SuggestFormsPanel variant={word()} partOfSpeech="noun" />);

    await user.click(screen.getByRole('button', { name: '+ Suggest forms' }));
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('tells the user when their suggestion for the word is already under review', () => {
    wrap(<SuggestFormsPanel variant={word()} partOfSpeech="noun" hasOpen />);
    expect(screen.getByText(/your suggestion for this word is under review/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Suggest forms' })).not.toBeInTheDocument();
  });

  it('offers nothing when the part of speech has no forms or every slot is filled', () => {
    const { unmount } = wrap(<SuggestFormsPanel variant={word()} partOfSpeech="adverb" />);
    expect(screen.queryByRole('button', { name: '+ Suggest forms' })).not.toBeInTheDocument();
    unmount();

    const verbForms = ['infinitive', 'past', 'present', 'imperative'].map((verbForm) => ({ kind: 'verb', verbForm, pashto: 'x' }));
    wrap(<SuggestFormsPanel variant={word({ forms: verbForms })} partOfSpeech="verb" />);
    expect(screen.queryByRole('button', { name: '+ Suggest forms' })).not.toBeInTheDocument();
  });
});

describe('Form credits', () => {
  it("credits forms added by someone other than the word's submitter", async () => {
    const user = userEvent.setup();
    const forms = [
      singular,
      { ...plural, addedBy: { username: 'gul', village: 'Usterzai', region: 'Kohat', cognitoSub: 'sub-gul' } },
      { kind: 'noun', gender: 'feminine', number: 'singular', case: 'direct', pashto: 'کوره', addedBy: { username: 'owner', cognitoSub: 'sub-owner' } },
    ];
    wrap(<FormsDisplay forms={forms} ownerSub="sub-owner" />);
    await user.click(screen.getByRole('button', { name: /forms \(3\)/i }));

    expect(screen.getAllByText(/^Added by/)).toHaveLength(1);
    expect(screen.getByText('Added by gul (Usterzai, Kohat)')).toBeInTheDocument();
  });
});

describe('Suggestions queue grouped by word', () => {
  const group = {
    variant: { ...word(), concept: { englishGloss: 'House', partOfSpeech: 'noun' }, submittedBy: { username: 'owner', cognitoSub: 'sub-owner' } },
    suggestions: [
      { _id: 's1', status: 'pending', proposed: { forms: [plural] }, submittedBy: { username: 'gul', cognitoSub: 'sub-gul' } },
      { _id: 's2', status: 'pending', proposed: { forms: [{ ...plural, pashto: 'کوران' }, { ...singular, pashto: 'کورک' }] }, submittedBy: { username: 'owner', cognitoSub: 'sub-owner' } },
    ],
  };

  it("shows one word with every proposal, flags conflicting and already-filled slots, and names each proposer", () => {
    wrap(<ul><SuggestionGroup group={group} isAdmin={false} onApprove={() => {}} onReject={() => {}} onPublish={() => {}} onSaved={() => {}} /></ul>);

    expect(screen.getByText('House')).toBeInTheDocument();
    expect(screen.getByText(/2 suggestions/)).toBeInTheDocument();

    const table = screen.getByRole('table', { name: /proposed forms by slot/i });
    const pluralRow = within(table).getByRole('rowheader', { name: /masculine plural, direct/i }).closest('tr');
    expect(within(pluralRow).getByText('Conflict')).toBeInTheDocument();
    expect(within(pluralRow).getByText('کورونه')).toBeInTheDocument();
    expect(within(pluralRow).getByText('کوران')).toBeInTheDocument();
    const singularRow = within(table).getByRole('rowheader', { name: /masculine singular, direct/i }).closest('tr');
    expect(within(singularRow).getByText('Already filled')).toBeInTheDocument();

    expect(screen.getByText('Proposed by gul')).toBeInTheDocument();
    expect(screen.getByText("Proposed by owner (the word's submitter)")).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Approve' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('collapses and expands the word', async () => {
    const user = userEvent.setup();
    wrap(<ul><SuggestionGroup group={group} isAdmin onApprove={() => {}} onReject={() => {}} onPublish={() => {}} onSaved={() => {}} /></ul>);
    const toggle = screen.getByRole('button', { name: /2 suggestions/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(toggle);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('My suggestions on other people\'s words', () => {
  const mine = (overrides = {}) => ({
    _id: 's1',
    status: 'pending',
    proposed: { forms: [plural] },
    variant: { _id: 'v1', pashto: 'کور', region: 'Kohat', status: 'published', forms: [singular], concept: { _id: 'c1', englishGloss: 'House', partOfSpeech: 'noun' } },
    ...overrides,
  });

  it('lists them with their status and the word they belong to', async () => {
    getMySuggestions.mockResolvedValue({ data: { data: [mine()], meta: { total: 1, limit: 20 } } });
    wrap(<MySuggestions />, '/my-submissions');

    expect(await screen.findByText('Forms you suggested')).toBeInTheDocument();
    expect(getMySuggestions).toHaveBeenCalledWith({ scope: 'others', page: 1 });
    expect(screen.getByText('House')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
    expect(screen.getByText('کورونه')).toBeInTheDocument();
  });

  it('a rejected suggestion shows the note and can be resubmitted with forms', async () => {
    const user = userEvent.setup();
    getMySuggestions.mockResolvedValue({ data: { data: [mine({ status: 'rejected', moderatorNote: 'Spelling' })], meta: { total: 1, limit: 20 } } });
    resubmitSuggestion.mockResolvedValue({ data: { data: {} } });
    wrap(<MySuggestions />, '/my-submissions');

    expect(await screen.findByText('Note: Spelling')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit & resubmit' }));
    const pashto = screen.getByLabelText('Pashto');
    await user.clear(pashto);
    await user.type(pashto, 'کورونو');
    await user.click(screen.getByRole('button', { name: 'Resubmit suggestion' }));

    expect(resubmitSuggestion).toHaveBeenCalledWith('s1', { forms: [{ ...plural, pashto: 'کورونو' }] });
    await waitFor(() => expect(getMySuggestions).toHaveBeenCalledTimes(2));
  });

  it('renders nothing when there are none', async () => {
    getMySuggestions.mockResolvedValue({ data: { data: [], meta: { total: 0, limit: 20 } } });
    const { container } = wrap(<MySuggestions />, '/my-submissions');
    await waitFor(() => expect(getMySuggestions).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
