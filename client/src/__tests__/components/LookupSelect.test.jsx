import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import LookupSelect from '../../components/LookupSelect';
import { LookupsWrapper, LOOKUP_ROWS } from '../helpers/lookups';

const rows = [
  ...LOOKUP_ROWS,
  { _id: 'r9', type: 'region', key: 'Bajaur', label: 'Bajaur Agency', order: 9, active: false, isSystem: false },
];

const renderSelect = (props = {}, ctx = {}) =>
  render(
    <LookupsWrapper rows={rows} {...ctx}>
      <LookupSelect type="region" aria-label="Region" value="" onChange={() => {}} placeholder="Select…" {...props} />
    </LookupsWrapper>
  );

const optionTexts = () => within(screen.getByLabelText('Region')).getAllByRole('option').map((o) => o.textContent);

describe('LookupSelect', () => {
  it('lists only active values of its type after the placeholder', () => {
    renderSelect();
    expect(optionTexts()).toEqual(['Select…', 'Kohat', 'Hangu', 'Tirah', 'Thal', 'Parachinar']);
  });

  it('keeps an existing inactive value selectable, marked retired', () => {
    renderSelect({ value: 'Bajaur' });
    expect(optionTexts()).toContain('Bajaur Agency (retired)');
    expect(screen.getByLabelText('Region')).toHaveValue('Bajaur');
  });

  it('shows labels but submits keys', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn((e) => e.target.value);
    const renamed = rows.map((r) => (r.key === 'Hangu' ? { ...r, label: 'Hangu Valley' } : r));
    render(
      <LookupsWrapper rows={renamed}>
        <LookupSelect type="region" aria-label="Region" value="" onChange={onChange} placeholder="Select…" />
      </LookupsWrapper>
    );
    await user.selectOptions(screen.getByLabelText('Region'), 'Hangu Valley');
    expect(onChange).toHaveReturnedWith('Hangu');
  });

  it('is disabled with a loading option while lists load', () => {
    renderSelect({}, { rows: [], loading: true });
    expect(screen.getByLabelText('Region')).toBeDisabled();
    expect(optionTexts()).toEqual(['Loading…']);
  });

  it('shows an error with a retry button when lists fail to load', async () => {
    const user = userEvent.setup();
    const reload = vi.fn();
    renderSelect({}, { rows: [], error: 'Could not load list options', reload });
    expect(screen.getByLabelText('Region')).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/could not load/i);
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(reload).toHaveBeenCalled();
  });
});
