import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, beforeEach } from 'vitest';
import ConceptDetail from '../../pages/ConceptDetail';
import api from '../../services/api';
import { FieldsWrapper } from '../helpers/fields';

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

describe('ConceptDetail — extra field values', () => {
  it('shows concept and variant extra values for active fields only', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          ...fullConcept,
          extra: { etymology: 'Old Iranian' },
          variants: [{ ...fullConcept.variants[0], extra: { plural: 'کورونه', ghost: 'hidden' } }],
        },
      },
    });
    render(
      <FieldsWrapper>
        <MemoryRouter initialEntries={['/concepts/abc123']}>
          <Routes>
            <Route path="/concepts/:id" element={<ConceptDetail />} />
          </Routes>
        </MemoryRouter>
      </FieldsWrapper>
    );
    expect(await screen.findByText('Old Iranian')).toBeInTheDocument();
    expect(screen.getByText('کورونه')).toBeInTheDocument();
    expect(screen.queryByText('hidden')).not.toBeInTheDocument();
  });
});

describe('ConceptDetail — layout and word card actions', () => {
  const renderWithLogin = () => render(
    <MemoryRouter initialEntries={['/concepts/abc123']}>
      <Routes>
        <Route path="/concepts/:id" element={<ConceptDetail />} />
        <Route path="/login" element={<p>Login page</p>} />
      </Routes>
    </MemoryRouter>
  );

  test('the concept panel sums up its words and regions', async () => {
    api.get.mockResolvedValueOnce({ data: { data: fullConcept } });
    renderDetail();
    expect(await screen.findByText('2 words · 2 regions')).toBeInTheDocument();
  });

  test('the example sentence is Pashto, shown right-to-left', async () => {
    api.get.mockResolvedValueOnce({ data: { data: fullConcept } });
    renderDetail();
    expect(await screen.findByText('دا کور دی')).toHaveAttribute('dir', 'rtl');
  });

  test('the action rail offers "I also say this" and "Suggest forms"; record only when the word has slots', async () => {
    api.get.mockResolvedValueOnce({ data: { data: fullConcept } });
    renderDetail();
    expect(await screen.findByRole('button', { name: '+ I also say this' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Suggest forms' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /record a pronunciation/i })).not.toBeInTheDocument();
  });

  test('a guest who tries to record is sent to log in', async () => {
    const user = userEvent.setup();
    const withSlots = {
      ...fullConcept,
      variants: fullConcept.variants.map((v) => ({ ...v, audioSlots: [{ slot: 'headword', text: v.pashto, maxSeconds: 3 }] })),
    };
    api.get.mockResolvedValueOnce({ data: { data: withSlots } });
    renderWithLogin();
    await user.click(await screen.findByRole('button', { name: /record a pronunciation/i }));
    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });
});
