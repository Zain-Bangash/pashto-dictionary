import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useLookups from './useLookups';

// Region (the user's own by default), search, page and any extra filters of a Wanted tab, all kept in the URL
export default function useWantedParams(extraKeys = []) {
  const { user } = useAuth();
  const { active } = useLookups();
  const [searchParams, setSearchParams] = useSearchParams();
  const regions = active('region');

  const region = searchParams.get('region') || regions.find((r) => r.key === user?.region)?.key || regions[0]?.key || '';
  const page = parseInt(searchParams.get('page') ?? '1', 10) || 1;
  const filters = Object.fromEntries(['q', ...extraKeys].map((k) => [k, searchParams.get(k) ?? '']));

  function update(changes) {
    const next = { region, ...filters, page: '1', ...changes };
    if (next.page === '1') delete next.page;
    setSearchParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v)));
  }

  return { region, page, filters, update };
}
