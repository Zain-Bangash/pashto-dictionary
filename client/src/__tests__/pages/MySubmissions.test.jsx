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

const mockEntry = (overrides = {}) => ({
  _id: 'entry1',
  pashto: 'کور',
  definitions: [{ text: 'house' }],
  partOfSpeech: 'noun',
  status: 'pending',
  createdAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MySubmissions page', () => {
  it('shows a loading state while fetching submissions', () => {
    api.get.mockReturnValueOnce(new Promise(() => {}));
    renderMySubmissions();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows an error state when the API call fails', async () => {
    api.get.mockRejectedValueOnce(new Error('Network error'));
    renderMySubmissions();
    expect(await screen.findByText(/failed to load/i)).toBeInTheDocument();
  });

  it('shows an empty state message when there are no submissions', async () => {
    api.get.mockResolvedValueOnce({ data: { success: true, data: [] } });
    renderMySubmissions();
    expect(await screen.findByText(/no submissions/i)).toBeInTheDocument();
  });

  it('renders the pashto word for each submission', async () => {
    api.get.mockResolvedValueOnce({
      data: { success: true, data: [mockEntry({ pashto: 'کور' }), mockEntry({ _id: 'entry2', pashto: 'اوبه' })] },
    });
    renderMySubmissions();
    expect(await screen.findByText('کور')).toBeInTheDocument();
    expect(screen.getByText('اوبه')).toBeInTheDocument();
  });

  it('renders a "pending" status badge for pending entries', async () => {
    api.get.mockResolvedValueOnce({
      data: { success: true, data: [mockEntry({ status: 'pending' })] },
    });
    renderMySubmissions();
    expect(await screen.findByText(/pending/i)).toBeInTheDocument();
  });

  it('renders an "approved" status badge for approved entries', async () => {
    api.get.mockResolvedValueOnce({
      data: { success: true, data: [mockEntry({ status: 'approved' })] },
    });
    renderMySubmissions();
    expect(await screen.findByText(/approved/i)).toBeInTheDocument();
  });

  it('renders a "rejected" status badge for rejected entries', async () => {
    api.get.mockResolvedValueOnce({
      data: { success: true, data: [mockEntry({ status: 'rejected', moderatorNote: 'Duplicate entry' })] },
    });
    renderMySubmissions();
    expect(await screen.findByText(/rejected/i)).toBeInTheDocument();
  });

  it('renders a "published" status badge for published entries', async () => {
    api.get.mockResolvedValueOnce({
      data: { success: true, data: [mockEntry({ status: 'published' })] },
    });
    renderMySubmissions();
    expect(await screen.findByText(/published/i)).toBeInTheDocument();
  });

  it('shows the moderator note when an entry is rejected', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: [mockEntry({ status: 'rejected', moderatorNote: 'Duplicate entry' })],
      },
    });
    renderMySubmissions();
    expect(await screen.findByText(/duplicate entry/i)).toBeInTheDocument();
  });

  it('calls the API endpoint scoped to the current user submissions', async () => {
    api.get.mockResolvedValueOnce({ data: { success: true, data: [] } });
    renderMySubmissions();
    await screen.findByText(/no submissions/i);
    expect(api.get).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/entries\/my-submissions|\/api\/entries\?submittedBy=/)
    );
  });

  it('has a link or button to submit a new entry', async () => {
    api.get.mockResolvedValueOnce({ data: { success: true, data: [] } });
    renderMySubmissions();
    await screen.findByText(/no submissions/i);
    expect(
      screen.getByRole('link', { name: /submit/i }) ||
      screen.getByRole('button', { name: /submit/i })
    ).toBeTruthy();
  });
});
