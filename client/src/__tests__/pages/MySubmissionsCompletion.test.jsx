import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import MySubmissions from '../../pages/MySubmissions';
import api, { createSuggestion, resubmitSuggestion } from '../../services/api';
import { LookupsWrapper } from '../helpers/lookups';
import { FieldsWrapper } from '../helpers/fields';
import { mockSubmissionsApi, openSection } from '../helpers/mySubmissions';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  updateConcept: vi.fn(),
  updateVariant: vi.fn(),
  createSuggestion: vi.fn(),
  resubmitSuggestion: vi.fn(),
  getMyAudio: vi.fn(() => Promise.resolve({ data: { data: [], meta: { total: 0 } } })),
  getMySuggestions: vi.fn(() => Promise.resolve({ data: { data: [], meta: { total: 0 } } })),
  withdrawAudio: vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { id: '1', role: 'user', username: 'zain' }, token: 'jwt' })),
}));

const published = (overrides = {}) => ({
  _id: 'v1', pashto: 'لمر', definition: 'sun', region: 'Kohat', status: 'published',
  concept: { _id: 'c1', englishGloss: 'sun', partOfSpeech: 'noun' },
  missingFields: ['phonetic', 'example', 'forms', 'extra.register'],
  fillableFields: ['phonetic', 'example', 'forms', 'extra.register'],
  formsFilled: 0, formsTotal: 8, latestSuggestion: null,
  ...overrides,
});

function mockLoad(variants, meta = {}) {
  mockSubmissionsApi(api, { variants, variantsMeta: { needsCompletionCount: 1, ...meta } });
}

// Sections start closed, so open Variants to see the rows
async function renderPage() {
  render(
    <LookupsWrapper>
      <FieldsWrapper>
        <MemoryRouter>
          <MySubmissions />
        </MemoryRouter>
      </FieldsWrapper>
    </LookupsWrapper>
  );
  await openSection(userEvent.setup(), 'Variants');
}

