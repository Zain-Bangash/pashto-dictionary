import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App placeholder', () => {
  test('renders the "Pashto Dictionary" heading', () => {
    render(<App />);
    expect(screen.getByText('Pashto Dictionary')).toBeInTheDocument();
  });

  test('heading is an h1 element', () => {
    render(<App />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Pashto Dictionary');
  });
});
