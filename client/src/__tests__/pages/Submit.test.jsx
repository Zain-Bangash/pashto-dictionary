import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import Submit from '../../pages/Submit';
import api from '../../services/api';
import { LookupsWrapper } from '../helpers/lookups';
import { FieldsWrapper } from '../helpers/fields';

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { _id: '1', role: 'user' }, token: 'jwt-token', login: vi.fn() })),
}));

vi.mock('../../services/api', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
    suggestConcepts: vi.fn(),
    createConcept: vi.fn(),
    createVariant: vi.fn(),
    uploadAudio: vi.fn(),
  };
});

import { suggestConcepts, createConcept, createVariant, uploadAudio } from '../../services/api';

const renderSubmit = (initialEntries = ['/submit']) => {
  let locationRef = {};
  function LocationCapture() {
    locationRef.current = useLocation();
    return null;
  }
  const utils = render(
    <LookupsWrapper>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/submit" element={<Submit />} />
          <Route path="/my-submissions" element={<LocationCapture />} />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
    </LookupsWrapper>
  );
  return { ...utils, locationRef };
};

beforeEach(() => {
  vi.clearAllMocks();
  suggestConcepts.mockResolvedValue({ data: { data: [] } });
});

describe('Submit page (two-step concept + variant flow)', () => {
  it('renders the English meaning input on step 1', () => {
    renderSubmit();
    expect(screen.getByLabelText(/english meaning/i)).toBeInTheDocument();
  });

  it('shows "Create new concept" button when user types a gloss with no suggestions', async () => {
    const user = userEvent.setup();
    suggestConcepts.mockResolvedValue({ data: { data: [] } });
    renderSubmit();
    await user.type(screen.getByLabelText(/english meaning/i), 'sun');
    expect(await screen.findByText(/create new concept/i)).toBeInTheDocument();
  });

  it('shows suggestion list when API returns matching concepts', async () => {
    const user = userEvent.setup();
    suggestConcepts.mockResolvedValue({
      data: { data: [{ _id: 'c1', englishGloss: 'sun', partOfSpeech: 'noun' }] },
    });
    renderSubmit();
    await user.type(screen.getByLabelText(/english meaning/i), 'sun');
    expect(await screen.findByText('sun')).toBeInTheDocument();
  });

  it('moves to step 2 when an existing concept is selected', async () => {
    const user = userEvent.setup();
    suggestConcepts.mockResolvedValue({
      data: { data: [{ _id: 'c1', englishGloss: 'sun', partOfSpeech: 'noun' }] },
    });
    renderSubmit();
    await user.type(screen.getByLabelText(/english meaning/i), 'sun');
    await user.click(await screen.findByText('sun'));
    expect(await screen.findByLabelText(/pashto word/i)).toBeInTheDocument();
  });

  it('moves to step 2 when "Create new" is clicked', async () => {
    const user = userEvent.setup();
    suggestConcepts.mockResolvedValue({ data: { data: [] } });
    renderSubmit();
    await user.type(screen.getByLabelText(/english meaning/i), 'moon');
    await user.click(await screen.findByText(/create new concept/i));
    expect(await screen.findByLabelText(/pashto word/i)).toBeInTheDocument();
  });

  it('renders part of speech select on step 2 when creating new concept', async () => {
    const user = userEvent.setup();
    suggestConcepts.mockResolvedValue({ data: { data: [] } });
    renderSubmit();
    await user.type(screen.getByLabelText(/english meaning/i), 'moon');
    await user.click(await screen.findByText(/create new concept/i));
    expect(await screen.findByLabelText(/part of speech/i)).toBeInTheDocument();
  });

  it('renders all valid part of speech options', async () => {
    const user = userEvent.setup();
    suggestConcepts.mockResolvedValue({ data: { data: [] } });
    renderSubmit();
    await user.type(screen.getByLabelText(/english meaning/i), 'moon');
    await user.click(await screen.findByText(/create new concept/i));
    const select = await screen.findByLabelText(/part of speech/i);
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toEqual(
      expect.arrayContaining(['noun', 'verb', 'adjective', 'adverb', 'phrase', 'other'])
    );
  });

  it('renders region select on step 2', async () => {
    const user = userEvent.setup();
    suggestConcepts.mockResolvedValue({ data: { data: [] } });
    renderSubmit();
    await user.type(screen.getByLabelText(/english meaning/i), 'moon');
    await user.click(await screen.findByText(/create new concept/i));
    expect(await screen.findByLabelText(/region/i)).toBeInTheDocument();
  });

  it('renders all valid region options', async () => {
    const user = userEvent.setup();
    suggestConcepts.mockResolvedValue({ data: { data: [] } });
    renderSubmit();
    await user.type(screen.getByLabelText(/english meaning/i), 'moon');
    await user.click(await screen.findByText(/create new concept/i));
    const select = await screen.findByLabelText(/region/i);
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toEqual(
      expect.arrayContaining(['Kohat', 'Hangu', 'Tirah', 'Thal', 'Parachinar'])
    );
  });

  it('renders a definition input on step 2', async () => {
    const user = userEvent.setup();
    suggestConcepts.mockResolvedValue({ data: { data: [] } });
    renderSubmit();
    await user.type(screen.getByLabelText(/english meaning/i), 'moon');
    await user.click(await screen.findByText(/create new concept/i));
    expect(await screen.findByLabelText(/definition/i)).toBeInTheDocument();
  });

  it('shows validation error when pashto word is empty on submit', async () => {
    const user = userEvent.setup();
    suggestConcepts.mockResolvedValue({ data: { data: [] } });
    renderSubmit();
    await user.type(screen.getByLabelText(/english meaning/i), 'moon');
    await user.click(await screen.findByText(/create new concept/i));
    await user.click(await screen.findByRole('button', { name: /submit/i }));
    expect(await screen.findByText(/pashto word is required/i)).toBeInTheDocument();
  });

  it('shows validation error when definition is empty on submit', async () => {
    const user = userEvent.setup();
    suggestConcepts.mockResolvedValue({ data: { data: [] } });
    renderSubmit();
    await user.type(screen.getByLabelText(/english meaning/i), 'moon');
    await user.click(await screen.findByText(/create new concept/i));
    await user.type(await screen.findByLabelText(/pashto word/i), 'سپوږمۍ');
    await user.selectOptions(await screen.findByLabelText(/region/i), 'Kohat');
    await user.click(screen.getByRole('button', { name: /submit/i }));
    expect(await screen.findByText(/definition is required/i)).toBeInTheDocument();
  });

  it('creates concept then variant when attaching to a new concept', async () => {
    const user = userEvent.setup();
    suggestConcepts.mockResolvedValue({ data: { data: [] } });
    createConcept.mockResolvedValueOnce({ data: { data: { _id: 'c1' } } });
    createVariant.mockResolvedValueOnce({ data: { data: { _id: 'v1', status: 'pending' } } });
    renderSubmit();
    await user.type(screen.getByLabelText(/english meaning/i), 'moon');
    await user.click(await screen.findByText(/create new concept/i));
    await user.type(await screen.findByLabelText(/pashto word/i), 'سپوږمۍ');
    await user.selectOptions(await screen.findByLabelText(/region/i), 'Kohat');
    await user.type(await screen.findByLabelText(/definition/i), 'the moon');
    await user.selectOptions(await screen.findByLabelText(/part of speech/i), 'noun');
    await user.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => {
      expect(createConcept).toHaveBeenCalledWith(
        expect.objectContaining({ englishGloss: 'moon', partOfSpeech: 'noun' })
      );
      expect(createVariant).toHaveBeenCalledWith(
        expect.objectContaining({ conceptId: 'c1', pashto: 'سپوږمۍ', region: 'Kohat', definition: 'the moon' })
      );
    });
  });

  it('creates only variant when attaching to an existing concept', async () => {
    const user = userEvent.setup();
    suggestConcepts.mockResolvedValue({
      data: { data: [{ _id: 'existing1', englishGloss: 'sun', partOfSpeech: 'noun' }] },
    });
    createVariant.mockResolvedValueOnce({ data: { data: { _id: 'v2', status: 'pending' } } });
    renderSubmit();
    await user.type(screen.getByLabelText(/english meaning/i), 'sun');
    await user.click(await screen.findByText('sun'));
    await user.type(await screen.findByLabelText(/pashto word/i), 'لمر');
    await user.selectOptions(await screen.findByLabelText(/region/i), 'Kohat');
    await user.type(await screen.findByLabelText(/definition/i), 'the sun');
    await user.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => {
      expect(createConcept).not.toHaveBeenCalled();
      expect(createVariant).toHaveBeenCalledWith(
        expect.objectContaining({ conceptId: 'existing1', pashto: 'لمر', region: 'Kohat' })
      );
    });
  });

  it('redirects to /my-submissions after successful submission', async () => {
    const user = userEvent.setup();
    suggestConcepts.mockResolvedValue({
      data: { data: [{ _id: 'c1', englishGloss: 'sun', partOfSpeech: 'noun' }] },
    });
    createVariant.mockResolvedValueOnce({ data: { data: { _id: 'v1', status: 'pending' } } });
    const { locationRef } = renderSubmit();
    await user.type(screen.getByLabelText(/english meaning/i), 'sun');
    await user.click(await screen.findByText('sun'));
    await user.type(await screen.findByLabelText(/pashto word/i), 'لمر');
    await user.selectOptions(await screen.findByLabelText(/region/i), 'Kohat');
    await user.type(await screen.findByLabelText(/definition/i), 'the sun');
    await user.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => {
      expect(locationRef.current?.pathname).toBe('/my-submissions');
    });
  });

  it('shows an API error message when submission fails', async () => {
    const user = userEvent.setup();
    suggestConcepts.mockResolvedValue({
      data: { data: [{ _id: 'c1', englishGloss: 'sun', partOfSpeech: 'noun' }] },
    });
    createVariant.mockRejectedValueOnce({
      response: { data: { success: false, error: { message: 'Submission failed' } } },
    });
    renderSubmit();
    await user.type(screen.getByLabelText(/english meaning/i), 'sun');
    await user.click(await screen.findByText('sun'));
    await user.type(await screen.findByLabelText(/pashto word/i), 'لمر');
    await user.selectOptions(await screen.findByLabelText(/region/i), 'Kohat');
    await user.type(await screen.findByLabelText(/definition/i), 'the sun');
    await user.click(screen.getByRole('button', { name: /submit/i }));
    expect(await screen.findByText(/submission failed/i)).toBeInTheDocument();
  });

  it('shows duplicate pashto error (409) as an API error message', async () => {
    const user = userEvent.setup();
    suggestConcepts.mockResolvedValue({
      data: { data: [{ _id: 'c1', englishGloss: 'sun', partOfSpeech: 'noun' }] },
    });
    createVariant.mockRejectedValueOnce({
      response: {
        status: 409,
        data: {
          success: false,
          error: { message: 'This Pashto word already exists. Consider adding it as a variant of the existing concept.' },
        },
      },
    });
    renderSubmit();
    await user.type(screen.getByLabelText(/english meaning/i), 'sun');
    await user.click(await screen.findByText('sun'));
    await user.type(await screen.findByLabelText(/pashto word/i), 'لمر');
    await user.selectOptions(await screen.findByLabelText(/region/i), 'Kohat');
    await user.type(await screen.findByLabelText(/definition/i), 'the sun');
    await user.click(screen.getByRole('button', { name: /submit/i }));
    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
  });

  it('disables the submit button while the request is in flight', async () => {
    const user = userEvent.setup();
    suggestConcepts.mockResolvedValue({
      data: { data: [{ _id: 'c1', englishGloss: 'sun', partOfSpeech: 'noun' }] },
    });
    createVariant.mockReturnValueOnce(new Promise(() => {}));
    renderSubmit();
    await user.type(screen.getByLabelText(/english meaning/i), 'sun');
    await user.click(await screen.findByText('sun'));
    await user.type(await screen.findByLabelText(/pashto word/i), 'لمر');
    await user.selectOptions(await screen.findByLabelText(/region/i), 'Kohat');
    await user.type(await screen.findByLabelText(/definition/i), 'the sun');
    await user.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
    });
  });
});