const variantCalls = () => api.get.mock.calls.filter(([url]) => url === '/api/variants/my-submissions');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('My Submissions — needs completion', () => {
  it('shows the chip with its count and filters with needs=completion', async () => {
    const user = userEvent.setup();
    mockLoad([published()], { needsCompletionCount: 3 });
    await renderPage();
    const chip = await screen.findByRole('button', { name: 'Needs completion (3)' });
    await user.click(chip);
    await waitFor(() => expect(variantCalls().at(-1)[1]).toEqual({ params: { limit: 5, needs: 'completion' } }));
    expect(chip).toHaveAttribute('aria-pressed', 'true');

    await user.selectOptions(screen.getByLabelText('Missing detail'), 'extra.register');
    await waitFor(() => expect(variantCalls().at(-1)[1]).toEqual({ params: { limit: 5, needs: 'completion', missing: 'extra.register' } }));
  });

  it('hides the chip when nothing needs completing', async () => {
    mockLoad([published({ missingFields: [], fillableFields: [] })], { needsCompletionCount: 0 });
    await renderPage();
    await screen.findByText('لمر');
    expect(screen.queryByRole('button', { name: /needs completion/i })).not.toBeInTheDocument();
  });

  it('filters by region', async () => {
    const user = userEvent.setup();
    mockLoad([published()]);
    await renderPage();
    await screen.findByText('لمر');
    await user.selectOptions(screen.getByLabelText('Filter by region'), 'Hangu');
    await waitFor(() => expect(variantCalls().at(-1)[1]).toEqual({ params: { limit: 5, region: 'Hangu' } }));
  });

  it('lists what is missing and offers an Add chip; filled fields are prefilled and only changed ones are sent', async () => {
    const user = userEvent.setup();
    mockLoad([published({ phonetic: 'lmar', missingFields: ['example'], fillableFields: ['example'] })]);
    createSuggestion.mockResolvedValue({ data: { data: {} } });
    await renderPage();

    expect(await screen.findByRole('group', { name: 'Missing details' })).toHaveTextContent('Needs');
    await user.click(screen.getByRole('button', { name: 'Add Example' }));
    const form = screen.getByRole('form', { name: /suggest changes/i });
    expect(within(form).getByLabelText('Phonetic')).toHaveValue('lmar');

    await user.type(within(form).getByLabelText('Example sentence'), 'لمر راختلی دی');
    await user.click(within(form).getByRole('button', { name: 'Send suggestion' }));
    await waitFor(() => expect(createSuggestion).toHaveBeenCalledWith('v1', { example: 'لمر راختلی دی' }));
    await waitFor(() => expect(variantCalls().length).toBe(2));
  });

  it('shows one gold chip per missing detail and a top-right Edit button; both open the form', async () => {
    const user = userEvent.setup();
    mockLoad([published({ missingFields: ['example', 'forms', 'extra.register'] })]);
    await renderPage();

    const group = await screen.findByRole('group', { name: 'Missing details' });
    expect(within(group).getAllByRole('button').map((b) => b.getAttribute('aria-label')))
      .toEqual(['Add Example', 'Add Forms', 'Add Register']);
    await user.click(within(group).getByRole('button', { name: 'Add Forms' }));
    expect(screen.getByRole('form', { name: /suggest changes/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('edits existing details: shows the current value and sends only what changed', async () => {
    const user = userEvent.setup();
    mockLoad([published({ phonetic: 'lmar', example: 'old', missingFields: [], fillableFields: [] })], { needsCompletionCount: 0 });
    createSuggestion.mockResolvedValue({ data: { data: {} } });
    await renderPage();

    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: /suggest changes/i });
    expect(within(form).getByLabelText('Pashto')).toHaveValue('لمر');
    const definition = within(form).getByLabelText('Definition');
    await user.clear(definition);
    await user.type(definition, 'the sun');
    expect(within(form).getByText('sun')).toBeInTheDocument(); // "Current: sun"
    await user.click(within(form).getByRole('button', { name: 'Send suggestion' }));
    await waitFor(() => expect(createSuggestion).toHaveBeenCalledWith('v1', { definition: 'the sun' }));
  });

  it('refuses to send when nothing changed', async () => {
    const user = userEvent.setup();
    mockLoad([published({ missingFields: [], fillableFields: [] })], { needsCompletionCount: 0 });
    await renderPage();
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Send suggestion' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Change at least one detail');
    expect(createSuggestion).not.toHaveBeenCalled();
  });

  it('shows a pending edit as old → new next to the unchanged details', async () => {
    mockLoad([published({
      phonetic: 'lmar', missingFields: [], fillableFields: [],
      latestSuggestion: { _id: 's1', status: 'pending', proposed: { definition: 'the sun' }, baseline: { definition: 'sun' } },
    })], { needsCompletionCount: 0 });
    await renderPage();

    const changes = await screen.findByRole('region', { name: 'Proposed details' });
    expect(within(changes).getByText('sun').tagName).toBe('DEL');
    expect(within(changes).getByText('the sun').tagName).toBe('INS');
    const unchanged = screen.getByRole('region', { name: 'Unchanged details' });
    expect(within(unchanged).getByText('لمر')).toBeInTheDocument();
    expect(within(unchanged).getByText('lmar')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('a rejected edit shows the note and its diff, and resubmits from the suggested values', async () => {
    const user = userEvent.setup();
    mockLoad([published({
      missingFields: [], fillableFields: [],
      latestSuggestion: { _id: 's1', status: 'rejected', moderatorNote: 'Too vague', proposed: { definition: 'star' }, baseline: { definition: 'sun' } },
    })], { needsCompletionCount: 0 });
    resubmitSuggestion.mockResolvedValue({ data: { data: {} } });
    await renderPage();

    expect(await screen.findByText('Suggestion rejected: Too vague')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Proposed details' })).getByText('star')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /edit & resubmit suggestion/i }));
    expect(screen.getByLabelText('Definition')).toHaveValue('star');
    await user.clear(screen.getByLabelText('Definition'));
    await user.type(screen.getByLabelText('Definition'), 'the bright sun');
    await user.click(screen.getByRole('button', { name: 'Resubmit suggestion' }));
    await waitFor(() => expect(resubmitSuggestion).toHaveBeenCalledWith('s1', { definition: 'the bright sun' }));
  });

  it('warns when the word changed since the suggestion was written', async () => {
    mockLoad([published({
      definition: 'sun, edited', missingFields: [], fillableFields: [],
      latestSuggestion: { _id: 's1', status: 'pending', proposed: { definition: 'the sun' }, baseline: { definition: 'sun' } },
    })], { needsCompletionCount: 0 });
    await renderPage();
    expect(await screen.findByRole('status')).toHaveTextContent(/changed since this was suggested/i);
  });

  it('labels custom fields by name and sends only filled values', async () => {
    const user = userEvent.setup();
    mockLoad([published({ missingFields: ['extra.register'], fillableFields: ['extra.register'] })]);
    createSuggestion.mockResolvedValue({ data: { data: {} } });
    await renderPage();
    expect(await screen.findByRole('button', { name: 'Add Register' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add Register' }));
    await user.selectOptions(screen.getByLabelText(/register/i), 'Formal');
    await user.click(screen.getByRole('button', { name: 'Send suggestion' }));
    await waitFor(() => expect(createSuggestion).toHaveBeenCalledWith('v1', { extra: { register: 'Formal' } }));
  });

  it('shows a server error in the form', async () => {
    const user = userEvent.setup();
    mockLoad([published({ missingFields: ['phonetic'], fillableFields: ['phonetic'] })]);
    createSuggestion.mockRejectedValue({ response: { data: { error: { message: 'Phonetic is already filled and cannot be changed' } } } });
    await renderPage();
    await user.click(await screen.findByRole('button', { name: 'Add Phonetic' }));
    await user.type(screen.getByLabelText('Phonetic'), 'lmar');
    await user.click(screen.getByRole('button', { name: 'Send suggestion' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Phonetic is already filled');
  });

  it('shows an open suggestion status instead of the edit button and missing chips', async () => {
    mockLoad([published({ latestSuggestion: { _id: 's1', status: 'approved' } })]);
    await renderPage();
    expect(await screen.findByText('Suggestion approved')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^edit|^add /i })).not.toBeInTheDocument();
  });

  it('shows a rejected suggestion with its note and resubmits it', async () => {
    const user = userEvent.setup();
    mockLoad([published({
      missingFields: ['phonetic'], fillableFields: ['phonetic'],
      latestSuggestion: { _id: 's1', status: 'rejected', moderatorNote: 'Spelling', proposed: { phonetic: 'lmr' } },
    })]);
    resubmitSuggestion.mockResolvedValue({ data: { data: {} } });
    await renderPage();

    expect(await screen.findByText('Suggestion rejected: Spelling')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /edit & resubmit suggestion/i }));
    const input = screen.getByLabelText('Phonetic');
    expect(input).toHaveValue('lmr');
    await user.clear(input);
    await user.type(input, 'lmar');
    await user.click(screen.getByRole('button', { name: 'Resubmit suggestion' }));
    await waitFor(() => expect(resubmitSuggestion).toHaveBeenCalledWith('s1', { phonetic: 'lmar' }));
  });

  it('partly filled forms show quiet progress and an Edit button, without missing-detail chips', async () => {
    const form = { kind: 'noun', gender: 'masculine', number: 'singular', case: 'direct', pashto: 'لمر' };
    mockLoad([published({ forms: [form], missingFields: [], fillableFields: ['forms'], formsFilled: 1 })], { needsCompletionCount: 0 });
    await renderPage();
    expect(await screen.findByText('Forms 1/8')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Missing details' })).not.toBeInTheDocument();
  });

  it('the forms editor in a suggestion cannot pick a slot the word already has', async () => {
    const user = userEvent.setup();
    const form = { kind: 'noun', gender: 'masculine', number: 'singular', case: 'direct', pashto: 'لمر' };
    mockLoad([published({ forms: [form], missingFields: [], fillableFields: ['forms'], formsFilled: 1 })], { needsCompletionCount: 0 });
    await renderPage();
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: '+ Add form' }));
    const options = within(screen.getByLabelText('Form')).getAllByRole('option').map((o) => o.value);
    expect(options).not.toContain('masculine.singular.direct');
    expect(options).toContain('masculine.singular.oblique');
  });

  it('does not offer completion on unpublished words', async () => {
    mockLoad([published({ status: 'pending', missingFields: [], fillableFields: [] })]);
    await renderPage();
    await screen.findByText('لمر');
    expect(screen.queryByRole('button', { name: /^edit|^add /i })).not.toBeInTheDocument();
  });
});
