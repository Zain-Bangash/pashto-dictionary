import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import { LookupsProvider } from '../../context/LookupsContext';
import { buildLookupsValue } from '../../context/lookupsValue';
import useLookups from '../../hooks/useLookups';
import { getLookups } from '../../services/api';
import { LOOKUP_ROWS } from '../helpers/lookups';

vi.mock('../../services/api', () => ({ getLookups: vi.fn() }));

function Probe() {
  const { loading, error, active, labelFor, reload } = useLookups();
  if (loading) return <p>loading</p>;
  if (error) return <button onClick={reload}>{error}</button>;
  return (
    <>
      <p>regions: {active('region').map((r) => r.label).join(',')}</p>
      <p>label: {labelFor('region', 'Kohat')}</p>
    </>
  );
}

beforeEach(() => vi.resetAllMocks());

describe('LookupsProvider', () => {
  it('shows loading, then exposes active rows sorted as returned', async () => {
    getLookups.mockResolvedValue({ data: { data: LOOKUP_ROWS } });
    render(<LookupsProvider><Probe /></LookupsProvider>);
    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(await screen.findByText('regions: Kohat,Hangu,Tirah,Thal,Parachinar')).toBeInTheDocument();
    expect(getLookups).toHaveBeenCalledTimes(1);
  });

  it('shows an error and retries on reload', async () => {
    const user = userEvent.setup();
    getLookups.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce({ data: { data: LOOKUP_ROWS } });
    render(<LookupsProvider><Probe /></LookupsProvider>);
    await user.click(await screen.findByRole('button', { name: /could not load/i }));
    await waitFor(() => expect(screen.getByText(/regions: Kohat/)).toBeInTheDocument());
    expect(getLookups).toHaveBeenCalledTimes(2);
  });
});

describe('buildLookupsValue', () => {
  const rows = [
    { type: 'region', key: 'Kohat', label: 'Kohat District', active: true },
    { type: 'region', key: 'Bajaur', label: 'Bajaur', active: false },
  ];

  it('labelFor shows the current label for a key', () => {
    expect(buildLookupsValue({ rows }).labelFor('region', 'Kohat')).toBe('Kohat District');
  });

  it('labelFor falls back to the key when no row matches', () => {
    expect(buildLookupsValue({ rows }).labelFor('region', 'Unknown')).toBe('Unknown');
    expect(buildLookupsValue().labelFor('partOfSpeech', 'noun')).toBe('noun');
  });

  it('active excludes inactive rows but all and labelFor still include them', () => {
    const v = buildLookupsValue({ rows });
    expect(v.active('region').map((r) => r.key)).toEqual(['Kohat']);
    expect(v.all('region')).toHaveLength(2);
    expect(v.labelFor('region', 'Bajaur')).toBe('Bajaur');
  });
});
