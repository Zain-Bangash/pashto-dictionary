import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import MySubmissions from '../../pages/MySubmissions';
import api from '../../services/api';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { _id: '1', role: 'user' }, token: 'jwt-token' })),
}));

const renderMySubmissions = (initialEntries = ['/my-submissions']) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/my-submissions" element={<MySubmissions />} />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>
  );

const mockConcept = (overrides = {}) => ({
  _id: 'concept1',
  englishGloss: 'house',
  partOfSpeech: 'noun',
  status: 'pending',
  createdAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

const mockVariant = (overrides = {}) => ({
  _id: 'variant1',
  pashto: 'کور',
  definition: 'a dwelling place',
  region: 'Kohat',
  status: 'pending',
  createdAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

function mockBothEmpty() {
  api.get
    .mockResolvedValueOnce({ data: { success: true, data: [] } })
    .mockResolvedValueOnce({ data: { success: true, data: [] } });
}

function mockWithData(concepts = [], variants = []) {
  api.get
    .mockResolvedValueOnce({ data: { success: true, data: concepts } })
    .mockResolvedValueOnce({ data: { success: true, data: variants } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MySubmissions page', () => {
  it('shows a loading state while fetching submissions', () => {
    api.get.mockReturnValue(new Promise(() => {}));
    renderMySubmissions();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows an error state when the API call fails', async () => {
    api.get.mockRejectedValue(new Error('Network error'));
    renderMySubmissions();
    expect(await screen.findByText(/failed to load/i)).toBeInTheDocument();
  });

  it('shows an empty state message when there are no submissions', async () => {
    mockBothEmpty();
    renderMySubmissions();
    expect(await screen.findByText(/no submissions/i)).toBeInTheDocument();
  });

  it('renders the englishGloss for each submitted concept', async () => {
    mockWithData(
      [mockConcept({ englishGloss: 'house' }), mockConcept({ _id: 'concept2', englishGloss: 'water' })],
      []
    );
    renderMySubmissions();
    expect(await screen.findByText('house')).toBeInTheDocument();
    expect(screen.getByText('water')).toBeInTheDocument();
  });

  it('renders the pashto word for each submitted variant', async () => {
    mockWithData(
      [],
      [mockVariant({ pashto: 'کور' }), mockVariant({ _id: 'v2', pashto: 'اوبه' })]
    );
    renderMySubmissions();
    expect(await screen.findByText('کور')).toBeInTheDocument();
    expect(screen.getByText('اوبه')).toBeInTheDocument();
  });

  it('renders a "pending" status badge for pending items', async () => {
    mockWithData([mockConcept({ status: 'pending' })], []);
    renderMySubmissions();
    expect(await screen.findByText(/pending/i)).toBeInTheDocument();
  });

  it('renders an "approved" status badge for approved items', async () => {
    mockWithData([mockConcept({ status: 'approved' })], []);
    renderMySubmissions();
    expect(await screen.findByText(/approved/i)).toBeInTheDocument();
  });

  it('renders a "rejected" status badge for rejected items', async () => {
    mockWithData([mockConcept({ status: 'rejected', moderatorNote: 'Duplicate entry' })], []);
    renderMySubmissions();
    expect(await screen.findByText(/rejected/i)).toBeInTheDocument();
  });

  it('renders a "published" status badge for published items', async () => {
    mockWithData([mockConcept({ status: 'published' })], []);
    renderMySubmissions();
    expect(await screen.findByText(/published/i)).toBeInTheDocument();
  });

  it('shows the moderator note when a concept is rejected', async () => {
    mockWithData(
      [mockConcept({ status: 'rejected', moderatorNote: 'Duplicate entry' })],
      []
    );
    renderMySubmissions();
    expect(await screen.findByText(/duplicate entry/i)).toBeInTheDocument();
  });

  it('shows the moderator note when a variant is rejected', async () => {
    mockWithData(
      [],
      [mockVariant({ status: 'rejected', moderatorNote: 'Wrong spelling' })]
    );
    renderMySubmissions();
    expect(await screen.findByText(/wrong spelling/i)).toBeInTheDocument();
  });

  it('calls /api/concepts/my-submissions and /api/variants/my-submissions', async () => {
    mockBothEmpty();
    renderMySubmissions();
    await screen.findByText(/no submissions/i);
    expect(api.get).toHaveBeenCalledWith('/api/concepts/my-submissions');
    expect(api.get).toHaveBeenCalledWith('/api/variants/my-submissions');
  });

  it('has a link or button to submit a new entry', async () => {
    mockBothEmpty();
    renderMySubmissions();
    await screen.findByText(/no submissions/i);
    expect(
      screen.getByRole('link', { name: /submit/i }) ||
      screen.getByRole('button', { name: /submit/i })
    ).toBeTruthy();
  });
});
