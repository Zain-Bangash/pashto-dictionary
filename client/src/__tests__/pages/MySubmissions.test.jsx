import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import MySubmissions from '../../pages/MySubmissions';
import api, { getMyAudio, getMySuggestions } from '../../services/api';
import { LookupsWrapper } from '../helpers/lookups';
import { mockSubmissionsApi, callsTo, openSection, countsFor } from '../helpers/mySubmissions';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  getMyAudio: vi.fn(() => Promise.resolve({ data: { data: [], meta: { total: 0 } } })),
  getMySuggestions: vi.fn(() => Promise.resolve({ data: { data: [], meta: { total: 0 } } })),
  withdrawAudio: vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { _id: '1', role: 'user', username: 'zain' }, token: 'jwt-token' })),
}));

const renderMySubmissions = () =>
  render(
    <LookupsWrapper>
      <MemoryRouter initialEntries={['/my-submissions']}>
        <Routes>
          <Route path="/my-submissions" element={<MySubmissions />} />
        </Routes>
      </MemoryRouter>
    </LookupsWrapper>
  );

const mockConcept = (overrides = {}) => ({
  _id: 'concept1', englishGloss: 'house', partOfSpeech: 'noun', status: 'pending', createdAt: '2024-01-01T00:00:00.000Z', ...overrides,
});
const mockVariant = (overrides = {}) => ({
  _id: 'variant1', pashto: 'کور', definition: 'a dwelling place', region: 'Kohat', status: 'pending', createdAt: '2024-01-01T00:00:00.000Z', ...overrides,
});
const emptySummary = (overrides = {}) => ({
  concepts: countsFor([]), variants: countsFor([]), audio: countsFor([]), suggestions: countsFor([]), ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  getMyAudio.mockResolvedValue({ data: { data: [], meta: { total: 0 } } });
  getMySuggestions.mockResolvedValue({ data: { data: [], meta: { total: 0 } } });
});

describe('MySubmissions page — sections', () => {
  it('shows an empty state when there is nothing, with a link to submit', async () => {
    mockSubmissionsApi(api);
    renderMySubmissions();
    expect(await screen.findByText(/no submissions yet/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /submit/i })).toBeInTheDocument();
  });

  it('shows concepts, variants and recordings as closed sections with their counts', async () => {
    mockSubmissionsApi(api, {
      concepts: [mockConcept(), mockConcept({ _id: 'c2', status: 'rejected' })],
      variants: [mockVariant()],
    });
    renderMySubmissions();

    const concepts = await screen.findByRole('button', { name: /^concepts/i });
    expect(concepts).toHaveAttribute('aria-expanded', 'false');
    expect(concepts).toHaveTextContent('2');
    expect(concepts).toHaveTextContent('1 rejected');
    expect(screen.getByRole('button', { name: /^variants/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: /^recordings/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('house')).not.toBeInTheDocument();
  });

  it('loads a section only when it is opened, and closes it again', async () => {
    const user = userEvent.setup();
    mockSubmissionsApi(api, { concepts: [mockConcept()] });
    renderMySubmissions();

    const button = await screen.findByRole('button', { name: /^concepts/i });
    expect(callsTo(api, '/api/concepts/my-submissions')).toHaveLength(0);
    expect(callsTo(api, '/api/variants/my-submissions')).toHaveLength(0);
    expect(getMyAudio).not.toHaveBeenCalled();

    await user.click(button);
    expect(await screen.findByText('house')).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(callsTo(api, '/api/variants/my-submissions')).toHaveLength(0);

    await user.click(button);
    expect(screen.queryByText('house')).not.toBeInTheDocument();
  });

  it('lists variants with their status badge and the moderator note on a rejected one', async () => {
    const user = userEvent.setup();
    mockSubmissionsApi(api, {
      variants: [mockVariant({ pashto: 'کور' }), mockVariant({ _id: 'v2', pashto: 'اوبه', status: 'rejected', moderatorNote: 'Wrong spelling' })],
    });
    renderMySubmissions();
    await openSection(user, 'Variants');
    expect(await screen.findByText('کور')).toBeInTheDocument();
    expect(screen.getByText('اوبه')).toBeInTheDocument();
    expect(screen.getByText(/wrong spelling/i)).toBeInTheDocument();
  });

  it('shows the moderator note on a rejected concept', async () => {
    const user = userEvent.setup();
    mockSubmissionsApi(api, { concepts: [mockConcept({ status: 'rejected', moderatorNote: 'Duplicate entry' })] });
    renderMySubmissions();
    await openSection(user, 'Concepts');
    expect(await screen.findByText(/duplicate entry/i)).toBeInTheDocument();
  });

  it('hides the suggestions section when I have none, and shows it with its count when I do', async () => {
    mockSubmissionsApi(api, { concepts: [mockConcept()], summary: emptySummary({ concepts: countsFor([mockConcept()]) }) });
    const { unmount } = renderMySubmissions();
    await screen.findByRole('button', { name: /^concepts/i });
    expect(screen.queryByRole('button', { name: /forms you suggested/i })).not.toBeInTheDocument();
    unmount();

    mockSubmissionsApi(api, { summary: emptySummary({ suggestions: countsFor([{ status: 'rejected' }, { status: 'pending' }]) }) });
    renderMySubmissions();
    const section = await screen.findByRole('button', { name: /forms you suggested/i });
    expect(section).toHaveTextContent('2');
    expect(section).toHaveTextContent('1 rejected');
  });

  it('still shows the sections without counts when the summary cannot be loaded', async () => {
    const user = userEvent.setup();
    api.get.mockImplementation((url) => (url === '/api/submissions/summary'
      ? Promise.reject(new Error('down'))
      : Promise.resolve({ data: { data: [mockConcept()], meta: { total: 1, limit: 20 } } })));
    renderMySubmissions();
    await openSection(user, 'Concepts');
    expect(await screen.findByText('house')).toBeInTheDocument();
  });

  it('shows an error inside the section when its list fails to load', async () => {
    const user = userEvent.setup();
    api.get.mockImplementation((url) => (url === '/api/concepts/my-submissions'
      ? Promise.reject(new Error('Network error'))
      : Promise.resolve({ data: { data: emptySummary({ concepts: countsFor([mockConcept()]) }) } })));
    renderMySubmissions();
    await openSection(user, 'Concepts');
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load your concepts/i);
  });
});

