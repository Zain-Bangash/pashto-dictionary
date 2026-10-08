import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import DashboardFields from '../../pages/dashboard/DashboardFields';
import {
  getAllFields, createField, updateField, reorderFields, deactivateField, reactivateField,
  addFieldOption, deactivateFieldOption,
} from '../../services/api';
import { FieldsWrapper, FIELD_DEFS } from '../helpers/fields';

vi.mock('../../services/api', () => ({
  getAllFields: vi.fn(),
  createField: vi.fn(),
  updateField: vi.fn(),
  reorderFields: vi.fn(),
  deactivateField: vi.fn(),
  reactivateField: vi.fn(),
  addFieldOption: vi.fn(),
  renameFieldOption: vi.fn(),
  deactivateFieldOption: vi.fn(),
  reactivateFieldOption: vi.fn(),
}));

const mockUseAuth = vi.fn();
vi.mock('../../context/AuthContext', () => ({ useAuth: () => mockUseAuth() }));

const ALL = [
  ...FIELD_DEFS,
  { _id: 'f5', appliesTo: 'variant', key: 'old', label: 'Old field', type: 'text', required: false, order: 3, active: false, options: [] },
];
const reloadForms = vi.fn(() => Promise.resolve());

const renderPage = (role = 'admin') => {
  mockUseAuth.mockReturnValue({ user: { _id: 'u1', role } });
  return render(
    <FieldsWrapper reload={reloadForms}>
      <MemoryRouter initialEntries={['/dashboard/fields']}>
        <Routes>
          <Route path="/dashboard/fields" element={<DashboardFields />} />
          <Route path="/dashboard" element={<div>Dashboard home</div>} />
        </Routes>
      </MemoryRouter>
    </FieldsWrapper>
  );
};

const section = (name) => screen.getByRole('region', { name });
const rowFor = (label) => screen.getByText(label, { selector: 'span' }).closest('li');

beforeEach(() => {
  vi.clearAllMocks();
  getAllFields.mockResolvedValue({ data: { data: ALL } });
});

describe('DashboardFields page', () => {
  it.each(['moderator', 'user'])('redirects a %s and never loads definitions', (role) => {
    renderPage(role);
    expect(screen.getByText('Dashboard home')).toBeInTheDocument();
    expect(getAllFields).not.toHaveBeenCalled();
  });

  it('shows loading, then an error with retry when loading fails', async () => {
    const user = userEvent.setup();
    getAllFields.mockRejectedValueOnce(new Error('down'));
    renderPage();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: /retry/i }));
    expect(await screen.findByRole('region', { name: 'Variant fields' })).toBeInTheDocument();
  });

  it('lists concept and variant fields with type, required and inactive badges', async () => {
    renderPage();
    await screen.findByRole('region', { name: 'Variant fields' });
    expect(within(section('Variant fields')).getAllByRole('listitem').filter((li) => li.parentElement.parentElement === section('Variant fields'))).toHaveLength(4);
    expect(within(rowFor('Plural form')).getByText('Required')).toBeInTheDocument();
    expect(within(rowFor('Register')).getByText('Dropdown')).toBeInTheDocument();
    expect(within(rowFor('Old field')).getByText('Inactive')).toBeInTheDocument();
    expect(within(section('Concept fields')).getByText('Etymology')).toBeInTheDocument();
  });

  it('renames, toggles required, reorders and deactivates, reloading both lists', async () => {
    const user = userEvent.setup();
    [updateField, reorderFields, deactivateField, reactivateField].forEach((fn) => fn.mockResolvedValue({}));
    renderPage();
    await screen.findByRole('region', { name: 'Variant fields' });

    await user.click(within(rowFor('Plural form')).getByRole('button', { name: 'Rename' }));
    const input = screen.getByLabelText('Label for plural');
    await user.clear(input);
    await user.type(input, 'Plural');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(updateField).toHaveBeenCalledWith('f1', { label: 'Plural' });

    await user.click(within(rowFor('Register')).getByRole('button', { name: 'Make required' }));
    expect(updateField).toHaveBeenCalledWith('f2', { required: true });

    await user.click(screen.getByRole('button', { name: 'Move Register up' }));
    expect(reorderFields).toHaveBeenCalledWith('variant', ['f2', 'f1', 'f3', 'f5']);

    await user.click(within(rowFor('Usage notes')).getByRole('button', { name: 'Deactivate' }));
    expect(deactivateField).toHaveBeenCalledWith('f3');
    await user.click(within(rowFor('Old field')).getByRole('button', { name: 'Reactivate' }));
    expect(reactivateField).toHaveBeenCalledWith('f5');
    await waitFor(() => expect(reloadForms).toHaveBeenCalled());
  });

  it('manages dropdown options', async () => {
    const user = userEvent.setup();
    addFieldOption.mockResolvedValue({});
    deactivateFieldOption.mockResolvedValue({});
    renderPage();
    await screen.findByRole('region', { name: 'Variant fields' });
    await user.click(within(rowFor('Register')).getByRole('button', { name: /options \(3\)/i }));
    await user.type(screen.getByLabelText('New option for Register'), 'Poetic');
    await user.click(screen.getByRole('button', { name: 'Add option' }));
    expect(addFieldOption).toHaveBeenCalledWith('f2', 'Poetic');

    const formal = screen.getByText('Formal').closest('li');
    await user.click(within(formal).getByRole('button', { name: 'Deactivate' }));
    expect(deactivateFieldOption).toHaveBeenCalledWith('f2', 'o1');
  });

  it('creates a dropdown field with one option per line and validates input', async () => {
    const user = userEvent.setup();
    createField.mockResolvedValue({});
    renderPage();
    const variants = await screen.findByRole('region', { name: 'Variant fields' });

    await user.click(within(variants).getByRole('button', { name: 'Add field' }));
    expect(within(variants).getByRole('alert')).toHaveTextContent(/enter a label/i);

    await user.type(screen.getByLabelText('New variant field label'), 'Gender');
    await user.selectOptions(screen.getByLabelText('New variant field type'), 'Dropdown');
    await user.click(within(variants).getByRole('button', { name: 'Add field' }));
    expect(within(variants).getByRole('alert')).toHaveTextContent(/at least one option/i);

    await user.type(screen.getByLabelText('New variant field options'), 'Masculine{enter}Feminine{enter}{enter}');
    await user.click(within(variants).getByRole('checkbox'));
    await user.click(within(variants).getByRole('button', { name: 'Add field' }));
    expect(createField).toHaveBeenCalledWith({
      appliesTo: 'variant', type: 'select', label: 'Gender', required: true,
      options: [{ label: 'Masculine' }, { label: 'Feminine' }],
    });
  });

  it('shows the server error message when a change fails', async () => {
    const user = userEvent.setup();
    createField.mockRejectedValue({ response: { data: { error: { message: 'That label is already in use' } } } });
    renderPage();
    const concepts = await screen.findByRole('region', { name: 'Concept fields' });
    await user.type(screen.getByLabelText('New concept field label'), 'Etymology');
    await user.click(within(concepts).getByRole('button', { name: 'Add field' }));
    expect(await within(concepts).findByRole('alert')).toHaveTextContent('That label is already in use');
  });
});
