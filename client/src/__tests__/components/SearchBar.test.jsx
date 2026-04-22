import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import SearchBar from '../../components/SearchBar';

describe('SearchBar', () => {
  test('renders an input and a submit button', () => {
    render(<SearchBar onSubmit={vi.fn()} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });

  test('initialValue prop populates the input', () => {
    render(<SearchBar initialValue="kor" onSubmit={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveValue('kor');
  });

  test('typing updates the input value', async () => {
    const user = userEvent.setup();
    render(<SearchBar onSubmit={vi.fn()} />);
    const input = screen.getByRole('textbox');
    await user.type(input, 'کور');
    expect(input).toHaveValue('کور');
  });

  test('submitting calls onSubmit with the trimmed current value', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();
    render(<SearchBar onSubmit={handleSubmit} />);
    const input = screen.getByRole('textbox');
    await user.type(input, '  hello  ');
    await user.click(screen.getByRole('button', { name: /search/i }));
    expect(handleSubmit).toHaveBeenCalledOnce();
    expect(handleSubmit).toHaveBeenCalledWith('hello');
  });

  test('submitting with empty input calls onSubmit with empty string', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();
    render(<SearchBar onSubmit={handleSubmit} />);
    await user.click(screen.getByRole('button', { name: /search/i }));
    expect(handleSubmit).toHaveBeenCalledOnce();
    expect(handleSubmit).toHaveBeenCalledWith('');
  });

  test('pressing Enter submits the form', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();
    render(<SearchBar onSubmit={handleSubmit} />);
    const input = screen.getByRole('textbox');
    await user.type(input, 'word');
    await user.keyboard('{Enter}');
    expect(handleSubmit).toHaveBeenCalledWith('word');
  });
});
