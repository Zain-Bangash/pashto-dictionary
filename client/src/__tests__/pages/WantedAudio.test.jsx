import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import WantedAudio from '../../pages/WantedAudio';
import { getWantedAudio } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { LookupsWrapper } from '../helpers/lookups';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn() },
  getWantedAudio: vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));

let location;
function LocationCapture() {
  location = useLocation();
  return null;
}

function renderAt(url) {
  return render(
    <LookupsWrapper>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/wanted/audio" element={<><WantedAudio /><LocationCapture /></>} />
          <Route path="*" element={<LocationCapture />} />
        </Routes>
      </MemoryRouter>
    </LookupsWrapper>
  );
}

const page = (data, meta = {}) => ({ data: { success: true, data, meta: { page: 1, limit: 20, total: data.length, ...meta } } });
const sun = {
  _id: 'c1', englishGloss: 'Sun', partOfSpeech: 'noun',
  words: [
    { variantId: 'v1', pashto: 'لمر', phonetic: 'lmar', example: 'لمر راختلی دی', missing: ['headword', 'example'] },
    { variantId: 'v2', pashto: 'نمر', phonetic: '', example: '', missing: ['headword'] },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({ user: { id: 'u1', region: 'Tirah' } });
});

describe('Wanted Audio page', () => {
  it("defaults to the user's region and lists concepts needing recordings", async () => {
    getWantedAudio.mockResolvedValue(page([sun]));
    renderAt('/wanted/audio');
    expect(await screen.findByText('Sun')).toBeInTheDocument();
    expect(getWantedAudio).toHaveBeenCalledWith({ region: 'Tirah', page: 1 });
    expect(screen.getByText('1 concept need recordings in Tirah')).toBeInTheDocument();
    expect(screen.getByText(/2 words to record/)).toBeInTheDocument();
  });

  it('opens a concept to its words with chips linking to the recorder on that slot', async () => {
    const user = userEvent.setup();
    getWantedAudio.mockResolvedValue(page([sun]));
    renderAt('/wanted/audio?region=Kohat');
    const toggle = await screen.findByRole('button', { name: /sun/i });
    expect(screen.queryByText('لمر')).not.toBeInTheDocument();
    await user.click(toggle);

    const first = screen.getByText('لمر').closest('li');
    expect(within(first).getByText('لمر راختلی دی')).toBeInTheDocument();
    expect(within(first).getByRole('link', { name: '+ Word' })).toHaveAttribute('href', '/concepts/c1?record=v1&slot=headword');
    expect(within(first).getByRole('link', { name: '+ Example' })).toHaveAttribute('href', '/concepts/c1?record=v1&slot=example');
    const second = screen.getByText('نمر').closest('li');
    expect(within(second).queryByRole('link', { name: '+ Example' })).not.toBeInTheDocument();
  });

  it('sends a guest to log in, then back to the recorder', async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue({ user: null });
    getWantedAudio.mockResolvedValue(page([sun]));
    renderAt('/wanted/audio?region=Kohat');
    await user.click(await screen.findByRole('button', { name: /sun/i }));
    await user.click(screen.getAllByRole('link', { name: '+ Example' })[0]);
    expect(location.pathname).toBe('/login');
    expect(location.state.from).toEqual({ pathname: '/concepts/c1', search: '?record=v1&slot=example' });
  });

  it('filters by what is missing, keeping it in the URL and returning to page 1', async () => {
    const user = userEvent.setup();
    getWantedAudio.mockResolvedValue(page([sun], { total: 45 }));
    renderAt('/wanted/audio?region=Kohat&page=2');
    await screen.findByText('Sun');
    const group = screen.getByRole('group', { name: 'Missing recording' });
    expect(within(group).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(within(group).getByRole('button', { name: 'Example' }));
    await waitFor(() => expect(location.search).toBe('?region=Kohat&slot=example'));
    expect(getWantedAudio).toHaveBeenLastCalledWith({ region: 'Kohat', page: 1, slot: 'example' });
  });

  it('switches region and searches, and pages through results', async () => {
    const user = userEvent.setup();
    getWantedAudio.mockResolvedValue(page([sun], { total: 45 }));
    renderAt('/wanted/audio?region=Kohat');
    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(getWantedAudio).toHaveBeenLastCalledWith({ region: 'Kohat', page: 2 }));

    await user.click(screen.getByRole('button', { name: 'Hangu' }));
    await waitFor(() => expect(location.search).toBe('?region=Hangu'));
    await user.type(screen.getByPlaceholderText(/search english, pashto/i), 'لمر{enter}');
    await waitFor(() => expect(getWantedAudio).toHaveBeenLastCalledWith({ region: 'Hangu', page: 1, q: 'لمر' }));
  });

  it('marks the Audio tab current and links back to Words with the region', async () => {
    getWantedAudio.mockResolvedValue(page([sun]));
    renderAt('/wanted/audio?region=Thal&slot=example');
    await screen.findByText('Sun');
    const tabs = screen.getByRole('navigation', { name: 'Wanted' });
    expect(within(tabs).getByRole('link', { name: 'Audio' })).toHaveAttribute('aria-current', 'page');
    expect(within(tabs).getByRole('link', { name: 'Words' })).toHaveAttribute('href', '/wanted?region=Thal');
  });

  it('shows empty and error states', async () => {
    getWantedAudio.mockResolvedValueOnce(page([]));
    const { unmount } = renderAt('/wanted/audio?region=Kohat');
    expect(await screen.findByText(/no recordings wanted for kohat/i)).toBeInTheDocument();
    unmount();

    getWantedAudio.mockRejectedValueOnce(new Error('down'));
    renderAt('/wanted/audio?region=Kohat');
    expect(await screen.findByRole('alert')).toHaveTextContent(/failed to load wanted recordings/i);
  });
});
