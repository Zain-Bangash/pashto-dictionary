import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useLookups from '../../hooks/useLookups';
import LookupListEditor from '../../components/lookups/LookupListEditor';

const LISTS = [
  { type: 'region', title: 'Regions' },
  { type: 'partOfSpeech', title: 'Parts of speech' },
];

export default function DashboardLists() {
  const { user } = useAuth();
  const { all, rows, loading, error, reload } = useLookups();

  if (!user || user.role !== 'admin') return <Navigate to="/dashboard" replace />;

  if (loading && rows.length === 0) return <div className="text-muted font-ui text-sm animate-pulse">Loading…</div>;
  if (error && rows.length === 0) {
    return (
      <div role="alert" className="text-red-400 font-ui text-sm">
        {error}.{' '}
        <button type="button" onClick={reload} className="underline hover:text-red-300">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="space-y-1">
        <h1 className="text-2xl font-display text-warm">Lists</h1>
        <p className="text-sm font-ui text-muted">
          Renaming a value updates every entry that uses it. Deactivated values are hidden from forms but still shown on existing entries.
        </p>
      </div>
      {LISTS.map(({ type, title }) => (
        <LookupListEditor key={type} type={type} title={title} rows={all(type)} onChanged={reload} />
      ))}
    </div>
  );
}