describe('MySubmissions page — filters and pagination', () => {
  it('filters a section by status and shows the counts on the chips', async () => {
    const user = userEvent.setup();
    const concepts = [mockConcept(), mockConcept({ _id: 'c2', status: 'rejected' })];
    mockSubmissionsApi(api, { concepts });
    renderMySubmissions();
    await openSection(user, 'Concepts');

    const chips = await screen.findByRole('group', { name: 'Filter by status' });
    expect(within(chips).getByRole('button', { name: 'All (2)' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(chips).queryByRole('button', { name: /published/i })).not.toBeInTheDocument();

    await user.click(within(chips).getByRole('button', { name: 'Rejected (1)' }));
    await waitFor(() => expect(callsTo(api, '/api/concepts/my-submissions').at(-1)[1].params).toEqual(expect.objectContaining({ status: 'rejected', page: 1 })));
    expect(within(chips).getByRole('button', { name: 'Rejected (1)' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('searches concepts after a short pause and by part of speech', async () => {
    const user = userEvent.setup();
    mockSubmissionsApi(api, { concepts: [mockConcept()] });
    renderMySubmissions();
    await openSection(user, 'Concepts');

    await user.type(await screen.findByRole('searchbox', { name: 'Search my concepts' }), 'hou');
    await waitFor(() => expect(callsTo(api, '/api/concepts/my-submissions').at(-1)[1].params).toEqual(expect.objectContaining({ q: 'hou' })));

    await user.selectOptions(screen.getByLabelText('Filter concepts by part of speech'), 'verb');
    await waitFor(() => expect(callsTo(api, '/api/concepts/my-submissions').at(-1)[1].params).toEqual(expect.objectContaining({ q: 'hou', partOfSpeech: 'verb' })));
  });

  it('tells me when filters match nothing', async () => {
    const user = userEvent.setup();
    mockSubmissionsApi(api, { concepts: [mockConcept({ status: 'rejected' })] });
    renderMySubmissions();
    await openSection(user, 'Concepts');
    mockSubmissionsApi(api, { concepts: [], summary: emptySummary({ concepts: countsFor([mockConcept({ status: 'rejected' })]) }) });
    await user.click(await screen.findByRole('button', { name: 'Rejected (1)' }));
    expect(await screen.findByText(/no concepts match these filters/i)).toBeInTheDocument();
  });

  it('paginates a section and goes back to page 1 when the status changes', async () => {
    const user = userEvent.setup();
    const concepts = Array.from({ length: 3 }, (_, i) => mockConcept({ _id: `c${i}`, englishGloss: `word ${i}`, status: 'rejected' }));
    mockSubmissionsApi(api, { concepts, conceptsMeta: { total: 12 } });
    renderMySubmissions();
    await openSection(user, 'Concepts');

    await screen.findByText('word 0');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(callsTo(api, '/api/concepts/my-submissions').at(-1)[1].params).toEqual(expect.objectContaining({ page: 2, limit: 5 })));
    expect(await screen.findByText(/page 2 of 3/i)).toBeInTheDocument();

    await user.click(within(screen.getByRole('group', { name: 'Filter by status' })).getByRole('button', { name: /^Rejected/ }));
    await waitFor(() => expect(callsTo(api, '/api/concepts/my-submissions').at(-1)[1].params).toEqual(expect.objectContaining({ status: 'rejected', page: 1 })));
  });

  it('variants: the status filter and the needs-completion chip do not combine', async () => {
    const user = userEvent.setup();
    const variants = [mockVariant({ status: 'published' }), mockVariant({ _id: 'v2', status: 'rejected' })];
    mockSubmissionsApi(api, { variants, variantsMeta: { needsCompletionCount: 1 } });
    renderMySubmissions();
    await openSection(user, 'Variants');

    await user.click(await screen.findByRole('button', { name: 'Rejected (1)' }));
    await waitFor(() => expect(callsTo(api, '/api/variants/my-submissions').at(-1)[1].params).toEqual({ limit: 5, status: 'rejected' }));

    await user.click(screen.getByRole('button', { name: 'Needs completion (1)' }));
    await waitFor(() => expect(callsTo(api, '/api/variants/my-submissions').at(-1)[1].params).toEqual({ limit: 5, needs: 'completion' }));
    expect(screen.getByRole('button', { name: 'All (2)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All (2)' })).toBeDisabled();
  });

  it('variants: searches my words', async () => {
    const user = userEvent.setup();
    mockSubmissionsApi(api, { variants: [mockVariant()] });
    renderMySubmissions();
    await openSection(user, 'Variants');
    await user.type(await screen.findByRole('searchbox', { name: 'Search my words' }), 'sun');
    await waitFor(() => expect(callsTo(api, '/api/variants/my-submissions').at(-1)[1].params).toEqual({ limit: 5, q: 'sun' }));
  });

  it('recordings: filters by status and by type, and shows an empty message', async () => {
    const user = userEvent.setup();
    mockSubmissionsApi(api, { summary: emptySummary({ audio: { ...countsFor([]), pending: 1, withdrawn: 2, total: 3 } }) });
    renderMySubmissions();
    await openSection(user, 'Recordings');

    expect(await screen.findByText(/you have not recorded anything yet/i)).toBeInTheDocument();
    expect(getMyAudio).toHaveBeenLastCalledWith({ page: 1, limit: 5 });

    await user.click(screen.getByRole('button', { name: 'Withdrawn (2)' }));
    await waitFor(() => expect(getMyAudio).toHaveBeenLastCalledWith({ status: 'withdrawn', page: 1, limit: 5 }));
    await user.selectOptions(screen.getByLabelText('Filter by recording type'), 'form');
    await waitFor(() => expect(getMyAudio).toHaveBeenLastCalledWith({ status: 'withdrawn', slot: 'form', page: 1, limit: 5 }));
    expect(await screen.findByText(/no recordings match these filters/i)).toBeInTheDocument();
  });

  it('suggestions: filters by status', async () => {
    const user = userEvent.setup();
    mockSubmissionsApi(api, { summary: emptySummary({ suggestions: countsFor([{ status: 'rejected' }, { status: 'pending' }]) }) });
    renderMySubmissions();
    await openSection(user, 'Forms you suggested');
    await waitFor(() => expect(getMySuggestions).toHaveBeenLastCalledWith({ scope: 'others', page: 1, limit: 5 }));
    await user.click(await screen.findByRole('button', { name: 'Rejected (1)' }));
    await waitFor(() => expect(getMySuggestions).toHaveBeenLastCalledWith({ scope: 'others', status: 'rejected', page: 1, limit: 5 }));
  });
});

describe('MySubmissions page — summary strip', () => {
  it('totals each status across all kinds of submission', async () => {
    mockSubmissionsApi(api, {
      summary: {
        concepts: countsFor([{ status: 'rejected' }, { status: 'published' }]),
        variants: countsFor([{ status: 'rejected' }, { status: 'pending' }]),
        audio: { ...countsFor([{ status: 'published' }]), withdrawn: 1, total: 2 },
        suggestions: countsFor([{ status: 'rejected' }]),
      },
    });
    renderMySubmissions();
    expect(await screen.findByRole('button', { name: 'Rejected: 3' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Published: 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pending: 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approved: 0' })).toBeDisabled();
  });

  it('picking a status opens the sections that have it, filtered to it', async () => {
    const user = userEvent.setup();
    mockSubmissionsApi(api, {
      concepts: [mockConcept({ status: 'rejected' })],
      variants: [mockVariant({ status: 'pending' })],
    });
    renderMySubmissions();
    await user.click(await screen.findByRole('button', { name: 'Rejected: 1' }));

    expect(screen.getByRole('button', { name: /^concepts/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /^variants/i })).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(callsTo(api, '/api/concepts/my-submissions').at(-1)[1].params).toEqual(expect.objectContaining({ status: 'rejected' })));
    expect(callsTo(api, '/api/variants/my-submissions')).toHaveLength(0);
  });
});
