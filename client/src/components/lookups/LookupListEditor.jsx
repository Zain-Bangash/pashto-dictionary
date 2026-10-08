import { useState } from 'react';
import { createLookup, updateLookup, reorderLookups, deactivateLookup, reactivateLookup } from '../../services/api';
import LookupRow from './LookupRow';

const LABEL_MAX = 50;

export default function LookupListEditor({ type, title, rows, onChanged }) {
  const [label, setLabel] = useState('');
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

  async function add(e) {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) {
      setError('Enter a value to add');
      return;
    }
    if (await run(() => createLookup({ type, label: trimmed }))) setLabel('');
  }

  function move(index, dir) {
    const ids = rows.map((r) => r._id);
    [ids[index], ids[index + dir]] = [ids[index + dir], ids[index]];
    return run(() => reorderLookups(type, ids));
  }

  return (
    <section aria-label={title} className="bg-white/[0.035] backdrop-blur-[32px] border border-white/[0.08] rounded-3xl p-5 space-y-4">
      <h2 className="text-lg font-display text-warm">{title}</h2>

      {error && <p role="alert" className="text-red-400 text-xs font-ui">{error}</p>}

      <ul className="space-y-2">
        {rows.map((row, i) => (
          <LookupRow
            key={row._id}
            row={row}
            isFirst={i === 0}
            isLast={i === rows.length - 1}
            busy={busy}
            onMove={(dir) => move(i, dir)}
            onRename={(newLabel) => run(() => updateLookup(row._id, { label: newLabel }))}
            onToggle={() => run(() => (row.active ? deactivateLookup(row._id) : reactivateLookup(row._id)))}
          />
        ))}
      </ul>

      <form onSubmit={add} className="flex items-center gap-2">
        <input
          aria-label={`New ${title.toLowerCase()} value`}
          placeholder="Add a value…"
          value={label}
          maxLength={LABEL_MAX}
          onChange={(e) => setLabel(e.target.value)}
          className="flex-1 min-w-0 bg-black/40 border border-white/[0.08] rounded-[12px] px-3.5 py-2 text-warm text-sm font-ui outline-none focus:border-gold/50"
        />
        <span className="text-[11px] font-ui text-muted w-12 text-right">{label.length}/{LABEL_MAX}</span>
        <button
          type="submit"
          disabled={busy}
          className="px-4 py-2 bg-terracotta text-warm text-xs font-ui font-semibold rounded-[10px] hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          Add
        </button>
      </form>
    </section>
  );
}
