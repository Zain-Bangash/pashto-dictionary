import { FieldsContext, buildFieldsValue } from '../../context/fieldsValue';

export const FIELD_DEFS = [
  { _id: 'f1', appliesTo: 'variant', key: 'plural', label: 'Plural form', type: 'text', required: true, order: 0, active: true, options: [] },
  {
    _id: 'f2', appliesTo: 'variant', key: 'register', label: 'Register', type: 'select', required: false, order: 1, active: true,
    options: [
      { _id: 'o1', key: 'Formal', label: 'Formal', active: true },
      { _id: 'o2', key: 'Slang', label: 'Slang (colloquial)', active: true },
      { _id: 'o3', key: 'Archaic', label: 'Archaic', active: false },
    ],
  },
  { _id: 'f3', appliesTo: 'variant', key: 'usage', label: 'Usage notes', type: 'textarea', required: false, order: 2, active: true, options: [] },
  { _id: 'f4', appliesTo: 'concept', key: 'etymology', label: 'Etymology', type: 'text', required: false, order: 0, active: true, options: [] },
];

export function FieldsWrapper({ defs = FIELD_DEFS, loading = false, error = null, reload = () => {}, children }) {
  return (
    <FieldsContext.Provider value={buildFieldsValue({ defs, loading, error, reload })}>
      {children}
    </FieldsContext.Provider>
  );
}
