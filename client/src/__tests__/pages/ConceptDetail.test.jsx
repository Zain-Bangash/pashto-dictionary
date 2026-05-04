import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, beforeEach } from 'vitest';
import ConceptDetail from '../../pages/ConceptDetail';
import api from '../../services/api';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn() },
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

const renderDetail = (id = 'abc123') =>
  render(
    <MemoryRouter initialEntries={[`/concepts/${id}`]}>
      <Routes>
        <Route path="/concepts/:id" element={<ConceptDetail />} />
      </Routes>
    </MemoryRouter>
  );

const fullConcept = {
  _id: 'abc123',
  englishGloss: 'house',
  partOfSpeech: 'noun',
  status: 'published',
  variants: [
    {
      _id: 'v1',
      pashto: 'کور',
      phonetic: 'kor',
      region: 'Kohat',
      definition: 'a dwelling place',
      example: 'دا کور دی',
    },
    {
      _id: 'v2',
      pashto: 'کور',
      phonetic: null,
      region: 'Hangu',
      definition: 'home',
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ConceptDetail page', () => {
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

  test('shows 404 message when concept is not found', async () => {
    api.get.mockRejectedValueOnce({ response: { status: 404 } });
    renderDetail();
    expect(await screen.findByText('Entry not found.')).toBeInTheDocument();
  });

  test('renders concept englishGloss as heading', async () => {
    api.get.mockResolvedValueOnce({ data: { data: fullConcept } });
    renderDetail();
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('house');
  });

  test('renders partOfSpeech badge', async () => {
    api.get.mockResolvedValueOnce({ data: { data: fullConcept } });
    renderDetail();
    expect(await screen.findByText('noun')).toBeInTheDocument();
  });

  test('renders all variants pashto words', async () => {
    api.get.mockResolvedValueOnce({ data: { data: fullConcept } });
    renderDetail();
    const pashtoEls = await screen.findAllByText('کور');
    expect(pashtoEls.length).toBeGreaterThanOrEqual(1);
  });

  test('renders variant region badge', async () => {
    api.get.mockResolvedValueOnce({ data: { data: fullConcept } });
    renderDetail();
    expect(await screen.findByText('Kohat')).toBeInTheDocument();
    expect(await screen.findByText('Hangu')).toBeInTheDocument();
  });

  test('renders variant phonetic when present', async () => {
    api.get.mockResolvedValueOnce({ data: { data: fullConcept } });
    renderDetail();
    expect(await screen.findByText('kor')).toBeInTheDocument();
  });

  test('renders variant definition', async () => {
    api.get.mockResolvedValueOnce({ data: { data: fullConcept } });
    renderDetail();
    expect(await screen.findByText('a dwelling place')).toBeInTheDocument();
    expect(await screen.findByText('← Back to concepts')).toBeInTheDocument();
  });

  test('renders variant example when present', async () => {
    api.get.mockResolvedValueOnce({ data: { data: fullConcept } });
    renderDetail();
    expect(await screen.findByText('دا کور دی')).toBeInTheDocument();
  });

  test('handles concept with no variants without crashing', async () => {
    const minimalConcept = { _id: 'xyz', englishGloss: 'sky', partOfSpeech: 'noun', variants: [] };
    api.get.mockResolvedValueOnce({ data: { data: minimalConcept } });
    renderDetail('xyz');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('sky');
    expect(screen.getByText(/no published variants/i)).toBeInTheDocument();
  });

  test('contains a back link to /entries', async () => {
    api.get.mockResolvedValueOnce({ data: { data: fullConcept } });
    renderDetail();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('link', { name: /back to concepts/i })).toHaveAttribute('href', '/concepts');
  });

  test('calls /api/concepts/:id endpoint', async () => {
    api.get.mockResolvedValueOnce({ data: { data: fullConcept } });
    renderDetail('abc123');
    expect(api.get).toHaveBeenCalledWith('/api/concepts/abc123');
  });
});
