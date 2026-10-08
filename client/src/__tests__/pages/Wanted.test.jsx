import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import Wanted from '../../pages/Wanted';
import Submit from '../../pages/Submit';
import Login from '../../pages/Login';
import api, { getWanted } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { LookupsWrapper } from '../helpers/lookups';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  getWanted: vi.fn(),
  suggestConcepts: vi.fn(),
  createConcept: vi.fn(),
  createVariant: vi.fn(),
  checkCrossConceptPashto: vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));

let location;
function LocationCapture() {
  location = useLocation();
  return null;
}

function renderAt(url, element, path) {
  return render(
    <LookupsWrapper>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path={path} element={<>{element}<LocationCapture /></>} />
          <Route path="*" element={<LocationCapture />} />
        </Routes>
      </MemoryRouter>
    </LookupsWrapper>
  );
}

const page = (data, meta = {}) => ({ data: { success: true, data, meta: { page: 1, limit: 20, total: data.length, ...meta } } });
const sun = { _id: 'c1', englishGloss: 'Sun', partOfSpeech: 'noun' };

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({ user: null });
});

describe('Wanted Words page', () => {
  it('defaults to the first active region and lists wanted concepts', async () => {
    getWanted.mockResolvedValue(page([sun]));
    renderAt('/wanted', <Wanted />, '/wanted');
    expect(await screen.findByText('Sun')).toBeInTheDocument();
    expect(getWanted).toHaveBeenCalledWith({ region: 'Kohat', page: 1 });
    expect(screen.getByRole('button', { name: 'Kohat' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('1 wanted in Kohat')).toBeInTheDocument();
  });

  it("defaults to the user's own region", async () => {
    useAuth.mockReturnValue({ user: { region: 'Tirah' } });
    getWanted.mockResolvedValue(page([]));
    renderAt('/wanted', <Wanted />, '/wanted');
    await waitFor(() => expect(getWanted).toHaveBeenCalledWith({ region: 'Tirah', page: 1 }));
  });

  it('keeps the selected region and search in the URL', async () => {
    const user = userEvent.setup();
    getWanted.mockResolvedValue(page([sun]));
    renderAt('/wanted', <Wanted />, '/wanted');
    await screen.findByText('Sun');

    await user.click(screen.getByRole('button', { name: 'Hangu' }));
    await waitFor(() => expect(location.search).toBe('?region=Hangu'));
    expect(getWanted).toHaveBeenLastCalledWith({ region: 'Hangu', page: 1 });

    await user.type(screen.getByPlaceholderText(/search english/i), 'sun{enter}');
    await waitFor(() => expect(getWanted).toHaveBeenLastCalledWith({ region: 'Hangu', page: 1, q: 'sun' }));
    expect(location.search).toBe('?region=Hangu&q=sun');
  });

  it('links each row to Submit with the concept and region', async () => {
    getWanted.mockResolvedValue(page([sun]));
    renderAt('/wanted?region=Thal', <Wanted />, '/wanted');
    const link = await screen.findByRole('link', { name: 'Add your Thal word' });
    expect(link).toHaveAttribute('href', '/submit?conceptId=c1&region=Thal');
  });

  it('pages through results using meta.total', async () => {
    const user = userEvent.setup();
    getWanted.mockResolvedValue(page([sun], { total: 45 }));
    renderAt('/wanted?region=Kohat', <Wanted />, '/wanted');
    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(getWanted).toHaveBeenLastCalledWith({ region: 'Kohat', page: 2 }));
  });

  it('shows empty and error states', async () => {
    getWanted.mockResolvedValueOnce(page([]));
    const { unmount } = renderAt('/wanted?region=Kohat', <Wanted />, '/wanted');
    expect(await screen.findByText(/nothing wanted for kohat/i)).toBeInTheDocument();
    unmount();

    getWanted.mockRejectedValueOnce(new Error('down'));
    renderAt('/wanted?region=Kohat', <Wanted />, '/wanted');
    expect(await screen.findByText(/failed to load wanted words/i)).toBeInTheDocument();
  });
});

describe('Wanted → Submit flow', () => {
  it('Submit opens at Step 2 with the concept and region prefilled', async () => {
    api.get.mockResolvedValue({ data: { data: { _id: 'c1', englishGloss: 'Sun', partOfSpeech: 'noun' } } });
    renderAt('/submit?conceptId=c1&region=Hangu', <Submit />, '/submit');
    expect(await screen.findByLabelText(/pashto word/i)).toBeInTheDocument();
    expect(screen.getByText('Sun')).toBeInTheDocument();
    expect(screen.getByLabelText(/^region/i)).toHaveValue('Hangu');
    expect(api.get).toHaveBeenCalledWith('/api/concepts/c1');
  });

  it('after login a guest returns to the Submit URL including its query string', async () => {
    const user = userEvent.setup();
    const login = vi.fn().mockResolvedValue({});
    useAuth.mockReturnValue({ user: null, login });
    render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: { pathname: '/submit', search: '?conceptId=c1&region=Thal' } } }]}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<LocationCapture />} />
        </Routes>
      </MemoryRouter>
    );
    await user.type(screen.getByLabelText(/email/i), 'a@b.co');
    await user.type(screen.getByLabelText(/password/i), 'secret');
    await user.click(screen.getByRole('button', { name: /log ?in|sign ?in/i }));
    await waitFor(() => expect(location.pathname).toBe('/submit'));
    expect(location.search).toBe('?conceptId=c1&region=Thal');
  });
});
