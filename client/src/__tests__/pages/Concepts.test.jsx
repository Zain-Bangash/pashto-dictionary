import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LookupsWrapper } from '../helpers/lookups';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, beforeEach } from 'vitest';
import Concepts from '../../pages/Concepts';
import api from '../../services/api';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn() },
}));

const renderConcepts = (initialEntries = ['/entries']) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/entries" element={<Concepts />} />
      </Routes>
    </MemoryRouter>
  );

const mockMeta = { page: 1, limit: 20, total: 0 };
const mockMetaWithEntries = { page: 1, limit: 20, total: 2 };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Concepts page', () => {
  test('shows loading state while fetching', () => {
    api.get.mockReturnValueOnce(new Promise(() => {}));
    renderConcepts();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  test('shows error state when API call fails', async () => {
    api.get.mockRejectedValueOnce(new Error('Network error'));
    renderConcepts();
    expect(await screen.findByText('Failed to load concepts.')).toBeInTheDocument();
  });

  test('shows "No entries found" when data is empty', async () => {
    api.get.mockResolvedValueOnce({ data: { data: [], meta: mockMeta } });
    renderConcepts();
    expect(await screen.findByText('No concepts found.')).toBeInTheDocument();
  });

  test('renders concept cards when data loads', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        data: [
          { _id: '1', englishGloss: 'house', partOfSpeech: 'noun', variantCount: 2 },
          { _id: '2', englishGloss: 'water', partOfSpeech: 'noun', variantCount: 1 },
        ],
        meta: mockMetaWithEntries,
      },
    });
    renderConcepts();
    expect(await screen.findByText('house')).toBeInTheDocument();
    expect(screen.getByText('water')).toBeInTheDocument();
  });

  test('uses /api/concepts/search endpoint when ?q= param is present', async () => {
    api.get.mockResolvedValueOnce({ data: { data: [], meta: mockMeta } });
    renderConcepts(['/entries?q=house']);
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/api/concepts/search'));
      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('q=house'));
    });
  });

  test('uses /api/concepts endpoint (not /search) when no ?q= param', async () => {
    api.get.mockResolvedValueOnce({ data: { data: [], meta: mockMeta } });
    renderConcepts(['/entries']);
    await waitFor(() => {
      const calledUrl = api.get.mock.calls[0][0];
      expect(calledUrl).toContain('/api/concepts');
      expect(calledUrl).not.toContain('/search');
    });
  });

  test('renders variantCount from concept data', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        data: [{ _id: '1', englishGloss: 'river', partOfSpeech: 'noun', variantCount: 3 }],
        meta: { page: 1, limit: 20, total: 1 },
      },
    });
    renderConcepts();
    expect(await screen.findByText('3 regional variants')).toBeInTheDocument();
  });

  test('renders Pagination when data loads with entries', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        data: [{ _id: '1', englishGloss: 'house', partOfSpeech: 'noun', variantCount: 0 }],
        meta: { page: 1, limit: 20, total: 45 },
      },
    });
    renderConcepts();
    expect(await screen.findByText(/Page 1 of/)).toBeInTheDocument();
  });

  test('does not render Pagination when data is empty', async () => {
    api.get.mockResolvedValueOnce({ data: { data: [], meta: mockMeta } });
    renderConcepts();
    await screen.findByText('No concepts found.');
    expect(screen.queryByRole('button', { name: /previous/i })).not.toBeInTheDocument();
  });
});

const renderAt = (path) => render(
  <LookupsWrapper>
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/concepts" element={<Concepts />} />
      </Routes>
    </MemoryRouter>
  </LookupsWrapper>
);

describe('Concepts page — region filter and browse cards', () => {
  const page = (data = [], total = data.length) => ({ data: { data, meta: { page: 1, limit: 20, total } } });

  test('a region pill filters the list and clicking it again clears it', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(page());
    renderAt('/concepts?q=sun');
    await screen.findByText('No concepts found.');

    await user.click(screen.getByRole('button', { name: 'Hangu' }));
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith(expect.stringContaining('region=Hangu')));
    expect(api.get.mock.lastCall[0]).toContain('q=sun');
    expect(screen.getByRole('button', { name: 'Hangu' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Hangu' }));
    await waitFor(() => expect(api.get.mock.lastCall[0]).not.toContain('region='));
  });

  test('shows how many concepts match, with the region, and can clear the filters', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(page([{ _id: '1', englishGloss: 'sun', variantCount: 1 }], 1));
    renderAt('/concepts?region=Kohat');
    expect(await screen.findByText('1 concept in Kohat')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(api.get.mock.lastCall[0]).not.toContain('region='));
  });

  test('cards show the Pashto word, its example right-to-left and a Listen button when there is a recording', async () => {
    api.get.mockResolvedValue(page([
      { _id: '1', englishGloss: 'sun', variantCount: 2, firstVariant: { _id: 'v1', pashto: 'لمر', example: 'لمر راختلی دی', audio: { url: 'https://storage.test/a.webm', mimeType: '' } } },
      { _id: '2', englishGloss: 'moon', variantCount: 1, firstVariant: { _id: 'v2', pashto: 'سپوږمۍ', audio: null } },
    ], 2));
    renderAt('/concepts');
    expect(await screen.findByText('لمر')).toBeInTheDocument();
    expect(screen.getByText('لمر راختلی دی')).toHaveAttribute('dir', 'rtl');
    expect(screen.getByRole('button', { name: 'Listen to لمر' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Listen to سپوږمۍ' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'sun' })).toHaveAttribute('href', '/concepts/1');
  });

  test('cards put the gloss above the Pashto word and note other words', async () => {
    api.get.mockResolvedValue(page([
      { _id: '1', englishGloss: 'sun', variantCount: 3, moreWordCount: 2, firstVariant: { _id: 'v1', pashto: 'لمر' } },
      { _id: '2', englishGloss: 'moon', variantCount: 2, moreWordCount: 0, firstVariant: { _id: 'v2', pashto: 'سپوږمۍ' } },
    ], 2));
    renderAt('/concepts');
    const pashto = await screen.findByText('لمر');
    const gloss = screen.getByRole('link', { name: 'sun' });
    expect(gloss.compareDocumentPosition(pashto) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('+ 2 more words')).toBeInTheDocument();
    expect(screen.getAllByText(/more word/)).toHaveLength(1);
    expect(screen.getByText('3 regional variants')).toBeInTheDocument();
  });

  test('hides pagination when everything fits on one page', async () => {
    api.get.mockResolvedValue(page([{ _id: '1', englishGloss: 'sun' }], 1));
    renderAt('/concepts');
    await screen.findByText('sun');
    expect(screen.queryByRole('button', { name: /previous/i })).not.toBeInTheDocument();
  });
});
