import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ConceptCard from '../../components/ConceptCard';
import { LookupsWrapper, LOOKUP_ROWS } from '../helpers/lookups';

const renderCard = (concept) =>
  render(
    <MemoryRouter>
      <ConceptCard concept={concept} />
    </MemoryRouter>
  );

const baseConcept = {
  _id: 'abc123',
  englishGloss: 'house',
  partOfSpeech: 'noun',
  variantCount: 3,
};

describe('ConceptCard', () => {
  test('renders the englishGloss', () => {
    renderCard(baseConcept);
    expect(screen.getByText('house')).toBeInTheDocument();
  });

  test('renders the partOfSpeech when present', () => {
    renderCard(baseConcept);
    expect(screen.getByText('noun')).toBeInTheDocument();
  });

  test('omits partOfSpeech when absent', () => {
    renderCard({ ...baseConcept, partOfSpeech: undefined });
    expect(screen.queryByText('noun')).not.toBeInTheDocument();
  });

  test('renders the variant count', () => {
    renderCard(baseConcept);
    expect(screen.getByText('3 regional variants')).toBeInTheDocument();
  });

  test('renders singular "variant" when count is 1', () => {
    renderCard({ ...baseConcept, variantCount: 1 });
    expect(screen.getByText('1 regional variant')).toBeInTheDocument();
  });

  test('defaults variantCount to 0 when not provided', () => {
    const { variantCount: _vc, ...withoutCount } = baseConcept;
    renderCard(withoutCount);
    expect(screen.getByText('0 regional variants')).toBeInTheDocument();
  });

  test('contains a link to /entries/:id', () => {
    renderCard(baseConcept);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/concepts/abc123');
  });

  test('shows the current admin-edited label for the stored part-of-speech key', () => {
    const rows = LOOKUP_ROWS.map((r) => (r.key === 'noun' ? { ...r, label: 'Noun (اسم)' } : r));
    render(
      <LookupsWrapper rows={rows}>
        <MemoryRouter>
          <ConceptCard concept={baseConcept} />
        </MemoryRouter>
      </LookupsWrapper>
    );
    expect(screen.getByText('Noun (اسم)')).toBeInTheDocument();
  });
});
