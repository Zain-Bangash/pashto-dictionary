import { createContext } from 'react';

export function buildFieldsValue({ defs = [], loading = false, error = null, reload = () => {} } = {}) {
  const byKey = new Map(defs.map((d) => [`${d.appliesTo}:${d.key}`, d]));
  return {
    defs,
    loading,
    error,
    reload,
    forType: (appliesTo) => defs.filter((d) => d.appliesTo === appliesTo && d.active !== false),
    fieldLabel: (appliesTo, key) => byKey.get(`${appliesTo}:${key}`)?.label ?? key,
  };
}

export function optionLabel(def, key) {
  return def.options?.find((o) => o.key === key)?.label ?? key;
}

export function missingRequired(defs, values = {}) {
  return Object.fromEntries(
    defs.filter((d) => d.required && !String(values[d.key] ?? '').trim()).map((d) => [d.key, `${d.label} is required`])
  );
}

export const FieldsContext = createContext(buildFieldsValue());
