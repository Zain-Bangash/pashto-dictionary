/**
 * Phase 9.5 — Moderation Enhancements (Frontend)
 *
 * Tests for:
 *  - Rejection note modal in DashboardQueue (Concepts + Variants tabs)
 *  - Inline edit form in DashboardQueue (Concepts + Variants tabs)
 *  - Variant concept reassignment search in the edit form
 *  - Similar concepts panel in DashboardQueue (Concepts tab)
 *  - Merge confirmation modal in DashboardQueue
 *  - Merge button + modal in DashboardConcepts
 *  - New api.js service functions: editConcept, editVariant, mergeConcepts
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import api, { checkCrossConceptPashto } from '../../services/api';
import DashboardQueue from '../../pages/dashboard/DashboardQueue';
import DashboardConcepts from '../../pages/dashboard/DashboardConcepts';

// ---------------------------------------------------------------------------
// Global mock — mirrors the shape used in Dashboard.test.jsx
// ---------------------------------------------------------------------------
vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  // named exports used by components
  suggestConcepts: vi.fn(),
  transitionConceptStatus: vi.fn(),
  transitionVariantStatus: vi.fn(),
  editConcept: vi.fn(),
  editVariant: vi.fn(),
  mergeConcepts: vi.fn(),
  checkCrossConceptPashto: vi.fn().mockResolvedValue({ data: { data: { conflicts: [] } } }),
}));

const mockUseAuth = vi.fn();
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// ---------------------------------------------------------------------------
// Role helpers
// ---------------------------------------------------------------------------
const asModerator = () =>
  mockUseAuth.mockReturnValue({ user: { _id: 'u2', role: 'moderator' }, token: 'tok' });

const asAdmin = () =>
  mockUseAuth.mockReturnValue({ user: { _id: 'u3', role: 'admin' }, token: 'tok' });

// ---------------------------------------------------------------------------
// Data factories
// ---------------------------------------------------------------------------
const mockConcept = (overrides = {}) => ({
  _id: 'c1',
  englishGloss: 'house',
  partOfSpeech: 'noun',
  status: 'pending',
  submittedBy: { _id: 'other', username: 'testuser' },
  createdAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

const mockVariant = (overrides = {}) => ({
  _id: 'v1',
  pashto: 'کور',
  phonetic: 'kor',
  region: 'Kohat',
  definition: 'a dwelling place',
  example: 'This is my house.',
  status: 'pending',
  submittedBy: { _id: 'other', username: 'testuser' },
  concept: { _id: 'c1', englishGloss: 'house', status: 'approved' },
  createdAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

// ---------------------------------------------------------------------------
// Queue render helpers
// ---------------------------------------------------------------------------
function mockQueueWithConcepts(concepts = [], variants = []) {
  api.get
    .mockResolvedValueOnce({
      data: { success: true, data: concepts, meta: { page: 1, limit: 20, total: concepts.length, pendingCount: concepts.length, approvedCount: 0 } },
    })
    .mockResolvedValueOnce({
      data: { success: true, data: variants, meta: { page: 1, limit: 20, total: variants.length, pendingCount: variants.length, approvedCount: 0 } },
    });
}

function mockQueueBothEmpty() {
  mockQueueWithConcepts([], []);
}

const renderQueue = () =>
  render(
    <MemoryRouter initialEntries={['/dashboard/queue']}>
      <DashboardQueue />
    </MemoryRouter>
  );

const renderConcepts = () =>
  render(
    <MemoryRouter initialEntries={['/dashboard/entries']}>
      <DashboardConcepts />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.resetAllMocks();
  checkCrossConceptPashto.mockResolvedValue({ data: { data: { conflicts: [] } } });
});

// ===========================================================================
// 1.  Rejection note modal — Concepts tab
// ===========================================================================

describe('Rejection note modal — Concepts tab', () => {
  it('does NOT call the API immediately when Reject is clicked', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueueWithConcepts([mockConcept({ _id: 'c99' })], []);

    renderQueue();
    await user.click(await screen.findByRole('button', { name: /reject/i }));

    // API must NOT have been called yet
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('opens a modal/dialog when Reject is clicked on a concept', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueueWithConcepts([mockConcept()], []);

    renderQueue();
    await user.click(await screen.findByRole('button', { name: /reject/i }));

    // Some form of modal must appear — dialog role or a textarea
    const modal =
      screen.queryByRole('dialog') ||
      screen.queryByRole('alertdialog') ||
      screen.queryByLabelText(/reason/i) ||
      screen.queryByPlaceholderText(/reason/i);
    expect(modal).toBeInTheDocument();
  });

  it('renders a textarea inside the rejection modal for concepts', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueueWithConcepts([mockConcept()], []);

    renderQueue();
    await user.click(await screen.findByRole('button', { name: /reject/i }));

    expect(screen.getByRole('textbox', { name: /reason/i }) ||
      screen.getByPlaceholderText(/reason/i) ||
      document.querySelector('textarea')).toBeTruthy();
  });

  it('disables the confirm/submit button when the textarea is empty (concepts)', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueueWithConcepts([mockConcept()], []);

    renderQueue();
    await user.click(await screen.findByRole('button', { name: /reject/i }));

    const confirmBtn =
      screen.queryByRole('button', { name: /confirm|submit/i });
    expect(confirmBtn).toBeDisabled();
  });

  it('calls the status API with moderatorNote when rejection is confirmed (concepts)', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueueWithConcepts([mockConcept({ _id: 'cABC' })], []);
    api.patch.mockResolvedValueOnce({
      data: { success: true, data: { _id: 'cABC', status: 'rejected' } },
    });

    renderQueue();
    await user.click(await screen.findByRole('button', { name: /reject/i }));

    // type into the textarea
    const textarea =
      screen.queryByRole('textbox', { name: /reason/i }) ||
      document.querySelector('textarea');
    await user.type(textarea, 'Duplicate entry');

    const confirmBtn = screen.getByRole('button', { name: /confirm|submit/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/concepts\/cABC\/status/),
        expect.objectContaining({ status: 'rejected', moderatorNote: 'Duplicate entry' })
      );
    });
  });

  it('closes the modal without calling the API when Cancel is clicked (concepts)', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueueWithConcepts([mockConcept()], []);

    renderQueue();
    await user.click(await screen.findByRole('button', { name: /reject/i }));

    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelBtn);

    expect(api.patch).not.toHaveBeenCalled();

    // modal should be gone
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // textarea gone
    expect(document.querySelector('textarea')).not.toBeInTheDocument();
  });
});

// ===========================================================================
// 2.  Rejection note modal — Variants tab
// ===========================================================================

describe('Rejection note modal — Variants tab', () => {
  const switchToVariantsTab = async (user) => {
    const variantsTab = await screen.findByRole('button', { name: /variants/i });
    await user.click(variantsTab);
  };

  it('opens a modal when Reject is clicked on a variant', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueueWithConcepts([], [mockVariant()]);

    renderQueue();
    await switchToVariantsTab(user);

    const rejectBtn = await screen.findByRole('button', { name: /reject/i });
    await user.click(rejectBtn);

    const modal =
      screen.queryByRole('dialog') ||
      screen.queryByRole('alertdialog') ||
      screen.queryByLabelText(/reason/i) ||
      screen.queryByPlaceholderText(/reason/i);
    expect(modal).toBeInTheDocument();
  });

  it('does NOT call the API immediately when Reject is clicked on a variant', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueueWithConcepts([], [mockVariant()]);

    renderQueue();
    await switchToVariantsTab(user);

    const rejectBtn = await screen.findByRole('button', { name: /reject/i });
    await user.click(rejectBtn);

    expect(api.patch).not.toHaveBeenCalled();
  });

  it('disables confirm button when textarea is empty (variants)', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueueWithConcepts([], [mockVariant()]);

    renderQueue();
    await switchToVariantsTab(user);

    await user.click(await screen.findByRole('button', { name: /reject/i }));

    const confirmBtn = screen.queryByRole('button', { name: /confirm|submit/i });
    expect(confirmBtn).toBeDisabled();
  });

  it('calls the status API with moderatorNote when rejecting a variant', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueueWithConcepts([], [mockVariant({ _id: 'vXYZ' })]);
    api.patch.mockResolvedValueOnce({
      data: { success: true, data: { _id: 'vXYZ', status: 'rejected' } },
    });

    renderQueue();
    await switchToVariantsTab(user);

    await user.click(await screen.findByRole('button', { name: /reject/i }));

    const textarea =
      screen.queryByRole('textbox', { name: /reason/i }) ||
      document.querySelector('textarea');
    await user.type(textarea, 'Wrong spelling');

    await user.click(screen.getByRole('button', { name: /confirm|submit/i }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/variants\/vXYZ\/status/),
        expect.objectContaining({ status: 'rejected', moderatorNote: 'Wrong spelling' })
      );
    });
  });

  it('closes the modal without calling the API when Cancel is clicked (variants)', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueueWithConcepts([], [mockVariant()]);

    renderQueue();
    await switchToVariantsTab(user);

    await user.click(await screen.findByRole('button', { name: /reject/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(api.patch).not.toHaveBeenCalled();
    expect(document.querySelector('textarea')).not.toBeInTheDocument();
  });
});

// ===========================================================================
// 3.  Inline edit form — Concepts tab
// ===========================================================================

describe('Inline edit form — Concepts tab', () => {
  it('renders an Edit button for each concept in the queue', async () => {
    asModerator();
    mockQueueWithConcepts([mockConcept()], []);

    renderQueue();
    expect(await screen.findByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('does NOT navigate away when Edit is clicked — form appears inline', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueueWithConcepts([mockConcept({ englishGloss: 'river' })], []);

    renderQueue();
    await screen.findByText('river');
    await user.click(screen.getByRole('button', { name: /edit/i }));

    // The concept text must still be in the document (same page)
    expect(screen.getByText('river')).toBeInTheDocument();
    // An inline form should have appeared
    const form = screen.queryByRole('form') || document.querySelector('form');
    expect(form).toBeInTheDocument();
  });

  it('pre-populates the concept edit form with the existing englishGloss', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueueWithConcepts([mockConcept({ englishGloss: 'mountain', partOfSpeech: 'noun' })], []);

    renderQueue();
    await screen.findByText('mountain');
    await user.click(screen.getByRole('button', { name: /edit/i }));

    const glossInput =
      screen.queryByDisplayValue('mountain') ||
      screen.queryByLabelText(/gloss|english/i);
    expect(glossInput).toBeInTheDocument();
  });

  it('pre-populates the concept edit form with the existing partOfSpeech', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueueWithConcepts([mockConcept({ englishGloss: 'mountain', partOfSpeech: 'noun' })], []);

    renderQueue();
    await screen.findByText('mountain');
    await user.click(screen.getByRole('button', { name: /edit/i }));

    // partOfSpeech should be visible — either a selected option or an input value
    const posEl =
      screen.queryByDisplayValue('noun') ||
      screen.queryByLabelText(/part.of.speech/i);
    expect(posEl).toBeInTheDocument();
  });

  it('disables the edit form submit button when the note field is empty', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueueWithConcepts([mockConcept()], []);

    renderQueue();
    await user.click(await screen.findByRole('button', { name: /edit/i }));

    const submitBtn = screen.queryByRole('button', { name: /save|update/i });
    expect(submitBtn).toBeDisabled();
  });

  it('calls editConcept with the existing _id and form data on submit', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueueWithConcepts([mockConcept({ _id: 'c42', englishGloss: 'fire', partOfSpeech: 'noun' })], []);
    api.patch.mockResolvedValueOnce({
      data: { success: true, data: { _id: 'c42', englishGloss: 'fire updated', partOfSpeech: 'noun', status: 'pending' } },
    });

    renderQueue();
    await screen.findByText('fire');
    await user.click(screen.getByRole('button', { name: /edit/i }));

    // Update the gloss
    const glossInput =
      screen.queryByDisplayValue('fire') ||
      screen.queryByLabelText(/gloss|english/i);
    if (glossInput) {
      await user.clear(glossInput);
      await user.type(glossInput, 'fire updated');
    }

    // Fill in the required note
    const noteInput =
      screen.queryByLabelText(/note/i) ||
      screen.queryByPlaceholderText(/note/i);
    if (noteInput) await user.type(noteInput, 'Fixed gloss');

    const saveBtn = screen.queryByRole('button', { name: /save|update/i });
    if (saveBtn && !saveBtn.disabled) await user.click(saveBtn);

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/concepts\/c42\/edit/),
        expect.anything()
      );
    });
  });

  it('updates the item in the list after a successful concept edit (no full reload)', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueueWithConcepts([mockConcept({ _id: 'c55', englishGloss: 'old gloss', partOfSpeech: 'noun' })], []);
    api.patch.mockResolvedValueOnce({
      data: { success: true, data: { _id: 'c55', englishGloss: 'new gloss', partOfSpeech: 'noun', status: 'pending' } },
    });

    renderQueue();
    await screen.findByText('old gloss');
    await user.click(screen.getByRole('button', { name: /edit/i }));

    const glossInput = screen.queryByDisplayValue('old gloss') || screen.queryByLabelText(/gloss|english/i);
    if (glossInput) { await user.clear(glossInput); await user.type(glossInput, 'new gloss'); }

    const noteInput = screen.queryByLabelText(/note/i) || screen.queryByPlaceholderText(/note/i);
    if (noteInput) await user.type(noteInput, 'Updated');

    const saveBtn = screen.queryByRole('button', { name: /save|update/i });
    if (saveBtn && !saveBtn.disabled) await user.click(saveBtn);

    // api.get should NOT have been called again (no full reload).
    // Count is 3: 2 initial queue loads + 1 from SimilarConceptsPanel's suggestConcepts call.
    await waitFor(() => {
      const getCallCount = api.get.mock.calls.length;
      expect(getCallCount).toBe(3);
    });
  });
});

// ===========================================================================
// 4.  Inline edit form — Variants tab
// ===========================================================================

describe('Inline edit form — Variants tab', () => {
  const switchToVariantsTab = async (user) => {
    const variantsTab = await screen.findByRole('button', { name: /variants/i });
    await user.click(variantsTab);
  };

  it('renders an Edit button for each variant in the queue', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueueWithConcepts([], [mockVariant()]);

    renderQueue();
    await switchToVariantsTab(user);
    expect(await screen.findByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('pre-populates the variant edit form with pashto field', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueueWithConcepts([], [mockVariant({ pashto: 'کور', definition: 'a house' })]);

    renderQueue();
    await switchToVariantsTab(user);
    await screen.findByText('کور');
    await user.click(screen.getByRole('button', { name: /edit/i }));

    const pashtoInput =
      screen.queryByDisplayValue('کور') ||
      screen.queryByLabelText(/pashto/i);
    expect(pashtoInput).toBeInTheDocument();
  });

  it('pre-populates the variant edit form with definition field', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueueWithConcepts([], [mockVariant({ pashto: 'کور', definition: 'a dwelling place' })]);

    renderQueue();
    await switchToVariantsTab(user);
    await screen.findByText('کور');
    await user.click(screen.getByRole('button', { name: /edit/i }));

    const defInput =
      screen.queryByDisplayValue('a dwelling place') ||
      screen.queryByLabelText(/definition/i);
    expect(defInput).toBeInTheDocument();
  });

  it('disables the variant edit form submit button when note is empty', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueueWithConcepts([], [mockVariant()]);

    renderQueue();
    await switchToVariantsTab(user);
    await user.click(await screen.findByRole('button', { name: /edit/i }));

    const saveBtn = screen.queryByRole('button', { name: /save|update/i });
    expect(saveBtn).toBeDisabled();
  });

  it('calls editVariant with the existing _id and form data on submit', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueueWithConcepts([], [mockVariant({ _id: 'v77', pashto: 'کور', definition: 'a dwelling' })]);
    api.patch.mockResolvedValueOnce({
      data: { success: true, data: { _id: 'v77', pashto: 'کور', definition: 'a dwelling place', status: 'pending' } },
    });

    renderQueue();
    await switchToVariantsTab(user);
    await screen.findByText('کور');
    await user.click(screen.getByRole('button', { name: /edit/i }));

    const noteInput = screen.queryByLabelText(/note/i) || screen.queryByPlaceholderText(/note/i);
    if (noteInput) await user.type(noteInput, 'Fixed definition');

    const saveBtn = screen.queryByRole('button', { name: /save|update/i });
    if (saveBtn && !saveBtn.disabled) await user.click(saveBtn);

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/variants\/v77\/edit/),
        expect.anything()
      );
    });
  });
});

// ===========================================================================
// 5.  Variant concept reassignment field in the edit form
// ===========================================================================

describe('Variant concept reassignment field in edit form', () => {
  const switchToVariantsTab = async (user) => {
    const variantsTab = await screen.findByRole('button', { name: /variants/i });
    await user.click(variantsTab);
  };

  it('shows a concept search input inside the variant edit form', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueueWithConcepts([], [mockVariant()]);

    renderQueue();
    await switchToVariantsTab(user);
    await user.click(await screen.findByRole('button', { name: /edit/i }));

    const conceptSearch =
      screen.queryByLabelText(/concept/i) ||
      screen.queryByPlaceholderText(/search concept|concept/i);
    expect(conceptSearch).toBeInTheDocument();
  });

  it('calls suggestConcepts when typing in the concept search input', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueueWithConcepts([], [mockVariant()]);
    api.get.mockResolvedValueOnce({
      data: { success: true, data: [{ _id: 'c99', englishGloss: 'love', status: 'published' }] },
    });

    renderQueue();
    await switchToVariantsTab(user);
    await user.click(await screen.findByRole('button', { name: /edit/i }));

    const conceptSearch =
      screen.queryByLabelText(/concept/i) ||
      screen.queryByPlaceholderText(/search concept|concept/i);
    if (conceptSearch) await user.type(conceptSearch, 'lov');

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/concepts\/suggest.*q=lov/)
      );
    });
  });

  it('displays suggestion with englishGloss and _id', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueueWithConcepts([], [mockVariant()]);
    api.get.mockResolvedValueOnce({
      data: { success: true, data: [{ _id: 'cSuggest1', englishGloss: 'love', status: 'published' }] },
    });

    renderQueue();
    await switchToVariantsTab(user);
    await user.click(await screen.findByRole('button', { name: /edit/i }));

    const conceptSearch =
      screen.queryByLabelText(/concept/i) ||
      screen.queryByPlaceholderText(/search concept|concept/i);
    if (conceptSearch) await user.type(conceptSearch, 'lov');

    expect(await screen.findByText(/love/i)).toBeInTheDocument();
    expect(await screen.findByText(/cSuggest1/)).toBeInTheDocument();
  });

  it('sets the concept field to the selected suggestion _id', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueueWithConcepts([], [mockVariant({ _id: 'v88' })]);
    api.patch.mockResolvedValueOnce({
      data: { success: true, data: { _id: 'v88', status: 'pending' } },
    });
    api.get.mockResolvedValueOnce({
      data: { success: true, data: [{ _id: 'cNewTarget', englishGloss: 'love', status: 'published' }] },
    });

    renderQueue();
    await switchToVariantsTab(user);
    await user.click(await screen.findByRole('button', { name: /edit/i }));

    const conceptSearch =
      screen.queryByLabelText(/concept/i) ||
      screen.queryByPlaceholderText(/search concept|concept/i);
    if (conceptSearch) {
      await user.type(conceptSearch, 'lov');
      const suggestion = await screen.findByText(/love/i);
      await user.click(suggestion);
    }

    const noteInput = screen.queryByLabelText(/note/i) || screen.queryByPlaceholderText(/note/i);
    if (noteInput) await user.type(noteInput, 'Reassigning concept');

    const saveBtn = screen.queryByRole('button', { name: /save|update/i });
    if (saveBtn && !saveBtn.disabled) await user.click(saveBtn);

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/variants\/v88\/edit/),
        expect.objectContaining({ concept: 'cNewTarget' })
      );
    });
  });
});

// ===========================================================================
// 6.  Similar concepts panel — Concepts tab
// ===========================================================================

describe('Similar concepts panel in Concepts tab', () => {
  it('calls suggestConcepts with the item englishGloss when rendering a concept in the queue', async () => {
    asModerator();
    mockQueueWithConcepts([mockConcept({ _id: 'c1', englishGloss: 'house' })], []);

    renderQueue();
    await screen.findByText('house');

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/concepts\/suggest.*q=house/)
      );
    });
  });

  it('shows a similar concepts panel when suggestConcepts returns other concepts', async () => {
    asModerator();
    mockQueueWithConcepts([mockConcept({ _id: 'c1', englishGloss: 'house' })], []);
    // Third get call is the suggestConcepts for the item
    api.get.mockResolvedValueOnce({
      data: { success: true, data: [{ _id: 'c2', englishGloss: 'home', status: 'published' }] },
    });

    renderQueue();
    await screen.findByText('house');

    expect(await screen.findByText(/home/i)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /merge/i })).toBeInTheDocument();
  });

  it('does NOT show a similar concepts panel when suggestConcepts returns empty', async () => {
    asModerator();
    mockQueueWithConcepts([mockConcept({ _id: 'c1', englishGloss: 'house' })], []);
    api.get.mockResolvedValueOnce({
      data: { success: true, data: [] },
    });

    renderQueue();
    await screen.findByText('house');

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /merge into this/i })).not.toBeInTheDocument();
    });
  });

  it('does NOT include the item itself in the similar concepts panel', async () => {
    asModerator();
    // suggestConcepts might return the item itself — UI must filter it out
    mockQueueWithConcepts([mockConcept({ _id: 'c1', englishGloss: 'house' })], []);
    api.get.mockResolvedValueOnce({
      data: { success: true, data: [
        { _id: 'c1', englishGloss: 'house', status: 'pending' }, // same as item — should be excluded
        { _id: 'c2', englishGloss: 'home', status: 'published' },
      ] },
    });

    renderQueue();
    await screen.findByText('house');

    // only 'home' should appear in the panel; 'house' is the item itself and must be excluded from suggestions
    const mergeButtons = await screen.findAllByRole('button', { name: /merge into this/i });
    expect(mergeButtons).toHaveLength(1);
  });
});

// ===========================================================================
// 7.  Merge confirmation modal and API call — DashboardQueue
// ===========================================================================

describe('Merge confirmation modal — DashboardQueue', () => {
  it('opens a confirmation modal when "Merge into this" is clicked', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueueWithConcepts([mockConcept({ _id: 'c1', englishGloss: 'house' })], []);
    api.get.mockResolvedValueOnce({
      data: { success: true, data: [{ _id: 'c2', englishGloss: 'home', status: 'published' }] },
    });

    renderQueue();
    await screen.findByText('house');

    const mergeBtn = await screen.findByRole('button', { name: /merge into this/i });
    await user.click(mergeBtn);

    const modal =
      screen.queryByRole('dialog') ||
      screen.queryByRole('alertdialog') ||
      screen.queryByText(/move all variants/i) ||
      screen.queryByText(/merge/i);
    expect(modal).toBeInTheDocument();
  });

  it('calls mergeConcepts with sourceId, targetConceptId and note when confirmed', async () => {
    const user = userEvent.setup();
    asModerator();
    // c2 is the source in the queue; c1 is the target we're merging INTO
    mockQueueWithConcepts([mockConcept({ _id: 'c1', englishGloss: 'house' })], []);
    api.get.mockResolvedValueOnce({
      data: { success: true, data: [{ _id: 'c2', englishGloss: 'home', status: 'published' }] },
    });
    api.post.mockResolvedValueOnce({
      data: { success: true, data: { moved: 2, skipped: [] } },
    });

    renderQueue();
    await screen.findByText('house');

    const mergeBtn = await screen.findByRole('button', { name: /merge into this/i });
    await user.click(mergeBtn);

    // Fill in the note if present
    const noteInput = screen.queryByLabelText(/note/i) || screen.queryByPlaceholderText(/note/i);
    if (noteInput) await user.type(noteInput, 'Merging duplicates');

    const confirmBtn = screen.getByRole('button', { name: /confirm|merge/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/concepts\/c2\/merge/),
        expect.objectContaining({ targetConceptId: 'c1' })
      );
    });
  });

  it('removes the source concept from the queue list after a successful merge', async () => {
    const user = userEvent.setup();
    asModerator();
    mockQueueWithConcepts([mockConcept({ _id: 'c1', englishGloss: 'house' })], []);
    api.get.mockResolvedValueOnce({
      data: { success: true, data: [{ _id: 'c2', englishGloss: 'home', status: 'published' }] },
    });
    api.post.mockResolvedValueOnce({
      data: { success: true, data: { moved: 1, skipped: [] } },
    });

    renderQueue();
    await screen.findByText('house');

    const mergeBtn = await screen.findByRole('button', { name: /merge into this/i });
    await user.click(mergeBtn);

    const noteInput = screen.queryByLabelText(/note/i) || screen.queryByPlaceholderText(/note/i);
    if (noteInput) await user.type(noteInput, 'Merge');

    const confirmBtn = screen.getByRole('button', { name: /confirm|merge/i });
    await user.click(confirmBtn);

    // 'home' (c2) should be removed from the queue; 'house' (c1) is the target, it stays
    await waitFor(() => {
      expect(screen.queryByText('home')).not.toBeInTheDocument();
    });
  });
});

// ===========================================================================
// 8.  Merge from Concepts list — DashboardConcepts.jsx
// ===========================================================================

describe('Merge from Concepts list — DashboardConcepts', () => {
  it('renders a Merge button on each concept row', async () => {
    asModerator();
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: [mockConcept({ _id: 'cA', englishGloss: 'house' })],
        meta: { page: 1, limit: 20, total: 1 },
      },
    });

    renderConcepts();
    expect(await screen.findByRole('button', { name: /merge/i })).toBeInTheDocument();
  });

  it('opens a modal with a concept search input when Merge is clicked', async () => {
    const user = userEvent.setup();
    asModerator();
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: [mockConcept({ _id: 'cA', englishGloss: 'house' })],
        meta: { page: 1, limit: 20, total: 1 },
      },
    });

    renderConcepts();
    await user.click(await screen.findByRole('button', { name: /merge/i }));

    const searchInput =
      screen.queryByLabelText(/search target/i) ||
      screen.queryByPlaceholderText(/search concept/i);
    expect(searchInput).toBeInTheDocument();
  });

  it('calls suggestConcepts when typing into the merge target search', async () => {
    const user = userEvent.setup();
    asModerator();
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: [mockConcept({ _id: 'cA', englishGloss: 'house' })],
        meta: { page: 1, limit: 20, total: 1 },
      },
    });
    api.get.mockResolvedValueOnce({
      data: { success: true, data: [{ _id: 'cB', englishGloss: 'home', status: 'published' }] },
    });

    renderConcepts();
    await user.click(await screen.findByRole('button', { name: /merge/i }));

    const searchInput =
      screen.queryByLabelText(/search target/i) ||
      screen.queryByPlaceholderText(/search concept/i);
    if (searchInput) await user.type(searchInput, 'hom');

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/concepts\/suggest.*q=hom/)
      );
    });
  });

  it('calls mergeConcepts when a target is selected and merge is confirmed', async () => {
    const user = userEvent.setup();
    asModerator();
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: [mockConcept({ _id: 'cSource', englishGloss: 'house' })],
        meta: { page: 1, limit: 20, total: 1 },
      },
    });
    api.get.mockResolvedValueOnce({
      data: { success: true, data: [{ _id: 'cTarget', englishGloss: 'home', status: 'published' }] },
    });
    api.post.mockResolvedValueOnce({
      data: { success: true, data: { moved: 1, skipped: [] } },
    });

    renderConcepts();
    await user.click(await screen.findByRole('button', { name: /merge/i }));

    const searchInput =
      screen.queryByLabelText(/search target/i) ||
      screen.queryByPlaceholderText(/search concept/i);
    if (searchInput) {
      await user.type(searchInput, 'hom');
      const suggestion = await screen.findByText(/home/i);
      await user.click(suggestion);
    }

    const noteInput = screen.queryByLabelText(/note/i) || screen.queryByPlaceholderText(/note/i);
    if (noteInput) await user.type(noteInput, 'Merge duplicate');

    const confirmBtn = screen.getByRole('button', { name: /confirm|merge/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/concepts\/cSource\/merge/),
        expect.objectContaining({ targetConceptId: 'cTarget' })
      );
    });
  });
});

// ===========================================================================
// 9.  New api.js service functions — surface-level unit checks
// ===========================================================================

describe('New api.js service functions', () => {
  it('editConcept sends PATCH to /api/concepts/:id/edit', async () => {
    // vi.mock above stubs the whole module, so we use importActual to get the
    // real function and spy on the real axios instance it closes over.
    const mod = await vi.importActual('../../services/api');
    const spy = vi.spyOn(mod.default, 'patch').mockResolvedValueOnce({ data: { success: true, data: {} } });
    await mod.editConcept('c1', { englishGloss: 'test', note: 'reason' });
    expect(spy).toHaveBeenCalledWith('/api/concepts/c1/edit', { englishGloss: 'test', note: 'reason' });
    spy.mockRestore();
  });

  it('editVariant sends PATCH to /api/variants/:id/edit', async () => {
    const mod = await vi.importActual('../../services/api');
    const spy = vi.spyOn(mod.default, 'patch').mockResolvedValueOnce({ data: { success: true, data: {} } });
    await mod.editVariant('v1', { pashto: 'test', note: 'reason' });
    expect(spy).toHaveBeenCalledWith('/api/variants/v1/edit', { pashto: 'test', note: 'reason' });
    spy.mockRestore();
  });

  it('mergeConcepts sends POST to /api/concepts/:sourceId/merge', async () => {
    const mod = await vi.importActual('../../services/api');
    const spy = vi.spyOn(mod.default, 'post').mockResolvedValueOnce({ data: { success: true, data: { moved: 1, skipped: [] } } });
    await mod.mergeConcepts('cSource', { targetConceptId: 'cTarget', note: 'reason' });
    expect(spy).toHaveBeenCalledWith('/api/concepts/cSource/merge', { targetConceptId: 'cTarget', note: 'reason' });
    spy.mockRestore();
  });
});
