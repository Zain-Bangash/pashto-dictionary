import { createContext } from 'react';

export function buildLookupsValue({ rows = [], loading = false, error = null, reload = () => {} } = {}) {
  const byKey = new Map(rows.map((r) => [`${r.type}:${r.key}`, r]));
  return {
    rows,
    loading,
    error,
    reload,
    all: (type) => rows.filter((r) => r.type === type),
    active: (type) => rows.filter((r) => r.type === type && r.active),
    find: (type, key) => byKey.get(`${type}:${key}`),
    labelFor: (type, key) => byKey.get(`${type}:${key}`)?.label ?? key,
  };
}

export const LookupsContext = createContext(buildLookupsValue());
