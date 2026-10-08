import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import api from '../../services/api';
import FormsEditor from '../../components/forms/FormsEditor';
import FormsDisplay from '../../components/forms/FormsDisplay';
import VariantEditForm from '../../components/moderation/VariantEditForm';
import LogChanges from '../../components/log/LogChanges';
import { LookupsWrapper } from '../helpers/lookups';
import { FieldsWrapper } from '../helpers/fields';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })), patch: vi.fn() },
}));

const plural = { kind: 'noun', gender: 'masculine', number: 'plural', case: 'direct', pashto: 'کورونه', phonetic: 'koruna', example: 'دا کورونه دي' };
const past = { kind: 'verb', verbForm: 'past', pashto: 'ولیکل' };

function Harness({ kind, initial = [], onChange = () => {} }) {
  const [forms, setForms] = useState(initial);
  return (
    <FormsEditor
      kind={kind}
      forms={forms}
      onChange={(next) => { setForms(next); onChange(next); }}
      inputClassName=""
      labelClassName=""
    />
  );
}

beforeEach(() => vi.clearAllMocks());

describe('FormsEditor', () => {
  it('offers the eight noun slots and never the same slot twice', async () => {
    const user = userEvent.setup();
    render(<Harness kind="noun" />);
    await user.click(screen.getByRole('button', { name: '+ Add form' }));
    const first = screen.getByLabelText('Form');
    expect(within(first).getAllByRole('option')).toHaveLength(8);
    expect(first).toHaveValue('masculine.singular.direct');

    await user.click(screen.getByRole('button', { name: '+ Add form' }));
    const [a, b] = screen.getAllByLabelText('Form');
    expect(b).toHaveValue('masculine.singular.oblique');
    expect(within(a).queryByRole('option', { name: 'Masculine singular, oblique' })).toBeNull();
  });

  it('offers verb forms for a verb and lets a row be filled and removed', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness kind="verb" onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: '+ Add form' }));
    expect(within(screen.getByLabelText('Form')).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['Infinitive', 'Past', 'Present', 'Imperative']);

    await user.selectOptions(screen.getByLabelText('Form'), 'past');
    await user.type(screen.getByLabelText('Pashto'), 'ولیکل');
    expect(screen.getByLabelText('Pashto')).toHaveAttribute('dir', 'rtl');
    expect(onChange).toHaveBeenLastCalledWith([{ kind: 'verb', verbForm: 'past', pashto: 'ولیکل', phonetic: undefined, example: undefined }]);

    await user.click(screen.getByRole('button', { name: 'Remove Past form' }));
    expect(screen.queryByLabelText('Form')).toBeNull();
  });

  it('hides the add button once every slot is used', () => {
    const all = ['infinitive', 'past', 'present', 'imperative'].map((verbForm) => ({ kind: 'verb', verbForm, pashto: 'x' }));
    render(<Harness kind="verb" initial={all} />);
    expect(screen.queryByRole('button', { name: '+ Add form' })).toBeNull();
  });

  it('renders nothing for a part of speech without forms', () => {
    const { container } = render(<Harness kind={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('labels stored forms that no longer match the part of speech', () => {
    render(<Harness kind="verb" initial={[plural]} />);
    expect(screen.getByText(/doesn.t match the part of speech/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Form')).toBeDisabled();
  });
});

describe('FormsDisplay', () => {
  it('is collapsed by default and shows forms in slot order as plain text', async () => {
    const user = userEvent.setup();
    const sneaky = { ...past, verbForm: 'infinitive', pashto: '<b>لیکل</b>' };
    render(<FormsDisplay forms={[past, sneaky]} />);
    const toggle = screen.getByRole('button', { name: /forms \(2\)/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('ولیکل')).toBeNull();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Infinitive');
    expect(screen.getByText('<b>لیکل</b>')).toHaveAttribute('dir', 'rtl');
    expect(screen.getByText('ولیکل')).toHaveClass('font-pashto');
  });

  it('shows the example beneath the form', async () => {
    const user = userEvent.setup();
    render(<FormsDisplay forms={[plural]} />);
    await user.click(screen.getByRole('button', { name: /forms/i }));
    expect(screen.getByText('Masculine plural, direct')).toBeInTheDocument();
    expect(screen.getByText('دا کورونه دي')).toBeInTheDocument();
  });

  it('renders nothing without forms', () => {
    const { container } = render(<FormsDisplay forms={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('VariantEditForm forms', () => {
  const wrap = (ui) => render(<LookupsWrapper><FieldsWrapper defs={[]}>{ui}</FieldsWrapper></LookupsWrapper>);
  const item = {
    _id: 'v1', pashto: 'کور', region: 'Kohat', definition: 'house',
    concept: { _id: 'c1', englishGloss: 'house', partOfSpeech: 'noun' },
    forms: [{ ...plural, normalizedPashto: 'کورونه' }],
  };

  it('pre-fills stored forms and sends them without internal fields', async () => {
    const user = userEvent.setup();
    api.patch.mockResolvedValue({ data: { data: item } });
    wrap(<VariantEditForm item={item} onSave={() => {}} onCancel={() => {}} />);

    expect(screen.getByLabelText('Pashto', { selector: '[id$="-pashto"]' })).toHaveValue('کورونه');
    await user.click(screen.getByRole('button', { name: '+ Add form' }));
    await user.type(screen.getAllByLabelText('Pashto', { selector: '[id$="-pashto"]' })[1], 'کوره');
    await user.type(screen.getByLabelText('Note'), 'add oblique');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.patch).toHaveBeenCalled());
    expect(api.patch.mock.calls[0][1].forms).toEqual([
      { kind: 'noun', gender: 'masculine', number: 'plural', case: 'direct', pashto: 'کورونه', phonetic: 'koruna', example: 'دا کورونه دي' },
      { kind: 'noun', gender: 'masculine', number: 'singular', case: 'direct', pashto: 'کوره' },
    ]);
  });
});

describe('LogChanges form diffs', () => {
  it('names the form and shows its text', () => {
    const log = {
      targetModel: 'Variant',
      action: 'edited',
      changes: { 'forms.masculine.plural.direct': { from: null, to: { pashto: 'کورونه', phonetic: 'koruna' } } },
    };
    render(<FieldsWrapper defs={[]}><LogChanges log={log} /></FieldsWrapper>);
    expect(screen.getByText(/form \(Masculine plural, direct\)/)).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('کورونه · /koruna/')).toBeInTheDocument();
  });
});
