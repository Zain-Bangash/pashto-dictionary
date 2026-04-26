import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import Submit from '../../pages/Submit';
import api from '../../services/api';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

// Authenticated by default for submission form tests.
// ProtectedRoute tests cover the unauthenticated redirect separately.
vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { _id: '1', role: 'user' }, token: 'jwt-token', login: vi.fn() })),
}));

const renderSubmit = (initialEntries = ['/submit']) => {
  let locationRef = {};
  function LocationCapture() {
    locationRef.current = useLocation();
    return null;
  }
  const utils = render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/submit" element={<Submit />} />
        <Route path="/my-submissions" element={<LocationCapture />} />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>
  );
  return { ...utils, locationRef };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Submit page (entry submission form)', () => {
  it('renders the pashto word input field', () => {
    renderSubmit();
    expect(screen.getByLabelText(/pashto word/i)).toBeInTheDocument();
  });

  it('renders a part of speech select field', () => {
    renderSubmit();
    expect(screen.getByLabelText(/part of speech/i)).toBeInTheDocument();
  });

  it('renders a definition text input', () => {
    renderSubmit();
    expect(screen.getByLabelText(/definition/i)).toBeInTheDocument();
  });

  it('renders optional phonetic and region fields', () => {
    renderSubmit();
    expect(screen.getByLabelText(/phonetic/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/region/i)).toBeInTheDocument();
  });

  it('renders all valid part of speech options in the select', () => {
    renderSubmit();
    const select = screen.getByLabelText(/part of speech/i);
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toEqual(
      expect.arrayContaining(['noun', 'verb', 'adjective', 'adverb', 'phrase', 'other'])
    );
  });

  it('renders all valid region options in the region select', () => {
    renderSubmit();
    const select = screen.getByLabelText(/region/i);
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toEqual(
      expect.arrayContaining(['Kohat', 'Hangu', 'Tirah', 'Thal', 'Parachinar'])
    );
  });

  it('includes region in the payload when a region is selected', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValueOnce({
      data: { success: true, data: { _id: 'entry1', pashto: 'کور', status: 'pending' } },
    });
    renderSubmit();
    await user.type(screen.getByLabelText(/pashto word/i), 'کور');
    await user.type(screen.getByLabelText(/definition/i), 'house');
    await user.selectOptions(screen.getByLabelText(/part of speech/i), 'noun');
    await user.selectOptions(screen.getByLabelText(/region/i), 'Kohat');
    await user.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/api/entries',
        expect.objectContaining({ region: 'Kohat' })
      );
    });
  });

  it('shows a validation error when pashto word is empty on submit', async () => {
    const user = userEvent.setup();
    renderSubmit();
    await user.click(screen.getByRole('button', { name: /submit/i }));
    expect(await screen.findByText(/pashto word is required/i)).toBeInTheDocument();
  });

  it('shows a validation error when definition is empty on submit', async () => {
    const user = userEvent.setup();
    renderSubmit();
    await user.type(screen.getByLabelText(/pashto word/i), 'کور');
    await user.click(screen.getByRole('button', { name: /submit/i }));
    expect(await screen.findByText(/definition is required/i)).toBeInTheDocument();
  });

  it('shows a validation error when part of speech is not selected', async () => {
    const user = userEvent.setup();
    renderSubmit();
    await user.type(screen.getByLabelText(/pashto word/i), 'کور');
    await user.type(screen.getByLabelText(/definition/i), 'house');
    // Leave POS as default empty/placeholder value
    const select = screen.getByLabelText(/part of speech/i);
    await user.selectOptions(select, '');
    await user.click(screen.getByRole('button', { name: /submit/i }));
    expect(await screen.findByText(/part of speech is required/i)).toBeInTheDocument();
  });

  it('calls api.post with correct payload on valid submit', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValueOnce({
      data: { success: true, data: { _id: 'entry1', pashto: 'کور', status: 'pending' } },
    });
    renderSubmit();
    await user.type(screen.getByLabelText(/pashto word/i), 'کور');
    await user.type(screen.getByLabelText(/definition/i), 'house');
    await user.selectOptions(screen.getByLabelText(/part of speech/i), 'noun');
    await user.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/api/entries',
        expect.objectContaining({
          pashto: 'کور',
          partOfSpeech: 'noun',
          definitions: expect.arrayContaining([
            expect.objectContaining({ text: 'house' }),
          ]),
        })
      );
    });
  });

  it('redirects to /my-submissions after successful submission', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValueOnce({
      data: { success: true, data: { _id: 'entry1', pashto: 'کور', status: 'pending' } },
    });
    const { locationRef } = renderSubmit();
    await user.type(screen.getByLabelText(/pashto word/i), 'کور');
    await user.type(screen.getByLabelText(/definition/i), 'house');
    await user.selectOptions(screen.getByLabelText(/part of speech/i), 'noun');
    await user.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => {
      expect(locationRef.current?.pathname).toBe('/my-submissions');
    });
  });

  it('shows an API error message when submission fails', async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValueOnce({
      response: { data: { success: false, error: { message: 'Submission failed' } } },
    });
    renderSubmit();
    await user.type(screen.getByLabelText(/pashto word/i), 'کور');
    await user.type(screen.getByLabelText(/definition/i), 'house');
    await user.selectOptions(screen.getByLabelText(/part of speech/i), 'noun');
    await user.click(screen.getByRole('button', { name: /submit/i }));
    expect(await screen.findByText(/submission failed/i)).toBeInTheDocument();
  });

  it('disables the submit button while the request is in flight', async () => {
    const user = userEvent.setup();
    api.post.mockReturnValueOnce(new Promise(() => {}));
    renderSubmit();
    await user.type(screen.getByLabelText(/pashto word/i), 'کور');
    await user.type(screen.getByLabelText(/definition/i), 'house');
    await user.selectOptions(screen.getByLabelText(/part of speech/i), 'noun');
    await user.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
    });
  });
});
