import { screen } from '@testing-library/react';

const STATUSES = ['pending', 'approved', 'published', 'rejected'];

export function countsFor(items) {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, items.filter((i) => i.status === s).length]));
  return { ...counts, total: items.length };
}

// Routes api.get by URL the way the My Submissions page calls it: summary, concepts, variants
export function mockSubmissionsApi(api, { concepts = [], variants = [], summary, variantsMeta = {}, conceptsMeta = {}, fail = false } = {}) {
  api.get.mockImplementation((url) => {
    if (fail) return Promise.reject(new Error('Network error'));
    if (url === '/api/submissions/summary') {
      return Promise.resolve({
        data: { data: summary ?? { concepts: countsFor(concepts), variants: countsFor(variants), audio: countsFor([]), suggestions: countsFor([]) } },
      });
    }
    if (url === '/api/concepts/my-submissions') {
      return Promise.resolve({ data: { data: concepts, meta: { page: 1, limit: 5, total: concepts.length, ...conceptsMeta } } });
    }
    if (url === '/api/variants/my-submissions') {
      return Promise.resolve({ data: { data: variants, meta: { page: 1, limit: 5, total: variants.length, needsCompletionCount: 0, ...variantsMeta } } });
    }
    return Promise.resolve({ data: { data: [] } });
  });
}

export const callsTo = (api, url) => api.get.mock.calls.filter(([u]) => u === url);

// Sections start closed; open one by its title
export async function openSection(user, title) {
  const button = await screen.findByRole('button', { name: new RegExp(`^${title}`, 'i') });
  if (button.getAttribute('aria-expanded') !== 'true') await user.click(button);
  return button;
}
