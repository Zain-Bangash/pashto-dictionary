import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, beforeEach } from 'vitest';
import DomainPicker from '../../components/DomainPicker';
import DomainChips from '../../components/DomainChips';
import DomainFilter from '../../components/DomainFilter';
import AlsoMeans from '../../components/concept/AlsoMeans';
import ConceptEditForm from '../../components/moderation/ConceptEditForm';
import Concepts from '../../pages/Concepts';
import api from '../../services/api';
import { LookupsWrapper, LOOKUP_ROWS } from '../helpers/lookups';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), patch: vi.fn() },
}));

const ROWS = [
  ...LOOKUP_ROWS,
  { _id: 'd1', type: 'semanticDomain', key: 'Food', label: 'Food & cooking', order: 0, active: true, isSystem: false },
  { _id: 'd2', type: 'semanticDomain', key: 'Farming', label: 'Farming', order: 1, active: true, isSystem: false },
  { _id: 'd3', type: 'semanticDomain', key: 'Old', label: 'Old domain', order: 2, active: false, isSystem: false },
];

const wrap = (ui, rows = ROWS, path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <LookupsWrapper rows={rows}>{ui}</LookupsWrapper>
    </MemoryRouter>
  );

beforeEach(() => vi.clearAllMocks());

describe('DomainPicker', () => {
  test('toggles several active domains on and off', async () => {
    const onChange = vi.fn();
    const { rerender } = wrap(<DomainPicker value={[]} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Food & cooking' }));
    expect(onChange).toHaveBeenLastCalledWith(['Food']);

    rerender(
      <MemoryRouter>
        <LookupsWrapper rows={ROWS}><DomainPicker value={['Food']} onChange={onChange} /></LookupsWrapper>
      </MemoryRouter>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Farming' }));
    expect(onChange).toHaveBeenLastCalledWith(['Food', 'Farming']);
    await userEvent.click(screen.getByRole('button', { name: 'Food & cooking' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  test('hides deactivated domains unless already chosen', () => {
    const { unmount } = wrap(<DomainPicker value={[]} onChange={() => {}} />);
    expect(screen.queryByRole('button', { name: /Old domain/ })).not.toBeInTheDocument();
    unmount();
    wrap(<DomainPicker value={['Old']} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Old domain (retired)' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('renders nothing when there are no domains', () => {
    wrap(<DomainPicker value={[]} onChange={() => {}} label="Domains" />, LOOKUP_ROWS);
    expect(screen.queryByText('Domains')).not.toBeInTheDocument();
  });
});

describe('DomainChips', () => {
  test('shows labels linking to the filtered browse page', () => {
    wrap(<DomainChips domains={['Food']} />);
    expect(screen.getByRole('link', { name: 'Food & cooking' })).toHaveAttribute('href', '/concepts?domain=Food');
  });
});

describe('DomainFilter', () => {
  test('selecting the active domain again clears it', async () => {
    const onChange = vi.fn();
    wrap(<DomainFilter value="Food" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Food & cooking' }));
    expect(onChange).toHaveBeenCalledWith('');
    await userEvent.click(screen.getByRole('button', { name: 'Farming' }));
    expect(onChange).toHaveBeenCalledWith('Farming');
  });
});

describe('AlsoMeans', () => {
  test('links each other meaning and names its regions', () => {
    wrap(<AlsoMeans meanings={[{ conceptId: 'c2', englishGloss: 'fence', regions: ['Hangu', 'Tirah'] }]} />);
    expect(screen.getByText(/Also means/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'fence' })).toHaveAttribute('href', '/concepts/c2');
    expect(screen.getByText('(Hangu, Tirah)')).toBeInTheDocument();
  });

  test('renders nothing without other meanings', () => {
    const { container } = wrap(<AlsoMeans meanings={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('ConceptEditForm', () => {
  test('sends the chosen domains with the edit', async () => {
    api.patch.mockResolvedValueOnce({ data: { data: {} } });
    const item = { _id: 'c1', englishGloss: 'bread', partOfSpeech: 'noun', semanticDomains: ['Food'] };
    wrap(<ConceptEditForm item={item} onSave={() => {}} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Farming' }));
    await userEvent.type(screen.getByLabelText('Note'), 'tag');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalled());
    expect(api.patch.mock.calls[0][1]).toMatchObject({ semanticDomains: ['Food', 'Farming'] });
  });
});

describe('Concepts page domain filter', () => {
  test('reads the domain from the URL and sends it to the API', async () => {
    api.get.mockResolvedValue({ data: { data: [], meta: { page: 1, limit: 20, total: 0 } } });
    render(
      <MemoryRouter initialEntries={['/concepts?domain=Farming']}>
        <LookupsWrapper rows={ROWS}>
          <Routes><Route path="/concepts" element={<Concepts />} /></Routes>
        </LookupsWrapper>
      </MemoryRouter>
    );
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(api.get.mock.calls[0][0]).toContain('domain=Farming');
    expect(screen.getByRole('button', { name: 'Farming' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('picking a domain updates the request', async () => {
    api.get.mockResolvedValue({ data: { data: [], meta: { page: 1, limit: 20, total: 0 } } });
    render(
      <MemoryRouter initialEntries={['/concepts']}>
        <LookupsWrapper rows={ROWS}>
          <Routes><Route path="/concepts" element={<Concepts />} /></Routes>
        </LookupsWrapper>
      </MemoryRouter>
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Food & cooking' }));
    await waitFor(() => expect(api.get.mock.calls.at(-1)[0]).toContain('domain=Food'));
  });
});
