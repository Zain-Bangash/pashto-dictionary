import { useState, useCallback } from 'react';

// Filter and page state for one My Submissions list. `scope` is whatever the parent controls (the status),
// so when it changes from outside the list goes back to page 1 without an effect.
export default function useListFilters(initial, scope) {
  const [state, setState] = useState({ ...initial, page: 1, scope });
  const filters = { ...state, page: state.scope === scope ? state.page : 1 };
  const change = useCallback((changes) => setState((s) => ({ ...s, ...changes, page: 1, scope })), [scope]);
  const setPage = useCallback((page) => setState((s) => ({ ...s, page, scope })), [scope]);
  return { filters, change, setPage };
}
