import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import Submit from '../../pages/Submit';
import MySubmissions from '../../pages/MySubmissions';
import ConceptDetail from '../../pages/ConceptDetail';
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
    updateVariant: vi.fn(),
    checkCrossConceptPashto: vi.fn(() => Promise.resolve({ data: { data: { conflicts: [] } } })),
  };
});

import { suggestConcepts, createVariant, updateVariant } from '../../services/api';

const renderAt = (path, element, route) => render(
  <LookupsWrapper>
    <FieldsWrapper defs={[]}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={element} />
          <Route path="/my-submissions" element={<div>done</div>} />
        </Routes>
      </MemoryRouter>
    </FieldsWrapper>
  </LookupsWrapper>
);

async function pickConcept(user, partOfSpeech) {
  suggestConcepts.mockResolvedValue({ data: { data: [{ _id: 'c1', englishGloss: 'sun', partOfSpeech }] } });
  renderAt('/submit', <Submit />, '/submit');
  await user.type(screen.getByLabelText(/english meaning/i), 'sun');
  await user.click(await screen.findByText('sun'));
}

beforeEach(() => vi.clearAllMocks());

describe('Submit with forms', () => {
  it('sends noun forms with the new variant', async () => {
    const user = userEvent.setup();
    createVariant.mockResolvedValue({ data: { data: { _id: 'v1' } } });
    await pickConcept(user, 'noun');

    await user.type(screen.getByLabelText(/pashto word/i), 'لمر');
    await user.selectOptions(screen.getByLabelText(/region/i), 'Kohat');
    await user.type(screen.getByLabelText(/^definition/i), 'sun');
    await user.click(screen.getByRole('button', { name: '+ Add form' }));
    await user.selectOptions(screen.getByLabelText('Form'), 'masculine.plural.direct');
    await user.type(screen.getByLabelText('Pashto'), 'لمرونه');
    await user.click(screen.getByRole('button', { name: /submit word/i }));

    await waitFor(() => expect(createVariant).toHaveBeenCalled());
    expect(createVariant.mock.calls[0][0].forms).toEqual([
      { kind: 'noun', gender: 'masculine', number: 'plural', case: 'direct', pashto: 'لمرونه' },
    ]);
  });

  it('offers no forms for an adverb and sends none', async () => {
    const user = userEvent.setup();
    await pickConcept(user, 'adverb');
    expect(await screen.findByLabelText(/pashto word/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Add form' })).toBeNull();
  });
});

describe('MySubmissions resubmit with forms', () => {
  it('lets a rejected variant add verb forms on resubmit', async () => {
    const user = userEvent.setup();
    const rejected = {
      _id: 'v1', pashto: 'لیکل', definition: 'write', region: 'Kohat', status: 'rejected', moderatorNote: 'add forms',
      concept: { _id: 'c1', englishGloss: 'write', partOfSpeech: 'verb' }, createdAt: '2024-01-01T00:00:00.000Z',
    };
    api.get
      .mockResolvedValueOnce({ data: { data: [] } })
      .mockResolvedValueOnce({ data: { data: [rejected] } });
    updateVariant.mockResolvedValue({ data: { data: { ...rejected, status: 'pending' } } });
    renderAt('/my-submissions', <MySubmissions />, '/my-submissions');

    await user.click(await screen.findByRole('button', { name: /edit & resubmit/i }));
    await user.click(screen.getByRole('button', { name: '+ Add form' }));
    await user.type(screen.getByLabelText('Pashto'), 'لیکل');
    await user.click(screen.getByRole('button', { name: /save & resubmit/i }));

    await waitFor(() => expect(updateVariant).toHaveBeenCalled());
    expect(updateVariant.mock.calls[0][1].forms).toEqual([{ kind: 'verb', verbForm: 'infinitive', pashto: 'لیکل' }]);
  });
});

describe('ConceptDetail forms', () => {
  it('shows a collapsible forms list under the selected regional variant', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue({
      data: {
        data: {
          _id: 'c1', englishGloss: 'sun', partOfSpeech: 'noun', status: 'published',
          variants: [{
            _id: 'v1', pashto: 'لمر', region: 'Kohat', definition: 'sun',
            forms: [{ kind: 'noun', gender: 'masculine', number: 'plural', case: 'direct', pashto: 'لمرونه', example: 'لمرونه ځلیږي' }],
          }],
        },
      },
    });
    renderAt('/concepts/c1', <ConceptDetail />, '/concepts/:id');

    await user.click(await screen.findByRole('button', { name: /forms \(1\)/i }));
    expect(screen.getByText('لمرونه')).toHaveAttribute('dir', 'rtl');
    expect(screen.getByText('لمرونه ځلیږي')).toBeInTheDocument();
  });
});
