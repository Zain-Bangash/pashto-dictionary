import { render, screen, waitFor } from '@testing-library/react';
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
        meta: { page: 1, limit: 20, total: 1 },
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