describe('Submit page — admin-defined extra fields', () => {
  const renderWithFields = () =>
    render(
      <LookupsWrapper>
        <FieldsWrapper>
          <MemoryRouter initialEntries={['/submit']}>
            <Routes>
              <Route path="/submit" element={<Submit />} />
              <Route path="/my-submissions" element={<div>mine</div>} />
            </Routes>
          </MemoryRouter>
        </FieldsWrapper>
      </LookupsWrapper>
    );

  async function fillNewConcept(user) {
    await user.type(screen.getByLabelText(/english meaning/i), 'moon');
    await user.click(await screen.findByText(/create new concept/i));
    await user.type(await screen.findByLabelText(/pashto word/i), 'سپوږمۍ');
    await user.selectOptions(screen.getByLabelText(/^region/i), 'Kohat');
    await user.type(screen.getByLabelText(/definition/i), 'the moon');
    await user.selectOptions(screen.getByLabelText(/part of speech/i), 'noun');
  }

  it('blocks submission until required extra fields are filled', async () => {
    const user = userEvent.setup();
    suggestConcepts.mockResolvedValue({ data: { data: [] } });
    renderWithFields();
    await fillNewConcept(user);
    await user.click(screen.getByRole('button', { name: /submit/i }));
    expect(await screen.findByText('Plural form is required')).toBeInTheDocument();
    expect(createConcept).not.toHaveBeenCalled();
  });

  it('sends concept and variant extra values with the submission', async () => {
    const user = userEvent.setup();
    suggestConcepts.mockResolvedValue({ data: { data: [] } });
    createConcept.mockResolvedValueOnce({ data: { data: { _id: 'c1' } } });
    createVariant.mockResolvedValueOnce({ data: { data: { _id: 'v1' } } });
    renderWithFields();
    await fillNewConcept(user);
    await user.type(screen.getByLabelText(/etymology/i), 'Old Iranian');
    await user.type(screen.getByLabelText('Plural form'), 'سپوږمۍ ګانې');
    await user.selectOptions(screen.getByLabelText(/^register/i), 'Formal');
    await user.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => {
      expect(createConcept).toHaveBeenCalledWith(expect.objectContaining({ extra: { etymology: 'Old Iranian' } }));
      expect(createVariant).toHaveBeenCalledWith(expect.objectContaining({ extra: { plural: 'سپوږمۍ ګانې', register: 'Formal' } }));
    });
  });
});

