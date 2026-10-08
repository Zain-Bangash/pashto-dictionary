import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useAllFields from '../../hooks/useAllFields';
import useFieldDefinitions from '../../hooks/useFieldDefinitions';
import FieldList from '../../components/fields/FieldList';

const SECTIONS = [
  { appliesTo: 'concept', title: 'Concept fields' },
  { appliesTo: 'variant', title: 'Variant fields' },
];

export default function DashboardFields() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { defs, loading, error, reload } = useAllFields(isAdmin);
  const { reload: reloadForms } = useFieldDefinitions();

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  if (loading && defs.length === 0) return <div className="text-muted font-ui text-sm animate-pulse">Loading…</div>;
  if (error && defs.length === 0) {
    return (
      <div role="alert" className="text-red-400 font-ui text-sm">
        {error}.{' '}
        <button type="button" onClick={reload} className="underline hover:text-red-300">Retry</button>
      </div>
    );
  }

  const onChanged = () => Promise.all([reload(), reloadForms()]);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="space-y-1">
        <h1 className="text-2xl font-display text-warm">Fields</h1>
        <p className="text-sm font-ui text-muted">
          Extra fields appear on the Submit and edit forms and on entry pages. Required applies to new submissions only.
          Deactivating a field hides it everywhere but keeps the values already entered.
        </p>
      </div>
      {SECTIONS.map(({ appliesTo, title }) => (
        <FieldList
          key={appliesTo}
          appliesTo={appliesTo}
          title={title}
          defs={defs.filter((d) => d.appliesTo === appliesTo)}
          onChanged={onChanged}
        />
      ))}
    </div>
  );
}
