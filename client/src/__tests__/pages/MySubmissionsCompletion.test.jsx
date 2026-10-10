import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import MySubmissions from '../../pages/MySubmissions';
import api, { createSuggestion, resubmitSuggestion } from '../../services/api';
import { LookupsWrapper } from '../helpers/lookups';
import { FieldsWrapper } from '../helpers/fields';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  updateConcept: vi.fn(),
  updateVariant: vi.fn(),
  createSuggestion: vi.fn(),
  resubmitSuggestion: vi.fn(),
  getMyAudio: vi.fn(() => Promise.resolve({ data: { data: [], meta: { total: 0 } } })),
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
  api.get.mockImplementation((url) => Promise.resolve({
    data: url.startsWith('/api/concepts')
      ? { data: [] }
      : { data: variants, meta: { page: 1, limit: 20, total: variants.length, needsCompletionCount: 1, ...meta } },
  }));
}

const renderPage = () => render(
  <LookupsWrapper>
    <FieldsWrapper>
      <MemoryRouter>
        <MySubmissions />
      </MemoryRouter>
    </FieldsWrapper>
  </LookupsWrapper>
);

const variantCalls = () => api.get.mock.calls.filter(([url]) => url === '/api/variants/my-submissions');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('My Submissions — needs completion', () => {
  it('shows the chip with its count and filters with needs=completion', async () => {
    const user = userEvent.setup();
    mockLoad([published()], { needsCompletionCount: 3 });
    renderPage();
    const chip = await screen.findByRole('button', { name: 'Needs completion (3)' });
    await user.click(chip);
    await waitFor(() => expect(variantCalls().at(-1)[1]).toEqual({ params: { needs: 'completion' } }));
    expect(chip).toHaveAttribute('aria-pressed', 'true');

    await user.selectOptions(screen.getByLabelText('Missing detail'), 'extra.register');
    await waitFor(() => expect(variantCalls().at(-1)[1]).toEqual({ params: { needs: 'completion', missing: 'extra.register' } }));
  });

  it('hides the chip when nothing needs completing', async () => {
    mockLoad([published({ missingFields: [], fillableFields: [] })], { needsCompletionCount: 0 });
    renderPage();
    await screen.findByText('لمر');
    expect(screen.queryByRole('button', { name: /needs completion/i })).not.toBeInTheDocument();
  });

  it('filters by region', async () => {
    const user = userEvent.setup();
    mockLoad([published()]);
    renderPage();
    await screen.findByText('لمر');
    await user.selectOptions(screen.getByLabelText('Filter by region'), 'Hangu');
    await waitFor(() => expect(variantCalls().at(-1)[1]).toEqual({ params: { region: 'Hangu' } }));
  });

  it('lists what is missing and offers Complete this with inputs for blank fields only', async () => {
    const user = userEvent.setup();
    mockLoad([published({ phonetic: 'lmar', missingFields: ['example'], fillableFields: ['example'] })]);
    createSuggestion.mockResolvedValue({ data: { data: {} } });
    renderPage();

    expect(await screen.findByText('Needs: example')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Complete this' }));
    const form = screen.getByRole('form', { name: /suggest missing details/i });
    expect(within(form).queryByLabelText('Phonetic')).not.toBeInTheDocument();

    await user.type(within(form).getByLabelText('Example sentence'), 'لمر راختلی دی');
    await user.click(within(form).getByRole('button', { name: 'Send suggestion' }));
    await waitFor(() => expect(createSuggestion).toHaveBeenCalledWith('v1', { example: 'لمر راختلی دی' }));
    await waitFor(() => expect(variantCalls().length).toBe(2));
  });

  it('labels custom fields by name and sends only filled values', async () => {
    const user = userEvent.setup();
    mockLoad([published({ missingFields: ['extra.register'], fillableFields: ['extra.register'] })]);
    createSuggestion.mockResolvedValue({ data: { data: {} } });
    renderPage();
    expect(await screen.findByText('Needs: Register')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Complete this' }));
    await user.selectOptions(screen.getByLabelText(/register/i), 'Formal');
    await user.click(screen.getByRole('button', { name: 'Send suggestion' }));
    await waitFor(() => expect(createSuggestion).toHaveBeenCalledWith('v1', { extra: { register: 'Formal' } }));
  });

  it('shows a server error in the form', async () => {
    const user = userEvent.setup();
    mockLoad([published({ missingFields: ['phonetic'], fillableFields: ['phonetic'] })]);
    createSuggestion.mockRejectedValue({ response: { data: { error: { message: 'Phonetic is already filled and cannot be changed' } } } });
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Complete this' }));
    await user.type(screen.getByLabelText('Phonetic'), 'lmar');
    await user.click(screen.getByRole('button', { name: 'Send suggestion' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Phonetic is already filled');
  });

  it('shows an open suggestion status instead of Complete this', async () => {
    mockLoad([published({ latestSuggestion: { _id: 's1', status: 'approved' } })]);
    renderPage();
    expect(await screen.findByText('Suggestion approved')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Complete this' })).not.toBeInTheDocument();
  });

  it('shows a rejected suggestion with its note and resubmits it', async () => {
    const user = userEvent.setup();
    mockLoad([published({
      missingFields: ['phonetic'], fillableFields: ['phonetic'],
      latestSuggestion: { _id: 's1', status: 'rejected', moderatorNote: 'Spelling', proposed: { phonetic: 'lmr' } },
    })]);
    resubmitSuggestion.mockResolvedValue({ data: { data: {} } });
    renderPage();

    expect(await screen.findByText('Suggestion rejected: Spelling')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /edit & resubmit suggestion/i }));
    const input = screen.getByLabelText('Phonetic');
    expect(input).toHaveValue('lmr');
    await user.clear(input);
    await user.type(input, 'lmar');
    await user.click(screen.getByRole('button', { name: 'Resubmit suggestion' }));
    await waitFor(() => expect(resubmitSuggestion).toHaveBeenCalledWith('s1', { phonetic: 'lmar' }));
  });

  it('partly filled forms show quiet progress and Add details, without a needs line', async () => {
    const form = { kind: 'noun', gender: 'masculine', number: 'singular', case: 'direct', pashto: 'لمر' };
    mockLoad([published({ forms: [form], missingFields: [], fillableFields: ['forms'], formsFilled: 1 })], { needsCompletionCount: 0 });
    renderPage();
    expect(await screen.findByText('Forms 1/8')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add details' })).toBeInTheDocument();
    expect(screen.queryByText(/^Needs:/)).not.toBeInTheDocument();
  });

  it('the forms editor in a suggestion cannot pick a slot the word already has', async () => {
    const user = userEvent.setup();
    const form = { kind: 'noun', gender: 'masculine', number: 'singular', case: 'direct', pashto: 'لمر' };
    mockLoad([published({ forms: [form], missingFields: [], fillableFields: ['forms'], formsFilled: 1 })], { needsCompletionCount: 0 });
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Add details' }));
    await user.click(screen.getByRole('button', { name: '+ Add form' }));
    const options = within(screen.getByLabelText('Form')).getAllByRole('option').map((o) => o.value);
    expect(options).not.toContain('masculine.singular.direct');
    expect(options).toContain('masculine.singular.oblique');
  });

  it('does not offer completion on unpublished words', async () => {
    mockLoad([published({ status: 'pending', missingFields: [], fillableFields: [] })]);
    renderPage();
    await screen.findByText('لمر');
    expect(screen.queryByRole('button', { name: /complete this|add details/i })).not.toBeInTheDocument();
  });
});
