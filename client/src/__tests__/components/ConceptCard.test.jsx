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

describe('ConceptCard — gloss above the word and "+ n more words"', () => {
  const withWord = (fields = {}) => ({
    ...baseConcept,
    firstVariant: { _id: 'v1', pashto: 'کور', example: 'دا کور دی' },
    ...fields,
  });
  const follows = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

  test('the English gloss comes before the Pashto word, and the example after it', () => {
    renderCard(withWord());
    const gloss = screen.getByRole('link', { name: 'house' });
    const pashto = screen.getByTestId('card-pashto');
    expect(follows(gloss, pashto)).toBe(true);
    expect(follows(pashto, screen.getByText('دا کور دی'))).toBe(true);
    expect(pashto).toHaveAttribute('dir', 'rtl');
    expect(pashto).toHaveClass('font-pashto');
  });

  test('the gloss stays the whole-card link', () => {
    renderCard(withWord());
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'house' })).toHaveAttribute('href', '/concepts/abc123');
  });

  test('one other word reads "+ 1 more word"', () => {
    renderCard(withWord({ moreWordCount: 1 }));
    expect(screen.getByText('+ 1 more word')).toBeInTheDocument();
  });

  test('several other words read "+ n more words"', () => {
    renderCard(withWord({ moreWordCount: 3 }));
    expect(screen.getByText('+ 3 more words')).toBeInTheDocument();
  });

  test('no note when there are no other words', () => {
    const { unmount } = renderCard(withWord({ moreWordCount: 0 }));
    expect(screen.queryByText(/more word/)).not.toBeInTheDocument();
    unmount();
    renderCard(withWord());
    expect(screen.queryByText(/more word/)).not.toBeInTheDocument();
  });

  test('the note sits in the Pashto word row, before the word', () => {
    renderCard(withWord({ moreWordCount: 2 }));
    const note = screen.getByText('+ 2 more words');
    const pashto = screen.getByTestId('card-pashto');
    expect(note.parentElement).toBe(pashto.parentElement);
    expect(follows(note, pashto)).toBe(true);
  });

  test('without a published word the gloss is the heading and no note shows', () => {
    renderCard({ ...baseConcept, moreWordCount: 0 });
    expect(screen.getByRole('heading', { name: 'house' })).toBeInTheDocument();
    expect(screen.queryByTestId('card-pashto')).not.toBeInTheDocument();
  });
});

describe('ConceptCard — example recording', () => {
  const originalCanPlay = HTMLMediaElement.prototype.canPlayType;
  beforeEach(() => { HTMLMediaElement.prototype.canPlayType = (type) => (type === 'audio/webm' ? 'maybe' : ''); });
  afterEach(() => { HTMLMediaElement.prototype.canPlayType = originalCanPlay; });

  const withExample = (exampleAudio) => ({
    ...baseConcept,
    firstVariant: { _id: 'v1', pashto: 'کور', example: 'دا کور دی', exampleAudio },
  });

  test('a play button sits beside the example when it has a published recording', () => {
    renderCard(withExample({ _id: 'a1', url: 'https://storage.test/a1.webm', mimeType: 'audio/webm' }));
    const play = screen.getByRole('button', { name: 'Play example for کور' });
    expect(play.parentElement.parentElement).toBe(screen.getByText('دا کور دی').parentElement);
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  test('no play button without one', () => {
    renderCard(withExample(null));
    expect(screen.queryByRole('button', { name: /play example/i })).not.toBeInTheDocument();
  });
});
