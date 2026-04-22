import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, beforeEach } from 'vitest';
import EntryDetail from '../../pages/EntryDetail';
import api from '../../services/api';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn() },
}));

const renderDetail = (id = 'abc123') =>
  render(
    <MemoryRouter initialEntries={[`/entries/${id}`]}>
      <Routes>
        <Route path="/entries/:id" element={<EntryDetail />} />
      </Routes>
    </MemoryRouter>
  );

const fullEntry = {
  _id: 'abc123',
  pashto: 'کور',
  phonetic: 'kor',
  partOfSpeech: 'noun',
  region: 'Kandahar',
  definitions: [
    { text: 'house', example: 'دا کور دی' },
    { text: 'home' },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EntryDetail page', () => {
  test('shows loading state while fetching', () => {
    api.get.mockReturnValueOnce(new Promise(() => {}));
    renderDetail();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  test('shows generic error state when fetch fails', async () => {
    api.get.mockRejectedValueOnce({ response: { status: 500 } });
    renderDetail();
    expect(await screen.findByText('Failed to load entry.')).toBeInTheDocument();
  });

  test('shows 404 message when entry is not found', async () => {
    api.get.mockRejectedValueOnce({ response: { status: 404 } });
    renderDetail();
    expect(await screen.findByText('Entry not found.')).toBeInTheDocument();
  });

  test('renders pashto word when loaded', async () => {
    api.get.mockResolvedValueOnce({ data: { data: fullEntry } });
    renderDetail();
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('کور');
  });

  test('renders all definitions', async () => {
    api.get.mockResolvedValueOnce({ data: { data: fullEntry } });
    renderDetail();
    expect(await screen.findByText('house')).toBeInTheDocument();
    expect(screen.getByText('home')).toBeInTheDocument();
  });

  test('renders definition example when present', async () => {
    api.get.mockResolvedValueOnce({ data: { data: fullEntry } });
    renderDetail();
    expect(await screen.findByText('دا کور دی')).toBeInTheDocument();
  });

  test('shows phonetic when present', async () => {
    api.get.mockResolvedValueOnce({ data: { data: fullEntry } });
    renderDetail();
    expect(await screen.findByText('kor')).toBeInTheDocument();
  });

  test('shows partOfSpeech when present', async () => {
    api.get.mockResolvedValueOnce({ data: { data: fullEntry } });
    renderDetail();
    expect(await screen.findByText('noun')).toBeInTheDocument();
  });

  test('shows region when present', async () => {
    api.get.mockResolvedValueOnce({ data: { data: fullEntry } });
    renderDetail();
    expect(await screen.findByText('Kandahar')).toBeInTheDocument();
  });

  test('handles missing optional fields without crashing', async () => {
    const minimalEntry = { _id: 'xyz', pashto: 'آب', definitions: [] };
    api.get.mockResolvedValueOnce({ data: { data: minimalEntry } });
    renderDetail('xyz');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('آب');
    expect(screen.queryByText('kor')).not.toBeInTheDocument();
  });

  test('contains a back link to /entries', async () => {
    api.get.mockResolvedValueOnce({ data: { data: fullEntry } });
    renderDetail();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('link', { name: /back to entries/i })).toHaveAttribute('href', '/entries');
  });
});
