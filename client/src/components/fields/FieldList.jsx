import { useState } from 'react';
import { reorderFields } from '../../services/api';
import FieldRow from './FieldRow';
import NewFieldForm from './NewFieldForm';

export default function FieldList({ appliesTo, title, defs, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(action) {
    setBusy(true);
    setError('');
    try {
      await action();
      await onChanged();
      return true;
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Something went wrong');
      return false;
    } finally {
      setBusy(false);
    }
  }

  function move(index, dir) {
    const ids = defs.map((d) => d._id);
    [ids[index], ids[index + dir]] = [ids[index + dir], ids[index]];
    return run(() => reorderFields(appliesTo, ids));
  }

  return (
    <section aria-label={title} className="bg-white/[0.035] backdrop-blur-[32px] border border-white/[0.08] rounded-3xl p-5 space-y-4">
      <h2 className="text-lg font-display text-warm">{title}</h2>
      {error && <p role="alert" className="text-red-400 text-xs font-ui">{error}</p>}

      {defs.length === 0 ? (
        <p className="text-sm font-ui text-muted">No extra fields yet.</p>
      ) : (
        <ul className="space-y-2">
          {defs.map((def, i) => (
            <FieldRow
              key={def._id}
              def={def}
              isFirst={i === 0}
              isLast={i === defs.length - 1}
              busy={busy}
              run={run}
              onMove={(dir) => move(i, dir)}
            />
          ))}
        </ul>
      )}

      <NewFieldForm appliesTo={appliesTo} busy={busy} run={run} onError={setError} />
    </section>
  );
}
