import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { vi, beforeEach } from 'vitest';
import Home from '../../pages/Home';
import api from '../../services/api';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn() },
}));

const renderHome = (initialEntries = ['/']) => {
  let locationRef = {};
  function LocationCapture() {
    locationRef.current = useLocation();
    return null;
  }
  const utils = render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/entries" element={<LocationCapture />} />
      </Routes>
    </MemoryRouter>
  );
  return { ...utils, locationRef };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Home page', () => {
  test('shows a search input', async () => {
    api.get.mockResolvedValueOnce({ data: { data: [], meta: {} } });
    renderHome();
    expect(await screen.findByPlaceholderText('Search Pashto words…')).toBeInTheDocument();
  });

  test('shows loading state while API call is in flight', () => {
    api.get.mockReturnValueOnce(new Promise(() => {}));
    renderHome();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  test('shows error state when API call fails', async () => {
    api.get.mockRejectedValueOnce(new Error('Network error'));
    renderHome();
    expect(await screen.findByText('Failed to load recent entries.')).toBeInTheDocument();
  });

  test('shows EntryCard components when data loads', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        data: [
          { _id: '1', pashto: 'کور', definitions: [{ text: 'house' }] },
          { _id: '2', pashto: 'اوبه', definitions: [{ text: 'water' }] },
        ],
        meta: {},
      },
    });
    renderHome();
    expect(await screen.findByText('کور')).toBeInTheDocument();
    expect(screen.getByText('اوبه')).toBeInTheDocument();
  });

  test('shows empty state when API returns empty array', async () => {
    api.get.mockResolvedValueOnce({ data: { data: [], meta: {} } });
    renderHome();
    expect(await screen.findByText('No entries yet.')).toBeInTheDocument();
  });

  test('search submit with a term navigates to /entries?q=<term>', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValueOnce({ data: { data: [], meta: {} } });
    const { locationRef } = renderHome();
    const input = await screen.findByPlaceholderText('Search Pashto words…');
    await user.type(input, 'kor');
    await user.click(screen.getByRole('button', { name: /search/i }));
    await waitFor(() => {
      expect(locationRef.current?.pathname).toBe('/entries');
      expect(locationRef.current?.search).toContain('q=kor');
    });
  });

  test('search submit with empty term navigates to /entries without ?q=', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValueOnce({ data: { data: [], meta: {} } });
    const { locationRef } = renderHome();
    await screen.findByPlaceholderText('Search Pashto words…');
    await user.click(screen.getByRole('button', { name: /search/i }));
    await waitFor(() => {
      expect(locationRef.current?.pathname).toBe('/entries');
      expect(locationRef.current?.search).toBe('');
    });
  });
});
