import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import ExtraFieldsInputs from '../../components/fields/ExtraFieldsInputs';
import ExtraFieldsDisplay from '../../components/fields/ExtraFieldsDisplay';
import { missingRequired } from '../../context/fieldsValue';
import QueueVariantRow from '../../components/moderation/QueueVariantRow';
import QueueConceptGroup from '../../components/moderation/QueueConceptGroup';
import { FieldsWrapper, FIELD_DEFS } from '../helpers/fields';

function Harness({ initial = {}, onValues = () => {}, errors }) {
  const [values, setValues] = useState(initial);
  return (
    <ExtraFieldsInputs
      appliesTo="variant"
      values={values}
      errors={errors}
      onChange={(key, value) => setValues((v) => { const next = { ...v, [key]: value }; onValues(next); return next; })}
    />
  );
}

describe('ExtraFieldsInputs', () => {
  it('renders an input per active field of the entry type, in order, with the right control', () => {
    render(<FieldsWrapper><Harness /></FieldsWrapper>);
    expect(screen.getByLabelText('Plural form')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText(/Register/).tagName).toBe('SELECT');
    expect(screen.getByLabelText(/Usage notes/).tagName).toBe('TEXTAREA');
    expect(screen.queryByLabelText(/Etymology/)).not.toBeInTheDocument();
  });

  it('marks optional fields and leaves required ones unmarked', () => {
    render(<FieldsWrapper><Harness /></FieldsWrapper>);
    expect(screen.getByText('Plural form').textContent).toBe('Plural form');
    expect(screen.getByText(/Register/).textContent).toMatch(/optional/);
  });

  it('lists active options by label and submits keys', async () => {
    const user = userEvent.setup();
    const onValues = vi.fn();
    render(<FieldsWrapper><Harness onValues={onValues} /></FieldsWrapper>);
    const select = screen.getByLabelText(/Register/);
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['—', 'Formal', 'Slang (colloquial)']);
    await user.selectOptions(select, 'Slang (colloquial)');
    expect(onValues).toHaveBeenLastCalledWith({ register: 'Slang' });
  });

  it('keeps a stored retired option selectable, marked retired', () => {
    render(<FieldsWrapper><Harness initial={{ register: 'Archaic' }} /></FieldsWrapper>);
    expect(screen.getByLabelText(/Register/)).toHaveValue('Archaic');
    expect(screen.getByRole('option', { name: 'Archaic (retired)' })).toBeInTheDocument();
  });

  it('shows per-field errors', () => {
    render(<FieldsWrapper><Harness errors={{ plural: 'Plural form is required' }} /></FieldsWrapper>);
    expect(screen.getByText('Plural form is required')).toBeInTheDocument();
  });

  it('shows loading, and an error with retry', async () => {
    const user = userEvent.setup();
    const reload = vi.fn();
    const { unmount } = render(<FieldsWrapper defs={[]} loading><Harness /></FieldsWrapper>);
    expect(screen.getByText(/loading extra fields/i)).toBeInTheDocument();
    unmount();
    render(<FieldsWrapper defs={[]} error="Could not load extra fields" reload={reload}><Harness /></FieldsWrapper>);
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(reload).toHaveBeenCalled();
  });
});

describe('missingRequired', () => {
  it('reports only active required fields left empty', () => {
    const variantDefs = FIELD_DEFS.filter((d) => d.appliesTo === 'variant');
    expect(missingRequired(variantDefs, {})).toEqual({ plural: 'Plural form is required' });
    expect(missingRequired(variantDefs, { plural: '  ' })).toEqual({ plural: 'Plural form is required' });
    expect(missingRequired(variantDefs, { plural: 'x' })).toEqual({});
  });
});

describe('ExtraFieldsDisplay', () => {
  it('shows filled active fields with labels, option labels and line breaks', () => {
    render(
      <FieldsWrapper>
        <ExtraFieldsDisplay appliesTo="variant" values={{ plural: 'لمرونه', register: 'Slang', usage: 'one\ntwo' }} />
      </FieldsWrapper>
    );
    expect(screen.getByText('Plural form:')).toBeInTheDocument();
    expect(screen.getByText('لمرونه')).toBeInTheDocument();
    expect(screen.getByText('Slang (colloquial)')).toBeInTheDocument();
    expect(screen.getByText(/one/)).toHaveClass('whitespace-pre-line');
  });

  it('hides values for deactivated or unknown fields and renders nothing when empty', () => {
    const defs = FIELD_DEFS.map((d) => (d.key === 'plural' ? { ...d, active: false } : d));
    const { container } = render(
      <FieldsWrapper defs={defs}>
        <ExtraFieldsDisplay appliesTo="variant" values={{ plural: 'hidden', ghost: 'x' }} />
      </FieldsWrapper>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders values as plain text, never HTML', () => {
    const { container } = render(
      <FieldsWrapper>
        <ExtraFieldsDisplay appliesTo="variant" values={{ plural: '<img src=x onerror=alert(1)>' }} />
      </FieldsWrapper>
    );
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('moderation queue rows show extra values for review', () => {
  it('QueueVariantRow shows variant extra values', () => {
    const variant = { _id: 'v1', pashto: 'کور', region: 'Kohat', definition: 'house', status: 'pending', submittedBy: { username: 'u' }, extra: { plural: 'کورونه' } };
    render(
      <FieldsWrapper>
        <ul><QueueVariantRow variant={variant} concept={{ _id: 'c1', status: 'approved' }} isAdmin={false} onAction={() => {}} onReject={() => {}} onSave={() => {}} /></ul>
      </FieldsWrapper>
    );
    expect(screen.getByText('Plural form:')).toBeInTheDocument();
    expect(screen.getByText('کورونه')).toBeInTheDocument();
  });

  it('QueueConceptGroup shows concept extra values', () => {
    const group = { _id: 'c1', englishGloss: 'house', partOfSpeech: 'noun', status: 'pending', submittedBy: { username: 'u' }, extra: { etymology: 'Persian' }, variants: [] };
    render(
      <FieldsWrapper>
        <ul><QueueConceptGroup group={group} isAdmin={false} crossConceptMap={{}} showSimilar={false} onAction={() => {}} onReject={() => {}} onConceptSave={() => {}} onVariantSave={() => {}} onMergeRequest={() => {}} /></ul>
      </FieldsWrapper>
    );
    expect(screen.getByText('Persian')).toBeInTheDocument();
  });
});
