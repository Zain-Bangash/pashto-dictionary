// Phase 10 — 404 / NotFound page
// Spec: client/src/pages/NotFound.jsx must exist and render:
//   1. A visible "not found" heading or message (containing "404" or "not found")
//   2. A link that navigates back to "/"

import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import NotFound from '../../pages/NotFound';

// NotFound does not call the API, but mock it defensively in case the
// component imports a shared hook that references api.
vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: null })),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

const renderNotFound = () =>
  render(
    <MemoryRouter initialEntries={['/some-missing-route']}>
      <Routes>
        <Route path="/" element={<div>Home page</div>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </MemoryRouter>
  );

describe('NotFound page', () => {
  it('renders a heading or message that conveys the page was not found', () => {
    renderNotFound();
    // Accept either a literal "404" or text matching "not found" (case-insensitive)
    const has404 = screen.queryByText(/404/i);
    const hasNotFound = screen.queryByText(/not found/i);
    expect(has404 || hasNotFound).not.toBeNull();
  });

  it('renders a link that points to the home route "/"', () => {
    renderNotFound();
    // There must be at least one anchor whose href ends with "/"
    const homeLinks = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href') === '/');
    expect(homeLinks.length).toBeGreaterThan(0);
  });

  it('does not crash when rendered without any surrounding context', () => {
    // Simplest possible render — just confirm no uncaught error
    expect(() =>
      render(
        <MemoryRouter>
          <NotFound />
        </MemoryRouter>
      )
    ).not.toThrow();
  });
});
