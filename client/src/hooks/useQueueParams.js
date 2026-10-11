import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

// Queue status, filters and page live in the URL so a refresh or a shared link keeps them.
// Changing anything but the page goes back to page 1; defaults are left out of the URL.
export default function useQueueParams(isAdmin) {
  const [sp, setSp] = useSearchParams();
  const status = isAdmin && sp.get('status') === 'approved' ? 'approved' : 'pending';
  const q = sp.get('q') ?? '';
  const region = sp.get('region') ?? '';
  const user = sp.get('user') ?? '';
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1);

  const update = useCallback((changes) => {
    setSp((prev) => {
      const next = new URLSearchParams(prev);
      const merged = 'page' in changes ? changes : { ...changes, page: 1 };
      for (const [key, value] of Object.entries(merged)) {
        const isDefault = !value || (key === 'page' && value === 1) || (key === 'status' && value === 'pending');
        if (isDefault) next.delete(key);
        else next.set(key, String(value));
      }
      return next;
    }, { replace: true });
  }, [setSp]);

  const filters = { q, region, user };
  return { status, page, filters, filtering: Boolean(q || region || user), update };
}

// Only the filters that are set, ready to send as query params
export function activeFilters(filters) {
  return Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
}
