import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import EntryCard from '../../components/EntryCard';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const renderCard = (entry) =>
  render(
    <MemoryRouter>
      <EntryCard entry={entry} />
    </MemoryRouter>
  );

const baseEntry = {
  _id: 'abc123',
  pashto: 'کور',
  phonetic: 'kor',
  definitions: [{ text: 'house' }],
};

describe('EntryCard', () => {
  test('renders the pashto word', () => {
    renderCard(baseEntry);
    expect(screen.getByText('کور')).toBeInTheDocument();
  });

  test('renders phonetic when present', () => {
    renderCard(baseEntry);
    expect(screen.getByText('kor')).toBeInTheDocument();
  });

  test('omits phonetic when absent', () => {
    const entry = { ...baseEntry, phonetic: undefined };
    renderCard(entry);
    expect(screen.queryByText('kor')).not.toBeInTheDocument();
  });

  test('renders the first definition text', () => {
    renderCard(baseEntry);
    expect(screen.getByText('house')).toBeInTheDocument();
  });

  test('truncates definition longer than 80 characters', () => {
    const longText = 'a'.repeat(90);
    const entry = { ...baseEntry, definitions: [{ text: longText }] };
    renderCard(entry);
    const truncated = 'a'.repeat(80) + '…';
    expect(screen.getByText(truncated)).toBeInTheDocument();
  });

  test('does not truncate definition of exactly 80 characters', () => {
    const text = 'b'.repeat(80);
    const entry = { ...baseEntry, definitions: [{ text }] };
    renderCard(entry);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  test('contains a link to /entries/:id', () => {
    renderCard(baseEntry);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/entries/abc123');
  });

  test('handles missing definitions without crashing', () => {
    const entry = { _id: 'xyz', pashto: 'آب', definitions: [] };
    renderCard(entry);
    expect(screen.getByText('آب')).toBeInTheDocument();
  });

  test('handles undefined definitions without crashing', () => {
    const entry = { _id: 'xyz', pashto: 'آب' };
    renderCard(entry);
    expect(screen.getByText('آب')).toBeInTheDocument();
  });
});
