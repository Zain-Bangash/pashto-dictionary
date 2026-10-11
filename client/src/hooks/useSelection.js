import { useState } from 'react';

// Selected queue items keyed by id; the selection empties whenever `resetKey` changes (new page, status or filters)
export default function useSelection(resetKey) {
  const [state, setState] = useState({ key: resetKey, items: new Map() });
  if (state.key !== resetKey) setState({ key: resetKey, items: new Map() });
  const items = state.key === resetKey ? state.items : new Map();

  const write = (fn) => setState((s) => {
    const next = new Map(s.items);
    fn(next);
    return { ...s, items: next };
  });

  return {
    list: [...items.values()],
    count: items.size,
    has: (id) => items.has(id),
    toggle: (item) => write((m) => (m.has(item.id) ? m.delete(item.id) : m.set(item.id, item))),
    setAll: (all, on) => write((m) => all.forEach((item) => (on ? m.set(item.id, item) : m.delete(item.id)))),
    keepOnly: (ids) => write((m) => [...m.keys()].forEach((id) => { if (!ids.includes(id)) m.delete(id); })),
    clear: () => write((m) => m.clear()),
  };
}
