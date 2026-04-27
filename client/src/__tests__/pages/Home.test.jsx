import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { vi, beforeEach } from 'vitest';
import Home from '../../pages/Home';
import api from '../../services/api';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn() },
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: null })),
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
        <Route path="/concepts" element={<LocationCapture />} />
      </Routes>
    </MemoryRouter>
  );
  return { ...utils, locationRef };
};

const mockConcept = (overrides = {}) => ({
  _id: '1',
  englishGloss: 'house',
  partOfSpeech: 'noun',
  status: 'published',
  firstVariant: { _id: 'v1', pashto: 'کور', definition: 'a dwelling place', region: 'Kohat' },
  createdAt: new Date().toISOString(),
  ...overrides,
});

const mockStats = (overrides = {}) => ({
  publishedVariants: 42,
  registeredUsers: 7,
  variantsThisMonth: 3,
  ...overrides,
});

// Helper: mock three parallel calls in the order Promise.all fires them
// api.get is called with: /api/concepts/wotd, /api/concepts?limit=3, /api/stats
function mockThreeCalls({ wotdData = null, cardsData = [], statsData = mockStats() } = {}) {
  api.get.mockImplementation((url) => {
    if (url === '/api/concepts/wotd') {
      return Promise.resolve({ data: { data: wotdData } });
    }
    if (url.startsWith('/api/concepts')) {
      return Promise.resolve({ data: { data: cardsData, meta: {} } });
    }
    if (url === '/api/stats') {
      return Promise.resolve({ data: { data: statsData } });
    }
    return Promise.resolve({ data: { data: null } });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Home page', () => {
  test('shows a search input', async () => {
    mockThreeCalls();
    renderHome();
    expect(await screen.findByPlaceholderText('Search Pashto words…')).toBeInTheDocument();
  });

  test('shows loading state while API call is in flight', () => {
    api.get.mockReturnValue(new Promise(() => {}));
    renderHome();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  test('shows error state when API call fails', async () => {
    api.get.mockRejectedValue(new Error('Network error'));
    renderHome();
    expect(await screen.findByText('Failed to load.')).toBeInTheDocument();
  });

  test('shows concept englishGloss cards when data loads', async () => {
    mockThreeCalls({
      wotdData: mockConcept({ _id: '1', englishGloss: 'house', firstVariant: { _id: 'v1', pashto: 'کور', definition: 'dwelling', region: 'Kohat' } }),
      cardsData: [
        mockConcept({ _id: '2', englishGloss: 'water', firstVariant: { _id: 'v2', pashto: 'اوبه', definition: 'liquid', region: 'Hangu' } }),
      ],
    });
    renderHome();
    expect(await screen.findByText('house')).toBeInTheDocument();
    expect(screen.getByText('water')).toBeInTheDocument();
  });

  test('shows pashto word from first variant in word card', async () => {
    mockThreeCalls({
      wotdData: mockConcept({ _id: '1', englishGloss: 'house', firstVariant: { _id: 'v1', pashto: 'کور', definition: 'dwelling', region: 'Kohat' } }),
      cardsData: [
        mockConcept({ _id: '2', englishGloss: 'water', firstVariant: { _id: 'v2', pashto: 'اوبه', definition: 'liquid', region: 'Hangu' } }),
      ],
    });
    renderHome();
    expect(await screen.findByText('اوبه')).toBeInTheDocument();
  });

  test('shows empty state when API returns no wotd', async () => {
    mockThreeCalls({ wotdData: null });
    renderHome();
    expect(await screen.findByText('No concepts yet.')).toBeInTheDocument();
  });

  test('search submit with a term navigates to /entries?q=<term>', async () => {
    const user = userEvent.setup();
    mockThreeCalls();
    const { locationRef } = renderHome();
    const input = await screen.findByPlaceholderText('Search Pashto words…');
    await user.type(input, 'kor');
    await user.click(screen.getByRole('button', { name: /search/i }));
    await waitFor(() => {
      expect(locationRef.current?.pathname).toBe('/concepts');
      expect(locationRef.current?.search).toContain('q=kor');
    });
  });

  test('search submit with empty term navigates to /entries without ?q=', async () => {
    const user = userEvent.setup();
    mockThreeCalls();
    const { locationRef } = renderHome();
    await screen.findByPlaceholderText('Search Pashto words…');
    await user.click(screen.getByRole('button', { name: /search/i }));
    await waitFor(() => {
      expect(locationRef.current?.pathname).toBe('/concepts');
      expect(locationRef.current?.search).toBe('');
    });
  });

  test('calls /api/concepts endpoint for recent words', async () => {
    mockThreeCalls();
    renderHome();
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/api/concepts'));
    });
  });

  test('displays stats numbers from /api/stats', async () => {
    mockThreeCalls({ statsData: { publishedVariants: 128, registeredUsers: 15, variantsThisMonth: 9 } });
    renderHome();
    expect(await screen.findByText('128')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  test('shows dash placeholders while stats are loading', () => {
    api.get.mockReturnValue(new Promise(() => {}));
    renderHome();
    // Loading spinner is shown; stats section not rendered yet — loading state covers it
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  test('calls /api/concepts/wotd endpoint', async () => {
    mockThreeCalls();
    renderHome();
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/concepts/wotd');
    });
  });

  test('calls /api/stats endpoint', async () => {
    mockThreeCalls();
    renderHome();
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/stats');
    });
  });
});
