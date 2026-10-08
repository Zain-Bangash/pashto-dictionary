import { useState } from 'react';

const LABEL_MAX = 50;
const btn = 'px-2.5 py-1 bg-white/[0.05] border border-white/[0.08] text-muted text-xs font-ui rounded-[8px] hover:text-warm hover:bg-white/[0.08] transition-colors disabled:opacity-30 disabled:cursor-not-allowed';

export default function LookupRow({ row, isFirst, isLast, busy, onMove, onRename, onToggle }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(row.label);
  const trimmed = label.trim();

  async function save(e) {
    e.preventDefault();
    if (!trimmed || trimmed === row.label) {
      setEditing(false);
      return;
    }
    if (await onRename(trimmed)) setEditing(false);
  }

  return (
    <li className={`flex items-center gap-3 bg-white/[0.035] border border-white/[0.08] rounded-[16px] px-4 py-3 ${row.active ? '' : 'opacity-60'}`}>
      <div className="flex flex-col gap-1">
        <button type="button" aria-label={`Move ${row.label} up`} disabled={busy || isFirst} onClick={() => onMove(-1)} className={btn}>↑</button>
        <button type="button" aria-label={`Move ${row.label} down`} disabled={busy || isLast} onClick={() => onMove(1)} className={btn}>↓</button>
      </div>

      <div className="flex-1 min-w-0">
        {editing ? (
          <form onSubmit={save} className="flex items-center gap-2">
            <input
              aria-label={`Label for ${row.key}`}
              value={label}
              maxLength={LABEL_MAX}
              onChange={(e) => setLabel(e.target.value)}
              className="flex-1 min-w-0 bg-black/40 border border-white/[0.08] rounded-[10px] px-3 py-1.5 text-warm text-sm font-ui outline-none focus:border-gold/50"
              autoFocus
            />
            <button type="submit" disabled={busy || !trimmed} className={btn}>Save</button>
            <button type="button" onClick={() => { setLabel(row.label); setEditing(false); }} className={btn}>Cancel</button>
          </form>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-ui text-warm truncate">{row.label}</span>
            {row.label !== row.key && <span className="text-xs font-ui text-muted">key: {row.key}</span>}
            {row.isSystem && (
              <span className="text-[10px] font-ui font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border border-gold/30 text-gold">Built-in</span>
            )}
            {!row.active && (
              <span className="text-[10px] font-ui font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border border-white/[0.15] text-muted">Inactive</span>
            )}
          </div>
        )}
      </div>

      {!editing && (
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={() => setEditing(true)} disabled={busy} className={btn}>Rename</button>
          {!row.isSystem && (
            <button type="button" onClick={onToggle} disabled={busy} className={btn}>
              {row.active ? 'Deactivate' : 'Reactivate'}
            </button>
          )}
        </div>
      )}
    </li>
  );
}
