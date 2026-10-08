import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import api from '../../services/api';
import VariantEditForm from '../../components/moderation/VariantEditForm';
import ConceptEditForm from '../../components/moderation/ConceptEditForm';
import { LookupsWrapper } from '../helpers/lookups';
import { FieldsWrapper } from '../helpers/fields';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })), patch: vi.fn() },
}));

const wrap = (ui) => render(<LookupsWrapper><FieldsWrapper>{ui}</FieldsWrapper></LookupsWrapper>);

const variant = {
  _id: 'v1', pashto: 'کور', phonetic: 'kor', region: 'Kohat', definition: 'house', example: '',
  concept: { _id: 'c1', englishGloss: 'house' }, extra: { plural: 'کورونه', register: 'Archaic', old: 'kept' },
};

beforeEach(() => vi.clearAllMocks());

describe('VariantEditForm extra fields', () => {
  it('pre-fills extra values, keeps the retired option, and sends extra with the edit', async () => {
    const user = userEvent.setup();
    api.patch.mockResolvedValue({ data: { data: variant } });
    const onSave = vi.fn();
    wrap(<VariantEditForm item={variant} onSave={onSave} onCancel={() => {}} />);

    expect(screen.getByLabelText('Plural form')).toHaveValue('کورونه');
    expect(screen.getByLabelText(/^register/i)).toHaveValue('Archaic');

    await user.clear(screen.getByLabelText('Plural form'));
    await user.type(screen.getByLabelText('Plural form'), 'کورونې');
    await user.type(screen.getByLabelText('Note'), 'fix plural');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(api.patch).toHaveBeenCalledWith('/api/variants/v1/edit', expect.objectContaining({
      extra: { plural: 'کورونې', register: 'Archaic', old: 'kept' },
      note: 'fix plural',
    }));
  });

  it('shows the server error instead of failing silently', async () => {
    const user = userEvent.setup();
    api.patch.mockRejectedValue({ response: { data: { error: { message: 'Invalid option for Register' } } } });
    wrap(<VariantEditForm item={variant} onSave={() => {}} onCancel={() => {}} />);
    await user.type(screen.getByLabelText('Note'), 'n');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid option for Register');
  });
});

describe('ConceptEditForm extra fields', () => {
  it('sends concept extra values with the edit', async () => {
    const user = userEvent.setup();
    api.patch.mockResolvedValue({ data: { data: {} } });
    wrap(<ConceptEditForm item={{ _id: 'c1', englishGloss: 'house', partOfSpeech: 'noun' }} onSave={() => {}} onCancel={() => {}} />);
    await user.type(screen.getByLabelText(/etymology/i), 'Persian');
    await user.type(screen.getByLabelText('Note'), 'n');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/api/concepts/c1/edit', expect.objectContaining({ extra: { etymology: 'Persian' } })));
  });
});
