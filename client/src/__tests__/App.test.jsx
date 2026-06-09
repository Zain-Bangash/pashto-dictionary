import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

// Mock api to prevent real network calls during tests
vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: { data: [], meta: { page: 1, limit: 20, total: 0 } } })),
  },
  setToken: vi.fn(),
  clearToken: vi.fn(),
  getToken: vi.fn(() => null),
  setLogoutHandler: vi.fn(),
}));

describe('App router', () => {
  test('renders the navbar on home route', async () => {
    render(<App />);
    expect(await screen.findByText('Dictionary')).toBeInTheDocument();
  });

  test('home page contains a search input', async () => {
    render(<App />);
    expect(await screen.findByPlaceholderText('Search Pashto words…')).toBeInTheDocument();
  });
});
