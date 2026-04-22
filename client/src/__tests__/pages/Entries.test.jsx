import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, beforeEach } from 'vitest';
import Entries from '../../pages/Entries';
import api from '../../services/api';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn() },
}));

const renderEntries = (initialEntries = ['/entries']) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/entries" element={<Entries />} />
      </Routes>
    </MemoryRouter>
  );

const mockMeta = { page: 1, limit: 20, total: 0 };
const mockMetaWithEntries = { page: 1, limit: 20, total: 2 };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Entries page', () => {
  test('shows loading state while fetching', () => {
    api.get.mockReturnValueOnce(new Promise(() => {}));
    renderEntries();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  test('shows error state when API call fails', async () => {
    api.get.mockRejectedValueOnce(new Error('Network error'));
    renderEntries();
    expect(await screen.findByText('Failed to load entries.')).toBeInTheDocument();
  });

  test('shows "No entries found" when data is empty', async () => {
    api.get.mockResolvedValueOnce({ data: { data: [], meta: mockMeta } });
    renderEntries();
    expect(await screen.findByText('No entries found.')).toBeInTheDocument();
  });

  test('renders EntryCards when data loads', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        data: [
          { _id: '1', pashto: 'کور', definitions: [{ text: 'house' }] },
          { _id: '2', pashto: 'اوبه', definitions: [{ text: 'water' }] },
        ],
        meta: mockMetaWithEntries,
      },
    });
    renderEntries();
    expect(await screen.findByText('کور')).toBeInTheDocument();
    expect(screen.getByText('اوبه')).toBeInTheDocument();
  });

  test('uses search endpoint when ?q= param is present', async () => {
    api.get.mockResolvedValueOnce({ data: { data: [], meta: mockMeta } });
    renderEntries(['/entries?q=house']);
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/api/entries/search?q='));
    });
  });

  test('uses list endpoint when no ?q= param', async () => {
    api.get.mockResolvedValueOnce({ data: { data: [], meta: mockMeta } });
    renderEntries(['/entries']);
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/api/entries?page='));
    });
  });

  test('renders Pagination when data loads with entries', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        data: [{ _id: '1', pashto: 'کور', definitions: [{ text: 'house' }] }],
        meta: { page: 1, limit: 20, total: 1 },
      },
    });
    renderEntries();
    expect(await screen.findByText(/Page 1 of/)).toBeInTheDocument();
  });

  test('does not render Pagination when data is empty', async () => {
    api.get.mockResolvedValueOnce({ data: { data: [], meta: mockMeta } });
    renderEntries();
    await screen.findByText('No entries found.');
    expect(screen.queryByRole('button', { name: /previous/i })).not.toBeInTheDocument();
  });
});