describe('Submit page — pronunciation recording', () => {
  const clipFile = () => new File([new Uint8Array(8)], 'word.webm', { type: 'audio/webm' });

  async function toStep2(user) {
    suggestConcepts.mockResolvedValue({ data: { data: [{ _id: 'c1', englishGloss: 'sun', partOfSpeech: 'noun' }] } });
    await user.type(screen.getByLabelText(/english meaning/i), 'sun');
    await user.click(await screen.findByText('sun'));
  }

  async function fillWord(user) {
    await user.type(await screen.findByLabelText(/pashto word/i), 'لمر');
    await user.selectOptions(screen.getByLabelText(/^region/i), 'Kohat');
    await user.type(screen.getByLabelText(/definition/i), 'the sun');
  }

  it('asks for the Pashto word before recording', async () => {
    const user = userEvent.setup();
    renderSubmit();
    await toStep2(user);
    expect(screen.getByText(/type the pashto word above/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Upload a recording')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/pashto word/i), 'لمر');
    expect(screen.getByLabelText('Upload a recording')).toBeInTheDocument();
    expect(screen.getByText(/up to 3 seconds/i)).toBeInTheDocument();
  });

  it('submits without a recording and never calls uploadAudio', async () => {
    const user = userEvent.setup();
    createVariant.mockResolvedValueOnce({ data: { data: { _id: 'v1' } } });
    const { locationRef } = renderSubmit();
    await toStep2(user);
    await fillWord(user);
    await user.click(screen.getByRole('button', { name: /submit word/i }));
    await waitFor(() => expect(locationRef.current?.pathname).toBe('/my-submissions'));
    expect(uploadAudio).not.toHaveBeenCalled();
  });

  it('uploads the recording for the new word after it is created', async () => {
    const user = userEvent.setup();
    createVariant.mockResolvedValueOnce({ data: { data: { _id: 'v1' } } });
    uploadAudio.mockResolvedValueOnce({ data: { data: { _id: 'a1', status: 'pending' } } });
    const { locationRef } = renderSubmit();
    await toStep2(user);
    await fillWord(user);
    const file = clipFile();
    await user.upload(screen.getByLabelText('Upload a recording'), file);
    await user.click(screen.getByRole('button', { name: /submit word/i }));
    await waitFor(() => expect(locationRef.current?.pathname).toBe('/my-submissions'));
    expect(uploadAudio).toHaveBeenCalledWith('v1', 'headword', file);
    expect(createVariant.mock.invocationCallOrder[0]).toBeLessThan(uploadAudio.mock.invocationCallOrder[0]);
  });

  it('keeps the word when the upload fails and offers retry or continue', async () => {
    const user = userEvent.setup();
    createVariant.mockResolvedValueOnce({ data: { data: { _id: 'v1' } } });
    uploadAudio
      .mockRejectedValueOnce({ response: { data: { error: { message: 'The recording is too long: this one allows up to 3 seconds' } } } })
      .mockResolvedValueOnce({ data: { data: { _id: 'a1' } } });
    const { locationRef } = renderSubmit();
    await toStep2(user);
    await fillWord(user);
    await user.upload(screen.getByLabelText('Upload a recording'), clipFile());
    await user.click(screen.getByRole('button', { name: /submit word/i }));

    expect(await screen.findByText(/your word was submitted/i)).toBeInTheDocument();
    expect(screen.getByText(/too long/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(locationRef.current?.pathname).toBe('/my-submissions'));
    expect(uploadAudio).toHaveBeenCalledTimes(2);
    expect(createVariant).toHaveBeenCalledTimes(1);
  });

  it('can continue without the recording after a failed upload', async () => {
    const user = userEvent.setup();
    createVariant.mockResolvedValueOnce({ data: { data: { _id: 'v1' } } });
    uploadAudio.mockRejectedValueOnce({ response: { data: { error: { message: 'Upload failed' } } } });
    const { locationRef } = renderSubmit();
    await toStep2(user);
    await fillWord(user);
    await user.upload(screen.getByLabelText('Upload a recording'), clipFile());
    await user.click(screen.getByRole('button', { name: /submit word/i }));
    await user.click(await screen.findByRole('button', { name: /continue without it/i }));
    await waitFor(() => expect(locationRef.current?.pathname).toBe('/my-submissions'));
  });

  it('warns when the word changes after recording', async () => {
    const user = userEvent.setup();
    renderSubmit();
    await toStep2(user);
    await user.type(screen.getByLabelText(/pashto word/i), 'لمر');
    await user.upload(screen.getByLabelText('Upload a recording'), clipFile());
    expect(screen.queryByText(/word changed since you recorded/i)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/pashto word/i), 'ونه');
    expect(screen.getByText(/word changed since you recorded/i)).toBeInTheDocument();
  });
});
